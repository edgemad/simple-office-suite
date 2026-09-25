<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import FormulaBar from './FormulaBar.svelte';
  import Grid from './Grid.svelte';
  import { recalculateGrid, colToLetter } from './formulaEngine';
  import type { SpreadsheetWorkbook, SheetGrid } from '../../types';
  import {
    Plus,
    TableProperties,
    Bold,
    Italic,
    AlignLeft,
    AlignCenter,
    AlignRight,
    Sigma,
    Download,
    Upload,
    Trash2
  } from 'lucide-svelte';
  import { downloadFile } from '../../lib/utils';

  export let workbook: SpreadsheetWorkbook;

  const dispatch = createEventDispatcher<{
    updateStats: { activeCell: string; selectionSum: number | null };
    change: void;
  }>();

  let activeCell: string = 'B5';
  let rawValue: string = '';

  // Get active sheet
  $: activeSheet = workbook.sheets.find((s) => s.id === workbook.activeSheetId) || workbook.sheets[0];

  function handleSelectCell(e: CustomEvent<{ key: string; raw: string; computed: string | number }>) {
    activeCell = e.detail.key;
    rawValue = e.detail.raw;
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
    } else if (typeof val === 'string' && !isNaN(Number(val))) {
      sum = Number(val);
    }
    dispatch('updateStats', { activeCell, selectionSum: sum });
  }

  // Quick toolbar operations
  function toggleBold() {
    if (!activeSheet.cells[activeCell]) {
      activeSheet.cells[activeCell] = { raw: '', computed: '', format: { bold: true } };
    } else {
      activeSheet.cells[activeCell].format = {
        ...activeSheet.cells[activeCell].format,
        bold: !activeSheet.cells[activeCell].format?.bold,
      };
    }
    activeSheet.cells = { ...activeSheet.cells };
    workbook.meta.isDirty = true;
    dispatch('change');
  }

  function setAlign(align: 'left' | 'center' | 'right') {
    if (!activeSheet.cells[activeCell]) {
      activeSheet.cells[activeCell] = { raw: '', computed: '', format: { align } };
    } else {
      activeSheet.cells[activeCell].format = {
        ...activeSheet.cells[activeCell].format,
        align,
      };
    }
    activeSheet.cells = { ...activeSheet.cells };
    workbook.meta.isDirty = true;
    dispatch('change');
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

  function insertAutoSum() {
    // Look at column letter of active cell and insert =SUM(X1:X{row-1})
    const match = activeCell.match(/^([A-Z]+)([0-9]+)$/);
    if (!match) return;
    const col = match[1];
    const row = parseInt(match[2], 10);
    if (row <= 1) return;

    const sumFormula = `=SUM(${col}1:${col}${row - 1})`;
    commitValue(activeCell, sumFormula);
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
      if (hasData) {
        rows.push(rowData);
      }
    }
    const csvContent = rows.map((r) => r.join(',')).join('\n');
    downloadFile(`${workbook.meta.title || 'spreadsheet'}.csv`, csvContent, 'text/csv');
    return csvContent;
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

  function handleCsvFileSelect() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,text/csv';
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

  function clearSheet() {
    if (confirm('Clear all cells in the current sheet?')) {
      activeSheet.cells = {};
      workbook.meta.isDirty = true;
      dispatch('change');
    }
  }
</script>

<div class="flex-1 flex flex-col h-full overflow-hidden bg-slate-100">
  <!-- Sheets Formatting Toolbar -->
  <div class="no-print h-10 bg-white border-b border-slate-200 px-4 flex items-center justify-between select-none text-xs text-slate-700">
    <div class="flex items-center space-x-2">
      <!-- Formatting tools -->
      <div class="flex items-center space-x-0.5 border-r border-slate-200 pr-2">
        <button
          class="p-1.5 rounded hover:bg-slate-100 font-bold"
          on:click={toggleBold}
          title="Bold Cell"
        >
          <Bold size={15} />
        </button>
        <button
          class="p-1.5 rounded hover:bg-slate-100"
          on:click={() => setAlign('left')}
          title="Align Left"
        >
          <AlignLeft size={15} />
        </button>
        <button
          class="p-1.5 rounded hover:bg-slate-100"
          on:click={() => setAlign('center')}
          title="Align Center"
        >
          <AlignCenter size={15} />
        </button>
        <button
          class="p-1.5 rounded hover:bg-slate-100"
          on:click={() => setAlign('right')}
          title="Align Right"
        >
          <AlignRight size={15} />
        </button>
      </div>

      <!-- Quick Formulas -->
      <div class="flex items-center space-x-1 border-r border-slate-200 pr-2">
        <button
          class="flex items-center space-x-1 px-2.5 py-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-medium transition-colors"
          on:click={insertAutoSum}
          title="Insert =SUM for column above"
        >
          <Sigma size={14} />
          <span>AutoSum</span>
        </button>
      </div>

      <!-- Add Rows/Columns -->
      <div class="flex items-center space-x-1 border-r border-slate-200 pr-2">
        <button
          class="flex items-center space-x-1 px-2 py-1 rounded hover:bg-slate-100 text-slate-700 transition-colors"
          on:click={addRow}
          title="Add 10 Rows"
        >
          <Plus size={14} />
          <span>Rows</span>
        </button>
        <button
          class="flex items-center space-x-1 px-2 py-1 rounded hover:bg-slate-100 text-slate-700 transition-colors"
          on:click={addColumn}
          title="Add 5 Columns"
        >
          <Plus size={14} />
          <span>Columns</span>
        </button>
      </div>

      <!-- CSV Import / Export -->
      <div class="flex items-center space-x-1">
        <button
          class="flex items-center space-x-1 px-2 py-1 rounded hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors"
          on:click={handleCsvFileSelect}
          title="Import CSV into sheet"
        >
          <Upload size={14} />
          <span>Import CSV</span>
        </button>
        <button
          class="flex items-center space-x-1 px-2 py-1 rounded hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors"
          on:click={exportToCsv}
          title="Download as CSV"
        >
          <Download size={14} />
          <span>Export CSV</span>
        </button>
      </div>
    </div>

    <!-- Clear Sheet -->
    <div>
      <button
        class="p-1.5 rounded hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors"
        on:click={clearSheet}
        title="Clear Sheet Cells"
      >
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
</div>
