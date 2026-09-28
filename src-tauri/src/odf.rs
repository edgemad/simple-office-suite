//! OpenDocument writers and readers.
//!
//! ODF is the same shape of problem as OOXML - a zip of XML parts - but with
//! one trap that OOXML does not have: the `mimetype` entry must be the *first*
//! entry in the archive and must be stored uncompressed, with no extra field.
//! LibreOffice and Word both reject the file otherwise, and they reject it
//! quietly enough that it looks like the content is at fault.
//!
//! A reader is included as well as writers, so opening an ODF file and saving
//! it again round-trips instead of only working one way.

use std::io::{Cursor, Read, Write};
use zip::write::SimpleFileOptions;
use zip::{CompressionMethod, ZipWriter};

pub const ODT_MIME: &str = "application/vnd.oasis.opendocument.text";
pub const ODS_MIME: &str = "application/vnd.oasis.opendocument.spreadsheet";
pub const ODP_MIME: &str = "application/vnd.oasis.opendocument.presentation";

const MANIFEST_NS: &str = "urn:oasis:names:tc:opendocument:xmlns:manifest:1.0";
const CONTENT_TYPE: &str = "application/vnd.oasis.opendocument.xmlns:office:1.0";

/// Namespaces every ODF content part needs.
const CONTENT_NAMESPACES: &str = "\
xmlns:office=\"urn:oasis:names:tc:opendocument:xmlns:office:1.0\" \
xmlns:text=\"urn:oasis:names:tc:opendocument:xmlns:text:1.0\" \
xmlns:table=\"urn:oasis:names:tc:opendocument:xmlns:table:1.0\" \
xmlns:draw=\"urn:oasis:names:tc:opendocument:xmlns:drawing:1.0\" \
xmlns:style=\"urn:oasis:names:tc:opendocument:xmlns:style:1.0\" \
xmlns:fo=\"urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0\" \
xmlns:number=\"urn:oasis:names:tc:opendocument:xmlns:datastyle:1.0\" \
xmlns:svg=\"urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0\" \
xmlns:xlink=\"http://www.w3.org/1999/xlink\"";

/// Metadata parts additionally need the Dublin Core and ODF meta prefixes.
/// An undeclared prefix makes the whole part invalid XML, and the failure
/// shows up as the file being rejected rather than as an XML complaint.
const META_NAMESPACES: &str = "\
xmlns:office=\"urn:oasis:names:tc:opendocument:xmlns:office:1.0\" \
xmlns:meta=\"urn:oasis:names:tc:opendocument:xmlns:meta:1.0\" \
xmlns:dc=\"http://purl.org/dc/elements/1.1/\"";

pub fn escape_xml_text(value: &str) -> String {
    let mut out = String::with_capacity(value.len());
    for character in value.chars() {
        match character {
            '&' => out.push_str("&amp;"),
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            '\u{0}'..='\u{8}' | '\u{b}' | '\u{c}' | '\u{e}'..='\u{1f}' => {}
            other => out.push(other),
        }
    }
    out
}

struct OdfPackage {
    zip: ZipWriter<Cursor<Vec<u8>>>,
    parts: Vec<(String, String)>,
}

impl OdfPackage {
    fn new(mime: &str) -> Result<Self, String> {
        let mut zip = ZipWriter::new(Cursor::new(Vec::new()));

        // The mimetype entry must come first and must be stored, not deflated.
        // This is the single most common way an ODF file ends up unopenable.
        zip.start_file(
            "mimetype",
            SimpleFileOptions::default().compression_method(CompressionMethod::Stored),
        )
        .map_err(|e| format!("Cannot write the ODF mimetype entry: {}", e))?;
        zip.write_all(mime.as_bytes())
            .map_err(|e| format!("Cannot write the ODF mimetype entry: {}", e))?;

        Ok(OdfPackage {
            zip,
            parts: Vec::new(),
        })
    }

    fn part(&mut self, name: &str, content: &str) -> Result<(), String> {
        self.zip
            .start_file(
                name,
                SimpleFileOptions::default().compression_method(CompressionMethod::Deflated),
            )
            .map_err(|e| format!("Cannot add {}: {}", name, e))?;
        self.zip
            .write_all(content.as_bytes())
            .map_err(|e| format!("Cannot write {}: {}", name, e))?;
        self.parts.push((name.to_string(), content.to_string()));
        Ok(())
    }

