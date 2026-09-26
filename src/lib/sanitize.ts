import DOMPurify from 'dompurify';
import type { Config, DOMPurify as DOMPurifyInstance } from 'dompurify';

export type SanitizedUrlKind = 'link' | 'image';

const ALLOWED_TAGS = [
  'a', 'abbr', 'address', 'article', 'aside', 'b', 'bdi', 'bdo', 'blockquote', 'br',
  'caption', 'center', 'cite', 'code', 'col', 'colgroup', 'dd', 'del', 'div', 'dl', 'dt',
  'em', 'figcaption', 'figure', 'font', 'footer', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'header', 'hgroup', 'hr', 'i', 'img', 'ins', 'kbd', 'li', 'main', 'mark', 'nav', 'ol',
  'p', 'pre', 'q', 's', 'samp', 'section', 'small', 'span', 'strike', 'strong', 'sub',
  'sup', 'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'time', 'tr', 'u', 'ul', 'var',
  'wbr'
];

const ALLOWED_ATTR = [
  'align', 'alt', 'bgcolor', 'border', 'cellpadding', 'cellspacing', 'cite', 'class',
  'color', 'colspan', 'datetime', 'decoding', 'dir', 'face', 'height', 'href', 'hreflang',
  'lang', 'loading', 'rel', 'reversed', 'rowspan', 'scope', 'size', 'span',
  'src', 'start', 'style', 'target', 'title', 'type', 'valign', 'width'
];

const FORBIDDEN_TAGS = [
  'script', 'style', 'iframe', 'frame', 'frameset', 'object', 'embed', 'applet', 'form',
  'input', 'button', 'select', 'option', 'optgroup', 'textarea', 'fieldset', 'legend',
  'label', 'output', 'progress', 'meter', 'dialog', 'menu', 'menuitem', 'link', 'meta',
  'base', 'title', 'head', 'html', 'body', 'template', 'slot', 'shadow', 'noscript',
  'noembed', 'noframes', 'plaintext', 'listing', 'xmp', 'bgsound', 'audio', 'video',
  'source', 'track', 'canvas', 'svg', 'math', 'portal', 'marquee', 'keygen', 'isindex',
  'xml', 'animate', 'set', 'foreignobject', 'image', 'use', 'img2', 'annotation-xml'
];

const FORBIDDEN_CONTENTS = [
  'annotation-xml', 'audio', 'canvas', 'colgroup', 'desc', 'embed', 'foreignobject',
  'head', 'iframe', 'math', 'mi', 'mn', 'mo', 'ms', 'mtext', 'noembed', 'noframes',
  'noscript', 'object', 'plaintext', 'script', 'style', 'svg', 'template', 'textarea',
  'title', 'video', 'xmp'
];

const FORBIDDEN_ATTR = [
  'id', 'srcdoc', 'srcset', 'imagesrcset', 'ping', 'action', 'formaction', 'form',
  'formmethod', 'formenctype', 'formtarget', 'formnovalidate', 'xlink:href', 'xlink:show',
  'xmlns', 'xmlns:xlink', 'dynsrc', 'lowsrc', 'background', 'data', 'http-equiv',
  'content', 'is', 'nonce', 'integrity', 'crossorigin', 'sandbox', 'allow', 'allowfullscreen'
];

const SAFE_LINK_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:']);
const SAFE_IMAGE_PROTOCOLS = new Set(['http:', 'https:', 'blob:']);
const SAFE_DATA_IMAGE_URL = /^data:image\/(?:png|jpe?g|gif|webp|bmp|avif|apng|x-icon|vnd\.microsoft\.icon)\s*;\s*base64\s*,[A-Za-z0-9+/=]+$/i;
const URL_SCHEME_PATTERN = /^([a-z][a-z0-9+.\-]*):/i;
const URL_CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\ufeff]/g;

const ALLOWED_CSS_PROPERTIES = new Set([
  'background', 'background-attachment', 'background-clip', 'background-color',
  'background-image', 'background-origin', 'background-position', 'background-repeat',
  'background-size', 'border', 'border-bottom', 'border-bottom-color',
  'border-bottom-left-radius', 'border-bottom-right-radius', 'border-bottom-style',
  'border-bottom-width', 'border-collapse', 'border-color', 'border-left', 'border-left-color',
  'border-left-style', 'border-left-width', 'border-radius', 'border-right',
  'border-right-color', 'border-right-style', 'border-right-width', 'border-spacing',
  'border-style', 'border-top', 'border-top-color', 'border-top-left-radius',
  'border-top-right-radius', 'border-top-style', 'border-top-width', 'border-width',
  'box-shadow', 'box-sizing', 'caption-side', 'clear', 'color', 'direction', 'display',
  'empty-cells', 'float', 'font', 'font-family', 'font-size', 'font-style',
  'font-variant', 'font-weight', 'height', 'letter-spacing', 'line-height', 'list-style',
  'list-style-position', 'list-style-type', 'margin', 'margin-bottom', 'margin-left',
  'margin-right', 'margin-top', 'max-height', 'max-width', 'min-height', 'min-width',
  'opacity', 'overflow-wrap', 'padding', 'padding-bottom', 'padding-left', 'padding-right',
  'padding-top', 'table-layout', 'text-align', 'text-decoration', 'text-decoration-color',
  'text-decoration-line', 'text-decoration-style', 'text-indent', 'text-overflow',
  'text-shadow', 'text-transform', 'unicode-bidi', 'vertical-align', 'white-space',
  'width', 'word-break', 'word-spacing', 'word-wrap'
]);

