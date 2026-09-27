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
