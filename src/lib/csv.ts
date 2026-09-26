export interface CsvOptions {
  delimiter?: string;
  newline?: string;
  neutralizeFormulas?: boolean;
}

export interface CsvFieldOptions {
  delimiter?: string;
  neutralizeFormulas?: boolean;
}

const NUMERIC_LITERAL = /^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/;
const LEADING_BLANKS = /^(?:[\t\r\n ]+|[\u00a0]+)/;

function looksNumeric(value: string): boolean {
  return NUMERIC_LITERAL.test(value.replace(/[,$£€¥\s]/g, ''));
}

export function isFormulaInjection(value: unknown): boolean {
  if (typeof value !== 'string' || value === '') return false;

  const probe = value.replace(LEADING_BLANKS, '');
  if (probe === '') return false;

  const first = probe[0];
  if (first === '=' || first === '@' || first === '\t' || first === '\r') return true;
  if (first === '+' || first === '-') return !looksNumeric(probe);
  return false;
}

export function neutralizeFormula(value: string): string {
  return isFormulaInjection(value) ? `'${value}` : value;
}

export function escapeCsvField(value: unknown, options: CsvFieldOptions = {}): string {
  const delimiter = options.delimiter ?? ',';
  const neutralize = options.neutralizeFormulas ?? true;

  const raw = value === null || value === undefined ? '' : String(value);
  if (raw === '') return '';

  const field = neutralize ? neutralizeFormula(raw) : raw;
  const needsQuotes =
    field.includes(delimiter) ||
    /[",\r\n]/.test(field) ||
    /^\s/.test(field) ||
    /\s$/.test(field);

  return needsQuotes ? `"${field.replace(/"/g, '""')}"` : field;
}

export function toCsv(rows: readonly (readonly unknown[])[], options: CsvOptions = {}): string {
  const delimiter = options.delimiter ?? ',';
  const newline = options.newline ?? '\r\n';
  const neutralize = options.neutralizeFormulas ?? true;

  return rows
    .map((row) =>
      row.map((cell) => escapeCsvField(cell, { delimiter, neutralizeFormulas: neutralize })).join(delimiter)
    )
    .join(newline);
}
