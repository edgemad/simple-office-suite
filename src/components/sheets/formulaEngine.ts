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
  const upper = letter.toUpperCase();
  for (let i = 0; i < upper.length; i++) {
    col = col * 26 + (upper.charCodeAt(i) - 64);
  }
  return col - 1;
}

// Parse coordinate string like "A1", "$B$4", "AA10" into { col: 0, row: 0 }
export function parseCoord(coord: string): { col: number; row: number } | null {
  const clean = coord.replace(/\$/g, '').trim().toUpperCase();
  const match = clean.match(/^([A-Z]+)([0-9]+)$/);
  if (!match) return null;
  return {
    col: letterToCol(match[1]),
    row: parseInt(match[2], 10) - 1,
  };
}

// Expand a range like "A1:A5" or "$B$4:$B$9" into array of cell keys ["A1", "A2", "A3", "A4", "A5"]
export function expandRange(rangeStr: string): string[] {
  const parts = rangeStr.split(':');
  if (parts.length === 1) {
    const coord = parseCoord(parts[0]);
    if (!coord) return [];
    return [`${colToLetter(coord.col)}${coord.row + 1}`];
  }
  if (parts.length !== 2) return [];

  const start = parseCoord(parts[0]);
  const end = parseCoord(parts[1]);
  if (!start || !end) return [];

  const minCol = Math.min(start.col, end.col);
  const maxCol = Math.max(start.col, end.col);
  const minRow = Math.min(start.row, end.row);
  const maxRow = Math.max(start.row, end.row);

  const keys: string[] = [];
  for (let r = minRow; r <= maxRow; r++) {
    for (let c = minCol; c <= maxCol; c++) {
      keys.push(`${colToLetter(c)}${r + 1}`);
    }
  }
  return keys;
}

// Normalize cell key (e.g. "$B$4" -> "B4", "b4" -> "B4")
function normalizeKey(key: string): string {
  const coord = parseCoord(key);
  return coord ? `${colToLetter(coord.col)}${coord.row + 1}` : key.toUpperCase();
}

// Extract cell value with dependency tracking & circular reference check
export function getCellValue(
  key: string,
  grid: SheetGrid,
  evaluating: Set<string>,
  computedCache: Map<string, string | number>
): string | number {
  const normKey = normalizeKey(key);

  if (evaluating.has(normKey)) {
    return '#CIRCULAR!';
  }

  if (computedCache.has(normKey)) {
    return computedCache.get(normKey)!;
  }

  const cell = grid[normKey];
  if (!cell) {
    return '';
  }

  const raw = String(cell.raw ?? '').trim();
  if (!raw.startsWith('=')) {
    const num = Number(raw);
    const val = !isNaN(num) && raw !== '' ? num : raw;
    computedCache.set(normKey, val);
    return val;
  }

  // Cell has a formula
  evaluating.add(normKey);
  const result = evaluateFormulaInternal(raw, grid, evaluating, computedCache);
  evaluating.delete(normKey);

  // If calculation failed, but original cell had a cached computed value from imported file
  if (
    typeof result === 'string' &&
    (result.startsWith('#NAME?') || result.startsWith('#ERROR!')) &&
    cell.computed !== undefined &&
    cell.computed !== '' &&
    cell.computed !== result
  ) {
    computedCache.set(normKey, cell.computed);
    return cell.computed;
  }

  computedCache.set(normKey, result);
  return result;
}

// Helper: criteria matching for COUNTIF, SUMIF, etc.
function matchesCriteria(val: string | number, criteria: string | number): boolean {
  if (criteria === undefined || criteria === null) return false;

  const critStr = String(criteria).trim();
  const valStr = String(val).trim();

  // If criteria has a comparison operator: >, >=, <, <=, <>, =, !=
  const compMatch = critStr.match(/^([><]=?|<>|!=|=)(.*)$/);
  if (compMatch) {
    const op = compMatch[1];
    const targetStr = compMatch[2].trim();
    const targetNum = Number(targetStr);
    const valNum = Number(val);

    if (!isNaN(targetNum) && !isNaN(valNum) && valStr !== '') {
      switch (op) {
        case '>': return valNum > targetNum;
        case '>=': return valNum >= targetNum;
        case '<': return valNum < targetNum;
        case '<=': return valNum <= targetNum;
        case '<>':
        case '!=': return valNum !== targetNum;
        case '=': return valNum === targetNum;
      }
    } else {
      const vLower = valStr.toLowerCase();
      const tLower = targetStr.toLowerCase();
      switch (op) {
        case '<>':
        case '!=': return vLower !== tLower;
        case '=': return vLower === tLower;
        default: return false;
      }
    }
  }

  // Number comparison if both are numbers
  const valNum = Number(val);
  const critNum = Number(criteria);
  if (!isNaN(valNum) && !isNaN(critNum) && valStr !== '' && critStr !== '') {
    return valNum === critNum;
  }

  // Wildcard match (* and ?)
  if (critStr.includes('*') || critStr.includes('?')) {
    const regexPattern = '^' + critStr.replace(/([.+^$[\]\\(){}|])/g, '\\$1').replace(/\*/g, '.*').replace(/\?/g, '.') + '$';
    try {
      const rx = new RegExp(regexPattern, 'i');
      return rx.test(valStr);
    } catch {
      return valStr.toLowerCase() === critStr.toLowerCase();
    }
  }

  // Exact case-insensitive match
  return valStr.toLowerCase() === critStr.toLowerCase();
}

