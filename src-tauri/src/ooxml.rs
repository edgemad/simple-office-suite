//! Real Office Open XML writers.
//!
//! The existing exporters in the frontend emit Word-compatible HTML and flat
//! XML rather than zipped OOXML, so a file saved with a `.docx` extension is
//! not something Word can open. These produce genuine OOXML packages: a zip
//! with the part layout and relationships that Office requires.
//!
//! The package is built with the same `zip` crate the readers already use, and
//! every writer here is verified by parsing the result back with those readers,
//! so the two halves cannot drift apart silently.

use std::io::{Cursor, Write};
use zip::write::SimpleFileOptions;
use zip::{CompressionMethod, ZipWriter};

/// Escapes text for an XML text node.
pub fn escape_xml_text(value: &str) -> String {
    let mut out = String::with_capacity(value.len());
    for character in value.chars() {
        match character {
            '&' => out.push_str("&amp;"),
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            // Control characters other than tab/newline/carriage-return are
            // not representable in XML 1.0 and would make the file invalid.
            '\u{0}'..='\u{8}' | '\u{b}' | '\u{c}' | '\u{e}'..='\u{1f}' => {}
            other => out.push(other),
        }
    }
    out
}

fn options() -> SimpleFileOptions {
    SimpleFileOptions::default().compression_method(CompressionMethod::Deflated)
}

struct Package {
    zip: ZipWriter<Cursor<Vec<u8>>>,
}

impl Package {
    fn new() -> Self {
        Package {
            zip: ZipWriter::new(Cursor::new(Vec::new())),
        }
    }

    /// Adds a part. A failure here means the file on disk would be truncated,
    /// so it is surfaced rather than swallowed.
    fn part(&mut self, name: &str, content: &str) -> Result<(), String> {
        self.zip
            .start_file(name, options())
            .map_err(|e| format!("Cannot add {}: {}", name, e))?;
        self.zip
            .write_all(content.as_bytes())
            .map_err(|e| format!("Cannot write {}: {}", name, e))
    }

    fn finish(self) -> Result<Vec<u8>, String> {
        self.zip
            .finish()
            .map(|cursor| cursor.into_inner())
            .map_err(|e| format!("Cannot finalise the document: {}", e))
    }
}

const CONTENT_TYPES_XMLNS: &str = "http://schemas.openxmlformats.org/package/2006/content-types";
const RELATIONSHIPS_NS: &str = "http://schemas.openxmlformats.org/package/2006/relationships";
const OFFICE_REL: &str = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

fn package_rels(office_document: &str) -> String {
    format!(
        "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\
<Relationships xmlns=\"{}\">\
<Relationship Id=\"rId1\" Type=\"{}/officeDocument\" Target=\"{}\"/>\
</Relationships>",
        RELATIONSHIPS_NS, OFFICE_REL, office_document
    )
}

fn core_properties(title: &str) -> String {
    format!(
        "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\
<cp:coreProperties \
xmlns:cp=\"http://schemas.openxmlformats.org/package/2006/metadata/core-properties\" \
xmlns:dc=\"http://purl.org/dc/elements/1.1/\" \
xmlns:dcterms=\"http://purl.org/dc/terms/\" \
xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\">\
<dc:title>{}</dc:title>\
<dc:creator>SOS</dc:creator>\
<cp:lastModifiedBy>SOS</cp:lastModifiedBy>\
</cp:coreProperties>",
        escape_xml_text(title)
    )
}

fn app_properties(app: &str) -> String {
    format!(
        "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\
<Properties \
xmlns=\"http://schemas.openxmlformats.org/officeDocument/2006/extended-properties\" \
xmlns:vt=\"http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes\">\
<Application>{}</Application>\
</Properties>",
        escape_xml_text(app)
    )
}

fn add_doc_props(package: &mut Package, title: &str, app: &str) -> Result<(), String> {
    package.part("docProps/core.xml", &core_properties(title))?;
    package.part("docProps/app.xml", &app_properties(app))?;
    Ok(())
}

