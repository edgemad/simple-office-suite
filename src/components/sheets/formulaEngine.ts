import type { SheetGrid } from '../../types';

// Convert column index (0-based) to letter (0 -> A, 25 -> Z, 26 -> AA)
export function colToLetter(colIndex: number): string {
  let temp = colIndex;
  let letter = '';
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
}

// Convert column letter to index (A -> 0, Z -> 25, AA -> 26)
export function letterToCol(letter: string): number {
  let col = 0;
  for (let i = 0; i < letter.length; i++) {
    col = col * 26 + (letter.charCodeAt(i) - 64);
  }
  return col - 1;
}

// Parse coordinate string like "A1" into { col: 0, row: 0 }
export function parseCoord(coord: string): { col: number; row: number } | null {
  const match = coord.toUpperCase().match(/^([A-Z]+)([0-9]+)$/);
  if (!match) return null;
  return {
    col: letterToCol(match[1]),
    row: parseInt(match[2], 10) - 1,
  };
}

// Expand a range like "A1:A5" into array of cell keys ["A1", "A2", "A3", "A4", "A5"]
export function expandRange(rangeStr: string): string[] {
  const parts = rangeStr.split(':');
  if (parts.length === 1) return [parts[0].trim().toUpperCase()];
  if (parts.length !== 2) return [];

  const start = parseCoord(parts[0].trim());
  const end = parseCoord(parts[1].trim());
  if (!start || !end) return [];

  const minCol = Math.min(start.col, end.col);
  const maxCol = Math.max(start.col, end.col);
  const minRow = Math.min(start.row, end.row);
  const maxRow = Math.max(start.row, end.row);

  const keys: string[] = [];
  for (let c = minCol; c <= maxCol; c++) {
    const colStr = colToLetter(c);
    for (let r = minRow; r <= maxRow; r++) {
      keys.push(`${colStr}${r + 1}`);
    }
  }
  return keys;
}

// Extract numeric values from arguments (handles cell references, ranges, literals)
function getNumericValues(grid: SheetGrid, argsStr: string): number[] {
  const tokens = argsStr.split(',').map((t) => t.trim());
  const values: number[] = [];

  for (const token of tokens) {
    if (token.includes(':')) {
      const cellKeys = expandRange(token);
      for (const k of cellKeys) {
        const val = grid[k]?.computed;
        if (typeof val === 'number' && !isNaN(val)) {
          values.push(val);
        } else if (typeof val === 'string' && val.trim() !== '') {
          const parsed = parseFloat(val.replace(/[$,]/g, ''));
          if (!isNaN(parsed)) values.push(parsed);
        }
      }
    } else {
      const cell = grid[token.toUpperCase()];
      if (cell !== undefined) {
        const parsed = typeof cell.computed === 'number' ? cell.computed : parseFloat(String(cell.computed).replace(/[$,]/g, ''));
        if (!isNaN(parsed)) values.push(parsed);
      } else {
        const num = parseFloat(token.replace(/[$,]/g, ''));
        if (!isNaN(num)) values.push(num);
      }
    }
  }

  return values;
}