    /// Writes META-INF/manifest.xml, which has to enumerate every part.
    fn manifest(&mut self) -> Result<(), String> {
        let mut manifest = format!(
            "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\
<manifest:manifest xmlns:manifest=\"{}\" manifest:version=\"1.2\">\
<manifest:file-entry manifest:full-path=\"/\" manifest:media-type=\"{}\"/>\
<manifest:file-entry manifest:full-path=\"content.xml\" manifest:media-type=\"{}\"/>\
<manifest:file-entry manifest:full-path=\"styles.xml\" manifest:media-type=\"text/xml\"/>\
<manifest:file-entry manifest:full-path=\"meta.xml\" manifest:media-type=\"text/xml\"/>",
            MANIFEST_NS, CONTENT_TYPE, CONTENT_TYPE
        );
        for (name, _) in &self.parts {
            if name == "content.xml" || name == "styles.xml" || name == "meta.xml" {
                continue;
            }
            // The manifest is built as it goes, so parts added after it are
            // appended by the caller through manifest_extra.
            manifest.push_str(&format!(
                "<manifest:file-entry manifest:full-path=\"{}\" manifest:media-type=\"{}\"/>",
                name,
                mime_for_part(name)
            ));
        }
        manifest.push_str("</manifest:manifest>");

        self.zip
            .start_file(
                "META-INF/manifest.xml",
                SimpleFileOptions::default().compression_method(CompressionMethod::Deflated),
            )
            .map_err(|e| format!("Cannot add the ODF manifest: {}", e))?;
        self.zip
            .write_all(manifest.as_bytes())
            .map_err(|e| format!("Cannot write the ODF manifest: {}", e))
    }

    fn finish(mut self) -> Result<Vec<u8>, String> {
        self.manifest()?;
        self.zip
            .finish()
            .map(|cursor| cursor.into_inner())
            .map_err(|e| format!("Cannot finalise the document: {}", e))
    }
}

fn mime_for_part(name: &str) -> &'static str {
    match name {
        "Thumbnail.png" => "image/png",
        "content.xml" => CONTENT_TYPE,
        "styles.xml" | "meta.xml" => "text/xml",
        _ => "text/xml",
    }
}

fn styles_xml() -> String {
    format!(
        "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\
<office:document-styles {} office:version=\"1.2\">\
<office:styles><style:style style:name=\"Standard\" style:family=\"paragraph\"/></office:styles>\
</office:document-styles>",
        CONTENT_NAMESPACES
    )
}

fn meta_xml(title: &str) -> String {
    format!(
        "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\
<office:document-meta {} office:version=\"1.2\"><office:meta><dc:title>{}</dc:title>\
<meta:generator>SOS</meta:generator></office:meta></office:document-meta>",
        META_NAMESPACES,
        escape_xml_text(title)
    )
}

fn paragraphs_xml(tag: &str, paragraphs: &[String]) -> String {
    let body: String = paragraphs
        .iter()
        .map(|line| {
            if line.is_empty() {
                "<text:p/>".to_string()
            } else {
                format!("<text:p>{}</text:p>", escape_xml_text(line))
            }
        })
        .collect();
    format!("<{tag}>{body}</{tag}>", tag = tag, body = body)
}

/// A text document: real `.odt`.
pub fn write_odt(title: &str, paragraphs: &[String]) -> Result<Vec<u8>, String> {
    let content = format!(
        "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\
<office:document-content {} office:version=\"1.2\"><office:body>{}</office:body></office:document-content>",
        CONTENT_NAMESPACES,
        paragraphs_xml("office:text", paragraphs)
    );

    let mut package = OdfPackage::new(ODT_MIME)?;
    package.part("content.xml", &content)?;
    package.part("styles.xml", &styles_xml())?;
    package.part("meta.xml", &meta_xml(title))?;
    package.finish()
}