// --- Formula Tokenizer and Expression Parser ---

type TokenType =
  | 'NUMBER'
  | 'STRING'
  | 'BOOLEAN'
  | 'IDENT'
  | 'CELL'
  | 'RANGE'
  | 'OPERATOR'
  | 'LPAREN'
  | 'RPAREN'
  | 'COMMA'
  | 'EOF';

interface Token {
  type: TokenType;
  value: any;
}

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const len = input.length;

  while (i < len) {
    const ch = input[i];

    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    // Number literal
    if (/[0-9]/.test(ch) || (ch === '.' && i + 1 < len && /[0-9]/.test(input[i + 1]))) {
      let numStr = '';
      while (i < len && /[0-9.]/.test(input[i])) {
        numStr += input[i++];
      }
      if (i < len && input[i] === '%') {
        i++;
        tokens.push({ type: 'NUMBER', value: parseFloat(numStr) / 100 });
      } else {
        tokens.push({ type: 'NUMBER', value: parseFloat(numStr) });
      }
      continue;
    }

    // String literal ("..." or '...')
    if (ch === '"' || ch === "'") {
      const quote = ch;
      i++;
      let str = '';
      while (i < len) {
        if (input[i] === quote) {
          if (i + 1 < len && input[i + 1] === quote) {
            str += quote;
            i += 2;
          } else {
            i++;
            break;
          }
        } else {
          str += input[i++];
        }
      }
      tokens.push({ type: 'STRING', value: str });
      continue;
    }

    // Two-character operators
    if (i + 1 < len) {
      const two = input.slice(i, i + 2);
      if (['<=', '>=', '<>', '!='].includes(two)) {
        tokens.push({ type: 'OPERATOR', value: two });
        i += 2;
        continue;
      }
    }

    // Single-character operators and punctuation
    if (['+', '-', '*', '/', '^', '&', '=', '<', '>'].includes(ch)) {
      tokens.push({ type: 'OPERATOR', value: ch });
      i++;
      continue;
    }
    if (ch === '(') {
      tokens.push({ type: 'LPAREN', value: '(' });
      i++;
      continue;
    }
    if (ch === ')') {
      tokens.push({ type: 'RPAREN', value: ')' });
      i++;
      continue;
    }
    if (ch === ',' || ch === ';') {
      tokens.push({ type: 'COMMA', value: ',' });
      i++;
      continue;
    }

    // Identifier, Cell reference, or Range (e.g. A1, $B$4, SUM, B4:B9, $A$1:$B$10)
    if (/[a-zA-Z_$]/.test(ch)) {
      let ident = '';
      while (i < len && /[a-zA-Z0-9_$:!]/.test(input[i])) {
        ident += input[i++];
      }

      // Check if followed by colon for range e.g. A1:B10
      if (ident.includes(':')) {
        tokens.push({ type: 'RANGE', value: ident.toUpperCase() });
        continue;
      }

      const upper = ident.toUpperCase();
      if (upper === 'TRUE') {
        tokens.push({ type: 'BOOLEAN', value: true });
        continue;
      }
      if (upper === 'FALSE') {
        tokens.push({ type: 'BOOLEAN', value: false });
        continue;
      }

      // Check if it's a cell reference like A1 or $A$1
      if (/^\$?[A-Za-z]+\$?[0-9]+$/.test(ident)) {
        tokens.push({ type: 'CELL', value: upper.replace(/\$/g, '') });
        continue;
      }

      // Otherwise general identifier (function name)
      tokens.push({ type: 'IDENT', value: upper });
      continue;
    }

    i++;
  }

  tokens.push({ type: 'EOF', value: null });
  return tokens;
}

