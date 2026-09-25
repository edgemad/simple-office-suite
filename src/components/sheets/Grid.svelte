<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { colToLetter } from './formulaEngine';
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

  function getCellKey(col: number, row: number): string {
    return `${colToLetter(col)}${row + 1}`;
  }

  function handleCellClick(key: string) {
    if (editingCell && editingCell !== key) {
      commitEdit();
    }
    activeCell = key;
    const cell = grid[key];
    dispatch('selectCell', {
      key,
      raw: cell?.raw ?? '',
      computed: cell?.computed ?? '',
    });
  }

  function handleCellDblClick(key: string) {
    activeCell = key;
    editingCell = key;
    editInputVal = grid[key]?.raw ?? '';
  }

  function commitEdit() {
    if (editingCell) {
      dispatch('cellChange', { key: editingCell, raw: editInputVal });
      editingCell = null;
    }
  }

  function handleEditKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      commitEdit();
    } else if (e.key === 'Escape') {
      editingCell = null;
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

<div class="flex-1 overflow-auto bg-slate-200 select-none relative">
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
                  bind:value={editInputVal}
                  on:blur={commitEdit}
                  on:keydown={handleEditKeydown}
                  class="absolute inset-0 w-full h-full px-2 bg-white text-slate-900 border-2 border-emerald-600 outline-none z-20"
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
