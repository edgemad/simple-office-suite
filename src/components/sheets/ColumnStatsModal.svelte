<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { X, BarChart2, Hash, Type, HelpCircle, Layers } from 'lucide-svelte';
  import { colToLetter, parseCoord } from './formulaEngine';
  import type { SheetGrid } from '../../types';

  export let isOpen = false;
  export let activeCell: string = 'A1';
  export let grid: SheetGrid = {};
  export let rowCount: number = 50;

  const dispatch = createEventDispatcher<{
    close: void;
  }>();

  $: coord = parseCoord(activeCell);
  $: colIdx = coord ? coord.col : 0;
  $: colLetter = colToLetter(colIdx);

  $: stats = (() => {
    let filled = 0;
    let empty = 0;
    let sum = 0;
    let numericCount = 0;
    let min = Infinity;
    let max = -Infinity;
    const values: any[] = [];
    const frequency: Record<string, number> = {};

    for (let r = 0; r < rowCount; r++) {
      const k = `${colLetter}${r + 1}`;
      const cell = grid[k];
      const val = cell?.computed;

      if (val !== undefined && val !== null && String(val).trim() !== '') {
        filled++;
        const s = String(val).trim();
        frequency[s] = (frequency[s] || 0) + 1;
        values.push(val);

        const num = typeof val === 'number' ? val : parseFloat(s.replace(/[$,%]/g, ''));
        if (!isNaN(num)) {
          numericCount++;
          sum += num;
          if (num < min) min = num;
          if (num > max) max = num;
        }
      } else {
        empty++;
      }
    }

    const uniqueCount = Object.keys(frequency).length;
    const avg = numericCount > 0 ? sum / numericCount : null;
    const sortedFreq = Object.entries(frequency).sort((a, b) => b[1] - a[1]);
    const topValues = sortedFreq.slice(0, 5);

    return {
      total: rowCount,
      filled,
      empty,
      sum: numericCount > 0 ? sum : null,
      avg,
      min: min !== Infinity ? min : null,
      max: max !== -Infinity ? max : null,
      numericCount,
      uniqueCount,
      topValues,
    };
  })();
</script>

{#if isOpen}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-100 select-none text-slate-800"
    on:click={() => dispatch('close')}
  >
    <div
      class="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-100 flex flex-col max-h-[85vh]"
      on:click|stopPropagation
    >
      <!-- Header -->
      <div class="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
        <div class="flex items-center space-x-2">
          <div class="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
            <BarChart2 size={18} />
          </div>
          <div>
            <h3 class="font-semibold text-sm text-slate-900 leading-tight">Column Stats: Column {colLetter}</h3>
            <span class="text-[11px] text-slate-500">Analysis across {rowCount} rows</span>
          </div>
        </div>
        <button
          class="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          on:click={() => dispatch('close')}
        >
          <X size={17} />
        </button>
      </div>

      <!-- Content -->
      <div class="p-5 space-y-4 overflow-y-auto text-xs">
        <!-- Quick Overview Chips -->
        <div class="grid grid-cols-3 gap-2">
          <div class="p-3 bg-slate-50 rounded-xl border border-slate-100 text-center">
            <span class="text-[10px] text-slate-500 block uppercase tracking-wider font-semibold">Filled</span>
            <span class="text-base font-bold text-slate-900">{stats.filled}</span>
          </div>
          <div class="p-3 bg-slate-50 rounded-xl border border-slate-100 text-center">
            <span class="text-[10px] text-slate-500 block uppercase tracking-wider font-semibold">Empty</span>
            <span class="text-base font-bold text-slate-900">{stats.empty}</span>
          </div>
          <div class="p-3 bg-slate-50 rounded-xl border border-slate-100 text-center">
            <span class="text-[10px] text-slate-500 block uppercase tracking-wider font-semibold">Unique</span>
            <span class="text-base font-bold text-emerald-600">{stats.uniqueCount}</span>
          </div>
        </div>

        <!-- Numeric Summary (If numbers exist) -->
        {#if stats.numericCount > 0}
          <div class="p-3.5 bg-emerald-50/50 rounded-xl border border-emerald-100 space-y-2">
            <div class="flex items-center space-x-1.5 font-semibold text-emerald-900">
              <Hash size={14} class="text-emerald-600" />
              <span>Numeric Statistics ({stats.numericCount} values)</span>
            </div>
            <div class="grid grid-cols-2 gap-y-1.5 gap-x-4 text-xs pt-1">
              <div class="flex justify-between border-b border-emerald-100/60 pb-1">
                <span class="text-slate-500">Sum:</span>
                <span class="font-semibold text-slate-900">{stats.sum?.toLocaleString()}</span>
              </div>
              <div class="flex justify-between border-b border-emerald-100/60 pb-1">
                <span class="text-slate-500">Average:</span>
                <span class="font-semibold text-slate-900">{stats.avg?.toFixed(2)}</span>
              </div>
              <div class="flex justify-between border-b border-emerald-100/60 pb-1">
                <span class="text-slate-500">Min:</span>
                <span class="font-semibold text-slate-900">{stats.min?.toLocaleString()}</span>
              </div>
              <div class="flex justify-between border-b border-emerald-100/60 pb-1">
                <span class="text-slate-500">Max:</span>
                <span class="font-semibold text-slate-900">{stats.max?.toLocaleString()}</span>
              </div>
            </div>
          </div>
        {/if}

        <!-- Top Values Frequency -->
        <div class="space-y-2">
          <div class="flex items-center space-x-1.5 font-semibold text-slate-800">
            <Type size={14} class="text-slate-500" />
            <span>Most Frequent Values</span>
          </div>
          {#if stats.topValues.length === 0}
            <div class="p-4 bg-slate-50 rounded-xl text-center text-slate-400">
              No data in Column {colLetter}.
            </div>
          {:else}
            <div class="space-y-1.5">
              {#each stats.topValues as [val, count]}
                {@const pct = Math.round((count / (stats.filled || 1)) * 100)}
                <div class="space-y-1">
                  <div class="flex justify-between text-[11px]">
                    <span class="font-medium text-slate-800 truncate max-w-[240px]">{val}</span>
                    <span class="text-slate-500 font-mono">{count} ({pct}%)</span>
                  </div>
                  <div class="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div class="bg-emerald-600 h-full rounded-full" style="width: {pct}%;"></div>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      </div>

      <!-- Footer -->
      <div class="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
        <button
          class="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl font-medium text-xs transition-colors"
          on:click={() => dispatch('close')}
        >
          Close
        </button>
      </div>
    </div>
  </div>
{/if}
