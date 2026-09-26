import type { SheetGrid } from '../../types';
import { colToLetter, parseCoord } from './formulaEngine';

export interface FormulaDefinition {
  name: string;
  category: 'Math' | 'Statistical' | 'Logical' | 'Text' | 'Lookup' | 'Date & Time';
  syntax: string;
  args: string[];
  description: string;
  example: string;
}

export const FORMULA_CATALOG: FormulaDefinition[] = [
  // --- Math & Trigonometry ---
  {
    name: 'SUM',
    category: 'Math',
    syntax: 'SUM(number1, [number2], ...)',
    args: ['number1', '[number2]', '...'],
    description: 'Adds all numbers in a range of cells.',
    example: '=SUM(A1:A10)',
  },
  {
    name: 'PRODUCT',
    category: 'Math',
    syntax: 'PRODUCT(number1, [number2], ...)',
    args: ['number1', '[number2]', '...'],
    description: 'Multiplies all the numbers given as arguments.',
    example: '=PRODUCT(A1:A5)',
  },
  {
    name: 'ROUND',
    category: 'Math',
    syntax: 'ROUND(number, num_digits)',
    args: ['number', 'num_digits'],
    description: 'Rounds a number to a specified number of digits.',
    example: '=ROUND(A1, 2)',
  },
  {
    name: 'ROUNDUP',
    category: 'Math',
    syntax: 'ROUNDUP(number, num_digits)',
    args: ['number', 'num_digits'],
    description: 'Rounds a number up, away from 0 (zero).',
    example: '=ROUNDUP(A1, 0)',
  },
  {
    name: 'ROUNDDOWN',
    category: 'Math',
    syntax: 'ROUNDDOWN(number, num_digits)',
    args: ['number', 'num_digits'],
    description: 'Rounds a number down, toward 0 (zero).',
    example: '=ROUNDDOWN(A1, 0)',
  },
  {
    name: 'ABS',
    category: 'Math',
    syntax: 'ABS(number)',
    args: ['number'],
    description: 'Returns the absolute value of a number (without sign).',
    example: '=ABS(-42)',
  },
  {
    name: 'SQRT',
    category: 'Math',
    syntax: 'SQRT(number)',
    args: ['number'],
    description: 'Returns a positive square root.',
    example: '=SQRT(16)',
  },
  {
    name: 'POWER',
    category: 'Math',
    syntax: 'POWER(number, power)',
    args: ['number', 'power'],
    description: 'Returns the result of a number raised to a power.',
    example: '=POWER(2, 8)',
  },
  {
    name: 'MOD',
    category: 'Math',
    syntax: 'MOD(number, divisor)',
    args: ['number', 'divisor'],
    description: 'Returns the remainder after a number is divided by a divisor.',
    example: '=MOD(10, 3)',
  },
  {
    name: 'INT',
    category: 'Math',
    syntax: 'INT(number)',
    args: ['number'],
    description: 'Rounds a number down to the nearest integer.',
    example: '=INT(8.9)',
  },
  {
    name: 'CEILING',
    category: 'Math',
    syntax: 'CEILING(number, [significance])',
    args: ['number', '[significance]'],
    description: 'Rounds a number up to the nearest integer multiple of significance.',
    example: '=CEILING(4.2, 0.5)',
  },
  {
    name: 'FLOOR',
    category: 'Math',
    syntax: 'FLOOR(number, [significance])',
    args: ['number', '[significance]'],
    description: 'Rounds a number down to the nearest integer multiple of significance.',
    example: '=FLOOR(4.7, 0.5)',
  },

  // --- Statistical ---
  {
    name: 'AVERAGE',
    category: 'Statistical',
    syntax: 'AVERAGE(number1, [number2], ...)',
    args: ['number1', '[number2]', '...'],
    description: 'Calculates the arithmetic mean of a group of numbers.',
    example: '=AVERAGE(B2:B10)',
  },
  {
    name: 'AVG',
    category: 'Statistical',
    syntax: 'AVG(number1, [number2], ...)',
    args: ['number1', '[number2]', '...'],
    description: 'Alias for AVERAGE. Calculates the arithmetic mean.',
    example: '=AVG(B2:B10)',
  },
  {
    name: 'COUNT',
    category: 'Statistical',
    syntax: 'COUNT(value1, [value2], ...)',
    args: ['value1', '[value2]', '...'],
    description: 'Counts how many numbers are in the list of arguments.',
    example: '=COUNT(A1:A20)',
  },
  {
    name: 'COUNTA',
    category: 'Statistical',
    syntax: 'COUNTA(value1, [value2], ...)',
    args: ['value1', '[value2]', '...'],
    description: 'Counts how many values are in the list of arguments (non-empty).',
    example: '=COUNTA(A1:A20)',
  },
  {
    name: 'COUNTBLANK',
    category: 'Statistical',
    syntax: 'COUNTBLANK(range)',
    args: ['range'],
    description: 'Counts empty cells in a specified range of cells.',
    example: '=COUNTBLANK(A1:A20)',
  },
  {
    name: 'COUNTIF',
    category: 'Statistical',
    syntax: 'COUNTIF(range, criteria)',
    args: ['range', 'criteria'],
    description: 'Counts the number of cells that meet a given criteria.',
    example: '=COUNTIF(A1:A20, ">10")',
  },
  {
    name: 'COUNTIFS',
    category: 'Statistical',
    syntax: 'COUNTIFS(criteria_range1, criteria1, ...)',
    args: ['criteria_range1', 'criteria1', '...'],
    description: 'Counts the number of cells that meet multiple criteria.',
    example: '=COUNTIFS(A1:A10, ">0", B1:B10, "<50")',
  },
  {
    name: 'SUMIF',
    category: 'Statistical',
    syntax: 'SUMIF(range, criteria, [sum_range])',
    args: ['range', 'criteria', '[sum_range]'],
    description: 'Adds cells specified by a given condition or criteria.',
    example: '=SUMIF(A1:A10, ">100", B1:B10)',
  },
  {
    name: 'SUMIFS',
    category: 'Statistical',
    syntax: 'SUMIFS(sum_range, criteria_range1, criteria1, ...)',
    args: ['sum_range', 'criteria_range1', 'criteria1', '...'],
    description: 'Adds cells in a range that meet multiple criteria.',
    example: '=SUMIFS(C1:C10, A1:A10, "Yes", B1:B10, ">0")',
  },
  {
    name: 'AVERAGEIF',
    category: 'Statistical',
    syntax: 'AVERAGEIF(range, criteria, [average_range])',
    args: ['range', 'criteria', '[average_range]'],
    description: 'Returns the average of cells that meet a given criteria.',
    example: '=AVERAGEIF(A1:A10, ">0", B1:B10)',
  },
  {
    name: 'MIN',
    category: 'Statistical',
    syntax: 'MIN(number1, [number2], ...)',
    args: ['number1', '[number2]', '...'],
    description: 'Returns the smallest number in a set of values.',
    example: '=MIN(A1:A10)',
  },
  {
    name: 'MAX',
    category: 'Statistical',
    syntax: 'MAX(number1, [number2], ...)',
    args: ['number1', '[number2]', '...'],
    description: 'Returns the largest number in a set of values.',
    example: '=MAX(A1:A10)',
  },
  {
    name: 'MEDIAN',
    category: 'Statistical',
    syntax: 'MEDIAN(number1, [number2], ...)',
    args: ['number1', '[number2]', '...'],
    description: 'Returns the median of the given numbers.',
    example: '=MEDIAN(A1:A10)',
  },

  // --- Logical ---
  {
    name: 'IF',
    category: 'Logical',
    syntax: 'IF(logical_test, value_if_true, [value_if_false])',
    args: ['logical_test', 'value_if_true', '[value_if_false]'],
    description: 'Checks whether a condition is met; returns one value if TRUE, another if FALSE.',
    example: '=IF(A1>0, "Positive", "Non-positive")',
  },
  {
    name: 'IFS',
    category: 'Logical',
    syntax: 'IFS(logical_test1, value_if_true1, ...)',
    args: ['logical_test1', 'value_if_true1', '...'],
    description: 'Checks multiple conditions and returns a value corresponding to the first TRUE.',
    example: '=IFS(A1>90, "A", A1>80, "B", TRUE, "C")',
  },
  {
    name: 'IFERROR',
    category: 'Logical',
    syntax: 'IFERROR(value, value_if_error)',
    args: ['value', 'value_if_error'],
    description: 'Returns a value you specify if formula evaluates to error; otherwise returns result.',
    example: '=IFERROR(A1/B1, 0)',
  },
  {
    name: 'IFNA',
    category: 'Logical',
    syntax: 'IFNA(value, value_if_na)',
    args: ['value', 'value_if_na'],
    description: 'Returns the value you specify if the expression resolves to #N/A.',
    example: '=IFNA(VLOOKUP("item", A1:B10, 2, FALSE), "Not Found")',
  },
  {
    name: 'AND',
    category: 'Logical',
    syntax: 'AND(logical1, [logical2], ...)',
    args: ['logical1', '[logical2]', '...'],
    description: 'Returns TRUE if all its arguments are TRUE.',
    example: '=AND(A1>0, B1>0)',
  },
  {
    name: 'OR',
    category: 'Logical',
    syntax: 'OR(logical1, [logical2], ...)',
    args: ['logical1', '[logical2]', '...'],
    description: 'Returns TRUE if any argument is TRUE.',
    example: '=OR(A1>0, B1>0)',
  },
  {
    name: 'NOT',
    category: 'Logical',
    syntax: 'NOT(logical)',
    args: ['logical'],
    description: 'Reverses the logic of its argument.',
    example: '=NOT(A1=0)',
  },
  {
    name: 'XOR',
    category: 'Logical',
    syntax: 'XOR(logical1, [logical2], ...)',
    args: ['logical1', '[logical2]', '...'],
    description: 'Returns a logical exclusive OR of all arguments.',
    example: '=XOR(A1>0, B1>0)',
  },
  {
    name: 'TRUE',
    category: 'Logical',
    syntax: 'TRUE()',
    args: [],
    description: 'Returns the logical value TRUE.',
    example: '=TRUE()',
  },
  {
    name: 'FALSE',
    category: 'Logical',
    syntax: 'FALSE()',
    args: [],
    description: 'Returns the logical value FALSE.',
    example: '=FALSE()',
  },

  // --- Lookup & Reference ---
  {
    name: 'VLOOKUP',
    category: 'Lookup',
    syntax: 'VLOOKUP(lookup_value, table_array, col_index, [range_lookup])',
    args: ['lookup_value', 'table_array', 'col_index', '[range_lookup]'],
    description: 'Searches for a value in the first column and returns a value in the same row from a specified column. Omit range_lookup (or pass TRUE) for approximate match on a sorted first column.',
    example: '=VLOOKUP("Apple", A1:C10, 2, FALSE)',
  },
  {
    name: 'HLOOKUP',
    category: 'Lookup',
    syntax: 'HLOOKUP(lookup_value, table_array, row_index, [range_lookup])',
    args: ['lookup_value', 'table_array', 'row_index', '[range_lookup]'],
    description: 'Searches for a value in the top row and returns a value in the same column from a specified row. Omit range_lookup (or pass TRUE) for approximate match on a sorted top row.',
    example: '=HLOOKUP("Q1", A1:Z5, 2, FALSE)',
  },
  {
    name: 'INDEX',
    category: 'Lookup',
    syntax: 'INDEX(array, row_num, [col_num])',
    args: ['array', 'row_num', '[col_num]'],
    description: 'Returns the value of a cell at the intersection of a particular row and column. For a single column or single row array, row_num indexes along that array.',
    example: '=INDEX(A1:C10, 3, 2)',
  },
  {
    name: 'MATCH',
    category: 'Lookup',
    syntax: 'MATCH(lookup_value, lookup_array, [match_type])',
    args: ['lookup_value', 'lookup_array', '[match_type]'],
    description: 'Returns the relative position of an item in an array that matches a specified value.',
    example: '=MATCH("Target", A1:A10, 0)',
  },
  {
    name: 'XLOOKUP',
    category: 'Lookup',
    syntax: 'XLOOKUP(lookup_value, lookup_range, return_range, [if_not_found])',
    args: ['lookup_value', 'lookup_range', 'return_range', '[if_not_found]'],
    description: 'Searches a range or array and returns an item corresponding to the first match.',
    example: '=XLOOKUP("ID123", A1:A10, B1:B10, "Not Found")',
  },

  // --- Text ---
  {
    name: 'CONCAT',
    category: 'Text',
    syntax: 'CONCAT(text1, [text2], ...)',
    args: ['text1', '[text2]', '...'],
    description: 'Combines the text from multiple ranges and/or strings.',
    example: '=CONCAT(A1, " ", B1)',
  },
  {
    name: 'CONCATENATE',
    category: 'Text',
    syntax: 'CONCATENATE(text1, [text2], ...)',
    args: ['text1', '[text2]', '...'],
    description: 'Joins several text strings into one text string.',
    example: '=CONCATENATE(A1, "-", B1)',
  },
  {
    name: 'TEXTJOIN',
    category: 'Text',
    syntax: 'TEXTJOIN(delimiter, ignore_empty, text1, ...)',
    args: ['delimiter', 'ignore_empty', 'text1', '...'],
    description: 'Combines the text from multiple ranges and/or strings with a delimiter.',
    example: '=TEXTJOIN(", ", TRUE, A1:A5)',
  },
  {
    name: 'UPPER',
    category: 'Text',
    syntax: 'UPPER(text)',
    args: ['text'],
    description: 'Converts all characters in a text string to uppercase.',
    example: '=UPPER(A1)',
  },
  {
    name: 'LOWER',
    category: 'Text',
    syntax: 'LOWER(text)',
    args: ['text'],
    description: 'Converts all characters in a text string to lowercase.',
    example: '=LOWER(A1)',
  },
  {
    name: 'PROPER',
    category: 'Text',
    syntax: 'PROPER(text)',
    args: ['text'],
    description: 'Capitalizes the first letter in each word of a text value.',
    example: '=PROPER(A1)',
  },
  {
    name: 'LEN',
    category: 'Text',
    syntax: 'LEN(text)',
    args: ['text'],
    description: 'Returns the number of characters in a text string.',
    example: '=LEN(A1)',
  },
  {
    name: 'TRIM',
    category: 'Text',
    syntax: 'TRIM(text)',
    args: ['text'],
    description: 'Removes all spaces from text except for single spaces between words.',
    example: '=TRIM(A1)',
  },
  {
    name: 'LEFT',
    category: 'Text',
    syntax: 'LEFT(text, [num_chars])',
    args: ['text', '[num_chars]'],
    description: 'Returns the specified number of characters from the start of text.',
    example: '=LEFT(A1, 3)',
  },
  {
    name: 'RIGHT',
    category: 'Text',
    syntax: 'RIGHT(text, [num_chars])',
    args: ['text', '[num_chars]'],
    description: 'Returns the specified number of characters from the end of text.',
    example: '=RIGHT(A1, 4)',
  },
  {
    name: 'MID',
    category: 'Text',
    syntax: 'MID(text, start_num, num_chars)',
    args: ['text', 'start_num', 'num_chars'],
    description: 'Returns a specific number of characters from a text string starting at a position.',
    example: '=MID(A1, 2, 5)',
  },
  {
    name: 'SUBSTITUTE',
    category: 'Text',
    syntax: 'SUBSTITUTE(text, old_text, new_text)',
    args: ['text', 'old_text', 'new_text'],
    description: 'Substitutes new_text for old_text in a text string.',
    example: '=SUBSTITUTE(A1, "2025", "2026")',
  },
  {
    name: 'REPLACE',
    category: 'Text',
    syntax: 'REPLACE(old_text, start_num, num_chars, new_text)',
    args: ['old_text', 'start_num', 'num_chars', 'new_text'],
    description: 'Replaces part of a text string with a different text string.',
    example: '=REPLACE(A1, 1, 3, "SOS")',
  },
  {
    name: 'VALUE',
    category: 'Text',
    syntax: 'VALUE(text)',
    args: ['text'],
    description: 'Converts a text string that represents a number to a number.',
    example: '=VALUE("$1,250.00")',
  },
  {
    name: 'TEXT',
    category: 'Text',
    syntax: 'TEXT(value, format_text)',
    args: ['value', 'format_text'],
    description: 'Formats a number and converts it to text.',
    example: '=TEXT(A1, "$#,##0.00")',
  },

  // --- Date & Time ---
  {
    name: 'TODAY',
    category: 'Date & Time',
    syntax: 'TODAY()',
    args: [],
    description: 'Returns the current date formatted as YYYY-MM-DD.',
    example: '=TODAY()',
  },
  {
    name: 'NOW',
    category: 'Date & Time',
    syntax: 'NOW()',
    args: [],
    description: 'Returns the current date and time.',
    example: '=NOW()',
  },
  {
    name: 'DATE',
    category: 'Date & Time',
    syntax: 'DATE(year, month, day)',
    args: ['year', 'month', 'day'],
    description: 'Returns the serial date for a given year, month, and day.',
    example: '=DATE(2026, 9, 25)',
  },
];

/**
 * Searches and returns matching formula definitions for an input prefix
 */
export function getMatchingFormulas(input: string): FormulaDefinition[] {
  const clean = input.replace(/^=/, '').trim().toUpperCase();
  if (!clean) return FORMULA_CATALOG.slice(0, 10);

  return FORMULA_CATALOG.filter((f) => f.name.startsWith(clean) || f.name.includes(clean)).slice(0, 10);
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
    if (typeof cellVal === 'number' || (typeof cellVal === 'string' && !isNaN(Number(cellVal.replace(/[$,]/g, ''))) && cellVal.trim() !== '')) {
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
    if (typeof cellVal === 'number' || (typeof cellVal === 'string' && !isNaN(Number(cellVal.replace(/[$,]/g, ''))) && cellVal.trim() !== '')) {
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