// Extract raw string/numeric values from cell keys
function getRawValues(grid: SheetGrid, argsStr: string): (string | number)[] {
  const tokens = argsStr.split(',').map((t) => t.trim());
  const values: (string | number)[] = [];

  for (const token of tokens) {
    if (token.includes(':')) {
      const cellKeys = expandRange(token);
      for (const k of cellKeys) {
        const cell = grid[k];
        if (cell && cell.computed !== undefined && cell.computed !== '') {
          values.push(cell.computed);
        }
      }
    } else {
      const cell = grid[token.toUpperCase()];
      if (cell !== undefined) {
        values.push(cell.computed);
      } else {
        values.push(token.replace(/^["']|["']$/g, ''));
      }
    }
  }
  return values;
}

// Evaluate spreadsheet formula supporting MS Excel & Google Sheets syntax
export function evaluateFormula(formula: string, grid: SheetGrid, visiting: Set<string> = new Set()): string | number {
  const clean = formula.trim();
  if (!clean.startsWith('=')) {
    const num = Number(clean);
    return isNaN(num) || clean === '' ? clean : num;
  }

  const expr = clean.slice(1).trim();

  // Function calls: SUM, AVERAGE, COUNT, COUNTA, MIN, MAX, MEDIAN, ROUND, SQRT, POWER, ABS, IF, CONCAT, UPPER, LOWER, LEN, TRIM, VLOOKUP
  const fnMatch = expr.match(/^([A-Z]+)\((.*)\)$/i);
  if (fnMatch) {
    const fnName = fnMatch[1].toUpperCase();
    const argsStr = fnMatch[2].trim();

    switch (fnName) {
      case 'SUM': {
        const nums = getNumericValues(grid, argsStr);
        return nums.reduce((acc, curr) => acc + curr, 0);
      }
      case 'AVERAGE': {
        const nums = getNumericValues(grid, argsStr);
        if (nums.length === 0) return 0;
        return Math.round((nums.reduce((acc, curr) => acc + curr, 0) / nums.length) * 100) / 100;
      }
      case 'COUNT': {
        const nums = getNumericValues(grid, argsStr);
        return nums.length;
      }
      case 'COUNTA': {
        const vals = getRawValues(grid, argsStr);
        return vals.length;
      }
      case 'MIN': {
        const nums = getNumericValues(grid, argsStr);
        return nums.length ? Math.min(...nums) : 0;
      }
      case 'MAX': {
        const nums = getNumericValues(grid, argsStr);
        return nums.length ? Math.max(...nums) : 0;
      }
      case 'MEDIAN': {
        const nums = getNumericValues(grid, argsStr).sort((a, b) => a - b);
        if (!nums.length) return 0;
        const mid = Math.floor(nums.length / 2);
        return nums.length % 2 !== 0 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
      }
      case 'PRODUCT': {
        const nums = getNumericValues(grid, argsStr);
        return nums.length ? nums.reduce((a, b) => a * b, 1) : 0;
      }
      case 'ROUND': {
        const parts = argsStr.split(',').map(s => s.trim());
        const val = Number(evaluateFormula(`=${parts[0]}`, grid, visiting));
        const decimals = parts[1] ? parseInt(parts[1], 10) : 0;
        const factor = Math.pow(10, decimals);
        return Math.round(val * factor) / factor;
      }
      case 'ABS': {
        const val = Number(evaluateFormula(`=${argsStr}`, grid, visiting));
        return Math.abs(val);
      }
      case 'SQRT': {
        const val = Number(evaluateFormula(`=${argsStr}`, grid, visiting));
        return val >= 0 ? Math.sqrt(val) : '#NUM!';
      }
      case 'POWER': {
        const parts = argsStr.split(',').map(s => s.trim());
        const base = Number(evaluateFormula(`=${parts[0]}`, grid, visiting));
        const exp = Number(evaluateFormula(`=${parts[1]}`, grid, visiting));
        return Math.pow(base, exp);
      }
      case 'IF': {
        const parts = argsStr.split(',').map((p) => p.trim());
        if (parts.length >= 2) {
          const condition = parts[0];
          const trueVal = parts[1].replace(/^["']|["']$/g, '');
          const falseVal = parts[2] ? parts[2].replace(/^["']|["']$/g, '') : '';

          try {
            const resolvedCond = condition.replace(/[A-Z]+[0-9]+/gi, (match) => {
              const val = grid[match.toUpperCase()]?.computed ?? 0;
              return typeof val === 'string' ? `"${val}"` : String(val);
            });
            const result = Function(`"use strict"; return (${resolvedCond});`)();
            return result ? (isNaN(Number(trueVal)) ? trueVal : Number(trueVal)) : (isNaN(Number(falseVal)) ? falseVal : Number(falseVal));
          } catch {
            return '#VALUE!';
          }
        }
        return '#ARG!';
      }
      case 'CONCAT':
      case 'CONCATENATE': {
        const vals = getRawValues(grid, argsStr);
        return vals.join('');
      }
      case 'UPPER': {
        const vals = getRawValues(grid, argsStr);
        return String(vals[0] || '').toUpperCase();
      }
      case 'LOWER': {
        const vals = getRawValues(grid, argsStr);
        return String(vals[0] || '').toLowerCase();
      }
      case 'LEN': {
        const vals = getRawValues(grid, argsStr);
        return String(vals[0] || '').length;
      }
      case 'TRIM': {
        const vals = getRawValues(grid, argsStr);
        return String(vals[0] || '').trim();
      }
      case 'VLOOKUP': {
        // VLOOKUP(lookup_value, table_range, col_index)
        const parts = argsStr.split(',').map(s => s.trim());
        if (parts.length < 3) return '#N/A';
        const lookup = parts[0].replace(/^["']|["']$/g, '');
        const range = parts[1];
        const colOffset = parseInt(parts[2], 10) - 1;

        const cells = expandRange(range);
        const start = parseCoord(range.split(':')[0]);
        const end = parseCoord(range.split(':')[1]);
        if (!start || !end) return '#REF!';

        for (let r = start.row; r <= end.row; r++) {
          const keyFirst = `${colToLetter(start.col)}${r + 1}`;
          const targetKey = `${colToLetter(start.col + colOffset)}${r + 1}`;
          if (String(grid[keyFirst]?.computed) === lookup) {
            return grid[targetKey]?.computed ?? '';
          }
        }
        return '#N/A';
      }
      default:
        return `#NAME? (${fnName})`;
    }
  }

  // Arithmetic expression evaluation: e.g. A1 + B1 * 2
  try {
    const resolvedExpr = expr.replace(/[A-Z]+[0-9]+/gi, (match) => {
      const key = match.toUpperCase();
      if (visiting.has(key)) return '0';
      const cell = grid[key];
      if (!cell) return '0';
      const num = typeof cell.computed === 'number' ? cell.computed : parseFloat(String(cell.computed).replace(/[$,]/g, ''));
      return isNaN(num) ? '0' : String(num);
    });

    const computed = Function(`"use strict"; return (${resolvedExpr});`)();
    return typeof computed === 'number' ? Math.round(computed * 1000) / 1000 : computed;
  } catch {
    return '#ERROR!';
  }
}

// Recomputes all cells in a sheet grid
export function recalculateGrid(grid: SheetGrid): SheetGrid {
  const updated: SheetGrid = { ...grid };
  for (const [key, cell] of Object.entries(updated)) {
    if (cell.raw.startsWith('=')) {
      cell.computed = evaluateFormula(cell.raw, updated, new Set([key]));
    } else {
      const num = Number(cell.raw);
      cell.computed = isNaN(num) || cell.raw.trim() === '' ? cell.raw : num;
    }
  }
  return updated;
}
