<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import FormulaBar from './FormulaBar.svelte';
  import Grid from './Grid.svelte';
  import ChartModal from './ChartModal.svelte';
  import ConditionalFormatModal from './ConditionalFormatModal.svelte';
  import { recalculateGrid, colToLetter, parseCoord, expandRange } from './formulaEngine';
  import {
    computeFilterHiddenRows,
    applyOperator,
    shiftCellsDown,
    addMergeRect,
    removeMergeRectAt,
    mergeRectAt,
    rangeTextToRect,
    rectCellKeys,
    validationViolation,
    type BorderStyle,
  } from '$lib/spreadsheetOps';
  import { EditHistory } from '$lib/history';
  import type { SpreadsheetWorkbook, SheetGrid, CellFormatting, SheetTab, SheetChart, ConditionalFormatRule, CellRect } from '../../types';
  import {
    Plus,
    Bold,
    Italic,
    Underline,
    AlignLeft,
    AlignCenter,
    AlignRight,
    Sigma,
    Download,
    Upload,
    AlertTriangle,
    Trash2,
    Baseline,
    PaintBucket,
    X,
    Undo2,
    Redo2,
    BarChart3,
    Sparkles,
    ArrowDownAZ,
    ArrowUpZA,
    Search,
    Replace,
    
  } from '@lucide/svelte';
  import { downloadFile } from '../../lib/utils';
  import { toCsv } from '../../lib/csv';
  import { exportToXlsx, parseSpreadsheetContent } from '../../lib/fileFormats';
  import { openFileDialogNative, readTextFileNative } from '../../lib/tauri';

  export let workbook: SpreadsheetWorkbook;

  const dispatch = createEventDispatcher<{
    updateStats: { activeCell: string; selectionSum: number | null };
    change: void;
  }>();

  let gridRef: Grid;
  let activeCell: string = 'B5';
  let rawValue: string = '';

  let showChartModal = false;
  let showConditionalModal = false;
  let showFindBar = false;
  let findQuery = '';
  let replaceQuery = '';

  let cellFontFamily = 'Inter, sans-serif';
  let cellFontSize = 11;
  let cellTextColor = '#1e293b';
  let cellBgColor = '#ffffff';
  let cellNumberFormat: 'general' | 'number' | 'currency' | 'percent' | 'date' = 'general';

  // Undo / Redo history, bounded by bytes
  // Bounded by bytes rather than entry count: a 50-entry cap on a large grid
  // still held tens of megabytes of JSON and could exhaust memory.
  const history = new EditHistory<SheetGrid>({ label: 'Edit', maxBytes: 24 * 1024 * 1024 });

  const fontFamilies = [
    { label: 'Sans (Default)', value: 'Inter, sans-serif' },
    { label: 'Arial', value: 'Arial, sans-serif' },
    { label: 'Times New Roman', value: '"Times New Roman", serif' },
    { label: 'Courier New', value: '"Courier New", monospace' },
    { label: 'Consolas', value: 'Consolas, monospace' },
    { label: 'Georgia', value: 'Georgia, serif' },
  ];

  const fontSizes = [9, 10, 11, 12, 14, 16, 18, 20];

  $: activeSheet = workbook.sheets.find((s) => s.id === workbook.activeSheetId) || workbook.sheets[0];

  function pushUndo() {
    history.push(activeSheet.cells);
  }

  export function triggerUndo() {
    const prev = history.undo(activeSheet.cells);
    if (!prev) return;
    activeSheet.cells = recalculateGrid(prev);
    workbook.meta.isDirty = true;
    rawValue = activeSheet.cells[activeCell]?.raw ?? '';
    computeStats();
    dispatch('change');
  }

  export function triggerRedo() {
    const next = history.redo(activeSheet.cells);
    if (!next) return;
    activeSheet.cells = recalculateGrid(next);
    workbook.meta.isDirty = true;
    rawValue = activeSheet.cells[activeCell]?.raw ?? '';
    computeStats();
    dispatch('change');
  }

  function handleSelectCell(e: CustomEvent<{ key: string; raw: string; computed: string | number }>) {
    activeCell = e.detail.key;
    rawValue = e.detail.raw;
    const currentFmt = activeSheet.cells[activeCell]?.format;
    if (currentFmt) {
      if (currentFmt.fontFamily) cellFontFamily = currentFmt.fontFamily;
      if (currentFmt.fontSize) cellFontSize = currentFmt.fontSize;
      if (currentFmt.textColor) cellTextColor = currentFmt.textColor;
      if (currentFmt.bgColor) cellBgColor = currentFmt.bgColor;
      if (currentFmt.format) cellNumberFormat = currentFmt.format;
    }
    computeStats();
  }

  function handleCellChange(e: CustomEvent<{ key: string; raw: string }>) {
    commitValue(e.detail.key, e.detail.raw);
  }

  export function commitValue(cellKey: string, val: string) {
    pushUndo();

    if (!activeSheet.cells[cellKey]) {
      activeSheet.cells[cellKey] = { raw: val, computed: val };
    } else {
      activeSheet.cells[cellKey].raw = val;
    }

    activeSheet.cells = recalculateGrid(activeSheet.cells);

    // Data validation never blocks typing, but a rejected value is flagged in place.
    if (isValidated(cellKey)) {
      const violation = validationViolation(
        activeSheet.validation?.items ?? [],
        String(activeSheet.cells[cellKey]?.computed ?? ''),
        activeSheet.validation?.allowBlank !== false,
      );
      validationNotice = violation ?? '';
      activeSheet.cells[cellKey].format = {
        ...activeSheet.cells[cellKey].format,
        invalid: Boolean(violation),
      };
    } else {
      validationNotice = '';
      if (activeSheet.cells[cellKey].format?.invalid) {
        activeSheet.cells[cellKey].format = { ...activeSheet.cells[cellKey].format, invalid: false };
      }
    }

    workbook.meta.isDirty = true;
    rawValue = activeSheet.cells[cellKey]?.raw ?? '';
    computeStats();
    dispatch('change');
  }

  function handleFormulaCommit(e: CustomEvent<string>) {
    commitValue(activeCell, e.detail);
    gridRef?.focusGrid();
  }

  function computeStats() {
    const val = activeSheet.cells[activeCell]?.computed;
    let sum: number | null = null;
    if (typeof val === 'number') {
      sum = val;
    } else if (typeof val === 'string' && !isNaN(Number(val.replace(/[$,]/g, '')))) {
      sum = Number(val.replace(/[$,]/g, ''));
    }
    dispatch('updateStats', { activeCell, selectionSum: sum });
  }

  function updateActiveCellFormat(patch: Partial<CellFormatting>) {
    pushUndo();

    if (!activeSheet.cells[activeCell]) {
      activeSheet.cells[activeCell] = { raw: '', computed: '', format: { ...patch } };
    } else {
      activeSheet.cells[activeCell].format = {
        ...activeSheet.cells[activeCell].format,
        ...patch,
      };
    }
    activeSheet.cells = { ...activeSheet.cells };
    workbook.meta.isDirty = true;
    dispatch('change');
  }

  export function toggleBold() {
    const curr = activeSheet.cells[activeCell]?.format?.bold;
    updateActiveCellFormat({ bold: !curr });
  }

  export function toggleItalic() {
    const curr = activeSheet.cells[activeCell]?.format?.italic;
    updateActiveCellFormat({ italic: !curr });
  }

  export function toggleUnderline() {
    const curr = activeSheet.cells[activeCell]?.format?.underline;
    updateActiveCellFormat({ underline: !curr });
  }

  function setAlign(align: 'left' | 'center' | 'right') {
    updateActiveCellFormat({ align });
  }

  function handleFontChange(e: Event) {
    const val = (e.target as HTMLSelectElement).value;
    cellFontFamily = val;
    updateActiveCellFormat({ fontFamily: val });
  }

  function handleFontSizeChange(e: Event) {
    const val = parseInt((e.target as HTMLSelectElement).value, 10);
    cellFontSize = val;
    updateActiveCellFormat({ fontSize: val });
  }

  function handleNumberFormatChange(e: Event) {
    const val = (e.target as HTMLSelectElement).value as any;
    cellNumberFormat = val;
    updateActiveCellFormat({ format: val });
  }

  function handleTextColor(e: Event) {
    const val = (e.target as HTMLInputElement).value;
    cellTextColor = val;
    updateActiveCellFormat({ textColor: val });
  }

  function handleBgColor(e: Event) {
    const val = (e.target as HTMLInputElement).value;
    cellBgColor = val;
    updateActiveCellFormat({ bgColor: val });
  }

  // --- Grid, filter, freeze, merge, and validation features ---
  let hiddenRows: number[] = [];
  let filterColumn = -1;
  let filterQuery = '';
  let showCalculator = false;
  let calcDisplay = '0';
  let calcAccumulator: number | null = null;
  let calcOperator = '';
  let calcWaiting = false;
  let selectionRange: { start: string; end: string; keys: string[] } | null = null;
  let validationNotice = '';
  let showValidationDialog = false;
  let validationList = '';
  let validationTarget = '';

  export function toggleFilter() {
    if (filterColumn >= 0) {
      filterColumn = -1;
      hiddenRows = [];
      activeSheet.cells = { ...activeSheet.cells };
      return;
    }
    const parsed = parseCoord(activeCell);
    const col = parsed ? parsed.col : 0;
    const query = prompt(`Filter column ${colToLetter(col)} by text (leave empty to show all):`);
    if (query === null) return;
    filterColumn = col;
    filterQuery = query.trim().toLowerCase();
    applyFilter();
  }

  function applyFilter() {
    if (filterColumn < 0) return;
    if (filterQuery === '') {
      hiddenRows = [];
      return;
    }
    hiddenRows = computeFilterHiddenRows(activeSheet.cells, filterColumn, filterQuery, activeSheet.rowCount);
  }

  export function recalculate() {
    pushUndo();
    activeSheet.cells = recalculateGrid(activeSheet.cells);
    workbook.meta.isDirty = true;
    computeStats();
    dispatch('change');
  }

  export function toggleFreezeHeader() {
    pushUndo();
    activeSheet.frozenRows = activeSheet.frozenRows ? 0 : 1;
    activeSheet.cells = { ...activeSheet.cells };
    workbook.meta.isDirty = true;
    dispatch('change');
  }

  function handleRangeSelect(e: CustomEvent<{ start: string; end: string; keys: string[] }>) {
    selectionRange = e.detail;
  }

  /** The rect the current selection covers, falling back to the single active cell. */
  function selectionRect(): CellRect | null {
    if (selectionRange && selectionRange.keys.length > 0) {
      return rangeTextToRect(
        selectionRange.start === selectionRange.end
          ? selectionRange.start
          : `${selectionRange.start}:${selectionRange.end}`,
      );
    }
    return rangeTextToRect(activeCell);
  }

  export function mergeCells() {
    const rect = selectionRect();
    if (!rect) return;
    const existing = activeSheet.mergedRanges ?? [];
    const covering = mergeRectAt(existing, rect.startCol, rect.startRow);

    pushUndo();
    if (covering) {
      // Already merged: unmerge and keep every covered value.
      for (const key of rectCellKeys(covering)) delete activeSheet.cells[key];
      const anchor = `${colToLetter(covering.startCol)}${covering.startRow + 1}`;
      activeSheet.cells[anchor] = activeSheet.cells[anchor] ?? { raw: '', computed: '' };
      activeSheet.mergedRanges = removeMergeRectAt(existing, covering.startCol, covering.startRow);
    } else {
      const result = addMergeRect(existing, rect);
      if (result.error) {
        validationNotice = result.error;
        return;
      }
      activeSheet.mergedRanges = result.rects;
      // A merge keeps only the anchor value, the way Excel behaves.
      const anchor = `${colToLetter(rect.startCol)}${rect.startRow + 1}`;
      for (const key of rectCellKeys(rect)) {
        if (key !== anchor) delete activeSheet.cells[key];
      }
      activeSheet.cells[anchor] = activeSheet.cells[anchor] ?? { raw: '', computed: '' };
    }

    validationNotice = '';
    activeSheet.cells = { ...activeSheet.cells };
    workbook.meta.isDirty = true;
    computeStats();
    dispatch('change');
  }

  export function unmergeCells() {
    const rect = selectionRect();
    if (!rect) return;
    const covering = mergeRectAt(activeSheet.mergedRanges ?? [], rect.startCol, rect.startRow);
    if (!covering) return;
    mergeCells();
  }

  function applyFormatToCell(key: string, patch: Partial<CellFormatting>) {
    if (!activeSheet.cells[key]) {
      activeSheet.cells[key] = { raw: '', computed: '', format: { ...patch } };
    } else {
      activeSheet.cells[key].format = { ...activeSheet.cells[key].format, ...patch };
    }
  }

  export function applyNumberFormat(value: string) {
    const allowed = ['general', 'number', 'currency', 'percent', 'date'];
    const fmt = (allowed.includes(value) ? value : 'general') as NonNullable<CellFormatting['format']>;
    cellNumberFormat = fmt;
    updateActiveCellFormat({ format: fmt });
  }

  export function toggleWrapText() {
    const curr = activeSheet.cells[activeCell]?.format?.wrap;
    updateActiveCellFormat({ wrap: !curr });
  }

  export function setCellAlign(align: string) {
    const value = align === 'left' || align === 'center' || align === 'right' ? align : 'left';
    updateActiveCellFormat({ align: value });
  }

  export function applyTextColor(color: string) {
    cellTextColor = color;
    updateActiveCellFormat({ textColor: color });
  }

  export function applyFillColor(color: string) {
    cellBgColor = color;
    updateActiveCellFormat({ bgColor: color });
  }

  export function applyBorder(style: string) {
    const borders: BorderStyle[] = ['none', 'all', 'outer', 'top', 'bottom', 'left', 'right'];
    const value = borders.includes(style as BorderStyle) ? (style as BorderStyle) : 'all';
    applyFormatToRange({ border: value });
  }

  /** Applies a format to every cell in the live selection, like Excel's format painter. */
  function applyFormatToRange(patch: Partial<CellFormatting>) {
    const keys = selectionRange && selectionRange.keys.length > 0 ? selectionRange.keys : [activeCell];
    for (const key of keys) applyFormatToCell(key, patch);
  }

  export function openDataValidation() {
    const rule = activeSheet.validation;
    validationTarget = selectionRange && selectionRange.keys.length > 1
      ? `${selectionRange.start}:${selectionRange.end}`
      : activeCell;
    validationList = rule && rule.target === validationTarget ? rule.items.join(', ') : '';
    showValidationDialog = true;
  }

  function isValidated(cellKey: string): boolean {
    const rule = activeSheet.validation;
    if (!rule) return false;
    return expandRange(rule.target).includes(cellKey);
  }

  function saveDataValidation() {
    const items = validationList
      .split(',')
      .map((v) => v.trim())
      .filter((v) => v.length > 0);
    if (items.length === 0) {
      activeSheet.validation = undefined;
      for (const key of expandRange(validationTarget)) {
        if (activeSheet.cells[key]?.format) {
          activeSheet.cells[key].format = { ...activeSheet.cells[key].format, invalid: false };
        }
      }
    } else {
      activeSheet.validation = { target: validationTarget, items };
      for (const key of expandRange(validationTarget)) {
        const violation = validationViolation(items, String(activeSheet.cells[key]?.computed ?? ''));
        if (activeSheet.cells[key]) {
          activeSheet.cells[key].format = { ...activeSheet.cells[key].format, invalid: Boolean(violation) };
        }
      }
    }
    activeSheet.cells = { ...activeSheet.cells };
    showValidationDialog = false;
    workbook.meta.isDirty = true;
    dispatch('change');
  }

  // --- Calculator ---
  export function openCalculator() {
    showCalculator = true;
    calcDisplay = '0';
    calcAccumulator = null;
    calcOperator = '';
    calcWaiting = false;
  }

  function calcInputDigit(digit: string) {
    if (calcWaiting || calcDisplay === '0') {
      calcDisplay = digit;
      calcWaiting = false;
    } else if (calcDisplay.length < 12) {
      calcDisplay += digit;
    }
  }

  function calcApply(operator: string) {
    const current = Number(calcDisplay) || 0;
    if (calcOperator && calcAccumulator !== null) {
      calcDisplay = String(calcCompute(calcAccumulator, current, calcOperator));
    }
    calcAccumulator = Number(calcDisplay) || 0;
    calcOperator = operator;
    calcWaiting = true;
  }

  function calcCompute(a: number, b: number, operator: string): number {
    return applyOperator(a, b, operator);
  }

  function calcEquals() {
    if (calcOperator && calcAccumulator !== null) {
      calcDisplay = String(calcCompute(calcAccumulator, Number(calcDisplay) || 0, calcOperator));
    }
    calcAccumulator = null;
    calcOperator = '';
    calcWaiting = true;
  }

  function calcClear() {
    calcDisplay = '0';
    calcAccumulator = null;
    calcOperator = '';
    calcWaiting = false;
  }

  function calcInsertIntoCell() {
    if (calcDisplay !== '' && calcDisplay !== 'NaN') {
      commitValue(activeCell, calcDisplay);
    }
    showCalculator = false;
  }

  // Google Sheets Powerhouse Features: Charts, Sorting, Row/Col Operations, Conditional Formatting
  export function openChartDialog() {
    showChartModal = true;
  }

  export function openConditionalFormatting() {
    showConditionalModal = true;
  }

  export function toggleFindBar() {
    showFindBar = !showFindBar;
  }

  function handleInsertChart(e: CustomEvent<SheetChart>) {
    pushUndo();
    if (!activeSheet.charts) activeSheet.charts = [];
    activeSheet.charts = [...activeSheet.charts, e.detail];
    workbook.meta.isDirty = true;
    dispatch('change');
  }

  function handleSaveRules(e: CustomEvent<ConditionalFormatRule[]>) {
    pushUndo();
    activeSheet.conditionalRules = e.detail;
    workbook.meta.isDirty = true;
    dispatch('change');
  }

  // Sort Active Column Ascending / Descending
  export function sortActiveColumn(ascending: boolean = true) {
    pushUndo();
    const coord = parseCoord(activeCell);
    if (!coord) return;
    const targetCol = coord.col;

    const rowsData: { rowIdx: number; keyCell: any; cells: Record<number, any> }[] = [];
    for (let r = 0; r < activeSheet.rowCount; r++) {
      const colCells: Record<number, any> = {};
      for (let c = 0; c < activeSheet.colCount; c++) {
        const k = `${colToLetter(c)}${r + 1}`;
        if (activeSheet.cells[k]) {
          colCells[c] = { ...activeSheet.cells[k] };
        }
      }
      const targetKey = `${colToLetter(targetCol)}${r + 1}`;
      rowsData.push({
        rowIdx: r,
        keyCell: activeSheet.cells[targetKey]?.computed ?? '',
        cells: colCells,
      });
    }

    const isFirstRowHeader = isNaN(Number(rowsData[0]?.keyCell)) && rowsData.slice(1).some((r) => !isNaN(Number(r.keyCell)) && r.keyCell !== '');
    const headerRow = isFirstRowHeader ? rowsData[0] : null;
    const sortableRows = isFirstRowHeader ? rowsData.slice(1) : rowsData;

    sortableRows.sort((a, b) => {
      const valA = a.keyCell;
      const valB = b.keyCell;
      const numA = typeof valA === 'number' ? valA : parseFloat(String(valA).replace(/[$,%]/g, ''));
      const numB = typeof valB === 'number' ? valB : parseFloat(String(valB).replace(/[$,%]/g, ''));

      if (!isNaN(numA) && !isNaN(numB)) {
        return ascending ? numA - numB : numB - numA;
      }
      const strA = String(valA).toLowerCase();
      const strB = String(valB).toLowerCase();
      return ascending ? strA.localeCompare(strB) : strB.localeCompare(strA);
    });

    const finalRows = headerRow ? [headerRow, ...sortableRows] : sortableRows;

    const newCells: SheetGrid = {};
    finalRows.forEach((rowObj, newR) => {
      for (const [cStr, cellVal] of Object.entries(rowObj.cells)) {
        const c = parseInt(cStr, 10);
        const newKey = `${colToLetter(c)}${newR + 1}`;
        newCells[newKey] = cellVal;
      }
    });

    activeSheet.cells = recalculateGrid(newCells);
    workbook.meta.isDirty = true;
    computeStats();
    dispatch('change');
  }

  // Row Manipulation
  export function insertRow(above: boolean = true) {
    pushUndo();
    const coord = parseCoord(activeCell);
    if (!coord) return;
    const targetRow = above ? coord.row : coord.row + 1;

    const newCells = shiftCellsDown(activeSheet.cells, targetRow, activeSheet.rowCount + 1, activeSheet.colCount);
    activeSheet.rowCount = Math.max(activeSheet.rowCount + 1, 50);
    activeSheet.cells = recalculateGrid(newCells);
    workbook.meta.isDirty = true;
    computeStats();
    dispatch('change');
  }

  export function deleteCurrentRow() {
    pushUndo();
    const coord = parseCoord(activeCell);
    if (!coord) return;
    const targetRow = coord.row;

    const newCells: SheetGrid = {};
    for (const [k, v] of Object.entries(activeSheet.cells)) {
      const c = parseCoord(k);
      if (!c) continue;
      if (c.row === targetRow) {
        continue;
      } else if (c.row > targetRow) {
        newCells[`${colToLetter(c.col)}${c.row}`] = v;
      } else {
        newCells[k] = v;
      }
    }
    activeSheet.rowCount = Math.max(1, activeSheet.rowCount - 1);
    activeSheet.cells = recalculateGrid(newCells);
    workbook.meta.isDirty = true;
    computeStats();
    dispatch('change');
  }

  // Column Manipulation
  export function insertColumn(left: boolean = true) {
    pushUndo();
    const coord = parseCoord(activeCell);
    if (!coord) return;
    const targetCol = left ? coord.col : coord.col + 1;

    const newCells: SheetGrid = {};
    for (const [k, v] of Object.entries(activeSheet.cells)) {
      const c = parseCoord(k);
      if (!c) continue;
      if (c.col >= targetCol) {
        newCells[`${colToLetter(c.col + 1)}${c.row + 1}`] = v;
      } else {
        newCells[k] = v;
      }
    }
    activeSheet.colCount = Math.max(activeSheet.colCount + 1, 26);
    activeSheet.cells = recalculateGrid(newCells);
    workbook.meta.isDirty = true;
    computeStats();
    dispatch('change');
  }

  export function deleteCurrentColumn() {
    pushUndo();
    const coord = parseCoord(activeCell);
    if (!coord) return;
    const targetCol = coord.col;

    const newCells: SheetGrid = {};
    for (const [k, v] of Object.entries(activeSheet.cells)) {
      const c = parseCoord(k);
      if (!c) continue;
      if (c.col === targetCol) {
        continue;
      } else if (c.col > targetCol) {
        newCells[`${colToLetter(c.col - 1)}${c.row + 1}`] = v;
      } else {
        newCells[k] = v;
      }
    }
    activeSheet.colCount = Math.max(1, activeSheet.colCount - 1);
    activeSheet.cells = recalculateGrid(newCells);
    workbook.meta.isDirty = true;
    computeStats();
    dispatch('change');
  }

  // Find & Replace
  function handleSheetFind(all: boolean = false) {
    if (!findQuery) return;
    pushUndo();
    let replaced = 0;
    const newCells = { ...activeSheet.cells };
    for (const [k, v] of Object.entries(newCells)) {
      if (v.raw.includes(findQuery)) {
        newCells[k] = {
          ...v,
          raw: all ? v.raw.replaceAll(findQuery, replaceQuery) : v.raw.replace(findQuery, replaceQuery),
        };
        replaced++;
        if (!all) break;
      }
    }
    if (replaced > 0) {
      activeSheet.cells = recalculateGrid(newCells);
      workbook.meta.isDirty = true;
      rawValue = activeSheet.cells[activeCell]?.raw ?? '';
      computeStats();
      dispatch('change');
    }
  }

  export function insertFormula(fnName: string) {
    const match = activeCell.replace(/\$/g, '').toUpperCase().match(/^([A-Z]+)([0-9]+)$/);
    if (!match) return;
    const col = match[1];
    const row = parseInt(match[2], 10);
    let formula = '';
    if (fnName === 'COUNTIF') {
      formula = row > 1 ? `=COUNTIF(${col}1:${col}${row - 1}, "criteria")` : `=COUNTIF(A1:A10, "criteria")`;
    } else if (fnName === 'IF') {
      formula = `=IF(${col}${Math.max(1, row - 1)} > 0, "Yes", "No")`;
    } else {
      formula = row > 1 ? `=${fnName}(${col}1:${col}${row - 1})` : `=${fnName}()`;
    }
    commitValue(activeCell, formula);
    gridRef?.focusGrid();
  }

  // Clipboard operations (Copy, Cut, Paste)
  async function copyActiveCell() {
    const val = activeSheet.cells[activeCell]?.raw ?? '';
    try {
      await navigator.clipboard.writeText(val);
    } catch {
      // Fallback
    }
  }

  async function cutActiveCell() {
    await copyActiveCell();
    commitValue(activeCell, '');
  }

  async function pasteIntoActiveCell() {
    try {
      const text = await navigator.clipboard.readText();
      if (text !== undefined) {
        commitValue(activeCell, text);
      }
    } catch {
      // Fallback
    }
  }

  // Global Keyboard Navigation & Shortcuts for Sheets
  function handleWindowKeydown(e: KeyboardEvent) {
    const mod = e.ctrlKey || e.metaKey;
    const target = e.target as HTMLElement;
    const targetTag = target?.tagName?.toLowerCase();

    // If user is inside an input, textarea or select outside a grid cell (e.g. Formula Bar, modals, inputs), do not intercept
    if ((targetTag === 'input' || targetTag === 'textarea' || targetTag === 'select') && !target?.closest('td')) {
      return;
    }

    // If modal/dialog is open
    if (target?.closest('.fixed') && !target?.closest('td')) {
      return;
    }

    // 1. Navigation & In-place Editing Keys (when not actively editing inside a cell)
    if (!gridRef?.isEditing()) {
      if (!mod && !e.altKey) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          gridRef?.navigate(0, 1);
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          gridRef?.navigate(0, -1);
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          gridRef?.navigate(1, 0);
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          gridRef?.navigate(-1, 0);
        } else if (e.key === 'Enter') {
          e.preventDefault();
          gridRef?.startEditing();
        } else if (e.key === 'Tab') {
          e.preventDefault();
          gridRef?.navigate(e.shiftKey ? -1 : 1, 0);
        } else if (e.key === 'F2') {
          e.preventDefault();
          gridRef?.startEditing();
        } else if (e.key === 'Delete' || e.key === 'Backspace') {
          e.preventDefault();
          commitValue(activeCell, '');
        } else if (e.key.length === 1 && !mod && !e.altKey && targetTag !== 'input') {
          // Printable characters (e.g. =, numbers, letters) start editing directly
          e.preventDefault();
          gridRef?.startEditing(e.key);
        }
      }
    }

    // 2. Mod-Key Shortcuts
    if (mod && !e.shiftKey && !e.altKey) {
      if (e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleBold();
      } else if (e.key.toLowerCase() === 'i') {
        e.preventDefault();
        toggleItalic();
      } else if (e.key.toLowerCase() === 'u') {
        e.preventDefault();
        toggleUnderline();
      } else if (e.key.toLowerCase() === 'c' && !gridRef?.isEditing()) {
        e.preventDefault();
        copyActiveCell();
      } else if (e.key.toLowerCase() === 'x' && !gridRef?.isEditing()) {
        e.preventDefault();
        cutActiveCell();
      } else if (e.key.toLowerCase() === 'v' && !gridRef?.isEditing()) {
        e.preventDefault();
        pasteIntoActiveCell();
      } else if (e.key.toLowerCase() === 'z' && !gridRef?.isEditing()) {
        e.preventDefault();
        triggerUndo();
      } else if (e.key.toLowerCase() === 'y' && !gridRef?.isEditing()) {
        e.preventDefault();
        triggerRedo();
      }
    } else if (mod && e.shiftKey && e.key.toLowerCase() === 'z' && !gridRef?.isEditing()) {
      e.preventDefault();
      triggerRedo();
    }
  }

  // Multi-Sheet Tabs Operations
  function addNewSheet() {
    const newIdx = workbook.sheets.length + 1;
    const newSheet: SheetTab = {
      id: `sheet_${Date.now()}`,
      name: `Sheet ${newIdx}`,
      rowCount: 50,
      colCount: 26,
      cells: {},
    };
    workbook.sheets = [...workbook.sheets, newSheet];
    workbook.activeSheetId = newSheet.id;
    workbook.meta.isDirty = true;
    dispatch('change');
  }

  function selectSheet(id: string) {
    workbook.activeSheetId = id;
    activeCell = 'A1';
    rawValue = activeSheet.cells['A1']?.raw || '';
    computeStats();
  }

  function renameSheet(sheet: SheetTab) {
    const newName = prompt('Enter new sheet name:', sheet.name);
    if (newName && newName.trim()) {
      sheet.name = newName.trim();
      workbook.sheets = [...workbook.sheets];
      workbook.meta.isDirty = true;
      dispatch('change');
    }
  }

  function deleteSheet(sheet: SheetTab) {
    if (workbook.sheets.length <= 1) {
      alert('A workbook must have at least one sheet.');
      return;
    }
    if (confirm(`Delete sheet "${sheet.name}"?`)) {
      workbook.sheets = workbook.sheets.filter((s) => s.id !== sheet.id);
      workbook.activeSheetId = workbook.sheets[0].id;
      workbook.meta.isDirty = true;
      dispatch('change');
    }
  }

  export function exportToCsv(): string {
    const rows: string[][] = [];
    for (let r = 0; r < activeSheet.rowCount; r++) {
      const rowData: string[] = [];
      let hasData = false;
      for (let c = 0; c < activeSheet.colCount; c++) {
        const key = `${colToLetter(c)}${r + 1}`;
        const val = activeSheet.cells[key]?.computed ?? '';
        if (val !== '') hasData = true;
        rowData.push(String(val));
      }
      if (hasData) rows.push(rowData);
    }
    const csvContent = toCsv(rows);
    downloadFile(`${workbook.meta.title || 'spreadsheet'}.csv`, csvContent, 'text/csv');
    return csvContent;
  }

  export function exportToExcel() {
    const xml = exportToXlsx(workbook);
    downloadFile(`${workbook.meta.title || 'spreadsheet'}.xlsx`, xml, 'application/vnd.ms-excel');
  }

  export async function handleImportSpreadsheet() {
    try {
      const selectedPath = await openFileDialogNative('Import Spreadsheet', [
        {
          name: 'Spreadsheet Files (*.xlsx, *.xls, *.csv, *.tsv)',
          extensions: ['xlsx', 'xls', 'csv', 'tsv'],
        },
        { name: 'Microsoft Excel (*.xlsx, *.xls)', extensions: ['xlsx', 'xls'] },
        { name: 'CSV / TSV Text (*.csv, *.tsv)', extensions: ['csv', 'tsv'] },
        { name: 'All Files (*)', extensions: ['*'] },
      ]);

      if (selectedPath) {
        const content = await readTextFileNative(selectedPath);
        loadSpreadsheetContent(content, selectedPath);
        return;
      }
    } catch (err) {
      console.warn('Native dialog failed, falling back to web file picker:', err);
    }

    // Web fallback file picker
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx,.xls,.csv,text/csv,.tsv';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = () => {
          importFromCsv(reader.result as string);
        };
        reader.readAsText(file);
      }
    };
    input.click();
  }

  function loadSpreadsheetContent(content: string, filename: string) {
    let parsedGrid: Record<string, any> = {};

    if (content.startsWith('{') && content.includes('"cells":')) {
      try {
        const parsed = JSON.parse(content);
        parsedGrid = recalculateGrid(parsed.cells || {});
      } catch {
        parsedGrid = parseSpreadsheetContent(content, filename);
      }
    } else {
      parsedGrid = parseSpreadsheetContent(content, filename);
    }

    pushUndo();
    activeSheet.cells = parsedGrid;
    const cellKeys = Object.keys(parsedGrid);
    let maxRow = 50;
    let maxCol = 26;
    for (const k of cellKeys) {
      const m = k.match(/^([A-Z]+)([0-9]+)$/);
      if (m) {
        const r = parseInt(m[2], 10);
        if (r > maxRow) maxRow = r + 10;
      }
    }
    activeSheet.rowCount = maxRow;
    activeSheet.colCount = Math.max(maxCol, 35);
    workbook.meta.filePath = filename;
    const baseTitle = filename.split('/').pop()?.replace(/\.[^/.]+$/, '');
    if (baseTitle) {
      workbook.meta.title = baseTitle;
    }
    workbook.meta.isDirty = true;
    computeStats();
    dispatch('change');
  }

  export function importFromCsv(csvText: string) {
    if (csvText.startsWith('PK') || csvText.includes('[Content_Types].xml')) {
      alert('This is a binary Excel (.xlsx) file. Please click the Import button or use File → Open (Cmd+O) to open it.');
      return;
    }

    const newCells = parseSpreadsheetContent(csvText, 'import.csv');
    pushUndo();
    activeSheet.cells = newCells;
    const cellKeys = Object.keys(newCells);
    let maxRow = 50;
    for (const k of cellKeys) {
      const m = k.match(/^([A-Z]+)([0-9]+)$/);
      if (m) {
        const r = parseInt(m[2], 10);
        if (r > maxRow) maxRow = r + 10;
      }
    }
    activeSheet.rowCount = maxRow;
    workbook.meta.isDirty = true;
    computeStats();
    dispatch('change');
  }

  function clearSheet() {
    if (confirm('Clear all cells in the current sheet?')) {
      pushUndo();
      activeSheet.cells = {};
      workbook.meta.isDirty = true;
      dispatch('change');
    }
  }
