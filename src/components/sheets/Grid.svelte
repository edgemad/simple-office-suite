<script lang="ts">
  import { createEventDispatcher, tick, onMount } from 'svelte';
  import { colToLetter, parseCoord, expandRange } from './formulaEngine';
  import FormulaSuggestions from './FormulaSuggestions.svelte';
  import { getSmartFormulaSuggestion, type FormulaDefinition } from './formulaDefinitions';
  import type { SheetGrid, CellFormatting, ConditionalFormatRule, CellRect } from '../../types';
  import { borderCss, type BorderStyle } from '$lib/spreadsheetOps';
  import { getCellKey } from '$lib/cellKey';
  import {
    buildMergeIndex,
    buildRuleIndexByRow,
    hiddenRowSet,
    rulesForCell,
    styleForCell,
    type ConditionalRule,
  } from '$lib/gridIndex';

  export let grid: SheetGrid;
  export let rowCount: number = 50;
  export let colCount: number = 26;
  export let activeCell: string = 'A1';
  export let conditionalRules: ConditionalFormatRule[] = [];
  export let hiddenRows: number[] = [];
  export let frozenRows: number = 0;
  export let mergedRanges: CellRect[] = [];


  const dispatch = createEventDispatcher<{
    selectCell: { key: string; raw: string; computed: string | number };
    cellChange: { key: string; raw: string };
    cellInput: { key: string; raw: string };
    rangeSelect: { start: string; end: string; keys: string[] };
  }>();

  let mounted = false;
  let editingCell: string | null = null;
  let editInputVal: string = '';
  let editInputRef: HTMLInputElement | null = null;
  let containerRef: HTMLDivElement | null = null;
  let cellSuggestionsRef: FormulaSuggestions;

  // Pointing / Range Selection Mode State (Excel & OnlyOffice Style)
  interface PointingState {
    active: boolean;
    startCell: string;
    currentCell: string;
    tokenIndex: number;
    tokenLength: number;
  }

  let pointingState: PointingState = {
    active: false,
    startCell: '',
    currentCell: '',
    tokenIndex: 0,
    tokenLength: 0,
  };

  let isMouseDraggingRange = false;

  $: smartSuggestion = editingCell ? getSmartFormulaSuggestion(editingCell, grid) : null;

  // The render loop runs for every cell, so anything it needs is precomputed
  // into a Set/Map here rather than scanned linearly per cell.
  $: pointedSet = new Set(
    pointingState.active && pointingState.startCell && pointingState.currentCell
      ? expandRange(formatRange(pointingState.startCell, pointingState.currentCell))
      : []
  );
  $: mergeIndex = buildMergeIndex(mergedRanges);
  $: hiddenSet = hiddenRowSet(hiddenRows);
  // Rebuilt only when the rules change — not on every keystroke, since the
  // rule-to-row mapping does not depend on cell values.
  $: ruleIndex = buildRuleIndexByRow((conditionalRules ?? []) as ConditionalRule[]);

  onMount(() => {
    mounted = true;
  });

  $: if (mounted) {
    emitRange(pointingState.active && pointingState.startCell ? pointingState.startCell : activeCell, activeCell);
  }

  function emitRange(startKey: string, endKey: string) {
    const keys = startKey === endKey ? [startKey] : expandRange(formatRange(startKey, endKey));
    dispatch('rangeSelect', { start: startKey, end: endKey, keys });
  }


  function isExpectingReference(val: string, caretPos?: number): boolean {
    if (!val.trim().startsWith('=')) return false;
    const pos = caretPos !== undefined ? caretPos : val.length;
    const before = val.slice(0, pos);
    return /[=+\-*/^&,(;:<>]\s*$/.test(before);
  }

  function formatRange(startKey: string, endKey: string): string {
    if (startKey === endKey) return startKey;
    const start = parseCoord(startKey);
    const end = parseCoord(endKey);
    if (!start || !end) return `${startKey}:${endKey}`;

    const minCol = Math.min(start.col, end.col);
    const maxCol = Math.max(start.col, end.col);
    const minRow = Math.min(start.row, end.row);
    const maxRow = Math.max(start.row, end.row);

    const topLeft = `${colToLetter(minCol)}${minRow + 1}`;
    const bottomRight = `${colToLetter(maxCol)}${maxRow + 1}`;
    return `${topLeft}:${bottomRight}`;
  }

  function autoCloseParens(val: string): string {
    let openCount = 0;
    let inQuotes = false;
    for (let i = 0; i < val.length; i++) {
      const ch = val[i];
      if (ch === '"') inQuotes = !inQuotes;
      else if (!inQuotes) {
        if (ch === '(') openCount++;
        else if (ch === ')') openCount = Math.max(0, openCount - 1);
      }
    }
    if (openCount > 0) {
      return val + ')'.repeat(openCount);
    }
    return val;
  }

  function handleCellClick(key: string) {
    if (editingCell && editingCell !== key) {
      commitEdit();
    }
    setActiveCell(key);
    focusGrid();
  }

  function handleCellMouseDown(e: MouseEvent, key: string) {
    if (editingCell) {
      const isFormula = editInputVal.trim().startsWith('=');
      const caret = editInputRef?.selectionStart ?? editInputVal.length;
      const readyToPoint = isExpectingReference(editInputVal, caret);

      if (isFormula && (pointingState.active || readyToPoint)) {
        e.preventDefault();
        isMouseDraggingRange = true;

        if (!pointingState.active) {
          const tokenIdx = caret;
          const rangeStr = key;
          editInputVal = editInputVal.slice(0, tokenIdx) + rangeStr + editInputVal.slice(tokenIdx);
          pointingState = {
            active: true,
            startCell: key,
            currentCell: key,
            tokenIndex: tokenIdx,
            tokenLength: rangeStr.length,
          };
        } else {
          pointingState.startCell = key;
          pointingState.currentCell = key;
          editInputVal =
            editInputVal.slice(0, pointingState.tokenIndex) +
            key +
            editInputVal.slice(pointingState.tokenIndex + pointingState.tokenLength);
          pointingState.tokenLength = key.length;
        }

        tick().then(() => {
          if (editInputRef) {
            const p = pointingState.tokenIndex + pointingState.tokenLength;
            editInputRef.setSelectionRange(p, p);
          }
        });
        scrollToCell(key);
        dispatch('cellInput', { key: editingCell, raw: editInputVal });
        return;
      }
    }

    handleCellClick(key);
  }

  function handleCellMouseEnter(key: string) {
    if (isMouseDraggingRange && pointingState.active && editingCell) {
      pointingState.currentCell = key;
      const newRangeStr = formatRange(pointingState.startCell, pointingState.currentCell);
      editInputVal =
        editInputVal.slice(0, pointingState.tokenIndex) +
        newRangeStr +
        editInputVal.slice(pointingState.tokenIndex + pointingState.tokenLength);
      pointingState.tokenLength = newRangeStr.length;

      tick().then(() => {
        if (editInputRef) {
          const p = pointingState.tokenIndex + pointingState.tokenLength;
          editInputRef.setSelectionRange(p, p);
        }
      });
      scrollToCell(key);
      dispatch('cellInput', { key: editingCell, raw: editInputVal });
    }
  }

  function handleWindowMouseUp() {
    if (isMouseDraggingRange) {
      isMouseDraggingRange = false;
      editInputRef?.focus();
    }
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
    pointingState = { active: false, startCell: '', currentCell: '', tokenIndex: 0, tokenLength: 0 };
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
    pointingState = { active: false, startCell: '', currentCell: '', tokenIndex: 0, tokenLength: 0 };
    focusGrid();
  }

  export function commitEdit() {
    if (editingCell) {
      let finalVal = editInputVal;
      if (finalVal.trim().startsWith('=')) {
        finalVal = autoCloseParens(finalVal);
      }
      dispatch('cellChange', { key: editingCell, raw: finalVal });
      editingCell = null;
      pointingState = { active: false, startCell: '', currentCell: '', tokenIndex: 0, tokenLength: 0 };
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
    const isArrow = e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight';
    const isFormula = editInputVal.trim().startsWith('=');

    if (isFormula) {
      // 1. If formula autocomplete suggestions list is open before '('
      if (cellSuggestionsRef && !editInputVal.includes('(')) {
        if (e.key === 'ArrowDown' && cellSuggestionsRef.moveSelection(1)) {
          e.preventDefault();
          return;
        } else if (e.key === 'ArrowUp' && cellSuggestionsRef.moveSelection(-1)) {
          e.preventDefault();
          return;
        }
      }

      // 2. Point Mode Range Selection with Arrow Keys (e.g. after =sum( or operators)
      const caret = editInputRef?.selectionStart ?? editInputVal.length;
      const readyToPoint = isExpectingReference(editInputVal, caret);

      if (isArrow && (pointingState.active || readyToPoint)) {
        e.preventDefault();
        const dCol = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        const dRow = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0;

        if (!pointingState.active) {
          // Pointing starts! Anchor at adjacent cell from active cell being edited
          const originCoord = parseCoord(editingCell!);
          if (!originCoord) return;
          const targetCol = Math.max(0, Math.min(colCount - 1, originCoord.col + dCol));
          const targetRow = Math.max(0, Math.min(rowCount - 1, originCoord.row + dRow));
          const targetKey = getCellKey(targetCol, targetRow);

          const tokenIdx = caret;
          const rangeStr = targetKey;

          editInputVal = editInputVal.slice(0, tokenIdx) + rangeStr + editInputVal.slice(tokenIdx);
          pointingState = {
            active: true,
            startCell: targetKey,
            currentCell: targetKey,
            tokenIndex: tokenIdx,
            tokenLength: rangeStr.length,
          };

          tick().then(() => {
            if (editInputRef) {
              const p = tokenIdx + rangeStr.length;
              editInputRef.setSelectionRange(p, p);
            }
          });
          scrollToCell(targetKey);
          dispatch('cellInput', { key: editingCell!, raw: editInputVal });
          return;
        } else {
          // Already in pointing mode: move head cell, or expand range if Shift is pressed
          const headCoord = parseCoord(pointingState.currentCell);
          if (!headCoord) return;
          const targetCol = Math.max(0, Math.min(colCount - 1, headCoord.col + dCol));
          const targetRow = Math.max(0, Math.min(rowCount - 1, headCoord.row + dRow));
          const targetKey = getCellKey(targetCol, targetRow);

          if (e.shiftKey) {
            // Expand range with Shift
            pointingState.currentCell = targetKey;
          } else {
            // Move single-cell reference without Shift
            pointingState.startCell = targetKey;
            pointingState.currentCell = targetKey;
          }

          const newRangeStr = formatRange(pointingState.startCell, pointingState.currentCell);
          editInputVal =
            editInputVal.slice(0, pointingState.tokenIndex) +
            newRangeStr +
            editInputVal.slice(pointingState.tokenIndex + pointingState.tokenLength);
          pointingState.tokenLength = newRangeStr.length;

          tick().then(() => {
            if (editInputRef) {
              const p = pointingState.tokenIndex + pointingState.tokenLength;
              editInputRef.setSelectionRange(p, p);
            }
          });
          scrollToCell(targetKey);
          dispatch('cellInput', { key: editingCell!, raw: editInputVal });
          return;
        }
      }

      // 3. Autocomplete tab/enter handling
      if (e.key === 'Tab') {
        if (smartSuggestion && (editInputVal === '=' || editInputVal.trim() === '')) {
          e.preventDefault();
          editInputVal = smartSuggestion;
          dispatch('cellInput', { key: editingCell!, raw: editInputVal });
          return;
        }
        const selected = cellSuggestionsRef?.getSelectedFormula();
        if (selected && !editInputVal.includes('(')) {
          e.preventDefault();
          editInputVal = `=${selected.name}(`;
          dispatch('cellInput', { key: editingCell!, raw: editInputVal });
          return;
        }
      } else if (e.key === 'Enter') {
        const selected = cellSuggestionsRef?.getSelectedFormula();
        if (selected && !editInputVal.includes('(')) {
          e.preventDefault();
          editInputVal = `=${selected.name}(`;
          dispatch('cellInput', { key: editingCell!, raw: editInputVal });
          return;
        }
      }

      // 4. If typing an operator or delimiter, exit active pointing token so next reference can be pointed
      if (['+', '-', '*', '/', '^', '&', '=', '<', '>', ',', '(', ')', ';', ':'].includes(e.key)) {
        pointingState.active = false;
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
      if (pointingState.active) {
        // Revert pointed token and exit pointing
        editInputVal =
          editInputVal.slice(0, pointingState.tokenIndex) +
          editInputVal.slice(pointingState.tokenIndex + pointingState.tokenLength);
        pointingState = { active: false, startCell: '', currentCell: '', tokenIndex: 0, tokenLength: 0 };
        dispatch('cellInput', { key: editingCell!, raw: editInputVal });
        return;
      }
      cancelEditing();
    }
  }

  function handleInputChange() {
    pointingState.active = false;
    if (editingCell) {
      dispatch('cellInput', { key: editingCell, raw: editInputVal });
    }
  }

  function handleSuggestionSelect(e: CustomEvent<{ formula: FormulaDefinition; completedText: string }>) {
    editInputVal = e.detail.completedText;
    pointingState.active = false;
    editInputRef?.focus();
    if (editingCell) {
      dispatch('cellInput', { key: editingCell, raw: editInputVal });
    }
  }

  function handleAcceptSmart(e: CustomEvent<string>) {
    editInputVal = e.detail;
    pointingState.active = false;
    editInputRef?.focus();
    if (editingCell) {
      dispatch('cellInput', { key: editingCell, raw: editInputVal });
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

<svelte:window on:mouseup={handleWindowMouseUp} />

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
        {#if !hiddenSet.has(rowIdx)}
        <tr class="hover:bg-slate-50/50 {rowIdx < frozenRows ? 'sticky top-6 z-10 bg-white' : ''}">
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
            {@const isPointed = pointedSet.has(key)}
            {@const isPointHead = pointingState.active && (pointingState.currentCell === key || pointingState.startCell === key)}
            {@const fmt = cell?.format}
            {@const condStyle = styleForCell(rulesForCell(ruleIndex, colIdx, rowIdx), cell?.computed)}
            {@const mergeEntry = mergeIndex.get(key)}
            {@const covered = mergeIndex.has(key) && mergeEntry === null}
            {@const span = mergeEntry ?? null}
            {#if !covered}
            <td
              data-cell={key}
              rowspan={span?.rowspan ?? 1}
              colspan={span?.colspan ?? 1}
              class="w-28 min-h-[28px] border-b border-r border-slate-200 px-2 py-1 text-slate-800 text-[11px] {fmt?.wrap ? '' : 'truncate'} relative cursor-cell transition-all align-top
                {isSelected && !isEditing ? 'ring-2 ring-emerald-500 ring-inset z-10' : ''}
                {isPointed ? 'ring-2 ring-blue-500 ring-offset-0 bg-blue-100/40 z-20 font-semibold text-blue-950' : ''}
                {isPointHead ? 'ring-2 ring-blue-600 bg-blue-200/50' : ''}
                {fmt?.invalid ? 'ring-2 ring-rose-500 ring-inset' : ''}"
              style="
                background-color: {isPointed ? 'rgba(219, 234, 254, 0.45)' : (condStyle?.bgColor || fmt?.bgColor || (isSelected && !isEditing ? '#ecfdf5' : '#ffffff'))};
                color: {condStyle?.textColor || fmt?.textColor || '#1e293b'};
                font-family: {fmt?.fontFamily || 'inherit'};
                font-size: {fmt?.fontSize ? `${fmt.fontSize}pt` : 'inherit'};
                font-weight: {fmt?.bold ? 'bold' : 'normal'};
                font-style: {fmt?.italic ? 'italic' : 'normal'};
                text-decoration: {fmt?.underline ? 'underline' : 'none'};
                text-align: {fmt?.align || 'left'};
                white-space: {fmt?.wrap ? 'pre-wrap' : 'nowrap'};
                {borderCss(fmt?.border as BorderStyle | undefined)}
              "
              on:mousedown={(e) => handleCellMouseDown(e, key)}
              on:mouseenter={() => handleCellMouseEnter(key)}
              on:dblclick={() => startEditing()}
            >
              {#if isEditing}
                <!-- In-place Cell Editor -->
                <input
                  type="text"
                  bind:this={editInputRef}
                  bind:value={editInputVal}
                  on:input={handleInputChange}
                  on:blur={() => {
                    setTimeout(() => {
                      if (editingCell && !isMouseDraggingRange && !pointingState.active) {
                        commitEdit();
                      }
                    }, 150);
                  }}
                  on:keydown={handleEditKeydown}
                  class="absolute inset-0 w-full h-full px-2 bg-white text-slate-900 border-2 border-emerald-600 outline-none z-30 font-mono text-xs shadow-md"
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
            {/if}
          {/each}
        </tr>
        {/if}
      {/each}
    </tbody>
  </table>
</div>
