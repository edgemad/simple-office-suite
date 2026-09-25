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
    ArrowDownAZ,
    ArrowUpZA,
    X,
    FolderPlus
  } from 'lucide-svelte';
  import { downloadFile } from '../../lib/utils';
  import { exportToXlsx } from '../../lib/fileFormats';

  export let workbook: SpreadsheetWorkbook;

  const dispatch = createEventDispatcher<{
    updateStats: { activeCell: string; selectionSum: number | null };
    change: void;
  }>();

  let activeCell: string = 'B5';
  let rawValue: string = '';

  let cellFontFamily = 'Inter, sans-serif';
  let cellFontSize = 11;
  let cellTextColor = '#1e293b';
  let cellBgColor = '#ffffff';
  let cellNumberFormat: 'general' | 'number' | 'currency' | 'percent' | 'date' = 'general';

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
    const match = activeCell.match(/^([A-Z]+)([0-9]+)$/);
    if (!match) return;
    const col = match[1];
    const row = parseInt(match[2], 10);
    if (row <= 1) return;

    const formula = `=${fnName}(${col}1:${col}${row - 1})`;
    commitValue(activeCell, formula);
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

  function handleCsvFileSelect() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,text/csv,.tsv';
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

  export function importFromCsv(csvText: string) {
    const lines = csvText.split(/\r?\n/).filter(Boolean);
    const newCells: SheetGrid = {};

    lines.forEach((line, r) => {
      const cols = line.split(',');
      cols.forEach((val, c) => {
        const key = `${colToLetter(c)}${r + 1}`;
        const clean = val.replace(/^"|"$/g, '').trim();
        newCells[key] = { raw: clean, computed: clean };
      });
    });

    activeSheet.cells = recalculateGrid(newCells);
    activeSheet.rowCount = Math.max(activeSheet.rowCount, lines.length + 10);
    workbook.meta.isDirty = true;
    computeStats();
    dispatch('change');
  }

  function clearSheet() {
    if (confirm('Clear all cells in the current sheet?')) {
      activeSheet.cells = {};
      workbook.meta.isDirty = true;
      dispatch('change');
    }
  }
</script>

<div class="flex-1 flex flex-col h-full overflow-hidden bg-slate-100">
  <!-- Powerhouse Sheets Formatting Toolbar -->
  <div class="no-print bg-white border-b border-slate-200 px-3 py-1 flex items-center justify-between select-none text-xs text-slate-700 shadow-sm overflow-x-auto">
    <div class="flex items-center space-x-1.5">
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
          title="Count"
        >
          <span>COUNT</span>
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
        <button class="flex items-center space-x-1 px-2 py-1 rounded hover:bg-slate-100 text-slate-600" on:click={handleCsvFileSelect} title="Import CSV/TSV">
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
    on:commit={handleFormulaCommit}
  />

  <!-- Grid View -->
  <Grid
    grid={activeSheet.cells}
    rowCount={activeSheet.rowCount}
    colCount={activeSheet.colCount}
    bind:activeCell
    on:selectCell={handleSelectCell}
    on:cellChange={handleCellChange}
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
