<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { X, Palette, Check, Trash2 } from 'lucide-svelte';

  export let isOpen = false;
  export let defaultRange = 'A1:Z50';

  const dispatch = createEventDispatcher<{
    close: void;
    apply: {
      range: string;
      headerBg: string;
      headerColor: string;
      row1Bg: string;
      row2Bg: string;
      hasHeader: boolean;
      hasFooter: boolean;
    };
    remove: { range: string };
  }>();

  let range = defaultRange;
  let hasHeader = true;
  let hasFooter = false;

  interface ColorPalette {
    name: string;
    headerBg: string;
    headerColor: string;
    row1Bg: string;
    row2Bg: string;
  }

  const palettes: ColorPalette[] = [
    { name: 'Gray (Classic)', headerBg: '#475569', headerColor: '#ffffff', row1Bg: '#ffffff', row2Bg: '#f1f5f9' },
    { name: 'Mint Green', headerBg: '#059669', headerColor: '#ffffff', row1Bg: '#ffffff', row2Bg: '#ecfdf5' },
    { name: 'Cyan / Teal', headerBg: '#0d9488', headerColor: '#ffffff', row1Bg: '#ffffff', row2Bg: '#f0fdfa' },
    { name: 'Soft Blue', headerBg: '#2563eb', headerColor: '#ffffff', row1Bg: '#ffffff', row2Bg: '#eff6ff' },
    { name: 'Lavender', headerBg: '#7c3aed', headerColor: '#ffffff', row1Bg: '#ffffff', row2Bg: '#f5f3ff' },
    { name: 'Warm Coral', headerBg: '#ea580c', headerColor: '#ffffff', row1Bg: '#ffffff', row2Bg: '#fff7ed' },
  ];

  let selectedPalette: ColorPalette = palettes[1];
  let customHeaderBg = selectedPalette.headerBg;
  let customRow1Bg = selectedPalette.row1Bg;
  let customRow2Bg = selectedPalette.row2Bg;

  function pickPalette(p: ColorPalette) {
    selectedPalette = p;
    customHeaderBg = p.headerBg;
    customRow1Bg = p.row1Bg;
    customRow2Bg = p.row2Bg;
  }

  function handleApply() {
    dispatch('apply', {
      range,
      headerBg: customHeaderBg,
      headerColor: selectedPalette.headerColor,
      row1Bg: customRow1Bg,
      row2Bg: customRow2Bg,
      hasHeader,
      hasFooter,
    });
    dispatch('close');
  }

  function handleRemove() {
    dispatch('remove', { range });
    dispatch('close');
  }
</script>

{#if isOpen}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-100 select-none text-slate-800"
    on:click={() => dispatch('close')}
  >
    <div
      class="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-100 flex flex-col"
      on:click|stopPropagation
    >
      <!-- Header -->
      <div class="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
        <div class="flex items-center space-x-2">
          <div class="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
            <Palette size={18} />
          </div>
          <div>
            <h3 class="font-semibold text-sm text-slate-900 leading-tight">Alternating Colors</h3>
            <span class="text-[11px] text-slate-500">Apply formatted stripes to rows</span>
          </div>
        </div>
        <button
          class="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          on:click={() => dispatch('close')}
        >
          <X size={17} />
        </button>
      </div>

      <!-- Body -->
      <div class="p-5 space-y-4 text-xs">
        <div>
          <label for="alt-range-input" class="block font-semibold text-slate-700 mb-1">Apply to range</label>
          <input
            id="alt-range-input"
            type="text"
            bind:value={range}
            class="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs outline-none focus:border-emerald-500 font-mono"
          />
        </div>

        <!-- Checkbox Options -->
        <div class="space-y-1.5 pt-1">
          <label class="flex items-center space-x-2 cursor-pointer">
            <input type="checkbox" bind:checked={hasHeader} class="rounded text-emerald-600 focus:ring-emerald-500" />
            <span class="font-medium text-slate-700">Header row</span>
          </label>
          <label class="flex items-center space-x-2 cursor-pointer">
            <input type="checkbox" bind:checked={hasFooter} class="rounded text-emerald-600 focus:ring-emerald-500" />
            <span class="font-medium text-slate-700">Footer row</span>
          </label>
        </div>

        <!-- Preset Palettes -->
        <div class="space-y-2 pt-2 border-t border-slate-100">
          <span class="block font-semibold text-slate-700">Color styles</span>
          <div class="grid grid-cols-3 gap-2">
            {#each palettes as p}
              {@const isSelected = selectedPalette.name === p.name}
              <button
                type="button"
                class="flex flex-col rounded-lg border overflow-hidden p-1 space-y-0.5 transition-all {isSelected ? 'border-emerald-600 ring-2 ring-emerald-500/20 shadow-xs' : 'border-slate-200 hover:border-slate-300'}"
                on:click={() => pickPalette(p)}
              >
                <div class="h-3 rounded-xs w-full" style="background-color: {p.headerBg};"></div>
                <div class="h-2 rounded-xs w-full" style="background-color: {p.row1Bg}; border: 1px solid #f1f5f9;"></div>
                <div class="h-2 rounded-xs w-full" style="background-color: {p.row2Bg};"></div>
              </button>
            {/each}
          </div>
        </div>

        <!-- Custom Pickers -->
        <div class="pt-2 border-t border-slate-100 space-y-2">
          <span class="block font-semibold text-slate-700">Custom colors</span>
          <div class="grid grid-cols-3 gap-2 text-center text-[10px] text-slate-600">
            <div>
              <span class="block mb-1 font-medium">Header</span>
              <input type="color" bind:value={customHeaderBg} class="w-full h-7 rounded cursor-pointer border border-slate-200" />
            </div>
            <div>
              <span class="block mb-1 font-medium">Color 1</span>
              <input type="color" bind:value={customRow1Bg} class="w-full h-7 rounded cursor-pointer border border-slate-200" />
            </div>
            <div>
              <span class="block mb-1 font-medium">Color 2</span>
              <input type="color" bind:value={customRow2Bg} class="w-full h-7 rounded cursor-pointer border border-slate-200" />
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs">
        <button
          type="button"
          class="flex items-center space-x-1 text-rose-600 hover:text-rose-700 font-medium"
          on:click={handleRemove}
        >
          <Trash2 size={13} />
          <span>Remove</span>
        </button>
        <div class="flex items-center space-x-2">
          <button
            type="button"
            class="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors font-medium"
            on:click={() => dispatch('close')}
          >
            Cancel
          </button>
          <button
            type="button"
            class="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors font-semibold shadow-xs"
            on:click={handleApply}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}
