import { describe, expect, it } from 'vitest';
import { countWordsAndChars, htmlToMarkdown } from './utils';

describe('htmlToMarkdown', () => {
  it('converts untrusted html to markdown', () => {
    const markdown = htmlToMarkdown('<h1>Title</h1><p><strong>bold</strong> and <em>italic</em></p><ul><li>one</li></ul>');

    expect(markdown).toContain('# Title');
    expect(markdown).toContain('**bold**');
    expect(markdown).toContain('*italic*');
    expect(markdown).toContain('- one');
  });

  it('never creates executable nodes from untrusted html', () => {
    const markdown = htmlToMarkdown(
      '<script>window.__mdXss = true</script><img src="x" onerror="window.__mdXss = true"><a href="javascript:window.__mdXss=true">x</a><p>safe</p>'
    );

    expect(markdown).not.toMatch(/<script/i);
    expect(markdown).not.toMatch(/<img/i);
    expect(markdown).not.toMatch(/onerror/i);
    expect(markdown).not.toMatch(/javascript:/i);
    expect(markdown).toContain('safe');
  });

  it('returns text without markup for malformed input', () => {
    expect(htmlToMarkdown('')).toBe('');
    expect(htmlToMarkdown('<p>only text')).toContain('only text');
  });
});

describe('countWordsAndChars', () => {
  it('counts words and characters', () => {
    expect(countWordsAndChars('one two three')).toEqual({ words: 3, chars: 13 });
    expect(countWordsAndChars('   ')).toEqual({ words: 0, chars: 0 });
  });
});
