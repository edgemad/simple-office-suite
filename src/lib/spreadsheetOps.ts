import type { CellValue, SheetGrid } from '../types';

/** Excel-style 1-based column letter for a 0-based column index. */
export function colLetter(colIndex: number): string {
  let n = colIndex;
  let out = '';
  while (n >= 0) {
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26) - 1;
  }
  return out;
}

/**
 * Rows to hide when filtering one column by a text query, the way a
 * Google Sheets filter hides non-matching rows. Row 0 is the header row and
 * is never hidden. An empty query clears the filter.
 */
export function computeFilterHiddenRows(
  cells: SheetGrid,
  colIndex: number,
  query: string,
  rowCount: number
): number[] {
  const needle = query.trim().toLowerCase();
  if (needle === '') return [];

  const hidden: number[] = [];
  for (let row = 1; row < rowCount; row += 1) {
    const key = `${colLetter(colIndex)}${row + 1}`;
    const value = String(cells[key]?.computed ?? '').toLowerCase();
    if (!value.includes(needle)) hidden.push(row);
  }
  return hidden;
}

/** Four-function calculator step. Division by zero yields NaN, as in a real calculator display. */
export function applyOperator(a: number, b: number, operator: string): number {
  if (operator === '+') return a + b;
  if (operator === '-') return a - b;
  if (operator === '*') return a * b;
  if (operator === '/') return b === 0 ? Number.NaN : a / b;
  return b;
}

/** Keeps a column-count setting inside the 1-3 range the layout supports. */
export function clampColumnCount(count: number): number {
  if (!Number.isFinite(count)) return 1;
  return Math.min(3, Math.max(1, Math.round(count)));
}

/** Steps a font size up or down while staying inside the browser's 1-7 execCommand range. */
export function stepFontSizeLevel(currentLevel: number, direction: 1 | -1): number {
  const level = Number.isFinite(currentLevel) ? currentLevel : 3;
  return Math.min(7, Math.max(1, Math.round(level) + direction));
}

export const FONT_SIZE_LEVELS: Record<number, number> = {
  1: 9,
  2: 10,
  3: 11,
  4: 12,
  5: 14,
  6: 18,
  7: 24,
};

/** Nearest supported size label for a measured pixel size, used by the ribbon dropdown. */
export function nearestFontSizeLabel(pixels: number): string {
  const entries = Object.entries(FONT_SIZE_LEVELS).map(([level, px]) => ({
    level: Number(level),
    px,
  }));
  const best = entries.reduce((a, b) => (Math.abs(b.px - pixels) < Math.abs(a.px - pixels) ? b : a));
  return String(best.px);
}

/**
 * Row/column insert helpers shared by the ribbon. `fromRow` is the 0-based
 * index the new row occupies; cells below it move down one row, and a cell
 * pushed past the last row or column is dropped rather than kept in place.
 */
/** Inverse of `nearestFontSizeLabel`: the legacy execCommand level for a pixel size. */
export function fontSizeLevelFor(pixels: number): number {
  const entries = Object.entries(FONT_SIZE_LEVELS).map(([level, px]) => ({
    level: Number(level),
    px,
  }));
  const best = entries.reduce((a, b) => (Math.abs(b.px - pixels) < Math.abs(a.px - pixels) ? b : a));
  return best.level;
}

export function shiftCellsDown(cells: SheetGrid, fromRow: number, rowCount: number, colCount: number): SheetGrid {
  const next: SheetGrid = {};
  for (const [key, value] of Object.entries(cells)) {
    const match = /^([A-Za-z]+)(\d+)$/.exec(key);
    if (!match) {
      next[key] = value;
      continue;
    }
    const col = colLetterToIndex(match[1]);
    const row = Number(match[2]);
    if (row <= fromRow) {
      next[key] = value;
      continue;
    }
    const movedRow = row + 1;
    if (movedRow <= rowCount && col < colCount) {
      next[`${colLetter(col)}${movedRow}`] = value;
    }
  }
  return next;
}

export function colLetterToIndex(letters: string): number {
  let n = 0;
  for (const ch of letters.toUpperCase()) {
    n = n * 26 + (ch.charCodeAt(0) - 64);
  }
  return n - 1;
}

export function isBlankValue(value: CellValue | undefined): boolean {
  return !value || String(value.computed ?? '').trim() === '';
}
