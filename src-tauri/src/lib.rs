use serde::{Deserialize, Serialize};
use std::fs::{self, File};
use std::io::Read;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::AppHandle;
use zip::ZipArchive;

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
    pub is_offline: bool,
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
}

fn get_autosave_dir() -> Result<PathBuf, String> {
    let mut base = dirs::data_local_dir()
        .or_else(dirs::data_dir)
        .unwrap_or_else(|| PathBuf::from("."));
    base.push("SimpleOfficeSuite");
    base.push("autosaves");

    if !base.exists() {
        fs::create_dir_all(&base).map_err(|e| format!("Failed to create autosave directory: {}", e))?;
    }
    Ok(base)
}

/// Parse Microsoft Excel .xlsx OpenXML archive into structured JSON
fn parse_xlsx_archive(p: &Path) -> Result<String, String> {
    let file = File::open(p).map_err(|e| format!("Cannot open XLSX file: {}", e))?;
    let mut archive = ZipArchive::new(file).map_err(|e| format!("Invalid XLSX zip archive: {}", e))?;

    // 1. Read shared strings table if present
    let mut shared_strings = Vec::new();
    if let Ok(mut sst_file) = archive.by_name("xl/sharedStrings.xml") {
        let mut sst_content = String::new();
        let _ = sst_file.read_to_string(&mut sst_content);

        // Simple XML tag parser for <t>...</t> inside shared strings
        let re_t = regex_lite_find_all_t(&sst_content);
        shared_strings = re_t;
    }

    // 2. Read first worksheet (xl/worksheets/sheet1.xml)
    let mut sheet_content = String::new();
    let mut sheet_found = false;
    for i in 0..archive.len() {
        if let Ok(mut f) = archive.by_index(i) {
            let name = f.name().to_string();
            if name.starts_with("xl/worksheets/sheet") && name.ends_with(".xml") {
                let _ = f.read_to_string(&mut sheet_content);
                sheet_found = true;
                break;
            }
        }
    }

    if !sheet_found {
        return Err("No worksheet XML found in XLSX".to_string());
    }

    // 3. Extract cells: <c r="COORD" ...><v>VAL</v></c> or <c ... t="s"><v>IDX</v></c> or inline <is><t>TEXT</t></is>
    let cells_json = parse_sheet_cells(&sheet_content, &shared_strings);

    Ok(format!(
        r#"{{"type":"xlsx","cells":{}}}"#,
        cells_json
    ))
}

fn regex_lite_find_all_t(xml: &str) -> Vec<String> {
    let mut result = Vec::new();
    let mut pos = 0;
    while let Some(start) = xml[pos..].find("<t") {
        let actual_start = pos + start;
        if let Some(tag_close) = xml[actual_start..].find('>') {
            let content_start = actual_start + tag_close + 1;
            if let Some(end) = xml[content_start..].find("</t>") {
                let text = &xml[content_start..content_start + end];
                result.push(decode_xml_entities(text));
                pos = content_start + end + 4;
            } else {
                break;
            }
        } else {
            break;
        }
    }
    result
}

fn decode_xml_entities(s: &str) -> String {
    s.replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&apos;", "'")
}

fn parse_sheet_cells(xml: &str, shared_strings: &[String]) -> String {
    let mut map_entries = Vec::new();
    let mut pos = 0;

    while let Some(c_start) = xml[pos..].find("<c ") {
        let start = pos + c_start;
        let rest = &xml[start..];

        // Find cell tag closing
        let tag_close = match rest.find('>') {
            Some(i) => i,
            None => break,
        };

        let tag_header = &rest[..tag_close];
        let is_self_closing = tag_header.ends_with('/');

        // Extract coordinate r="..."
        let coord = match extract_attr(tag_header, "r") {
            Some(r) => r,
            None => {
                pos = start + tag_close + 1;
                continue;
            }
        };

        let cell_type = extract_attr(tag_header, "t").unwrap_or_default();

        let mut raw_val = String::new();
        let mut formula = String::new();

        if !is_self_closing {
            // Find closing </c>
            let c_end = match rest.find("</c>") {
                Some(i) => i,
                None => {
                    pos = start + tag_close + 1;
                    continue;
                }
            };
            let body = &rest[tag_close + 1..c_end];

            // Formula: <f>...</f>
            if let Some(f_start) = body.find("<f>") {
                if let Some(f_end) = body[f_start + 3..].find("</f>") {
                    formula = format!("={}", &body[f_start + 3..f_start + 3 + f_end]);
                }
            }

            // Value: <v>...</v>
            if let Some(v_start) = body.find("<v>") {
                if let Some(v_end) = body[v_start + 3..].find("</v>") {
                    raw_val = body[v_start + 3..v_start + 3 + v_end].to_string();
                }
            }

            // Inline string: <is><t>...</t></is>
            if raw_val.is_empty() {
                if let Some(t_start) = body.find("<t") {
                    if let Some(gt) = body[t_start..].find('>') {
                        let t_content_start = t_start + gt + 1;
                        if let Some(t_end) = body[t_content_start..].find("</t>") {
                            raw_val = body[t_content_start..t_content_start + t_end].to_string();
                        }
                    }
                }
            }

            pos = start + c_end + 4;
        } else {
            pos = start + tag_close + 1;
        }

        // Resolve shared string
        if cell_type == "s" {
            if let Ok(idx) = raw_val.parse::<usize>() {
                if let Some(s) = shared_strings.get(idx) {
                    raw_val = s.clone();
                }
            }
        } else {
            raw_val = decode_xml_entities(&raw_val);
        }

        let display_val = if !raw_val.is_empty() {
            raw_val.clone()
        } else if !formula.is_empty() {
            formula.clone()
        } else {
            String::new()
        };

        if !display_val.is_empty() || !formula.is_empty() {
            let formula_or_raw = if !formula.is_empty() { formula } else { raw_val.clone() };
            let safe_raw = serde_json::to_string(&formula_or_raw).unwrap_or_default();
            let safe_comp = serde_json::to_string(&raw_val).unwrap_or_default();
            map_entries.push(format!(
                r#""{}":{{"raw":{},"computed":{}}}"#,
                coord, safe_raw, safe_comp
            ));
        }
    }

    format!("{{{}}}", map_entries.join(","))
}