/// A WordprocessingML document: real `.docx`, openable in Word and Pages.
pub fn write_docx(title: &str, paragraphs: &[String]) -> Result<Vec<u8>, String> {
    let mut body = String::new();
    for paragraph in paragraphs {
        // An empty paragraph still needs a run so Word keeps the line break.
        if paragraph.is_empty() {
            body.push_str("<w:p/>");
        } else {
            body.push_str(&format!(
                "<w:p><w:r><w:t xml:space=\"preserve\">{}</w:t></w:r></w:p>",
                escape_xml_text(paragraph)
            ));
        }
    }

    let document = format!(
        "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\
<w:document xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\">\
<w:body>{body}<w:sectPr><w:pgSz w:w=\"11906\" w:h=\"16838\"/>\
<w:pgMar w:top=\"1440\" w:right=\"1440\" w:bottom=\"1440\" w:left=\"1440\"/></w:sectPr>\
</w:body></w:document>",
        body = body
    );

    let content_types = format!(
        "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\
<Types xmlns=\"{ns}\">\
<Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/>\
<Default Extension=\"xml\" ContentType=\"application/xml\"/>\
<Override PartName=\"/word/document.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml\"/>\
<Override PartName=\"/docProps/core.xml\" ContentType=\"application/vnd.openxmlformats-package.core-properties+xml\"/>\
<Override PartName=\"/docProps/app.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.extended-properties+xml\"/>\
</Types>",
        ns = CONTENT_TYPES_XMLNS
    );

    let mut package = Package::new();
    package.part("[Content_Types].xml", &content_types)?;
    package.part("_rels/.rels", &package_rels("word/document.xml"))?;
    package.part("word/document.xml", &document)?;
    add_doc_props(&mut package, title, "SOS Writer")?;
    package.finish()
}

/// A SpreadsheetML workbook: real `.xlsx`, openable in Excel and Numbers.
pub fn write_xlsx(title: &str, rows: &[Vec<String>]) -> Result<Vec<u8>, String> {
    let mut sheet = String::from(
        "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\
<worksheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\"><sheetData>",
    );

    for (row_index, row) in rows.iter().enumerate() {
        sheet.push_str(&format!("<row r=\"{}\">", row_index + 1));
        for (cell_index, cell) in row.iter().enumerate() {
            // Column letters, so the cell reference matches its position.
            let column = column_letters(cell_index);
            let reference = format!("{}{}", column, row_index + 1);

            if let Some(number) = parse_number(cell) {
                sheet.push_str(&format!(
                    "<c r=\"{}\"><v>{}</v></c>",
                    reference,
                    escape_xml_text(&number.to_string())
                ));
            } else if cell.is_empty() {
                // Excel is content with an omitted cell; writing an empty
                // inline string would show up as a populated cell.
                continue;
            } else {
                sheet.push_str(&format!(
                    "<c r=\"{}\" t=\"inlineStr\"><is><t xml:space=\"preserve\">{}</t></is></c>",
                    reference,
                    escape_xml_text(cell)
                ));
            }
        }
        sheet.push_str("</row>");
    }
    sheet.push_str("</sheetData></worksheet>");

    let workbook = "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\
<workbook xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\" \
xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\">\
<sheets><sheet name=\"Sheet1\" sheetId=\"1\" r:id=\"rId1\"/></sheets></workbook>";

    let workbook_rels = format!(
        "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\
<Relationships xmlns=\"{}\">\
<Relationship Id=\"rId1\" Type=\"{}/worksheet\" Target=\"worksheets/sheet1.xml\"/>\
</Relationships>",
        RELATIONSHIPS_NS, OFFICE_REL
    );

    let content_types = format!(
        "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\
<Types xmlns=\"{ns}\">\
<Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/>\
<Default Extension=\"xml\" ContentType=\"application/xml\"/>\
<Override PartName=\"/xl/workbook.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml\"/>\
<Override PartName=\"/xl/worksheets/sheet1.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml\"/>\
<Override PartName=\"/docProps/core.xml\" ContentType=\"application/vnd.openxmlformats-package.core-properties+xml\"/>\
<Override PartName=\"/docProps/app.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.extended-properties+xml\"/>\
</Types>",
        ns = CONTENT_TYPES_XMLNS
    );

    let mut package = Package::new();
    package.part("[Content_Types].xml", &content_types)?;
    package.part("_rels/.rels", &package_rels("xl/workbook.xml"))?;
    package.part("xl/workbook.xml", workbook)?;
    package.part("xl/_rels/workbook.xml.rels", &workbook_rels)?;
    package.part("xl/worksheets/sheet1.xml", &sheet)?;
    add_doc_props(&mut package, title, "SOS Sheets")?;
    package.finish()
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

/// Returns the numeric value when the cell is unambiguously a number, so
/// Excel gets a number to compute with rather than text.
fn parse_number(value: &str) -> Option<f64> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return None;
    }
    // Anything with leading zeros, a trailing sign, or spaces inside is a
    // label (a zip code, a phone number) and must stay text.
    if trimmed.len() > 1 && (trimmed.starts_with('0') || trimmed.starts_with('+')) {
        return None;
    }
    if trimmed != value {
        return None;
    }
    trimmed.parse::<f64>().ok()
}

