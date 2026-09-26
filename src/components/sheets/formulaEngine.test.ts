import { describe, it, expect } from 'vitest';
import { evaluateFormula, recalculateGrid } from './formulaEngine';
import type { SheetGrid } from '../../types';

function cell(raw: string): { raw: string; computed: string | number } {
  return { raw, computed: raw };
}

function grid(entries: Record<string, string>): SheetGrid {
  const out: SheetGrid = {};
  for (const [key, raw] of Object.entries(entries)) {
    out[key] = cell(raw);
  }
  return recalculateGrid(out);
}

describe('Excel-compatible truthiness', () => {
  it('treats the text FALSE as false and text TRUE as true in IF', () => {
    const g = grid({ A1: 'FALSE', A2: 'TRUE' });
    expect(evaluateFormula('=IF(A1,"yes","no")', g)).toBe('no');
    expect(evaluateFormula('=IF(A2,"yes","no")', g)).toBe('yes');
  });

  it('matches Excel string literal truthiness for quoted "FALSE"', () => {
    expect(evaluateFormula('=IF("FALSE","yes","no")', {})).toBe('no');
    expect(evaluateFormula('=IF("TRUE","yes","no")', {})).toBe('yes');
    expect(evaluateFormula('=IF("hello","yes","no")', {})).toBe('yes');
  });

  it('treats zero as false and other numbers as true', () => {
    const g = grid({ A1: '0', A2: '5', A3: '-3', A4: '0.0001' });
    expect(evaluateFormula('=IF(A1,"yes","no")', g)).toBe('no');
    expect(evaluateFormula('=IF(A2,"yes","no")', g)).toBe('yes');
    expect(evaluateFormula('=IF(A3,"yes","no")', g)).toBe('yes');
    expect(evaluateFormula('=IF(A4,"yes","no")', g)).toBe('yes');
    expect(evaluateFormula('=IF(0,"yes","no")', g)).toBe('no');
    expect(evaluateFormula('=IF(1,"yes","no")', g)).toBe('yes');
  });

  it('treats empty cells and blank text as false', () => {
    const g = grid({ A1: '0' });
    expect(evaluateFormula('=IF(B9,"yes","no")', g)).toBe('no');
    expect(evaluateFormula('=IF("","yes","no")', g)).toBe('no');
  });

  it('applies the same truthiness to IFS, AND, OR, NOT and XOR', () => {
    const g = grid({ A1: 'FALSE', A2: '0', A3: '1' });
    expect(evaluateFormula('=IFS(A1,"a",A3,"b")', g)).toBe('b');
    expect(evaluateFormula('=AND(A1,A2)', g)).toBe(false);
    expect(evaluateFormula('=AND(A2,A3)', g)).toBe(false);
    expect(evaluateFormula('=AND(A3,A3)', g)).toBe(true);
    expect(evaluateFormula('=OR(A1,A3)', g)).toBe(true);
    expect(evaluateFormula('=OR(A1,A2)', g)).toBe(false);
    expect(evaluateFormula('=NOT(A1)', g)).toBe(true);
    expect(evaluateFormula('=NOT(A2)', g)).toBe(true);
    expect(evaluateFormula('=NOT(A3)', g)).toBe(false);
    expect(evaluateFormula('=XOR(A1,A3)', g)).toBe(true);
    expect(evaluateFormula('=XOR(A2,A3)', g)).toBe(true);
    expect(evaluateFormula('=XOR(A1,A2)', g)).toBe(false);
  });

  it('keeps the FALSE() and TRUE() functions as booleans', () => {
    expect(evaluateFormula('=IF(FALSE(),"yes","no")', {})).toBe('no');
    expect(evaluateFormula('=IF(TRUE(),"yes","no")', {})).toBe('yes');
    expect(evaluateFormula('=IF(FALSE,"yes","no")', {})).toBe('no');
    expect(evaluateFormula('=IF(TRUE,"yes","no")', {})).toBe('yes');
  });

  it('accepts boolean function calls with empty parentheses as arguments', () => {
    expect(evaluateFormula('=AND(TRUE(),FALSE())', {})).toBe(false);
    expect(evaluateFormula('=OR(TRUE(),FALSE())', {})).toBe(true);
    expect(evaluateFormula('=IF(TRUE(),"a")', {})).toBe('a');
  });
});