/// A spreadsheet: real `.ods`.
pub fn write_ods(title: &str, rows: &[Vec<String>]) -> Result<Vec<u8>, String> {
    let mut table = String::from("<table:table table:name=\"Sheet1\">");

    for row in rows {
        table.push_str("<table:table-row>");
        for cell in row {
            if cell.is_empty() {
                // An empty <table:table-cell/> is a real blank cell, unlike
                // omitting it, which changes the column count.
                table.push_str("<table:table-cell/>");
                continue;
            }
            match cell.trim().parse::<f64>() {
                // A value cell is numeric so a formula in LibreOffice can use it.
                Ok(number) if !cell.trim().starts_with('0') || cell.trim() == "0" => {
                    table.push_str(&format!(
                        "<table:table-cell office:value-type=\"float\" office:value=\"{}\">\
<text:p>{}</text:p></table:table-cell>",
                        number,
                        escape_xml_text(cell.trim())
                    ));
                }
                _ => {
                    table.push_str(&format!(
                        "<table:table-cell office:value-type=\"string\">\
<text:p>{}</text:p></table:table-cell>",
                        escape_xml_text(cell)
                    ));
                }
            }
        }
        table.push_str("</table:table-row>");
    }
    table.push_str("</table:table>");

    let content = format!(
        "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\
<office:document-content {} office:version=\"1.2\"><office:body>\
<office:spreadsheet>{}</office:spreadsheet></office:body></office:document-content>",
        CONTENT_NAMESPACES, table
    );

    let mut package = OdfPackage::new(ODS_MIME)?;
    package.part("content.xml", &content)?;
    package.part("styles.xml", &styles_xml())?;
    package.part("meta.xml", &meta_xml(title))?;
    package.finish()
}

/// One positioned text box on a slide.
fn text_frame(content: &str, y: &str, height: &str) -> String {
    format!(
        "<draw:frame draw:layer=\"layout\" svg:width=\"20cm\" svg:height=\"{height}\" \
svg:x=\"1cm\" svg:y=\"{y}\"><draw:text-box><text:p>{}</text:p></draw:text-box></draw:frame>",
        escape_xml_text(content)
    )
}

/// A slide as plain text.
#[derive(serde::Deserialize)]
pub struct OdfSlide {
    pub title: String,
    pub bullets: Vec<String>,
}

/// A presentation: real `.odp`.
pub fn write_odp(title: &str, slides: &[OdfSlide]) -> Result<Vec<u8>, String> {
    let mut pages = String::new();

    for (index, slide) in slides.iter().enumerate() {
        pages.push_str(&format!("<draw:page draw:name=\"page{}\">", index + 1));

        pages.push_str(&text_frame(&slide.title, "1cm", "2cm"));
        for (bullet_index, bullet) in slide.bullets.iter().enumerate() {
            let y = format!("{}cm", 4 + bullet_index * 2);
            pages.push_str(&text_frame(bullet, &y, "1.5cm"));
        }
        pages.push_str("</draw:page>");
    }

    let content = format!(
        "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\
<office:document-content {} office:version=\"1.2\"><office:body>\
<office:presentation>{}</office:presentation></office:body></office:document-content>",
        CONTENT_NAMESPACES, pages
    );

    let mut package = OdfPackage::new(ODP_MIME)?;
    package.part("content.xml", &content)?;
    package.part("styles.xml", &styles_xml())?;
    package.part("meta.xml", &meta_xml(title))?;
    package.finish()
}

// ---------------------------------------------------------------- reading

fn unescape_xml(value: &str) -> String {
    value
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&apos;", "'")
        .replace("&amp;", "&")
}

fn text_of(tag: &str) -> String {
    match (tag.find('>'), tag.rfind("</")) {
        (Some(open), Some(close)) if close > open => unescape_xml(&tag[open + 1..close]),
        _ => String::new(),
    }
}

fn open_odf(bytes: &[u8]) -> Result<zip::ZipArchive<Cursor<Vec<u8>>>, String> {
    zip::ZipArchive::new(Cursor::new(bytes.to_vec()))
        .map_err(|e| format!("Invalid OpenDocument file: {}", e))
}

fn content_of(bytes: &[u8]) -> Result<String, String> {
    let mut archive = open_odf(bytes)?;
    let entry = archive
        .by_name("content.xml")
        .map_err(|_| "OpenDocument file is missing content.xml".to_string())?;

    // Bounded so a zip bomb in a downloaded file cannot exhaust memory.
    let mut content = String::new();
    entry
        .take(64 * 1024 * 1024)
        .read_to_string(&mut content)
        .map_err(|e| format!("Cannot read content.xml: {}", e))?;
    Ok(content)
}

