<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { FunctionSquare, Check, X, Sparkles } from 'lucide-svelte';
  import FormulaSuggestions from './FormulaSuggestions.svelte';
  import InsertFunctionModal from './InsertFunctionModal.svelte';
  import { getSmartFormulaSuggestion, type FormulaDefinition } from './formulaDefinitions';
  import type { SheetGrid } from '../../types';

  export let activeCell: string = 'A1';
  export let rawValue: string = '';
  export let grid: SheetGrid = {};

  const dispatch = createEventDispatcher<{
    commit: string;
    cancel: void;
  }>();

  let inputVal = rawValue;
  let showInsertModal = false;
  let suggestionsRef: FormulaSuggestions;
  let inputRef: HTMLInputElement | null = null;
  let isFocused = false;

  $: inputVal = rawValue;
  $: smartSuggestion = getSmartFormulaSuggestion(activeCell, grid);

  function handleKeydown(e: KeyboardEvent) {
    if (inputVal.trim().startsWith('=')) {
      if (e.key === 'ArrowDown') {
        if (suggestionsRef?.moveSelection(1)) {
          e.preventDefault();
          return;
        }
      } else if (e.key === 'ArrowUp') {
        if (suggestionsRef?.moveSelection(-1)) {
          e.preventDefault();
          return;
        }
      } else if (e.key === 'Tab') {
        // Smart suggestion or selected formula autocomplete
        if (smartSuggestion && (inputVal === '=' || inputVal.trim() === '')) {
          e.preventDefault();
          inputVal = smartSuggestion;
          return;
        }
        const selected = suggestionsRef?.getSelectedFormula();
        if (selected) {
          e.preventDefault();
          inputVal = `=${selected.name}(`;
          return;
        }
      } else if (e.key === 'Enter') {
        // If an autocomplete item is visible and not inside function args, accept it
        const selected = suggestionsRef?.getSelectedFormula();
        if (selected && !inputVal.includes('(')) {
          e.preventDefault();
          inputVal = `=${selected.name}(`;
          return;
        }
      }
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      let finalVal = inputVal;
      if (finalVal.trim().startsWith('=')) {
        let openCount = 0;
        let inQuotes = false;
        for (let i = 0; i < finalVal.length; i++) {
          const ch = finalVal[i];
          if (ch === '"') inQuotes = !inQuotes;
          else if (!inQuotes) {
            if (ch === '(') openCount++;
            else if (ch === ')') openCount = Math.max(0, openCount - 1);
          }
        }
        if (openCount > 0) finalVal += ')'.repeat(openCount);
      }
      dispatch('commit', finalVal);
      isFocused = false;
    } else if (e.key === 'Escape') {
      inputVal = rawValue;
      dispatch('cancel');
      isFocused = false;
    }
  }

  function handleFormulaSelect(e: CustomEvent<{ formula: FormulaDefinition; completedText: string }>) {
    inputVal = e.detail.completedText;
    inputRef?.focus();
  }

  function handleAcceptSmart(e: CustomEvent<string>) {
    inputVal = e.detail;
    inputRef?.focus();
  }

  function handleInsertFromModal(e: CustomEvent<string>) {
    inputVal = e.detail;
    showInsertModal = false;
    dispatch('commit', inputVal);
  }
</script>

<div class="h-9 bg-white border-b border-slate-200 px-3 flex items-center space-x-2 select-none text-xs relative z-30">
  <!-- Active Cell Coordinate Badge -->
  <div class="w-14 h-6 px-2 bg-slate-100 border border-slate-300 rounded text-slate-800 font-mono font-semibold flex items-center justify-center shadow-inner text-xs">
    {activeCell}
  </div>

  <!-- OnlyOffice Style 'fx' Function Insert Button -->
  <button
    class="flex items-center space-x-1 px-2 py-1 rounded bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border border-slate-200 transition-colors font-mono font-bold text-xs shadow-2xs"
    on:click={() => (showInsertModal = true)}
    title="Insert Function (fx)"
  >
    <FunctionSquare size={14} class="text-emerald-600" />
    <span class="italic font-serif">fx</span>
  </button>

  <!-- Formula Input with Integrated OnlyOffice Autocomplete -->
  <div class="flex-1 flex items-center space-x-1 relative">
    <input
      bind:this={inputRef}
      type="text"
      bind:value={inputVal}
      on:focus={() => (isFocused = true)}
      on:blur={() => {
        // Delay blur to allow suggestion click
        setTimeout(() => {
          isFocused = false;
          if (inputVal !== rawValue) {
            dispatch('commit', inputVal);
          }
        }, 150);
      }}
      on:keydown={handleKeydown}
      placeholder="Enter value or formula (e.g. =SUM(B2:B10), =AVERAGE, =COUNTIF, =IF)"
      class="w-full h-7 px-2.5 bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded text-xs font-mono text-slate-900 outline-none transition-colors"
    />

    <!-- OnlyOffice Floating Formula Suggestion Tooltip/Dropdown -->
    {#if isFocused && inputVal.trim().startsWith('=')}
      <div class="absolute left-0 top-8 z-50">
        <FormulaSuggestions
          bind:this={suggestionsRef}
          inputValue={inputVal}
          {smartSuggestion}
          on:select={handleFormulaSelect}
          on:acceptSmartSuggestion={handleAcceptSmart}
        />
      </div>
    {/if}

    {#if inputVal !== rawValue}
      <button
        class="p-1 rounded hover:bg-emerald-50 text-emerald-600 transition-colors"
        on:mousedown|preventDefault={() => dispatch('commit', inputVal)}
        title="Accept Formula (Enter)"
      >
        <Check size={14} />
      </button>
      <button
        class="p-1 rounded hover:bg-rose-50 text-rose-600 transition-colors"
        on:mousedown|preventDefault={() => {
          inputVal = rawValue;
          dispatch('cancel');
        }}
        title="Cancel Formula Edit (Esc)"
      >
        <X size={14} />
      </button>
    {/if}
  </div>
</div>

<!-- OnlyOffice Insert Function Modal Dialog -->
{#if showInsertModal}
  <InsertFunctionModal
    on:insert={handleInsertFromModal}
    on:close={() => (showInsertModal = false)}
  />
{/if}
