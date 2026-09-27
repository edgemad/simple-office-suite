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
