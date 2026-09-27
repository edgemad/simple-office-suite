import type { SheetGrid } from '../../types';
import {
  colToLetter,
  letterToCol,
  parseCoord,
  FORMULA_CATALOG,
  type FormulaSuggestion as FormulaDefinition,
  getFormulaSuggestions,
} from './formulaEngine';

export type { FormulaDefinition };
export { FORMULA_CATALOG, getFormulaSuggestions };

/**
 * Searches and returns matching formula definitions for an input prefix
 */
export function getMatchingFormulas(input: string): FormulaDefinition[] {
  return getFormulaSuggestions(input);
}

/**
 * Parses current editing text to detect which formula and argument index is currently active
 */
export function detectActiveFormula(text: string): {
  name: string;
  argIndex: number;
  def?: FormulaDefinition;
} | null {
  if (!text.startsWith('=')) return null;

  // Match the last function opened with '(' that is not closed
  let depth = 0;
  let lastOpenParenIndex = -1;

  for (let i = 0; i < text.length; i++) {
    if (text[i] === '(') {
      depth++;
      lastOpenParenIndex = i;
    } else if (text[i] === ')') {
      depth = Math.max(0, depth - 1);
    }
  }

  if (depth === 0 || lastOpenParenIndex === -1) return null;

  // Extract function name preceding the open paren
  const prefix = text.slice(0, lastOpenParenIndex);
  const fnMatch = prefix.match(/([A-Z0-9_]+)$/i);
  if (!fnMatch) return null;

  const fnName = fnMatch[1].toUpperCase();
  const def = FORMULA_CATALOG.find((f) => f.name === fnName);
  if (!def) return null;

  // Count commas inside the current parenthesis
  const argsText = text.slice(lastOpenParenIndex + 1);
  let argIndex = 0;
  let innerDepth = 0;
  for (let i = 0; i < argsText.length; i++) {
    if (argsText[i] === '(') innerDepth++;
    else if (argsText[i] === ')') innerDepth--;
    else if (argsText[i] === ',' && innerDepth === 0) argIndex++;
  }

  return { name: fnName, argIndex, def };
}

/**
 * OnlyOffice / Google Sheets style Smart Formula Auto-Suggestion
 * Detects whether the active cell is located immediately below a column of numbers
 * or to the right of a row of numbers, and suggests =SUM(...) or =AVERAGE(...)
 */
export function getSmartFormulaSuggestion(activeCell: string, grid: SheetGrid): string | null {
  const coord = parseCoord(activeCell);
  if (!coord) return null;

  const { col, row } = coord;

  // 1. Check if there are 2 or more numbers immediately above in the same column
  let numbersAbove = 0;
  let topRow = row - 1;
  while (topRow >= 0) {
    const key = `${colToLetter(col)}${topRow + 1}`;
    const cellVal = grid[key]?.computed;
    if (
      typeof cellVal === 'number' ||
      (typeof cellVal === 'string' &&
        !isNaN(Number(cellVal.replace(/[$,]/g, ''))) &&
        cellVal.trim() !== '')
    ) {
      numbersAbove++;
      topRow--;
    } else {
      break;
    }
  }

  if (numbersAbove >= 2) {
    const startCell = `${colToLetter(col)}${topRow + 2}`;
    const endCell = `${colToLetter(col)}${row}`;
    return `=SUM(${startCell}:${endCell})`;
  }

  // 2. Check if there are 2 or more numbers immediately to the left in the same row
  let numbersLeft = 0;
  let leftCol = col - 1;
  while (leftCol >= 0) {
    const key = `${colToLetter(leftCol)}${row + 1}`;
    const cellVal = grid[key]?.computed;
    if (
      typeof cellVal === 'number' ||
      (typeof cellVal === 'string' &&
        !isNaN(Number(cellVal.replace(/[$,]/g, ''))) &&
        cellVal.trim() !== '')
    ) {
      numbersLeft++;
      leftCol--;
    } else {
      break;
    }
  }

  if (numbersLeft >= 2) {
    const startCell = `${colToLetter(leftCol + 1)}${row + 1}`;
    const endCell = `${colToLetter(col - 1)}${row + 1}`;
    return `=SUM(${startCell}:${endCell})`;
  }

  return null;
}