fn extract_attr(tag: &str, attr: &str) -> Option<String> {
    let pattern = format!("{}=\"", attr);
    if let Some(start) = tag.find(&pattern) {
        let val_start = start + pattern.len();
        if let Some(end) = tag[val_start..].find('"') {
            return Some(tag[val_start..val_start + end].to_string());
        }
    }
    None
}

/// Parse Microsoft Word .docx OpenXML archive into formatted HTML
fn parse_docx_archive(p: &Path) -> Result<String, String> {
    let file = File::open(p).map_err(|e| format!("Cannot open DOCX file: {}", e))?;
    let mut archive = ZipArchive::new(file).map_err(|e| format!("Invalid DOCX archive: {}", e))?;

    let mut doc_xml = String::new();
    if let Ok(mut doc_file) = archive.by_name("word/document.xml") {
        let _ = doc_file.read_to_string(&mut doc_xml);
    } else {
        return Err("Could not find word/document.xml in DOCX archive".to_string());
    }

    // Convert Word paragraphs <w:p> to <p>, <w:t> text, <w:b/> bold, <w:i/> italic
    let mut html = String::new();
    let paragraphs: Vec<&str> = doc_xml.split("</w:p>").collect();

    for p_xml in paragraphs {
        let mut p_text = String::new();
        let runs: Vec<&str> = p_xml.split("</w:r>").collect();
        for r_xml in runs {
            let is_bold = r_xml.contains("<w:b/>") || r_xml.contains("<w:b ");
            let is_italic = r_xml.contains("<w:i/>") || r_xml.contains("<w:i ");
            let texts = regex_lite_find_all_t(r_xml);
            let combined = texts.join("");
            if !combined.is_empty() {
                let mut chunk = combined;
                if is_bold { chunk = format!("<strong>{}</strong>", chunk); }
                if is_italic { chunk = format!("<em>{}</em>", chunk); }
                p_text.push_str(&chunk);
            }
        }
        if !p_text.is_empty() {
            html.push_str(&format!("<p>{}</p>\n", p_text));
        }
    }

    if html.is_empty() {
        html = "<p>Empty document</p>".to_string();
    }
    Ok(html)
}

