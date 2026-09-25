<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { FunctionSquare, Check, X, ChevronDown } from 'lucide-svelte';

  export let activeCell: string = 'A1';
  export let rawValue: string = '';

  const dispatch = createEventDispatcher<{
    commit: string;
    cancel: void;
  }>();

  let inputVal = rawValue;
  let showFnMenu = false;

  $: inputVal = rawValue;

  const popularFunctions = [
    { name: 'SUM', template: '=SUM(A1:A10)', desc: 'Sum of numbers in range' },
    { name: 'AVERAGE', template: '=AVERAGE(A1:A10)', desc: 'Average of numbers' },
    { name: 'COUNT', template: '=COUNT(A1:A10)', desc: 'Count numeric cells' },
    { name: 'COUNTIF', template: '=COUNTIF(A1:A10, "criteria")', desc: 'Count cells matching condition' },
    { name: 'SUMIF', template: '=SUMIF(A1:A10, ">0", B1:B10)', desc: 'Sum cells matching condition' },
    { name: 'IF', template: '=IF(A1>0, "Yes", "No")', desc: 'Conditional logical test' },
    { name: 'VLOOKUP', template: '=VLOOKUP("search", A1:C10, 2, FALSE)', desc: 'Vertical lookup in table' },
    { name: 'ROUND', template: '=ROUND(A1, 2)', desc: 'Round number to decimal places' },
    { name: 'CONCAT', template: '=CONCAT(A1, " ", B1)', desc: 'Concatenate text strings' },
    { name: 'MIN', template: '=MIN(A1:A10)', desc: 'Minimum value in range' },
    { name: 'MAX', template: '=MAX(A1:A10)', desc: 'Maximum value in range' },
    { name: 'TODAY', template: '=TODAY()', desc: 'Current date (YYYY-MM-DD)' },
  ];

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      dispatch('commit', inputVal);
    } else if (e.key === 'Escape') {
      inputVal = rawValue;
      dispatch('cancel');
    }
  }

  function handleSelectFunction(template: string) {
    inputVal = template;
    showFnMenu = false;
    dispatch('commit', inputVal);
  }
</script>

<div class="h-9 bg-white border-b border-slate-200 px-3 flex items-center space-x-2 select-none text-xs relative">
  <!-- Active Cell Coordinate Badge -->
  <div class="w-14 h-6 px-2 bg-slate-100 border border-slate-300 rounded text-slate-800 font-mono font-semibold flex items-center justify-center shadow-inner">
    {activeCell}
  </div>

  <!-- Formula Function Icon & Dropdown Trigger -->
  <div class="relative">
    <button
      class="flex items-center space-x-0.5 px-1.5 py-1 rounded hover:bg-emerald-50 text-emerald-700 transition-colors"
      on:click={() => (showFnMenu = !showFnMenu)}
      title="Insert Formula Function"
    >
      <FunctionSquare size={15} />
      <ChevronDown size={11} class="text-slate-400" />
    </button>

    {#if showFnMenu}
      <!-- Backdrop to close menu -->
      <div
        class="fixed inset-0 z-40"
        on:click={() => (showFnMenu = false)}
        role="presentation"
      ></div>

      <!-- Functions Dropdown Menu -->
      <div class="absolute left-0 top-8 z-50 w-64 bg-white border border-slate-200 rounded-lg shadow-xl py-1 text-xs">
        <div class="px-3 py-1 font-semibold text-slate-500 border-b border-slate-100 text-[11px]">
          Common Functions
        </div>
        <div class="max-h-60 overflow-y-auto">
          {#each popularFunctions as fn}
            <button
              class="w-full px-3 py-1.5 text-left hover:bg-emerald-50 hover:text-emerald-800 flex flex-col transition-colors border-b border-slate-50 last:border-none"
              on:click={() => handleSelectFunction(fn.template)}
            >
              <div class="flex items-center justify-between font-mono font-semibold text-slate-800">
                <span>{fn.name}</span>
                <span class="text-[10px] text-slate-400 font-normal">{fn.template}</span>
              </div>
              <span class="text-[10px] text-slate-500">{fn.desc}</span>
            </button>
          {/each}
        </div>
      </div>
    {/if}
  </div>

  <!-- Formula Input -->
  <div class="flex-1 flex items-center space-x-1">
    <input
      type="text"
      bind:value={inputVal}
      on:keydown={handleKeydown}
      on:blur={() => {
        if (inputVal !== rawValue) {
          dispatch('commit', inputVal);
        }
      }}
      placeholder="Enter value or formula (e.g. =SUM(A1:A5), =COUNTIF(B4:B9, 'S'), =IF(A1>0, 'Yes', 'No'))"
      class="w-full h-7 px-2.5 bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded text-xs font-mono text-slate-900 outline-none transition-colors"
    />

    {#if inputVal !== rawValue}
      <button
        class="p-1 rounded hover:bg-emerald-50 text-emerald-600 transition-colors"
        on:mousedown|preventDefault={() => dispatch('commit', inputVal)}
        title="Accept Formula"
      >
        <Check size={14} />
      </button>
      <button
        class="p-1 rounded hover:bg-rose-50 text-rose-600 transition-colors"
        on:mousedown|preventDefault={() => {
          inputVal = rawValue;
          dispatch('cancel');
        }}
        title="Cancel Formula Edit"
      >
        <X size={14} />
      </button>
    {/if}
  </div>
</div>
