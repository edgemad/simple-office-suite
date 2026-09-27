import { describe, it, expect } from 'vitest';
import {
  colLetter,
  colLetterToIndex,
  applyOperator,
  clampColumnCount,
  stepFontSizeLevel,
  nearestFontSizeLabel,
  fontSizeLevelFor,
  computeFilterHiddenRows,
  shiftCellsDown,
  isBlankValue,
  FONT_SIZE_LEVELS,
  normalizeRect,
  mergeAnchorSpan,
  isCoveredByMerge,
  addMergeRect,
  removeMergeRectAt,
  rangeTextToRect,
  rectToRangeText,
  rectCellKeys,
  validationViolation,
  borderCss,
} from './spreadsheetOps';
import { alignElementBox, normalizeTransition } from './slideLayout';
import type { SheetGrid } from '../types';

describe('column letters', () => {
  it('converts indices the way a spreadsheet does', () => {
    expect(colLetter(0)).toBe('A');
    expect(colLetter(25)).toBe('Z');
    expect(colLetter(26)).toBe('AA');
    expect(colLetter(701)).toBe('ZZ');
  });

  it('round-trips through the index parser', () => {
    for (const letters of ['A', 'B', 'Z', 'AA', 'AZ', 'BA']) {
      expect(colLetter(colLetterToIndex(letters))).toBe(letters);
    }
  });
});

describe('filter', () => {
  const cells: SheetGrid = {
    A1: { raw: 'Name', computed: 'Name' },
    A2: { raw: 'Ada', computed: 'Ada' },
    A3: { raw: 'Grace', computed: 'Grace' },
    A4: { raw: 'Alan', computed: 'Alan' },
  };

  it('hides rows that do not match and never hides the header', () => {
    // 4 rows total: row 1 is the header, rows 2-4 are Ada / Grace / Alan.
    expect(computeFilterHiddenRows(cells, 0, 'Ada', 4)).toEqual([2, 3]);
  });

  it('matches case-insensitively as a substring, like a spreadsheet filter', () => {
    expect(computeFilterHiddenRows(cells, 0, 'AL', 4)).toEqual([1, 2]);
  });

  it('clears the filter for an empty query', () => {
    expect(computeFilterHiddenRows(cells, 0, '   ', 4)).toEqual([]);
  });

  it('hides every data row when nothing matches', () => {
    expect(computeFilterHiddenRows(cells, 0, 'zzz', 4)).toEqual([1, 2, 3]);
  });
});

describe('calculator', () => {
  it('applies the four operators', () => {
    expect(applyOperator(6, 3, '+')).toBe(9);
    expect(applyOperator(6, 3, '-')).toBe(3);
    expect(applyOperator(6, 3, '*')).toBe(18);
    expect(applyOperator(6, 3, '/')).toBe(2);
  });

  it('reports division by zero instead of throwing', () => {
    expect(Number.isNaN(applyOperator(1, 0, '/'))).toBe(true);
  });
});

describe('formatting limits', () => {
  it('clamps column count into the supported range', () => {
    expect(clampColumnCount(0)).toBe(1);
    expect(clampColumnCount(2)).toBe(2);
    expect(clampColumnCount(9)).toBe(3);
    expect(clampColumnCount(Number.NaN)).toBe(1);
  });

  it('steps font size levels inside the browser range', () => {
    expect(stepFontSizeLevel(3, 1)).toBe(4);
    expect(stepFontSizeLevel(7, 1)).toBe(7);
    expect(stepFontSizeLevel(1, -1)).toBe(1);
  });

  it('maps a pixel size to the closest supported label', () => {
    expect(nearestFontSizeLabel(11)).toBe('11');
    expect(nearestFontSizeLabel(17)).toBe('18');
    expect(nearestFontSizeLabel(200)).toBe('24');
  });

  it('maps a pixel size back to a legacy level for execCommand', () => {
    expect(fontSizeLevelFor(11)).toBe(3);
    expect(fontSizeLevelFor(24)).toBe(7);
    expect(fontSizeLevelFor(16)).toBe(5);
  });

  it('round-trips a level through its pixel size', () => {
    for (const level of [1, 2, 3, 4, 5, 6, 7]) {
      expect(fontSizeLevelFor(FONT_SIZE_LEVELS[level])).toBe(level);
    }
  });
});

describe('row insertion', () => {
  it('moves cells below the insert point down one row', () => {
    const cells: SheetGrid = {
      A1: { raw: 'h', computed: 'h' },
      A2: { raw: 'x', computed: 'x' },
      A3: { raw: 'y', computed: 'y' },
    };
    const next = shiftCellsDown(cells, 1, 10, 5);
    expect(next.A1?.computed).toBe('h');
    expect(next.A2).toBeUndefined();
    expect(next.A3?.computed).toBe('x');
    expect(next.A4?.computed).toBe('y');
  });

  it('drops cells that would fall outside the sheet', () => {
    const cells: SheetGrid = { A3: { raw: 'last', computed: 'last' } };
    const next = shiftCellsDown(cells, 1, 3, 5);
    expect(Object.keys(next)).toHaveLength(0);
  });
});

describe('blank detection', () => {
  it('treats missing and empty cells as blank', () => {
    expect(isBlankValue(undefined)).toBe(true);
    expect(isBlankValue({ raw: '', computed: '  ' })).toBe(true);
    expect(isBlankValue({ raw: '0', computed: 0 })).toBe(false);
  });
});

