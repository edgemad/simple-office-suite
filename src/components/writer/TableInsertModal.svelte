<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { Table, X, Check } from 'lucide-svelte';

  export let isOpen: boolean = false;

  const dispatch = createEventDispatcher<{
    close: void;
    insert: { rows: number; cols: number; hasHeader: boolean };
  }>();

  let hoverRows = 3;
  let hoverCols = 3;
  let hasHeader = true;
  const maxGrid = 8;

  function handleSelect(r: number, c: number) {
    dispatch('insert', { rows: r, cols: c, hasHeader });
    isOpen = false;
  }
</script>

{#if isOpen}
  <div class="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div
      class="bg-white rounded-xl shadow-2xl border border-slate-200 p-5 w-80 text-xs text-slate-700 animate-in fade-in zoom-in-95 duration-100"
      on:click|stopPropagation
    >
      <div class="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
        <div class="flex items-center space-x-2 font-bold text-slate-800 text-sm">
          <Table size={16} class="text-blue-600" />
          <span>Insert Table</span>
        </div>
        <button
          class="p-1 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600"
          on:click={() => dispatch('close')}
        >
          <X size={15} />
        </button>
      </div>

      <!-- Size label -->
      <div class="text-center font-semibold text-blue-700 py-1 mb-2 bg-blue-50/70 rounded border border-blue-100">
        {hoverCols} × {hoverRows} Table
      </div>

      <!-- Grid selector (Google Docs style) -->
      <div class="flex flex-col items-center justify-center p-2 bg-slate-50 rounded-lg border border-slate-200">
        {#each Array(maxGrid) as _, r}
          <div class="flex">
            {#each Array(maxGrid) as _, c}
              {@const isHovered = r < hoverRows && c < hoverCols}
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <div
                class="w-5 h-5 m-0.5 rounded-xs border cursor-pointer transition-colors
                  {isHovered ? 'bg-blue-500 border-blue-600' : 'bg-white border-slate-300 hover:border-blue-400'}"
                on:mouseenter={() => {
                  hoverRows = r + 1;
                  hoverCols = c + 1;
                }}
                on:click={() => handleSelect(r + 1, c + 1)}
              ></div>
            {/each}
          </div>
        {/each}
      </div>

      <div class="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
        <label class="flex items-center space-x-2 cursor-pointer text-slate-600">
          <input type="checkbox" bind:checked={hasHeader} class="rounded text-blue-600 focus:ring-blue-500" />
          <span>Include Header Row</span>
        </label>

        <button
          class="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm transition-colors flex items-center space-x-1"
          on:click={() => handleSelect(hoverRows, hoverCols)}
        >
          <Check size={13} />
          <span>Insert</span>
        </button>
      </div>
    </div>
  </div>
{/if}
