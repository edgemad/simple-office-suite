<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { FunctionSquare, Check, X } from 'lucide-svelte';

  export let activeCell: string = 'A1';
  export let rawValue: string = '';

  const dispatch = createEventDispatcher<{
    commit: string;
    cancel: void;
  }>();

  let inputVal = rawValue;

  $: inputVal = rawValue;

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      dispatch('commit', inputVal);
    } else if (e.key === 'Escape') {
      inputVal = rawValue;
      dispatch('cancel');
    }
  }
</script>

<div class="h-9 bg-white border-b border-slate-200 px-3 flex items-center space-x-2 select-none text-xs">
  <!-- Active Cell Coordinate Badge -->
  <div class="w-14 h-6 px-2 bg-slate-100 border border-slate-300 rounded text-slate-800 font-mono font-semibold flex items-center justify-center">
    {activeCell}
  </div>

  <!-- Formula Function Icon -->
  <div class="text-slate-400 flex items-center justify-center pl-1 pr-1" title="Formula (Start with =)">
    <FunctionSquare size={16} class="text-emerald-600" />
  </div>

  <!-- Formula Input -->
  <div class="flex-1 flex items-center space-x-1">
    <input
      type="text"
      bind:value={inputVal}
      on:keydown={handleKeydown}
      on:blur={() => dispatch('commit', inputVal)}
      placeholder="Enter value or formula (e.g. =SUM(A1:A5), =AVERAGE(B1:B10))"
      class="w-full h-7 px-2.5 bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded text-xs font-mono text-slate-900 outline-none transition-colors"
    />

    {#if inputVal !== rawValue}
      <button
        class="p-1 rounded hover:bg-emerald-50 text-emerald-600"
        on:click={() => dispatch('commit', inputVal)}
        title="Accept"
      >
        <Check size={14} />
      </button>
      <button
        class="p-1 rounded hover:bg-rose-50 text-rose-600"
        on:click={() => { inputVal = rawValue; dispatch('cancel'); }}
        title="Cancel"
      >
        <X size={14} />
      </button>
    {/if}
  </div>
</div>