/// Parse PowerPoint .pptx archive into slide deck JSON
fn parse_pptx_archive(p: &Path) -> Result<String, String> {
    let file = File::open(p).map_err(|e| format!("Cannot open PPTX file: {}", e))?;
    let mut archive = ZipArchive::new(file).map_err(|e| format!("Invalid PPTX archive: {}", e))?;

    let mut slides = Vec::new();
    for i in 0..archive.len() {
        if let Ok(mut f) = archive.by_index(i) {
            let name = f.name().to_string();
            if name.starts_with("ppt/slides/slide") && name.ends_with(".xml") {
                let mut content = String::new();
                let _ = f.read_to_string(&mut content);
                let texts = regex_lite_find_all_t(&content);
                let title = texts.first().cloned().unwrap_or_else(|| "Slide".to_string());
                let body = texts.iter().skip(1).cloned().collect::<Vec<_>>().join("
");
                let slide_val = serde_json::json!({
                    "id": format!("s_{}", i),
                    "title": title,
                    "bgColor": "#ffffff",
                    "elements": [
                        {
                            "id": format!("t_{}", i),
                            "type": "title",
                            "x": 10,
                            "y": 15,
                            "width": 80,
                            "height": 15,
                            "content": title
                        },
                        {
                            "id": format!("b_{}", i),
                            "type": "text",
                            "x": 10,
                            "y": 35,
                            "width": 80,
                            "height": 50,
                            "content": body
                        }
                    ]
                });
                slides.push(slide_val);
            }
        }
    }

    if slides.is_empty() {
        return Err("No slides found in PPTX".to_string());
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

#[tauri::command]
fn read_text_file(path: String) -> Result<String, String> {
    let p = Path::new(&path);
    if !p.exists() {
        return Err(format!("File does not exist: {}", path));
    }

    let bytes = fs::read(p).map_err(|e| format!("Failed to read file: {}", e))?;

    // Check for ZIP magic bytes (PK\x03\x04 or PK\x05\x06 or PK\x07\x08)
    if bytes.starts_with(b"PK") {
        if let Ok(json) = parse_xlsx_archive(p) {
            return Ok(json);
        }
        if let Ok(html) = parse_docx_archive(p) {
            return Ok(html);
        }
        if let Ok(json) = parse_pptx_archive(p) {
            return Ok(json);
        }
        return Err("This file is a compressed binary ZIP archive that could not be parsed as an office document.".to_string());
    }

    let ext = p.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();

    // 1. Specialized OpenXML Office Binary Archive Parsers
    if ext == "xlsx" || ext == "xls" {
        if let Ok(json) = parse_xlsx_archive(p) {
            return Ok(json);
        }
    } else if ext == "docx" || ext == "doc" {
        if let Ok(html) = parse_docx_archive(p) {
            return Ok(html);
        }
    } else if ext == "pptx" {
        if let Ok(json) = parse_pptx_archive(p) {
            return Ok(json);
        }
    }

    // 2. Universal Raw Byte Read with Lossy UTF-8 fallback (NEVER FAILS ON ENCODING)
    Ok(String::from_utf8_lossy(&bytes).to_string())
}

#[tauri::command]
fn write_text_file(path: String, contents: String) -> Result<FileSaveResult, String> {
    let p = Path::new(&path);
    if let Some(parent) = p.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create parent directories: {}", e))?;
        }
    }
    fs::write(p, contents).map_err(|e| format!("Failed to write file: {}", e))?;

    Ok(FileSaveResult {
        success: true,
        path,
        timestamp: chrono::Local::now().to_rfc3339(),
    })
}

#[tauri::command]
fn auto_save_snapshot(module: String, document_id: String, payload: String) -> Result<String, String> {
    let mut dir = get_autosave_dir()?;
    let safe_id = document_id.replace(|c: char| !c.is_alphanumeric() && c != '-', "_");
    dir.push(format!("{}_{}.json", module, safe_id));

    fs::write(&dir, payload)
        .map_err(|e| format!("Autosave snapshot failed: {}", e))?;

    Ok(dir.to_string_lossy().to_string())
}

#[tauri::command]
fn read_auto_save_snapshot(module: String, document_id: String) -> Result<Option<String>, String> {
    let mut dir = get_autosave_dir()?;
    let safe_id = document_id.replace(|c: char| !c.is_alphanumeric() && c != '-', "_");
    dir.push(format!("{}_{}.json", module, safe_id));

    if !dir.exists() {
        return Ok(None);
    }

    let bytes = fs::read(&dir).map_err(|e| format!("Failed to read autosave snapshot: {}", e))?;
    Ok(Some(String::from_utf8_lossy(&bytes).to_string()))
}

#[tauri::command]
fn get_system_metrics() -> Result<SystemMetrics, String> {
    let mut sys = sysinfo::System::new_all();
    sys.refresh_all();

    let memory_used_mb = sys.used_memory() as f64 / 1024.0 / 1024.0;
    let total_memory_mb = sys.total_memory() as f64 / 1024.0 / 1024.0;
    let cpu_count = sys.cpus().len();

    Ok(SystemMetrics {
        platform: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
        memory_used_mb: (memory_used_mb * 10.0).round() / 10.0,
        total_memory_mb: (total_memory_mb * 10.0).round() / 10.0,
        cpu_count,
        is_offline: true,
    })
}

#[tauri::command]
async fn open_native_file_dialog(
    app: AppHandle,
    title: Option<String>,
    filters: Vec<FileFilter>,
) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;

    let mut builder = app.dialog().file();
    if let Some(t) = title {
        builder = builder.set_title(t);
    }

    for f in filters {
        let exts: Vec<&str> = f.extensions.iter().map(|s| s.as_str()).collect();
        builder = builder.add_filter(f.name, &exts);
    }

    let file_path = builder.blocking_pick_file();
    Ok(file_path.map(|p| p.to_string()))
}

#[tauri::command]
async fn save_native_file_dialog(
    app: AppHandle,
    title: Option<String>,
    default_name: Option<String>,
    filters: Vec<FileFilter>,
) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;

    let mut builder = app.dialog().file();
    if let Some(t) = title {
        builder = builder.set_title(t);
    }
    if let Some(name) = default_name {
        builder = builder.set_file_name(name);
    }

    for f in filters {
        let exts: Vec<&str> = f.extensions.iter().map(|s| s.as_str()).collect();
        builder = builder.add_filter(f.name, &exts);
    }

    let file_path = builder.blocking_save_file();
    Ok(file_path.map(|p| p.to_string()))
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            read_text_file,
            write_text_file,
            auto_save_snapshot,
            read_auto_save_snapshot,
            get_system_metrics,
            open_native_file_dialog,
            save_native_file_dialog
        ])
        .run(tauri::generate_context!())
        .expect("error while running Simple Office Suite application");
}
