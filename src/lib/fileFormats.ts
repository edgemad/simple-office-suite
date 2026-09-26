import type { WriterDocument, SpreadsheetWorkbook, SlideDeck, DocumentMeta, Slide, SlideElement } from '../types';
import { colToLetter, recalculateGrid } from '../components/sheets/formulaEngine';
import { escapeHtml, extractHtmlBody, sanitizeHtml } from './sanitize';

/**
 * Universal File Format Engine for Simple Office Suite (SOS)
 * Supports opening and exporting .docx, .doc, .xlsx, .xls, .pptx, .csv, .tsv, .md, .txt, .html, .rtf, .json
 */

function escapeXmlText(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeXmlAttribute(value: unknown): string {
  return escapeXmlText(value)
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function escapeCdata(value: unknown): string {
  return String(value ?? '').replace(/]]>/g, ']]]]><![CDATA[>');
}

const RTF_BOLD_ON = '\uE000';
const RTF_BOLD_OFF = '\uE001';
const RTF_ITALIC_ON = '\uE002';
const RTF_ITALIC_OFF = '\uE003';
const RTF_SIZE_OPEN = '\uE004';
const RTF_SIZE_CLOSE = '\uE005';
const RTF_BULLET = '\uE006';
const RTF_PARAGRAPH = '\uE007';

// ---------------------- DOCUMENT FORMATS (WRITER) ----------------------

export function exportToDocx(doc: WriterDocument): string {
  // Generates an HTML-based Word Document with Microsoft Office namespace markup
  const title = escapeHtml(doc?.meta?.title || 'Document');
  const body = sanitizeHtml(doc?.contentHtml ?? '');
  return `<!DOCTYPE html>
<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <!--[if gte mso 9]>
  <xml>
    <w:WordDocument>
      <w:View>Print</w:View>
      <w:Zoom>100</w:Zoom>
      <w:DoNotOptimizeForBrowser/>
    </w:WordDocument>
  </xml>
  <![endif]-->
  <style>
    @page Section1 {
      size: 21.0cm 29.7cm;
      margin: 2.5cm 2.5cm 2.5cm 2.5cm;
      mso-page-orientation: portrait;
    }
    div.Section1 { page: Section1; }
    body {
      font-family: 'Calibri', 'Segoe UI', Arial, sans-serif;
      font-size: 11pt;
      line-height: 1.5;
      color: #1e293b;
    }
    h1 { font-size: 22pt; font-weight: bold; color: #0f172a; margin-bottom: 12pt; }
    h2 { font-size: 16pt; font-weight: bold; color: #1e293b; margin-top: 14pt; margin-bottom: 6pt; }
    h3 { font-size: 13pt; font-weight: bold; color: #334155; margin-top: 12pt; margin-bottom: 4pt; }
    p { margin-bottom: 8pt; }
    table { width: 100%; border-collapse: collapse; margin: 12pt 0; }
    table th, table td { border: 1pt solid #cbd5e1; padding: 6pt 10pt; }
    table th { background-color: #f1f5f9; font-weight: bold; }
    blockquote { border-left: 3pt solid #3b82f6; padding-left: 10pt; color: #475569; font-style: italic; }
  </style>
</head>
<body>
  <div class="Section1">
    ${body}
  </div>
</body>
</html>`;
}

