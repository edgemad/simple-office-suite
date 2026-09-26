import { describe, it, expect } from 'vitest';
import { escapeCsvField, isFormulaInjection, neutralizeFormula, toCsv } from './csv';

describe('RFC 4180 field escaping', () => {
  it('leaves plain fields untouched', () => {
    expect(escapeCsvField('hello')).toBe('hello');
    expect(escapeCsvField(42)).toBe('42');
    expect(escapeCsvField(0)).toBe('0');
    expect(escapeCsvField('')).toBe('');
    expect(escapeCsvField(null)).toBe('');
    expect(escapeCsvField(undefined)).toBe('');
  });

  it('quotes fields containing the delimiter', () => {
    expect(escapeCsvField('a,b')).toBe('"a,b"');
    expect(escapeCsvField('a;b', { delimiter: ';' })).toBe('"a;b"');
    expect(toCsv([['a;b', 'c']], { delimiter: ';' })).toBe('"a;b";c');
  });

  it('doubles embedded double quotes', () => {
    expect(escapeCsvField('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCsvField('"')).toBe('""""');
  });

  it('quotes fields containing CR, LF or CRLF', () => {
    expect(escapeCsvField('line1\nline2')).toBe('"line1\nline2"');
    expect(escapeCsvField('line1\r\nline2')).toBe('"line1\r\nline2"');
  });

  it('quotes fields with leading or trailing whitespace so it survives the round trip', () => {
    expect(escapeCsvField(' padded ')).toBe('" padded "');
    expect(escapeCsvField('\ttabbed')).toBe('"\ttabbed"');
  });

  it('serializes rows with CRLF record separators by default', () => {
    expect(
      toCsv([
        ['name', 'note'],
        ['Doe, Jane', 'said "hi"'],
      ])
    ).toBe('name,note\r\n"Doe, Jane","said ""hi"""');
  });

  it('supports a custom delimiter, newline and neutralization switch', () => {
    expect(toCsv([['a', 'b']], { delimiter: ';', newline: '\n' })).toBe('a;b');
    expect(toCsv([['=1+1']], { neutralizeFormulas: false })).toBe('=1+1');
    expect(toCsv([['=1+1']])).toBe("'=1+1");
  });

  it('returns an empty string for no rows', () => {
    expect(toCsv([])).toBe('');
  });
});

describe('spreadsheet formula injection neutralization', () => {
  it('detects dangerous leading characters', () => {
    expect(isFormulaInjection('=1+1')).toBe(true);
    expect(isFormulaInjection('@SUM(A1)')).toBe(true);
    expect(isFormulaInjection('+1+1')).toBe(true);
    expect(isFormulaInjection('-1+1')).toBe(true);
    expect(isFormulaInjection('\t=1+1')).toBe(true);
    expect(isFormulaInjection('\r=1+1')).toBe(true);
    expect(isFormulaInjection('  =cmd|calc')).toBe(true);
  });

  it('does not flag plain text or numbers', () => {
    expect(isFormulaInjection('hello')).toBe(false);
    expect(isFormulaInjection('')).toBe(false);
    expect(isFormulaInjection('42')).toBe(false);
    expect(isFormulaInjection('-42')).toBe(false);
    expect(isFormulaInjection('-42.5')).toBe(false);
    expect(isFormulaInjection('+42')).toBe(false);
    expect(isFormulaInjection('1e5')).toBe(false);
    expect(isFormulaInjection('a=b')).toBe(false);
    expect(isFormulaInjection('  spaced text')).toBe(false);
  });

  it('prefixes dangerous values with an apostrophe', () => {
    expect(neutralizeFormula('=1+1')).toBe("'=1+1");
    expect(neutralizeFormula('@evil')).toBe("'@evil");
    expect(neutralizeFormula('safe')).toBe('safe');
  });

  it('escapes after neutralizing so quotes stay RFC compliant', () => {
    expect(escapeCsvField('=HYPERLINK("http://x"),1')).toBe('"\'=HYPERLINK(""http://x""),1"');
    expect(escapeCsvField('=1+1')).toBe("'=1+1");
  });

  it('neutralizes every cell of a generated export', () => {
    expect(
      toCsv([
        ['=cmd|calc', '=1+1'],
        ['normal', '-12'],
      ])
    ).toBe("'=cmd|calc,'=1+1\r\nnormal,-12");
  });
});
