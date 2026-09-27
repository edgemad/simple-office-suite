<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { CellBorderConfig } from '../../types';
  import {
    Grid as GridIcon,
    Square,
    Minus,
    X,
    Check
  } from 'lucide-svelte';

  export let isOpen: boolean = false;

  const dispatch = createEventDispatcher<{
    close: void;
    applyBorders: { borders: CellBorderConfig };
  }>();

  let selectedColor = '#000000';
  let selectedStyle: 'solid' | 'dashed' | 'double' = 'solid';

  const palette = ['#000000', '#475569', '#94a3b8', '#2563eb', '#059669', '#dc2626', '#d97706'];

  function apply(type: 'all' | 'outer' | 'inner' | 'top' | 'bottom' | 'left' | 'right' | 'none') {
    let borders: CellBorderConfig = {};
    if (type === 'all') {
      borders = { top: true, bottom: true, left: true, right: true, color: selectedColor, style: selectedStyle };
    } else if (type === 'outer') {
      borders = { top: true, bottom: true, left: true, right: true, color: selectedColor, style: selectedStyle };
    } else if (type === 'top') {
      borders = { top: true, color: selectedColor, style: selectedStyle };
    } else if (type === 'bottom') {
      borders = { bottom: true, color: selectedColor, style: selectedStyle };
    } else if (type === 'left') {
      borders = { left: true, color: selectedColor, style: selectedStyle };
    } else if (type === 'right') {
      borders = { right: true, color: selectedColor, style: selectedStyle };
    } else if (type === 'none') {
      borders = { top: false, bottom: false, left: false, right: false };
    }
    dispatch('applyBorders', { borders });
    dispatch('close');
  }
</script>

{#if isOpen}
  <div class="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="bg-white rounded-2xl shadow-2xl border border-slate-200 p-5 w-80 text-xs text-slate-700 animate-in fade-in zoom-in-95 duration-100"
      on:click|stopPropagation
    >
      <div class="flex items-center justify-between pb-2 border-b border-slate-100 mb-3">
        <div class="flex items-center space-x-2 font-bold text-slate-800">
          <Square size={16} class="text-emerald-600" />
          <span>Cell Borders</span>
        </div>
        <button class="p-1 rounded-full hover:bg-slate-100 text-slate-400" on:click={() => dispatch('close')}>
          <X size={15} />
        </button>
      </div>

      <!-- Border Presets Grid -->
      <div class="grid grid-cols-4 gap-2 mb-4">
        <button
          class="flex flex-col items-center justify-center p-2.5 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50 text-slate-700 transition-all text-center group"
          on:click={() => apply('all')}
          title="All Borders"
        >
          <div class="w-6 h-6 border-2 border-slate-700 grid grid-cols-2 grid-rows-2 group-hover:border-emerald-600">
            <div class="border-r border-b border-slate-400"></div>
            <div class="border-b border-slate-400"></div>
            <div class="border-r border-slate-400"></div>
            <div></div>
          </div>
          <span class="text-[10px] mt-1 font-medium">All</span>
        </button>

        <button
          class="flex flex-col items-center justify-center p-2.5 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50 text-slate-700 transition-all text-center group"
          on:click={() => apply('outer')}
          title="Outer Borders"
        >
          <div class="w-6 h-6 border-2 border-slate-700 group-hover:border-emerald-600"></div>
          <span class="text-[10px] mt-1 font-medium">Outer</span>
        </button>

        <button
          class="flex flex-col items-center justify-center p-2.5 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50 text-slate-700 transition-all text-center group"
          on:click={() => apply('top')}
          title="Top Border"
        >
          <div class="w-6 h-6 border-t-2 border-slate-700 group-hover:border-emerald-600"></div>
          <span class="text-[10px] mt-1 font-medium">Top</span>
        </button>

        <button
          class="flex flex-col items-center justify-center p-2.5 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50 text-slate-700 transition-all text-center group"
          on:click={() => apply('bottom')}
          title="Bottom Border"
        >
          <div class="w-6 h-6 border-b-2 border-slate-700 group-hover:border-emerald-600"></div>
          <span class="text-[10px] mt-1 font-medium">Bottom</span>
        </button>

        <button
          class="flex flex-col items-center justify-center p-2.5 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50 text-slate-700 transition-all text-center group"
          on:click={() => apply('left')}
          title="Left Border"
        >
          <div class="w-6 h-6 border-l-2 border-slate-700 group-hover:border-emerald-600"></div>
          <span class="text-[10px] mt-1 font-medium">Left</span>
        </button>

        <button
          class="flex flex-col items-center justify-center p-2.5 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50 text-slate-700 transition-all text-center group"
          on:click={() => apply('right')}
          title="Right Border"
        >
          <div class="w-6 h-6 border-r-2 border-slate-700 group-hover:border-emerald-600"></div>
          <span class="text-[10px] mt-1 font-medium">Right</span>
        </button>

        <button
          class="flex flex-col items-center justify-center p-2.5 rounded-xl border border-slate-200 hover:border-rose-400 hover:bg-rose-50 text-slate-700 transition-all text-center col-span-2 group"
          on:click={() => apply('none')}
          title="Clear Borders"
        >
          <X size={18} class="text-rose-500" />
          <span class="text-[10px] mt-1 font-semibold text-rose-600">Clear Borders</span>
        </button>
      </div>

      <!-- Border Color & Style -->
      <div class="space-y-2 pt-2 border-t border-slate-100">
        <div>
          <span class="block text-[11px] font-semibold text-slate-700 mb-1">Border Color</span>
          <div class="flex items-center space-x-1.5">
            {#each palette as color}
              <button
                class="w-5 h-5 rounded-full border border-slate-300 transition-transform {selectedColor === color ? 'scale-125 ring-2 ring-emerald-500' : 'hover:scale-110'}"
                style="background-color: {color};"
                on:click={() => (selectedColor = color)}
              ></button>
            {/each}
          </div>
        </div>

        <div>
          <span class="block text-[11px] font-semibold text-slate-700 mb-1">Line Style</span>
          <div class="grid grid-cols-3 gap-1">
            <button
              class="py-1 rounded border text-[10px] font-medium {selectedStyle === 'solid' ? 'bg-emerald-50 border-emerald-500 text-emerald-700 font-bold' : 'border-slate-200 hover:bg-slate-50'}"
              on:click={() => (selectedStyle = 'solid')}
            >
              Solid
            </button>
            <button
              class="py-1 rounded border text-[10px] font-medium {selectedStyle === 'dashed' ? 'bg-emerald-50 border-emerald-500 text-emerald-700 font-bold' : 'border-slate-200 hover:bg-slate-50'}"
              on:click={() => (selectedStyle = 'dashed')}
            >
              Dashed
            </button>
            <button
              class="py-1 rounded border text-[10px] font-medium {selectedStyle === 'double' ? 'bg-emerald-50 border-emerald-500 text-emerald-700 font-bold' : 'border-slate-200 hover:bg-slate-50'}"
              on:click={() => (selectedStyle = 'double')}
            >
              Double
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
{/if}