describe('TEXTJOIN ignore_empty', () => {
  const g = grid({ A1: 'alpha', A2: '', A3: 'gamma' });

  it('skips empty cells when ignore_empty is TRUE', () => {
    expect(evaluateFormula('=TEXTJOIN(",",TRUE,A1:A3)', g)).toBe('alpha,gamma');
  });

  it('keeps empty cells when ignore_empty is FALSE', () => {
    expect(evaluateFormula('=TEXTJOIN(",",FALSE,A1:A3)', g)).toBe('alpha,,gamma');
  });

  it('honours a text or zero ignore_empty flag like Excel', () => {
    const flags = grid({ A1: 'alpha', A2: '', A3: 'gamma', B1: 'FALSE', B2: '0', B3: 'TRUE' });
    expect(evaluateFormula('=TEXTJOIN(",",B1,A1:A3)', flags)).toBe('alpha,,gamma');
    expect(evaluateFormula('=TEXTJOIN(",",B2,A1:A3)', flags)).toBe('alpha,,gamma');
    expect(evaluateFormula('=TEXTJOIN(",",B3,A1:A3)', flags)).toBe('alpha,gamma');
  });

  it('returns an empty string when every value is ignored', () => {
    expect(evaluateFormula('=TEXTJOIN(",",TRUE,B10:B12)', g)).toBe('');
  });
});

describe('VLOOKUP / HLOOKUP approximate match', () => {
  const g = grid({
    A1: '10',
    B1: 'ten',
    A2: '20',
    B2: 'twenty',
    A3: '30',
    B3: 'thirty',
  });

  it('defaults to approximate match when range_lookup is omitted', () => {
    expect(evaluateFormula('=VLOOKUP(25,A1:B3,2)', g)).toBe('twenty');
  });

  it('uses approximate match when range_lookup is TRUE', () => {
    expect(evaluateFormula('=VLOOKUP(25,A1:B3,2,TRUE)', g)).toBe('twenty');
    expect(evaluateFormula('=VLOOKUP(30,A1:B3,2,TRUE)', g)).toBe('thirty');
    expect(evaluateFormula('=VLOOKUP(99,A1:B3,2,TRUE)', g)).toBe('thirty');
  });

  it('returns #N/A when no approximate value is less than or equal to the lookup', () => {
    expect(evaluateFormula('=VLOOKUP(5,A1:B3,2,TRUE)', g)).toBe('#N/A');
  });

  it('keeps exact match semantics when range_lookup is FALSE', () => {
    expect(evaluateFormula('=VLOOKUP(25,A1:B3,2,FALSE)', g)).toBe('#N/A');
    expect(evaluateFormula('=VLOOKUP(20,A1:B3,2,FALSE)', g)).toBe('twenty');
  });

  it('returns #REF! when the index is outside the table', () => {
    expect(evaluateFormula('=VLOOKUP(20,A1:B3,3,FALSE)', g)).toBe('#REF!');
    expect(evaluateFormula('=VLOOKUP(20,A1:B3,0,FALSE)', g)).toBe('#VALUE!');
  });

  it('applies approximate match to HLOOKUP across the top row', () => {
    const h = grid({
      A1: '1',
      B1: '5',
      C1: '9',
      A2: 'a',
      B2: 'b',
      C2: 'c',
    });
    expect(evaluateFormula('=HLOOKUP(6,A1:C2,2)', h)).toBe('b');
    expect(evaluateFormula('=HLOOKUP(6,A1:C2,2,TRUE)', h)).toBe('b');
    expect(evaluateFormula('=HLOOKUP(0,A1:C2,2,TRUE)', h)).toBe('#N/A');
    expect(evaluateFormula('=HLOOKUP(9,A1:C2,2,FALSE)', h)).toBe('c');
  });
});

