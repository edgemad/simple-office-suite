<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import FormulaBar from './FormulaBar.svelte';
  import Grid from './Grid.svelte';
  import { recalculateGrid, colToLetter } from './formulaEngine';
  import type { SpreadsheetWorkbook, SheetGrid, CellFormatting, SheetTab } from '../../types';
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
    Redo2
  } from 'lucide-svelte';
  import { downloadFile } from '../../lib/utils';
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

  let cellFontFamily = 'Inter, sans-serif';
  let cellFontSize = 11;
  let cellTextColor = '#1e293b';
  let cellBgColor = '#ffffff';
  let cellNumberFormat: 'general' | 'number' | 'currency' | 'percent' | 'date' = 'general';

  // Undo / Redo History Stack
  let undoStack: string[] = [];
  let redoStack: string[] = [];

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

  function toggleBold() {
    const curr = activeSheet.cells[activeCell]?.format?.bold;
    updateActiveCellFormat({ bold: !curr });
  }

  function toggleItalic() {
    const curr = activeSheet.cells[activeCell]?.format?.italic;
    updateActiveCellFormat({ italic: !curr });
  }

  function toggleUnderline() {
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

      <!-- Add Rows/Columns -->
      <div class="flex items-center space-x-1 pr-1 border-r border-slate-200">
        <button class="flex items-center space-x-1 px-2 py-1 rounded hover:bg-slate-100 text-slate-700" on:click={addRow} title="Add 10 Rows">
          <Plus size={13} />
          <span>Rows</span>
        </button>
        <button class="flex items-center space-x-1 px-2 py-1 rounded hover:bg-slate-100 text-slate-700" on:click={addColumn} title="Add 5 Columns">
          <Plus size={13} />
          <span>Cols</span>
        </button>
      </div>

      <!-- Import/Export -->
      <div class="flex items-center space-x-1">
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

  <!-- Formula Bar -->
  <FormulaBar
    {activeCell}
    {rawValue}
    grid={activeSheet.cells}
    on:commit={handleFormulaCommit}
  />

  <!-- Grid View -->
  <Grid
    bind:this={gridRef}
    grid={activeSheet.cells}
    rowCount={activeSheet.rowCount}
    colCount={activeSheet.colCount}
    bind:activeCell
    on:selectCell={handleSelectCell}
    on:cellChange={handleCellChange}
    on:cellInput={(e) => (rawValue = e.detail.raw)}
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
