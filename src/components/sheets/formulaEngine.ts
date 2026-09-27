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

  const scalarResult = Array.isArray(result)
    ? (Array.isArray(result[0]) ? result[0][0] : result[0])
    : result;

  computedCache.set(normKey, scalarResult);
  return scalarResult;
}

// Helper: criteria matching for COUNTIF, SUMIF, etc.
function matchesCriteria(val: string | number, criteria: string | number): boolean {
  if (criteria === undefined || criteria === null) return false;

  const critStr = String(criteria).trim();
  const valStr = String(val).trim();

  // If criteria has a comparison operator: >, >=, <, <=, <>, !=, =
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

// --- Date & Time Helper Functions ---

function parseDate(val: any): Date | null {
  if (val === undefined || val === null || val === '') return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  if (typeof val === 'number') {
    if (val > 0 && val < 200000) {
      // Excel serial date epoch: Dec 30 1899
      const epoch = new Date(1899, 11, 30);
      const d = new Date(epoch.getTime() + Math.round(val * 86400000));
      return isNaN(d.getTime()) ? null : d;
    }
  }
  const s = String(val).trim();
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d;
  const m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (m) {
    const dt = new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]));
    if (!isNaN(dt.getTime())) return dt;
  }
  return null;
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatTime(h: number, m: number, s: number): string {
  const hh = String(Math.floor(h) % 24).padStart(2, '0');
  const mm = String(Math.floor(m) % 60).padStart(2, '0');
  const ss = String(Math.floor(s) % 60).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

function calcDateDif(d1: Date, d2: Date, unit: string): number | string {
  if (d1 > d2) return '#NUM!';
  const u = unit.toUpperCase().trim();
  const y1 = d1.getFullYear();
  const y2 = d2.getFullYear();
  const m1 = d1.getMonth();
  const m2 = d2.getMonth();
  const day1 = d1.getDate();
  const day2 = d2.getDate();

  switch (u) {
    case 'Y': {
      let diff = y2 - y1;
      if (m2 < m1 || (m2 === m1 && day2 < day1)) diff--;
      return Math.max(0, diff);
    }
    case 'M': {
      let diff = (y2 - y1) * 12 + (m2 - m1);
      if (day2 < day1) diff--;
      return Math.max(0, diff);
    }
    case 'D': {
      return Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
    }
    case 'MD': {
      let diff = day2 - day1;
      if (diff < 0) {
        const prevMonthDays = new Date(y2, m2, 0).getDate();
        diff += prevMonthDays;
      }
      return diff;
    }
    case 'YM': {
      let diff = m2 - m1;
      if (day2 < day1) diff--;
      if (diff < 0) diff += 12;
      return diff;
    }
    case 'YD': {
      const d1ThisYear = new Date(y2, m1, day1);
      if (d1ThisYear > d2) {
        d1ThisYear.setFullYear(y2 - 1);
      }
      return Math.round((d2.getTime() - d1ThisYear.getTime()) / (1000 * 60 * 60 * 24));
    }
    default:
      return '#VALUE!';
  }
}

function calcNetworkDays(d1: Date, d2: Date, holidays: any[] = []): number {
  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return 0;
  const start = new Date(d1.getFullYear(), d1.getMonth(), d1.getDate());
  const end = new Date(d2.getFullYear(), d2.getMonth(), d2.getDate());
  const step = start <= end ? 1 : -1;

  const holidayTimestamps = new Set(
    holidays.map((h) => {
      const hd = parseDate(h);
      return hd ? new Date(hd.getFullYear(), hd.getMonth(), hd.getDate()).getTime() : -1;
    })
  );

  let count = 0;
  const cur = new Date(start);
  while ((step === 1 && cur <= end) || (step === -1 && cur >= end)) {
    const dayOfWeek = cur.getDay(); // 0 = Sunday, 6 = Saturday
    if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidayTimestamps.has(cur.getTime())) {
      count++;
    }
    cur.setDate(cur.getDate() + step);
  }
  return step === 1 ? count : -count;
}

function calcEDate(d: Date, months: number): string {
  const res = new Date(d);
  res.setMonth(res.getMonth() + months);
  return formatDate(res);
}

function calcEOMonth(d: Date, months: number): string {
  const y = d.getFullYear();
  const m = d.getMonth() + months + 1;
  const res = new Date(y, m, 0);
  return formatDate(res);
}

// --- Google Specials: Offline Stocks Simulator & Sparkline ---

const OFFLINE_STOCKS: Record<string, {
  name: string;
  price: number;
  pe: number;
  high: number;
  low: number;
  volume: number;
  marketcap: string;
  change: number;
  changepct: number;
}> = {
  GOOG: { name: 'Alphabet Inc. Class C', price: 182.48, pe: 24.3, high: 185.10, low: 180.25, volume: 19420000, marketcap: '2.28T', change: 1.34, changepct: 0.74 },
  GOOGL: { name: 'Alphabet Inc. Class A', price: 181.92, pe: 24.2, high: 184.60, low: 179.80, volume: 22100000, marketcap: '2.27T', change: 1.28, changepct: 0.71 },
  AAPL: { name: 'Apple Inc.', price: 228.35, pe: 34.1, high: 231.00, low: 226.50, volume: 48500000, marketcap: '3.49T', change: -0.85, changepct: -0.37 },
  MSFT: { name: 'Microsoft Corporation', price: 432.25, pe: 36.2, high: 436.50, low: 428.90, volume: 21800000, marketcap: '3.21T', change: 2.15, changepct: 0.50 },
  AMZN: { name: 'Amazon.com Inc.', price: 188.90, pe: 43.1, high: 191.40, low: 186.80, volume: 33700000, marketcap: '1.97T', change: 0.95, changepct: 0.51 },
  TSLA: { name: 'Tesla Inc.', price: 254.10, pe: 68.7, high: 260.50, low: 247.80, volume: 71200000, marketcap: '809B', change: -3.40, changepct: -1.32 },
  NVDA: { name: 'NVIDIA Corporation', price: 124.80, pe: 46.5, high: 127.20, low: 122.10, volume: 98400000, marketcap: '3.07T', change: 3.20, changepct: 2.63 },
  META: { name: 'Meta Platforms Inc.', price: 568.50, pe: 27.8, high: 575.00, low: 561.20, volume: 15300000, marketcap: '1.44T', change: 4.80, changepct: 0.85 },
  NFLX: { name: 'Netflix Inc.', price: 698.40, pe: 41.2, high: 705.00, low: 692.00, volume: 3100000, marketcap: '300B', change: 5.60, changepct: 0.81 },
  SPY: { name: 'SPDR S&P 500 ETF Trust', price: 562.15, pe: 26.5, high: 564.00, low: 559.80, volume: 54100000, marketcap: '560B', change: 1.10, changepct: 0.20 },
  QQQ: { name: 'Invesco QQQ Trust', price: 485.60, pe: 31.0, high: 488.20, low: 482.90, volume: 38200000, marketcap: '280B', change: 1.85, changepct: 0.38 },
};

function executeGoogleFinance(ticker: string, attribute: string = 'price'): string | number {
  const cleanTicker = ticker.toUpperCase().replace(/^(NASDAQ:|NYSE:)/, '').trim();
  const cleanAttr = (attribute || 'price').toLowerCase().trim();

  let stock = OFFLINE_STOCKS[cleanTicker];
  if (!stock) {
    const hash = Math.abs(cleanTicker.split('').reduce((acc, c) => acc * 31 + c.charCodeAt(0), 7));
    const baseP = Math.round((50 + (hash % 450) + (hash % 100) / 100) * 100) / 100;
    const pe = Math.round((15 + (hash % 40) + 0.5) * 10) / 10;
    stock = {
      name: `${cleanTicker} Inc.`,
      price: baseP,
      pe,
      high: Math.round(baseP * 1.05 * 100) / 100,
      low: Math.round(baseP * 0.95 * 100) / 100,
      volume: 1000000 + (hash % 20000000),
      marketcap: `${Math.round(baseP * 0.05 * 10) / 10}B`,
      change: Math.round(((hash % 10) - 4.5) * 100) / 100,
      changepct: Math.round((hash % 10) - 4.5 * 10) / 10,
    };
  }

  switch (cleanAttr) {
    case 'price': return stock.price;
    case 'pe': return stock.pe;
    case 'high': return stock.high;
    case 'low': return stock.low;
    case 'volume': return stock.volume;
    case 'marketcap': return stock.marketcap;
    case 'change': return stock.change;
    case 'changepct': return `${stock.changepct}%`;
    case 'name': return stock.name;
    case 'ticker': return cleanTicker;
    default: return stock.price;
  }
}

