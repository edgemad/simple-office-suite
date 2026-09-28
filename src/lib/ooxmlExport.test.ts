import { describe, expect, it } from 'vitest';
import { columnLetters, htmlToParagraphs } from './ooxmlExport';

describe('htmlToParagraphs', () => {
  it('splits block elements into separate paragraphs', () => {
    expect(htmlToParagraphs('<p>One</p><p>Two</p>')).toEqual(['One', 'Two']);
  });

  it('keeps interior blank lines, which are real paragraph breaks', () => {
    expect(htmlToParagraphs('<p>One</p><p></p><p>Two</p>')).toEqual(['One', '', 'Two']);
  });

  it('strips inline formatting but keeps the text', () => {
    expect(htmlToParagraphs('<p>Hello <strong>bold</strong> world</p>')).toEqual([
      'Hello bold world',
    ]);
  });

  it('decodes entities so the text is not left escaped', () => {
    expect(htmlToParagraphs('<p>a &amp; b &lt;c&gt; &quot;d&quot;</p>')).toEqual([
      'a & b <c> "d"',
    ]);
  });

  it('turns line breaks into paragraph breaks', () => {
    expect(htmlToParagraphs('One<br>Two')).toEqual(['One', 'Two']);
  });

  it('handles headings and list items', () => {
    expect(htmlToParagraphs('<h1>Title</h1><ul><li>Point</li></ul>')).toEqual(['Title', 'Point']);
  });

  it('returns nothing for empty content', () => {
    expect(htmlToParagraphs('')).toEqual([]);
  });
});

describe('columnLetters', () => {
  it('follows the spreadsheet convention', () => {
    expect(columnLetters(0)).toBe('A');
    expect(columnLetters(25)).toBe('Z');
    expect(columnLetters(26)).toBe('AA');
    expect(columnLetters(51)).toBe('AZ');
    expect(columnLetters(52)).toBe('BA');
    expect(columnLetters(701)).toBe('ZZ');
    expect(columnLetters(702)).toBe('AAA');
  });
});
