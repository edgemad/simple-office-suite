import clsx, { type ClassValue } from 'clsx';

export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}

export function downloadFile(filename: string, content: string, mimeType: string = 'text/plain') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function triggerPrintToPdf(title: string) {
  const originalTitle = document.title;
  document.title = title;
  window.print();
  document.title = originalTitle;
}

export function htmlToMarkdown(html: string): string {
  const temp = document.createElement('div');
  temp.innerHTML = html;

  // Process headers
  temp.querySelectorAll('h1').forEach((el) => (el.textContent = `# ${el.textContent}\n\n`));
  temp.querySelectorAll('h2').forEach((el) => (el.textContent = `## ${el.textContent}\n\n`));
  temp.querySelectorAll('h3').forEach((el) => (el.textContent = `### ${el.textContent}\n\n`));

  // Process bold/italics
  temp.querySelectorAll('strong, b').forEach((el) => (el.textContent = `**${el.textContent}**`));
  temp.querySelectorAll('em, i').forEach((el) => (el.textContent = `*${el.textContent}*`));

  // Process lists
  temp.querySelectorAll('ul li').forEach((el) => (el.textContent = `- ${el.textContent}\n`));
  temp.querySelectorAll('ol li').forEach((el, idx) => (el.textContent = `${idx + 1}. ${el.textContent}\n`));

  // Process quotes & code
  temp.querySelectorAll('blockquote').forEach((el) => (el.textContent = `> ${el.textContent}\n\n`));
  temp.querySelectorAll('pre, code').forEach((el) => (el.textContent = `\`\`\`\n${el.textContent}\n\`\`\`\n\n`));

  return temp.textContent || temp.innerText || '';
}

export function countWordsAndChars(text: string): { words: number; chars: number } {
  const clean = text.trim();
  if (!clean) return { words: 0, chars: 0 };
  const words = clean.split(/\s+/).filter(Boolean).length;
  const chars = clean.length;
  return { words, chars };
}
