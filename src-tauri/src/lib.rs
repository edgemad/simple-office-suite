use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::ffi::OsStr;
use std::fs::{self, File, OpenOptions};
use std::io::{self, Read, Seek, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Mutex, MutexGuard};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, State};
use zip::ZipArchive;

const MAX_FILE_BYTES: u64 = 64 * 1024 * 1024;
const MAX_AUTOSAVE_PAYLOAD_BYTES: usize = 32 * 1024 * 1024;
const MAX_ARCHIVE_ENTRIES: usize = 10_000;
const MAX_ARCHIVE_ENTRY_BYTES: u64 = 32 * 1024 * 1024;
const MAX_ARCHIVE_TOTAL_BYTES: u64 = 128 * 1024 * 1024;
const MAX_DOCUMENT_ID_BYTES: usize = 128;
const MAX_DIALOG_FILTERS: usize = 32;
const MAX_DIALOG_EXTENSIONS: usize = 32;
const MAX_DIALOG_TEXT_BYTES: usize = 256;
const MAX_DIALOG_EXTENSION_BYTES: usize = 32;
const ALLOWED_AUTOSAVE_MODULES: [&str; 4] = ["writer", "sheets", "slides", "pdf"];

static TEMP_FILE_COUNTER: AtomicU64 = AtomicU64::new(0);

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FileFilter {
    pub name: String,
    pub extensions: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SystemMetrics {
    pub platform: String,
    pub arch: String,
    pub memory_used_mb: f64,
    pub total_memory_mb: f64,
    pub cpu_count: usize,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FileSaveResult {
    pub success: bool,
    pub path: String,
    pub timestamp: String,
}

#[derive(Default)]
pub struct AppState {
    pub last_opened_path: Mutex<Option<String>>,
    authorized_read_paths: Mutex<HashSet<PathBuf>>,
    authorized_write_paths: Mutex<HashSet<PathBuf>>,
}

#[derive(Clone, Copy)]
enum PathAccess {
    Read,
    Write,
}

fn lock_state<'a, T>(mutex: &'a Mutex<T>, name: &str) -> Result<MutexGuard<'a, T>, String> {
    mutex
        .lock()
        .map_err(|_| format!("{} state is unavailable", name))
}

fn validate_absolute_path(path: &Path) -> Result<(), String> {
    if path.as_os_str().is_empty() {
        return Err("File path cannot be empty".to_string());
    }
    if !path.is_absolute() {
        return Err("File path must be absolute".to_string());
    }
    Ok(())
}

fn ensure_regular_file(path: &Path) -> Result<(), String> {
    let metadata = fs::metadata(path).map_err(|e| format!("Cannot inspect file: {}", e))?;
    if !metadata.is_file() {
        return Err("The selected path is not a regular file".to_string());
    }
    Ok(())
}

fn canonical_existing_file(path: &Path) -> Result<PathBuf, String> {
    validate_absolute_path(path)?;
    let canonical =
        fs::canonicalize(path).map_err(|e| format!("Cannot resolve file path: {}", e))?;
    ensure_regular_file(&canonical)?;
    Ok(canonical)
}

fn canonical_destination(path: &Path) -> Result<PathBuf, String> {
    validate_absolute_path(path)?;

    match fs::canonicalize(path) {
        Ok(canonical) => {
            ensure_regular_file(&canonical)?;
            Ok(canonical)
        }
        Err(error) if error.kind() == io::ErrorKind::NotFound => {
            match fs::symlink_metadata(path) {
                Ok(metadata) => {
                    if metadata.file_type().is_symlink() {
                        return Err("The save destination cannot be a symbolic link".to_string());
                    }
                    return Err("The save destination is not a regular file".to_string());
                }
                Err(metadata_error) if metadata_error.kind() == io::ErrorKind::NotFound => {}
                Err(metadata_error) => {
                    return Err(format!(
                        "Cannot inspect save destination: {}",
                        metadata_error
                    ));
                }
            }

            let file_name = path
                .file_name()
                .ok_or_else(|| "Save destination must include a file name".to_string())?;
            if file_name == OsStr::new(".") || file_name == OsStr::new("..") {
                return Err("Save destination must include a file name".to_string());
            }
            let parent = path
                .parent()
                .ok_or_else(|| "Save destination must include a parent directory".to_string())?;
            let canonical_parent = fs::canonicalize(parent)
                .map_err(|e| format!("Cannot resolve save directory: {}", e))?;
            let parent_metadata = fs::metadata(&canonical_parent)
                .map_err(|e| format!("Cannot inspect save directory: {}", e))?;
            if !parent_metadata.is_dir() {
                return Err("Save destination parent is not a directory".to_string());
            }
            Ok(canonical_parent.join(file_name))
        }
        Err(error) => Err(format!("Cannot resolve save destination: {}", error)),
    }
}

fn authorize_path(state: &AppState, raw_path: &str, access: PathAccess) -> Result<PathBuf, String> {
    let path = Path::new(raw_path);
    let canonical = match access {
        PathAccess::Read => canonical_existing_file(path)?,
        PathAccess::Write => canonical_destination(path)?,
    };
    let paths = match access {
        PathAccess::Read => &state.authorized_read_paths,
        PathAccess::Write => &state.authorized_write_paths,
    };
    let paths = lock_state(paths, "file authorization")?;
    if !paths.contains(&canonical) {
        return Err("File path was not approved by a native file dialog".to_string());
    }
    Ok(canonical)
}

