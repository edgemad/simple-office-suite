import { describe, expect, it } from 'vitest';
import type { DocumentMeta, SlideDeck, SpreadsheetWorkbook, WriterDocument } from '../types';
import {
  exportToDocx,
  exportToPptxXml,
  exportToRtf,
  exportToXlsx,
  parseDocumentContent,
  sanitizeImportedSlideDeck,
  sanitizeImportedWriterDocument,
  sanitizePageSetup,
  sanitizeImportedWorkbook,
  sanitizeCellValue,
} from './fileFormats';

const meta: DocumentMeta = {
  id: 'doc_test',
  title: 'Test Document',
  isDirty: false,
  mode: 'writer',
};

function writerDoc(contentHtml: string, title = 'Test Document'): WriterDocument {
  return {
    meta: { ...meta, title },
    contentHtml,
    contentMarkdown: '',
    wordCount: 0,
    charCount: 0,
    pageCount: 1,
  };
}

describe('parseDocumentContent', () => {
  it('sanitizes imported html documents', () => {
    const hostile = [
      '<html><head><title>Report</title><script>alert(1)</script></head>',
      '<body><h1>Quarterly Report</h1>',
      '<p onclick="alert(2)">Revenue rose <strong>12%</strong></p>',
      '<a href="javascript:alert(3)">click</a>',
      '<img src="x" onerror="alert(4)">',
      '<iframe src="https://evil.example"></iframe>',
      '</body></html>',
    ].join('');

    const clean = parseDocumentContent(hostile, 'report.html');

    expect(clean).toContain('<h1>Quarterly Report</h1>');
    expect(clean).toContain('<strong>12%</strong>');
    expect(clean).not.toMatch(/<script/i);
    expect(clean).not.toMatch(/<iframe/i);
    expect(clean).not.toMatch(/onclick/i);
    expect(clean).not.toMatch(/onerror/i);
    expect(clean).not.toMatch(/javascript:/i);
    expect(clean).not.toMatch(/<title/i);
    expect(clean).not.toMatch(/evil\.example/);
  });

  it('keeps formatting from imported word style html', () => {
    const wordHtml = '<body><h1 style="color:#0f172a">Title</h1><p style="text-align:justify">Body <em>text</em></p><table border="1"><tr><td>cell</td></tr></table></body>';

    const clean = parseDocumentContent(wordHtml, 'legacy.docx');

    expect(clean).toContain('<h1 style="color: #0f172a">Title</h1>');
    expect(clean).toContain('<em>text</em>');
    expect(clean).toContain('<td>cell</td>');
  });

  it('escapes markup in plain text imports', () => {
    const clean = parseDocumentContent('<script>alert(1)</script>\nsecond line', 'notes.txt');

    expect(clean).not.toMatch(/<script/i);
    expect(clean).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(clean).toContain('<p>second line</p>');
  });

  it('keeps markdown formatting but drops embedded markup', () => {
    const md = '# Title\n\n**bold** and *italic*\n\n- item one\n- item two\n\n<img src=x onerror=alert(1)>';

    const clean = parseDocumentContent(md, 'notes.md');

    expect(clean).toContain('<h1>Title</h1>');
    expect(clean).toContain('<strong>bold</strong>');
    expect(clean).toContain('<em>italic</em>');
    expect(clean).toContain('<li>item one</li>');
    expect(clean).not.toMatch(/onerror/i);
  });

  it('escapes markup in rtf imports', () => {
    const clean = parseDocumentContent('{\\rtf1\\ansi <script>alert(1)</script>}', 'legacy.rtf');

    expect(clean).not.toMatch(/<script/i);
    expect(clean).toContain('&lt;script&gt;');
  });
});

describe('exportToDocx', () => {
  it('escapes the title and sanitizes document content', () => {
    const output = exportToDocx(writerDoc('<p>Body</p><script>alert(1)</script><img src="javascript:alert(2)">', '"><script>alert(3)</script>'));

    expect(output).toContain('<title>&quot;&gt;&lt;script&gt;alert(3)&lt;/script&gt;</title>');
    expect(output).toContain('<p>Body</p>');
    expect(output).not.toMatch(/<script>alert\(1\)/);
    expect(output).not.toMatch(/javascript:/i);
  });
});

