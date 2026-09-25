<script lang="ts">
  import { createEventDispatcher, tick } from 'svelte';
  import { colToLetter, parseCoord } from './formulaEngine';
  import type { SheetGrid, CellFormatting } from '../../types';

  export let grid: SheetGrid;
  export let rowCount: number = 50;
  export let colCount: number = 26;
  export let activeCell: string = 'A1';

  const dispatch = createEventDispatcher<{
    selectCell: { key: string; raw: string; computed: string | number };
    cellChange: { key: string; raw: string };
  }>();

  let editingCell: string | null = null;
  let editInputVal: string = '';
  let editInputRef: HTMLInputElement | null = null;

  function getCellKey(col: number, row: number): string {
    return `${colToLetter(col)}${row + 1}`;
  }

  function handleCellClick(key: string) {
    if (editingCell && editingCell !== key) {
      commitEdit();
    }
    setActiveCell(key);
  }

  function setActiveCell(key: string) {
    activeCell = key;
    const cell = grid[key];
    dispatch('selectCell', {
      key,
      raw: cell?.raw ?? '',
      computed: cell?.computed ?? '',
    });
  }

  async function handleCellDblClick(key: string) {
    activeCell = key;
    editingCell = key;
    editInputVal = grid[key]?.raw ?? '';
    await tick();
    if (editInputRef) {
      editInputRef.focus();
      editInputRef.select();
    }
  }

  function commitEdit() {
    if (editingCell) {
      dispatch('cellChange', { key: editingCell, raw: editInputVal });
      editingCell = null;
    }
  }

  function handleEditKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitEdit();
      // Move down on Enter
      const coord = parseCoord(activeCell);
      if (coord && coord.row + 1 < rowCount) {
        setActiveCell(getCellKey(coord.col, coord.row + 1));
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      commitEdit();
      // Move right on Tab
      const coord = parseCoord(activeCell);
      if (coord && coord.col + 1 < colCount) {
        setActiveCell(getCellKey(coord.col + 1, coord.row));
      }
    } else if (e.key === 'Escape') {
      editingCell = null;
    }
  }

  async function handleTableKeydown(e: KeyboardEvent) {
    if (editingCell) return;

    const coord = parseCoord(activeCell);
    if (!coord) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (coord.row + 1 < rowCount) setActiveCell(getCellKey(coord.col, coord.row + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (coord.row > 0) setActiveCell(getCellKey(coord.col, coord.row - 1));
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      if (coord.col + 1 < colCount) setActiveCell(getCellKey(coord.col + 1, coord.row));
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      if (coord.col > 0) setActiveCell(getCellKey(coord.col - 1, coord.row));
    } else if (e.key === 'Enter' || e.key === 'F2') {
      e.preventDefault();
      await handleCellDblClick(activeCell);
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      dispatch('cellChange', { key: activeCell, raw: '' });
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      // Start typing directly into active cell (e.g. "=", numbers, letters)
      editingCell = activeCell;
      editInputVal = e.key;
      e.preventDefault();
      await tick();
      if (editInputRef) {
        editInputRef.focus();
        editInputRef.setSelectionRange(1, 1);
      }
    }
  }

  function formatDisplayValue(val: string | number | undefined, format?: CellFormatting): string {
    if (val === undefined || val === null || val === '') return '';
    if (!format || !format.format || format.format === 'general') return String(val);

    const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/[$,%]/g, ''));
    if (isNaN(num)) return String(val);

    switch (format.format) {
      case 'currency':
        return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      case 'number':
        return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      case 'percent':
        return `${(num * (num < 1 ? 100 : 1)).toFixed(1)}%`;
      case 'date':
        try {
          return new Date(num).toLocaleDateString();
        } catch {
          return String(val);
        }
      default:
        return String(val);
    }
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
  class="flex-1 overflow-auto bg-slate-200 select-none relative outline-none"
  tabindex="0"
  on:keydown={handleTableKeydown}
>
  <table class="border-collapse table-fixed bg-white text-xs">
    <!-- Header Row (Column Letters) -->
    <thead>
      <tr class="sticky top-0 z-20 bg-slate-100 shadow-sm">
        <th class="w-12 h-6 border-b border-r border-slate-300 bg-slate-200 sticky left-0 z-30 text-slate-500 font-mono text-[10px]"></th>
        {#each Array(colCount) as _, colIdx}
          <th class="w-28 h-6 border-b border-r border-slate-300 text-slate-600 font-semibold font-mono text-center hover:bg-slate-200">
            {colToLetter(colIdx)}
          </th>
        {/each}
      </tr>
    </thead>

    <!-- Data Rows -->
    <tbody>
      {#each Array(rowCount) as _, rowIdx}
        <tr class="hover:bg-slate-50/50">
          <!-- Row Number (Sticky Column) -->
          <td class="w-12 h-7 border-b border-r border-slate-300 bg-slate-100 sticky left-0 z-10 text-center font-mono text-slate-500 font-medium text-[11px]">
            {rowIdx + 1}
          </td>

          <!-- Cells -->
          {#each Array(colCount) as _, colIdx}
            {@const key = getCellKey(colIdx, rowIdx)}
            {@const cell = grid[key]}
            {@const isSelected = activeCell === key}
            {@const isEditing = editingCell === key}
            {@const fmt = cell?.format}

            <td
              class="w-28 h-7 border-b border-r border-slate-200 px-2 py-1 text-slate-800 text-[11px] truncate relative cursor-cell transition-colors
                {isSelected ? 'ring-2 ring-emerald-500 ring-inset z-10' : ''}"
              style="
                background-color: {fmt?.bgColor || (isSelected ? '#ecfdf5' : '#ffffff')};
                color: {fmt?.textColor || '#1e293b'};
                font-family: {fmt?.fontFamily || 'inherit'};
                font-size: {fmt?.fontSize ? `${fmt.fontSize}pt` : 'inherit'};
                font-weight: {fmt?.bold ? 'bold' : 'normal'};
                font-style: {fmt?.italic ? 'italic' : 'normal'};
                text-decoration: {fmt?.underline ? 'underline' : 'none'};
                text-align: {fmt?.align || 'left'};
              "
              on:click={() => handleCellClick(key)}
              on:dblclick={() => handleCellDblClick(key)}
            >
              {#if isEditing}
                <!-- In-place Cell Editor -->
                <input
                  type="text"
                  bind:this={editInputRef}
                  bind:value={editInputVal}
                  on:blur={commitEdit}
                  on:keydown={handleEditKeydown}
                  class="absolute inset-0 w-full h-full px-2 bg-white text-slate-900 border-2 border-emerald-600 outline-none z-20 font-mono text-xs"
                />
              {:else}
                <div class="truncate">
                  {formatDisplayValue(cell?.computed, fmt)}
                </div>
              {/if}
            </td>
          {/each}
        </tr>
      {/each}
    </tbody>
  </table>
</div>