export function exportToRtf(doc: WriterDocument): string {
  const plainText = sanitizeHtml(doc?.contentHtml ?? '')
    .replace(/<h([1-3])[^>]*>([\s\S]*?)<\/h[1-3]>/gi, (_match, level: string, inner: string) => {
      const size = 28 - (Number(level) - 1) * 6;
      return `\n${RTF_SIZE_OPEN}${size}${RTF_SIZE_CLOSE}${inner}${RTF_SIZE_OPEN}22${RTF_SIZE_CLOSE}${RTF_PARAGRAPH}`;
    })
    .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1' + RTF_PARAGRAPH)
    .replace(/<(strong|b)[^>]*>([\s\S]*?)<\/\1>/gi, `${RTF_BOLD_ON}$2${RTF_BOLD_OFF}`)
    .replace(/<(em|i)[^>]*>([\s\S]*?)<\/\1>/gi, `${RTF_ITALIC_ON}$2${RTF_ITALIC_OFF}`)
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, `${RTF_PARAGRAPH}  ${RTF_BULLET}$1`)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/[\\{}]/g, (char) => `\\${char}`)
    .replace(/\uE000/g, '\\b ')
    .replace(/\uE001/g, '\\b0 ')
    .replace(/\uE002/g, '\\i ')
    .replace(/\uE003/g, '\\i0 ')
    .replace(/\uE004(\d+)\uE005/g, (_match, size: string) => `\\fs${size} `)
    .replace(/\uE006/g, '\\bullet ')
    .replace(/\uE007/g, '\\par\n')
    .trim();

  return `{\\rtf1\\ansi\\deff0 {\\fonttbl {\\f0 Calibri;}{\\f1 Times New Roman;}}
\\f0\\fs22
${plainText.replace(/\n/g, '\\par\n')}
}`;
}

const HTML_MARKUP_PATTERN = /<\/?[a-z][^>]*>|<!--[\s\S]*?-->/i;

