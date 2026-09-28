/**
 * Canonical spreadsheet cell key format.
 *
 * Extracted so the render loop, the precomputed indexes, and the tests all
 * agree on one format. Changing the key shape in only one of those places
 * silently breaks merges and conditional formatting.
 */

/** "B7" style key from zero-based coordinates. */
export function getCellKey(col: number, row: number): string {
  return `${colToLetter(col)}${row + 1}`;
}

export function colToLetter(colIndex: number): string {
  let n = colIndex;
  let out = '';
  while (n >= 0) {
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26) - 1;
  }
  return out;
}

/** Parses "B7" back into zero-based coordinates. Null when unparseable. */
export function parseCellKey(key: string): { col: number; row: number } | null {
  const match = /^([A-Z]+)(\d+)$/.exec(key.toUpperCase());
  if (!match) return null;
  const row = parseInt(match[2], 10) - 1;
  if (Number.isNaN(row) || row < 0) return null;
  return { col: letterToCol(match[1]), row };
}

export function letterToCol(letters: string): number {
  let col = 0;
  for (const char of letters.toUpperCase()) {
    col = col * 26 + (char.charCodeAt(0) - 64);
  }
  return col - 1;
}
