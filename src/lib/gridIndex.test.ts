import { describe, expect, it } from 'vitest';
import {
  buildMergeIndex,
  buildRuleIndexByRow,
  hiddenRowSet,
  rulesForCell,
  styleForCell,
  type ConditionalRule,
} from './gridIndex';
import { mergeAnchorSpan, isCoveredByMerge, type CellRect } from './spreadsheetOps';
import { getCellKey, colToLetter, parseCellKey, letterToCol } from './cellKey';

describe('cell keys', () => {
  it('builds A1-style keys', () => {
    expect(getCellKey(0, 0)).toBe('A1');
    expect(getCellKey(1, 6)).toBe('B7');
    expect(getCellKey(25, 0)).toBe('Z1');
  });

  it('rolls over past Z', () => {
    expect(colToLetter(26)).toBe('AA');
    expect(colToLetter(27)).toBe('AB');
    expect(colToLetter(51)).toBe('AZ');
    expect(colToLetter(52)).toBe('BA');
  });

  it('round-trips a key back to coordinates', () => {
    for (const [col, row] of [[0, 0], [1, 6], [25, 99], [26, 0], [51, 3], [701, 12]]) {
      const key = getCellKey(col, row);
      expect(parseCellKey(key)).toEqual({ col, row });
    }
  });

  it('rejects unparseable keys', () => {
    expect(parseCellKey('')).toBeNull();
    expect(parseCellKey('A')).toBeNull();
    expect(parseCellKey('1A')).toBeNull();
    expect(parseCellKey('A0')).toBeNull();
  });

  it('agrees with the letter conversion in both directions', () => {
    for (let col = 0; col < 800; col++) {
      expect(letterToCol(colToLetter(col))).toBe(col);
    }
  });
});

describe('buildMergeIndex', () => {
  const rect: CellRect = { startCol: 1, endCol: 3, startRow: 2, endRow: 4 };

  it('marks the anchor with its full span', () => {
    const index = buildMergeIndex([rect]);
    expect(index.get('B3')).toEqual({ rowspan: 3, colspan: 3 });
  });

  it('marks every covered cell as hidden', () => {
    const index = buildMergeIndex([rect]);
    for (const key of ['C3', 'D3', 'B4', 'C5']) {
      expect(index.get(key)).toBeNull();
    }
  });

  it('agrees with the old per-cell helpers on every cell of the range', () => {
    const index = buildMergeIndex([rect]);
    for (let row = 0; row <= 6; row++) {
      for (let col = 0; col <= 5; col++) {
        const key = getCellKey(col, row);
        const oldSpan = mergeAnchorSpan([rect], col, row);
        const oldCovered = isCoveredByMerge([rect], col, row);
        const entry = index.get(key);
        const newCovered = index.has(key) && entry === null;
        expect(newCovered).toBe(oldCovered);
        expect(entry ?? null).toEqual(oldSpan);
      }
    }
  });

  it('leaves cells outside every merge absent from the index', () => {
    const index = buildMergeIndex([rect]);
    expect(index.has('A1')).toBe(false);
    expect(index.has('E5')).toBe(false);
  });

  it('handles multiple merges without cross-contamination', () => {
    const other: CellRect = { startCol: 6, endCol: 7, startRow: 0, endRow: 1 };
    const index = buildMergeIndex([rect, other]);
    expect(index.get('B3')).toEqual({ rowspan: 3, colspan: 3 });
    expect(index.get('G1')).toEqual({ rowspan: 2, colspan: 2 });
    expect(index.get('H2')).toBeNull();
  });

  it('returns an empty index for no merges', () => {
    expect(buildMergeIndex([]).size).toBe(0);
  });
});

describe('hiddenRowSet', () => {
  it('answers membership in constant time', () => {
    const set = hiddenRowSet([1, 3, 5]);
    expect(set.has(1)).toBe(true);
    expect(set.has(2)).toBe(false);
  });

  it('handles an empty list', () => {
    expect(hiddenRowSet([]).size).toBe(0);
  });
});