// Recursive-descent expression parser
class FormulaParser {
  private tokens: Token[];
  private pos = 0;
  private grid: SheetGrid;
  private evaluating: Set<string>;
  private cache: Map<string, string | number>;

  constructor(
    tokens: Token[],
    grid: SheetGrid,
    evaluating: Set<string>,
    cache: Map<string, string | number>
  ) {
    this.tokens = tokens;
    this.grid = grid;
    this.evaluating = evaluating;
    this.cache = cache;
  }

  private current(): Token {
    return this.tokens[this.pos] || { type: 'EOF', value: null };
  }

  private match(type: TokenType, val?: any): boolean {
    const cur = this.current();
    if (cur.type === type && (val === undefined || cur.value === val)) {
      this.pos++;
      return true;
    }
    return false;
  }

  private expect(type: TokenType, val?: any): Token {
    const cur = this.current();
    if (cur.type !== type || (val !== undefined && cur.value !== val)) {
      throw new Error(`Expected ${type} ${val ?? ''}, got ${cur.type} ${cur.value}`);
    }
    this.pos++;
    return cur;
  }

  public parse(): string | number {
    if (this.current().type === 'EOF') return '';
    const res = this.parseComparison();
    return res;
  }

  private parseComparison(): any {
    let left = this.parseConcat();

    while (
      this.current().type === 'OPERATOR' &&
      ['=', '<>', '!=', '<', '<=', '>', '>='].includes(this.current().value)
    ) {
      const op = this.current().value;
      this.pos++;
      const right = this.parseConcat();

      if (op === '=') left = (left == right);
      else if (op === '<>' || op === '!=') left = (left != right);
      else if (op === '<') left = (Number(left) < Number(right));
      else if (op === '<=') left = (Number(left) <= Number(right));
      else if (op === '>') left = (Number(left) > Number(right));
      else if (op === '>=') left = (Number(left) >= Number(right));
    }

    return left;
  }

  private parseConcat(): any {
    let left = this.parseAdditive();

    while (this.current().type === 'OPERATOR' && this.current().value === '&') {
      this.pos++;
      const right = this.parseAdditive();
      left = `${left ?? ''}${right ?? ''}`;
    }

    return left;
  }

  private parseAdditive(): any {
    let left = this.parseMultiplicative();

    while (
      this.current().type === 'OPERATOR' &&
      (this.current().value === '+' || this.current().value === '-')
    ) {
      const op = this.current().value;
      this.pos++;
      const right = this.parseMultiplicative();
      const n1 = Number(left);
      const n2 = Number(right);
      if (op === '+') {
        left = (isNaN(n1) ? 0 : n1) + (isNaN(n2) ? 0 : n2);
      } else {
        left = (isNaN(n1) ? 0 : n1) - (isNaN(n2) ? 0 : n2);
      }
    }

    return left;
  }

  private parseMultiplicative(): any {
    let left = this.parsePower();

    while (
      this.current().type === 'OPERATOR' &&
      (this.current().value === '*' || this.current().value === '/')
    ) {
      const op = this.current().value;
      this.pos++;
      const right = this.parsePower();
      const n1 = Number(left);
      const n2 = Number(right);
      if (op === '*') {
        left = (isNaN(n1) ? 0 : n1) * (isNaN(n2) ? 0 : n2);
      } else {
        if (n2 === 0) return '#DIV/0!';
        left = (isNaN(n1) ? 0 : n1) / n2;
      }
    }

    return left;
  }

  private parsePower(): any {
    let left = this.parseUnary();

    while (this.current().type === 'OPERATOR' && this.current().value === '^') {
      this.pos++;
      const right = this.parseUnary();
      left = Math.pow(Number(left) || 0, Number(right) || 0);
    }

    return left;
  }

  private parseUnary(): any {
    if (this.current().type === 'OPERATOR' && (this.current().value === '+' || this.current().value === '-')) {
      const op = this.current().value;
      this.pos++;
      const operand = this.parseUnary();
      return op === '-' ? -(Number(operand) || 0) : +(Number(operand) || 0);
    }
    return this.parsePrimary();
  }

