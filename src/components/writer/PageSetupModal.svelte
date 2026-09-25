<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { Layout, X, Check, FileText } from 'lucide-svelte';
  import type { DocumentPageSetup } from '../../types';

  export let isOpen: boolean = false;
  export let pageSetup: DocumentPageSetup = {
    margin: 'normal',
    orientation: 'portrait',
    size: 'a4',
  };
  export let isPageless: boolean = false;

  const dispatch = createEventDispatcher<{
    close: void;
    save: { pageSetup: DocumentPageSetup; isPageless: boolean };
  }>();

  let tempSetup: DocumentPageSetup = { ...pageSetup };
  let tempPageless = isPageless;

  function handleSave() {
    dispatch('save', { pageSetup: { ...tempSetup }, isPageless: tempPageless });
    isOpen = false;
  }
</script>

{#if isOpen}
  <div class="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div
      class="bg-white rounded-xl shadow-2xl border border-slate-200 p-6 w-96 text-xs text-slate-700 animate-in fade-in zoom-in-95 duration-100"
      on:click|stopPropagation
    >
      <div class="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
        <div class="flex items-center space-x-2 font-bold text-slate-800 text-sm">
          <Layout size={16} class="text-blue-600" />
          <span>Page setup</span>
        </div>
        <button
          class="p-1 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600"
          on:click={() => dispatch('close')}
        >
          <X size={15} />
        </button>
      </div>

      <div class="space-y-4">
        <!-- View Mode: Pages vs Pageless (Google Docs) -->
        <div>
          <label class="block font-semibold text-slate-800 mb-1.5">Format</label>
          <div class="grid grid-cols-2 gap-2">
            <button
              type="button"
              class="p-2.5 rounded-lg border text-left flex items-start space-x-2 transition-all
                {!tempPageless ? 'border-blue-600 bg-blue-50/60 text-blue-900 ring-1 ring-blue-500' : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700'}"
              on:click={() => (tempPageless = false)}
            >
              <FileText size={15} class="mt-0.5 text-blue-600" />
              <div>
                <p class="font-bold">Pages</p>
                <p class="text-[11px] text-slate-500">Standard document pages</p>
              </div>
            </button>
            <button
              type="button"
              class="p-2.5 rounded-lg border text-left flex items-start space-x-2 transition-all
                {tempPageless ? 'border-blue-600 bg-blue-50/60 text-blue-900 ring-1 ring-blue-500' : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700'}"
              on:click={() => (tempPageless = true)}
            >
              <Layout size={15} class="mt-0.5 text-blue-600" />
              <div>
                <p class="font-bold">Pageless</p>
                <p class="text-[11px] text-slate-500">Continuous surface without page breaks</p>
              </div>
            </button>
          </div>
        </div>

        {#if !tempPageless}
          <!-- Orientation -->
          <div>
            <label class="block font-semibold text-slate-800 mb-1.5">Orientation</label>
            <div class="grid grid-cols-2 gap-2">
              <label
                class="flex items-center space-x-2 p-2 rounded-lg border cursor-pointer transition-colors
                  {tempSetup.orientation === 'portrait' ? 'border-blue-500 bg-blue-50/50' : 'border-slate-200 hover:bg-slate-50'}"
              >
                <input
                  type="radio"
                  name="orientation"
                  value="portrait"
                  bind:group={tempSetup.orientation}
                  class="text-blue-600"
                />
                <span class="font-medium text-slate-700">Portrait</span>
              </label>
              <label
                class="flex items-center space-x-2 p-2 rounded-lg border cursor-pointer transition-colors
                  {tempSetup.orientation === 'landscape' ? 'border-blue-500 bg-blue-50/50' : 'border-slate-200 hover:bg-slate-50'}"
              >
                <input
                  type="radio"
                  name="orientation"
                  value="landscape"
                  bind:group={tempSetup.orientation}
                  class="text-blue-600"
                />
                <span class="font-medium text-slate-700">Landscape</span>
              </label>
            </div>
          </div>

          <!-- Paper Size -->
          <div>
            <label class="block font-semibold text-slate-800 mb-1.5">Paper size</label>
            <select
              bind:value={tempSetup.size}
              class="w-full h-8 px-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 outline-none focus:border-blue-500"
            >
              <option value="letter">Letter (8.5" × 11")</option>
              <option value="a4">A4 (210mm × 297mm)</option>
              <option value="legal">Legal (8.5" × 14")</option>
            </select>
          </div>

          <!-- Margins -->
          <div>
            <label class="block font-semibold text-slate-800 mb-1.5">Margins</label>
            <select
              bind:value={tempSetup.margin}
              class="w-full h-8 px-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 outline-none focus:border-blue-500"
            >
              <option value="normal">Normal (1.0 in / 2.54 cm)</option>
              <option value="narrow">Narrow (0.5 in / 1.27 cm)</option>
              <option value="wide">Wide (1.5 in / 3.81 cm)</option>
            </select>
          </div>
        {/if}
      </div>

      <div class="mt-6 pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
        <button
          type="button"
          class="px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-600 font-medium transition-colors"
          on:click={() => dispatch('close')}
        >
          Cancel
        </button>
        <button
          type="button"
          class="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm transition-colors flex items-center space-x-1"
          on:click={handleSave}
        >
          <Check size={14} />
          <span>Apply</span>
        </button>
      </div>
    </div>
  </div>
{/if}