/// Reads the paragraphs of a `.odt` as plain text lines.
///
/// Both paragraph forms have to be handled: a blank line is written as a
/// self-closing `<text:p/>`, which has no closing tag to split on, so a
/// reader that only looks for `</text:p>` silently drops every blank line.
pub fn read_odt(bytes: &[u8]) -> Result<Vec<String>, String> {
    let content = content_of(bytes)?;
    let body = content
        .split_once("<office:text")
        .map(|(_, rest)| rest)
        .ok_or_else(|| "This file has no text body".to_string())?;

    let mut paragraphs = Vec::new();
    let mut cursor = 0usize;

    while let Some(found) = body[cursor..].find("<text:p") {
        let start = cursor + found;
        let open_end = match body[start..].find('>') {
            Some(offset) => start + offset,
            None => break,
        };
        let open_tag = &body[start..open_end + 1];

        if open_tag.ends_with("/>") {
            // Self-closing: an intentional blank line.
            paragraphs.push(String::new());
            cursor = open_end + 1;
            continue;
        }

        match body[open_end + 1..].find("</text:p>") {
            Some(offset) => {
                paragraphs.push(unescape_xml(&body[open_end + 1..open_end + 1 + offset]));
                cursor = open_end + 1 + offset + "</text:p>".len();
            }
            None => break,
        }
    }

    Ok(paragraphs)
}

/// Reads the first sheet of a `.ods` as a grid of strings.
pub fn read_ods(bytes: &[u8]) -> Result<Vec<Vec<String>>, String> {
    let content = content_of(bytes)?;
    let table = content
        .split_once("<table:table ")
        .map(|(_, rest)| rest)
        .ok_or_else(|| "This file has no spreadsheet table".to_string())?;

    let mut rows = Vec::new();
    for row_xml in table.split("<table:table-row>").skip(1) {
        let row = row_xml.split("</table:table-row>").next().unwrap_or("");
        let mut cells = Vec::new();

        for cell_xml in row.split("<table:table-cell").skip(1) {
            let cell = cell_xml.split("</table:table-cell>").next().unwrap_or("");
            // A blank cell is a real empty column, so it is kept.
            if cell.trim_start().starts_with('/') {
                cells.push(String::new());
                continue;
            }
            let open_end = cell.find('>').unwrap_or(0) + 1;
            let value = text_of(&cell[open_end..]);
            cells.push(value);
        }
        rows.push(cells);
    }
    Ok(rows)
}

/// Reads the text frames of each `.odp` page, in document order.
pub fn read_odp(bytes: &[u8]) -> Result<Vec<Vec<String>>, String> {
    let content = content_of(bytes)?;

    Ok(content
        .split("<draw:page")
        .skip(1)
        .map(|page| {
            page.split("</draw:page>")
                .next()
                .unwrap_or("")
                .split("<text:p>")
                .skip(1)
                .map(|chunk| unescape_xml(chunk.split("</text:p>").next().unwrap_or("")))
                .collect()
        })
        .collect())
}

/// True when the bytes are an OpenDocument package for the given type.
pub fn is_odf_mime(bytes: &[u8], expected: &str) -> bool {
    let Ok(mut archive) = open_odf(bytes) else {
        return false;
    };
    let Ok(mut entry) = archive.by_name("mimetype") else {
        return false;
    };
    let mut declared = String::new();
    if entry.read_to_string(&mut declared).is_err() {
        return false;
    }
    declared.trim() == expected
}

/// Reads a `.odt` into the same HTML shape the DOCX reader produces, so the
/// import path does not need a second code path per format.
pub fn read_odt_as_html(bytes: &[u8]) -> Result<String, String> {
    let paragraphs = read_odt(bytes)?;
    Ok(paragraphs
        .iter()
        .map(|line| {
            if line.is_empty() {
                "<p></p>".to_string()
            } else {
                format!("<p>{}</p>", html_escape(line))
            }
        })
        .collect::<Vec<String>>()
        .join(""))
}

fn html_escape(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
}

/// Reads a `.ods` into the same `{ type, cells }` JSON the XLSX reader
/// produces, so the spreadsheet importer is format-agnostic.
pub fn read_ods_as_cells_json(bytes: &[u8]) -> Result<String, String> {
    let rows = read_ods(bytes)?;
    let mut cells = serde_json::Map::new();

    for (row_index, row) in rows.iter().enumerate() {
        for (column_index, value) in row.iter().enumerate() {
            if value.is_empty() {
                continue;
            }
            cells.insert(
                format!("{}{}", column_letters(column_index), row_index + 1),
                serde_json::json!({ "raw": value, "computed": value }),
            );
        }
    }

    Ok(serde_json::json!({ "type": "ods", "cells": cells }).to_string())
}