fn register_open_path(state: &AppState, raw_path: &str) -> Result<(), String> {
    let canonical = canonical_existing_file(Path::new(raw_path))?;
    let mut read_paths = lock_state(&state.authorized_read_paths, "file authorization")?;
    read_paths.insert(canonical.clone());
    drop(read_paths);
    let mut write_paths = lock_state(&state.authorized_write_paths, "file authorization")?;
    write_paths.insert(canonical);
    *lock_state(&state.last_opened_path, "last opened path")? = Some(raw_path.to_string());
    Ok(())
}

fn register_save_path(state: &AppState, raw_path: &str) -> Result<(), String> {
    let canonical = canonical_destination(Path::new(raw_path))?;
    let mut write_paths = lock_state(&state.authorized_write_paths, "file authorization")?;
    write_paths.insert(canonical);
    Ok(())
}

fn read_limited_file(path: &Path, max_bytes: u64, description: &str) -> Result<Vec<u8>, String> {
    let file = File::open(path).map_err(|e| format!("Cannot open {}: {}", description, e))?;
    let metadata = file
        .metadata()
        .map_err(|e| format!("Cannot inspect {}: {}", description, e))?;
    if !metadata.is_file() {
        return Err(format!("{} is not a regular file", description));
    }
    if metadata.len() > max_bytes {
        return Err(format!(
            "{} exceeds the maximum size of {} bytes",
            description, max_bytes
        ));
    }

    let mut bytes = Vec::new();
    file.take(max_bytes.saturating_add(1))
        .read_to_end(&mut bytes)
        .map_err(|e| format!("Failed to read {}: {}", description, e))?;
    if bytes.len() as u64 > max_bytes {
        return Err(format!(
            "{} exceeds the maximum size of {} bytes",
            description, max_bytes
        ));
    }
    Ok(bytes)
}

fn decode_utf8_lossy_limited(
    bytes: &[u8],
    max_bytes: usize,
    description: &str,
) -> Result<String, String> {
    let decoded = String::from_utf8_lossy(bytes);
    if decoded.len() > max_bytes {
        return Err(format!(
            "{} exceeds the maximum decoded size of {} bytes",
            description, max_bytes
        ));
    }
    Ok(decoded.into_owned())
}

fn read_limited_entry<R: Read>(
    reader: &mut R,
    max_entry_bytes: u64,
    remaining_total_bytes: &mut u64,
    description: &str,
) -> Result<String, String> {
    let limit = max_entry_bytes.min(*remaining_total_bytes);
    let mut bytes = Vec::new();
    reader
        .take(limit.saturating_add(1))
        .read_to_end(&mut bytes)
        .map_err(|e| format!("Failed to decompress {}: {}", description, e))?;
    let actual = bytes.len() as u64;
    if actual > limit {
        return Err(format!("{} exceeds the decompression limit", description));
    }
    *remaining_total_bytes = remaining_total_bytes.saturating_sub(actual);
    String::from_utf8(bytes).map_err(|_| format!("{} is not valid UTF-8", description))
}

fn is_safe_archive_entry_name(name: &str) -> bool {
    if name.is_empty() || name.starts_with('/') || name.starts_with('\\') || name.contains('\0') {
        return false;
    }

    let mut has_component = false;
    for component in name.split(['/', '\\']) {
        if component.is_empty() {
            continue;
        }
        if component == "." || component == ".." || component.contains(':') {
            return false;
        }
        has_component = true;
    }
    has_component
}

fn validate_archive<R: Read + Seek>(
    archive: &mut ZipArchive<R>,
    description: &str,
) -> Result<(), String> {
    if archive.len() > MAX_ARCHIVE_ENTRIES {
        return Err(format!(
            "{} contains more than the maximum of {} entries",
            description, MAX_ARCHIVE_ENTRIES
        ));
    }

    let mut total_size = 0u64;
    for index in 0..archive.len() {
        let entry = archive
            .by_index(index)
            .map_err(|e| format!("Cannot inspect {} entry: {}", description, e))?;
        let name = entry.name();
        if !is_safe_archive_entry_name(name) {
            return Err(format!(
                "{} contains an unsafe archive entry name",
                description
            ));
        }
        let entry_size = entry.size();
        if entry_size > MAX_ARCHIVE_ENTRY_BYTES {
            return Err(format!(
                "{} entry exceeds the maximum decompressed size",
                description
            ));
        }
        total_size = total_size
            .checked_add(entry_size)
            .ok_or_else(|| format!("{} decompressed size overflow", description))?;
        if total_size > MAX_ARCHIVE_TOTAL_BYTES {
            return Err(format!(
                "{} exceeds the maximum total decompressed size",
                description
            ));
        }
    }
    Ok(())
}

fn open_archive(path: &Path, description: &str) -> Result<ZipArchive<File>, String> {
    let file =
        File::open(path).map_err(|e| format!("Cannot open {} archive: {}", description, e))?;
    let metadata = file
        .metadata()
        .map_err(|e| format!("Cannot inspect {} archive: {}", description, e))?;
    if metadata.len() > MAX_FILE_BYTES {
        return Err(format!(
            "{} archive exceeds the maximum input size",
            description
        ));
    }
    let mut archive =
        ZipArchive::new(file).map_err(|e| format!("Invalid {} archive: {}", description, e))?;
    validate_archive(&mut archive, description)?;
    Ok(archive)
}

fn decode_xml_entities(value: &str) -> String {
    value
        .replace("&quot;", "\"")
        .replace("&apos;", "'")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&amp;", "&")
}

fn escape_html(value: &str) -> String {
    let mut escaped = String::with_capacity(value.len());
    for character in value.chars() {
        match character {
            '&' => escaped.push_str("&amp;"),
            '<' => escaped.push_str("&lt;"),
            '>' => escaped.push_str("&gt;"),
            '"' => escaped.push_str("&quot;"),
            '\'' => escaped.push_str("&#39;"),
            _ => escaped.push(character),
        }
    }
    escaped
}