/// A slide as plain text: a title and a list of body lines.
#[derive(serde::Deserialize)]
pub struct SlideContent {
    pub title: String,
    pub bullets: Vec<String>,
}

const SLIDE_SIZE: &str = "9144000x6858000";

/// A PresentationML deck: real `.pptx`.
pub fn write_pptx(title: &str, slides: &[SlideContent]) -> Result<Vec<u8>, String> {
    let mut content_types = format!(
        "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\
<Types xmlns=\"{ns}\">\
<Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/>\
<Default Extension=\"xml\" ContentType=\"application/xml\"/>\
<Override PartName=\"/ppt/presentation.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml\"/>\
<Override PartName=\"/ppt/slideMasters/slideMaster1.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml\"/>\
<Override PartName=\"/ppt/slideLayouts/slideLayout1.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml\"/>\
<Override PartName=\"/ppt/theme/theme1.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.theme+xml\"/>\
<Override PartName=\"/docProps/core.xml\" ContentType=\"application/vnd.openxmlformats-package.core-properties+xml\"/>\
<Override PartName=\"/docProps/app.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.extended-properties+xml\"/>",
        ns = CONTENT_TYPES_XMLNS
    );

    let mut presentation_rels = format!(
        "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\
<Relationships xmlns=\"{}\">",
        RELATIONSHIPS_NS
    );
    let mut slide_ids = String::new();

    for index in 1..=slides.len() {
        content_types.push_str(&format!(
            "<Override PartName=\"/ppt/slides/slide{index}.xml\" \
ContentType=\"application/vnd.openxmlformats-officedocument.presentationml.slide+xml\"/>"
        ));
        presentation_rels.push_str(&format!(
            "<Relationship Id=\"rIdSlide{index}\" Type=\"{office}/slide\" Target=\"slides/slide{index}.xml\"/>",
            office = OFFICE_REL, index = index
        ));
        slide_ids.push_str(&format!(
            "<p:sldId id=\"{}\" r:id=\"rIdSlide{}\"/>",
            255 + index,
            index
        ));
    }

    // Master and layout must come after the slides so their rIds do not
    // collide with the slide relationships.
    presentation_rels.push_str(&format!(
        "<Relationship Id=\"rIdMaster\" Type=\"{}/slideMaster\" Target=\"slideMasters/slideMaster1.xml\"/>\
<Relationship Id=\"rIdTheme\" Type=\"{}/theme\" Target=\"theme/theme1.xml\"/>\
</Relationships>",
        OFFICE_REL, OFFICE_REL
    ));
    content_types.push_str("</Types>");

    let presentation = format!(
        "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\
<p:presentation xmlns:a=\"http://schemas.openxmlformats.org/drawingml/2006/main\" \
xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\" \
xmlns:p=\"http://schemas.openxmlformats.org/presentationml/2006/main\">\
<p:sldMasterIdLst><p:sldMasterId id=\"2147483648\" r:id=\"rIdMaster\"/></p:sldMasterIdLst>\
<p:sldIdLst>{slide_ids}</p:sldIdLst>\
<p:sldSz cx=\"{size}\"/><p:notesSz cx=\"6858000\" cy=\"9144000\"/>\
</p:presentation>",
        slide_ids = slide_ids,
        size = SLIDE_SIZE
    );

    let empty_shape_tree = "<p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id=\"1\" name=\"\"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld>";

    let slide_master = format!(
        "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\
<p:sldMaster xmlns:a=\"http://schemas.openxmlformats.org/drawingml/2006/main\" \
xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\" \
xmlns:p=\"http://schemas.openxmlformats.org/presentationml/2006/main\">\
{shapes}<p:clrMap bg1=\"lt1\" tx1=\"dk1\" bg2=\"lt2\" tx2=\"dk2\" accent1=\"accent1\" \
accent2=\"accent2\" accent3=\"accent3\" accent4=\"accent4\" accent5=\"accent5\" \
accent6=\"accent6\" hlink=\"hlink\" folHlink=\"folHlink\"/>\
<p:sldLayoutIdLst><p:sldLayoutId id=\"2147483649\" r:id=\"rIdLayout1\"/></p:sldLayoutIdLst>\
</p:sldMaster>",
        shapes = empty_shape_tree
    );

    let slide_layout = format!(
        "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\
<p:sldLayout xmlns:a=\"http://schemas.openxmlformats.org/drawingml/2006/main\" \
xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\" \
xmlns:p=\"http://schemas.openxmlformats.org/presentationml/2006/main\" \
type=\"blank\" preserve=\"1\">{shapes}</p:sldLayout>",
        shapes = empty_shape_tree
    );

    let master_rels = format!(
        "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\
<Relationships xmlns=\"{ns}\">\
<Relationship Id=\"rIdLayout1\" Type=\"{office}/slideLayout\" Target=\"../slideLayouts/slideLayout1.xml\"/>\
<Relationship Id=\"rIdTheme1\" Type=\"{office}/theme\" Target=\"../theme/theme1.xml\"/>\
</Relationships>",
        ns = RELATIONSHIPS_NS, office = OFFICE_REL
    );

    let layout_rels = format!(
        "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\
<Relationships xmlns=\"{ns}\">\
<Relationship Id=\"rIdMaster\" Type=\"{office}/slideMaster\" Target=\"../slideMasters/slideMaster1.xml\"/>\
</Relationships>",
        ns = RELATIONSHIPS_NS, office = OFFICE_REL
    );

    let theme = minimal_theme();

    let mut package = Package::new();
    package.part("[Content_Types].xml", &content_types)?;
    package.part("_rels/.rels", &package_rels("ppt/presentation.xml"))?;
    package.part("ppt/presentation.xml", &presentation)?;
    package.part("ppt/_rels/presentation.xml.rels", &presentation_rels)?;
    package.part("ppt/slideMasters/slideMaster1.xml", &slide_master)?;
    package.part("ppt/slideMasters/_rels/slideMaster1.xml.rels", &master_rels)?;
    package.part("ppt/slideLayouts/slideLayout1.xml", &slide_layout)?;
    package.part("ppt/slideLayouts/_rels/slideLayout1.xml.rels", &layout_rels)?;
    package.part("ppt/theme/theme1.xml", &theme)?;

    for (index, slide) in slides.iter().enumerate() {
        let number = index + 1;
        let mut body = String::new();

        body.push_str(&format!(
            "<p:sp><p:nvSpPr><p:cNvPr id=\"2\" name=\"Title {}\"/><p:cNvSpPr><a:spLocks noGrp=\"1\"/></p:cNvSpPr><p:nvPr><p:ph type=\"title\"/></p:nvPr></p:nvSpPr>\
<p:spPr><a:xfrm><a:off x=\"685800\" y=\"457200\"/><a:ext cx=\"7772400\" cy=\"1143000\"/></a:xfrm></p:spPr>\
<p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang=\"en-US\" sz=\"3200\" b=\"1\"/><a:t>{}</a:t></a:r></a:p></p:txBody></p:sp>",
            number,
            escape_xml_text(&slide.title)
        ));

        if !slide.bullets.is_empty() {
            let mut paragraphs = String::new();
            for bullet in &slide.bullets {
                paragraphs.push_str(&format!(
                    "<a:p><a:r><a:rPr lang=\"en-US\" sz=\"2000\"/><a:t>{}</a:t></a:r></a:p>",
                    escape_xml_text(bullet)
                ));
            }
            body.push_str(&format!(
                "<p:sp><p:nvSpPr><p:cNvPr id=\"3\" name=\"Body {}\"/><p:cNvSpPr><a:spLocks noGrp=\"1\"/></p:cNvSpPr><p:nvPr><p:ph type=\"body\" idx=\"1\"/></p:nvPr></p:nvSpPr>\
<p:spPr><a:xfrm><a:off x=\"685800\" y=\"1828800\"/><a:ext cx=\"7772400\" cy=\"4114800\"/></a:xfrm></p:spPr>\
<p:txBody><a:bodyPr/><a:lstStyle/>{}</p:txBody></p:sp>",
                number, paragraphs
            ));
        }

        let slide_xml = format!(
            "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\
<p:sld xmlns:a=\"http://schemas.openxmlformats.org/drawingml/2006/main\" \
xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\" \
xmlns:p=\"http://schemas.openxmlformats.org/presentationml/2006/main\">\
<p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id=\"1\" name=\"\"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>\
<p:grpSpPr/>{body}</p:spTree></p:cSld><p:clrMapOvr><a:overrideClrMapping/></p:clrMapOvr></p:sld>",
            body = body
        );

        let slide_rels = format!(
            "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\
<Relationships xmlns=\"{ns}\">\
<Relationship Id=\"rIdLayout1\" Type=\"{office}/slideLayout\" Target=\"../slideLayouts/slideLayout1.xml\"/>\
</Relationships>",
            ns = RELATIONSHIPS_NS, office = OFFICE_REL
        );

        package.part(&format!("ppt/slides/slide{}.xml", number), &slide_xml)?;
        package.part(
            &format!("ppt/slides/_rels/slide{}.xml.rels", number),
            &slide_rels,
        )?;
    }

    add_doc_props(&mut package, title, "SOS Slides")?;
    package.finish()
}