function renderSparkline(nums: number[], optionsStr?: string): string {
  if (!nums.length) return '';
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const range = max - min;
  const glyphs = [' ', '▂', '▃', '▄', '▅', '▆', '▇', '█'];

  if (range === 0) {
    return '▄'.repeat(nums.length);
  }

  return nums
    .map((n) => {
      const frac = (n - min) / range;
      const idx = Math.min(glyphs.length - 1, Math.max(0, Math.floor(frac * (glyphs.length - 1))));
      return glyphs[idx];
    })
    .join('');
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
      while (i < len && /[a-zA-Z0-9_$:!.]/.test(input[i])) {
        ident += input[i++];
      }

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

      if (/^\$?[A-Za-z]+\$?[0-9]+$/.test(ident)) {
        tokens.push({ type: 'CELL', value: upper.replace(/\$/g, '') });
        continue;
      }

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

  public parse(): any {
    if (this.current().type === 'EOF') return '';
    const res = this.parseComparison();
    if (res && typeof res === 'object' && res.isRange) {
      const keys = expandRange(res.rangeStr);
      return keys.length ? getCellValue(keys[0], this.grid, this.evaluating, this.cache) : '';
    }
    return res;
  }

  private applyBinaryOp(op: string, left: any, right: any): any {
    const leftIsArr = Array.isArray(left) || (left && typeof left === 'object' && left.isRange);
    const rightIsArr = Array.isArray(right) || (right && typeof right === 'object' && right.isRange);

    if (leftIsArr || rightIsArr) {
      const leftVals = this.getRangeValues(left);
      const rightVals = this.getRangeValues(right);
      const maxLen = Math.max(leftVals.length, rightVals.length);
      const res: any[] = [];
      for (let i = 0; i < maxLen; i++) {
        const l = leftIsArr ? leftVals[i % leftVals.length] : left;
        const r = rightIsArr ? rightVals[i % rightVals.length] : right;
        res.push(this.applyScalarOp(op, l, r));
      }
      return res;
    }

    return this.applyScalarOp(op, left, right);
  }

  private applyScalarOp(op: string, left: any, right: any): any {
    if (op === '=') return left == right;
    if (op === '<>' || op === '!=') return left != right;
    if (op === '<') return Number(left) < Number(right);
    if (op === '<=') return Number(left) <= Number(right);
    if (op === '>') return Number(left) > Number(right);
    if (op === '>=') return Number(left) >= Number(right);

    const n1 = Number(left);
    const n2 = Number(right);
    if (op === '+') return (isNaN(n1) ? 0 : n1) + (isNaN(n2) ? 0 : n2);
    if (op === '-') return (isNaN(n1) ? 0 : n1) - (isNaN(n2) ? 0 : n2);
    if (op === '*') return (isNaN(n1) ? 0 : n1) * (isNaN(n2) ? 0 : n2);
    if (op === '/') {
      if (n2 === 0) return '#DIV/0!';
      return (isNaN(n1) ? 0 : n1) / n2;
    }
    if (op === '^') return Math.pow(n1 || 0, n2 || 0);
    if (op === '&') return `${left ?? ''}${right ?? ''}`;
    return '';
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
      left = this.applyBinaryOp(op, left, right);
    }

    return left;
  }

  private parseConcat(): any {
    let left = this.parseAdditive();

    while (this.current().type === 'OPERATOR' && this.current().value === '&') {
      this.pos++;
      const right = this.parseAdditive();
      left = this.applyBinaryOp('&', left, right);
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
      left = this.applyBinaryOp(op, left, right);
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
      left = this.applyBinaryOp(op, left, right);
    }

    return left;
  }

  private parsePower(): any {
    let left = this.parseUnary();

    while (this.current().type === 'OPERATOR' && this.current().value === '^') {
      this.pos++;
      const right = this.parseUnary();
      left = this.applyBinaryOp('^', left, right);
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
      const rangeToken = cur.value;
      this.pos++;
      return { isRange: true, rangeStr: rangeToken };
    }

    if (cur.type === 'CELL' && this.peekIsColon()) {
      const start = cur.value;
      this.pos += 2;
      const end = this.expect('CELL').value;
      return { isRange: true, rangeStr: `${start}:${end}` };
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

  private parseArguments(fnName?: string): any[] {
    const args: any[] = [];
    if (this.current().type === 'RPAREN') {
      return args;
    }

    while (true) {
      if (
        this.current().type === 'CELL' &&
        fnName &&
        ['OFFSET', 'ROW', 'COLUMN', 'CELL', 'ADDRESS'].includes(fnName) &&
        args.length === 0 &&
        !this.peekIsColon()
      ) {
        const cellToken = this.current().value;
        this.pos++;
        args.push({ isCell: true, cellKey: cellToken, rangeStr: cellToken });
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

  public getRange2D(arg: any): any[][] {
    if (arg === undefined || arg === null) return [[]];
    if (typeof arg === 'object' && arg.isRange) {
      const parts = arg.rangeStr.split(':');
      const start = parseCoord(parts[0]);
      const end = parseCoord(parts[1] || parts[0]);
      if (!start || !end) return [[]];

      const minCol = Math.min(start.col, end.col);
      const maxCol = Math.max(start.col, end.col);
      const minRow = Math.min(start.row, end.row);
      const maxRow = Math.max(start.row, end.row);

      const matrix: any[][] = [];
      for (let r = minRow; r <= maxRow; r++) {
        const row: any[] = [];
        for (let c = minCol; c <= maxCol; c++) {
          const key = `${colToLetter(c)}${r + 1}`;
          row.push(getCellValue(key, this.grid, this.evaluating, this.cache));
        }
        matrix.push(row);
      }
      return matrix;
    }

    if (Array.isArray(arg)) {
      if (arg.length > 0 && Array.isArray(arg[0])) {
        return arg;
      }
      return arg.map((item) => [item]);
    }

    return [[arg]];
  }

  public getRangeValues(arg: any): any[] {
    if (arg === undefined || arg === null) return [];
    if (typeof arg === 'object' && arg.isRange) {
      const keys = expandRange(arg.rangeStr);
      return keys.map((k) => getCellValue(k, this.grid, this.evaluating, this.cache));
    }
    if (Array.isArray(arg)) {
      return arg.flat(Infinity);
    }
    return [arg];
  }

  public extractAllValues(args: any[]): any[] {
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

  public extractNumericValues(args: any[]): number[] {
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
      // ==========================================
      // --- 1. Lookup & Reference (14 functions) ---
      // ==========================================
      case 'VLOOKUP': {
        // VLOOKUP(search_key, range, index, [is_sorted])
        if (args.length < 3) return '#N/A';
        const lookup = args[0];
        const matrix = this.getRange2D(args[1]);
        const colIdx = (parseInt(String(args[2]), 10) || 1) - 1;
        const isSorted = args[3] !== undefined ? Boolean(args[3]) : false;

        if (colIdx < 0 || (matrix.length > 0 && colIdx >= matrix[0].length)) return '#REF!';

        if (!isSorted) {
          for (const row of matrix) {
            if (matchesCriteria(row[0], lookup)) {
              return row[colIdx];
            }
          }
          return '#N/A';
        } else {
          let bestRow: any[] | null = null;
          for (const row of matrix) {
            const val = row[0];
            if (val <= lookup) {
              bestRow = row;
            } else {
              break;
            }
          }
          return bestRow ? bestRow[colIdx] : '#N/A';
        }
      }

      case 'HLOOKUP': {
        // HLOOKUP(search_key, range, index, [is_sorted])
        if (args.length < 3) return '#N/A';
        const lookup = args[0];
        const matrix = this.getRange2D(args[1]);
        const rowIdx = (parseInt(String(args[2]), 10) || 1) - 1;
        const isSorted = args[3] !== undefined ? Boolean(args[3]) : false;

        if (rowIdx < 0 || rowIdx >= matrix.length || matrix.length === 0) return '#REF!';

        const colCount = matrix[0].length;
        if (!isSorted) {
          for (let c = 0; c < colCount; c++) {
            if (matchesCriteria(matrix[0][c], lookup)) {
              return matrix[rowIdx][c];
            }
          }
          return '#N/A';
        } else {
          let bestCol = -1;
          for (let c = 0; c < colCount; c++) {
            if (matrix[0][c] <= lookup) {
              bestCol = c;
            } else {
              break;
            }
          }
          return bestCol !== -1 ? matrix[rowIdx][bestCol] : '#N/A';
        }
      }

      case 'XLOOKUP': {
        // XLOOKUP(search_key, lookup_range, result_range, [missing_value], [match_mode], [search_mode])
        if (args.length < 3) return '#N/A';
        const searchKey = args[0];
        const lList = this.getRangeValues(args[1]);
        const rList = this.getRangeValues(args[2]);
        const missingVal = args[3] !== undefined ? args[3] : '#N/A';
        const searchMode = args[5] !== undefined ? Number(args[5]) : 1; // 1 = first-to-last, -1 = last-to-first

        const indices = searchMode === -1
          ? Array.from({ length: lList.length }, (_, idx) => lList.length - 1 - idx)
          : Array.from({ length: lList.length }, (_, idx) => idx);

        for (const i of indices) {
          if (matchesCriteria(lList[i], searchKey)) {
            return rList[i] !== undefined ? rList[i] : '';
          }
        }
        return missingVal;
      }

      case 'INDEX': {
        // INDEX(reference, [row], [column])
        const matrix = this.getRange2D(args[0]);
        const r = (parseInt(String(args[1] ?? '1'), 10) || 1) - 1;
        const c = (parseInt(String(args[2] ?? '1'), 10) || 1) - 1;

        if (r < 0 || r >= matrix.length || c < 0 || c >= (matrix[0]?.length || 0)) {
          return '#REF!';
        }
        return matrix[r][c];
      }

      case 'MATCH': {
        // MATCH(search_key, range, [search_type])
        if (args.length < 2) return '#N/A';
        const searchKey = args[0];
        const list = this.getRangeValues(args[1]);
        const searchType = args[2] !== undefined ? Number(args[2]) : 1;

        if (searchType === 0) {
          for (let i = 0; i < list.length; i++) {
            if (matchesCriteria(list[i], searchKey)) return i + 1;
          }
          return '#N/A';
        } else if (searchType === 1) {
          let bestIdx = -1;
          for (let i = 0; i < list.length; i++) {
            if (list[i] <= searchKey) bestIdx = i;
            else break;
          }
          return bestIdx !== -1 ? bestIdx + 1 : '#N/A';
        } else if (searchType === -1) {
          let bestIdx = -1;
          for (let i = 0; i < list.length; i++) {
            if (list[i] >= searchKey) bestIdx = i;
            else break;
          }
          return bestIdx !== -1 ? bestIdx + 1 : '#N/A';
        }
        return '#N/A';
      }

      case 'CHOOSE': {
        // CHOOSE(index, choice1, [choice2, ...])
        const idx = parseInt(String(args[0]), 10);
        if (isNaN(idx) || idx < 1 || idx >= args.length) return '#VALUE!';
        return args[idx];
      }

      case 'OFFSET': {
        // OFFSET(cell_reference, offset_rows, offset_columns, [height], [width])
        const refStr = args[0]?.rangeStr || args[0]?.cellKey || String(args[0]);
        const coord = parseCoord(refStr.split(':')[0]);
        if (!coord) return '#REF!';

        const dRows = parseInt(String(args[1] ?? '0'), 10) || 0;
        const dCols = parseInt(String(args[2] ?? '0'), 10) || 0;
        const targetRow = coord.row + dRows;
        const targetCol = coord.col + dCols;

        if (targetRow < 0 || targetCol < 0) return '#REF!';

        const h = args[3] !== undefined ? parseInt(String(args[3]), 10) || 1 : 1;
        const w = args[4] !== undefined ? parseInt(String(args[4]), 10) || 1 : 1;

        if (h === 1 && w === 1) {
          const key = `${colToLetter(targetCol)}${targetRow + 1}`;
          return getCellValue(key, this.grid, this.evaluating, this.cache);
        }

        const matrix: any[][] = [];
        for (let r = 0; r < h; r++) {
          const row: any[] = [];
          for (let c = 0; c < w; c++) {
            const key = `${colToLetter(targetCol + c)}${targetRow + r + 1}`;
            row.push(getCellValue(key, this.grid, this.evaluating, this.cache));
          }
          matrix.push(row);
        }
        return matrix;
      }

      case 'TRANSPOSE': {
        // TRANSPOSE(array_or_range)
        const matrix = this.getRange2D(args[0]);
        if (!matrix.length || !matrix[0].length) return [[]];

        const rLen = matrix.length;
        const cLen = matrix[0].length;
        const res: any[][] = [];

        for (let c = 0; c < cLen; c++) {
          const row: any[] = [];
          for (let r = 0; r < rLen; r++) {
            row.push(matrix[r][c]);
          }
          res.push(row);
        }
        return res;
      }

      case 'ROW': {
        if (!args[0]) return 1;
        const str = args[0]?.rangeStr || String(args[0]);
        const coord = parseCoord(str.split(':')[0]);
        return coord ? coord.row + 1 : 1;
      }

      case 'COLUMN': {
        if (!args[0]) return 1;
        const str = args[0]?.rangeStr || String(args[0]);
        const coord = parseCoord(str.split(':')[0]);
        return coord ? coord.col + 1 : 1;
      }

      case 'ROWS': {
        const matrix = this.getRange2D(args[0]);
        return matrix.length;
      }

      case 'COLUMNS': {
        const matrix = this.getRange2D(args[0]);
        return matrix[0]?.length || 0;
      }

      case 'ADDRESS': {
        const r = parseInt(String(args[0]), 10) || 1;
        const c = (parseInt(String(args[1]), 10) || 1) - 1;
        const mode = parseInt(String(args[2] ?? '1'), 10) || 1;
        const letter = colToLetter(c);
        if (mode === 1) return `$${letter}$${r}`;
        if (mode === 2) return `${letter}$${r}`;
        if (mode === 3) return `$${letter}${r}`;
        return `${letter}${r}`;
      }

      case 'HYPERLINK': {
        const url = String(args[0] ?? '');
        const label = args[1] !== undefined ? String(args[1]) : url;
        return label;
      }

      // ==========================================
      // --- 2. Filter & Array (6 functions) ---
      // ==========================================
      case 'FILTER': {
        // FILTER(range, condition1, [condition2, ...])
        const matrix = this.getRange2D(args[0]);
        if (!matrix.length) return '#N/A';

        const conds = args.slice(1).map((arg) => this.getRangeValues(arg));
        const passedRows: any[][] = [];

        for (let r = 0; r < matrix.length; r++) {
          let keep = true;
          for (const cond of conds) {
            if (!Boolean(cond[r])) {
              keep = false;
              break;
            }
          }
          if (keep) {
            passedRows.push(matrix[r]);
          }
        }

        if (passedRows.length === 0) return '#N/A';
        return passedRows.length === 1 && passedRows[0].length === 1
          ? passedRows[0][0]
          : passedRows;
      }

      case 'UNIQUE': {
        // UNIQUE(range)
        const matrix = this.getRange2D(args[0]);
        const seen = new Set<string>();
        const uniqueRows: any[][] = [];

        for (const row of matrix) {
          const key = JSON.stringify(row);
          if (!seen.has(key)) {
            seen.add(key);
            uniqueRows.push(row);
          }
        }

        return uniqueRows.length === 1 && uniqueRows[0].length === 1
          ? uniqueRows[0][0]
          : uniqueRows;
      }

      case 'SORT': {
        // SORT(range, sort_column, is_ascending, ...)
        const matrix = this.getRange2D(args[0]).map((r) => [...r]);
        const sortCol = (parseInt(String(args[1] ?? '1'), 10) || 1) - 1;
        const isAsc = args[2] !== undefined ? Boolean(args[2]) : true;

        matrix.sort((rowA, rowB) => {
          const valA = rowA[sortCol];
          const valB = rowB[sortCol];
          const numA = Number(valA);
          const numB = Number(valB);

          if (!isNaN(numA) && !isNaN(numB)) {
            return isAsc ? numA - numB : numB - numA;
          }
          const strA = String(valA ?? '').toLowerCase();
          const strB = String(valB ?? '').toLowerCase();
          if (strA < strB) return isAsc ? -1 : 1;
          if (strA > strB) return isAsc ? 1 : -1;
          return 0;
        });

        return matrix;
      }

      case 'SEQUENCE': {
        // SEQUENCE(rows, [columns], [start], [step])
        const rCount = Math.max(1, parseInt(String(args[0] ?? '1'), 10) || 1);
        const cCount = Math.max(1, parseInt(String(args[1] ?? '1'), 10) || 1);
        let cur = Number(args[2] ?? 1);
        const step = Number(args[3] ?? 1);

        const matrix: number[][] = [];
        for (let r = 0; r < rCount; r++) {
          const row: number[] = [];
          for (let c = 0; c < cCount; c++) {
            row.push(cur);
            cur += step;
          }
          matrix.push(row);
        }

        if (rCount === 1 && cCount === 1) return matrix[0][0];
        if (cCount === 1) return matrix.map((row) => row[0]);
        return matrix;
      }

      case 'ARRAYFORMULA': {
        return args[0];
      }

      case 'FLATTEN': {
        const vals = this.extractAllValues(args);
        return vals.map((v) => [v]);
      }

      // ==========================================
      // --- 3. Math & Statistics (41 functions) ---
      // ==========================================
      case 'SUM': {
        const nums = this.extractNumericValues(args);
        return nums.reduce((acc, curr) => acc + curr, 0);
      }

      case 'AVERAGE':
      case 'AVG': {
        const nums = this.extractNumericValues(args);
        if (nums.length === 0) return 0;
        return Math.round((nums.reduce((acc, curr) => acc + curr, 0) / nums.length) * 1000000) / 1000000;
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
        if (args.length < 2) return 0;
        const values = this.getRangeValues(args[0]);
        const criteria = args[1];
        let count = 0;
        for (const v of values) {
          if (matchesCriteria(v, criteria)) count++;
        }
        return count;
      }

      case 'COUNTIFS': {
        if (args.length < 2 || args.length % 2 !== 0) return 0;
        const pairs: { list: any[]; crit: any }[] = [];
        for (let i = 0; i < args.length; i += 2) {
          pairs.push({ list: this.getRangeValues(args[i]), crit: args[i + 1] });
        }
        const len = pairs[0].list.length;
        let count = 0;
        for (let idx = 0; idx < len; idx++) {
          let allMatch = true;
          for (const p of pairs) {
            if (!matchesCriteria(p.list[idx], p.crit)) {
              allMatch = false;
              break;
            }
          }
          if (allMatch) count++;
        }
        return count;
      }

      case 'SUMIF': {
        if (args.length < 2) return 0;
        const rangeVals = this.getRangeValues(args[0]);
        const criteria = args[1];
        const sumVals = args[2] !== undefined ? this.getRangeValues(args[2]) : rangeVals;

        let total = 0;
        for (let i = 0; i < rangeVals.length; i++) {
          if (matchesCriteria(rangeVals[i], criteria)) {
            const num = Number(sumVals[i]);
            if (!isNaN(num)) total += num;
          }
        }
        return total;
      }

      case 'SUMIFS': {
        if (args.length < 3) return 0;
        const sumVals = this.getRangeValues(args[0]);
        const pairs: { list: any[]; crit: any }[] = [];
        for (let i = 1; i < args.length; i += 2) {
          pairs.push({ list: this.getRangeValues(args[i]), crit: args[i + 1] });
        }

        let total = 0;
        for (let i = 0; i < sumVals.length; i++) {
          let match = true;
          for (const p of pairs) {
            if (!matchesCriteria(p.list[i], p.crit)) {
              match = false;
              break;
            }
          }
          if (match) {
            const num = Number(sumVals[i]);
            if (!isNaN(num)) total += num;
          }
        }
        return total;
      }

      case 'AVERAGEIF': {
        if (args.length < 2) return 0;
        const rangeVals = this.getRangeValues(args[0]);
        const criteria = args[1];
        const avgVals = args[2] !== undefined ? this.getRangeValues(args[2]) : rangeVals;

        let total = 0;
        let count = 0;
        for (let i = 0; i < rangeVals.length; i++) {
          if (matchesCriteria(rangeVals[i], criteria)) {
            const num = Number(avgVals[i]);
            if (!isNaN(num)) {
              total += num;
              count++;
            }
          }
        }
        return count > 0 ? Math.round((total / count) * 1000000) / 1000000 : 0;
      }

      case 'AVERAGEIFS': {
        if (args.length < 3) return 0;
        const avgVals = this.getRangeValues(args[0]);
        const pairs: { list: any[]; crit: any }[] = [];
        for (let i = 1; i < args.length; i += 2) {
          pairs.push({ list: this.getRangeValues(args[i]), crit: args[i + 1] });
        }

        let total = 0;
        let count = 0;
        for (let i = 0; i < avgVals.length; i++) {
          let match = true;
          for (const p of pairs) {
            if (!matchesCriteria(p.list[i], p.crit)) {
              match = false;
              break;
            }
          }
          if (match) {
            const num = Number(avgVals[i]);
            if (!isNaN(num)) {
              total += num;
              count++;
            }
          }
        }
        return count > 0 ? Math.round((total / count) * 1000000) / 1000000 : 0;
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

      case 'MODE': {
        const nums = this.extractNumericValues(args);
        if (!nums.length) return '#N/A';
        const counts = new Map<number, number>();
        let maxCount = 0;
        let modeVal = nums[0];
        for (const n of nums) {
          const c = (counts.get(n) || 0) + 1;
          counts.set(n, c);
          if (c > maxCount) {
            maxCount = c;
            modeVal = n;
          }
        }
        return modeVal;
      }

      case 'STDEV':
      case 'STDEV.S': {
        const nums = this.extractNumericValues(args);
        if (nums.length <= 1) return '#DIV/0!';
        const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
        const variance = nums.reduce((acc, x) => acc + Math.pow(x - mean, 2), 0) / (nums.length - 1);
        return Math.round(Math.sqrt(variance) * 1000000) / 1000000;
      }

      case 'VAR':
      case 'VAR.S': {
        const nums = this.extractNumericValues(args);
        if (nums.length <= 1) return '#DIV/0!';
        const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
        const variance = nums.reduce((acc, x) => acc + Math.pow(x - mean, 2), 0) / (nums.length - 1);
        return Math.round(variance * 1000000) / 1000000;
      }

      case 'PRODUCT': {
        const nums = this.extractNumericValues(args);
        return nums.length ? nums.reduce((a, b) => a * b, 1) : 0;
      }

      case 'POWER':
        return Math.pow(Number(args[0]) || 0, Number(args[1]) || 0);

      case 'SQRT': {
        const v = Number(args[0]) || 0;
        return v >= 0 ? Math.sqrt(v) : '#NUM!';
      }

      case 'ABS':
        return Math.abs(Number(args[0]) || 0);

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

      case 'INT':
        return Math.floor(Number(args[0]) || 0);

      case 'MOD': {
        const n = Number(args[0]) || 0;
        const d = Number(args[1]) || 0;
        return d !== 0 ? n % d : '#DIV/0!';
      }

      case 'CEILING': {
        const val = Number(args[0]) || 0;
        const factor = args[1] !== undefined ? Number(args[1]) || 1 : 1;
        return Math.ceil(val / factor) * factor;
      }

      case 'FLOOR': {
        const val = Number(args[0]) || 0;
        const factor = args[1] !== undefined ? Number(args[1]) || 1 : 1;
        return Math.floor(val / factor) * factor;
      }

      case 'RAND':
        return Math.random();

      case 'RANDBETWEEN': {
        const low = Math.ceil(Number(args[0]) || 0);
        const high = Math.floor(Number(args[1]) || 0);
        if (low > high) return '#NUM!';
        return Math.floor(Math.random() * (high - low + 1)) + low;
      }

      case 'PI':
        return Math.PI;

      case 'EXP':
        return Math.exp(Number(args[0]) || 0);

      case 'LN': {
        const v = Number(args[0]) || 0;
        return v > 0 ? Math.log(v) : '#NUM!';
      }

      case 'LOG': {
        const v = Number(args[0]) || 0;
        const base = args[1] !== undefined ? Number(args[1]) || 10 : 10;
        return v > 0 && base > 0 && base !== 1 ? Math.log(v) / Math.log(base) : '#NUM!';
      }

      case 'LOG10': {
        const v = Number(args[0]) || 0;
        return v > 0 ? Math.log10(v) : '#NUM!';
      }

      case 'SIGN': {
        const v = Number(args[0]) || 0;
        return Math.sign(v);
      }

      case 'TRUNC': {
        const v = Number(args[0]) || 0;
        const places = parseInt(String(args[1] ?? '0'), 10) || 0;
        const f = Math.pow(10, places);
        return Math.trunc(v * f) / f;
      }

      case 'SUMPRODUCT': {
        if (!args.length) return 0;
        const arrays = args.map((arg) => this.getRangeValues(arg).map(Number));
        const len = arrays[0].length;
        let sum = 0;
        for (let i = 0; i < len; i++) {
          let prod = 1;
          for (const arr of arrays) {
            prod *= isNaN(arr[i]) ? 0 : arr[i];
          }
          sum += prod;
        }
        return sum;
      }

      case 'LARGE': {
        const nums = this.extractNumericValues([args[0]]).sort((a, b) => b - a);
        const k = parseInt(String(args[1]), 10) || 1;
        if (k < 1 || k > nums.length) return '#NUM!';
        return nums[k - 1];
      }

      case 'SMALL': {
        const nums = this.extractNumericValues([args[0]]).sort((a, b) => a - b);
        const k = parseInt(String(args[1]), 10) || 1;
        if (k < 1 || k > nums.length) return '#NUM!';
        return nums[k - 1];
      }

      // ==========================================
      // --- 4. Logic (18 functions) ---
      // ==========================================
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
        return all.length ? all.every((v) => Boolean(v)) : false;
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

      case 'SWITCH': {
        // SWITCH(expression, case1, value1, [case2, value2, ...], [default])
        if (args.length < 3) return '#N/A';
        const expr = args[0];
        let hasDefault = (args.length - 1) % 2 !== 0;
        const defaultVal = hasDefault ? args[args.length - 1] : '#N/A';
        const limit = hasDefault ? args.length - 1 : args.length;

        for (let i = 1; i < limit; i += 2) {
          if (expr == args[i]) {
            return args[i + 1];
          }
        }
        return defaultVal;
      }

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

      case 'ISNA': {
        return args[0] === '#N/A';
      }

      case 'ISNONTEXT': {
        const v = args[0];
        return typeof v !== 'string';
      }

      case 'ISLOGICAL': {
        return typeof args[0] === 'boolean';
      }

      case 'TRUE':
        return true;

      case 'FALSE':
        return false;

      // ==========================================
      // --- 5. Text (24 functions) ---
      // ==========================================
      case 'CONCAT':
      case 'CONCATENATE': {
        const all = this.extractAllValues(args);
        return all.join('');
      }

      case 'TEXTJOIN': {
        const delim = String(args[0] ?? '');
        const ignoreEmpty = Boolean(args[1]);
        const items = this.extractAllValues(args.slice(2));
        const filtered = ignoreEmpty
          ? items.filter((x) => x !== '' && x !== null && x !== undefined)
          : items;
        return filtered.join(delim);
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

      case 'LEN':
        return String(args[0] ?? '').length;

      case 'LOWER':
        return String(args[0] ?? '').toLowerCase();

      case 'UPPER':
        return String(args[0] ?? '').toUpperCase();

      case 'PROPER':
        return String(args[0] ?? '')
          .toLowerCase()
          .replace(/\b\w/g, (c) => c.toUpperCase());

      case 'TRIM':
        return String(args[0] ?? '').trim().replace(/\s+/g, ' ');

      case 'SUBSTITUTE': {
        const text = String(args[0] ?? '');
        const oldT = String(args[1] ?? '');
        const newT = String(args[2] ?? '');
        const instance = args[3] !== undefined ? parseInt(String(args[3]), 10) : 0;

        if (instance > 0) {
          let count = 0;
          return text.replace(new RegExp(oldT.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), (m) => {
            count++;
            return count === instance ? newT : m;
          });
        }
        return text.split(oldT).join(newT);
      }

      case 'REPLACE': {
        const text = String(args[0] ?? '');
        const start = (parseInt(String(args[1]), 10) || 1) - 1;
        const numChars = parseInt(String(args[2]), 10) || 0;
        const newText = String(args[3] ?? '');
        return text.slice(0, start) + newText + text.slice(start + numChars);
      }

      case 'REPT': {
        const text = String(args[0] ?? '');
        const count = Math.max(0, parseInt(String(args[1]), 10) || 0);
        return text.repeat(count);
      }

      case 'FIND': {
        // FIND(search_for, text_to_search, [starting_at]) - case sensitive
        const findText = String(args[0] ?? '');
        const withinText = String(args[1] ?? '');
        const startAt = (parseInt(String(args[2] ?? '1'), 10) || 1) - 1;
        const idx = withinText.indexOf(findText, startAt);
        return idx !== -1 ? idx + 1 : '#VALUE!';
      }

      case 'SEARCH': {
        // SEARCH(search_for, text_to_search, [starting_at]) - case insensitive with wildcards
        const findPattern = String(args[0] ?? '').toLowerCase();
        const withinText = String(args[1] ?? '').toLowerCase();
        const startAt = (parseInt(String(args[2] ?? '1'), 10) || 1) - 1;

        if (findPattern.includes('*') || findPattern.includes('?')) {
          const rx = new RegExp(
            findPattern.replace(/([.+^$[\]\\(){}|])/g, '\\$1').replace(/\*/g, '.*').replace(/\?/g, '.'),
            'i'
          );
          const sub = withinText.slice(startAt);
          const match = sub.match(rx);
          return match && match.index !== undefined ? startAt + match.index + 1 : '#VALUE!';
        }
        const idx = withinText.indexOf(findPattern, startAt);
        return idx !== -1 ? idx + 1 : '#VALUE!';
      }

      case 'SPLIT': {
        const text = String(args[0] ?? '');
        const delimiter = String(args[1] ?? ' ');
        const parts = text.split(delimiter);
        return parts;
      }

      case 'JOIN': {
        const delim = String(args[0] ?? '');
        const vals = this.extractAllValues(args.slice(1));
        return vals.join(delim);
      }

      case 'VALUE': {
        const n = parseFloat(String(args[0] ?? '').replace(/[$,]/g, ''));
        return isNaN(n) ? '#VALUE!' : n;
      }

      case 'EXACT': {
        return String(args[0] ?? '') === String(args[1] ?? '');
      }

      case 'CHAR': {
        const code = parseInt(String(args[0]), 10);
        return isNaN(code) ? '#VALUE!' : String.fromCharCode(code);
      }

      case 'CODE': {
        const str = String(args[0] ?? '');
        return str.length ? str.charCodeAt(0) : '#VALUE!';
      }

      case 'CLEAN': {
        return String(args[0] ?? '').replace(/[\x00-\x1F\x7F]/g, '');
      }

      // ==========================================
      // --- 6. Date & Time (18 functions) ---
      // ==========================================
      case 'TODAY':
        return formatDate(new Date());

      case 'NOW': {
        const now = new Date();
        return `${formatDate(now)} ${formatTime(now.getHours(), now.getMinutes(), now.getSeconds())}`;
      }

      case 'DATE': {
        const y = Number(args[0]) || 2026;
        const m = (Number(args[1]) || 1) - 1;
        const d = Number(args[2]) || 1;
        return formatDate(new Date(y, m, d));
      }

      case 'TIME': {
        const h = Number(args[0]) || 0;
        const m = Number(args[1]) || 0;
        const s = Number(args[2]) || 0;
        return formatTime(h, m, s);
      }

      case 'YEAR': {
        const dt = parseDate(args[0]);
        return dt ? dt.getFullYear() : '#VALUE!';
      }

      case 'MONTH': {
        const dt = parseDate(args[0]);
        return dt ? dt.getMonth() + 1 : '#VALUE!';
      }

      case 'DAY': {
        const dt = parseDate(args[0]);
        return dt ? dt.getDate() : '#VALUE!';
      }

      case 'HOUR': {
        const dt = parseDate(args[0]);
        if (dt) return dt.getHours();
        const m = String(args[0]).match(/^(\d{1,2}):(\d{2})/);
        return m ? parseInt(m[1], 10) : 0;
      }

      case 'MINUTE': {
        const dt = parseDate(args[0]);
        if (dt) return dt.getMinutes();
        const m = String(args[0]).match(/^\d{1,2}:(\d{2})/);
        return m ? parseInt(m[1], 10) : 0;
      }

      case 'SECOND': {
        const dt = parseDate(args[0]);
        if (dt) return dt.getSeconds();
        const m = String(args[0]).match(/^\d{1,2}:\d{2}:(\d{2})/);
        return m ? parseInt(m[1], 10) : 0;
      }

      case 'DAYS': {
        const dEnd = parseDate(args[0]);
        const dStart = parseDate(args[1]);
        if (!dEnd || !dStart) return '#VALUE!';
        return Math.round((dEnd.getTime() - dStart.getTime()) / (1000 * 60 * 60 * 24));
      }

      case 'NETWORKDAYS': {
        const dStart = parseDate(args[0]);
        const dEnd = parseDate(args[1]);
        if (!dStart || !dEnd) return '#VALUE!';
        const holidays = args[2] ? this.getRangeValues(args[2]) : [];
        return calcNetworkDays(dStart, dEnd, holidays);
      }

      case 'DATEDIF': {
        const d1 = parseDate(args[0]);
        const d2 = parseDate(args[1]);
        const unit = String(args[2] ?? 'D');
        if (!d1 || !d2) return '#VALUE!';
        return calcDateDif(d1, d2, unit);
      }

      case 'EDATE': {
        const d = parseDate(args[0]);
        const months = parseInt(String(args[1] ?? '0'), 10) || 0;
        if (!d) return '#VALUE!';
        return calcEDate(d, months);
      }

      case 'EOMONTH': {
        const d = parseDate(args[0]);
        const months = parseInt(String(args[1] ?? '0'), 10) || 0;
        if (!d) return '#VALUE!';
        return calcEOMonth(d, months);
      }

      case 'WEEKDAY': {
        const dt = parseDate(args[0]);
        if (!dt) return '#VALUE!';
        const type = parseInt(String(args[1] ?? '1'), 10) || 1;
        const day = dt.getDay(); // 0 = Sunday, 6 = Saturday
        if (type === 1) return day + 1; // 1 = Sun .. 7 = Sat
        if (type === 2) return day === 0 ? 7 : day; // 1 = Mon .. 7 = Sun
        return day + 1;
      }

      case 'DATEVALUE': {
        const dt = parseDate(args[0]);
        if (!dt) return '#VALUE!';
        const epoch = new Date(1899, 11, 30);
        return Math.floor((dt.getTime() - epoch.getTime()) / 86400000);
      }

      case 'TIMEVALUE': {
        const s = String(args[0]).trim();
        const m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
        if (!m) return '#VALUE!';
        const secs = parseInt(m[1], 10) * 3600 + parseInt(m[2], 10) * 60 + (parseInt(m[3] || '0', 10));
        return Math.round((secs / 86400) * 1000000) / 1000000;
      }

      // ==========================================
      // --- 7. Google-Specific Specials (2 functions) ---
      // ==========================================
      case 'SPARKLINE': {
        // SPARKLINE(data, [options])
        const nums = this.extractNumericValues([args[0]]);
        const options = args[1] !== undefined ? String(args[1]) : '';
        return renderSparkline(nums, options);
      }

      case 'GOOGLEFINANCE': {
        // GOOGLEFINANCE(ticker, [attribute], [start_date], [end_date], [interval])
        const ticker = String(args[0] ?? 'GOOG');
        const attr = args[1] !== undefined ? String(args[1]) : 'price';
        return executeGoogleFinance(ticker, attr);
      }

      default:
        return `#NAME? (${fnName})`;
    }
  }
}

function autoCloseParens(formula: string): string {
  let openCount = 0;
  let inQuotes = false;
  for (let i = 0; i < formula.length; i++) {
    const ch = formula[i];
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes) {
      if (ch === '(') openCount++;
      else if (ch === ')') openCount = Math.max(0, openCount - 1);
    }
  }
  if (openCount > 0) {
    return formula + ')'.repeat(openCount);
  }
  return formula;
}

// Internal recursive formula evaluator
function evaluateFormulaInternal(
  formula: string,
  grid: SheetGrid,
  evaluating: Set<string>,
  cache: Map<string, string | number>
): any {
  let clean = formula.trim();
  if (!clean.startsWith('=')) {
    const num = Number(clean);
    return isNaN(num) || clean === '' ? clean : num;
  }

  clean = autoCloseParens(clean);
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
  const res = evaluateFormulaInternal(formula, grid, visiting, cache);
  if (Array.isArray(res)) {
    return Array.isArray(res[0]) ? res[0][0] : res[0];
  }
  return res;
}

// Recomputes all cells in a sheet grid in topological dependency order and spills dynamic arrays
export function recalculateGrid(grid: SheetGrid): SheetGrid {
  const updated: SheetGrid = { ...grid };
  const evaluating = new Set<string>();
  const computedCache = new Map<string, string | number>();
  const spillCells: { originKey: string; matrix: any[][] }[] = [];

  for (const [key, cell] of Object.entries(updated)) {
    const raw = String(cell.raw ?? '').trim();
    if (raw.startsWith('=')) {
      evaluating.add(normalizeKey(key));
      const res = evaluateFormulaInternal(raw, updated, evaluating, computedCache);
      evaluating.delete(normalizeKey(key));

      if (Array.isArray(res)) {
        const matrix = Array.isArray(res[0]) ? (res as any[][]) : res.map((item) => [item]);
        cell.computed = matrix[0]?.[0] ?? '';
        computedCache.set(normalizeKey(key), cell.computed);
        spillCells.push({ originKey: key, matrix });
      } else {
        cell.computed = res;
        computedCache.set(normalizeKey(key), cell.computed);
      }
    } else {
      const num = Number(raw);
      cell.computed = isNaN(num) || raw === '' ? raw : num;
      computedCache.set(normalizeKey(key), cell.computed);
    }
  }

  // Handle array spills into neighboring cells
  for (const { originKey, matrix } of spillCells) {
    const coord = parseCoord(originKey);
    if (!coord) continue;

    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix[r].length; c++) {
        if (r === 0 && c === 0) continue;
        const targetCol = coord.col + c;
        const targetRow = coord.row + r;
        const targetKey = `${colToLetter(targetCol)}${targetRow + 1}`;

        if (!updated[targetKey] || !updated[targetKey].raw || updated[targetKey].raw.trim() === '') {
          updated[targetKey] = {
            raw: '',
            computed: matrix[r][c],
          };
          computedCache.set(targetKey, matrix[r][c]);
        }
      }
    }
  }

  return updated;
}

// ==========================================
// --- Formula Autocomplete Catalog & Helper ---
// ==========================================

export interface FormulaSuggestion {
  name: string;
  category: 'Lookup' | 'Filter & Array' | 'Math' | 'Statistical' | 'Logical' | 'Text' | 'Date & Time' | 'Google';
  syntax: string;
  args: string[];
  description: string;
  example: string;
}

export const FORMULA_CATALOG: FormulaSuggestion[] = [
  // --- Lookup & Reference ---
  {
    name: 'VLOOKUP',
    category: 'Lookup',
    syntax: 'VLOOKUP(search_key, range, index, [is_sorted])',
    args: ['search_key', 'range', 'index', '[is_sorted]'],
    description: 'Vertical lookup. Searches down the first column of a range for a key and returns the value of a specified cell in the row found.',
    example: '=VLOOKUP("Apple", A1:B10, 2, FALSE)',
  },
  {
    name: 'HLOOKUP',
    category: 'Lookup',
    syntax: 'HLOOKUP(search_key, range, index, [is_sorted])',
    args: ['search_key', 'range', 'index', '[is_sorted]'],
    description: 'Horizontal lookup. Searches across the first row of a range for a key and returns the value of a specified cell in the column found.',
    example: '=HLOOKUP("Q1", A1:D5, 3, FALSE)',
  },
  {
    name: 'XLOOKUP',
    category: 'Lookup',
    syntax: 'XLOOKUP(search_key, lookup_range, result_range, [missing_value], [match_mode], [search_mode])',
    args: ['search_key', 'lookup_range', 'result_range', '[missing_value]', '[match_mode]', '[search_mode]'],
    description: 'Modern two-way search across any array or range, returning corresponding values with optional fallback value.',
    example: '=XLOOKUP(A1, B1:B10, C1:C10, "Not Found")',
  },
  {
    name: 'INDEX',
    category: 'Lookup',
    syntax: 'INDEX(reference, [row], [column])',
    args: ['reference', '[row]', '[column]'],
    description: 'Returns the content of a cell, specified by row and column offset within a range.',
    example: '=INDEX(A1:C10, 2, 3)',
  },
  {
    name: 'MATCH',
    category: 'Lookup',
    syntax: 'MATCH(search_key, range, [search_type])',
    args: ['search_key', 'range', '[search_type]'],
    description: 'Returns the relative position of an item in a range that matches a specified value.',
    example: '=MATCH("Widget", A1:A10, 0)',
  },
  {
    name: 'CHOOSE',
    category: 'Lookup',
    syntax: 'CHOOSE(index, choice1, [choice2, ...])',
    args: ['index', 'choice1', '[choice2]', '...'],
    description: 'Selects and returns an argument from a list of up to 30 choices based on index position.',
    example: '=CHOOSE(2, "Red", "Green", "Blue")',
  },
  {
    name: 'OFFSET',
    category: 'Lookup',
    syntax: 'OFFSET(cell_reference, offset_rows, offset_columns, [height], [width])',
    args: ['cell_reference', 'offset_rows', 'offset_columns', '[height]', '[width]'],
    description: 'Returns a range reference shifted a specified number of rows and columns from a starting cell reference.',
    example: '=OFFSET(A1, 3, 2)',
  },
  {
    name: 'TRANSPOSE',
    category: 'Lookup',
    syntax: 'TRANSPOSE(array_or_range)',
    args: ['array_or_range'],
    description: 'Transposes the rows and columns of an array or range of cells.',
    example: '=TRANSPOSE(A1:C2)',
  },
  {
    name: 'ROW',
    category: 'Lookup',
    syntax: 'ROW([cell_reference])',
    args: ['[cell_reference]'],
    description: 'Returns the row number of a specified cell reference.',
    example: '=ROW(A5)',
  },
  {
    name: 'COLUMN',
    category: 'Lookup',
    syntax: 'COLUMN([cell_reference])',
    args: ['[cell_reference]'],
    description: 'Returns the column number of a specified cell reference.',
    example: '=COLUMN(C1)',
  },
  {
    name: 'ROWS',
    category: 'Lookup',
    syntax: 'ROWS(range)',
    args: ['range'],
    description: 'Returns the number of rows in a specified array or range.',
    example: '=ROWS(A1:C10)',
  },
  {
    name: 'COLUMNS',
    category: 'Lookup',
    syntax: 'COLUMNS(range)',
    args: ['range'],
    description: 'Returns the number of columns in a specified array or range.',
    example: '=COLUMNS(A1:C10)',
  },
  {
    name: 'ADDRESS',
    category: 'Lookup',
    syntax: 'ADDRESS(row, column, [absolute_relative_mode], [use_a1_notation], [sheet])',
    args: ['row', 'column', '[absolute_relative_mode]', '[use_a1_notation]', '[sheet]'],
    description: 'Obtains a cell address as text according to the specified row and column numbers.',
    example: '=ADDRESS(1, 2)',
  },
  {
    name: 'HYPERLINK',
    category: 'Lookup',
    syntax: 'HYPERLINK(url, [link_label])',
    args: ['url', '[link_label]'],
    description: 'Creates a clickable hyperlink in the cell pointing to a URL with an optional label.',
    example: '=HYPERLINK("https://google.com", "Google")',
  },

  // --- Filter & Array ---
  {
    name: 'FILTER',
    category: 'Filter & Array',
    syntax: 'FILTER(range, condition1, [condition2, ...])',
    args: ['range', 'condition1', '[condition2]', '...'],
    description: 'Returns a filtered version of the source range, returning only rows or columns that meet the specified conditions.',
    example: '=FILTER(A1:B10, B1:B10 > 50)',
  },
  {
    name: 'UNIQUE',
    category: 'Filter & Array',
    syntax: 'UNIQUE(range, [by_col], [exactly_once])',
    args: ['range', '[by_col]', '[exactly_once]'],
    description: 'Returns unique rows in the provided source range, discarding duplicates.',
    example: '=UNIQUE(A1:A20)',
  },
  {
    name: 'SORT',
    category: 'Filter & Array',
    syntax: 'SORT(range, sort_column, is_ascending, [sort_column2, is_ascending2, ...])',
    args: ['range', 'sort_column', 'is_ascending', '...'],
    description: 'Sorts the rows of a given array or range by the values in one or more columns.',
    example: '=SORT(A1:C10, 2, TRUE)',
  },
  {
    name: 'SEQUENCE',
    category: 'Filter & Array',
    syntax: 'SEQUENCE(rows, [columns], [start], [step])',
    args: ['rows', '[columns]', '[start]', '[step]'],
    description: 'Returns an array of sequential numbers, such as 1, 2, 3, 4.',
    example: '=SEQUENCE(5, 1, 10, 2)',
  },
  {
    name: 'ARRAYFORMULA',
    category: 'Filter & Array',
    syntax: 'ARRAYFORMULA(array_formula)',
    args: ['array_formula'],
    description: 'Enables the display of values returned from an array formula into multiple rows and/or columns.',
    example: '=ARRAYFORMULA(A1:A5 * B1:B5)',
  },
  {
    name: 'FLATTEN',
    category: 'Filter & Array',
    syntax: 'FLATTEN(range1, [range2, ...])',
    args: ['range1', '[range2]', '...'],
    description: 'Flattens all the values from one or more ranges into a single column.',
    example: '=FLATTEN(A1:B3)',
  },

  // --- Math & Statistics ---
  {
    name: 'SUM',
    category: 'Math',
    syntax: 'SUM(value1, [value2, ...])',
    args: ['value1', '[value2]', '...'],
    description: 'Returns the sum of a series of numbers and/or cells.',
    example: '=SUM(A1:A10)',
  },
  {
    name: 'AVERAGE',
    category: 'Statistical',
    syntax: 'AVERAGE(value1, [value2, ...])',
    args: ['value1', '[value2]', '...'],
    description: 'Returns the numerical average value in a dataset, ignoring text.',
    example: '=AVERAGE(A1:A10)',
  },
  {
    name: 'AVG',
    category: 'Statistical',
    syntax: 'AVG(value1, [value2, ...])',
    args: ['value1', '[value2]', '...'],
    description: 'Shorthand alias for AVERAGE.',
    example: '=AVG(A1:A10)',
  },
  {
    name: 'COUNT',
    category: 'Statistical',
    syntax: 'COUNT(value1, [value2, ...])',
    args: ['value1', '[value2]', '...'],
    description: 'Returns the count of the number of numeric values in a dataset.',
    example: '=COUNT(A1:A10)',
  },
  {
    name: 'COUNTA',
    category: 'Statistical',
    syntax: 'COUNTA(value1, [value2, ...])',
    args: ['value1', '[value2]', '...'],
    description: 'Returns the count of the number of non-empty values in a dataset.',
    example: '=COUNTA(A1:A10)',
  },
  {
    name: 'COUNTBLANK',
    category: 'Statistical',
    syntax: 'COUNTBLANK(range)',
    args: ['range'],
    description: 'Returns the number of empty cells in a given range.',
    example: '=COUNTBLANK(A1:B10)',
  },
  {
    name: 'COUNTIF',
    category: 'Statistical',
    syntax: 'COUNTIF(range, criterion)',
    args: ['range', 'criterion'],
    description: 'Returns a conditional count across a range matching the criterion.',
    example: '=COUNTIF(A1:A10, ">20")',
  },
  {
    name: 'COUNTIFS',
    category: 'Statistical',
    syntax: 'COUNTIFS(criteria_range1, criterion1, [criteria_range2, criterion2, ...])',
    args: ['criteria_range1', 'criterion1', '[criteria_range2]', '[criterion2]', '...'],
    description: 'Returns the count of a range depending on multiple criteria across multiple ranges.',
    example: '=COUNTIFS(A1:A10, ">20", B1:B10, "Yes")',
  },
  {
    name: 'SUMIF',
    category: 'Math',
    syntax: 'SUMIF(range, criterion, [sum_range])',
    args: ['range', 'criterion', '[sum_range]'],
    description: 'Returns a conditional sum across a range based on a criterion.',
    example: '=SUMIF(A1:A10, ">100", B1:B10)',
  },
  {
    name: 'SUMIFS',
    category: 'Math',
    syntax: 'SUMIFS(sum_range, criteria_range1, criterion1, [criteria_range2, criterion2, ...])',
    args: ['sum_range', 'criteria_range1', 'criterion1', '[criteria_range2]', '[criterion2]', '...'],
    description: 'Returns the sum of a range depending on multiple criteria.',
    example: '=SUMIFS(C1:C10, A1:A10, "North", B1:B10, ">50")',
  },
  {
    name: 'AVERAGEIF',
    category: 'Statistical',
    syntax: 'AVERAGEIF(criteria_range, criterion, [average_range])',
    args: ['criteria_range', 'criterion', '[average_range]'],
    description: 'Returns the average of a range depending on a criterion.',
    example: '=AVERAGEIF(A1:A10, ">0", B1:B10)',
  },
  {
    name: 'AVERAGEIFS',
    category: 'Statistical',
    syntax: 'AVERAGEIFS(average_range, criteria_range1, criterion1, [criteria_range2, criterion2, ...])',
    args: ['average_range', 'criteria_range1', 'criterion1', '[criteria_range2]', '[criterion2]', '...'],
    description: 'Returns the average of a range depending on multiple criteria.',
    example: '=AVERAGEIFS(C1:C10, A1:A10, "Apples", B1:B10, ">10")',
  },
  {
    name: 'MIN',
    category: 'Statistical',
    syntax: 'MIN(value1, [value2, ...])',
    args: ['value1', '[value2]', '...'],
    description: 'Returns the minimum value in a numeric dataset.',
    example: '=MIN(A1:A10)',
  },
  {
    name: 'MAX',
    category: 'Statistical',
    syntax: 'MAX(value1, [value2, ...])',
    args: ['value1', '[value2]', '...'],
    description: 'Returns the maximum value in a numeric dataset.',
    example: '=MAX(A1:A10)',
  },
  {
    name: 'MEDIAN',
    category: 'Statistical',
    syntax: 'MEDIAN(value1, [value2, ...])',
    args: ['value1', '[value2]', '...'],
    description: 'Returns the median value in a numeric dataset.',
    example: '=MEDIAN(A1:A10)',
  },
  {
    name: 'MODE',
    category: 'Statistical',
    syntax: 'MODE(value1, [value2, ...])',
    args: ['value1', '[value2]', '...'],
    description: 'Returns the most commonly occurring value in a dataset.',
    example: '=MODE(A1:A10)',
  },
  {
    name: 'STDEV',
    category: 'Statistical',
    syntax: 'STDEV(value1, [value2, ...])',
    args: ['value1', '[value2]', '...'],
    description: 'Calculates the standard deviation based on a sample.',
    example: '=STDEV(A1:A10)',
  },
  {
    name: 'VAR',
    category: 'Statistical',
    syntax: 'VAR(value1, [value2, ...])',
    args: ['value1', '[value2]', '...'],
    description: 'Calculates the variance based on a sample.',
    example: '=VAR(A1:A10)',
  },
  {
    name: 'PRODUCT',
    category: 'Math',
    syntax: 'PRODUCT(value1, [value2, ...])',
    args: ['value1', '[value2]', '...'],
    description: 'Returns the result of multiplying a series of numbers together.',
    example: '=PRODUCT(A1:A5)',
  },
  {
    name: 'POWER',
    category: 'Math',
    syntax: 'POWER(base, exponent)',
    args: ['base', 'exponent'],
    description: 'Returns a number raised to a power.',
    example: '=POWER(4, 3)',
  },
  {
    name: 'SQRT',
    category: 'Math',
    syntax: 'SQRT(value)',
    args: ['value'],
    description: 'Returns the positive square root of a positive number.',
    example: '=SQRT(144)',
  },
  {
    name: 'ABS',
    category: 'Math',
    syntax: 'ABS(value)',
    args: ['value'],
    description: 'Returns the absolute value of a number.',
    example: '=ABS(-42)',
  },
  {
    name: 'ROUND',
    category: 'Math',
    syntax: 'ROUND(value, [places])',
    args: ['value', '[places]'],
    description: 'Rounds a number to a specified number of decimal places according to standard rules.',
    example: '=ROUND(3.14159, 2)',
  },
  {
    name: 'ROUNDUP',
    category: 'Math',
    syntax: 'ROUNDUP(value, [places])',
    args: ['value', '[places]'],
    description: 'Rounds a number up to a specified number of decimal places.',
    example: '=ROUNDUP(3.14159, 2)',
  },
  {
    name: 'ROUNDDOWN',
    category: 'Math',
    syntax: 'ROUNDDOWN(value, [places])',
    args: ['value', '[places]'],
    description: 'Rounds a number down to a specified number of decimal places.',
    example: '=ROUNDDOWN(3.14159, 2)',
  },
  {
    name: 'INT',
    category: 'Math',
    syntax: 'INT(value)',
    args: ['value'],
    description: 'Rounds a number down to the nearest integer that is less than or equal to it.',
    example: '=INT(9.99)',
  },
  {
    name: 'MOD',
    category: 'Math',
    syntax: 'MOD(dividend, divisor)',
    args: ['dividend', 'divisor'],
    description: 'Returns the remainder after dividing two numbers (modulo operation).',
    example: '=MOD(10, 3)',
  },
  {
    name: 'CEILING',
    category: 'Math',
    syntax: 'CEILING(value, [factor])',
    args: ['value', '[factor]'],
    description: 'Rounds a number up to the nearest integer multiple of specified significance factor.',
    example: '=CEILING(23.25, 0.5)',
  },
  {
    name: 'FLOOR',
    category: 'Math',
    syntax: 'FLOOR(value, [factor])',
    args: ['value', '[factor]'],
    description: 'Rounds a number down to the nearest integer multiple of specified significance factor.',
    example: '=FLOOR(23.75, 0.5)',
  },
  {
    name: 'RAND',
    category: 'Math',
    syntax: 'RAND()',
    args: [],
    description: 'Returns a random number between 0 inclusive and 1 exclusive.',
    example: '=RAND()',
  },
  {
    name: 'RANDBETWEEN',
    category: 'Math',
    syntax: 'RANDBETWEEN(low, high)',
    args: ['low', 'high'],
    description: 'Returns a random integer between two specified values inclusive.',
    example: '=RANDBETWEEN(1, 100)',
  },
  {
    name: 'PI',
    category: 'Math',
    syntax: 'PI()',
    args: [],
    description: 'Returns the value of Pi (3.14159265358979...) to 14 decimal places.',
    example: '=PI()',
  },
  {
    name: 'EXP',
    category: 'Math',
    syntax: 'EXP(exponent)',
    args: ['exponent'],
    description: 'Returns Euler number, e (~2.718) raised to a power.',
    example: '=EXP(1)',
  },
  {
    name: 'LN',
    category: 'Math',
    syntax: 'LN(value)',
    args: ['value'],
    description: 'Returns the natural logarithm of a number, base e.',
    example: '=LN(10)',
  },
  {
    name: 'LOG',
    category: 'Math',
    syntax: 'LOG(value, [base])',
    args: ['value', '[base]'],
    description: 'Returns the logarithm of a number with respect to a specified base.',
    example: '=LOG(100, 10)',
  },
  {
    name: 'LOG10',
    category: 'Math',
    syntax: 'LOG10(value)',
    args: ['value'],
    description: 'Returns the base-10 logarithm of a number.',
    example: '=LOG10(1000)',
  },
  {
    name: 'SIGN',
    category: 'Math',
    syntax: 'SIGN(value)',
    args: ['value'],
    description: 'Given an input number, returns -1 if negative, 1 if positive, and 0 if zero.',
    example: '=SIGN(-15)',
  },
  {
    name: 'TRUNC',
    category: 'Math',
    syntax: 'TRUNC(value, [places])',
    args: ['value', '[places]'],
    description: 'Truncates a number to a specified number of significant digits by omitting less significant digits.',
    example: '=TRUNC(3.14159, 2)',
  },
  {
    name: 'SUMPRODUCT',
    category: 'Math',
    syntax: 'SUMPRODUCT(array1, [array2, ...])',
    args: ['array1', '[array2]', '...'],
    description: 'Calculates the sum of the products of corresponding entries in two equally sized arrays or ranges.',
    example: '=SUMPRODUCT(A1:A5, B1:B5)',
  },
  {
    name: 'LARGE',
    category: 'Statistical',
    syntax: 'LARGE(data, n)',
    args: ['data', 'n'],
    description: 'Returns the Nth largest element from a dataset.',
    example: '=LARGE(A1:A10, 2)',
  },
  {
    name: 'SMALL',
    category: 'Statistical',
    syntax: 'SMALL(data, n)',
    args: ['data', 'n'],
    description: 'Returns the Nth smallest element from a dataset.',
    example: '=SMALL(A1:A10, 1)',
  },

  // --- Logic ---
  {
    name: 'IF',
    category: 'Logical',
    syntax: 'IF(logical_expression, value_if_true, [value_if_false])',
    args: ['logical_expression', 'value_if_true', '[value_if_false]'],
    description: 'Returns one value if a logical expression is `TRUE` and another if it is `FALSE`.',
    example: '=IF(A1>50, "Pass", "Fail")',
  },
  {
    name: 'IFS',
    category: 'Logical',
    syntax: 'IFS(condition1, value1, [condition2, value2, ...])',
    args: ['condition1', 'value1', '[condition2]', '[value2]', '...'],
    description: 'Evaluates multiple conditions and returns a value that corresponds to the first true condition.',
    example: '=IFS(A1>90, "A", A1>80, "B", A1>70, "C")',
  },
  {
    name: 'IFERROR',
    category: 'Logical',
    syntax: 'IFERROR(value, [value_if_error])',
    args: ['value', '[value_if_error]'],
    description: 'Returns the first argument if it is not an error value, otherwise returns the second argument if present, or a blank if omitted.',
    example: '=IFERROR(A1/B1, 0)',
  },
  {
    name: 'IFNA',
    category: 'Logical',
    syntax: 'IFNA(value, [value_if_na])',
    args: ['value', '[value_if_na]'],
    description: 'Evaluates a value. If the value is an #N/A error, returns the specified value.',
    example: '=IFNA(VLOOKUP(A1, B1:C10, 2, FALSE), "Not Found")',
  },
  {
    name: 'AND',
    category: 'Logical',
    syntax: 'AND(logical_expression1, [logical_expression2, ...])',
    args: ['logical_expression1', '[logical_expression2]', '...'],
    description: 'Returns TRUE if all of the provided arguments are logically true, and FALSE if any of the provided arguments are logically false.',
    example: '=AND(A1>0, B1<100)',
  },
  {
    name: 'OR',
    category: 'Logical',
    syntax: 'OR(logical_expression1, [logical_expression2, ...])',
    args: ['logical_expression1', '[logical_expression2]', '...'],
    description: 'Returns TRUE if any of the provided arguments are logically true, and FALSE if all of the provided arguments are logically false.',
    example: '=OR(A1>0, B1>0)',
  },
  {
    name: 'NOT',
    category: 'Logical',
    syntax: 'NOT(logical_expression)',
    args: ['logical_expression'],
    description: 'Returns the opposite of a logical value - `NOT(TRUE)` returns `FALSE`; `NOT(FALSE)` returns `TRUE`.',
    example: '=NOT(A1="Done")',
  },
  {
    name: 'XOR',
    category: 'Logical',
    syntax: 'XOR(logical_expression1, [logical_expression2, ...])',
    args: ['logical_expression1', '[logical_expression2]', '...'],
    description: 'Exclusive OR. Returns TRUE if an odd number of arguments are true, and FALSE otherwise.',
    example: '=XOR(A1>0, B1>0)',
  },
  {
    name: 'SWITCH',
    category: 'Logical',
    syntax: 'SWITCH(expression, case1, value1, [default_or_case2, default_or_value2, ...])',
    args: ['expression', 'case1', 'value1', '[default_or_case2]', '...'],
    description: 'Tests an expression against a list of cases and returns the corresponding value.',
    example: '=SWITCH(A1, 1, "Sunday", 2, "Monday", "Other")',
  },
  {
    name: 'ISBLANK',
    category: 'Logical',
    syntax: 'ISBLANK(value)',
    args: ['value'],
    description: 'Checks whether the referenced cell is empty.',
    example: '=ISBLANK(A1)',
  },
  {
    name: 'ISNUMBER',
    category: 'Logical',
    syntax: 'ISNUMBER(value)',
    args: ['value'],
    description: 'Checks whether a value is a number.',
    example: '=ISNUMBER(A1)',
  },
  {
    name: 'ISTEXT',
    category: 'Logical',
    syntax: 'ISTEXT(value)',
    args: ['value'],
    description: 'Checks whether a value is text.',
    example: '=ISTEXT(A1)',
  },
  {
    name: 'ISERROR',
    category: 'Logical',
    syntax: 'ISERROR(value)',
    args: ['value'],
    description: 'Checks whether a value is an error.',
    example: '=ISERROR(A1/B1)',
  },
  {
    name: 'ISNA',
    category: 'Logical',
    syntax: 'ISNA(value)',
    args: ['value'],
    description: 'Checks whether a value is the error `#N/A`.',
    example: '=ISNA(VLOOKUP(A1, B1:C10, 2, FALSE))',
  },
  {
    name: 'ISNONTEXT',
    category: 'Logical',
    syntax: 'ISNONTEXT(value)',
    args: ['value'],
    description: 'Checks whether a value is non-textual.',
    example: '=ISNONTEXT(A1)',
  },
  {
    name: 'ISLOGICAL',
    category: 'Logical',
    syntax: 'ISLOGICAL(value)',
    args: ['value'],
    description: 'Checks whether a value is `TRUE` or `FALSE`.',
    example: '=ISLOGICAL(A1)',
  },
  {
    name: 'TRUE',
    category: 'Logical',
    syntax: 'TRUE()',
    args: [],
    description: 'Returns the logical value `TRUE`.',
    example: '=TRUE()',
  },
  {
    name: 'FALSE',
    category: 'Logical',
    syntax: 'FALSE()',
    args: [],
    description: 'Returns the logical value `FALSE`.',
    example: '=FALSE()',
  },

  // --- Text ---
  {
    name: 'CONCATENATE',
    category: 'Text',
    syntax: 'CONCATENATE(string1, [string2, ...])',
    args: ['string1', '[string2]', '...'],
    description: 'Appends strings to one another.',
    example: '=CONCATENATE("Hello", " ", "World")',
  },
  {
    name: 'CONCAT',
    category: 'Text',
    syntax: 'CONCAT(value1, value2)',
    args: ['value1', 'value2'],
    description: 'Returns the concatenation of two values. Equivalent to the `&` operator.',
    example: '=CONCAT("Sheet", "1")',
  },
  {
    name: 'TEXTJOIN',
    category: 'Text',
    syntax: 'TEXTJOIN(delimiter, ignore_empty, text1, [text2, ...])',
    args: ['delimiter', 'ignore_empty', 'text1', '[text2]', '...'],
    description: 'Combines the text from multiple strings and/or arrays, with a specifiable delimiter separating each value.',
    example: '=TEXTJOIN(", ", TRUE, A1:A5)',
  },
  {
    name: 'TEXT',
    category: 'Text',
    syntax: 'TEXT(number, format)',
    args: ['number', 'format'],
    description: 'Converts a number into text according to a specified format.',
    example: '=TEXT(1234.56, "$#,##0.00")',
  },
  {
    name: 'LEFT',
    category: 'Text',
    syntax: 'LEFT(string, [num_chars])',
    args: ['string', '[num_chars]'],
    description: 'Returns the specified number of characters from the start of a given string.',
    example: '=LEFT(A1, 3)',
  },
  {
    name: 'RIGHT',
    category: 'Text',
    syntax: 'RIGHT(string, [num_chars])',
    args: ['string', '[num_chars]'],
    description: 'Returns the specified number of characters from the end of a given string.',
    example: '=RIGHT(A1, 4)',
  },
  {
    name: 'MID',
    category: 'Text',
    syntax: 'MID(string, starting_at, extract_length)',
    args: ['string', 'starting_at', 'extract_length'],
    description: 'Returns a segment of a string starting from a specified position for a given length.',
    example: '=MID(A1, 2, 5)',
  },
  {
    name: 'LEN',
    category: 'Text',
    syntax: 'LEN(text)',
    args: ['text'],
    description: 'Returns the length of a string.',
    example: '=LEN(A1)',
  },
  {
    name: 'LOWER',
    category: 'Text',
    syntax: 'LOWER(text)',
    args: ['text'],
    description: 'Converts a specified string to lowercase.',
    example: '=LOWER(A1)',
  },
  {
    name: 'UPPER',
    category: 'Text',
    syntax: 'UPPER(text)',
    args: ['text'],
    description: 'Converts a specified string to uppercase.',
    example: '=UPPER(A1)',
  },
  {
    name: 'PROPER',
    category: 'Text',
    syntax: 'PROPER(text)',
    args: ['text'],
    description: 'Capitalizes each word in a specified string.',
    example: '=PROPER("john doe")',
  },
  {
    name: 'TRIM',
    category: 'Text',
    syntax: 'TRIM(text)',
    args: ['text'],
    description: 'Removes leading, trailing, and repeated spaces in text.',
    example: '=TRIM("   hello world   ")',
  },
  {
    name: 'SUBSTITUTE',
    category: 'Text',
    syntax: 'SUBSTITUTE(text_to_search, search_for, replace_with, [occurrence_number])',
    args: ['text_to_search', 'search_for', 'replace_with', '[occurrence_number]'],
    description: 'Replaces existing text with new text in a string.',
    example: '=SUBSTITUTE(A1, "2023", "2026")',
  },
  {
    name: 'REPLACE',
    category: 'Text',
    syntax: 'REPLACE(text, position, length, new_text)',
    args: ['text', 'position', 'length', 'new_text'],
    description: 'Replaces part of a text string with a different text string.',
    example: '=REPLACE("Alphabet", 1, 5, "Mega")',
  },
  {
    name: 'REPT',
    category: 'Text',
    syntax: 'REPT(text_to_repeat, number_of_times)',
    args: ['text_to_repeat', 'number_of_times'],
    description: 'Returns specified text repeated a number of times.',
    example: '=REPT("*", 5)',
  },
  {
    name: 'FIND',
    category: 'Text',
    syntax: 'FIND(search_for, text_to_search, [starting_at])',
    args: ['search_for', 'text_to_search', '[starting_at]'],
    description: 'Returns the position at which a string is first found within text, case-sensitive.',
    example: '=FIND("Cat", A1)',
  },
  {
    name: 'SEARCH',
    category: 'Text',
    syntax: 'SEARCH(search_for, text_to_search, [starting_at])',
    args: ['search_for', 'text_to_search', '[starting_at]'],
    description: 'Returns the position at which a string is first found within text, ignoring capitalization and supporting wildcards.',
    example: '=SEARCH("cat", A1)',
  },
  {
    name: 'SPLIT',
    category: 'Text',
    syntax: 'SPLIT(text, delimiter, [split_by_each], [remove_empty_text])',
    args: ['text', 'delimiter', '[split_by_each]', '[remove_empty_text]'],
    description: 'Divides text around a specified character or string, and puts each fragment into a separate cell in the row.',
    example: '=SPLIT(A1, ",")',
  },
  {
    name: 'JOIN',
    category: 'Text',
    syntax: 'JOIN(delimiter, value_or_array1, [value_or_array2, ...])',
    args: ['delimiter', 'value_or_array1', '[value_or_array2]', '...'],
    description: 'Concatenates the elements of one or more one-dimensional arrays using a specified delimiter.',
    example: '=JOIN("-", A1:A5)',
  },
  {
    name: 'VALUE',
    category: 'Text',
    syntax: 'VALUE(text)',
    args: ['text'],
    description: 'Converts a string in any of the date, time or number formats that Google Sheets understands into a number.',
    example: '=VALUE("$1,234.50")',
  },
  {
    name: 'EXACT',
    category: 'Text',
    syntax: 'EXACT(string1, string2)',
    args: ['string1', 'string2'],
    description: 'Tests whether two strings are identical, case-sensitive.',
    example: '=EXACT(A1, "Active")',
  },
  {
    name: 'CHAR',
    category: 'Text',
    syntax: 'CHAR(table_number)',
    args: ['table_number'],
    description: 'Convert a number into a character according to the current Unicode table.',
    example: '=CHAR(65)',
  },
  {
    name: 'CODE',
    category: 'Text',
    syntax: 'CODE(string)',
    args: ['string'],
    description: 'Returns the numeric Unicode map value of the first character in the string provided.',
    example: '=CODE("A")',
  },
  {
    name: 'CLEAN',
    category: 'Text',
    syntax: 'CLEAN(text)',
    args: ['text'],
    description: 'Returns the text with the non-printable ASCII characters removed.',
    example: '=CLEAN(A1)',
  },

  // --- Date & Time ---
  {
    name: 'TODAY',
    category: 'Date & Time',
    syntax: 'TODAY()',
    args: [],
    description: 'Returns the current date as a date value.',
    example: '=TODAY()',
  },
  {
    name: 'NOW',
    category: 'Date & Time',
    syntax: 'NOW()',
    args: [],
    description: 'Returns the current date and time as a date value.',
    example: '=NOW()',
  },
  {
    name: 'DATE',
    category: 'Date & Time',
    syntax: 'DATE(year, month, day)',
    args: ['year', 'month', 'day'],
    description: 'Converts a provided year, month, and day into a date string.',
    example: '=DATE(2026, 9, 25)',
  },
  {
    name: 'TIME',
    category: 'Date & Time',
    syntax: 'TIME(hour, minute, second)',
    args: ['hour', 'minute', 'second'],
    description: 'Converts a provided hour, minute, and second into a time string.',
    example: '=TIME(14, 30, 0)',
  },
  {
    name: 'YEAR',
    category: 'Date & Time',
    syntax: 'YEAR(date)',
    args: ['date'],
    description: 'Returns the year specified by a given date.',
    example: '=YEAR(TODAY())',
  },
  {
    name: 'MONTH',
    category: 'Date & Time',
    syntax: 'MONTH(date)',
    args: ['date'],
    description: 'Returns the month of the year a specific date falls in, in numeric format (1-12).',
    example: '=MONTH(TODAY())',
  },
  {
    name: 'DAY',
    category: 'Date & Time',
    syntax: 'DAY(date)',
    args: ['date'],
    description: 'Returns the day of the month that a specific date falls on, in numeric format (1-31).',
    example: '=DAY(TODAY())',
  },
  {
    name: 'HOUR',
    category: 'Date & Time',
    syntax: 'HOUR(time_or_date)',
    args: ['time_or_date'],
    description: 'Returns the hour component of a specific time of day, in numeric format (0-23).',
    example: '=HOUR(NOW())',
  },
  {
    name: 'MINUTE',
    category: 'Date & Time',
    syntax: 'MINUTE(time_or_date)',
    args: ['time_or_date'],
    description: 'Returns the minute component of a specific time of day, in numeric format (0-59).',
    example: '=MINUTE(NOW())',
  },
  {
    name: 'SECOND',
    category: 'Date & Time',
    syntax: 'SECOND(time_or_date)',
    args: ['time_or_date'],
    description: 'Returns the second component of a specific time of day, in numeric format (0-59).',
    example: '=SECOND(NOW())',
  },
  {
    name: 'DAYS',
    category: 'Date & Time',
    syntax: 'DAYS(end_date, start_date)',
    args: ['end_date', 'start_date'],
    description: 'Returns the number of days between two dates.',
    example: '=DAYS("2026-12-31", TODAY())',
  },
  {
    name: 'NETWORKDAYS',
    category: 'Date & Time',
    syntax: 'NETWORKDAYS(start_date, end_date, [holidays])',
    args: ['start_date', 'end_date', '[holidays]'],
    description: 'Returns the number of net working days between two provided days, excluding weekends and holidays.',
    example: '=NETWORKDAYS(A1, B1)',
  },
  {
    name: 'DATEDIF',
    category: 'Date & Time',
    syntax: 'DATEDIF(start_date, end_date, unit)',
    args: ['start_date', 'end_date', 'unit'],
    description: 'Calculates the number of days, months, or years between two dates ("Y", "M", "D", "YM", "YD", "MD").',
    example: '=DATEDIF("2020-01-01", TODAY(), "Y")',
  },
  {
    name: 'EDATE',
    category: 'Date & Time',
    syntax: 'EDATE(start_date, months)',
    args: ['start_date', 'months'],
    description: 'Returns a date a specified number of months before or after another date.',
    example: '=EDATE(TODAY(), 6)',
  },
  {
    name: 'EOMONTH',
    category: 'Date & Time',
    syntax: 'EOMONTH(start_date, months)',
    args: ['start_date', 'months'],
    description: 'Returns a date representing the last day of a month which falls a specified number of months before or after another date.',
    example: '=EOMONTH(TODAY(), 1)',
  },
  {
    name: 'WEEKDAY',
    category: 'Date & Time',
    syntax: 'WEEKDAY(date, [type])',
    args: ['date', '[type]'],
    description: 'Returns a number representing the day of the week of the date provided (1 = Sunday ... 7 = Saturday).',
    example: '=WEEKDAY(TODAY())',
  },
  {
    name: 'DATEVALUE',
    category: 'Date & Time',
    syntax: 'DATEVALUE(date_string)',
    args: ['date_string'],
    description: 'Converts a provided date string in a known format to a date serial number.',
    example: '=DATEVALUE("2026-09-25")',
  },
  {
    name: 'TIMEVALUE',
    category: 'Date & Time',
    syntax: 'TIMEVALUE(time_string)',
    args: ['time_string'],
    description: 'Returns the fraction of a 24-hour day the time represents.',
    example: '=TIMEVALUE("12:00:00")',
  },

  // --- Google-Specific Specials ---
  {
    name: 'SPARKLINE',
    category: 'Google',
    syntax: 'SPARKLINE(data, [options])',
    args: ['data', '[options]'],
    description: 'Renders a miniature chart contained within a single cell displaying data trends.',
    example: '=SPARKLINE(A1:A10)',
  },
  {
    name: 'GOOGLEFINANCE',
    category: 'Google',
    syntax: 'GOOGLEFINANCE(ticker, [attribute], [start_date], [end_date], [interval])',
    args: ['ticker', '[attribute]', '[start_date]', '[end_date]', '[interval]'],
    description: 'Fetches current or historical securities information from the stock market (e.g. price, pe, volume, high, low, marketcap).',
    example: '=GOOGLEFINANCE("GOOG", "price")',
  },
];

/**
 * Autocomplete helper: returns formula suggestions matching a prefix with full syntax descriptions
 */
export function getFormulaSuggestions(prefix: string): FormulaSuggestion[] {
  const clean = prefix.replace(/^=/, '').trim().toUpperCase();
  if (!clean) {
    return FORMULA_CATALOG.slice(0, 15);
  }
  const startsWith = FORMULA_CATALOG.filter((f) => f.name.startsWith(clean));
  const includes = FORMULA_CATALOG.filter((f) => !f.name.startsWith(clean) && f.name.includes(clean));
  return [...startsWith, ...includes].slice(0, 15);
}