fn regex_lite_find_all_t(xml: &str) -> Vec<String> {
    let mut result = Vec::new();
    let mut position = 0;

    while position < xml.len() {
        let Some(relative_start) = xml[position..].find('<') else {
            break;
        };
        let start = position + relative_start;
        let after_start = &xml[start + 1..];
        let name_end = after_start
            .find(|character: char| {
                character == '>' || character == '/' || character.is_ascii_whitespace()
            })
            .unwrap_or(after_start.len());
        let tag_name = &after_start[..name_end];
        let local_name = tag_name.rsplit(':').next().unwrap_or(tag_name);
        if local_name != "t" || tag_name.is_empty() {
            position = start + 1;
            continue;
        }

        let Some(relative_header_end) = xml[start..].find('>') else {
            break;
        };
        let header_end = start + relative_header_end;
        let header = &xml[start..header_end];
        if header.ends_with('/') {
            position = header_end + 1;
            continue;
        }

        let content_start = header_end + 1;
        let closing_tag = format!("</{}>", tag_name);
        let Some(relative_content_end) = xml[content_start..].find(&closing_tag) else {
            position = header_end + 1;
            continue;
        };
        let content_end = content_start + relative_content_end;
        result.push(decode_xml_entities(&xml[content_start..content_end]));
        position = content_end + closing_tag.len();
    }
    result
}

fn numbered_xml_part(name: &str, prefix: &str, suffix: &str) -> Option<u64> {
    let number = name.strip_prefix(prefix)?.strip_suffix(suffix)?;
    if number.is_empty() || !number.bytes().all(|byte| byte.is_ascii_digit()) {
        return None;
    }
    number.parse::<u64>().ok()
}

fn worksheet_number(name: &str) -> Option<u64> {
    numbered_xml_part(name, "xl/worksheets/sheet", ".xml")
}

fn pptx_slide_number(name: &str) -> Option<u64> {
    numbered_xml_part(name, "ppt/slides/slide", ".xml")
}

fn extract_attr(tag: &str, attr: &str) -> Option<String> {
    let pattern = format!("{}=\"", attr);
    if let Some(start) = tag.find(&pattern) {
        let value_start = start + pattern.len();
        if let Some(end) = tag[value_start..].find('"') {
            return Some(tag[value_start..value_start + end].to_string());
        }
    }
    None
}

fn parse_sheet_cells(xml: &str, shared_strings: &[String]) -> String {
    let mut cells = serde_json::Map::new();
    let mut position = 0;

    while let Some(cell_start) = xml[position..].find("<c ") {
        let start = position + cell_start;
        let rest = &xml[start..];
        let Some(tag_close) = rest.find('>') else {
            break;
        };
        let tag_header = &rest[..tag_close];
        let is_self_closing = tag_header.ends_with('/');
        let Some(coord) = extract_attr(tag_header, "r") else {
            position = start + tag_close + 1;
            continue;
        };
        let cell_type = extract_attr(tag_header, "t").unwrap_or_default();
        let mut raw_value = String::new();
        let mut formula = String::new();

        if !is_self_closing {
            let Some(cell_end) = rest.find("</c>") else {
                position = start + tag_close + 1;
                continue;
            };
            let body = &rest[tag_close + 1..cell_end];
            if let Some(formula_start) = body.find("<f>") {
                if let Some(formula_end) = body[formula_start + 3..].find("</f>") {
                    formula = body[formula_start + 3..formula_start + 3 + formula_end].to_string();
                }
            }
            if let Some(value_start) = body.find("<v>") {
                if let Some(value_end) = body[value_start + 3..].find("</v>") {
                    raw_value = body[value_start + 3..value_start + 3 + value_end].to_string();
                }
            }
            if raw_value.is_empty() {
                let texts = regex_lite_find_all_t(body);
                raw_value = texts.join("");
            }
            position = start + cell_end + 4;
        } else {
            position = start + tag_close + 1;
        }

        if cell_type == "s" {
            if let Ok(index) = raw_value.parse::<usize>() {
                if let Some(shared_value) = shared_strings.get(index) {
                    raw_value = shared_value.clone();
                } else {
                    raw_value = decode_xml_entities(&raw_value);
                }
            } else {
                raw_value = decode_xml_entities(&raw_value);
            }
        } else {
            raw_value = decode_xml_entities(&raw_value);
        }

        let display_value = if !raw_value.is_empty() {
            raw_value.clone()
        } else if !formula.is_empty() {
            formula.clone()
        } else {
            String::new()
        };
        if !display_value.is_empty() || !formula.is_empty() {
            cells.insert(
                coord,
                serde_json::json!({
                    "raw": if formula.is_empty() { raw_value.clone() } else { formula.clone() },
                    "computed": raw_value
                }),
            );
        }
    }

    serde_json::json!({
        "type": "xlsx",
        "cells": cells
    })
    .to_string()
}

