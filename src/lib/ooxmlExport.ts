/**
 * Turning a live document into real Office bytes.
 *
 * The export path used to hand back a string, which is why saved .docx files
 * were Word-compatible HTML rather than actual OOXML. The zipped package has
 * to be built natively, so these call into Rust and return bytes.
 */

import type { SlideDeck, SpreadsheetWorkbook, WriterDocument } from '../types';

async function invoke<T>(command: string, args: Record<string, unknown>): Promise<T> {
  const { invoke: run } = await import('@tauri-apps/api/core');
  return run<T>(command, args);
}

export const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
export const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
export const PPTX_MIME =
  'application/vnd.openxmlformats-officedocument.presentationml.presentation';

/**
 * Splits block-level HTML into plain-text paragraphs.
 *
 * The native writer emits one Word paragraph per entry, so paragraphs must be
 * separated here rather than left as markup for it to guess at.
 */
export function htmlToParagraphs(html: string): string[] {
  return html
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\/\s*(p|div|h[1-6]|li|tr|blockquote)\s*>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .split('\n')
    // Trim each line, then drop the trailing blank lines a split leaves behind,
    // while keeping interior blank lines because they are real paragraph breaks.
    .map((line) => line.trim())
    .filter((line, index, all) => line !== '' || (index > 0 && index < all.length - 1));
}

export async function buildDocx(doc: WriterDocument): Promise<ArrayBuffer> {
  const bytes = await invoke<number[]>('export_docx_bytes', {
    title: doc.meta?.title ?? 'Document',
    paragraphs: htmlToParagraphs(doc.contentHtml ?? ''),
  });
  return new Uint8Array(bytes).buffer;
}

export async function buildXlsx(workbook: SpreadsheetWorkbook): Promise<ArrayBuffer> {
  const sheet =
    workbook.sheets.find((entry) => entry.id === workbook.activeSheetId) ?? workbook.sheets[0];

  const rows: string[][] = [];
  for (let r = 0; r < sheet.rowCount; r++) {
    const row: string[] = [];
    for (let c = 0; c < sheet.colCount; c++) {
      const key = `${columnLetters(c)}${r + 1}`;
      const cell = sheet.cells[key];
      // computed is the evaluated result, which is what should be written.
      row.push(cell ? String(cell.computed ?? '') : '');
    }
    rows.push(row);
  }

  const bytes = await invoke<number[]>('export_xlsx_bytes', {
    title: workbook.meta?.title ?? 'Workbook',
    rows,
  });
  return new Uint8Array(bytes).buffer;
}

export async function buildPptx(deck: SlideDeck): Promise<ArrayBuffer> {
  const slides = (deck.slides ?? []).map((slide, index) => {
    const titleElement = slide.elements.find((element) => element.type === 'text');
    const bodyElements = slide.elements.filter(
      (element) => element.type === 'text' && element !== titleElement
    );

    return {
      // A slide with no text box still needs a title; fall back to its number
      // rather than an empty placeholder.
      title: String(titleElement?.content ?? `Slide ${index + 1}`).slice(0, 200),
      bullets: bodyElements
        .map((element) => String(element.content ?? '').replace(/<[^>]*>/g, '').trim())
        .filter((text) => text.length > 0)
        .slice(0, 12),
    };
  });

  const bytes = await invoke<number[]>('export_pptx_bytes', {
    title: deck.meta?.title ?? 'Presentation',
    slides,
  });
  return new Uint8Array(bytes).buffer;
}

export function columnLetters(index: number): string {
  let letters = '';
  index += 1;
  while (index > 0) {
    const remainder = (index - 1) % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    index = Math.floor((index - 1) / 26);
  }
  return letters;
}

/** Writes generated binary output to a path the save dialog approved. */
export async function writeBinaryFileNative(path: string, bytes: ArrayBuffer): Promise<void> {
  await invoke('write_binary_file', { path, bytes: Array.from(new Uint8Array(bytes)) });
}