  private parsePrimary(): any {
    const cur = this.current();

    if (cur.type === 'NUMBER') {
      this.pos++;
      return cur.value;
    }

    if (cur.type === 'STRING') {
      this.pos++;
      return cur.value;
    }

    if (cur.type === 'BOOLEAN') {
      this.pos++;
      return cur.value;
    }

    if (cur.type === 'LPAREN') {
      this.pos++;
      const val = this.parseComparison();
      this.expect('RPAREN');
      return val;
    }

    if (cur.type === 'CELL') {
      this.pos++;
      return getCellValue(cur.value, this.grid, this.evaluating, this.cache);
    }

    if (cur.type === 'RANGE') {
      this.pos++;
      // In scalar expression, range returns first cell's value
      const keys = expandRange(cur.value);
      return keys.length ? getCellValue(keys[0], this.grid, this.evaluating, this.cache) : '';
    }

    if (cur.type === 'IDENT') {
      const fnName = cur.value;
      this.pos++;
      if (this.current().type === 'LPAREN') {
        this.pos++;
        const args = this.parseArguments(fnName);
        this.expect('RPAREN');
        return this.executeFunction(fnName, args);
      }
      return `#NAME? (${fnName})`;
    }

    this.pos++;
    return '';
  }

  private parseArguments(fnName: string): any[] {
    const args: any[] = [];
    if (this.current().type === 'RPAREN') {
      return args;
    }

    while (true) {
      // If the argument is a raw range like B4:B9 or $B$4:$B$9
      if (this.current().type === 'RANGE') {
        const rangeToken = this.current().value;
        this.pos++;
        args.push({ isRange: true, rangeStr: rangeToken });
      } else if (this.current().type === 'CELL' && this.peekIsColon()) {
        // Handle case where cell:cell was tokenized separately
        const start = this.current().value;
        this.pos += 2; // skip start and colon
        const end = this.expect('CELL').value;
        args.push({ isRange: true, rangeStr: `${start}:${end}` });
      } else {
        const val = this.parseComparison();
        args.push(val);
      }

      if (this.match('COMMA')) {
        continue;
      }
      break;
    }

    return args;
  }

  private peekIsColon(): boolean {
    return (
      this.tokens[this.pos + 1]?.type === 'OPERATOR' &&
      this.tokens[this.pos + 1]?.value === ':'
    );
  }

  // Flat array of values for functions that take variable numbers/ranges
  private extractAllValues(args: any[]): any[] {
    const list: any[] = [];
    for (const arg of args) {
      if (arg && typeof arg === 'object' && arg.isRange) {
        const keys = expandRange(arg.rangeStr);
        for (const k of keys) {
          list.push(getCellValue(k, this.grid, this.evaluating, this.cache));
        }
      } else if (Array.isArray(arg)) {
        list.push(...this.extractAllValues(arg));
      } else {
        list.push(arg);
      }
    }
    return list;
  }

  private extractNumericValues(args: any[]): number[] {
    const all = this.extractAllValues(args);
    const nums: number[] = [];
    for (const v of all) {
      if (typeof v === 'number' && !isNaN(v)) {
        nums.push(v);
      } else if (typeof v === 'string' && v.trim() !== '') {
        const n = parseFloat(v.replace(/[$,]/g, ''));
        if (!isNaN(n)) nums.push(n);
      }
    }
    return nums;
  }