export function parseDocumentContent(raw: string, filename: string): string {
  const ext = String(filename || '').split('.').pop()?.toLowerCase();
  const source = typeof raw === 'string' ? raw : '';

  if (ext === 'docx' || ext === 'doc' || ext === 'html' || ext === 'htm') {
    if (HTML_MARKUP_PATTERN.test(source)) {
      return sanitizeHtml(extractHtmlBody(source));
    }
  } else if (ext === 'md') {
    let html = source
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
      .replace(/\*(.*)\*/gim, '<em>$1</em>')
      .replace(/`([^`]+)`/gim, '<code>$1</code>')
      .replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>')
      .replace(/^\s*\-\s+(.*$)/gim, '<ul><li>$1</li></ul>')
      .replace(/<\/ul>\s*<ul>/gim, '');

    const paragraphs = html.split(/\n{2,}/).map(p => {
      p = p.trim();
      if (!p) return '';
      if (p.startsWith('<h') || p.startsWith('<blockquote') || p.startsWith('<ul')) return p;
      return `<p>${p.replace(/\n/g, '<br>')}</p>`;
    }).join('\n');
    return sanitizeHtml(paragraphs || `<p>${escapeHtml(source)}</p>`);
  } else if (ext === 'rtf') {
    const clean = source.replace(/\\[a-z]+(-?\d+)? ?|[{}]/gi, '').trim();
    return sanitizeHtml(`<p>${escapeHtml(clean).replace(/\n/g, '<br>')}</p>`);
  }

  const lines = source.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  return sanitizeHtml(lines.map(l => `<p>${escapeHtml(l)}</p>`).join('\n') || `<p>${escapeHtml(source)}</p>`);
}

export function sanitizeImportedWriterDocument(parsed: unknown, fallbackMeta: DocumentMeta): WriterDocument {
  const source = (parsed && typeof parsed === 'object' ? parsed : {}) as Partial<WriterDocument>;
  const meta = source.meta && typeof source.meta === 'object' ? source.meta : {} as Partial<DocumentMeta>;

  return {
    meta: {
      ...fallbackMeta,
      id: typeof meta.id === 'string' && meta.id ? meta.id : fallbackMeta.id,
      title: typeof meta.title === 'string' && meta.title ? meta.title : fallbackMeta.title,
      filePath: typeof meta.filePath === 'string' ? meta.filePath : fallbackMeta.filePath,
      lastSaved: typeof meta.lastSaved === 'string' ? meta.lastSaved : fallbackMeta.lastSaved,
      isDirty: false,
      mode: 'writer',
    },
    contentHtml: sanitizeHtml(typeof source.contentHtml === 'string' ? source.contentHtml : ''),
    contentMarkdown: typeof source.contentMarkdown === 'string' ? source.contentMarkdown : '',
    wordCount: typeof source.wordCount === 'number' ? source.wordCount : 0,
    charCount: typeof source.charCount === 'number' ? source.charCount : 0,
    pageCount: typeof source.pageCount === 'number' ? source.pageCount : 1,
    pageSize: source.pageSize === 'letter' ? 'letter' : 'a4',
  };
}

export function sanitizeImportedSlideDeck(parsed: unknown, fallbackMeta: DocumentMeta): SlideDeck | null {
  if (!parsed || typeof parsed !== 'object') return null;
  const source = parsed as { slides?: unknown; aspectRatio?: unknown; theme?: unknown };
  if (!Array.isArray(source.slides)) return null;

  const slides: Slide[] = source.slides
    .map((entry, index) => ({ entry, index }))
    .filter(candidate => candidate.entry && typeof candidate.entry === 'object')
    .map(({ entry, index }) => {
      const slide = entry as Record<string, unknown>;
      const elements = Array.isArray(slide.elements) ? slide.elements : [];
      return {
        id: typeof slide.id === 'string' && slide.id ? slide.id : `slide_${index + 1}`,
        title: typeof slide.title === 'string' ? slide.title : `Slide ${index + 1}`,
        bgColor: typeof slide.bgColor === 'string' ? slide.bgColor : '#ffffff',
        notes: typeof slide.notes === 'string' ? slide.notes : '',
        elements: elements
          .filter(elementEntry => elementEntry && typeof elementEntry === 'object')
          .map((elementEntry, elementIndex) => {
            const element = elementEntry as Record<string, unknown>;
            return {
              id: typeof element.id === 'string' && element.id ? element.id : `e_${index + 1}_${elementIndex + 1}`,
              type: typeof element.type === 'string' ? (element.type as SlideElement['type']) : 'text',
              content: typeof element.content === 'string' ? element.content : '',
              x: typeof element.x === 'number' ? element.x : 0,
              y: typeof element.y === 'number' ? element.y : 0,
              width: typeof element.width === 'number' ? element.width : 40,
              height: typeof element.height === 'number' ? element.height : 20,
              fontFamily: typeof element.fontFamily === 'string' ? element.fontFamily : undefined,
              fontSize: typeof element.fontSize === 'number' ? element.fontSize : undefined,
              fontWeight: typeof element.fontWeight === 'string' ? element.fontWeight : undefined,
              fontColor: typeof element.fontColor === 'string' ? element.fontColor : undefined,
              bgColor: typeof element.bgColor === 'string' ? element.bgColor : undefined,
              borderRadius: typeof element.borderRadius === 'number' ? element.borderRadius : undefined,
              shapeVariant: typeof element.shapeVariant === 'string' ? (element.shapeVariant as SlideElement['shapeVariant']) : undefined,
              language: typeof element.language === 'string' ? element.language : undefined,
            };
          }),
      };
    });

  return {
    meta: { ...fallbackMeta, isDirty: false, mode: 'slides' },
    slides,
    aspectRatio: source.aspectRatio === '4:3' ? '4:3' : '16:9',
    theme: typeof source.theme === 'string' ? source.theme : undefined,
  };
}

// ---------------------- SPREADSHEET FORMATS (SHEETS) ----------------------

export function exportToXlsx(workbook: SpreadsheetWorkbook): string {
  const activeSheet = workbook.sheets.find(s => s.id === workbook.activeSheetId) || workbook.sheets[0];
  
  let xmlRows = '';
  for (let r = 0; r < activeSheet.rowCount; r++) {
    let rowCells = '';
    let rowHasData = false;
    for (let c = 0; c < activeSheet.colCount; c++) {
      const key = `${colToLetter(c)}${r + 1}`;
      const cell = activeSheet.cells[key];
      if (cell && cell.computed !== undefined && cell.computed !== '') {
        rowHasData = true;
        const isNum = typeof cell.computed === 'number';
        const dataType = isNum ? 'Number' : 'String';
        const val = escapeXmlText(cell.computed);
        const formulaAttr = String(cell.raw).startsWith('=') ? ` ss:Formula="${escapeXmlAttribute(cell.raw)}"` : '';
        rowCells += `    <Cell ss:Index="${c + 1}"${formulaAttr}><Data ss:Type="${dataType}">${val}</Data></Cell>\n`;
      }
    }
    if (rowHasData) {
      xmlRows += `  <Row ss:Index="${r + 1}">\n${rowCells}  </Row>\n`;
    }
  }

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Bottom"/>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#000000"/>
  </Style>
 </Styles>
  <Worksheet ss:Name="${escapeXmlAttribute(activeSheet.name)}">
   <Table ss:ExpandedColumnCount="${Number(activeSheet.colCount) || 0}" ss:ExpandedRowCount="${Number(activeSheet.rowCount) || 0}" x:FullColumns="1" x:FullRows="1" ss:DefaultRowHeight="15">
${xmlRows}
   </Table>
  </Worksheet>
</Workbook>`;
}

