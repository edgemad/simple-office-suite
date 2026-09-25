import type { WriterDocument, SpreadsheetWorkbook, SlideDeck } from '../types';
import { htmlToMarkdown } from './utils';
import { colToLetter, recalculateGrid } from '../components/sheets/formulaEngine';

/**
 * Universal File Format Engine for Simple Office Suite (SOS)
 * Supports opening and exporting .docx, .doc, .xlsx, .xls, .pptx, .csv, .tsv, .md, .txt, .html, .rtf, .json
 */

// ---------------------- DOCUMENT FORMATS (WRITER) ----------------------

export function exportToDocx(doc: WriterDocument): string {
  // Generates an HTML-based Word Document with Microsoft Office namespace markup
  const title = doc.meta.title || 'Document';
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
    ${doc.contentHtml}
  </div>
</body>
</html>`;
}

export function exportToRtf(doc: WriterDocument): string {
  const plainText = doc.contentHtml
    .replace(/<h[1-3][^>]*>(.*?)<\/h[1-3]>/gi, '\n\\b\\fs28 $1\\b0\\fs22\n\n')
    .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
    .replace(/<strong[^>]*>(.*?)<\/strong>|<b[^>]*>(.*?)<\/b>/gi, '\\b $1$2\\b0 ')
    .replace(/<em[^>]*>(.*?)<\/em>|<i[^>]*>(.*?)<\/i>/gi, '\\i $1$2\\i0 ')
    .replace(/<li[^>]*>(.*?)<\/li>/gi, '  \\bullet  $1\n')
    .replace(/<br\s*[\/]?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .trim();

  return `{\\rtf1\\ansi\\deff0 {\\fonttbl {\\f0 Calibri;}{\\f1 Times New Roman;}}
\\f0\\fs22
${plainText.replace(/\n/g, '\\par\n')}
}`;
}

export function parseDocumentContent(raw: string, filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  
  if (ext === 'docx' || ext === 'doc' || ext === 'html' || ext === 'htm') {
    if (raw.includes('<body') || raw.includes('<div') || raw.includes('<p>')) {
      const bodyMatch = raw.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      return bodyMatch ? bodyMatch[1] : raw;
    }
  } else if (ext === 'md') {
    let html = raw
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
    return paragraphs || `<p>${raw}</p>`;
  } else if (ext === 'rtf') {
    const clean = raw.replace(/\\[a-z]+(-?\d+)? ?|[{}]/gi, '').trim();
    return `<p>${clean.replace(/\n/g, '<br>')}</p>`;
  }

  const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  return lines.map(l => `<p>${l}</p>`).join('\n') || `<p>${raw}</p>`;
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
        const val = String(cell.computed).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const formulaAttr = cell.raw.startsWith('=') ? ` ss:Formula="${cell.raw.replace(/"/g, '&quot;')}"` : '';
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
 <Worksheet ss:Name="${activeSheet.name}">
  <Table ss:ExpandedColumnCount="${activeSheet.colCount}" ss:ExpandedRowCount="${activeSheet.rowCount}" x:FullColumns="1" x:FullRows="1" ss:DefaultRowHeight="15">
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
  const slidesXml = deck.slides.map((s, idx) => {
    const elementsXml = s.elements.map(e => `
      <element id="${e.id}" type="${e.type}" x="${e.x}" y="${e.y}" width="${e.width}" height="${e.height}">
        <content><![CDATA[${e.content}]]></content>
      </element>
    `).join('\n');

    return `
    <slide index="${idx + 1}" title="${s.title}" bgColor="${s.bgColor}">
      <elements>
        ${elementsXml}
      </elements>
      <notes><![CDATA[${s.notes || ''}]]></notes>
    </slide>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<Presentation title="${deck.meta.title}" ratio="${deck.aspectRatio}">
  <slides>
    ${slidesXml}
  </slides>
</Presentation>`;
}
