<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { ArrowDownAZ, ArrowUpZA, Check, X, Filter } from 'lucide-svelte';

  export let colIndex: number;
  export let colLetter: string;
  export let uniqueValues: string[] = [];
  export let selectedValues: string[] = [];
  export let activeCondition: string = 'none';
  export let conditionVal: string = '';

  const dispatch = createEventDispatcher<{
    close: void;
    sortAsc: { colIndex: number };
    sortDesc: { colIndex: number };
    applyFilter: {
      colIndex: number;
      condition: string;
      conditionValue: string;
      hiddenValues: string[];
    };
    clearFilter: { colIndex: number };
  }>();

  let tempSelected = new Set(selectedValues.length > 0 ? selectedValues : uniqueValues);
  let tempCondition = activeCondition;
  let tempConditionVal = conditionVal;

  function toggleVal(v: string) {
    if (tempSelected.has(v)) {
      tempSelected.delete(v);
    } else {
      tempSelected.add(v);
    }
    tempSelected = new Set(tempSelected);
  }

  function selectAll() {
    tempSelected = new Set(uniqueValues);
  }

  function clearAll() {
    tempSelected = new Set();
  }

  function handleApply() {
    const hidden = uniqueValues.filter((v) => !tempSelected.has(v));
    dispatch('applyFilter', {
      colIndex,
      condition: tempCondition,
      conditionValue: tempConditionVal,
      hiddenValues: hidden,
    });
    dispatch('close');
  }

  function handleClear() {
    dispatch('clearFilter', { colIndex });
    dispatch('close');
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="absolute z-40 bg-white rounded-xl shadow-2xl border border-slate-200 p-3 w-64 text-xs text-slate-700 animate-in fade-in zoom-in-95 duration-100 top-full left-0 mt-1"
  on:click|stopPropagation
>
  <div class="flex items-center justify-between pb-2 border-b border-slate-100 mb-2">
    <span class="font-bold text-slate-800">Filter Column {colLetter}</span>
    <button class="p-1 rounded hover:bg-slate-100 text-slate-400" on:click={() => dispatch('close')}>
      <X size={13} />
    </button>
  </div>

  <!-- Sort Options -->
  <div class="space-y-1 pb-2 border-b border-slate-100 mb-2">
    <button
      class="w-full flex items-center space-x-2 px-2 py-1.5 rounded-lg hover:bg-slate-100 text-slate-700 font-medium transition-colors text-left"
      on:click={() => {
        dispatch('sortAsc', { colIndex });
        dispatch('close');
      }}
    >
      <ArrowDownAZ size={14} class="text-emerald-600" />
      <span>Sort A to Z</span>
    </button>
    <button
      class="w-full flex items-center space-x-2 px-2 py-1.5 rounded-lg hover:bg-slate-100 text-slate-700 font-medium transition-colors text-left"
      on:click={() => {
        dispatch('sortDesc', { colIndex });
        dispatch('close');
      }}
    >
      <ArrowUpZA size={14} class="text-emerald-600" />
      <span>Sort Z to A</span>
    </button>
  </div>

  <!-- Filter by condition -->
  <div class="space-y-1.5 pb-2 border-b border-slate-100 mb-2">
    <span class="font-semibold text-slate-600 text-[11px] block">Filter by condition</span>
    <select
      bind:value={tempCondition}
      class="w-full px-2 py-1 border border-slate-200 rounded-lg text-xs outline-none bg-slate-50 font-medium"
    >
      <option value="none">None</option>
      <option value="empty">Is empty</option>
      <option value="notEmpty">Is not empty</option>
      <option value="contains">Text contains</option>
      <option value="greaterThan">Greater than</option>
      <option value="lessThan">Less than</option>
      <option value="equals">Equals</option>
    </select>
    {#if ['contains', 'greaterThan', 'lessThan', 'equals'].includes(tempCondition)}
      <input
        type="text"
        placeholder="Value..."
        bind:value={tempConditionVal}
        class="w-full px-2 py-1 border border-slate-200 rounded-lg text-xs outline-none"
      />
    {/if}
  </div>

  <!-- Filter by values -->
  <div class="space-y-1.5">
    <div class="flex items-center justify-between text-[11px]">
      <span class="font-semibold text-slate-600">Filter by values</span>
      <div class="flex space-x-2">
        <button class="text-blue-600 hover:underline" on:click={selectAll}>Select all</button>
        <button class="text-slate-400 hover:underline" on:click={clearAll}>Clear</button>
      </div>
    </div>

    <div class="max-h-32 overflow-y-auto border border-slate-100 rounded-lg p-1.5 space-y-1 bg-slate-50/50">
      {#each uniqueValues as val}
        <label class="flex items-center space-x-2 px-1 py-0.5 hover:bg-slate-100 rounded cursor-pointer text-[11px]">
          <input
            type="checkbox"
            checked={tempSelected.has(val)}
            on:change={() => toggleVal(val)}
            class="w-3.5 h-3.5 accent-emerald-600 rounded"
          />
          <span class="truncate">{val || '(Blanks)'}</span>
        </label>
      {/each}
    </div>
  </div>

  <!-- Actions -->
  <div class="pt-3 border-t border-slate-100 mt-3 flex items-center justify-between">
    <button class="text-xs text-rose-600 hover:underline font-medium" on:click={handleClear}>
      Reset
    </button>
    <div class="flex space-x-1.5">
      <button
        class="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 font-medium"
        on:click={() => dispatch('close')}
      >
        Cancel
      </button>
      <button
        class="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-2xs"
        on:click={handleApply}
      >
        OK
      </button>
    </div>
  </div>
</div>