</script>

<svelte:window on:keydown={handleWindowKeydown} />

<div class="flex-1 flex flex-col h-full overflow-hidden bg-slate-100">
  <!-- Powerhouse Sheets Formatting Toolbar -->
  <div class="no-print bg-white border-b border-slate-200 px-3 py-1 flex items-center justify-between select-none text-xs text-slate-700 shadow-sm overflow-x-auto">
    <div class="flex items-center space-x-1.5">
      <!-- Undo / Redo buttons -->
      <div class="flex items-center space-x-0.5 pr-1 border-r border-slate-200">
        <button
          class="p-1.5 rounded hover:bg-slate-100 text-slate-700 transition-colors disabled:opacity-30"
          on:click={triggerUndo}
          disabled={history.undoCount === 0}
          title="Undo (Ctrl+Z)"
        >
          <Undo2 size={14} />
        </button>
        <button
          class="p-1.5 rounded hover:bg-slate-100 text-slate-700 transition-colors disabled:opacity-30"
          on:click={triggerRedo}
          disabled={history.redoCount === 0}
          title="Redo (Ctrl+Y)"
        >
          <Redo2 size={14} />
        </button>
      </div>

      <!-- Font Family Selector (User Requested) -->
      <div class="pr-1 border-r border-slate-200">
        <select
          bind:value={cellFontFamily}
          on:change={handleFontChange}
          class="h-7 bg-slate-50 border border-slate-200 rounded px-2 text-xs text-slate-700 outline-none hover:bg-slate-100 cursor-pointer font-medium"
          title="Cell Font Family"
        >
          {#each fontFamilies as f}
            <option value={f.value}>{f.label}</option>
          {/each}
        </select>
      </div>

      <!-- Font Size Selector (User Requested) -->
      <div class="pr-1 border-r border-slate-200">
        <select
          bind:value={cellFontSize}
          on:change={handleFontSizeChange}
          class="h-7 bg-slate-50 border border-slate-200 rounded px-1.5 text-xs text-slate-700 outline-none hover:bg-slate-100 cursor-pointer font-medium"
          title="Cell Font Size"
        >
          {#each fontSizes as s}
            <option value={s}>{s}pt</option>
          {/each}
        </select>
      </div>

      <!-- Cell Text Formatting -->
      <div class="flex items-center space-x-0.5 pr-1 border-r border-slate-200">
        <button
          class="p-1.5 rounded hover:bg-slate-100 font-bold"
          on:click={toggleBold}
          title="Bold Cell (Ctrl+B)"
        >
          <Bold size={14} />
        </button>
        <button
          class="p-1.5 rounded hover:bg-slate-100"
          on:click={toggleItalic}
          title="Italic Cell (Ctrl+I)"
        >
          <Italic size={14} />
        </button>
        <button
          class="p-1.5 rounded hover:bg-slate-100"
          on:click={toggleUnderline}
          title="Underline Cell (Ctrl+U)"
        >
          <Underline size={14} />
        </button>
      </div>

      <!-- Cell Colors -->
      <div class="flex items-center space-x-1 pr-1 border-r border-slate-200">
        <label class="p-1 rounded hover:bg-slate-100 cursor-pointer relative" title="Cell Text Color">
          <Baseline size={14} style="color: {cellTextColor};" />
          <input type="color" bind:value={cellTextColor} on:input={handleTextColor} class="opacity-0 absolute inset-0 w-full h-full cursor-pointer" />
        </label>
        <label class="p-1 rounded hover:bg-slate-100 cursor-pointer relative" title="Cell Fill Color">
          <PaintBucket size={14} style="color: {cellBgColor === '#ffffff' ? '#10b981' : cellBgColor};" />
          <input type="color" bind:value={cellBgColor} on:input={handleBgColor} class="opacity-0 absolute inset-0 w-full h-full cursor-pointer" />
        </label>
      </div>

      <!-- Alignment -->
      <div class="flex items-center space-x-0.5 pr-1 border-r border-slate-200">
        <button class="p-1.5 rounded hover:bg-slate-100" on:click={() => setAlign('left')} title="Align Left">
          <AlignLeft size={14} />
        </button>
        <button class="p-1.5 rounded hover:bg-slate-100" on:click={() => setAlign('center')} title="Align Center">
          <AlignCenter size={14} />
        </button>
        <button class="p-1.5 rounded hover:bg-slate-100" on:click={() => setAlign('right')} title="Align Right">
          <AlignRight size={14} />
        </button>
      </div>

      <!-- Number Format Selector -->
      <div class="pr-1 border-r border-slate-200">
        <select
          bind:value={cellNumberFormat}
          on:change={handleNumberFormatChange}
          class="h-7 bg-slate-50 border border-slate-200 rounded px-2 text-xs text-slate-700 outline-none hover:bg-slate-100 cursor-pointer font-medium"
          title="Number Formatting"
        >
          <option value="general">Automatic / General</option>
          <option value="number">Number (1,234.50)</option>
          <option value="currency">Currency ($1,234.50)</option>
          <option value="percent">Percent (12.5%)</option>
          <option value="date">Date (YYYY-MM-DD)</option>
        </select>
      </div>

      <!-- Quick Formulas -->
      <div class="flex items-center space-x-1 pr-1 border-r border-slate-200">
        <button
          class="flex items-center space-x-1 px-2 py-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-medium transition-colors"
          on:click={() => insertFormula('SUM')}
          title="AutoSum"
        >
          <Sigma size={13} />
          <span>SUM</span>
        </button>
        <button
          class="flex items-center space-x-1 px-2 py-1 rounded hover:bg-slate-100 text-slate-700 font-medium transition-colors"
          on:click={() => insertFormula('AVERAGE')}
          title="Average"
        >
          <span>AVG</span>
        </button>
        <button
          class="flex items-center space-x-1 px-2 py-1 rounded hover:bg-slate-100 text-slate-700 font-medium transition-colors"
          on:click={() => insertFormula('COUNT')}
          title="Count numbers"
        >
          <span>COUNT</span>
        </button>
        <button
          class="flex items-center space-x-1 px-2 py-1 rounded hover:bg-slate-100 text-emerald-700 font-medium transition-colors"
          on:click={() => insertFormula('COUNTIF')}
          title="Count If (e.g. =COUNTIF(A1:A10, 'S'))"
        >
          <span>COUNTIF</span>
        </button>
        <button
          class="flex items-center space-x-1 px-2 py-1 rounded hover:bg-slate-100 text-slate-700 font-medium transition-colors"
          on:click={() => insertFormula('IF')}
          title="If Condition (e.g. =IF(A1>0, 'Yes', 'No'))"
        >
          <span>IF</span>
        </button>
      </div>

      <!-- Google Sheets Supercharged Actions: Charts, Conditional Formatting, Sorting, Find -->
      <div class="flex items-center space-x-1 pr-1 border-r border-slate-200">
        <button
          class="flex items-center space-x-1 px-2 py-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-medium transition-colors"
          on:click={() => (showChartModal = true)}
          title="Insert Chart (Bar, Line, Pie)"
        >
          <BarChart3 size={13} />
          <span>Chart</span>
        </button>
        <button
          class="flex items-center space-x-1 px-2 py-1 rounded hover:bg-slate-100 text-slate-700 font-medium transition-colors"
          on:click={() => (showConditionalModal = true)}
          title="Conditional Formatting Rules"
        >
          <Sparkles size={13} class="text-amber-500" />
          <span>Format</span>
        </button>
      </div>

      <!-- Sorting -->
      <div class="flex items-center space-x-0.5 pr-1 border-r border-slate-200">
        <button
          class="p-1.5 rounded hover:bg-slate-100 text-slate-700 transition-colors"
          on:click={() => sortActiveColumn(true)}
          title="Sort Active Column A → Z (Ascending)"
        >
          <ArrowDownAZ size={14} />
        </button>
        <button
          class="p-1.5 rounded hover:bg-slate-100 text-slate-700 transition-colors"
          on:click={() => sortActiveColumn(false)}
          title="Sort Active Column Z → A (Descending)"
        >
          <ArrowUpZA size={14} />
        </button>
      </div>

      <!-- Add Rows/Columns -->
      <div class="flex items-center space-x-1 pr-1 border-r border-slate-200">
        <button class="flex items-center space-x-1 px-1.5 py-1 rounded hover:bg-slate-100 text-slate-700" on:click={() => insertRow(true)} title="Insert Row Above">
          <Plus size={12} />
          <span class="text-[10px]">Row ↑</span>
        </button>
        <button class="flex items-center space-x-1 px-1.5 py-1 rounded hover:bg-slate-100 text-slate-700" on:click={() => insertRow(false)} title="Insert Row Below">
          <Plus size={12} />
          <span class="text-[10px]">Row ↓</span>
        </button>
        <button class="flex items-center space-x-1 px-1.5 py-1 rounded hover:bg-slate-100 text-slate-700" on:click={() => insertColumn(true)} title="Insert Column Left">
          <Plus size={12} />
          <span class="text-[10px]">Col ←</span>
        </button>
        <button class="flex items-center space-x-1 px-1.5 py-1 rounded hover:bg-slate-100 text-slate-700" on:click={() => insertColumn(false)} title="Insert Column Right">
          <Plus size={12} />
          <span class="text-[10px]">Col →</span>
        </button>
      </div>

      <!-- Search & Import/Export -->
      <div class="flex items-center space-x-1">
        <button class="p-1.5 rounded hover:bg-slate-100 text-slate-600 transition-colors" on:click={() => (showFindBar = !showFindBar)} title="Find & Replace in Sheet (Ctrl+F)">
          <Search size={14} />
        </button>
        <button class="flex items-center space-x-1 px-2 py-1 rounded hover:bg-slate-100 text-slate-600" on:click={handleImportSpreadsheet} title="Import Spreadsheet (.xlsx, .csv, .tsv)">
          <Upload size={13} />
          <span>Import</span>
        </button>
        <button class="flex items-center space-x-1 px-2 py-1 rounded hover:bg-slate-100 text-slate-600" on:click={exportToExcel} title="Export Excel (.xlsx)">
          <Download size={13} />
          <span>Excel</span>
        </button>
      </div>
    </div>

    <div>
      <button class="p-1.5 rounded hover:bg-rose-50 text-slate-400 hover:text-rose-600" on:click={clearSheet} title="Clear Sheet">
        <Trash2 size={15} />
      </button>
    </div>
  </div>

  <!-- Find & Replace Floating Bar for Sheets -->
  {#if showFindBar}
    <div class="no-print bg-white border-b border-slate-200 px-4 py-2 flex items-center justify-between text-xs shadow-xs z-20">
      <div class="flex items-center space-x-2">
        <div class="flex items-center space-x-1.5 bg-slate-100 px-2 py-1 rounded border border-slate-300">
          <Search size={13} class="text-slate-400" />
          <input
            type="text"
            placeholder="Find in sheet..."
            bind:value={findQuery}
            class="bg-transparent outline-none text-xs w-36 text-slate-800"
            on:keydown={(e) => e.key === 'Enter' && handleSheetFind(false)}
          />
        </div>
        <div class="flex items-center space-x-1.5 bg-slate-100 px-2 py-1 rounded border border-slate-300">
          <Replace size={13} class="text-slate-400" />
          <input
            type="text"
            placeholder="Replace with..."
            bind:value={replaceQuery}
            class="bg-transparent outline-none text-xs w-36 text-slate-800"
          />
        </div>
        <button
          class="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 rounded border border-emerald-200 text-emerald-800 font-medium transition-colors"
          on:click={() => handleSheetFind(false)}
        >
          Replace
        </button>
        <button
          class="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 rounded border border-emerald-200 text-emerald-800 font-medium transition-colors"
          on:click={() => handleSheetFind(true)}
        >
          Replace All
        </button>
      </div>
      <button class="p-1 rounded hover:bg-slate-100 text-slate-400" on:click={() => (showFindBar = false)}>
        <X size={15} />
      </button>
    </div>
  {/if}

  <!-- Formula Bar -->
  <FormulaBar
    {activeCell}
    {rawValue}
    grid={activeSheet.cells}
    on:commit={handleFormulaCommit}
  />

  <!-- Grid View -->
  {#if validationNotice}
    <div
      class="flex items-center gap-2 px-3 py-1.5 text-[11px] text-rose-700 bg-rose-50 border-b border-rose-200"
      role="alert"
    >
      <AlertTriangle size={13} class="shrink-0" />
      <span class="flex-1 truncate">{validationNotice}</span>
      <button class="shrink-0 px-1.5 py-0.5 rounded hover:bg-rose-100" on:click={() => (validationNotice = '')}>Dismiss</button>
    </div>
  {/if}

  <Grid
    bind:this={gridRef}
    grid={activeSheet.cells}
    rowCount={activeSheet.rowCount}
    colCount={activeSheet.colCount}
    bind:activeCell
    conditionalRules={activeSheet.conditionalRules || []}
    hiddenRows={hiddenRows}
    frozenRows={activeSheet.frozenRows || 0}
    mergedRanges={activeSheet.mergedRanges || []}
    on:rangeSelect={handleRangeSelect}
    on:selectCell={handleSelectCell}
    on:cellChange={handleCellChange}
    on:cellInput={(e) => (rawValue = e.detail.raw)}
  />

  <!-- Chart Modal -->
  <ChartModal
    bind:isOpen={showChartModal}
    grid={activeSheet.cells}
    defaultRange={activeCell}
    on:insertChart={handleInsertChart}
  />

  <!-- Conditional Formatting Modal -->
  <ConditionalFormatModal
    bind:isOpen={showConditionalModal}
    rules={activeSheet.conditionalRules || []}
    defaultRange={activeCell}
    on:saveRules={handleSaveRules}
  />

  <!-- Google Sheets & Excel Style Multi-Sheet Bottom Tab Bar -->
  <div class="no-print h-8 bg-slate-100 border-t border-slate-300 px-3 flex items-center justify-between select-none text-xs">
    <div class="flex items-center space-x-1 overflow-x-auto">
      <button
        class="p-1 rounded hover:bg-slate-200 text-slate-700 mr-2 flex items-center justify-center font-bold"
        on:click={addNewSheet}
        title="Add Sheet"
      >
        <Plus size={15} />
      </button>

      {#each workbook.sheets as sheet}
        {@const isActive = sheet.id === workbook.activeSheetId}
        <div
          role="tab"
          tabindex="0"
          aria-selected={isActive}
          class="flex items-center space-x-1.5 px-3 py-1 rounded-t border-t-2 font-medium cursor-pointer transition-all
            {isActive ? 'bg-white text-emerald-700 border-emerald-600 shadow-sm font-semibold' : 'bg-slate-200 text-slate-600 border-transparent hover:bg-slate-300/80'}"
          on:click={() => selectSheet(sheet.id)}
          on:dblclick={() => renameSheet(sheet)}
          on:keydown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              selectSheet(sheet.id);
            }
          }}
          title="Double click to rename"
        >
          <span>{sheet.name}</span>
          {#if workbook.sheets.length > 1}
            <button
              class="p-0.5 hover:text-rose-600 rounded text-slate-400"
              on:click|stopPropagation={() => deleteSheet(sheet)}
              title="Delete Sheet"
            >
              <X size={12} />
            </button>
          {/if}
        </div>
      {/each}
    </div>

    <div class="text-[11px] text-slate-500 font-mono">
      {workbook.sheets.length} Sheet{workbook.sheets.length > 1 ? 's' : ''}
    </div>
  </div>
  <!-- Google Sheets style Calculator -->
  {#if showCalculator}
    <div class="fixed bottom-6 right-6 z-50 w-64 rounded-xl border border-slate-300 bg-white shadow-2xl text-slate-800">
      <div class="flex items-center justify-between border-b border-slate-200 px-3 py-2">
        <span class="text-xs font-semibold">Calculator</span>
        <button class="text-slate-400 hover:text-slate-700" on:click={() => (showCalculator = false)} aria-label="Close calculator">
          <X size={14} />
        </button>
      </div>
      <div class="bg-slate-100 px-3 py-3 text-right">
        <div class="text-xs text-slate-500">{activeCell}</div>
        <div class="truncate font-mono text-2xl font-semibold" aria-live="polite">{calcDisplay}</div>
      </div>
      <div class="grid grid-cols-4 gap-1 p-2">
        {#each [['C', 'clear'], ['/', 'op'], ['*', 'op'], ['-', 'op'], ['7', 'digit'], ['8', 'digit'], ['9', 'digit'], ['+', 'op'], ['4', 'digit'], ['5', 'digit'], ['6', 'digit'], ['=', 'equals'], ['1', 'digit'], ['2', 'digit'], ['3', 'digit'], ['0', 'digit']] as [label, kind]}
          <button
            class="rounded py-2 text-sm font-medium transition-colors
              {kind === 'digit'
                ? 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                : label === '='
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : 'bg-slate-200 hover:bg-slate-300 text-slate-700'}"
            on:click={() => {
              if (kind === 'clear') calcClear();
              else if (kind === 'equals') calcEquals();
              else if (kind === 'op') calcApply(label);
              else calcInputDigit(label);
            }}
          >
            {label}
          </button>
        {/each}
      </div>
      <div class="px-2 pb-2">
        <button class="w-full rounded bg-blue-600 hover:bg-blue-700 py-1.5 text-xs font-semibold text-white" on:click={calcInsertIntoCell}>
          Insert into {activeCell}
        </button>
      </div>
    </div>
  {/if}

  <!-- Data Validation Dialog -->
  {#if showValidationDialog}
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div class="w-96 rounded-xl border border-slate-200 bg-white p-5 text-xs text-slate-700 shadow-2xl">
        <h3 class="text-sm font-semibold text-slate-900">Data validation</h3>
        <p class="mt-1 text-[11px] text-slate-500">
          Restrict {validationTarget} to a list of values, the way Google Sheets dropdown validation works.
        </p>
        <label class="mt-4 block text-[11px] font-semibold" for="validation-items">Allowed values (comma separated)</label>
        <textarea
          id="validation-items"
          bind:value={validationList}
          rows="3"
          class="mt-1 w-full rounded border border-slate-300 p-2 font-mono text-xs outline-none focus:border-blue-500"
        ></textarea>
        <div class="mt-4 flex justify-end gap-2">
          <button class="rounded border border-slate-300 px-3 py-1.5 hover:bg-slate-50" on:click={() => (showValidationDialog = false)}>Cancel</button>
          <button class="rounded bg-blue-600 px-3 py-1.5 font-semibold text-white hover:bg-blue-700" on:click={saveDataValidation}>Save</button>
        </div>
      </div>
    </div>
  {/if}
</div>