fn parse_xlsx_archive(path: &Path) -> Result<String, String> {
    let mut archive = open_archive(path, "XLSX")?;
    let mut remaining_total = MAX_ARCHIVE_TOTAL_BYTES;
    let shared_strings = match archive.by_name("xl/sharedStrings.xml") {
        Ok(mut file) => regex_lite_find_all_t(&read_limited_entry(
            &mut file,
            MAX_ARCHIVE_ENTRY_BYTES,
            &mut remaining_total,
            "XLSX shared strings",
        )?),
        Err(zip::result::ZipError::FileNotFound) => Vec::new(),
        Err(error) => return Err(format!("Cannot read XLSX shared strings: {}", error)),
    };

    let mut worksheets = Vec::new();
    for index in 0..archive.len() {
        if let Some(name) = archive.name_for_index(index) {
            if let Some(number) = worksheet_number(name) {
                worksheets.push((number, index));
            }
        }
    }
    worksheets.sort_by(|(number_a, index_a), (number_b, index_b)| {
        number_a.cmp(number_b).then(index_a.cmp(index_b))
    });
    let Some((_, worksheet_index)) = worksheets.first().copied() else {
        return Err("No worksheet XML found in XLSX".to_string());
    };
    let mut worksheet = archive
        .by_index(worksheet_index)
        .map_err(|e| format!("Cannot read XLSX worksheet: {}", e))?;
    let sheet_content = read_limited_entry(
        &mut worksheet,
        MAX_ARCHIVE_ENTRY_BYTES,
        &mut remaining_total,
        "XLSX worksheet",
    )?;
    Ok(parse_sheet_cells(&sheet_content, &shared_strings))
}

fn parse_docx_archive(path: &Path) -> Result<String, String> {
    let mut archive = open_archive(path, "DOCX")?;
    let mut remaining_total = MAX_ARCHIVE_TOTAL_BYTES;
    let document_xml = match archive.by_name("word/document.xml") {
        Ok(mut file) => read_limited_entry(
            &mut file,
            MAX_ARCHIVE_ENTRY_BYTES,
            &mut remaining_total,
            "DOCX document",
        )?,
        Err(zip::result::ZipError::FileNotFound) => {
            return Err("Could not find word/document.xml in DOCX archive".to_string())
        }
        Err(error) => return Err(format!("Cannot read DOCX document: {}", error)),
    };

    let mut html = String::new();
    for paragraph_xml in document_xml.split("</w:p>") {
        let mut paragraph = String::new();
        for run_xml in paragraph_xml.split("</w:r>") {
            let is_bold = run_xml.contains("<w:b/>") || run_xml.contains("<w:b ");
            let is_italic = run_xml.contains("<w:i/>") || run_xml.contains("<w:i ");
            let combined = regex_lite_find_all_t(run_xml).join("");
            if !combined.is_empty() {
                let mut chunk = escape_html(&combined);
                if is_bold {
                    chunk = format!("<strong>{}</strong>", chunk);
                }
                if is_italic {
                    chunk = format!("<em>{}</em>", chunk);
                }
                paragraph.push_str(&chunk);
            }
        }
        if !paragraph.is_empty() {
            html.push_str("<p>");
            html.push_str(&paragraph);
            html.push_str("</p>\n");
        }
    }

    if html.is_empty() {
        html.push_str("<p>Empty document</p>");
    }
    Ok(html)
}

fn parse_pptx_archive(path: &Path) -> Result<String, String> {
    let mut archive = open_archive(path, "PPTX")?;
    let mut slide_indexes = Vec::new();
    for index in 0..archive.len() {
        if let Some(name) = archive.name_for_index(index) {
            if let Some(number) = pptx_slide_number(name) {
                slide_indexes.push((number, index));
            }
        }
    }
    slide_indexes.sort_by(|(number_a, index_a), (number_b, index_b)| {
        number_a.cmp(number_b).then(index_a.cmp(index_b))
    });
    if slide_indexes.is_empty() {
        return Err("No slides found in PPTX".to_string());
    }

    let mut remaining_total = MAX_ARCHIVE_TOTAL_BYTES;
    let mut seen_numbers = HashSet::new();
    let mut slides = Vec::new();
    for (slide_number, slide_index) in slide_indexes {
        if !seen_numbers.insert(slide_number) {
            return Err("PPTX contains duplicate slide numbers".to_string());
        }
        let mut slide_file = archive
            .by_index(slide_index)
            .map_err(|e| format!("Cannot read PPTX slide: {}", e))?;
        let slide_content = read_limited_entry(
            &mut slide_file,
            MAX_ARCHIVE_ENTRY_BYTES,
            &mut remaining_total,
            "PPTX slide",
        )?;
        let texts = regex_lite_find_all_t(&slide_content);
        let title = texts
            .first()
            .cloned()
            .unwrap_or_else(|| "Slide".to_string());
        let body = texts.iter().skip(1).cloned().collect::<Vec<_>>().join("\n");
        slides.push(serde_json::json!({
            "id": format!("s_{}", slide_number),
            "title": title,
            "bgColor": "#ffffff",
            "elements": [
                {
                    "id": format!("t_{}", slide_number),
                    "type": "title",
                    "x": 10,
                    "y": 15,
                    "width": 80,
                    "height": 15,
                    "content": title
                },
                {
                    "id": format!("b_{}", slide_number),
                    "type": "text",
                    "x": 10,
                    "y": 35,
                    "width": 80,
                    "height": 50,
                    "content": body
                }
            ]
        }));
    }

    let deck = serde_json::json!({
        "meta": {
            "title": "Imported Presentation",
            "isDirty": false,
            "mode": "slides"
        },
        "aspectRatio": "16:9",
        "slides": slides
    });
    Ok(deck.to_string())
}

fn reject_binary_input(bytes: &[u8]) -> Result<(), String> {
    if bytes.starts_with(b"%PDF") {
        return Err(
            "Opening binary PDF files is not implemented in this build. The PDF workspace is a form layout prototype. Use print to PDF from a Writer or Slides document instead."
                .to_string(),
        );
    }

    let head_len = bytes.len().min(4096);
    let head = String::from_utf8_lossy(&bytes[..head_len]);
    if head.contains('\u{FFFD}') {
        return Err(
            "This file looks like a binary or non-text format that Simple Office Suite cannot import. Supported inputs are text documents, Markdown, HTML, RTF, CSV/TSV, suite JSON, and DOCX/XLSX/PPTX packages."
                .to_string(),
        );
    }

    Ok(())
}

