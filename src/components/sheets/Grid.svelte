<script lang="ts">
  import { createEventDispatcher, tick } from 'svelte';
  import { colToLetter, parseCoord } from './formulaEngine';
  import FormulaSuggestions from './FormulaSuggestions.svelte';
  import { getSmartFormulaSuggestion, type FormulaDefinition } from './formulaDefinitions';
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
  let containerRef: HTMLDivElement | null = null;
  let cellSuggestionsRef: FormulaSuggestions;

  $: smartSuggestion = editingCell ? getSmartFormulaSuggestion(editingCell, grid) : null;

  function getCellKey(col: number, row: number): string {
    return `${colToLetter(col)}${row + 1}`;
  }

  function handleCellClick(key: string) {
    if (editingCell && editingCell !== key) {
      commitEdit();
    }
    setActiveCell(key);
    focusGrid();
  }

  export function setActiveCell(key: string) {
    activeCell = key;
    const cell = grid[key];
    dispatch('selectCell', {
      key,
      raw: cell?.raw ?? '',
      computed: cell?.computed ?? '',
    });
  }

  export function scrollToCell(key: string) {
    const el = document.querySelector(`td[data-cell="${key}"]`);
    if (el) {
      (el as HTMLElement).scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }

  export function focusGrid() {
    containerRef?.focus();
  }

  export function isEditing(): boolean {
    return editingCell !== null;
  }

  export function getEditInputRef(): HTMLInputElement | null {
    return editInputRef;
  }

  export async function startEditing(initialChar?: string) {
    editingCell = activeCell;
    editInputVal = initialChar !== undefined ? initialChar : (grid[activeCell]?.raw ?? '');
    await tick();
    if (editInputRef) {
      editInputRef.focus();
      if (initialChar !== undefined) {
        editInputRef.setSelectionRange(initialChar.length, initialChar.length);
      } else {
        editInputRef.select();
      }
    }
  }

  export function cancelEditing() {
    editingCell = null;
    focusGrid();
  }

  export function commitEdit() {
    if (editingCell) {
      dispatch('cellChange', { key: editingCell, raw: editInputVal });
      editingCell = null;
      focusGrid();
    }
  }

  export function navigate(dCol: number, dRow: number) {
    if (editingCell) {
      commitEdit();
    }
    const coord = parseCoord(activeCell);
    if (!coord) return;
    const newCol = Math.max(0, Math.min(colCount - 1, coord.col + dCol));
    const newRow = Math.max(0, Math.min(rowCount - 1, coord.row + dRow));
    const newKey = getCellKey(newCol, newRow);
    setActiveCell(newKey);
    scrollToCell(newKey);
  }

  function handleEditKeydown(e: KeyboardEvent) {
    const isFormula = editInputVal.trim().startsWith('=');

    if (isFormula) {
      if (e.key === 'ArrowDown') {
        if (cellSuggestionsRef?.moveSelection(1)) {
          e.preventDefault();
          return;
        }
      } else if (e.key === 'ArrowUp') {
        if (cellSuggestionsRef?.moveSelection(-1)) {
          e.preventDefault();
          return;
        }
      } else if (e.key === 'Tab') {
        // Smart suggestion or autocomplete formula insertion
        if (smartSuggestion && (editInputVal === '=' || editInputVal.trim() === '')) {
          e.preventDefault();
          editInputVal = smartSuggestion;
          return;
        }
        const selected = cellSuggestionsRef?.getSelectedFormula();
        if (selected) {
          e.preventDefault();
          editInputVal = `=${selected.name}(`;
          return;
        }
      } else if (e.key === 'Enter') {
        const selected = cellSuggestionsRef?.getSelectedFormula();
        if (selected && !editInputVal.includes('(')) {
          e.preventDefault();
          editInputVal = `=${selected.name}(`;
          return;
        }
      }
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      commitEdit();
      navigate(0, e.shiftKey ? -1 : 1);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      commitEdit();
      navigate(e.shiftKey ? -1 : 1, 0);
    } else if (e.key === 'Escape') {
      cancelEditing();
    }
  }

  function handleSuggestionSelect(e: CustomEvent<{ formula: FormulaDefinition; completedText: string }>) {
    editInputVal = e.detail.completedText;
    editInputRef?.focus();
  }

  function handleAcceptSmart(e: CustomEvent<string>) {
    editInputVal = e.detail;
    editInputRef?.focus();
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
  bind:this={containerRef}
  class="flex-1 overflow-auto bg-slate-200 select-none relative outline-none"
  tabindex="0"
>
  <table class="border-collapse table-fixed bg-white text-xs">
    <!-- Header Row (Column Letters) - OnlyOffice Style -->
    <thead>
      <tr class="sticky top-0 z-20 bg-slate-100 shadow-sm">
        <th class="w-12 h-6 border-b border-r border-slate-300 bg-slate-200 sticky left-0 z-30 text-slate-500 font-mono text-[10px]"></th>
        {#each Array(colCount) as _, colIdx}
          <th class="w-28 h-6 border-b border-r border-slate-300 text-slate-600 font-semibold font-mono text-center hover:bg-slate-200 transition-colors">
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
              data-cell={key}
              class="w-28 h-7 border-b border-r border-slate-200 px-2 py-1 text-slate-800 text-[11px] truncate relative cursor-cell transition-colors
                {isSelected ? 'ring-2 ring-emerald-500 ring-inset z-10' : ''}"
              style="
                background-color: {fmt?.bgColor || (isSelected ? '#ecfdf5' : '#ffffff')};
                color: {fmt?.textColor || '#1e293b'};\
                font-family: {fmt?.fontFamily || 'inherit'};
                font-size: {fmt?.fontSize ? `${fmt.fontSize}pt` : 'inherit'};
                font-weight: {fmt?.bold ? 'bold' : 'normal'};
                font-style: {fmt?.italic ? 'italic' : 'normal'};
                text-decoration: {fmt?.underline ? 'underline' : 'none'};
                text-align: {fmt?.align || 'left'};
              "
              on:click={() => handleCellClick(key)}
              on:dblclick={() => startEditing()}
            >
              {#if isEditing}
                <!-- In-place Cell Editor -->
                <input
                  type="text"
                  bind:this={editInputRef}
                  bind:value={editInputVal}
                  on:blur={() => {
                    // Small delay to allow clicking suggestion items
                    setTimeout(() => {
                      if (editingCell) commitEdit();
                    }, 150);
                  }}
                  on:keydown={handleEditKeydown}
                  class="absolute inset-0 w-full h-full px-2 bg-white text-slate-900 border-2 border-emerald-600 outline-none z-20 font-mono text-xs shadow-md"
                />

                <!-- OnlyOffice In-Cell Floating Formula Suggestion Box -->
                {#if editInputVal.trim().startsWith('=')}
                  <div class="absolute left-0 top-full mt-1 z-40">
                    <FormulaSuggestions
                      bind:this={cellSuggestionsRef}
                      inputValue={editInputVal}
                      {smartSuggestion}
                      on:select={handleSuggestionSelect}
                      on:acceptSmartSuggestion={handleAcceptSmart}
                    />
                  </div>
                {/if}
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