describe('buildRuleIndexByRow', () => {
  const rules: ConditionalRule[] = [
    { id: 'a', range: 'A1:A3', condition: 'greaterThan', value: '5', bgColor: '#fee' },
    { id: 'b', range: 'A1:A3', condition: 'lessThan', value: '2', bgColor: '#eef' },
  ];

  it('buckets a rule under every row it covers', () => {
    const index = buildRuleIndexByRow(rules);
    expect(index.get(0)).toHaveLength(2);
    expect(index.get(2)).toHaveLength(2);
    expect(index.get(3)).toBeUndefined();
  });

  it('narrows candidates to the rules covering the column', () => {
    const mixed: ConditionalRule[] = [
      { id: 'narrow', range: 'A1:A3', condition: 'notEmpty', value: '', bgColor: '#111' },
      { id: 'wide', range: 'A1:D3', condition: 'greaterThan', value: '0', bgColor: '#222' },
    ];
    const index = buildRuleIndexByRow(mixed);
    expect(rulesForCell(index, 0, 0).map((r) => r.rule.id)).toEqual(['narrow', 'wide']);
    expect(rulesForCell(index, 3, 0).map((r) => r.rule.id)).toEqual(['wide']);
  });

  it('returns no candidates for a row no rule covers', () => {
    expect(rulesForCell(buildRuleIndexByRow(rules), 0, 50)).toEqual([]);
  });

  it('ignores rules with an unparseable range', () => {
    const bad: ConditionalRule[] = [
      { id: 'e', range: 'not-a-range', condition: 'notEmpty', value: '' },
    ];
    expect(buildRuleIndexByRow(bad).size).toBe(0);
  });

  it('handles a rule spanning many rows without duplicating per cell', () => {
    const wide: ConditionalRule[] = [
      { id: 'w', range: 'A1:Z5000', condition: 'notEmpty', value: '' },
    ];
    const index = buildRuleIndexByRow(wide);
    expect(index.get(0)).toHaveLength(1);
    expect(index.get(4999)).toHaveLength(1);
  });
});

describe('styleForCell', () => {
  const rules: ConditionalRule[] = [
    { id: 'a', range: 'A1:A3', condition: 'greaterThan', value: '5', bgColor: '#fee' },
    { id: 'b', range: 'A1:A3', condition: 'lessThan', value: '2', bgColor: '#eef' },
  ];
  const index = buildRuleIndexByRow(rules);
  const styleAt = (col: number, row: number, value: string | number | undefined) =>
    styleForCell(rulesForCell(index, col, row), value);

  it('applies a greater-than rule', () => {
    expect(styleAt(0, 0, 10)?.bgColor).toBe('#fee');
  });

  it('leaves non-matching cells unstyled', () => {
    expect(styleAt(0, 0, 3)).toBeNull();
  });

  it('falls through to the next rule when the first does not match', () => {
    expect(styleAt(0, 0, 1)?.bgColor).toBe('#eef');
  });

  it('keeps the earlier rule when both match', () => {
    const overlapping: ConditionalRule[] = [
      { id: 'first', range: 'A1:A3', condition: 'notEmpty', value: '', bgColor: '#111' },
      { id: 'second', range: 'A1:A3', condition: 'greaterThan', value: '1', bgColor: '#222' },
    ];
    const idx = buildRuleIndexByRow(overlapping);
    expect(styleForCell(rulesForCell(idx, 0, 0), 5)?.bgColor).toBe('#111');
  });

  it('skips empty cells', () => {
    expect(styleAt(0, 0, '')).toBeNull();
    expect(styleAt(0, 0, undefined)).toBeNull();
  });

  it('handles string comparison and contains', () => {
    const text: ConditionalRule[] = [
      { id: 'c', range: 'A1:B1', condition: 'equals', value: 'yes', bgColor: '#0f0' },
      { id: 'd', range: 'A1:B1', condition: 'contains', value: 'err', bgColor: '#f00' },
    ];
    const idx = buildRuleIndexByRow(text);
    expect(styleForCell(rulesForCell(idx, 0, 0), 'YES')?.bgColor).toBe('#0f0');
    expect(styleForCell(rulesForCell(idx, 0, 0), 'ERROR')?.bgColor).toBe('#f00');
  });

  it('returns null with no candidates', () => {
    expect(styleForCell([], 5)).toBeNull();
  });
});