describe('exportToRtf', () => {
  it('escapes rtf control characters from document text', () => {
    const output = exportToRtf(writerDoc('<p>Balance \\{0} } \\f0\\fs44 </p>'));
    const bodyLine = output.split('\n')[2] ?? '';

    expect(output).toContain(String.raw`Balance \\\{0\} \} \\f0\\fs44`);
    expect(bodyLine).not.toMatch(/(?<!\\)\\(?!par\b)[a-z]+/);
  });

  it('keeps bold, italic and bullet formatting', () => {
    const output = exportToRtf(writerDoc('<h1>Title</h1><p><strong>b</strong><em>i</em></p><ul><li>one</li></ul>'));

    expect(output).toContain('\\b b\\b0');
    expect(output).toContain('\\i i\\i0');
    expect(output).toContain('\\bullet');
    expect(output).toContain('\\fs28');
  });

  it('drops scripts from exported documents', () => {
    const output = exportToRtf(writerDoc('<p>ok</p><script>alert(1)</script>'));

    expect(output).not.toMatch(/alert\(1\)/);
    expect(output).toContain('ok');
  });
});

describe('exportToXlsx', () => {
  const workbook: SpreadsheetWorkbook = {
    meta: { ...meta, mode: 'sheets' },
    activeSheetId: 's1',
    sheets: [
      {
        id: 's1',
        name: 'Sheet "1"><script>alert(1)</script>',
        rowCount: 2,
        colCount: 2,
        cells: {
          A1: { raw: 'Name', computed: 'Name' },
          B1: { raw: '=CONCAT("</Data><script>alert(1)</script>")', computed: '</Data><script>alert(1)</script>' },
        },
      },
    ],
  };

  it('escapes sheet names and cell values', () => {
    const output = exportToXlsx(workbook);

    expect(output).toMatch(/<Worksheet ss:Name="Sheet &quot;1&quot;&gt;&lt;script&gt;alert\(1\)&lt;\/script&gt;">/);
    expect(output).toContain('&lt;/Data&gt;&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(output).not.toMatch(/ss:Name="Sheet "1"/);
  });
});

describe('exportToPptxXml', () => {
  const deck: SlideDeck = {
    meta: { ...meta, title: 'Deck"><script>alert(1)</script>', mode: 'slides' },
    aspectRatio: '16:9',
    slides: [
      {
        id: 's1',
        title: 'Q3" results',
        bgColor: '#ffffff',
        notes: 'notes ]]> breakout',
        elements: [
          {
            id: 'e1" onload="alert(1)',
            type: 'title',
            x: 10,
            y: 20,
            width: 80,
            height: 15,
            content: 'payload ]]> escape',
          },
        ],
      },
    ],
  };

  it('escapes attributes and cdata payloads', () => {
    const output = exportToPptxXml(deck);

    expect(output).toContain('title="Deck&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;"');
    expect(output).toContain('id="e1&quot; onload=&quot;alert(1)"');
    expect(output).toContain('title="Q3&quot; results"');
    expect(output).toContain(']]]]><![CDATA[> escape');
    expect(output).not.toMatch(/onload="alert\(1\)"/);
  });
});

describe('page setup persistence', () => {
  it('round-trips a valid page setup, columns and watermark', () => {
    const imported = sanitizeImportedWriterDocument(
      {
        meta: { id: 'doc', title: 'Layout' },
        contentHtml: '<p>Hi</p>',
        pageSetup: { margin: 'wide', orientation: 'landscape', size: 'legal' },
        columns: 2,
        watermark: 'DRAFT',
      },
      meta,
    );

    expect(imported.pageSetup).toEqual({ margin: 'wide', orientation: 'landscape', size: 'legal' });
    expect(imported.columns).toBe(2);
    expect(imported.watermark).toBe('DRAFT');
  });

  it('falls back to safe layout defaults for hostile values', () => {
    const imported = sanitizeImportedWriterDocument(
      {
        meta: { id: 'doc', title: 'Layout' },
        contentHtml: '<p>Hi</p>',
        pageSetup: { margin: 'drop table', orientation: 'sideways', size: 'a0' },
        columns: 99,
        watermark: 'x'.repeat(200),
      },
      meta,
    );

    expect(imported.pageSetup).toEqual({ margin: 'normal', orientation: 'portrait', size: 'a4' });
    expect(imported.columns).toBe(3);
    expect(imported.watermark).toHaveLength(40);
  });

  it('supplies defaults when layout fields are missing entirely', () => {
    const imported = sanitizeImportedWriterDocument({ meta: { id: 'doc', title: 'Layout' } }, meta);
    expect(imported.pageSetup).toEqual({ margin: 'normal', orientation: 'portrait', size: 'a4' });
    expect(imported.columns).toBe(1);
    expect(imported.watermark).toBe('');
  });

  it('ignores non-object page setup input', () => {
    expect(sanitizePageSetup('wide')).toEqual({ margin: 'normal', orientation: 'portrait', size: 'a4' });
    expect(sanitizePageSetup(null).size).toBe('a4');
  });
});

describe('sanitizeImportedWriterDocument', () => {
  it('normalizes untrusted json documents', () => {
    const imported = sanitizeImportedWriterDocument(
      {
        meta: { id: 'hacked', title: 'Report', filePath: '/tmp/report.json' },
        contentHtml: '<h1>Report</h1><script>alert(1)</script><a href="javascript:alert(2)">x</a>',
        contentMarkdown: '# Report',
        wordCount: 'many',
        charCount: 12,
        pageCount: 3,
        pageSize: 'weird',
        unexpected: { nested: true },
      },
      meta,
    );

    expect(imported.contentHtml).toContain('<h1>Report</h1>');
    expect(imported.contentHtml).not.toMatch(/<script/i);
    expect(imported.contentHtml).not.toMatch(/javascript:/i);
    expect(imported.wordCount).toBe(0);
    expect(imported.charCount).toBe(12);
    expect(imported.pageCount).toBe(3);
    expect(imported.pageSize).toBe('a4');
    expect(imported.meta.id).toBe('hacked');
    expect(imported.meta.mode).toBe('writer');
    expect(imported.meta.isDirty).toBe(false);
  });

  it('falls back safely for malformed json payloads', () => {
    const imported = sanitizeImportedWriterDocument(null, meta);

    expect(imported.contentHtml).toBe('');
    expect(imported.meta.title).toBe('Test Document');
    expect(imported.meta.id).toBe('doc_test');
  });
});

describe('sanitizeImportedSlideDeck', () => {
  it('rejects payloads without a slide array', () => {
    expect(sanitizeImportedSlideDeck({ slides: 'nope' }, meta)).toBeNull();
    expect(sanitizeImportedSlideDeck(null, meta)).toBeNull();
    expect(sanitizeImportedSlideDeck('nope', meta)).toBeNull();
  });

  it('normalizes untrusted slide payloads', () => {
    const deck = sanitizeImportedSlideDeck(
      {
        aspectRatio: 'bogus',
        slides: [
          { title: 42, elements: [{ type: 'title', content: 7, x: '10' }, null] },
          'garbage',
        ],
      },
      meta,
    );

    expect(deck).not.toBeNull();
    expect(deck?.aspectRatio).toBe('16:9');
    expect(deck?.slides).toHaveLength(1);
    expect(deck?.slides[0].title).toBe('Slide 1');
    expect(deck?.slides[0].bgColor).toBe('#ffffff');
    expect(deck?.slides[0].elements).toHaveLength(1);
    expect(deck?.slides[0].elements[0].content).toBe('');
    expect(deck?.slides[0].elements[0].x).toBe(0);
    expect(deck?.meta.mode).toBe('slides');
  });
});

describe('sanitizeImportedWorkbook', () => {
  const sheet = {
    id: 'sheet_1',
    name: 'Budget',
    cells: {
      A1: { raw: 'Item', computed: 'Item', format: { bold: true, align: 'center', fontSize: 14 } },
      A2: { raw: 'Rent', computed: 'Rent', format: { bgColor: '#fee2e2', wrap: true, border: 'all' } },
    },
    rowCount: 200,
    colCount: 26,
    frozenRows: 1,
    validation: { target: 'C2:C50', items: ['Yes', 'No'] },
    mergedRanges: [{ startCol: 0, startRow: 3, endCol: 2, endRow: 3 }],
    charts: [{ id: 'c1', type: 'bar', title: 'Spend', range: 'A1:B5', valueCol: 1 }],
    conditionalRules: [{ id: 'r1', range: 'A1:A9', condition: 'greaterThan', value: '100', bgColor: '#fecaca', textColor: '#7f1d1d' }],
  };

  it('keeps formatting, merges, validation, charts and frozen panes', () => {
    const wb = sanitizeImportedWorkbook({ meta: { title: 'Budget' }, activeSheetId: 'sheet_1', sheets: [sheet] }, meta);
    expect(wb).not.toBeNull();
    const loaded = wb!.sheets[0];
    expect(loaded.cells.A1.format).toMatchObject({ bold: true, align: 'center', fontSize: 14 });
    expect(loaded.cells.A2.format).toMatchObject({ wrap: true, border: 'all', bgColor: '#fee2e2' });
    expect(loaded.frozenRows).toBe(1);
    expect(loaded.mergedRanges).toEqual([{ startCol: 0, startRow: 3, endCol: 2, endRow: 3 }]);
    expect(loaded.validation).toEqual({ target: 'C2:C50', items: ['Yes', 'No'], allowBlank: true });
    expect(loaded.charts).toHaveLength(1);
    expect(loaded.conditionalRules).toHaveLength(1);
  });

  it('rejects a payload that is not a workbook', () => {
    expect(sanitizeImportedWorkbook(null, meta)).toBeNull();
    expect(sanitizeImportedWorkbook({ sheets: [] }, meta)).toBeNull();
    expect(sanitizeImportedWorkbook({ sheets: 'nope' }, meta)).toBeNull();
  });

  it('drops cells outside the declared sheet bounds', () => {
    const wb = sanitizeImportedWorkbook(
      { sheets: [{ ...sheet, rowCount: 3, colCount: 2, cells: { A1: { raw: 'ok', computed: 'ok' }, Z9: { raw: 'out', computed: 'out' } } }] },
      meta,
    );
    expect(Object.keys(wb!.sheets[0].cells)).toEqual(['A1']);
  });

  it('ignores malformed keys, colors, ranges and rules', () => {
    const wb = sanitizeImportedWorkbook(
      {
        sheets: [
          {
            ...sheet,
            name: '   ',
            cells: {
              A1: { raw: 'x', computed: 'x', format: { bgColor: 'url(javascript:alert(1))', border: 'evil' } },
              '<script>': { raw: 'bad', computed: 'bad' },
            },
            mergedRanges: [{ startCol: 999, startRow: 0, endCol: 1000, endRow: 0 }],
            validation: { target: 'not a range', items: ['a'] },
            charts: [{ type: 'bar', range: 'DROP TABLE', valueCol: 1 }],
            conditionalRules: [{ range: 'A1', condition: 'execute' }],
          },
        ],
      },
      meta,
    );
    const loaded = wb!.sheets[0];
    expect(loaded.name).toBe('Sheet1');
    expect(loaded.cells.A1.format).toBeUndefined();
    expect(loaded.cells['<script>']).toBeUndefined();
    expect(loaded.mergedRanges).toBeUndefined();
    expect(loaded.validation).toBeUndefined();
    expect(loaded.charts).toBeUndefined();
    expect(loaded.conditionalRules).toBeUndefined();
  });

  it('caps oversized geometry instead of allocating it', () => {
    const wb = sanitizeImportedWorkbook({ sheets: [{ ...sheet, rowCount: 1e9, colCount: 5000 }] }, meta);
    expect(wb!.sheets[0].rowCount).toBeLessThanOrEqual(20000);
    expect(wb!.sheets[0].colCount).toBeLessThanOrEqual(256);
  });
});

describe('sanitizeCellValue', () => {
  it('coerces missing fields into a usable cell', () => {
    expect(sanitizeCellValue(null)).toEqual({ raw: '', computed: '' });
  });

  it('clamps an absurd font size', () => {
    expect(sanitizeCellValue({ raw: 'a', computed: 'a', format: { fontSize: 900 } }).format?.fontSize).toBe(96);
  });

  it('rejects a javascript url passed as a color', () => {
    expect(sanitizeCellValue({ raw: 'a', computed: 'a', format: { textColor: 'javascript:alert(1)' } }).format).toBeUndefined();
  });
});

describe('xlsx layout export', () => {
  it('writes merged regions and a frozen pane', () => {
    const xml = exportToXlsx({
      meta: { id: 'wb', title: 'Budget', isDirty: false, mode: 'sheets' },
      activeSheetId: 'sheet_1',
      sheets: [
        {
          id: 'sheet_1',
          name: 'Budget',
          cells: { A1: { raw: 'Total', computed: 'Total' } },
          rowCount: 20,
          colCount: 6,
          frozenRows: 1,
          mergedRanges: [{ startCol: 0, startRow: 0, endCol: 2, endRow: 0 }],
        },
      ],
    });
    expect(xml).toContain('<MergeCell ss:Ref="A1:C1"/>');
    expect(xml).toContain('<FreezePanes/>');
    expect(xml).toContain('<TopRowBottomPane>1</TopRowBottomPane>');
  });

  it('omits layout elements when there is nothing to describe', () => {
    const xml = exportToXlsx({
      meta: { id: 'wb', title: 'Plain', isDirty: false, mode: 'sheets' },
      activeSheetId: 'sheet_1',
      sheets: [{ id: 'sheet_1', name: 'Plain', cells: {}, rowCount: 5, colCount: 5 }],
    });
    expect(xml).not.toContain('MergeCells');
    expect(xml).not.toContain('FreezePanes');
  });
});