export function parseSpreadsheetContent(raw: string, filename: string): Record<string, any> {
  const ext = filename.split('.').pop()?.toLowerCase();

  // If raw content starts with PK or [Content_Types].xml, it is a binary zip archive, not a CSV!
  if (raw.startsWith('PK') || raw.includes('[Content_Types].xml')) {
    console.error('Binary ZIP archive detected in CSV parser, aborting plain text parse');
    return {};
  }

  // Robust RFC 4180 CSV / TSV parser handling commas inside quotes, CRLF, escaped quotes
  const delimiter = ext === 'tsv' ? '\t' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  const len = raw.length;

  while (i < len) {
    const ch = raw[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < len && raw[i + 1] === '"') {
          field += '"';
          i += 2;
        } else {
          inQuotes = false;
          i++;
        }
      } else {
        field += ch;
        i++;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
        i++;
      } else if (ch === delimiter) {
        row.push(field.trim());
        field = '';
        i++;
      } else if (ch === '\r') {
        if (i + 1 < len && raw[i + 1] === '\n') i++;
        row.push(field.trim());
        field = '';
        rows.push(row);
        row = [];
        i++;
      } else if (ch === '\n') {
        row.push(field.trim());
        field = '';
        rows.push(row);
        row = [];
        i++;
      } else {
        field += ch;
        i++;
      }
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field.trim());
    rows.push(row);
  }

  const cells: Record<string, any> = {};
  rows.forEach((rFields, r) => {
    rFields.forEach((val, c) => {
      if (val !== '') {
        const letter = colToLetter(c);
        cells[`${letter}${r + 1}`] = { raw: val, computed: val };
      }
    });
  });

  return recalculateGrid(cells);
}

// ---------------------- PRESENTATION FORMATS (SLIDES) ----------------------

export function exportToPptxXml(deck: SlideDeck): string {
  const slidesXml = (deck?.slides ?? []).map((s, idx) => {
    const elementsXml = (s.elements ?? []).map(e => `
      <element id="${escapeXmlAttribute(e.id)}" type="${escapeXmlAttribute(e.type)}" x="${escapeXmlAttribute(e.x)}" y="${escapeXmlAttribute(e.y)}" width="${escapeXmlAttribute(e.width)}" height="${escapeXmlAttribute(e.height)}">
        <content><![CDATA[${escapeCdata(e.content)}]]></content>
      </element>
    `).join('\n');

    return `
    <slide index="${idx + 1}" title="${escapeXmlAttribute(s.title)}" bgColor="${escapeXmlAttribute(s.bgColor)}">
      <elements>
        ${elementsXml}
      </elements>
      <notes><![CDATA[${escapeCdata(s.notes || '')}]]></notes>
    </slide>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<Presentation title="${escapeXmlAttribute(deck?.meta?.title)}" ratio="${escapeXmlAttribute(deck?.aspectRatio)}">
  <slides>
    ${slidesXml}
  </slides>
</Presentation>`;
}