  private executeFunction(fnName: string, args: any[]): any {
    switch (fnName) {
      // --- Math & Statistics ---
      case 'SUM': {
        const nums = this.extractNumericValues(args);
        return nums.reduce((acc, curr) => acc + curr, 0);
      }
      case 'AVERAGE':
      case 'AVG': {
        const nums = this.extractNumericValues(args);
        if (nums.length === 0) return 0;
        return Math.round((nums.reduce((acc, curr) => acc + curr, 0) / nums.length) * 1000) / 1000;
      }
      case 'COUNT': {
        const nums = this.extractNumericValues(args);
        return nums.length;
      }
      case 'COUNTA': {
        const all = this.extractAllValues(args);
        return all.filter((v) => v !== '' && v !== null && v !== undefined).length;
      }
      case 'COUNTBLANK': {
        const all = this.extractAllValues(args);
        return all.filter((v) => v === '' || v === null || v === undefined).length;
      }
      case 'COUNTIF': {
        // COUNTIF(range, criteria)
        if (args.length < 2) return 0;
        const rangeArg = args[0];
        const criteria = args[1];
        let values: any[] = [];
        if (rangeArg && rangeArg.isRange) {
          const keys = expandRange(rangeArg.rangeStr);
          values = keys.map((k) => getCellValue(k, this.grid, this.evaluating, this.cache));
        } else {
          values = this.extractAllValues([rangeArg]);
        }

        let count = 0;
        for (const v of values) {
          if (matchesCriteria(v, criteria)) count++;
        }
        return count;
      }
      case 'COUNTIFS': {
        // COUNTIFS(range1, crit1, range2, crit2, ...)
        if (args.length < 2 || args.length % 2 !== 0) return 0;
        const pairs: { rangeKeys: string[]; crit: any }[] = [];
        for (let i = 0; i < args.length; i += 2) {
          const rStr = args[i]?.rangeStr || String(args[i]);
          pairs.push({ rangeKeys: expandRange(rStr), crit: args[i + 1] });
        }
        if (pairs.length === 0) return 0;
        const len = pairs[0].rangeKeys.length;
        let count = 0;
        for (let idx = 0; idx < len; idx++) {
          let allMatch = true;
          for (const p of pairs) {
            const val = getCellValue(p.rangeKeys[idx], this.grid, this.evaluating, this.cache);
            if (!matchesCriteria(val, p.crit)) {
              allMatch = false;
              break;
            }
          }
          if (allMatch) count++;
        }
        return count;
      }
      case 'SUMIF': {
        // SUMIF(range, criteria, [sum_range])
        if (args.length < 2) return 0;
        const rangeKeys = expandRange(args[0]?.rangeStr || String(args[0]));
        const criteria = args[1];
        const sumKeys = args[2] ? expandRange(args[2]?.rangeStr || String(args[2])) : rangeKeys;

        let total = 0;
        for (let i = 0; i < rangeKeys.length; i++) {
          const testVal = getCellValue(rangeKeys[i], this.grid, this.evaluating, this.cache);
          if (matchesCriteria(testVal, criteria)) {
            const sumVal = getCellValue(sumKeys[i] || rangeKeys[i], this.grid, this.evaluating, this.cache);
            const num = typeof sumVal === 'number' ? sumVal : parseFloat(String(sumVal).replace(/[$,]/g, ''));
            if (!isNaN(num)) total += num;
          }
        }
        return total;
      }
      case 'SUMIFS': {
        // SUMIFS(sum_range, range1, crit1, range2, crit2, ...)
        if (args.length < 3) return 0;
        const sumKeys = expandRange(args[0]?.rangeStr || String(args[0]));
        const pairs: { rangeKeys: string[]; crit: any }[] = [];
        for (let i = 1; i < args.length; i += 2) {
          pairs.push({
            rangeKeys: expandRange(args[i]?.rangeStr || String(args[i])),
            crit: args[i + 1],
          });
        }
        let total = 0;
        for (let i = 0; i < sumKeys.length; i++) {
          let match = true;
          for (const p of pairs) {
            const val = getCellValue(p.rangeKeys[i], this.grid, this.evaluating, this.cache);
            if (!matchesCriteria(val, p.crit)) {
              match = false;
              break;
            }
          }
          if (match) {
            const sumVal = getCellValue(sumKeys[i], this.grid, this.evaluating, this.cache);
            const num = typeof sumVal === 'number' ? sumVal : parseFloat(String(sumVal).replace(/[$,]/g, ''));
            if (!isNaN(num)) total += num;
          }
        }
        return total;
      }
      case 'AVERAGEIF': {
        // AVERAGEIF(range, criteria, [average_range])
        if (args.length < 2) return 0;
        const rangeKeys = expandRange(args[0]?.rangeStr || String(args[0]));
        const criteria = args[1];
        const avgKeys = args[2] ? expandRange(args[2]?.rangeStr || String(args[2])) : rangeKeys;

        let total = 0;
        let count = 0;
        for (let i = 0; i < rangeKeys.length; i++) {
          const testVal = getCellValue(rangeKeys[i], this.grid, this.evaluating, this.cache);
          if (matchesCriteria(testVal, criteria)) {
            const val = getCellValue(avgKeys[i] || rangeKeys[i], this.grid, this.evaluating, this.cache);
            const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/[$,]/g, ''));
            if (!isNaN(num)) {
              total += num;
              count++;
            }
          }
        }
        return count > 0 ? Math.round((total / count) * 1000) / 1000 : 0;
      }
      case 'MIN': {
        const nums = this.extractNumericValues(args);
        return nums.length ? Math.min(...nums) : 0;
      }
      case 'MAX': {
        const nums = this.extractNumericValues(args);
        return nums.length ? Math.max(...nums) : 0;
      }
      case 'MEDIAN': {
        const nums = this.extractNumericValues(args).sort((a, b) => a - b);
        if (!nums.length) return 0;
        const mid = Math.floor(nums.length / 2);
        return nums.length % 2 !== 0 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
      }
      case 'PRODUCT': {
        const nums = this.extractNumericValues(args);
        return nums.length ? nums.reduce((a, b) => a * b, 1) : 0;
      }
      case 'ROUND': {
        const val = Number(args[0]) || 0;
        const dec = parseInt(String(args[1] ?? '0'), 10) || 0;
        const f = Math.pow(10, dec);
        return Math.round(val * f) / f;
      }
      case 'ROUNDUP': {
        const val = Number(args[0]) || 0;
        const dec = parseInt(String(args[1] ?? '0'), 10) || 0;
        const f = Math.pow(10, dec);
        return Math.ceil(val * f) / f;
      }
      case 'ROUNDDOWN': {
        const val = Number(args[0]) || 0;
        const dec = parseInt(String(args[1] ?? '0'), 10) || 0;
        const f = Math.pow(10, dec);
        return Math.floor(val * f) / f;
      }
      case 'ABS':
        return Math.abs(Number(args[0]) || 0);
      case 'SQRT': {
        const v = Number(args[0]) || 0;
        return v >= 0 ? Math.sqrt(v) : '#NUM!';
      }
      case 'POWER':
        return Math.pow(Number(args[0]) || 0, Number(args[1]) || 0);
      case 'MOD': {
        const n = Number(args[0]) || 0;
        const d = Number(args[1]) || 0;
        return d !== 0 ? n % d : '#DIV/0!';
      }
      case 'INT':
        return Math.floor(Number(args[0]) || 0);
      case 'CEILING':
        return Math.ceil(Number(args[0]) || 0);
      case 'FLOOR':
        return Math.floor(Number(args[0]) || 0);