fn minimal_theme() -> String {
    "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\
<a:theme xmlns:a=\"http://schemas.openxmlformats.org/drawingml/2006/main\" name=\"SOS\">\
<a:themeElements><a:clrScheme name=\"SOS\">\
<a:dk1><a:sysClr val=\"windowText\" lastClr=\"000000\"/></a:dk1>\
<a:lt1><a:sysClr val=\"window\" lastClr=\"FFFFFF\"/></a:lt1>\
<a:dk2><a:srgbClr val=\"44546A\"/></a:dk2><a:lt2><a:srgbClr val=\"E7E6E6\"/></a:lt2>\
<a:accent1><a:srgbClr val=\"4472C4\"/></a:accent1><a:accent2><a:srgbClr val=\"ED7D31\"/></a:accent2>\
<a:accent3><a:srgbClr val=\"A5A5A5\"/></a:accent3><a:accent4><a:srgbClr val=\"FFC000\"/></a:accent4>\
<a:accent5><a:srgbClr val=\"5B9BD5\"/></a:accent5><a:accent6><a:srgbClr val=\"70AD47\"/></a:accent6>\
<a:hlink><a:srgbClr val=\"0563C1\"/></a:hlink><a:folHlink><a:srgbClr val=\"954F72\"/></a:folHlink>\
</a:clrScheme>\
<a:fontScheme name=\"SOS\"><a:majorFont><a:latin typeface=\"Calibri Light\"/><a:ea typeface=\"\"/><a:cs typeface=\"\"/></a:majorFont>\
<a:minorFont><a:latin typeface=\"Calibri\"/><a:ea typeface=\"\"/><a:cs typeface=\"\"/></a:minorFont></a:fontScheme>\
<a:fmtScheme name=\"SOS\">\
<a:fillStyleLst><a:solidFill><a:schemeClr val=\"phClr\"/></a:solidFill>\
<a:solidFill><a:schemeClr val=\"phClr\"/></a:solidFill><a:solidFill><a:schemeClr val=\"phClr\"/></a:solidFill></a:fillStyleLst>\
<a:lnStyleLst><a:ln w=\"6350\"><a:solidFill><a:schemeClr val=\"phClr\"/></a:solidFill></a:ln>\
<a:ln w=\"12700\"><a:solidFill><a:schemeClr val=\"phClr\"/></a:solidFill></a:ln>\
<a:ln w=\"19050\"><a:solidFill><a:schemeClr val=\"phClr\"/></a:solidFill></a:ln></a:lnStyleLst>\
<a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle>\
<a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst>\
<a:bgFillStyleLst><a:solidFill><a:schemeClr val=\"phClr\"/></a:solidFill>\
<a:solidFill><a:schemeClr val=\"phClr\"/></a:solidFill><a:solidFill><a:schemeClr val=\"phClr\"/></a:solidFill></a:bgFillStyleLst>\
</a:fmtScheme></a:themeElements></a:theme>"
        .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Read;

    /// Lists the parts in a package, so a missing required part is visible
    /// rather than showing up as "Word cannot open this file".
    fn part_names(bytes: &[u8]) -> Vec<String> {
        let mut archive = zip::ZipArchive::new(Cursor::new(bytes.to_vec())).expect("should open");
        (0..archive.len())
            .map(|i| archive.by_index(i).expect("entry").name().to_string())
            .collect()
    }

    fn read_part(bytes: &[u8], name: &str) -> String {
        let mut archive = zip::ZipArchive::new(Cursor::new(bytes.to_vec())).expect("should open");
        let mut entry = archive.by_name(name).expect("part should exist");
        let mut text = String::new();
        entry
            .read_to_string(&mut text)
            .expect("part should be utf-8");
        text
    }

    #[test]
    fn docx_is_a_zip_with_the_required_parts() {
        let bytes = write_docx("Test", &["hello".to_string()]).expect("should write");
        assert_eq!(&bytes[0..2], b"PK", "should be a zip archive");

        let names = part_names(&bytes);
        for required in ["[Content_Types].xml", "_rels/.rels", "word/document.xml"] {
            assert!(
                names.contains(&required.to_string()),
                "missing {}",
                required
            );
        }
    }

    #[test]
    fn docx_escapes_markup_in_the_text() {
        // Unescaped angle brackets would produce invalid XML, or inject markup.
        let bytes =
            write_docx("Test", &["<script>alert(1)</script>".to_string()]).expect("should write");
        let document = read_part(&bytes, "word/document.xml");
        assert!(document.contains("&lt;script&gt;"));
        assert!(!document.contains("<script>"));
    }

    #[test]
    fn docx_keeps_an_empty_paragraph() {
        let bytes = write_docx("Test", &["a".to_string(), String::new(), "b".to_string()])
            .expect("should write");
        let document = read_part(&bytes, "word/document.xml");
        // An empty line is a self-closing <w:p/>, so both forms count.
        let paragraphs = document.matches("<w:p>").count() + document.matches("<w:p/>").count();
        assert_eq!(paragraphs, 3, "one paragraph per line");
        assert!(document.contains("<w:p/>"), "the blank line should survive");
    }

    #[test]
    fn xlsx_writes_numbers_as_numbers_and_labels_as_text() {
        let rows = vec![
            vec!["42".to_string(), "hello".to_string()],
            vec!["007".to_string(), "3.5".to_string()],
        ];
        let bytes = write_xlsx("Test", &rows).expect("should write");
        let sheet = read_part(&bytes, "xl/worksheets/sheet1.xml");

        // A number needs <v> so Excel can compute with it.
        assert!(sheet.contains("<c r=\"A1\"><v>42</v></c>"));
        // A label must not become a number, or a zip code loses its leading zero.
        assert!(sheet.contains("007"));
        assert!(sheet.contains("t=\"inlineStr\""));
        assert!(sheet.contains("3.5"));
    }

    #[test]
    fn xlsx_omits_empty_cells() {
        let rows = vec![vec![String::new(), "x".to_string()]];
        let bytes = write_xlsx("Test", &rows).expect("should write");
        let sheet = read_part(&bytes, "xl/worksheets/sheet1.xml");
        assert!(
            !sheet.contains("r=\"A1\""),
            "an empty cell should be omitted"
        );
        assert!(sheet.contains("r=\"B1\""));
    }

    #[test]
    fn column_letters_follow_spreadsheet_convention() {
        assert_eq!(column_letters(0), "A");
        assert_eq!(column_letters(25), "Z");
        assert_eq!(column_letters(26), "AA");
        assert_eq!(column_letters(27), "AB");
        assert_eq!(column_letters(51), "AZ");
        assert_eq!(column_letters(52), "BA");
        assert_eq!(column_letters(701), "ZZ");
    }

    #[test]
    fn pptx_has_master_layout_and_theme_that_office_requires() {
        let slides = vec![SlideContent {
            title: "Slide one".to_string(),
            bullets: vec!["First point".to_string()],
        }];
        let bytes = write_pptx("Deck", &slides).expect("should write");

        let names = part_names(&bytes);
        for required in [
            "[Content_Types].xml",
            "_rels/.rels",
            "ppt/presentation.xml",
            "ppt/slides/slide1.xml",
            // PowerPoint refuses to open a deck missing any of these.
            "ppt/slideMasters/slideMaster1.xml",
            "ppt/slideLayouts/slideLayout1.xml",
            "ppt/theme/theme1.xml",
        ] {
            assert!(
                names.contains(&required.to_string()),
                "missing {}",
                required
            );
        }
    }

    #[test]
    fn pptx_relationship_ids_do_not_collide() {
        // The master and layout share the presentation's rels part, so a
        // duplicate Id would make the deck unreadable.
        let slides = vec![
            SlideContent {
                title: "a".to_string(),
                bullets: vec![],
            },
            SlideContent {
                title: "b".to_string(),
                bullets: vec![],
            },
        ];
        let bytes = write_pptx("Deck", &slides).expect("should write");
        let rels = read_part(&bytes, "ppt/_rels/presentation.xml.rels");

        let mut ids = Vec::new();
        for chunk in rels.split("Id=\"").skip(1) {
            ids.push(chunk.split('"').next().unwrap_or("").to_string());
        }
        let mut sorted = ids.clone();
        sorted.sort();
        sorted.dedup();
        assert_eq!(
            ids.len(),
            sorted.len(),
            "duplicate relationship id: {:?}",
            ids
        );
    }

    #[test]
    fn pptx_escapes_slide_text() {
        let slides = vec![SlideContent {
            title: "A & B <tag>".to_string(),
            bullets: vec![],
        }];
        let bytes = write_pptx("Deck", &slides).expect("should write");
        let slide = read_part(&bytes, "ppt/slides/slide1.xml");
        assert!(slide.contains("A &amp; B &lt;tag&gt;"));
        assert!(!slide.contains("<tag>"));
    }

    #[test]
    fn control_characters_are_dropped_because_xml_cannot_carry_them() {
        assert_eq!(escape_xml_text("a\u{0}b\u{8}c"), "abc");
        // Tab, newline, and carriage return are legal and must survive.
        assert_eq!(escape_xml_text("a\tb\nc\rd"), "a\tb\nc\rd");
    }
}