pub fn column_letters(mut index: usize) -> String {
    let mut letters = Vec::new();
    loop {
        letters.insert(0, (b'A' + (index % 26) as u8) as char);
        if index < 26 {
            break;
        }
        index = index / 26 - 1;
    }
    letters.into_iter().collect()
}

/// Reads a `.odp` into the same deck JSON the PPTX reader produces.
pub fn read_odp_as_deck_json(bytes: &[u8]) -> Result<String, String> {
    let pages = read_odp(bytes)?;

    let slides: Vec<serde_json::Value> = pages
        .iter()
        .map(|frame_texts| {
            let title = frame_texts.first().cloned().unwrap_or_default();
            let bullets: Vec<serde_json::Value> = frame_texts
                .iter()
                .skip(1)
                .map(|text| serde_json::json!({ "type": "bullet", "content": text }))
                .collect();

            serde_json::json!({
                "title": title,
                "elements": [
                    { "type": "title", "content": title },
                    { "type": "bullets", "items": bullets }
                ]
            })
        })
        .collect();

    Ok(serde_json::json!({
        "meta": { "title": "Imported Presentation", "isDirty": false, "mode": "slides" },
        "aspectRatio": "16:9",
        "slides": slides
    })
    .to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn names(bytes: &[u8]) -> Vec<String> {
        let mut archive = open_odf(bytes).expect("should open");
        (0..archive.len())
            .map(|i| archive.by_index(i).expect("entry").name().to_string())
            .collect()
    }

    fn part(bytes: &[u8], name: &str) -> String {
        let mut archive = open_odf(bytes).expect("should open");
        let mut entry = archive.by_name(name).expect("part should exist");
        let mut text = String::new();
        entry.read_to_string(&mut text).expect("utf-8");
        text
    }

    #[test]
    fn mimetype_is_the_first_entry_in_every_format() {
        // LibreOffice and Word refuse the file if this is not first, and the
        // failure looks like corrupt content rather than a packaging mistake.
        for (mime, bytes) in [
            (ODT_MIME, write_odt("t", &["a".into()]).unwrap()),
            (ODS_MIME, write_ods("t", &[vec!["a".into()]]).unwrap()),
            (
                ODP_MIME,
                write_odp(
                    "t",
                    &[OdfSlide {
                        title: "t".into(),
                        bullets: vec![],
                    }],
                )
                .unwrap(),
            ),
        ] {
            let mut archive = open_odf(&bytes).expect("should open");
            let first = archive.by_index(0).expect("entry").name().to_string();
            assert_eq!(first, "mimetype", "{} should start with mimetype", mime);
            assert_eq!(part(&bytes, "mimetype"), mime);
        }
    }

    #[test]
    fn mimetype_is_stored_uncompressed() {
        // Deflating mimetype is the other way these files get rejected.
        let bytes = write_odt("t", &["a".into()]).unwrap();
        let mut archive = open_odf(&bytes).unwrap();
        let entry = archive.by_index(0).unwrap();
        assert_eq!(
            entry.compression(),
            zip::CompressionMethod::Stored,
            "mimetype must be stored, not deflated"
        );
    }

    #[test]
    fn manifest_lists_the_parts_that_exist() {
        let bytes = write_odt("Title", &["a".into()]).unwrap();
        let manifest = part(&bytes, "META-INF/manifest.xml");
        let present = names(&bytes);

        for required in ["content.xml", "styles.xml", "meta.xml"] {
            assert!(
                manifest.contains(&format!("manifest:full-path=\"{}\"", required)),
                "manifest should list {}",
                required
            );
            assert!(present.contains(&required.to_string()));
        }
    }

    #[test]
    fn odt_round_trips_paragraphs() {
        let paragraphs = vec![
            "First line".to_string(),
            String::new(),
            "Second <line> & more".to_string(),
        ];
        let bytes = write_odt("Title", &paragraphs).unwrap();
        let read = read_odt(&bytes).expect("should read");

        assert_eq!(read, paragraphs, "got: {:?}", read);
    }

    #[test]
    fn ods_round_trips_a_grid_including_blank_cells() {
        let rows = vec![
            vec!["Name".to_string(), "Qty".to_string()],
            vec!["Widget".to_string(), "".to_string()],
            vec!["007".to_string(), "12".to_string()],
        ];
        let bytes = write_ods("Sheet", &rows).unwrap();
        let read = read_ods(&bytes).expect("should read");

        assert_eq!(read, rows, "got: {:?}", read);
    }

    #[test]
    fn ods_writes_leading_zero_values_as_strings() {
        // A zip code written as a number loses its leading zero in LibreOffice.
        let bytes = write_ods("Sheet", &[vec!["007".to_string()]]).unwrap();
        let content = part(&bytes, "content.xml");
        assert!(content.contains("office:value-type=\"string\""));
        assert!(!content.contains("office:value=\"7\""));
    }

    #[test]
    fn odp_round_trips_pages_in_order() {
        let slides = vec![
            OdfSlide {
                title: "First".to_string(),
                bullets: vec!["Alpha".to_string()],
            },
            OdfSlide {
                title: "Second".to_string(),
                bullets: vec!["Beta".to_string(), "Gamma".to_string()],
            },
        ];
        let bytes = write_odp("Deck", &slides).unwrap();
        let read = read_odp(&bytes).expect("should read");

        assert_eq!(read.len(), 2, "got: {:?}", read);
        assert_eq!(read[0], vec!["First", "Alpha"], "got: {:?}", read[0]);
        assert_eq!(
            read[1],
            vec!["Second", "Beta", "Gamma"],
            "got: {:?}",
            read[1]
        );
    }

    #[test]
    fn odf_escapes_markup_in_text() {
        let bytes = write_odt("t", &["<script>x</script>".to_string()]).unwrap();
        let content = part(&bytes, "content.xml");
        assert!(content.contains("&lt;script&gt;"));
        assert!(!content.contains("<script>"));
    }

    #[test]
    fn mime_detection_identifies_each_format() {
        let odt = write_odt("t", &["a".into()]).unwrap();
        let ods = write_ods("t", &[vec!["a".into()]]).unwrap();
        assert!(is_odf_mime(&odt, ODT_MIME));
        assert!(!is_odf_mime(&odt, ODS_MIME));
        assert!(is_odf_mime(&ods, ODS_MIME));
        assert!(!is_odf_mime(b"not a zip", ODT_MIME));
    }

    /// Every prefix used in a part must be declared on that part's root
    /// element. An undeclared prefix makes the XML invalid, and the symptom
    /// is the file being rejected rather than a parse complaint.
    #[test]
    fn every_namespace_prefix_used_is_declared() {
        for bytes in [
            write_odt("T", &["a".to_string()]).unwrap(),
            write_ods("T", &[vec!["a".to_string()]]).unwrap(),
            write_odp(
                "T",
                &[OdfSlide {
                    title: "t".to_string(),
                    bullets: vec!["b".to_string()],
                }],
            )
            .unwrap(),
        ] {
            for name in [
                "content.xml",
                "meta.xml",
                "styles.xml",
                "META-INF/manifest.xml",
            ] {
                let xml = part(&bytes, name);
                // Skip the <?xml ...?> declaration, which also ends in '>'.
                let root_start = xml.find("?>").map(|i| i + 2).unwrap_or(0);
                let root = xml[root_start..]
                    .split_once('>')
                    .map(|(open, _)| open)
                    .unwrap_or_default();

                // Collect prefixes actually used in the part body.
                let mut used: Vec<&str> = Vec::new();
                for candidate in [
                    "office", "text", "table", "draw", "style", "fo", "number", "svg", "xlink",
                    "dc", "meta", "manifest",
                ] {
                    if xml.contains(&format!("<{}:", candidate))
                        || xml.contains(&format!("</{}:", candidate))
                        || xml.contains(&format!(" {}:", candidate))
                    {
                        used.push(candidate);
                    }
                }

                for prefix in used {
                    assert!(
                        root.contains(&format!("xmlns:{}=\"", prefix)),
                        "{} uses the {}: prefix but does not declare it",
                        name,
                        prefix
                    );
                }
            }
        }
    }

    #[test]
    fn empty_document_still_produces_a_valid_package() {
        let bytes = write_odt("t", &[]).unwrap();
        assert_eq!(&bytes[0..2], b"PK");
        assert!(names(&bytes).contains(&"content.xml".to_string()));
    }
}