      // --- Logic ---
      case 'IF': {
        const cond = Boolean(args[0]);
        return cond ? (args[1] ?? '') : (args[2] ?? '');
      }
      case 'IFS': {
        for (let i = 0; i < args.length; i += 2) {
          if (Boolean(args[i])) return args[i + 1] ?? '';
        }
        return '#N/A';
      }
      case 'IFERROR': {
        const val = args[0];
        const isErr = typeof val === 'string' && val.startsWith('#');
        return isErr ? (args[1] ?? '') : val;
      }
      case 'IFNA': {
        const val = args[0];
        return val === '#N/A' ? (args[1] ?? '') : val;
      }
      case 'AND': {
        const all = this.extractAllValues(args);
        return all.every((v) => Boolean(v));
      }
      case 'OR': {
        const all = this.extractAllValues(args);
        return all.some((v) => Boolean(v));
      }
      case 'NOT':
        return !Boolean(args[0]);
      case 'XOR': {
        const all = this.extractAllValues(args);
        const trues = all.filter((v) => Boolean(v)).length;
        return trues % 2 !== 0;
      }
      case 'TRUE':
        return true;
      case 'FALSE':
        return false;

      // --- Text ---
      case 'CONCAT':
      case 'CONCATENATE': {
        const all = this.extractAllValues(args);
        return all.join('');
      }
      case 'TEXTJOIN': {
        const delim = String(args[0] ?? '');
        const ignoreEmpty = Boolean(args[1]);
        const items = this.extractAllValues(args.slice(2));
        const filtered = ignoreEmpty ? items.filter((x) => x !== '' && x !== null && x !== undefined) : items;
        return filtered.join(delim);
      }
      case 'UPPER':
        return String(args[0] ?? '').toUpperCase();
      case 'LOWER':
        return String(args[0] ?? '').toLowerCase();
      case 'PROPER':
        return String(args[0] ?? '')
          .toLowerCase()
          .replace(/\b\w/g, (c) => c.toUpperCase());
      case 'LEN':
        return String(args[0] ?? '').length;
      case 'TRIM':
        return String(args[0] ?? '').trim();
      case 'LEFT': {
        const str = String(args[0] ?? '');
        const n = args[1] !== undefined ? parseInt(String(args[1]), 10) : 1;
        return str.slice(0, Math.max(0, n));
      }
      case 'RIGHT': {
        const str = String(args[0] ?? '');
        const n = args[1] !== undefined ? parseInt(String(args[1]), 10) : 1;
        return str.slice(Math.max(0, str.length - n));
      }
      case 'MID': {
        const str = String(args[0] ?? '');
        const start = (parseInt(String(args[1]), 10) || 1) - 1;
        const len = parseInt(String(args[2]), 10) || 0;
        return str.substr(Math.max(0, start), Math.max(0, len));
      }
      case 'SUBSTITUTE': {
        const text = String(args[0] ?? '');
        const oldT = String(args[1] ?? '');
        const newT = String(args[2] ?? '');
        return text.split(oldT).join(newT);
      }
      case 'REPLACE': {
        const text = String(args[0] ?? '');
        const start = (parseInt(String(args[1]), 10) || 1) - 1;
        const numChars = parseInt(String(args[2]), 10) || 0;
        const newText = String(args[3] ?? '');
        return text.slice(0, start) + newText + text.slice(start + numChars);
      }
      case 'VALUE': {
        const n = parseFloat(String(args[0] ?? '').replace(/[$,]/g, ''));
        return isNaN(n) ? '#VALUE!' : n;
      }
      case 'TEXT': {
        const num = Number(args[0]);
        const fmt = String(args[1] ?? '');
        if (isNaN(num)) return String(args[0] ?? '');
        if (fmt.includes('$')) {
          return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        }
        if (fmt.includes('%')) {
          return `${(num * 100).toFixed(1)}%`;
        }
        return String(num);
      }