describe('INDEX', () => {
  const g = grid({
    A1: 'r1c1',
    B1: 'r1c2',
    A2: 'r2c1',
    B2: 'r2c2',
    A3: 'r3c1',
    B3: 'r3c2',
  });

  it('indexes down a single column range with one index', () => {
    expect(evaluateFormula('=INDEX(A1:A3,2)', g)).toBe('r2c1');
    expect(evaluateFormula('=INDEX(A1:A3,3)', g)).toBe('r3c1');
  });

  it('indexes across a single row range with one index', () => {
    expect(evaluateFormula('=INDEX(A1:B1,2)', g)).toBe('r1c2');
    expect(evaluateFormula('=INDEX(A1:C1,3)', g)).toBe('');
  });

  it('uses row and column for two dimensional ranges', () => {
    expect(evaluateFormula('=INDEX(A1:B3,2,2)', g)).toBe('r2c2');
    expect(evaluateFormula('=INDEX(A1:B3,1,1)', g)).toBe('r1c1');
  });

  it('uses the first column when a 2D range gets a single index', () => {
    expect(evaluateFormula('=INDEX(A1:B3,3)', g)).toBe('r3c1');
  });

  it('returns #REF! or #VALUE! for out of range indexes', () => {
    expect(evaluateFormula('=INDEX(A1:A3,9)', g)).toBe('#REF!');
    expect(evaluateFormula('=INDEX(A1:B3,2,9)', g)).toBe('#REF!');
    expect(evaluateFormula('=INDEX(A1:A3,-1)', g)).toBe('#VALUE!');
    expect(evaluateFormula('=INDEX(A1:A3,0)', g)).toBe('#VALUE!');
  });

  it('handles a single cell range', () => {
    expect(evaluateFormula('=INDEX(A1:A1,1)', g)).toBe('r1c1');
    expect(evaluateFormula('=INDEX(A1:A1,2)', g)).toBe('#REF!');
  });
});

