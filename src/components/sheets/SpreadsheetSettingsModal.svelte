<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { X, Settings, Globe, Calculator, Check } from 'lucide-svelte';

  export let isOpen = false;

  const dispatch = createEventDispatcher<{
    close: void;
    save: {
      locale: string;
      timezone: string;
      recalculation: string;
      iterative: boolean;
      maxIterations: number;
    };
  }>();

  let activeTab: 'general' | 'calculation' = 'general';

  let locale = 'en_US';
  let timezone = 'Asia/Manila';
  let recalculation = 'onChange';
  let iterative = false;
  let maxIterations = 50;

  const locales = [
    { label: 'United States', value: 'en_US' },
    { label: 'Philippines', value: 'en_PH' },
    { label: 'United Kingdom', value: 'en_GB' },
    { label: 'Canada', value: 'en_CA' },
    { label: 'Australia', value: 'en_AU' },
    { label: 'Japan', value: 'ja_JP' },
    { label: 'Germany', value: 'de_DE' },
    { label: 'France', value: 'fr_FR' },
  ];

  const timezones = [
    { label: '(GMT+08:00) Manila, Beijing, Singapore', value: 'Asia/Manila' },
    { label: '(GMT-07:00) Pacific Time (US & Canada)', value: 'America/Los_Angeles' },
    { label: '(GMT-04:00) Eastern Time (US & Canada)', value: 'America/New_York' },
    { label: '(GMT+00:00) London, Dublin, Lisbon', value: 'Europe/London' },
    { label: '(GMT+01:00) Berlin, Paris, Rome', value: 'Europe/Berlin' },
    { label: '(GMT+09:00) Tokyo, Seoul', value: 'Asia/Tokyo' },
  ];

  function handleSave() {
    dispatch('save', {
      locale,
      timezone,
      recalculation,
      iterative,
      maxIterations,
    });
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
      class="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-100 flex flex-col"
      on:click|stopPropagation
    >
      <!-- Header -->
      <div class="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
        <div class="flex items-center space-x-2">
          <div class="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
            <Settings size={18} />
          </div>
          <div>
            <h3 class="font-semibold text-sm text-slate-900 leading-tight">Settings for this spreadsheet</h3>
            <span class="text-[11px] text-slate-500">Configure locale, formatting rules, and calculation engine</span>
          </div>
        </div>
        <button
          class="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          on:click={() => dispatch('close')}
        >
          <X size={17} />
        </button>
      </div>

      <!-- Tabs -->
      <div class="flex border-b border-slate-200 px-5 pt-2 text-xs font-semibold space-x-4">
        <button
          class="pb-2 border-b-2 transition-all {activeTab === 'general' ? 'border-emerald-600 text-emerald-700 font-bold' : 'border-transparent text-slate-500 hover:text-slate-800'}"
          on:click={() => (activeTab = 'general')}
        >
          General
        </button>
        <button
          class="pb-2 border-b-2 transition-all {activeTab === 'calculation' ? 'border-emerald-600 text-emerald-700 font-bold' : 'border-transparent text-slate-500 hover:text-slate-800'}"
          on:click={() => (activeTab = 'calculation')}
        >
          Calculation
        </button>
      </div>

      <!-- Body -->
      <div class="p-5 space-y-4 text-xs">
        {#if activeTab === 'general'}
          <div>
            <label for="sheet-locale" class="block font-semibold text-slate-700 mb-1">Locale</label>
            <select
              id="sheet-locale"
              bind:value={locale}
              class="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:border-emerald-500 bg-white"
            >
              {#each locales as l}
                <option value={l.value}>{l.label}</option>
              {/each}
            </select>
            <span class="text-[11px] text-slate-500 block mt-1">Affects formatting details such as currency, dates, and number separators.</span>
          </div>

          <div>
            <label for="sheet-timezone" class="block font-semibold text-slate-700 mb-1">Time zone</label>
            <select
              id="sheet-timezone"
              bind:value={timezone}
              class="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:border-emerald-500 bg-white"
            >
              {#each timezones as tz}
                <option value={tz.value}>{tz.label}</option>
              {/each}
            </select>
          </div>
        {:else}
          <div>
            <label for="sheet-recalc" class="block font-semibold text-slate-700 mb-1">Recalculation</label>
            <select
              id="sheet-recalc"
              bind:value={recalculation}
              class="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:border-emerald-500 bg-white"
            >
              <option value="onChange">On change</option>
              <option value="onChangeAndMinute">On change and every minute</option>
              <option value="onChangeAndHour">On change and every hour</option>
            </select>
            <span class="text-[11px] text-slate-500 block mt-1">Affects how often NOW, TODAY, RAND, and formulas update.</span>
          </div>

          <div class="pt-2 border-t border-slate-100 space-y-2">
            <label class="flex items-center space-x-2 cursor-pointer">
              <input type="checkbox" bind:checked={iterative} class="rounded text-emerald-600 focus:ring-emerald-500" />
              <span class="font-semibold text-slate-700">Iterative calculation</span>
            </label>
            <p class="text-[11px] text-slate-500 leading-relaxed">
              When turned on, formulas with circular dependencies can calculate without returning an error.
            </p>
            {#if iterative}
              <div class="pt-1">
                <label for="sheet-max-iter" class="block text-[11px] font-medium text-slate-700 mb-1">Max number of iterations</label>
                <input
                  id="sheet-max-iter"
                  type="number"
                  bind:value={maxIterations}
                  class="w-24 px-2.5 py-1 border border-slate-300 rounded-lg text-xs outline-none focus:border-emerald-500"
                />
              </div>
            {/if}
          </div>
        {/if}
      </div>

      <!-- Footer -->
      <div class="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end space-x-2 text-xs">
        <button
          type="button"
          class="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors font-medium"
          on:click={() => dispatch('close')}
        >
          Cancel
        </button>
        <button
          type="button"
          class="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors font-semibold shadow-xs"
          on:click={handleSave}
        >
          Save settings
        </button>
      </div>
    </div>
  </div>
{/if}