describe('slide alignment', () => {
  const box = { x: 10, y: 20, width: 30, height: 12 };

  it('centres horizontally and vertically', () => {
    expect(alignElementBox(box, 'centerH')).toEqual({ x: 35, y: 20 });
    expect(alignElementBox(box, 'centerV')).toEqual({ x: 10, y: 44 });
  });

  it('keeps a margin from the edges', () => {
    expect(alignElementBox(box, 'left').x).toBe(8);
    expect(alignElementBox(box, 'top').y).toBe(8);
    expect(alignElementBox(box, 'right').x).toBe(62);
    expect(alignElementBox(box, 'bottom').y).toBe(80);
  });

  it('never produces a negative offset for oversized elements', () => {
    expect(alignElementBox({ x: 0, y: 0, width: 140, height: 140 }, 'right').x).toBe(0);
    expect(alignElementBox({ x: 0, y: 0, width: 140, height: 140 }, 'bottom').y).toBe(0);
  });
});

describe('slide transitions', () => {
  it('accepts known transitions and rejects anything else', () => {
    expect(normalizeTransition('fade')).toBe('fade');
    expect(normalizeTransition('zoom')).toBe('zoom');
    expect(normalizeTransition('explode')).toBe('none');
  });
});

describe('merged cells', () => {
  const rect = (a: number, b: number, c: number, d: number) => ({
    startCol: a,
    startRow: b,
    endCol: c,
    endRow: d,
  });

  it('normalizes two rects into their bounding box', () => {
    expect(normalizeRect(rect(1, 1, 1, 1), rect(3, 4, 5, 6))).toEqual(rect(1, 1, 5, 6));
  });

  it('computes the anchor span only at the top-left cell', () => {
    const rects = [rect(0, 0, 2, 1)];
    expect(mergeAnchorSpan(rects, 0, 0)).toEqual({ rowspan: 2, colspan: 3 });
    expect(mergeAnchorSpan(rects, 1, 0)).toBeNull();
  });

  it('hides covered cells so the merge renders as one block', () => {
    const rects = [rect(1, 1, 2, 2)];
    expect(isCoveredByMerge(rects, 1, 1)).toBe(false);
    expect(isCoveredByMerge(rects, 2, 1)).toBe(true);
    expect(isCoveredByMerge(rects, 1, 2)).toBe(true);
    expect(isCoveredByMerge(rects, 3, 1)).toBe(false);
  });

  it('refuses overlapping merges the way a spreadsheet does', () => {
    const first = addMergeRect([], rect(0, 0, 1, 1));
    expect(first.error).toBeNull();
    const second = addMergeRect(first.rects, rect(1, 1, 2, 2));
    expect(second.error).toMatch(/already part of a merge/);
    expect(second.rects).toHaveLength(1);
  });

  it('refuses merges that would lock a huge region', () => {
    const result = addMergeRect([], rect(0, 0, 200, 200));
    expect(result.error).toMatch(/smaller range/);
    expect(result.rects).toHaveLength(0);
  });

  it('removes the merge covering a cell', () => {
    const rects = [rect(0, 0, 1, 1), rect(4, 4, 5, 5)];
    expect(removeMergeRectAt(rects, 0, 0)).toHaveLength(1);
    expect(removeMergeRectAt(rects, 9, 9)).toHaveLength(2);
  });

  it('round-trips range text', () => {
    expect(rangeTextToRect('A1:C3')).toEqual(rect(0, 0, 2, 2));
    expect(rangeTextToRect('b2')).toEqual(rect(1, 1, 1, 1));
    expect(rangeTextToRect('C1:A3')).toEqual(rect(0, 0, 2, 2));
    expect(rangeTextToRect('nope')).toBeNull();
    expect(rectToRangeText(rect(0, 0, 2, 2))).toBe('A1:C3');
    expect(rectToRangeText(rect(1, 1, 1, 1))).toBe('B2');
  });

  it('lists covered cell keys anchor first', () => {
    expect(rectCellKeys(rect(0, 0, 1, 1))).toEqual(['A1', 'B1', 'A2', 'B2']);
  });
});

describe('data validation', () => {
  it('accepts a listed value', () => {
    expect(validationViolation(['Yes', 'No'], 'Yes')).toBeNull();
  });

  it('rejects a value outside the list with a helpful message', () => {
    expect(validationViolation(['Yes', 'No'], 'Maybe')).toMatch(/Value must be one of: Yes, No/);
  });

  it('treats a blank as allowed unless the rule requires a value', () => {
    expect(validationViolation(['Yes'], '')).toBeNull();
    expect(validationViolation(['Yes'], '', false)).toMatch(/required/);
  });

  it('ignores an empty rule so plain cells are never flagged', () => {
    expect(validationViolation([], 'anything')).toBeNull();
  });

  it('ignores surrounding whitespace when matching', () => {
    expect(validationViolation(['Yes', 'No'], '  No  ')).toBeNull();
  });
});

describe('borders', () => {
  it('produces no border for none or an unset value', () => {
    expect(borderCss(undefined)).toBe('');
    expect(borderCss('none')).toBe('');
  });

  it('emits every side for an all-around border', () => {
    expect(borderCss('all')).toBe('border: 1px solid #94a3b8;');
  });

  it('emits only the requested side', () => {
    expect(borderCss('top')).toBe('border-top: 1px solid #94a3b8;');
    expect(borderCss('left')).toBe('border-left: 1px solid #94a3b8;');
  });
});