      // --- Lookup & Reference ---
      case 'VLOOKUP': {
        // VLOOKUP(lookup_value, table_range, col_index, [exact_match])
        if (args.length < 3) return '#N/A';
        const lookup = args[0];
        const rangeStr = args[1]?.rangeStr || String(args[1]);
        const colOffset = (parseInt(String(args[2]), 10) || 1) - 1;

        const parts = rangeStr.split(':');
        const start = parseCoord(parts[0]);
        const end = parseCoord(parts[1] || parts[0]);
        if (!start || !end) return '#REF!';

        const minRow = Math.min(start.row, end.row);
        const maxRow = Math.max(start.row, end.row);
        const firstCol = start.col;
        const targetCol = firstCol + colOffset;

        for (let r = minRow; r <= maxRow; r++) {
          const firstKey = `${colToLetter(firstCol)}${r + 1}`;
          const val = getCellValue(firstKey, this.grid, this.evaluating, this.cache);
          if (matchesCriteria(val, lookup)) {
            const targetKey = `${colToLetter(targetCol)}${r + 1}`;
            return getCellValue(targetKey, this.grid, this.evaluating, this.cache);
          }
        }
        return '#N/A';
      }
      case 'HLOOKUP': {
        // HLOOKUP(lookup_value, table_range, row_index, [exact_match])
        if (args.length < 3) return '#N/A';
        const lookup = args[0];
        const rangeStr = args[1]?.rangeStr || String(args[1]);
        const rowOffset = (parseInt(String(args[2]), 10) || 1) - 1;

        const parts = rangeStr.split(':');
        const start = parseCoord(parts[0]);
        const end = parseCoord(parts[1] || parts[0]);
        if (!start || !end) return '#REF!';

        const minCol = Math.min(start.col, end.col);
        const maxCol = Math.max(start.col, end.col);
        const firstRow = start.row;
        const targetRow = firstRow + rowOffset;

        for (let c = minCol; c <= maxCol; c++) {
          const firstKey = `${colToLetter(c)}${firstRow + 1}`;
          const val = getCellValue(firstKey, this.grid, this.evaluating, this.cache);
          if (matchesCriteria(val, lookup)) {
            const targetKey = `${colToLetter(c)}${targetRow + 1}`;
            return getCellValue(targetKey, this.grid, this.evaluating, this.cache);
          }
        }
        return '#N/A';
      }
      case 'INDEX': {
        // INDEX(range, row_num, [col_num])
        const rangeStr = args[0]?.rangeStr || String(args[0]);
        const rowNum = parseInt(String(args[1]), 10) || 1;
        const colNum = args[2] !== undefined ? parseInt(String(args[2]), 10) || 1 : 1;

        const parts = rangeStr.split(':');
        const start = parseCoord(parts[0]);
        if (!start) return '#REF!';

        const targetKey = `${colToLetter(start.col + colNum - 1)}${start.row + rowNum}`;
        return getCellValue(targetKey, this.grid, this.evaluating, this.cache);
      }
      case 'MATCH': {
        // MATCH(lookup_value, lookup_array, [match_type])
        if (args.length < 2) return '#N/A';
        const lookup = args[0];
        const rangeStr = args[1]?.rangeStr || String(args[1]);
        const keys = expandRange(rangeStr);

        for (let i = 0; i < keys.length; i++) {
          const val = getCellValue(keys[i], this.grid, this.evaluating, this.cache);
          if (matchesCriteria(val, lookup)) {
            return i + 1;
          }
        }
        return '#N/A';
      }
      case 'XLOOKUP': {
        // XLOOKUP(lookup, lookup_range, return_range, [if_not_found])
        if (args.length < 3) return '#N/A';
        const lookup = args[0];
        const lKeys = expandRange(args[1]?.rangeStr || String(args[1]));
        const rKeys = expandRange(args[2]?.rangeStr || String(args[2]));
        const ifNotFound = args[3] !== undefined ? args[3] : '#N/A';

        for (let i = 0; i < lKeys.length; i++) {
          const val = getCellValue(lKeys[i], this.grid, this.evaluating, this.cache);
          if (matchesCriteria(val, lookup)) {
            return getCellValue(rKeys[i] || lKeys[i], this.grid, this.evaluating, this.cache);
          }
        }
        return ifNotFound;
      }