#[tauri::command]
fn read_text_file(state: State<'_, AppState>, path: String) -> Result<String, String> {
    let authorized_path = authorize_path(state.inner(), &path, PathAccess::Read)?;
    let bytes = read_limited_file(&authorized_path, MAX_FILE_BYTES, "Input file")?;

    if bytes.starts_with(b"PK") {
        if let Ok(json) = parse_xlsx_archive(&authorized_path) {
            return Ok(json);
        }
        if let Ok(html) = parse_docx_archive(&authorized_path) {
            return Ok(html);
        }
        if let Ok(json) = parse_pptx_archive(&authorized_path) {
            return Ok(json);
        }
        return Err("This file is a compressed binary ZIP archive that could not be parsed as an office document.".to_string());
    }

    let extension = authorized_path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_lowercase();
    if extension == "xlsx" || extension == "xls" {
        if let Ok(json) = parse_xlsx_archive(&authorized_path) {
            return Ok(json);
        }
    } else if extension == "docx" || extension == "doc" {
        if let Ok(html) = parse_docx_archive(&authorized_path) {
            return Ok(html);
        }
    } else if extension == "pptx" {
        if let Ok(json) = parse_pptx_archive(&authorized_path) {
            return Ok(json);
        }
    }

    reject_binary_input(&bytes)?;
    decode_utf8_lossy_limited(&bytes, MAX_FILE_BYTES as usize, "Input file")
}

#[tauri::command]
fn write_text_file(
    state: State<'_, AppState>,
    path: String,
    contents: String,
) -> Result<FileSaveResult, String> {
    if contents.len() as u64 > MAX_FILE_BYTES {
        return Err(format!(
            "Input exceeds the maximum size of {} bytes",
            MAX_FILE_BYTES
        ));
    }
    let authorized_path = authorize_path(state.inner(), &path, PathAccess::Write)?;
    write_file_atomically(&authorized_path, contents.as_bytes(), MAX_FILE_BYTES)?;

    Ok(FileSaveResult {
        success: true,
        path,
        timestamp: chrono::Local::now().to_rfc3339(),
    })
}

fn validate_autosave_identity(module: &str, document_id: &str) -> Result<(), String> {
    if !ALLOWED_AUTOSAVE_MODULES.contains(&module) {
        return Err("Autosave module is not allowed".to_string());
    }
    if document_id.is_empty()
        || document_id.len() > MAX_DOCUMENT_ID_BYTES
        || !document_id
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'_' || byte == b'-')
    {
        return Err("Autosave document ID is invalid".to_string());
    }
    Ok(())
}

fn ensure_directory(path: &Path, canonical_root: &Path) -> Result<(), String> {
    match fs::symlink_metadata(path) {
        Ok(metadata) => {
            if metadata.file_type().is_symlink() {
                return Err("Autosave directory cannot be a symbolic link".to_string());
            }
            if !metadata.is_dir() {
                return Err("Autosave path is not a directory".to_string());
            }
        }
        Err(error) if error.kind() == io::ErrorKind::NotFound => {
            match fs::create_dir(path) {
                Ok(()) => {}
                Err(create_error) if create_error.kind() == io::ErrorKind::AlreadyExists => {}
                Err(create_error) => {
                    return Err(format!(
                        "Failed to create autosave directory: {}",
                        create_error
                    ));
                }
            }
            let metadata = fs::symlink_metadata(path)
                .map_err(|e| format!("Cannot inspect autosave directory: {}", e))?;
            if metadata.file_type().is_symlink() {
                return Err("Autosave directory cannot be a symbolic link".to_string());
            }
            if !metadata.is_dir() {
                return Err("Autosave path is not a directory".to_string());
            }
        }
        Err(error) => return Err(format!("Cannot inspect autosave directory: {}", error)),
    }

    let canonical =
        fs::canonicalize(path).map_err(|e| format!("Cannot resolve autosave directory: {}", e))?;
    if !canonical.starts_with(canonical_root) {
        return Err("Autosave directory is outside the application data directory".to_string());
    }
    Ok(())
}

fn get_autosave_dir() -> Result<PathBuf, String> {
    let base = dirs::data_local_dir()
        .or_else(dirs::data_dir)
        .ok_or_else(|| "Application data directory is unavailable".to_string())?;
    let base_metadata = fs::metadata(&base)
        .map_err(|e| format!("Cannot inspect application data directory: {}", e))?;
    if !base_metadata.is_dir() {
        return Err("Application data path is not a directory".to_string());
    }
    let canonical_base = fs::canonicalize(&base)
        .map_err(|e| format!("Cannot resolve application data directory: {}", e))?;
    let application_dir = base.join("SimpleOfficeSuite");
    let autosave_dir = application_dir.join("autosaves");
    ensure_directory(&application_dir, &canonical_base)?;
    ensure_directory(&autosave_dir, &canonical_base)?;
    let canonical = fs::canonicalize(&autosave_dir)
        .map_err(|e| format!("Cannot resolve autosave directory: {}", e))?;
    if !canonical.starts_with(&canonical_base) {
        return Err("Autosave directory is outside the application data directory".to_string());
    }
    Ok(canonical)
}

fn autosave_target(module: &str, document_id: &str) -> Result<(PathBuf, PathBuf), String> {
    validate_autosave_identity(module, document_id)?;
    let directory = get_autosave_dir()?;
    let target = directory.join(format!("{}_{}.json", module, document_id));
    Ok((directory, target))
}

fn ensure_autosave_target(target: &Path) -> Result<bool, String> {
    match fs::symlink_metadata(target) {
        Ok(metadata) => {
            if metadata.file_type().is_symlink() {
                return Err("Autosave target cannot be a symbolic link".to_string());
            }
            if !metadata.is_file() {
                return Err("Autosave target is not a regular file".to_string());
            }
            Ok(true)
        }
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(false),
        Err(error) => Err(format!("Cannot inspect autosave target: {}", error)),
    }
}

