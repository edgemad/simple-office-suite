import type { WriterDocument, SpreadsheetWorkbook, SlideDeck } from '../types';
import { htmlToMarkdown } from './utils';
import { colToLetter, recalculateGrid } from '../components/sheets/formulaEngine';

/**
 * Universal Multi-Format File Engine for Simple Office Suite (SOS)
 * Supports opening and exporting across all major office suite formats:
 * - Word & Docs: .docx, .odt, .rtf, .html, .md, .txt, .epub, .pdf
 * - Sheets: .xlsx, .ods, .csv, .tsv, .html, .json, .pdf
 * - Slides: .pptx, .odp, .html, .txt, .json, .pdf
 * - Forms: .csv, .html, .json
 */

// ---------------------- DOCUMENT FORMATS (WRITER) ----------------------

export function exportToDocx(doc: WriterDocument): string {
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

export function exportToOdt(doc: WriterDocument): string {
  const title = doc.meta.title || 'Document';
  return `<?xml version="1.0" encoding="UTF-8"?>
<office:document xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
 xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"
 xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0"
 office:version="1.3" office:mimetype="application/vnd.oasis.opendocument.text">
  <office:body>
    <office:text>
      <text:h text:outline-level="1">${title}</text:h>
      <text:p>${doc.contentHtml.replace(/<[^>]+>/g, ' ').trim()}</text:p>
    </office:text>
  </office:body>
</office:document>`;
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

export function exportToHtmlDoc(doc: WriterDocument): string {
  const title = doc.meta.title || 'Document';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      max-width: 800px;
      margin: 40px auto;
      padding: 0 20px;
      line-height: 1.6;
      color: #1e293b;
    }
    h1, h2, h3 { color: #0f172a; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; }
    th, td { border: 1px solid #cbd5e1; padding: 8px 12px; }
    th { background: #f8fafc; font-weight: 600; }
    blockquote { border-left: 4px solid #3b82f6; margin-left: 0; padding-left: 16px; color: #475569; }
  </style>
</head>
<body>
  ${doc.contentHtml}
</body>
</html>`;
}

export function exportToEpub(doc: WriterDocument): string {
  const title = doc.meta.title || 'Document';
  return `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en">
<head>
  <title>${title}</title>
  <style>
    body { font-family: serif; line-height: 1.5; margin: 5%; }
    h1 { text-align: center; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  ${doc.contentHtml}
</body>
</html>`;
}

export function parseDocumentContent(raw: string, filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  
  if (ext === 'docx' || ext === 'doc' || ext === 'html' || ext === 'htm' || ext === 'odt') {
    if (raw.includes('<body') || raw.includes('<div') || raw.includes('<p>')) {
      const bodyMatch = raw.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      return bodyMatch ? bodyMatch[1] : raw;
    }
  } else if (ext === 'md' || ext === 'markdown') {
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

export function exportToOds(workbook: SpreadsheetWorkbook): string {
  const activeSheet = workbook.sheets.find(s => s.id === workbook.activeSheetId) || workbook.sheets[0];
  let tableRows = '';
  for (let r = 0; r < activeSheet.rowCount; r++) {
    let rowCells = '';
    for (let c = 0; c < activeSheet.colCount; c++) {
      const key = `${colToLetter(c)}${r + 1}`;
      const cell = activeSheet.cells[key];
      const val = cell?.computed ?? '';
      rowCells += `<table:table-cell office:value-type="string"><text:p>${String(val).replace(/&/g, '&amp;')}</text:p></table:table-cell>`;
    }
    tableRows += `<table:table-row>${rowCells}</table:table-row>`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<office:document xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
 xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0"
 xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"
 office:version="1.3" office:mimetype="application/vnd.oasis.opendocument.spreadsheet">
  <office:body>
    <office:spreadsheet>
      <table:table table:name="${activeSheet.name}">
        ${tableRows}
      </table:table>
    </office:spreadsheet>
  </office:body>
</office:document>`;
}

export function exportToCsv(workbook: SpreadsheetWorkbook): string {
  const activeSheet = workbook.sheets.find(s => s.id === workbook.activeSheetId) || workbook.sheets[0];
  const lines: string[] = [];

  // Determine max row and column with data
  let maxR = 0;
  let maxC = 0;
  for (const k of Object.keys(activeSheet.cells)) {
    const colMatch = k.match(/[A-Z]+/);
    const rowMatch = k.match(/\d+/);
    if (colMatch && rowMatch) {
      const r = parseInt(rowMatch[0], 10);
      let c = 0;
      for (let i = 0; i < colMatch[0].length; i++) {
        c = c * 26 + (colMatch[0].charCodeAt(i) - 64);
      }
      if (r > maxR) maxR = r;
      if (c > maxC) maxC = c;
    }
  }

  if (maxR === 0) maxR = Math.min(20, activeSheet.rowCount);
  if (maxC === 0) maxC = Math.min(10, activeSheet.colCount);

  for (let r = 0; r < maxR; r++) {
    const rowValues: string[] = [];
    for (let c = 0; c < maxC; c++) {
      const key = `${colToLetter(c)}${r + 1}`;
      const cell = activeSheet.cells[key];
      const val = cell?.computed !== undefined && cell?.computed !== null ? String(cell.computed) : '';
      if (val.includes(',') || val.includes('"') || val.includes('\n') || val.includes('\r')) {
        rowValues.push(`"${val.replace(/"/g, '""')}"`);
      } else {
        rowValues.push(val);
      }
    }
    lines.push(rowValues.join(','));
  }

  return lines.join('\r\n');
}

export function exportToTsv(workbook: SpreadsheetWorkbook): string {
  const activeSheet = workbook.sheets.find(s => s.id === workbook.activeSheetId) || workbook.sheets[0];
  const lines: string[] = [];

  let maxR = 0;
  let maxC = 0;
  for (const k of Object.keys(activeSheet.cells)) {
    const colMatch = k.match(/[A-Z]+/);
    const rowMatch = k.match(/\d+/);
    if (colMatch && rowMatch) {
      const r = parseInt(rowMatch[0], 10);
      let c = 0;
      for (let i = 0; i < colMatch[0].length; i++) {
        c = c * 26 + (colMatch[0].charCodeAt(i) - 64);
      }
      if (r > maxR) maxR = r;
      if (c > maxC) maxC = c;
    }
  }

  if (maxR === 0) maxR = Math.min(20, activeSheet.rowCount);
  if (maxC === 0) maxC = Math.min(10, activeSheet.colCount);

  for (let r = 0; r < maxR; r++) {
    const rowValues: string[] = [];
    for (let c = 0; c < maxC; c++) {
      const key = `${colToLetter(c)}${r + 1}`;
      const cell = activeSheet.cells[key];
      const val = cell?.computed !== undefined && cell?.computed !== null ? String(cell.computed) : '';
      rowValues.push(val.replace(/\t/g, ' '));
    }
    lines.push(rowValues.join('\t'));
  }

  return lines.join('\r\n');
}

export function exportToHtmlSpreadsheet(workbook: SpreadsheetWorkbook): string {
  const activeSheet = workbook.sheets.find(s => s.id === workbook.activeSheetId) || workbook.sheets[0];
  let tableHtml = '<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-family:sans-serif;font-size:12px;width:100%;">';
  
  for (let r = 0; r < Math.min(50, activeSheet.rowCount); r++) {
    tableHtml += '<tr>';
    for (let c = 0; c < Math.min(26, activeSheet.colCount); c++) {
      const key = `${colToLetter(c)}${r + 1}`;
      const cell = activeSheet.cells[key];
      const val = cell?.computed ?? '';
      const tag = r === 0 ? 'th' : 'td';
      const bg = r === 0 ? 'background:#f1f5f9;font-weight:bold;' : '';
      tableHtml += `<${tag} style="${bg}border:1px solid #cbd5e1;padding:6px 10px;">${String(val)}</${tag}>`;
    }
    tableHtml += '</tr>';
  }
  tableHtml += '</table>';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${workbook.meta.title}</title>
</head>
<body style="padding:20px;font-family:sans-serif;">
  <h2>${workbook.meta.title} - ${activeSheet.name}</h2>
  ${tableHtml}
</body>
</html>`;
}

export function parseSpreadsheetContent(raw: string, filename: string): Record<string, any> {
  const ext = filename.split('.').pop()?.toLowerCase();

  // If raw content starts with PK or [Content_Types].xml, it is a binary zip archive
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

export function exportToOdp(deck: SlideDeck): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<office:document xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
 xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0"
 xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"
 office:version="1.3" office:mimetype="application/vnd.oasis.opendocument.presentation">
  <office:body>
    <office:presentation>
      ${deck.slides.map((s, idx) => `
        <draw:page draw:name="Slide ${idx + 1}">
          <text:p>${s.title}</text:p>
          ${s.elements.map(e => `<text:p>${e.content.replace(/<[^>]+>/g, '')}</text:p>`).join('')}
        </draw:page>
      `).join('\n')}
    </office:presentation>
  </office:body>
</office:document>`;
}

export function exportToHtmlPresentation(deck: SlideDeck): string {
  const slidesJson = JSON.stringify(deck.slides);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${deck.meta.title} - Presentation</title>
  <style>
    body, html { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    #viewport { width: 100vw; height: 100vh; display: flex; align-items: center; justify-content: center; }
    #slide-container { width: 90vw; max-width: 1280px; aspect-ratio: 16/9; background: white; border-radius: 12px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); position: relative; overflow: hidden; padding: 48px; box-sizing: border-box; }
    .slide-title { font-size: 36px; font-weight: bold; margin-bottom: 24px; color: #1e293b; }
    .slide-body { font-size: 20px; line-height: 1.6; color: #334155; }
    #nav { position: fixed; bottom: 20px; right: 20px; display: flex; gap: 8px; z-index: 100; }
    .btn { background: rgba(255,255,255,0.2); color: white; border: none; padding: 8px 16px; border-radius: 8px; cursor: pointer; font-size: 14px; backdrop-filter: blur(8px); }
    .btn:hover { background: rgba(255,255,255,0.3); }
    #counter { position: fixed; bottom: 20px; left: 20px; color: rgba(255,255,255,0.6); font-family: monospace; font-size: 14px; }
  </style>
</head>
<body>
  <div id="viewport">
    <div id="slide-container">
      <div id="slide-content"></div>
    </div>
  </div>
  <div id="counter"></div>
  <div id="nav">
    <button class="btn" onclick="prev()">Previous</button>
    <button class="btn" onclick="next()">Next</button>
    <button class="btn" onclick="document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()">Fullscreen</button>
  </div>
  <script>
    const slides = ${slidesJson};
    let current = 0;
    function render() {
      const s = slides[current];
      const container = document.getElementById('slide-container');
      container.style.backgroundColor = s.bgColor || '#ffffff';
      let html = '<div class=\"slide-title\">' + (s.title || '') + '</div><div class=\"slide-body\">';
      if (s.elements) {
        s.elements.forEach(e => {
          html += '<div>' + e.content + '</div>';
        });
      }
      html += '</div>';
      document.getElementById('slide-content').innerHTML = html;
      document.getElementById('counter').innerText = 'Slide ' + (current + 1) + ' of ' + slides.length;
    }
    function next() { if (current < slides.length - 1) { current++; render(); } }
    function prev() { if (current > 0) { current--; render(); } }
    window.addEventListener('keydown', e => {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') next();
      if (e.key === 'ArrowLeft') prev();
    });
    render();
  </script>
</body>
</html>`;
}

export function exportToTextPresentation(deck: SlideDeck): string {
  let text = `# ${deck.meta.title}\n\n`;
  deck.slides.forEach((s, idx) => {
    text += `--- Slide ${idx + 1}: ${s.title} ---\n`;
    s.elements.forEach(e => {
      const clean = e.content.replace(/<[^>]+>/g, '').trim();
      if (clean) text += `${clean}\n`;
    });
    if (s.notes) {
      text += `\nSpeaker Notes: ${s.notes}\n`;
    }
    text += '\n\n';
  });
  return text;
}

// ---------------------- FORMS FORMATS ----------------------

export function exportFormToCsv(form: any): string {
  const headers = ['Timestamp', ...form.questions.map((q: any) => `"${q.title.replace(/"/g, '""')}"`)];
  const rows: string[] = [headers.join(',')];

  if (form.responses && form.responses.length > 0) {
    form.responses.forEach((resp: any) => {
      const row = [
        resp.submittedAt || new Date().toISOString(),
        ...form.questions.map((q: any) => {
          const ans = resp.answers?.[q.id] ?? '';
          return `"${String(ans).replace(/"/g, '""')}"`;
        })
      ];
      rows.push(row.join(','));
    });
  }

  return rows.join('\r\n');
}

export function exportFormToHtml(form: any): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${form.title || 'Form'}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #ede7f6; margin: 0; padding: 24px; color: #1e293b; }
    .card { background: white; border-radius: 12px; padding: 24px; max-width: 640px; margin: 0 auto 16px auto; box-shadow: 0 1px 3px rgba(0,0,0,0.1); border-top: 8px solid #673ab7; }
    .question { background: white; border-radius: 8px; padding: 20px; max-width: 640px; margin: 0 auto 16px auto; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    h1 { margin: 0 0 8px 0; color: #1e293b; font-size: 26px; }
    p { margin: 0; color: #64748b; font-size: 14px; }
    label { display: block; font-weight: 600; margin-bottom: 8px; font-size: 15px; }
    input[type="text"], textarea, select { width: 100%; padding: 10px; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box; font-size: 14px; }
    .btn { background: #673ab7; color: white; border: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; cursor: pointer; display: block; margin: 24px auto; font-size: 15px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${form.title || 'Untitled Form'}</h1>
    <p>${form.description || ''}</p>
  </div>
  <form onsubmit="alert('Response recorded offline in browser!'); return false;">
    ${form.questions.map((q: any) => `
      <div class="question">
        <label>${q.title} ${q.required ? '<span style="color:#ef4444">*</span>' : ''}</label>
        ${q.type === 'paragraph' ? `<textarea rows="4" placeholder="Your answer" ${q.required ? 'required' : ''}></textarea>` :
          q.type === 'multiple_choice' ? (q.options || []).map((opt: string) => `<div style="margin: 6px 0;"><label style="font-weight:normal;"><input type="radio" name="${q.id}" value="${opt}" ${q.required ? 'required' : ''}> ${opt}</label></div>`).join('') :
          q.type === 'checkboxes' ? (q.options || []).map((opt: string) => `<div style="margin: 6px 0;"><label style="font-weight:normal;"><input type="checkbox" name="${q.id}" value="${opt}"> ${opt}</label></div>`).join('') :
          `<input type="text" placeholder="Your answer" ${q.required ? 'required' : ''}>`}
      </div>
    `).join('')}
    <button type="submit" class="btn">Submit Response</button>
  </form>
</body>
</html>`;
}