      // --- Info & Date ---
      case 'ISBLANK': {
        const v = args[0];
        return v === '' || v === null || v === undefined;
      }
      case 'ISNUMBER': {
        const v = args[0];
        return typeof v === 'number' && !isNaN(v);
      }
      case 'ISTEXT': {
        const v = args[0];
        return typeof v === 'string';
      }
      case 'ISERROR': {
        const v = args[0];
        return typeof v === 'string' && v.startsWith('#');
      }
      case 'TODAY':
        return new Date().toISOString().split('T')[0];
      case 'NOW':
        return new Date().toLocaleString();
      case 'DATE': {
        const y = Number(args[0]) || 2026;
        const m = (Number(args[1]) || 1) - 1;
        const d = Number(args[2]) || 1;
        return new Date(y, m, d).toISOString().split('T')[0];
      }
      case 'YEAR': {
        const dt = new Date(args[0]);
        return isNaN(dt.getTime()) ? '#VALUE!' : dt.getFullYear();
      }
      case 'MONTH': {
        const dt = new Date(args[0]);
        return isNaN(dt.getTime()) ? '#VALUE!' : dt.getMonth() + 1;
      }
      case 'DAY': {
        const dt = new Date(args[0]);
        return isNaN(dt.getTime()) ? '#VALUE!' : dt.getDate();
      }

      default:
        return `#NAME? (${fnName})`;
    }
  }
}

// Internal recursive formula evaluator
function evaluateFormulaInternal(
  formula: string,
  grid: SheetGrid,
  evaluating: Set<string>,
  cache: Map<string, string | number>
): string | number {
  const clean = formula.trim();
  if (!clean.startsWith('=')) {
    const num = Number(clean);
    return isNaN(num) || clean === '' ? clean : num;
  }

  const expr = clean.slice(1).trim();
  if (expr === '') return '';

  try {
    const tokens = tokenize(expr);
    const parser = new FormulaParser(tokens, grid, evaluating, cache);
    const res = parser.parse();
    if (typeof res === 'number') {
      return Math.round(res * 1000000) / 1000000;
    }
    return res;
  } catch (err: any) {
    return '#ERROR!';
  }
}

// Public API for evaluating a formula string
export function evaluateFormula(
  formula: string,
  grid: SheetGrid,
  visiting: Set<string> = new Set()
): string | number {
  const cache = new Map<string, string | number>();
  return evaluateFormulaInternal(formula, grid, visiting, cache);
}

// Recomputes all cells in a sheet grid in topological dependency order
export function recalculateGrid(grid: SheetGrid): SheetGrid {
  const updated: SheetGrid = { ...grid };
  const evaluating = new Set<string>();
  const computedCache = new Map<string, string | number>();

  for (const [key, cell] of Object.entries(updated)) {
    const raw = String(cell.raw ?? '').trim();
    if (raw.startsWith('=')) {
      cell.computed = getCellValue(key, updated, evaluating, computedCache);
    } else {
      const num = Number(raw);
      cell.computed = isNaN(num) || raw === '' ? raw : num;
      computedCache.set(normalizeKey(key), cell.computed);
    }
  }

  return updated;
}