describe('date conversion', () => {
  it('builds local calendar dates instead of shifting through UTC', () => {
    expect(evaluateFormula('=DATE(2026,9,25)', {})).toBe('2026-09-25');
    expect(evaluateFormula('=DATE(2026,1,1)', {})).toBe('2026-01-01');
    expect(evaluateFormula('=DATE(2026,12,31)', {})).toBe('2026-12-31');
  });

  it('normalises overflowing months and days', () => {
    expect(evaluateFormula('=DATE(2026,13,1)', {})).toBe('2027-01-01');
    expect(evaluateFormula('=DATE(2026,1,32)', {})).toBe('2026-02-01');
  });

  it('reads year, month and day back from the same local calendar date', () => {
    const g = grid({ A1: '=DATE(2026,9,25)' });
    expect(g.A1.computed).toBe('2026-09-25');
    expect(evaluateFormula('=YEAR(A1)', g)).toBe(2026);
    expect(evaluateFormula('=MONTH(A1)', g)).toBe(9);
    expect(evaluateFormula('=DAY(A1)', g)).toBe(25);
  });

  it('parses ISO date text as a local calendar date', () => {
    const g = grid({ A1: '2026-09-25' });
    expect(evaluateFormula('=DAY(A1)', g)).toBe(25);
    expect(evaluateFormula('=MONTH(A1)', g)).toBe(9);
    expect(evaluateFormula('=YEAR(A1)', g)).toBe(2026);
  });

  it('parses US style date text and datetime text', () => {
    expect(evaluateFormula('=DAY("9/25/2026")', {})).toBe(25);
    expect(evaluateFormula('=MONTH("12/31/2026")', {})).toBe(12);
    expect(evaluateFormula('=YEAR("2026-09-25T10:30:00")', {})).toBe(2026);
  });

  it('reads serial date numbers in UTC so they never drift a day', () => {
    expect(evaluateFormula('=YEAR(46290)', {})).toBe(2026);
    expect(evaluateFormula('=MONTH(46290)', {})).toBe(9);
    expect(evaluateFormula('=DAY(46290)', {})).toBe(25);
  });

  it('returns #VALUE! for unparseable dates', () => {
    expect(evaluateFormula('=YEAR("not-a-date")', {})).toBe('#VALUE!');
    expect(evaluateFormula('=DAY("")', {})).toBe('#VALUE!');
  });

  it('formats TODAY as a local calendar date', () => {
    const now = new Date();
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      now.getDate()
    ).padStart(2, '0')}`;
    expect(evaluateFormula('=TODAY()', {})).toBe(expected);
  });
});

describe('CEILING and FLOOR significance', () => {
  it('rounds to the nearest multiple of significance', () => {
    expect(evaluateFormula('=CEILING(4.2,0.5)', {})).toBe(4.5);
    expect(evaluateFormula('=CEILING(4.2,1)', {})).toBe(5);
    expect(evaluateFormula('=CEILING(4.2,3)', {})).toBe(6);
    expect(evaluateFormula('=FLOOR(4.7,0.5)', {})).toBe(4.5);
    expect(evaluateFormula('=FLOOR(4.7,3)', {})).toBe(3);
  });

  it('defaults significance to 1', () => {
    expect(evaluateFormula('=CEILING(4.2)', {})).toBe(5);
    expect(evaluateFormula('=FLOOR(4.8)', {})).toBe(4);
  });

  it('does not leak floating point noise for decimal significance', () => {
    expect(evaluateFormula('=CEILING(4.2,0.1)', {})).toBe(4.2);
    expect(evaluateFormula('=FLOOR(0.7,0.1)', {})).toBe(0.7);
  });

  it('handles negative numbers the way Excel does', () => {
    expect(evaluateFormula('=CEILING(-4.2)', {})).toBe(-4);
    expect(evaluateFormula('=FLOOR(-4.2)', {})).toBe(-5);
    expect(evaluateFormula('=CEILING(-4.2,-1)', {})).toBe(-5);
    expect(evaluateFormula('=FLOOR(-4.2,-1)', {})).toBe(-4);
  });

  it('rejects mismatched signs and zero significance', () => {
    expect(evaluateFormula('=CEILING(4.2,-1)', {})).toBe('#NUM!');
    expect(evaluateFormula('=FLOOR(4.2,-1)', {})).toBe('#NUM!');
    expect(evaluateFormula('=CEILING(4.2,0)', {})).toBe(0);
    expect(evaluateFormula('=FLOOR(4.2,0)', {})).toBe('#DIV/0!');
    expect(evaluateFormula('=CEILING("abc",1)', {})).toBe('#NUM!');
  });
});

describe('trailing token rejection', () => {
  it('rejects leftover tokens after a complete expression', () => {
    expect(evaluateFormula('=1+2 3', {})).toBe('#ERROR!');
    expect(evaluateFormula('=1,2', {})).toBe('#ERROR!');
    expect(evaluateFormula('=SUM(A1:A2) 5', {})).toBe('#ERROR!');
  });

  it('rejects leftover tokens after a parenthesised expression', () => {
    expect(evaluateFormula('=(1+2) 4', {})).toBe('#ERROR!');
    expect(evaluateFormula('=IF(TRUE(),"a","b") "c"', {})).toBe('#ERROR!');
  });

  it('still accepts well formed formulas', () => {
    expect(evaluateFormula('=1+2', {})).toBe(3);
    expect(evaluateFormula('=(1+2)*3', {})).toBe(9);
    expect(evaluateFormula('=SUM(A1:A2)', grid({ A1: '1', A2: '2' }))).toBe(3);
    expect(evaluateFormula('=IF(TRUE(),"a","b")', {})).toBe('a');
  });

  it('reports trailing token errors through cell recalculation', () => {
    const g = grid({ A1: '1', A2: '=A1 A1' });
    expect(g.A2.computed).toBe('#ERROR!');
  });
});
