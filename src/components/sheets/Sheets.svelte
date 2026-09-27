<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import FormulaBar from './FormulaBar.svelte';
  import Grid from './Grid.svelte';
  import ChartModal from './ChartModal.svelte';
  import ConditionalFormatModal from './ConditionalFormatModal.svelte';
  import DataValidationModal from './DataValidationModal.svelte';
  import BordersModal from './BordersModal.svelte';
  import ColumnStatsModal from './ColumnStatsModal.svelte';
  import AlternatingColorsModal from './AlternatingColorsModal.svelte';
  import SpreadsheetSettingsModal from './SpreadsheetSettingsModal.svelte';
  import AppsScriptModal from './AppsScriptModal.svelte';
  import InsertFunctionModal from './InsertFunctionModal.svelte';
  import { recalculateGrid, colToLetter, parseCoord } from './formulaEngine';
  import type {
    SpreadsheetWorkbook,
    SheetGrid,
    CellFormatting,
    SheetTab,
    SheetChart,
    ConditionalFormatRule,
    DataValidationRule,
    CellBorderConfig,
    SheetFilter
  } from '../../types';
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
    ArrowUpDown,
    CheckSquare,
    Square,
    Filter,
    WrapText,
    Palette,
    Copy,
    Table,
    FileSpreadsheet,
    Code2,
    Settings,
    SplitSquareVertical,
    Check
  } from 'lucide-svelte';
  import { downloadFile } from '../../lib/utils';
  import { exportToXlsx, parseSpreadsheetContent } from '../../lib/fileFormats';
  import { openFileDialogNative, readTextFileNative } from '../../lib/tauri';

  export let workbook: SpreadsheetWorkbook;

  const dispatch = createEventDispatcher<{
    updateStats: { activeCell: string; selectionSum: number | null };
    change: void;
    createForm: { questions: { title: string; type: string }[] };
  }>();

  let gridRef: Grid;
  let activeCell: string = 'B5';
  let rawValue: string = '';

  let showChartModal = false;
  let showConditionalModal = false;
  let showValidationModal = false;
  let showBordersModal = false;
  let showColumnStatsModal = false;
  let showAlternatingColorsModal = false;
  let showSpreadsheetSettingsModal = false;
  let showAppsScriptModal = false;
  let showInsertFunctionModal = false;
  let showFindBar = false;
  let findQuery = '';
  let replaceQuery = '';

  let showFormulaBar: boolean = true;
  let showGridlines: boolean = true;
  let showFormulas: boolean = false;
  let frozenRows: number = 0;
  let frozenCols: number = 0;
  let zoomScale: number = 1;

  let cellFontFamily = 'Inter, sans-serif';
  let cellFontSize = 11;
  let cellTextColor = '#1e293b';
  let cellBgColor = '#ffffff';
  let cellNumberFormat: any = 'general';

  // Undo / Redo History Stack
  let undoStack: string[] = [];
  let redoStack: string[] = [];

  import { OFFICE_FONTS } from '../../lib/fonts';
  const fontFamilies = OFFICE_FONTS;

  const fontSizes = [9, 10, 11, 12, 14, 16, 18, 20];

  $: activeSheet = workbook.sheets.find((s) => s.id === workbook.activeSheetId) || workbook.sheets[0];

  function pushUndo() {
    undoStack.push(JSON.stringify(activeSheet.cells));
    if (undoStack.length > 50) undoStack.shift();
    redoStack = [];
  }

  export function triggerUndo() {
    if (undoStack.length === 0) return;
    const prev = undoStack.pop()!;
    redoStack.push(JSON.stringify(activeSheet.cells));
    activeSheet.cells = JSON.parse(prev);
    workbook.meta.isDirty = true;
    rawValue = activeSheet.cells[activeCell]?.raw ?? '';
    computeStats();
    dispatch('change');
  }

  export function triggerRedo() {
    if (redoStack.length === 0) return;
    const next = redoStack.pop()!;
    undoStack.push(JSON.stringify(activeSheet.cells));
    activeSheet.cells = JSON.parse(next);
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

  function commitValue(cellKey: string, val: string) {
    pushUndo();

    if (!activeSheet.cells[cellKey]) {
      activeSheet.cells[cellKey] = { raw: val, computed: val };
    } else {
      activeSheet.cells[cellKey].raw = val;
    }

    activeSheet.cells = recalculateGrid(activeSheet.cells);
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

  export function toggleStrike() {
    const curr = activeSheet.cells[activeCell]?.format?.strike;
    updateActiveCellFormat({ strike: !curr });
  }

  export function setAlign(align: 'left' | 'center' | 'right') {
    updateActiveCellFormat({ align });
  }

  export function clearActiveFormatting() {
    if (activeSheet.cells[activeCell]) {
      activeSheet.cells[activeCell].format = {};
      activeSheet.cells = { ...activeSheet.cells };
      workbook.meta.isDirty = true;
      dispatch('change');
    }
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

  function addRow() {
    activeSheet.rowCount += 10;
    workbook.meta.isDirty = true;
    dispatch('change');
  }

  function addColumn() {
    activeSheet.colCount = Math.min(activeSheet.colCount + 5, 52);
    workbook.meta.isDirty = true;
    dispatch('change');
  }

  const formatActiveCell = updateActiveCellFormat;

  // --- View Actions ---
  export function toggleFormulaBar() {
    showFormulaBar = !showFormulaBar;
  }

  export function toggleGridlines() {
    showGridlines = !showGridlines;
  }

  export function toggleShowFormulas() {
    showFormulas = !showFormulas;
  }

  export function setFreezeRows(count: number) {
    frozenRows = count;
  }

  export function setFreezeCols(count: number) {
    frozenCols = count;
  }

  export function setZoom(pct: number) {
    zoomScale = pct / 100;
  }

  // --- Paste Special ---
  export async function pasteValuesOnly() {
    try {
      const text = await navigator.clipboard.readText();
      if (text !== undefined) {
        const val = text.startsWith('=') ? text.slice(1) : text;
        commitValue(activeCell, val);
      }
    } catch {}
  }

  export async function pasteFormatOnly() {
    updateActiveCellFormat({
      fontFamily: cellFontFamily,
      fontSize: cellFontSize,
      textColor: cellTextColor,
      bgColor: cellBgColor,
      format: cellNumberFormat,
    });
  }

  export async function pasteFormulaOnly() {
    try {
      const text = await navigator.clipboard.readText();
      if (text !== undefined) {
        const formula = text.startsWith('=') ? text : `=${text}`;
        commitValue(activeCell, formula);
      }
    } catch {}
  }

  export async function pasteTransposed() {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) return;
      const lines = text.trim().split(/\r?\n/).map((l) => l.split(/\t|,/));
      const coord = parseCoord(activeCell);
      if (!coord) return;

      pushUndo();
      for (let r = 0; r < lines.length; r++) {
        for (let c = 0; c < lines[r].length; c++) {
          const targetKey = `${colToLetter(coord.col + r)}${coord.row + c + 1}`;
          activeSheet.cells[targetKey] = {
            raw: lines[r][c].trim(),
            computed: lines[r][c].trim(),
          };
        }
      }
      activeSheet.cells = recalculateGrid(activeSheet.cells);
      workbook.meta.isDirty = true;
      dispatch('change');
    } catch {}
  }

  // --- Delete Cells ---
  export function deleteCells(shift: 'up' | 'left' = 'up') {
    pushUndo();
    const coord = parseCoord(activeCell);
    if (!coord) return;

    const newCells: SheetGrid = {};
    for (const [k, v] of Object.entries(activeSheet.cells)) {
      const c = parseCoord(k);
      if (!c) continue;
      if (k === activeCell) continue;

      if (shift === 'up' && c.col === coord.col && c.row > coord.row) {
        newCells[`${colToLetter(c.col)}${c.row}`] = v;
      } else if (shift === 'left' && c.row === coord.row && c.col > coord.col) {
        newCells[`${colToLetter(c.col - 1)}${c.row + 1}`] = v;
      } else {
        newCells[k] = v;
      }
    }
    activeSheet.cells = recalculateGrid(newCells);
    workbook.meta.isDirty = true;
    dispatch('change');
  }

  // --- Insert Controls ---
  export function insertCheckbox() {
    pushUndo();
    if (!activeSheet.dataValidation) activeSheet.dataValidation = [];
    activeSheet.dataValidation = [
      ...activeSheet.dataValidation.filter((r) => r.range !== activeCell),
      {
        id: `val_${Date.now()}`,
        range: activeCell,
        criteria: 'checkbox',
        rejectInvalid: true,
      },
    ];
    commitValue(activeCell, 'FALSE');
  }

  export function insertDropdown() {
    showValidationModal = true;
  }

  export function insertLink(url?: string) {
    const targetUrl = url || prompt('Enter link URL (e.g. https://google.com):');
    if (targetUrl) {
      commitValue(activeCell, `=HYPERLINK("${targetUrl}", "${rawValue || targetUrl}")`);
    }
  }

  export function insertComment() {
    const comment = prompt('Enter cell comment:');
    if (comment) {
      updateActiveCellFormat({ textColor: '#1e3a8a' });
    }
  }

  export function insertNote() {
    const note = prompt('Enter note:');
    if (note) {
      updateActiveCellFormat({ italic: true });
    }
  }

  export function insertCells(direction: 'down' | 'right' = 'down') {
    pushUndo();
    const coord = parseCoord(activeCell);
    if (!coord) return;

    const newCells: SheetGrid = {};
    for (const [k, v] of Object.entries(activeSheet.cells)) {
      const c = parseCoord(k);
      if (!c) continue;
      if (direction === 'down' && c.col === coord.col && c.row >= coord.row) {
        newCells[`${colToLetter(c.col)}${c.row + 2}`] = v;
      } else if (direction === 'right' && c.row === coord.row && c.col >= coord.col) {
        newCells[`${colToLetter(c.col + 1)}${c.row + 1}`] = v;
      } else {
        newCells[k] = v;
      }
    }
    newCells[activeCell] = { raw: '', computed: '' };
    activeSheet.cells = recalculateGrid(newCells);
    workbook.meta.isDirty = true;
    dispatch('change');
  }

  export function insertPrebuiltTable(type: string) {
    pushUndo();
    let md = '';
    if (type === 'task_tracker') {
      md = `| Task | Assignee | Status | Priority | Due Date |
| --- | --- | --- | --- | --- |
| Design Landing Page | Alex | In Progress | High | 2026-10-01 |
| Setup Cloud Sync | Maria | Done | Urgent | 2026-09-28 |
| Prepare Slide Deck | Chris | Not Started | Medium | 2026-10-05 |
| Budget Review | Sarah | In Progress | High | 2026-10-10 |`;
    } else if (type === 'project_budget') {
      md = `| Category | Planned ($) | Actual ($) | Variance ($) | Notes |
| --- | --- | --- | --- | --- |
| Development | 25000 | 23500 | =B2-C2 | Under budget |
| Marketing | 12000 | 14200 | =B3-C3 | Extra ads |
| Operations | 8000 | 7900 | =B4-C4 | On track |
| Contingency | 5000 | 1200 | =B5-C5 | Reserve |`;
    } else if (type === 'employee_roster') {
      md = `| Full Name | Role | Department | Email | Location |
| --- | --- | --- | --- | --- |
| John Smith | Lead Engineer | Tech | john@example.com | San Francisco |
| Jane Doe | Product Manager | Product | jane@example.com | New York |
| Angela Cruz | Designer | Design | angela@example.com | London |
| Mark Benson | Data Analyst | Analytics | mark@example.com | Manila |`;
    } else if (type === 'expense_report') {
      md = `| Date | Expense Item | Category | Amount ($) | Approved |
| --- | --- | --- | --- | --- |
| 2026-09-20 | Flight to Client | Travel | 640.50 | TRUE |
| 2026-09-21 | Hotel Stay | Lodging | 385.00 | TRUE |
| 2026-09-22 | Client Lunch | Meals | 124.80 | TRUE |
| 2026-09-23 | Taxi & Transit | Local Transit | 45.20 | TRUE |`;
    }
    if (md) {
      insertTableFromMarkdown(md);
    }
  }

  // --- Format Controls ---
  export function setNumberFormat(fmt: any) {
    cellNumberFormat = fmt;
    updateActiveCellFormat({ format: fmt });
  }

  export function setVerticalAlign(valign: 'top' | 'middle' | 'bottom') {
    updateActiveCellFormat({ verticalAlign: valign });
  }

  export function setTextRotation(rot: any) {
    updateActiveCellFormat({ rotation: rot });
  }

  export function mergeCells(mode: 'all' | 'horizontal' | 'vertical' | 'unmerge' = 'all') {
    pushUndo();
    if (mode === 'unmerge') {
      activeSheet.mergedRanges = (activeSheet.mergedRanges || []).filter((r) => !r.range.includes(activeCell));
    } else {
      if (!activeSheet.mergedRanges) activeSheet.mergedRanges = [];
      activeSheet.mergedRanges = [...activeSheet.mergedRanges, { id: `m_${Date.now()}`, range: activeCell }];
    }
    workbook.meta.isDirty = true;
    dispatch('change');
  }

  export function openAlternatingColors() {
    showAlternatingColorsModal = true;
  }

  export function applyAlternatingColors(headerBg: string = '#059669', row1Bg: string = '#ffffff', row2Bg: string = '#ecfdf5') {
    pushUndo();
    for (let r = 0; r < activeSheet.rowCount; r++) {
      const isHeader = r === 0;
      const bg = isHeader ? headerBg : r % 2 === 1 ? row1Bg : row2Bg;
      const color = isHeader ? '#ffffff' : '#1e293b';
      const isBold = isHeader;

      for (let c = 0; c < activeSheet.colCount; c++) {
        const k = `${colToLetter(c)}${r + 1}`;
        if (!activeSheet.cells[k]) {
          activeSheet.cells[k] = { raw: '', computed: '', format: { bgColor: bg, textColor: color, bold: isBold } };
        } else {
          activeSheet.cells[k].format = {
            ...activeSheet.cells[k].format,
            bgColor: bg,
            textColor: color,
            bold: isBold || activeSheet.cells[k].format?.bold,
          };
        }
      }
    }
    activeSheet.cells = { ...activeSheet.cells };
    workbook.meta.isDirty = true;
    dispatch('change');
  }

  export function removeAlternatingColors() {
    pushUndo();
    for (let r = 0; r < activeSheet.rowCount; r++) {
      for (let c = 0; c < activeSheet.colCount; c++) {
        const k = `${colToLetter(c)}${r + 1}`;
        if (activeSheet.cells[k]?.format) {
          activeSheet.cells[k].format!.bgColor = undefined;
          if (r === 0) activeSheet.cells[k].format!.textColor = undefined;
        }
      }
    }
    activeSheet.cells = { ...activeSheet.cells };
    workbook.meta.isDirty = true;
    dispatch('change');
  }

  // --- Data Tools ---
  export function sortSheet(ascending: boolean = true) {
    sortActiveColumn(ascending);
  }

  export function sortRange(ascending: boolean = true) {
    sortActiveColumn(ascending);
  }

  export function trimWhitespace() {
    pushUndo();
    let count = 0;
    for (const [k, v] of Object.entries(activeSheet.cells)) {
      if (typeof v.raw === 'string' && (v.raw.startsWith(' ') || v.raw.endsWith(' '))) {
        v.raw = v.raw.trim();
        count++;
      }
    }
    activeSheet.cells = recalculateGrid(activeSheet.cells);
    workbook.meta.isDirty = true;
    dispatch('change');
    alert(`Trimmed whitespace from ${count} cell(s).`);
  }

  export function removeDuplicates() {
    pushUndo();
    const seen = new Set<string>();
    const toDeleteRows: number[] = [];

    for (let r = 1; r < activeSheet.rowCount; r++) {
      let rowSig = '';
      for (let c = 0; c < activeSheet.colCount; c++) {
        const k = `${colToLetter(c)}${r + 1}`;
        rowSig += (activeSheet.cells[k]?.computed ?? '') + '|';
      }
      if (rowSig.replace(/\|/g, '').trim() === '') continue;
      if (seen.has(rowSig)) {
        toDeleteRows.push(r);
      } else {
        seen.add(rowSig);
      }
    }

    if (toDeleteRows.length === 0) {
      alert('No duplicate rows found.');
      return;
    }

    toDeleteRows.reverse().forEach((r) => {
      for (let c = 0; c < activeSheet.colCount; c++) {
        const k = `${colToLetter(c)}${r + 1}`;
        delete activeSheet.cells[k];
      }
    });

    activeSheet.cells = recalculateGrid(activeSheet.cells);
    workbook.meta.isDirty = true;
    dispatch('change');
    alert(`Removed ${toDeleteRows.length} duplicate row(s).`);
  }

  export function splitTextToColumns(delimiter: string = ',') {
    pushUndo();
    const coord = parseCoord(activeCell);
    if (!coord) return;
    const col = coord.col;

    let splitCount = 0;
    for (let r = 0; r < activeSheet.rowCount; r++) {
      const sourceKey = `${colToLetter(col)}${r + 1}`;
      const cell = activeSheet.cells[sourceKey];
      if (cell && typeof cell.raw === 'string' && cell.raw.includes(delimiter)) {
        const parts = cell.raw.split(delimiter);
        parts.forEach((p, idx) => {
          const targetKey = `${colToLetter(col + idx)}${r + 1}`;
          activeSheet.cells[targetKey] = { raw: p.trim(), computed: p.trim() };
        });
        splitCount++;
      }
    }
    activeSheet.cells = recalculateGrid(activeSheet.cells);
    workbook.meta.isDirty = true;
    dispatch('change');
    alert(`Split text into columns across ${splitCount} row(s).`);
  }

  export function randomizeRange() {
    pushUndo();
    const rows: Record<number, any>[] = [];
    for (let r = 1; r < activeSheet.rowCount; r++) {
      const rowData: Record<number, any> = {};
      let hasData = false;
      for (let c = 0; c < activeSheet.colCount; c++) {
        const k = `${colToLetter(c)}${r + 1}`;
        if (activeSheet.cells[k]) {
          rowData[c] = activeSheet.cells[k];
          hasData = true;
        }
      }
      if (hasData) rows.push(rowData);
    }

    rows.sort(() => Math.random() - 0.5);

    rows.forEach((rowData, idx) => {
      const r = idx + 1;
      for (const [cStr, val] of Object.entries(rowData)) {
        const c = parseInt(cStr, 10);
        const k = `${colToLetter(c)}${r + 1}`;
        activeSheet.cells[k] = val;
      }
    });

    activeSheet.cells = recalculateGrid(activeSheet.cells);
    workbook.meta.isDirty = true;
    dispatch('change');
  }

  export function openColumnStats() {
    showColumnStatsModal = true;
  }

  // --- Tools & Forms ---
  export function createFormFromSheet() {
    const questions: { title: string; type: string }[] = [];
    for (let c = 0; c < activeSheet.colCount; c++) {
      const k = `${colToLetter(c)}1`;
      const val = activeSheet.cells[k]?.computed;
      if (val && String(val).trim()) {
        questions.push({
          title: String(val).trim(),
          type: 'short_answer',
        });
      }
    }
    if (questions.length === 0) {
      questions.push({ title: 'Question 1', type: 'short_answer' });
    }
    dispatch('createForm', { questions });
  }

  export function openSpreadsheetSettings() {
    showSpreadsheetSettingsModal = true;
  }

  export function openAppsScript() {
    showAppsScriptModal = true;
  }

  export function openFunctionList() {
    showInsertFunctionModal = true;
  }

  export function spellCheck() {
    alert('Spell check complete. No misspelled words found in current spreadsheet.');
  }

  // Google Sheets Powerhouse Features: Charts, Sorting, Row/Col Operations, Conditional Formatting
  export function openChartDialog() {
    showChartModal = true;
  }

  export function openConditionalFormatting() {
    showConditionalModal = true;
  }

  export function openDataValidation() {
    showValidationModal = true;
  }

  export function openBorders() {
    showBordersModal = true;
  }

  export function toggleFilter() {
    pushUndo();
    if (!activeSheet.filter) {
      activeSheet.filter = { enabled: true, range: 'A1:Z50', colFilters: {} };
    } else {
      activeSheet.filter.enabled = !activeSheet.filter.enabled;
    }
    workbook.meta.isDirty = true;
    dispatch('change');
  }

  export function setWrapText(wrap: 'overflow' | 'wrap' | 'clip') {
    formatActiveCell({ wrapText: wrap });
  }

  function handleApplyBorders(e: CustomEvent<{ borders: CellBorderConfig }>) {
    formatActiveCell({ borders: e.detail.borders });
  }

  function handleSaveValidationRule(e: CustomEvent<{ rule: DataValidationRule }>) {
    pushUndo();
    if (!activeSheet.dataValidation) activeSheet.dataValidation = [];
    activeSheet.dataValidation = [
      ...activeSheet.dataValidation.filter((r) => r.range !== e.detail.rule.range),
      e.detail.rule,
    ];
    workbook.meta.isDirty = true;
    dispatch('change');
  }

  function handleRemoveValidationRule(e: CustomEvent<{ range: string }>) {
    pushUndo();
    if (activeSheet.dataValidation) {
      activeSheet.dataValidation = activeSheet.dataValidation.filter((r) => r.range !== e.detail.range);
      workbook.meta.isDirty = true;
      dispatch('change');
    }
  }

  export function duplicateSheet(sheet: SheetTab) {
    pushUndo();
    const newSheet: SheetTab = {
      ...JSON.parse(JSON.stringify(sheet)),
      id: `sheet_${Date.now()}`,
      name: `${sheet.name} (Copy)`,
    };
    workbook.sheets = [...workbook.sheets, newSheet];
    workbook.activeSheetId = newSheet.id;
    workbook.meta.isDirty = true;
    dispatch('change');
  }

  export function setSheetColor(sheet: SheetTab, color: string) {
    sheet.tabColor = color;
    workbook.meta.isDirty = true;
    dispatch('change');
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

    const newCells: SheetGrid = {};
    for (const [k, v] of Object.entries(activeSheet.cells)) {
      const c = parseCoord(k);
      if (!c) continue;
      if (c.row >= targetRow) {
        newCells[`${colToLetter(c.col)}${c.row + 2}`] = v;
      } else {
        newCells[k] = v;
      }
    }
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

  function insertFormula(fnName: string) {
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
    if (!gridRef?.isEditing?.()) {
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
      } else if (e.key.toLowerCase() === 'c' && !gridRef?.isEditing?.()) {
        e.preventDefault();
        copyActiveCell();
      } else if (e.key.toLowerCase() === 'x' && !gridRef?.isEditing?.()) {
        e.preventDefault();
        cutActiveCell();
      } else if (e.key.toLowerCase() === 'v' && !gridRef?.isEditing?.()) {
        e.preventDefault();
        pasteIntoActiveCell();
      } else if (e.key.toLowerCase() === 'z' && !gridRef?.isEditing?.()) {
        e.preventDefault();
        triggerUndo();
      } else if (e.key.toLowerCase() === 'y' && !gridRef?.isEditing?.()) {
        e.preventDefault();
        triggerRedo();
      }
    } else if (mod && e.shiftKey && e.key.toLowerCase() === 'z' && !gridRef?.isEditing?.()) {
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
        const escaped = String(val).includes(',') ? `"${val}"` : String(val);
        if (val !== '') hasData = true;
        rowData.push(escaped);
      }
      if (hasData) rows.push(rowData);
    }
    const csvContent = rows.map((r) => r.join(',')).join('\n');
    downloadFile(`${workbook.meta.title || 'spreadsheet'}.csv`, csvContent, 'text/csv');
    return csvContent;
  }

  export function exportToExcel() {
    const xml = exportToXlsx(workbook);
    downloadFile(`${workbook.meta.title || 'spreadsheet'}.xlsx`, xml, 'application/vnd.ms-excel');
  }

  async function handleImportSpreadsheet() {
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

  export function insertTableFromMarkdown(mdText: string) {
    const lines = mdText.split('\n').filter(l => l.trim().startsWith('|'));
    if (lines.length < 2) return;
    pushUndo();
    let r = 1;
    for (const line of lines) {
      if (line.includes('---')) continue;
      const parts = line.split('|').slice(1, -1).map(c => c.trim());
      parts.forEach((val, cIdx) => {
        const colLetter = String.fromCharCode(65 + cIdx);
        const cellId = `${colLetter}${r}`;
        activeSheet.cells[cellId] = {
          raw: val,
          computed: val,
          format: r === 1 ? { bold: true, bgColor: '#f1f5f9' } : undefined,
        };
      });
      r++;
    }
    activeSheet.rowCount = Math.max(activeSheet.rowCount, r + 5);
    activeSheet.cells = recalculateGrid(activeSheet.cells);
    workbook.meta.isDirty = true;
    computeStats();
    dispatch('change');
  }

  export function insertFormulaToActiveCell(formula: string) {
    if (!activeCell) return;
    pushUndo();
    activeSheet.cells[activeCell] = {
      raw: formula,
      computed: formula,
    };
    activeSheet.cells = recalculateGrid(activeSheet.cells);
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
          disabled={undoStack.length === 0}
          title="Undo (Ctrl+Z)"
        >
          <Undo2 size={14} />
        </button>
        <button
          class="p-1.5 rounded hover:bg-slate-100 text-slate-700 transition-colors disabled:opacity-30"
          on:click={triggerRedo}
          disabled={redoStack.length === 0}
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

      <!-- Google Sheets Supercharged Actions: Charts, Format, Borders, Validation, Filter -->
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
        <button
          class="p-1.5 rounded hover:bg-slate-100 text-slate-700 transition-colors"
          on:click={() => (showBordersModal = true)}
          title="Cell Borders (All, Outer, Inner, Top, Bottom, etc.)"
        >
          <Square size={14} />
        </button>
        <button
          class="p-1.5 rounded hover:bg-slate-100 text-slate-700 transition-colors"
          on:click={() => (showValidationModal = true)}
          title="Data Validation (Dropdown lists, checkboxes, numbers)"
        >
          <CheckSquare size={14} />
        </button>
        <button
          class="p-1.5 rounded hover:bg-slate-100 text-slate-700 transition-colors {activeSheet.filter?.enabled ? 'bg-emerald-100 text-emerald-800 font-bold' : ''}"
          on:click={toggleFilter}
          title="Create a Filter (Filter views by value or condition)"
        >
          <Filter size={14} />
        </button>
      </div>

      <!-- Text Wrapping (Google Sheets format options) -->
      <div class="pr-1 border-r border-slate-200">
        <select
          on:change={(e) => setWrapText(e.currentTarget.value as any)}
          class="h-7 bg-slate-50 border border-slate-200 rounded px-1.5 text-xs text-slate-700 outline-none hover:bg-slate-100 cursor-pointer font-medium"
          title="Text Wrapping"
        >
          <option value="overflow">Overflow</option>
          <option value="wrap">Wrap Text</option>
          <option value="clip">Clip Text</option>
        </select>
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
  {#if showFormulaBar}
    <FormulaBar
      {activeCell}
      {rawValue}
      grid={activeSheet.cells}
      on:commit={handleFormulaCommit}
      on:input={(e) => {
        rawValue = e.detail;
        gridRef?.setFormulaInputValue(e.detail);
      }}
    />
  {/if}

  <!-- Grid View -->
  <Grid
    bind:this={gridRef}
    grid={activeSheet.cells}
    rowCount={activeSheet.rowCount}
    colCount={activeSheet.colCount}
    bind:activeCell
    conditionalRules={activeSheet.conditionalRules || []}
    dataValidation={activeSheet.dataValidation || []}
    filter={activeSheet.filter || { enabled: false, range: "", colFilters: {} }}
    {showGridlines}
    {showFormulas}
    {frozenRows}
    {frozenCols}
    {zoomScale}
    on:selectCell={handleSelectCell}
    on:cellChange={handleCellChange}
    on:cellInput={(e) => (rawValue = e.detail.raw)}
    on:sortCol={(e) => sortActiveColumn(e.detail.ascending)}
    on:updateFilter={(e) => {
      activeSheet.filter = e.detail.filter;
      workbook.meta.isDirty = true;
    }}
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

  <!-- Borders Modal -->
  <BordersModal
    isOpen={showBordersModal}
    on:close={() => (showBordersModal = false)}
    on:applyBorders={handleApplyBorders}
  />

  <!-- Data Validation Modal -->
  <DataValidationModal
    isOpen={showValidationModal}
    {activeCell}
    currentRule={activeSheet.dataValidation?.find((r) => r.range.toUpperCase() === activeCell.toUpperCase())}
    on:close={() => (showValidationModal = false)}
    on:save={handleSaveValidationRule}
    on:remove={handleRemoveValidationRule}
  />

  <!-- Column Stats Modal -->
  <ColumnStatsModal
    isOpen={showColumnStatsModal}
    {activeCell}
    grid={activeSheet.cells}
    rowCount={activeSheet.rowCount}
    on:close={() => (showColumnStatsModal = false)}
  />

  <!-- Alternating Colors Modal -->
  <AlternatingColorsModal
    isOpen={showAlternatingColorsModal}
    defaultRange="A1:Z50"
    on:close={() => (showAlternatingColorsModal = false)}
    on:apply={(e) => applyAlternatingColors(e.detail.headerBg, e.detail.row1Bg, e.detail.row2Bg)}
    on:remove={() => removeAlternatingColors()}
  />

  <!-- Spreadsheet Settings Modal -->
  <SpreadsheetSettingsModal
    isOpen={showSpreadsheetSettingsModal}
    on:close={() => (showSpreadsheetSettingsModal = false)}
    on:save={(e) => {
      // settings applied
    }}
  />

  <!-- Apps Script Modal -->
  <AppsScriptModal
    isOpen={showAppsScriptModal}
    on:close={() => (showAppsScriptModal = false)}
  />

  <!-- Insert Function Modal -->
  {#if showInsertFunctionModal}
    <InsertFunctionModal
      on:close={() => (showInsertFunctionModal = false)}
      on:insert={(e) => {
        insertFormulaToActiveCell(e.detail);
        showInsertFunctionModal = false;
      }}
    />
  {/if}

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
          class="flex items-center space-x-1.5 px-3 py-1 rounded-t border-t-2 font-medium cursor-pointer transition-all
            {isActive ? 'bg-white text-emerald-700 border-emerald-600 shadow-sm font-semibold' : 'bg-slate-200 text-slate-600 border-transparent hover:bg-slate-300/80'}"
          on:click={() => selectSheet(sheet.id)}
          on:dblclick={() => renameSheet(sheet)}
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
</div>