fn create_private_temp_file(directory: &Path) -> Result<(PathBuf, File), String> {
    for _ in 0..100 {
        let counter = TEMP_FILE_COUNTER.fetch_add(1, Ordering::Relaxed);
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|duration| duration.as_nanos())
            .unwrap_or(0);
        let path = directory.join(format!(
            ".sos-{}-{}-{}.tmp",
            std::process::id(),
            timestamp,
            counter
        ));
        let mut options = OpenOptions::new();
        options.write(true).create_new(true);
        #[cfg(unix)]
        {
            use std::os::unix::fs::OpenOptionsExt;
            options.mode(0o600);
        }
        match options.open(&path) {
            Ok(file) => return Ok((path, file)),
            Err(error) if error.kind() == io::ErrorKind::AlreadyExists => continue,
            Err(error) => return Err(format!("Failed to create temporary file: {}", error)),
        }
    }
    Err("Failed to create a unique temporary file".to_string())
}

#[cfg(not(windows))]
fn replace_path(temporary: &Path, target: &Path) -> io::Result<()> {
    fs::rename(temporary, target)
}

#[cfg(windows)]
fn replace_path(temporary: &Path, target: &Path) -> io::Result<()> {
    match fs::rename(temporary, target) {
        Ok(()) => Ok(()),
        Err(first_error) => match fs::symlink_metadata(target) {
            Ok(_) => {
                fs::remove_file(target)?;
                fs::rename(temporary, target)
            }
            Err(error) if error.kind() == io::ErrorKind::NotFound => Err(first_error),
            Err(error) => Err(error),
        },
    }
}

fn write_file_atomically(target: &Path, bytes: &[u8], max_bytes: u64) -> Result<(), String> {
    if bytes.len() as u64 > max_bytes {
        return Err(format!(
            "Input exceeds the maximum size of {} bytes",
            max_bytes
        ));
    }
    let parent = target
        .parent()
        .ok_or_else(|| "Write destination must include a parent directory".to_string())?;
    let canonical_parent =
        fs::canonicalize(parent).map_err(|e| format!("Cannot resolve write directory: {}", e))?;
    let parent_metadata = fs::metadata(&canonical_parent)
        .map_err(|e| format!("Cannot inspect write directory: {}", e))?;
    if !parent_metadata.is_dir() {
        return Err("Write destination parent is not a directory".to_string());
    }
    let file_name = target
        .file_name()
        .ok_or_else(|| "Write destination must include a file name".to_string())?;
    let canonical_target = canonical_parent.join(file_name);
    if ensure_autosave_target(&canonical_target)? && canonical_target != target {
        return Err("Write destination changed during authorization".to_string());
    }

    let (temporary, mut temporary_file) = create_private_temp_file(&canonical_parent)?;
    let write_result = temporary_file
        .write_all(bytes)
        .and_then(|_| temporary_file.flush())
        .and_then(|_| temporary_file.sync_all());
    drop(temporary_file);
    if let Err(error) = write_result {
        let _ = fs::remove_file(&temporary);
        return Err(format!("Failed to write temporary file: {}", error));
    }
    if let Err(error) = replace_path(&temporary, &canonical_target) {
        let _ = fs::remove_file(&temporary);
        return Err(format!("Failed to replace destination file: {}", error));
    }
    Ok(())
}

#[tauri::command]
fn auto_save_snapshot(
    module: String,
    document_id: String,
    payload: String,
) -> Result<String, String> {
    validate_autosave_identity(&module, &document_id)?;
    if payload.len() > MAX_AUTOSAVE_PAYLOAD_BYTES {
        return Err(format!(
            "Autosave payload exceeds the maximum size of {} bytes",
            MAX_AUTOSAVE_PAYLOAD_BYTES
        ));
    }
    let (_, target) = autosave_target(&module, &document_id)?;
    write_file_atomically(
        &target,
        payload.as_bytes(),
        MAX_AUTOSAVE_PAYLOAD_BYTES as u64,
    )?;
    Ok(target.to_string_lossy().to_string())
}

#[tauri::command]
fn read_auto_save_snapshot(module: String, document_id: String) -> Result<Option<String>, String> {
    let (_, target) = autosave_target(&module, &document_id)?;
    if !ensure_autosave_target(&target)? {
        return Ok(None);
    }
    let bytes = read_limited_file(
        &target,
        MAX_AUTOSAVE_PAYLOAD_BYTES as u64,
        "Autosave snapshot",
    )?;
    decode_utf8_lossy_limited(&bytes, MAX_AUTOSAVE_PAYLOAD_BYTES, "Autosave snapshot").map(Some)
}

#[tauri::command]
fn get_system_metrics() -> Result<SystemMetrics, String> {
    let mut system = sysinfo::System::new_all();
    system.refresh_all();

    let memory_used_mb = system.used_memory() as f64 / 1024.0 / 1024.0;
    let total_memory_mb = system.total_memory() as f64 / 1024.0 / 1024.0;
    let cpu_count = system.cpus().len();

    Ok(SystemMetrics {
        platform: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
        memory_used_mb: (memory_used_mb * 10.0).round() / 10.0,
        total_memory_mb: (total_memory_mb * 10.0).round() / 10.0,
        cpu_count,
    })
}

