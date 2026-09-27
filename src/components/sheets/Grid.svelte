<script lang="ts">
  import { createEventDispatcher, tick } from 'svelte';
  import { colToLetter, parseCoord, expandRange } from './formulaEngine';
  import FormulaSuggestions from './FormulaSuggestions.svelte';
  import FilterDropdown from './FilterDropdown.svelte';
  import { getSmartFormulaSuggestion, type FormulaDefinition } from './formulaDefinitions';
  import type {
    SheetGrid,
    CellFormatting,
    ConditionalFormatRule,
    DataValidationRule,
    MergedRange,
    SheetFilter,
    CellBorderConfig
  } from '../../types';
  import { ChevronDown, Filter, Check } from 'lucide-svelte';

  export let grid: SheetGrid;
  export let rowCount: number = 50;
  export let colCount: number = 26;
  export let activeCell: string = 'A1';
  export let conditionalRules: ConditionalFormatRule[] = [];
  export let dataValidation: DataValidationRule[] = [];
  export let mergedRanges: MergedRange[] = [];
  export let filter: SheetFilter = { enabled: false, range: '', colFilters: {} };
  export let showGridlines: boolean = true;
  export let showFormulas: boolean = false;
  export let frozenRows: number = 0;
  export let frozenCols: number = 0;
  export let zoomScale: number = 1;

  const dispatch = createEventDispatcher<{
    selectCell: { key: string; raw: string; computed: string | number };
    cellChange: { key: string; raw: string };
    cellInput: { key: string; raw: string };
    sortCol: { colIndex: number; ascending: boolean };
    updateFilter: { filter: SheetFilter };
  }>();

  let editingCell: string | null = null;
  let editInputVal: string = '';
  let editInputRef: HTMLInputElement | null = null;
  let containerRef: HTMLDivElement | null = null;
  let cellSuggestionsRef: FormulaSuggestions;

  // Filter dropdown state
  let activeFilterCol: number | null = null;

  // Data validation list picker state
  let activeValidationDropdownKey: string | null = null;

  // Pointing / Range Selection Mode State
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

  // Column resizing state
  let colWidths: Record<number, number> = {};
  let isResizingCol = false;
  let resizeColIndex = 0;
  let resizeStartX = 0;
  let resizeStartWidth = 0;

  function startColResize(colIdx: number, e: MouseEvent) {
    isResizingCol = true;
    resizeColIndex = colIdx;
    resizeStartX = e.clientX;
    resizeStartWidth = colWidths[colIdx] || 112;
  }

  // Auto-Fill Drag Handle State
  let isAutoFilling = false;
  let autoFillStartCell = "";
  let autoFillStartRow = 0;
  let autoFillStartCol = 0;
  let autoFillTargetRow = 0;

  function handleAutoFillStart(e: MouseEvent) {
    const coord = parseCoord(activeCell);
    if (!coord) return;
    isAutoFilling = true;
    autoFillStartCell = activeCell;
    autoFillStartRow = coord.row;
    autoFillStartCol = coord.col;
    autoFillTargetRow = coord.row;
  }

  function handleWindowMouseMove(e: MouseEvent) {
    if (isResizingCol) {
      const delta = e.clientX - resizeStartX;
      colWidths[resizeColIndex] = Math.max(45, resizeStartWidth + delta);
      colWidths = { ...colWidths };
    }
  }

  function applyAutoFill() {
    if (autoFillTargetRow <= autoFillStartRow) return;
    const sourceCell = grid[autoFillStartCell];
    const sourceRaw = sourceCell?.raw ?? "";

    for (let r = autoFillStartRow + 1; r <= autoFillTargetRow; r++) {
      const targetKey = getCellKey(autoFillStartCol, r);
      let filledRaw = sourceRaw;
      const rowOffset = r - autoFillStartRow;

      if (sourceRaw.startsWith("=")) {
        // Increment row numbers in formulas: e.g. =A1+B1 -> =A2+B2
        filledRaw = sourceRaw.replace(/([A-Z]+)([0-9]+)/g, (match, col, rowStr) => {
          const origRow = parseInt(rowStr, 10);
          return `${col}${origRow + rowOffset}`;
        });
      } else if (!isNaN(Number(sourceRaw)) && sourceRaw.trim() !== "") {
        filledRaw = String(Number(sourceRaw) + rowOffset);
      } else {
        const numMatch = sourceRaw.match(/^(.*?)(\d+)$/);
        if (numMatch) {
          const prefix = numMatch[1];
          const num = parseInt(numMatch[2], 10);
          filledRaw = `${prefix}${num + rowOffset}`;
        }
      }

      dispatch("cellChange", { key: targetKey, raw: filledRaw });
    }
  }

  $: smartSuggestion = editingCell ? getSmartFormulaSuggestion(editingCell, grid) : null;

  $: pointedCellKeys = (() => {
    if (!pointingState.active || !pointingState.startCell || !pointingState.currentCell) {
      return [];
    }
    const range = formatRange(pointingState.startCell, pointingState.currentCell);
    return expandRange(range);
  })();

  function isCellInRange(cellKey: string, rangeStr: string): boolean {
    if (!rangeStr) return false;
    if (!rangeStr.includes(':')) return cellKey.toUpperCase() === rangeStr.trim().toUpperCase();
    try {
      const keys = expandRange(rangeStr.trim().toUpperCase());
      return keys.includes(cellKey);
    } catch {
      return false;
    }
  }

  function getConditionalStyle(key: string, cellVal: string | number | undefined): { bgColor?: string; textColor?: string } | null {
    if (!conditionalRules || conditionalRules.length === 0 || cellVal === undefined || cellVal === null || cellVal === '') return null;
    const strVal = String(cellVal).trim();
    const numVal = typeof cellVal === 'number' ? cellVal : parseFloat(strVal.replace(/[$,%]/g, ''));

    for (const rule of conditionalRules) {
      if (isCellInRange(key, rule.range)) {
        let match = false;
        const ruleNum = parseFloat(rule.value);
        if (rule.condition === 'greaterThan' && !isNaN(numVal) && !isNaN(ruleNum)) {
          match = numVal > ruleNum;
        } else if (rule.condition === 'lessThan' && !isNaN(numVal) && !isNaN(ruleNum)) {
          match = numVal < ruleNum;
        } else if (rule.condition === 'equals') {
          match = strVal.toLowerCase() === rule.value.toLowerCase() || (!isNaN(numVal) && !isNaN(ruleNum) && numVal === ruleNum);
        } else if (rule.condition === 'contains') {
          match = strVal.toLowerCase().includes(rule.value.toLowerCase());
        } else if (rule.condition === 'notEmpty') {
          match = strVal.length > 0;
        }

        if (match) {
          return { bgColor: rule.bgColor, textColor: rule.textColor };
        }
      }
    }
    return null;
  }

  function getValidationRule(cellKey: string): DataValidationRule | undefined {
    return dataValidation.find((rule) => isCellInRange(cellKey, rule.range));
  }

  function getBorderStyles(borders?: CellBorderConfig): string {
    if (!borders) return '';
    let style = '';
    const color = borders.color || '#000000';
    const borderStyle = borders.style === 'double' ? 'double 3px' : borders.style === 'dashed' ? 'dashed 1px' : 'solid 1.5px';

    if (borders.top) style += `border-top: ${borderStyle} ${color} !important;`;
    if (borders.bottom) style += `border-bottom: ${borderStyle} ${color} !important;`;
    if (borders.left) style += `border-left: ${borderStyle} ${color} !important;`;
    if (borders.right) style += `border-right: ${borderStyle} ${color} !important;`;
    return style;
  }

  function getWrapStyles(wrapText?: 'overflow' | 'wrap' | 'clip'): string {
    if (wrapText === 'wrap') return 'white-space: normal; word-break: break-word; overflow: visible;';
    if (wrapText === 'clip') return 'white-space: nowrap; overflow: hidden; text-overflow: clip;';
    return 'white-space: nowrap; overflow: hidden; text-overflow: ellipsis;';
  }

  // Filter logic: compute set of hidden row indices
  $: hiddenRowIndices = (() => {
    const hidden = new Set<number>();
    if (!filter || !filter.enabled || !filter.colFilters) return hidden;

    for (let r = 0; r < rowCount; r++) {
      for (const [colStr, colFilter] of Object.entries(filter.colFilters)) {
        const c = parseInt(colStr, 10);
        const cell = grid[getCellKey(c, r)];
        const val = String(cell?.computed ?? '').trim();
        const numVal = parseFloat(val);

        if (colFilter.condition && colFilter.condition !== 'none') {
          if (colFilter.condition === 'empty' && val !== '') hidden.add(r);
          else if (colFilter.condition === 'notEmpty' && val === '') hidden.add(r);
          else if (colFilter.condition === 'contains' && !val.toLowerCase().includes((colFilter.conditionValue || '').toLowerCase())) hidden.add(r);
          else if (colFilter.condition === 'greaterThan' && !isNaN(numVal) && numVal <= parseFloat(colFilter.conditionValue || '0')) hidden.add(r);
          else if (colFilter.condition === 'lessThan' && !isNaN(numVal) && numVal >= parseFloat(colFilter.conditionValue || '0')) hidden.add(r);
          else if (colFilter.condition === 'equals' && val.toLowerCase() !== (colFilter.conditionValue || '').toLowerCase()) hidden.add(r);
        }

        if (colFilter.hiddenValues && colFilter.hiddenValues.includes(val)) {
          hidden.add(r);
        }
      }
    }
    return hidden;
  })();

  function getUniqueValuesForCol(colIdx: number): string[] {
    const vals = new Set<string>();
    for (let r = 0; r < rowCount; r++) {
      const key = getCellKey(colIdx, r);
      const cell = grid[key];
      vals.add(String(cell?.computed ?? ''));
    }
    return Array.from(vals);
  }

  function getCellKey(col: number, row: number): string {
    return `${colToLetter(col)}${row + 1}`;
  }

  function isExpectingReference(val: string, caretPos?: number): boolean {
    if (!val.trim().startsWith('=')) return false;
    const pos = caretPos !== undefined ? caretPos : val.length;
    const before = val.slice(0, pos);
    return /[=+*^&,(;:<>/-]\s*$/.test(before);
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
    if (isAutoFilling) {
      const coord = parseCoord(key);
      if (coord && coord.col === autoFillStartCol) {
        autoFillTargetRow = Math.max(autoFillStartRow, coord.row);
      }
      return;
    }
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
    if (isResizingCol) {
      isResizingCol = false;
    }
    if (isAutoFilling) {
      applyAutoFill();
      isAutoFilling = false;
    }
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

  export function startEditing(initialChar?: string) {
    editingCell = activeCell;
    pointingState = { active: false, startCell: '', currentCell: '', tokenIndex: 0, tokenLength: 0 };
    editInputVal = initialChar !== undefined ? initialChar : grid[activeCell]?.raw ?? '';
    tick().then(() => {
      if (editInputRef) {
        editInputRef.focus();
        const len = editInputVal.length;
        editInputRef.setSelectionRange(len, len);
      }
    });
  }

  export function commitEdit() {
    if (editingCell) {
      pointingState = { active: false, startCell: '', currentCell: '', tokenIndex: 0, tokenLength: 0 };
      let finalVal = editInputVal;
      if (finalVal.trim().startsWith('=')) {
        finalVal = autoCloseParens(finalVal);
      }
      dispatch('cellChange', { key: editingCell, raw: finalVal });
      editingCell = null;
      focusGrid();
    }
  }

  export function cancelEditing() {
    pointingState = { active: false, startCell: '', currentCell: '', tokenIndex: 0, tokenLength: 0 };
    editingCell = null;
    focusGrid();
  }

  export function setFormulaInputValue(val: string) {
    if (editingCell) {
      editInputVal = val;
    }
  }

  function toggleCheckbox(key: string, checked: boolean) {
    dispatch('cellChange', { key, raw: checked ? 'TRUE' : 'FALSE' });
  }

  function pickValidationItem(key: string, item: string) {
    dispatch('cellChange', { key, raw: item });
    activeValidationDropdownKey = null;
  }

  function navigate(deltaCol: number, deltaRow: number) {
    const coord = parseCoord(activeCell);
    if (!coord) return;
    const newCol = Math.max(0, Math.min(colCount - 1, coord.col + deltaCol));
    const newRow = Math.max(0, Math.min(rowCount - 1, coord.row + deltaRow));
    const newKey = getCellKey(newCol, newRow);
    setActiveCell(newKey);
    scrollToCell(newKey);
  }

  function handleGridKeydown(e: KeyboardEvent) {
    if (editingCell) return;

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      navigate(0, -1);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      navigate(0, 1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      navigate(-1, 0);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      navigate(1, 0);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      navigate(e.shiftKey ? -1 : 1, 0);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      startEditing();
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      dispatch('cellChange', { key: activeCell, raw: '' });
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      startEditing(e.key);
    }
  }

  function handleEditKeydown(e: KeyboardEvent) {
    const isFormula = editInputVal.trim().startsWith('=');
    const caret = editInputRef?.selectionStart ?? editInputVal.length;
    const isArrow = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key);

    if (isArrow) {
      const readyToPoint = isExpectingReference(editInputVal, caret);

      if (pointingState.active || (isFormula && readyToPoint)) {
        e.preventDefault();
        e.stopPropagation();

        const dCol = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0;
        const dRow = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0;

        if (!pointingState.active) {
          // Start pointing from the cell adjacent to activeCell in arrow direction
          const startCoord = parseCoord(activeCell);
          if (startCoord) {
            const nextCol = Math.max(0, Math.min(colCount - 1, startCoord.col + dCol));
            const nextRow = Math.max(0, Math.min(rowCount - 1, startCoord.row + dRow));
            const targetKey = getCellKey(nextCol, nextRow);
            const tokenIdx = caret;

            editInputVal = editInputVal.slice(0, tokenIdx) + targetKey + editInputVal.slice(tokenIdx);
            pointingState = {
              active: true,
              startCell: targetKey,
              currentCell: targetKey,
              tokenIndex: tokenIdx,
              tokenLength: targetKey.length,
            };

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
        } else {
          // Already in pointing mode: move current reference or expand range
          const cur = parseCoord(pointingState.currentCell) || parseCoord(activeCell);
          if (cur) {
            const nextCol = Math.max(0, Math.min(colCount - 1, cur.col + dCol));
            const nextRow = Math.max(0, Math.min(rowCount - 1, cur.row + dRow));
            const targetKey = getCellKey(nextCol, nextRow);
            pointingState.currentCell = targetKey;
            if (!e.shiftKey) {
              pointingState.startCell = targetKey;
            }
            const rangeStr = formatRange(pointingState.startCell, pointingState.currentCell);
            editInputVal =
              editInputVal.slice(0, pointingState.tokenIndex) +
              rangeStr +
              editInputVal.slice(pointingState.tokenIndex + pointingState.tokenLength);
            pointingState.tokenLength = rangeStr.length;

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
      }
    }

    // Finalize pointing if an operator or punctuation is typed
    if (pointingState.active && [',', ')', ';', '+', '-', '*', '/', '^', '&', '='].includes(e.key)) {
      pointingState = { active: false, startCell: '', currentCell: '', tokenIndex: 0, tokenLength: 0 };
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      commitEdit();
      navigate(0, e.shiftKey ? -1 : 1);
      return;
    } else if (e.key === 'Tab') {
      e.preventDefault();
      commitEdit();
      navigate(e.shiftKey ? -1 : 1, 0);
      return;
    } else if (e.key === 'Escape') {
      if (pointingState.active) {
        editInputVal =
          editInputVal.slice(0, pointingState.tokenIndex) +
          editInputVal.slice(pointingState.tokenIndex + pointingState.tokenLength);
        pointingState = { active: false, startCell: '', currentCell: '', tokenIndex: 0, tokenLength: 0 };
        dispatch('cellInput', { key: editingCell!, raw: editInputVal });
        return;
      }
      cancelEditing();
      return;
    }
  }

  function handleInputChange() {
    if (editingCell) {
      const caret = editInputRef?.selectionStart ?? editInputVal.length;
      if (pointingState.active) {
        const tokenEnd = pointingState.tokenIndex + pointingState.tokenLength;
        if (caret < pointingState.tokenIndex || caret > tokenEnd + 1) {
          pointingState = { active: false, startCell: '', currentCell: '', tokenIndex: 0, tokenLength: 0 };
        }
      }
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
      case 'currency_rounded':
        return `$${Math.round(num).toLocaleString('en-US')}`;
      case 'accounting':
        return num < 0
          ? `($ ${Math.abs(num).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`
          : `$ ${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      case 'financial':
        return num < 0
          ? `(${Math.abs(num).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`
          : num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      case 'scientific':
        return num.toExponential(2).toUpperCase();
      case 'number':
        return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      case 'percent':
        return `${(num * (num < 1 ? 100 : 1)).toFixed(2)}%`;
      case 'date':
        try {
          return new Date(num).toLocaleDateString();
        } catch {
          return String(val);
        }
      case 'time':
        try {
          return new Date(num).toLocaleTimeString();
        } catch {
          return String(val);
        }
      case 'datetime':
        try {
          const d = new Date(num);
          return `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`;
        } catch {
          return String(val);
        }
      case 'duration':
        const totalSecs = Math.round(Math.abs(num));
        const hrs = Math.floor(totalSecs / 3600);
        const mins = Math.floor((totalSecs % 3600) / 60);
        const secs = totalSecs % 60;
        return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
      case 'text':
        return String(val);
      default:
        return String(val);
    }
  }
</script>

<svelte:window on:mouseup={handleWindowMouseUp} on:mousemove={handleWindowMouseMove} />

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
  bind:this={containerRef}
  class="flex-1 overflow-auto bg-slate-200 select-none relative outline-none"
  tabindex="0"
  on:keydown={handleGridKeydown}
>
  <table class="border-collapse table-fixed bg-white text-xs" style="transform: scale({zoomScale}); transform-origin: top left;">
    <!-- Header Row (Column Letters) -->
    <thead>
      <tr class="sticky top-0 z-20 bg-slate-100 shadow-sm">
        <th class="w-12 h-6 border-b border-r border-slate-300 bg-slate-200 sticky left-0 z-30 text-slate-500 font-mono text-[10px]"></th>
        {#each Array(colCount) as _, colIdx}
          {@const isFiltered = filter?.enabled && filter?.colFilters?.[colIdx]}
          <th
            style="width: {colWidths[colIdx] || 112}px; min-width: {colWidths[colIdx] || 112}px; max-width: {colWidths[colIdx] || 112}px;"
            class="h-6 border-b border-r border-slate-300 text-slate-600 font-semibold font-mono text-center hover:bg-slate-200 transition-colors relative group"
          >
            <div class="flex items-center justify-center space-x-1 px-1">
              <span>{colToLetter(colIdx)}</span>
              {#if filter?.enabled}
                <button
                  class="p-0.5 rounded hover:bg-slate-300 text-slate-400 hover:text-slate-700 transition-colors {isFiltered ? 'text-emerald-600 font-bold' : ''}"
                  on:click|stopPropagation={() => (activeFilterCol = activeFilterCol === colIdx ? null : colIdx)}
                  title="Filter Column {colToLetter(colIdx)}"
                >
                  <Filter size={11} />
                </button>
              {/if}
            </div>

            <!-- Column Filter Dropdown Menu -->
            {#if activeFilterCol === colIdx}
              <FilterDropdown
                {colIdx}
                colLetter={colToLetter(colIdx)}
                uniqueValues={getUniqueValuesForCol(colIdx)}
                selectedValues={[]}
                activeCondition={filter?.colFilters?.[colIdx]?.condition || 'none'}
                conditionVal={filter?.colFilters?.[colIdx]?.conditionValue || ''}
                on:close={() => (activeFilterCol = null)}
                on:sortAsc={(e) => dispatch('sortCol', { colIndex: e.detail.colIndex, ascending: true })}
                on:sortDesc={(e) => dispatch('sortCol', { colIndex: e.detail.colIndex, ascending: false })}
                on:applyFilter={(e) => {
                  const newColFilters = { ...filter.colFilters };
                  newColFilters[e.detail.colIndex] = {
                    condition: e.detail.condition,
                    conditionValue: e.detail.conditionValue,
                    hiddenValues: e.detail.hiddenValues,
                  };
                  dispatch('updateFilter', { filter: { ...filter, colFilters: newColFilters } });
                }}
                on:clearFilter={(e) => {
                  const newColFilters = { ...filter.colFilters };
                  delete newColFilters[e.detail.colIndex];
                  dispatch('updateFilter', { filter: { ...filter, colFilters: newColFilters } });
                }}
              />
            {/if}

            <!-- Column Width Resizer Divider -->
            <div
              class="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-emerald-500/60 z-30 transition-colors"
              on:mousedown|stopPropagation={(e) => startColResize(colIdx, e)}
              on:dblclick|stopPropagation={() => {
                colWidths[colIdx] = 112;
                colWidths = { ...colWidths };
              }}
              title="Drag to resize column (Double-click to reset)"
            ></div>
          </th>
        {/each}
      </tr>
    </thead>

    <!-- Data Rows -->
    <tbody>
      {#each Array(rowCount) as _, rowIdx}
        {#if !hiddenRowIndices.has(rowIdx)}
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
              {@const isPointed = pointedCellKeys.includes(key)}
              {@const isPointHead = pointingState.active && (pointingState.currentCell === key || pointingState.startCell === key)}
              {@const fmt = cell?.format}
              {@const condStyle = getConditionalStyle(key, cell?.computed)}
              {@const validationRule = getValidationRule(key)}
              {@const borderStyle = getBorderStyles(fmt?.borders)}
              {@const wrapStyle = getWrapStyles(fmt?.wrapText)}

              {@const isAutoFillTarget = isAutoFilling && colIdx === autoFillStartCol && rowIdx > autoFillStartRow && rowIdx <= autoFillTargetRow}
              <td
                data-cell={key}
                class="h-7 {showGridlines ? 'border-b border-r border-slate-200' : 'border-b border-r border-transparent'} px-2 py-1 text-slate-800 text-[11px] relative cursor-cell transition-all
                  {isAutoFillTarget ? "border-dashed border-2 border-emerald-600 bg-emerald-50/50" : ""}
                  {isSelected && !isEditing ? 'ring-2 ring-emerald-500 ring-inset z-10' : ''}
                  {isPointed ? 'ring-2 ring-blue-500 ring-offset-0 bg-blue-100/40 z-20 font-semibold text-blue-950' : ''}
                  {isPointHead ? 'ring-2 ring-blue-600 bg-blue-200/50' : ''}"
                style="
                  width: {colWidths[colIdx] || 112}px; min-width: {colWidths[colIdx] || 112}px; max-width: {colWidths[colIdx] || 112}px;
                  background-color: {isPointed ? 'rgba(219, 234, 254, 0.45)' : (condStyle?.bgColor || fmt?.bgColor || (isSelected && !isEditing ? '#ecfdf5' : '#ffffff'))};
                  color: {condStyle?.textColor || fmt?.textColor || '#1e293b'};
                  font-family: {fmt?.fontFamily || 'inherit'};
                  font-size: {fmt?.fontSize ? `${fmt.fontSize}pt` : 'inherit'};
                  font-weight: {fmt?.bold ? 'bold' : 'normal'};
                  font-style: {fmt?.italic ? 'italic' : 'normal'};
                  text-decoration: {fmt?.underline ? 'underline' : 'none'};
                  text-align: {fmt?.align || 'left'};
                  vertical-align: {fmt?.verticalAlign || 'middle'};
                  transform: {fmt?.rotation === 'tilt_up' ? 'rotate(-45deg)' : fmt?.rotation === 'tilt_down' ? 'rotate(45deg)' : fmt?.rotation === 'vertical' ? 'rotate(-90deg)' : 'none'};
                  {borderStyle}
                  {wrapStyle}
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

                  <!-- Floating Formula Suggestion Box -->
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
                  {#if isSelected && !isEditing}
                    <!-- Auto-Fill Drag Handle (Google Sheets & Excel style) -->
                    <div
                      class="autofill-handle absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-emerald-600 border border-white cursor-crosshair z-30 shadow-2xs hover:scale-125 transition-transform rounded-2xs"
                      on:mousedown|stopPropagation={handleAutoFillStart}
                      title="Drag down to auto-fill formula or sequence"
                    ></div>
                  {/if}

                  <!-- Display Value / Interactive Checkbox / Dropdown Item -->
                  {#if validationRule?.criteria === 'checkbox'}
                    <div class="flex items-center justify-center h-full">
                      <input
                        type="checkbox"
                        checked={String(cell?.raw).toUpperCase() === 'TRUE' || cell?.computed === true}
                        on:change={(e) => toggleCheckbox(key, (e.target as HTMLInputElement).checked)}
                        class="w-4 h-4 accent-emerald-600 cursor-pointer"
                      />
                    </div>
                  {:else}
                    <div class="flex items-center justify-between h-full">
                      <span class="truncate">
                        {showFormulas ? (cell?.raw ?? '') : formatDisplayValue(cell?.computed, fmt)}
                      </span>
                      {#if validationRule?.criteria === 'list' && validationRule.options}
                        <button
                          class="p-0.5 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-700 ml-1"
                          on:click|stopPropagation={() => {
                            activeValidationDropdownKey = activeValidationDropdownKey === key ? null : key;
                          }}
                          title="Choose from dropdown"
                        >
                          <ChevronDown size={11} />
                        </button>
                      {/if}
                    </div>

                    <!-- List Validation Dropdown Picker -->
                    {#if activeValidationDropdownKey === key && validationRule?.options}
                      <!-- svelte-ignore a11y_click_events_have_key_events -->
                      <!-- svelte-ignore a11y_no_static_element_interactions -->
                      <div
                        class="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-xl border border-slate-200 py-1 z-50 min-w-[120px] max-h-48 overflow-y-auto text-xs text-slate-800 animate-in fade-in zoom-in-95 duration-100"
                        on:click|stopPropagation
                      >
                        {#each validationRule.options as opt}
                          <button
                            class="w-full text-left px-3 py-1.5 hover:bg-emerald-50 hover:text-emerald-700 transition-colors flex items-center justify-between text-[11px]"
                            on:click={() => pickValidationItem(key, opt)}
                          >
                            <span>{opt}</span>
                            {#if String(cell?.raw) === opt}
                              <Check size={12} class="text-emerald-600" />
                            {/if}
                          </button>
                        {/each}
                      </div>
                    {/if}
                  {/if}
                {/if}
              </td>
            {/each}
          </tr>
        {/if}
      {/each}
    </tbody>
  </table>
</div>