const ALLOWED_CSS_FUNCTIONS = new Set([
  'rgb', 'rgba', 'hsl', 'hsla', 'hwb', 'lab', 'lch', 'oklab', 'oklch', 'calc', 'min', 'max',
  'clamp', 'var', 'counter', 'counters', 'linear-gradient', 'radial-gradient',
  'repeating-linear-gradient', 'repeating-radial-gradient', 'cubic-bezier', 'steps'
]);

const UNSAFE_CSS_VALUE = /[<>\\@{}]|expression|javascript|vbscript|behavior|binding|\/\*|\*\//i;
const CSS_FUNCTION_PATTERN = /([a-z][a-z0-9-]*)\s*\(/gi;

const HTML_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
  '`': '&#96;',
};

const BASE_CONFIG: Config = {
  ALLOWED_TAGS,
  ALLOWED_ATTR,
  ALLOWED_NAMESPACES: ['http://www.w3.org/1999/xhtml'],
  ALLOW_ARIA_ATTR: true,
  ALLOW_DATA_ATTR: false,
  ALLOW_UNKNOWN_PROTOCOLS: false,
  ALLOW_SELF_CLOSE_IN_ATTR: false,
  FORBID_TAGS: FORBIDDEN_TAGS,
  FORBID_ATTR: FORBIDDEN_ATTR,
  FORBID_CONTENTS: FORBIDDEN_CONTENTS,
  KEEP_CONTENT: true,
  RETURN_DOM: false,
  RETURN_DOM_FRAGMENT: false,
  RETURN_TRUSTED_TYPE: false,
  SAFE_FOR_TEMPLATES: false,
  SANITIZE_DOM: true,
  SANITIZE_NAMED_PROPS: true,
  USE_PROFILES: false,
  WHOLE_DOCUMENT: false,
};

let purifierInstance: DOMPurifyInstance | null = null;
let purifierFailed = false;

function hasDom(): boolean {
  return typeof window !== 'undefined' && !!window && typeof window.document !== 'undefined';
}

function asString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return '';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

function registerHooks(instance: DOMPurifyInstance) {
  instance.addHook('uponSanitizeAttribute', (_node, data) => {
    const attrName = (data.attrName || '').toLowerCase();
    const value = typeof data.attrValue === 'string' ? data.attrValue : '';

    if (attrName.startsWith('on')) {
      data.keepAttr = false;
      return;
    }

    if (attrName === 'style') {
      const safeStyle = sanitizeStyleValue(value);
      if (!safeStyle) {
        data.keepAttr = false;
        return;
      }
      data.attrValue = safeStyle;
      return;
    }

    if (attrName === 'href' || attrName === 'cite') {
      if (!isSafeUrl(value, 'link')) data.keepAttr = false;
      return;
    }

    if (attrName === 'src') {
      if (!isSafeUrl(value, 'image')) data.keepAttr = false;
    }
  });
}

function getPurifier(): DOMPurifyInstance | null {
  if (purifierInstance) return purifierInstance;
  if (purifierFailed || !hasDom()) return null;
  try {
    const instance = DOMPurify(window as unknown as Parameters<typeof DOMPurify>[0]);
    registerHooks(instance);
    purifierInstance = instance;
    return instance;
  } catch {
    purifierFailed = true;
    return null;
  }
}

function isAllowedCssProperty(property: string): boolean {
  return ALLOWED_CSS_PROPERTIES.has(property) || property.startsWith('mso-');
}

function isSafeCssValue(value: string): boolean {
  if (UNSAFE_CSS_VALUE.test(value)) return false;
  const matches = value.matchAll(CSS_FUNCTION_PATTERN);
  for (const match of matches) {
    if (!ALLOWED_CSS_FUNCTIONS.has(match[1].toLowerCase())) return false;
  }
  return true;
}