fn validate_dialog_filters(filters: &[FileFilter]) -> Result<(), String> {
    if filters.len() > MAX_DIALOG_FILTERS {
        return Err("Too many file dialog filters".to_string());
    }
    for filter in filters {
        if filter.name.len() > MAX_DIALOG_TEXT_BYTES {
            return Err("File dialog filter name is too long".to_string());
        }
        if filter.extensions.len() > MAX_DIALOG_EXTENSIONS {
            return Err("Too many extensions in a file dialog filter".to_string());
        }
        for extension in &filter.extensions {
            if extension.is_empty() || extension.len() > MAX_DIALOG_EXTENSION_BYTES {
                return Err("Invalid file dialog extension".to_string());
            }
        }
    }
    Ok(())
}

fn validate_default_name(name: &str) -> Result<(), String> {
    if name.is_empty()
        || name.len() > MAX_DIALOG_TEXT_BYTES
        || name == "."
        || name == ".."
        || name.contains('/')
        || name.contains('\\')
        || name.contains('\0')
    {
        return Err("Invalid default file name".to_string());
    }
    Ok(())
}

#[tauri::command]
async fn open_native_file_dialog(
    app: AppHandle,
    state: State<'_, AppState>,
    title: Option<String>,
    filters: Vec<FileFilter>,
) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;

    validate_dialog_filters(&filters)?;
    let mut builder = app.dialog().file();
    if let Some(value) = title {
        builder = builder.set_title(value);
    }
    for filter in filters {
        let extensions: Vec<&str> = filter.extensions.iter().map(String::as_str).collect();
        builder = builder.add_filter(filter.name, &extensions);
    }

    let file_path = builder.blocking_pick_file();
    let Some(file_path) = file_path else {
        return Ok(None);
    };
    let file_path = file_path
        .into_path()
        .map_err(|_| "Selected file path is not a local filesystem path".to_string())?;
    let raw_path = file_path
        .to_str()
        .ok_or_else(|| "Selected file path is not valid UTF-8".to_string())?
        .to_string();
    register_open_path(state.inner(), &raw_path)?;
    Ok(Some(raw_path))
}

#[tauri::command]
async fn save_native_file_dialog(
    app: AppHandle,
    state: State<'_, AppState>,
    title: Option<String>,
    default_name: Option<String>,
    filters: Vec<FileFilter>,
) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;

    validate_dialog_filters(&filters)?;
    if let Some(name) = default_name.as_deref() {
        validate_default_name(name)?;
    }
    let mut builder = app.dialog().file();
    if let Some(value) = title {
        builder = builder.set_title(value);
    }
    if let Some(name) = default_name {
        builder = builder.set_file_name(name);
    }
    for filter in filters {
        let extensions: Vec<&str> = filter.extensions.iter().map(String::as_str).collect();
        builder = builder.add_filter(filter.name, &extensions);
    }

    let file_path = builder.blocking_save_file();
    let Some(file_path) = file_path else {
        return Ok(None);
    };
    let file_path = file_path
        .into_path()
        .map_err(|_| "Selected file path is not a local filesystem path".to_string())?;
    let raw_path = file_path
        .to_str()
        .ok_or_else(|| "Selected file path is not valid UTF-8".to_string())?
        .to_string();
    register_save_path(state.inner(), &raw_path)?;
    Ok(Some(raw_path))
}

