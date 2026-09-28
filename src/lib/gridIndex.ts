/**
 * Precomputed lookup indexes for the spreadsheet grid.
 *
 * The grid renders every cell in the sheet. Doing linear work per cell turns
 * that into O(cells x rules) on every keystroke, which is what makes a
 * spreadsheet feel heavy compared to a native grid. These builders turn the
 * repeated scans into one pass up front, after which the render is a Map/Set
 * lookup per cell.
 *
 * Pure and side-effect free so the behaviour is testable without a DOM.
 */

import { rectContains, rangeTextToRect, type CellRect } from './spreadsheetOps';
import { getCellKey } from './cellKey';

export interface MergeEntry {
  rowspan: number;
  colspan: number;
}

/**
 * Maps every covered cell to the anchor's span, and the anchor to its span.
 *
 * Lookups become: covered -> `null` (skip the cell), otherwise the span to
 * render on the <td>. `null` in the map means "this cell is hidden because a
 * merge covers it".
 */
export function buildMergeIndex(
  rects: CellRect[]
): Map<string, MergeEntry | null> {
  const index = new Map<string, MergeEntry | null>();
  if (!rects.length) return index;

  for (const rect of rects) {
    for (let row = rect.startRow; row <= rect.endRow; row++) {
      for (let col = rect.startCol; col <= rect.endCol; col++) {
        const key = getCellKey(col, row);
        if (col === rect.startCol && row === rect.startRow) {
          index.set(key, {
            rowspan: rect.endRow - rect.startRow + 1,
            colspan: rect.endCol - rect.startCol + 1,
          });
        } else {
          index.set(key, null);
        }
      }
    }
  }
  return index;
}

export function hiddenRowSet(hiddenRows: number[]): Set<number> {
  return new Set(hiddenRows);
}

export interface ConditionalRule {
  id: string;
  range: string;
  condition: string;
  value: string;
  bgColor?: string;
  textColor?: string;
}

function evaluateRule(
  rule: ConditionalRule,
  cellVal: string | number
): { bgColor?: string; textColor?: string } | null {
  const strVal = String(cellVal).trim();
  const numVal = typeof cellVal === 'number' ? cellVal : parseFloat(strVal.replace(/[$,%]/g, ''));
  const ruleNum = parseFloat(rule.value);

  let match = false;
  switch (rule.condition) {
    case 'greaterThan':
      match = !isNaN(numVal) && !isNaN(ruleNum) && numVal > ruleNum;
      break;
    case 'lessThan':
      match = !isNaN(numVal) && !isNaN(ruleNum) && numVal < ruleNum;
      break;
    case 'equals':
      match =
        strVal.toLowerCase() === rule.value.toLowerCase() ||
        (!isNaN(numVal) && !isNaN(ruleNum) && numVal === ruleNum);
      break;
    case 'contains':
      match = strVal.toLowerCase().includes(rule.value.toLowerCase());
      break;
    case 'notEmpty':
      match = strVal.length > 0;
      break;
    default:
      match = false;
  }

  if (!match) return null;
  return { bgColor: rule.bgColor, textColor: rule.textColor };
}

/** True when the rect actually covers the cell — exported for the index tests. */
export function covers(rect: CellRect, col: number, row: number): boolean {
  return rectContains(rect, col, row);
}

/**
 * Buckets conditional rules by the rows they cover.
 *
 * The first attempt at this precomputed a style for every cell in every rule's
 * range, which was measurably *slower* than the original per-cell check: it
 * walked 8 rules x 5,200 cells on every keystroke. Bucketing by row inverts
 * that — the walk is O(sum of rule ranges) and happens only when the rules
 * change, while the per-cell work drops to "the rules covering this row",
 * which is what the old code did but without re-parsing each range.
 */
export interface RowRule {
  rule: ConditionalRule;
  startCol: number;
  endCol: number;
}

export function buildRuleIndexByRow(rules: ConditionalRule[]): Map<number, RowRule[]> {
  const index = new Map<number, RowRule[]>();
  if (!rules.length) return index;

  for (const rule of rules) {
    const rect = rangeTextToRect(rule.range);
    if (!rect) continue;
    const entry: RowRule = { rule, startCol: rect.startCol, endCol: rect.endCol };
    for (let row = rect.startRow; row <= rect.endRow; row++) {
      const bucket = index.get(row);
      if (bucket) bucket.push(entry);
      else index.set(row, [entry]);
    }
  }
  return index;
}

/** The rules that could style a cell, already narrowed to its row then column. */
export function rulesForCell(
  index: Map<number, RowRule[]>,
  col: number,
  row: number
): RowRule[] {
  const bucket = index.get(row);
  if (!bucket) return [];
  // No shortcut on the first entry's span: a later rule in the same row can
  // legitimately cover a wider column range than the first.
  return bucket.filter((entry) => col >= entry.startCol && col <= entry.endCol);
}

/** Evaluates the first matching rule for a cell, mirroring the old order. */
export function styleForCell(
  candidates: RowRule[],
  cellVal: string | number | undefined
): { bgColor?: string; textColor?: string } | null {
  if (cellVal === undefined || cellVal === null || cellVal === '') return null;

  for (const { rule } of candidates) {
    const style = evaluateRule(rule, cellVal);
    if (style) return style;
  }
  return null;
}