export function escapeHtml(value: unknown): string {
  return asString(value).replace(/[&<>"'`]/g, (char) => HTML_ESCAPE_MAP[char]);
}

function normalizeUrl(value: unknown): string {
  return asString(value).replace(URL_CONTROL_CHARS, '').trim();
}

export function isSafeUrl(value: unknown, kind: SanitizedUrlKind = 'link'): boolean {
  const url = normalizeUrl(value);
  if (!url) return false;
  if (url.startsWith('\\')) return false;
  if (url.startsWith('#')) return kind === 'link';

  const scheme = URL_SCHEME_PATTERN.exec(url);
  if (!scheme) return true;

  const protocol = `${scheme[1].toLowerCase()}:`;
  if (protocol === 'data:') {
    return kind === 'image' && SAFE_DATA_IMAGE_URL.test(url.replace(/\s+/g, ''));
  }
  return kind === 'link' ? SAFE_LINK_PROTOCOLS.has(protocol) : SAFE_IMAGE_PROTOCOLS.has(protocol);
}

export function sanitizeUrl(value: unknown, kind: SanitizedUrlKind = 'link'): string {
  if (!isSafeUrl(value, kind)) return '';
  return normalizeUrl(value);
}

export function sanitizeLinkUrl(value: unknown): string {
  return sanitizeUrl(value, 'link');
}

export function sanitizeImageUrl(value: unknown): string {
  return sanitizeUrl(value, 'image');
}

export function sanitizeStyleValue(value: unknown): string {
  const raw = asString(value);
  if (!raw) return '';

  const declarations: string[] = [];
  for (const chunk of raw.split(';')) {
    const declaration = chunk.trim();
    if (!declaration) continue;

    const separator = declaration.indexOf(':');
    if (separator <= 0) continue;

    const property = declaration.slice(0, separator).trim().toLowerCase();
    const propertyValue = declaration.slice(separator + 1).trim();
    if (!property || !propertyValue) continue;
    if (!isAllowedCssProperty(property)) continue;
    if (!isSafeCssValue(propertyValue)) continue;

    declarations.push(`${property}: ${propertyValue}`);
  }
  return declarations.join('; ');
}

function hardenSanitizedTree(root: ParentNode) {
  root.querySelectorAll('a').forEach((anchor) => {
    const href = anchor.getAttribute('href');
    if (href === null) return;
    const safeHref = sanitizeLinkUrl(href);
    if (!safeHref) {
      anchor.removeAttribute('href');
      return;
    }
    if (anchor.getAttribute('href') !== safeHref) anchor.setAttribute('href', safeHref);
    if (anchor.getAttribute('target')) anchor.setAttribute('rel', 'noopener noreferrer nofollow');
  });

  root.querySelectorAll('img').forEach((image) => {
    const src = image.getAttribute('src');
    if (src === null) return;
    if (!sanitizeImageUrl(src)) {
      image.removeAttribute('src');
      image.removeAttribute('srcset');
    }
  });
}

export function sanitizeHtml(dirty: unknown): string {
  const source = asString(dirty);
  if (!source) return '';

  const purifier = getPurifier();
  if (!purifier) return escapeHtml(source);

  let clean = '';
  try {
    clean = purifier.sanitize(source, BASE_CONFIG);
  } catch {
    return escapeHtml(source);
  }
  if (!hasDom()) return clean;

  try {
    const template = window.document.createElement('template');
    template.innerHTML = clean;
    hardenSanitizedTree(template.content);
    return template.innerHTML;
  } catch {
    return clean;
  }
}

export function extractHtmlBody(dirty: unknown): string {
  const source = asString(dirty);
  if (!source) return '';
  if (!hasDom()) return source;
  try {
    const parsed = new window.DOMParser().parseFromString(source, 'text/html');
    return parsed.body ? parsed.body.innerHTML : source;
  } catch {
    return source;
  }
}

export function textToSafeHtml(value: unknown): string {
  return escapeHtml(value).replace(/\r\n|\r|\n/g, '<br>');
}

export function buildReplyQuoteHtml(senderName: unknown, bodyHtml: unknown): string {
  return sanitizeHtml(
    `<br><br><blockquote>--- Original Message from ${escapeHtml(senderName)} ---<br>${sanitizeHtml(bodyHtml)}</blockquote>`
  );
}

const BLOCK_BREAK_PATTERN = /<br\b[^>]*>|<\/(?:p|div|li|tr|td|th|h[1-6]|blockquote|pre|table|thead|tbody|tfoot|ul|ol|section|article|header|footer|figure|hr)\b[^>]*>/gi;

export function htmlToPlainText(dirty: unknown): string {
  const source = asString(dirty);
  if (!source) return '';
  if (!hasDom()) return source.replace(/<[^>]*>/g, '');

  try {
    const withBreaks = sanitizeHtml(source).replace(BLOCK_BREAK_PATTERN, '\n');
    const template = window.document.createElement('template');
    template.innerHTML = withBreaks;
    return (template.content.textContent || '')
      .replace(/\u00a0/g, ' ')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  } catch {
    return source.replace(/<[^>]*>/g, '');
  }
}
