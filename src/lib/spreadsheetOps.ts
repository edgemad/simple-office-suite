import type { CellRect, CellValue, SheetGrid } from '../types';

export type { CellRect };

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

/** Guard against merges that would lock a huge region of the sheet. */
export const MAX_MERGE_AREA = 4000;

export function normalizeRect(a: CellRect, b: CellRect): CellRect {
  return {
    startCol: Math.min(a.startCol, b.startCol),
    startRow: Math.min(a.startRow, b.startRow),
    endCol: Math.max(a.endCol, b.endCol),
    endRow: Math.max(a.endRow, b.endRow),
  };
}

export function rectContains(rect: CellRect, col: number, row: number): boolean {
  return col >= rect.startCol && col <= rect.endCol && row >= rect.startRow && row <= rect.endRow;
}

export function rectArea(rect: CellRect): number {
  return (rect.endCol - rect.startCol + 1) * (rect.endRow - rect.startRow + 1);
}

export function rectsOverlap(a: CellRect, b: CellRect): boolean {
  return a.startCol <= b.endCol && b.startCol <= a.endCol && a.startRow <= b.endRow && b.startRow <= a.endRow;
}

export function rectsEqual(a: CellRect, b: CellRect): boolean {
  return a.startCol === b.startCol && a.startRow === b.startRow && a.endCol === b.endCol && a.endRow === b.endRow;
}

export function rectToRangeText(rect: CellRect): string {
  const topLeft = `${colLetter(rect.startCol)}${rect.startRow + 1}`;
  const bottomRight = `${colLetter(rect.endCol)}${rect.endRow + 1}`;
  return topLeft === bottomRight ? topLeft : `${topLeft}:${bottomRight}`;
}

/** Parses "A1:C3" or a single cell into a rect, or null when the text is not a reference. */
export function rangeTextToRect(text: string): CellRect | null {
  const clean = text.replace(/\$/g, '').trim().toUpperCase();
  const parts = clean.split(':');
  const parseOne = (part: string) => {
    const match = /^([A-Z]+)([0-9]+)$/.exec(part);
    if (!match) return null;
    return { col: colLetterToIndex(match[1]), row: Number(match[2]) - 1 };
  };
  const start = parseOne(parts[0]);
  if (!start) return null;
  const end = parts.length > 1 ? parseOne(parts[1]) : start;
  if (!end) return null;
  return {
    startCol: Math.min(start.col, end.col),
    startRow: Math.min(start.row, end.row),
    endCol: Math.max(start.col, end.col),
    endRow: Math.max(start.row, end.row),
  };
}

/** Row/column span for a cell that anchors a merge, or null when it is not an anchor. */
export function mergeAnchorSpan(rects: CellRect[], col: number, row: number): { rowspan: number; colspan: number } | null {
  const rect = rects.find((r) => r.startCol === col && r.startRow === row);
  if (!rect) return null;
  return { rowspan: rect.endRow - rect.startRow + 1, colspan: rect.endCol - rect.startCol + 1 };
}

/** True when a cell sits inside a merge but is not its anchor, so the grid must not draw it. */
export function isCoveredByMerge(rects: CellRect[], col: number, row: number): boolean {
  return rects.some((r) => rectContains(r, col, row) && !(r.startCol === col && r.startRow === row));
}

/** The merge covering a cell, if any. */
export function mergeRectAt(rects: CellRect[], col: number, row: number): CellRect | null {
  return rects.find((r) => rectContains(r, col, row)) ?? null;
}

/** Adds a merge, refusing overlaps and oversized regions the way a spreadsheet does. */
export function addMergeRect(
  rects: CellRect[],
  rect: CellRect
): { rects: CellRect[]; error: string | null } {
  const target = normalizeRect(rect, rect);
  if (rectArea(target) > MAX_MERGE_AREA) {
    return { rects, error: `That merge would cover ${rectArea(target)} cells. Pick a smaller range.` };
  }
  if (rects.some((r) => rectsOverlap(r, target))) {
    return { rects, error: 'Those cells are already part of a merge.' };
  }
  return { rects: [...rects, target], error: null };
}

export function removeMergeRectAt(rects: CellRect[], col: number, row: number): CellRect[] {
  return rects.filter((r) => !rectContains(r, col, row));
}

/** The cell keys a merge covers, anchor first. */
export function rectCellKeys(rect: CellRect): string[] {
  const keys: string[] = [];
  for (let row = rect.startRow; row <= rect.endRow; row += 1) {
    for (let col = rect.startCol; col <= rect.endCol; col += 1) {
      keys.push(`${colLetter(col)}${row + 1}`);
    }
  }
  return keys;
}

/** Returns an error message when a value breaks a list rule, otherwise null. */
export function validationViolation(items: string[], value: string, allowBlank = true): string | null {
  const trimmed = value.trim();
  if (trimmed === '') return allowBlank ? null : 'This cell is required.';
  if (items.length === 0) return null;
  if (items.some((item) => item.trim() === trimmed)) return null;
  return `Value must be one of: ${items.join(', ')}`;
}

export type BorderStyle = 'none' | 'all' | 'outer' | 'top' | 'bottom' | 'left' | 'right';

/** CSS border declarations for a cell's border setting. */
export function borderCss(border: BorderStyle | undefined, width = '1px'): string {
  if (!border || border === 'none') return '';
  if (border === 'all') return `border: ${width} solid #94a3b8;`;
  if (border === 'top') return `border-top: ${width} solid #94a3b8;`;
  if (border === 'bottom') return `border-bottom: ${width} solid #94a3b8;`;
  if (border === 'left') return `border-left: ${width} solid #94a3b8;`;
  if (border === 'right') return `border-right: ${width} solid #94a3b8;`;
  return '';
}