#[tauri::command]
async fn open_detached_communicator(app: AppHandle) -> Result<(), String> {
    use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

    if let Some(window) = app.get_webview_window("communicator") {
        let _ = window.set_focus();
        return Ok(());
    }

    WebviewWindowBuilder::new(
        &app,
        "communicator",
        WebviewUrl::App("index.html?mode=communicator".into()),
    )
    .title("Simple Communicator (Secure)")
    .inner_size(1050.0, 720.0)
    .min_inner_size(800.0, 550.0)
    .resizable(true)
    .build()
    .map_err(|e| format!("Failed to open standalone communicator window: {}", e))?;

    Ok(())
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            read_text_file,
            write_text_file,
            auto_save_snapshot,
            read_auto_save_snapshot,
            get_system_metrics,
            open_native_file_dialog,
            save_native_file_dialog,
            open_detached_communicator
        ])
        .run(tauri::generate_context!())
        .expect("error while running Simple Office Suite application");
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Cursor;
    use std::time::{SystemTime, UNIX_EPOCH};
    use zip::write::SimpleFileOptions;
    use zip::{CompressionMethod, ZipWriter};

    fn test_directory(name: &str) -> PathBuf {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock should be after the Unix epoch")
            .as_nanos();
        let path = std::env::temp_dir().join(format!("simple-office-suite-{}-{}", name, timestamp));
        fs::create_dir_all(&path).expect("test directory should be created");
        path
    }

    fn write_test_zip(path: &Path, entries: &[(&str, &str)]) {
        let file = File::create(path).expect("test archive should be created");
        let mut archive = ZipWriter::new(file);
        let options = SimpleFileOptions::default().compression_method(CompressionMethod::Deflated);
        for (name, content) in entries {
            archive
                .start_file(*name, options)
                .expect("test archive entry should start");
            archive
                .write_all(content.as_bytes())
                .expect("test archive entry should be written");
        }
        archive.finish().expect("test archive should finish");
    }

    #[test]
    fn html_escape_blocks_docx_markup() {
        assert_eq!(
            escape_html("<script>\"x\" & 'y'</script>"),
            "&lt;script&gt;&quot;x&quot; &amp; &#39;y&#39;&lt;/script&gt;"
        );
    }

    #[test]
    fn docx_text_is_extracted_and_escaped() {
        let directory = test_directory("docx-escape");
        let path = directory.join("input.docx");
        write_test_zip(
            &path,
            &[(
                "word/document.xml",
                "<w:document><w:body><w:p><w:r><w:t>&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;</w:t></w:r></w:p></w:body></w:document>",
            )],
        );
        let html = parse_docx_archive(&path).expect("DOCX should parse");
        assert_eq!(
            html,
            "<p>&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;</p>\n"
        );
        fs::remove_dir_all(directory).expect("test directory should be removed");
    }

    #[test]
    fn pptx_slides_are_sorted_numerically() {
        let directory = test_directory("pptx-order");
        let path = directory.join("input.pptx");
        write_test_zip(
            &path,
            &[
                ("ppt/slides/slide10.xml", "<p><a:t>Ten</a:t></p>"),
                ("ppt/slides/slide2.xml", "<p><a:t>Two</a:t></p>"),
                ("ppt/slides/slide1.xml", "<p><a:t>One</a:t></p>"),
            ],
        );
        let deck: serde_json::Value =
            serde_json::from_str(&parse_pptx_archive(&path).expect("PPTX should parse"))
                .expect("PPTX output should be JSON");
        let titles: Vec<&str> = deck["slides"]
            .as_array()
            .expect("slides should be an array")
            .iter()
            .map(|slide| slide["title"].as_str().expect("slide title should be text"))
            .collect();
        assert_eq!(titles, ["One", "Two", "Ten"]);
        fs::remove_dir_all(directory).expect("test directory should be removed");
    }

    #[test]
    fn archive_names_and_decompressed_reads_are_bounded() {
        assert!(is_safe_archive_entry_name("ppt/slides/slide1.xml"));
        assert!(!is_safe_archive_entry_name("../outside.xml"));
        assert!(!is_safe_archive_entry_name("C:\\outside.xml"));
        assert!(!is_safe_archive_entry_name("/outside.xml"));

        let mut remaining = 4;
        let mut input = Cursor::new(b"12345".to_vec());
        assert!(read_limited_entry(&mut input, 8, &mut remaining, "test entry").is_err());
    }

    #[test]
    fn autosave_identity_rejects_unknown_modules_and_traversal() {
        assert!(validate_autosave_identity("writer", "doc_123").is_ok());
        assert!(validate_autosave_identity("email", "doc_123").is_err());
        assert!(validate_autosave_identity("writer", "../doc_123").is_err());
        assert!(validate_autosave_identity("writer", "doc/123").is_err());
        assert!(validate_autosave_identity("writer", "").is_err());
    }

    #[test]
    fn path_authorization_requires_dialog_approval_and_canonicalizes_symlinks() {
        let directory = test_directory("path-scope");
        let approved = directory.join("approved.txt");
        let outside = directory.join("outside.txt");
        fs::write(&approved, "approved").expect("approved file should be written");
        fs::write(&outside, "outside").expect("outside file should be written");
        #[cfg(unix)]
        let link = directory.join("link.txt");
        #[cfg(unix)]
        std::os::unix::fs::symlink(&outside, &link).expect("test symlink should be created");

        let state = AppState::default();
        let approved_text = approved.to_string_lossy().to_string();
        assert!(authorize_path(&state, &approved_text, PathAccess::Read).is_err());
        register_open_path(&state, &approved_text).expect("open path should be registered");
        assert!(authorize_path(&state, &approved_text, PathAccess::Write).is_ok());

        let save_path = directory.join("new-save.txt");
        let save_text = save_path.to_string_lossy().to_string();
        register_save_path(&state, &save_text).expect("save path should be registered");
        assert!(authorize_path(&state, &save_text, PathAccess::Read).is_err());
        assert!(authorize_path(&state, &save_text, PathAccess::Write).is_ok());

        #[cfg(unix)]
        {
            let canonical = fs::canonicalize(&approved).expect("approved path should resolve");
            let linked = link.to_string_lossy().to_string();
            assert!(authorize_path(&state, &linked, PathAccess::Read).is_err());
            assert_eq!(
                authorize_path(&state, &approved_text, PathAccess::Read)
                    .expect("approved path should work"),
                canonical
            );
        }

        fs::remove_dir_all(directory).expect("test directory should be removed");
    }

    #[test]
    fn binary_input_is_rejected_with_actionable_messages() {
        let pdf = b"%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>";
        let pdf_error = reject_binary_input(pdf).expect_err("PDF bytes should be rejected");
        assert!(pdf_error.contains("binary PDF"));
        assert!(pdf_error.contains("print to PDF"));

        let binary = [0x00u8, 0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1, 0x00];
        let binary_error = reject_binary_input(&binary).expect_err("OLE2 bytes should be rejected");
        assert!(binary_error.contains("cannot import"));

        assert!(reject_binary_input(b"<p>plain text</p>").is_ok());
        assert!(reject_binary_input("naïve café — ok".as_bytes()).is_ok());
    }

    #[test]
    fn xlsx_shared_strings_and_numbers_are_extracted() {
        let directory = test_directory("xlsx-cells");
        let path = directory.join("book.xlsx");
        write_test_zip(
            &path,
            &[
                (
                    "xl/sharedStrings.xml",
                    r#"<?xml version="1.0"?><sst><si><t>Widget &amp; Co</t></si><si><t>Total</t></si></sst>"#,
                ),
                (
                    "xl/worksheets/sheet1.xml",
                    r#"<?xml version="1.0"?><worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row><row r="2"><c r="A2"><v>7</v></c><c r="B2"><f>SUM(B1:B1)</f><v>0</v></c></row></sheetData></worksheet>"#,
                ),
            ],
        );

        let parsed = parse_xlsx_archive(&path).expect("workbook should parse");
        assert!(parsed.contains("\"type\":\"xlsx\""));
        assert!(parsed.contains("Widget & Co"));
        assert!(parsed.contains("\"A2\""));
        assert!(parsed.contains("7"));

        fs::remove_dir_all(directory).expect("test directory should be removed");
    }
}
