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

// Helper to extract numeric values from cell keys
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
          const parsed = parseFloat(val);
          if (!isNaN(parsed)) values.push(parsed);
        }
      }
    } else {
      // Direct cell or number literal
      const cell = grid[token.toUpperCase()];
      if (cell !== undefined) {
        const parsed = typeof cell.computed === 'number' ? cell.computed : parseFloat(String(cell.computed));
        if (!isNaN(parsed)) values.push(parsed);
      } else {
        const num = parseFloat(token);
        if (!isNaN(num)) values.push(num);
      }
    }
  }

  return values;
}

// Evaluate a single formula expression
export function evaluateFormula(formula: string, grid: SheetGrid, visiting: Set<string> = new Set()): string | number {
  const clean = formula.trim();
  if (!clean.startsWith('=')) {
    // Check if it's purely a number
    const num = Number(clean);
    return isNaN(num) || clean === '' ? clean : num;
  }

  const expr = clean.slice(1).trim();

  // Function calls: SUM, AVERAGE, COUNT, MIN, MAX, IF
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
        const sum = nums.reduce((acc, curr) => acc + curr, 0);
        return Math.round((sum / nums.length) * 100) / 100;
      }
      case 'COUNT': {
        const nums = getNumericValues(grid, argsStr);
        return nums.length;
      }
      case 'MIN': {
        const nums = getNumericValues(grid, argsStr);
        return nums.length ? Math.min(...nums) : 0;
      }
      case 'MAX': {
        const nums = getNumericValues(grid, argsStr);
        return nums.length ? Math.max(...nums) : 0;
      }
      case 'IF': {
        // e.g. IF(A1 > 10, "Yes", "No") or IF(A1=10, 100, 0)
        const parts = argsStr.split(',').map((p) => p.trim());
        if (parts.length >= 2) {
          const condition = parts[0];
          const trueVal = parts[1].replace(/^["']|["']$/g, '');
          const falseVal = parts[2] ? parts[2].replace(/^["']|["']$/g, '') : '';

          try {
            // Replace cell references in condition
            const resolvedCond = condition.replace(/[A-Z]+[0-9]+/gi, (match) => {
              const val = grid[match.toUpperCase()]?.computed ?? 0;
              return typeof val === 'string' ? `"${val}"` : String(val);
            });
            // Safe simple evaluation
            // eslint-disable-next-line no-eval
            const result = Function(`"use strict"; return (${resolvedCond});`)();
            return result ? (isNaN(Number(trueVal)) ? trueVal : Number(trueVal)) : (isNaN(Number(falseVal)) ? falseVal : Number(falseVal));
          } catch {
            return '#VALUE!';
          }
        }
        return '#ARG!';
      }
      default:
        return `#NAME? (${fnName})`;
    }
  }

  // Arithmetic expression evaluation: e.g. A1 + B1 * 2
  try {
    const resolvedExpr = expr.replace(/[A-Z]+[0-9]+/gi, (match) => {
      const key = match.toUpperCase();
      if (visiting.has(key)) return '0'; // Prevent circular reference
      const cell = grid[key];
      if (!cell) return '0';
      const num = typeof cell.computed === 'number' ? cell.computed : parseFloat(String(cell.computed));
      return isNaN(num) ? '0' : String(num);
    });

    // Safe arithmetic computation using Function constructor
    // eslint-disable-next-line no-eval
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
