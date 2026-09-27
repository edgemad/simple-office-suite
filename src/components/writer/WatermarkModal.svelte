<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { DocumentWatermark } from '../../types';
  import { Stamp, X } from '@lucide/svelte';

  export let isOpen: boolean = false;
  export let watermark: DocumentWatermark = {
    enabled: false,
    text: 'CONFIDENTIAL',
    opacity: 0.15,
    angle: -45,
    color: '#0f172a',
  };

  const dispatch = createEventDispatcher<{
    close: void;
    save: { watermark: DocumentWatermark };
  }>();

  let tempWatermark = { ...watermark };

  const presets = ['CONFIDENTIAL', 'DRAFT', 'DO NOT COPY', 'SAMPLE', 'INTERNAL ONLY'];

  function handleSave() {
    dispatch('save', { watermark: { ...tempWatermark } });
    dispatch('close');
  }

  function handleRemove() {
    tempWatermark.enabled = false;
    dispatch('save', { watermark: { ...tempWatermark } });
    dispatch('close');
  }
</script>

{#if isOpen}
  <div class="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 w-96 text-xs text-slate-700 animate-in fade-in zoom-in-95 duration-100"
      on:click|stopPropagation
    >
      <div class="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
        <div class="flex items-center space-x-2">
          <Stamp size={16} class="text-blue-600" />
          <h3 class="font-bold text-sm text-slate-800">Document Watermark</h3>
        </div>
        <button
          class="p-1 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700"
          on:click={() => dispatch('close')}
        >
          <X size={16} />
        </button>
      </div>

      <div class="space-y-4">
        <!-- Enable Toggle -->
        <label class="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer">
          <span class="font-semibold text-slate-800">Show Watermark</span>
          <input
            type="checkbox"
            bind:checked={tempWatermark.enabled}
            class="w-4 h-4 accent-blue-600 cursor-pointer"
          />
        </label>

        {#if tempWatermark.enabled}
          <!-- Text Input -->
          <div>
            <label class="block font-semibold text-slate-700 mb-1" for="wm-text">Watermark Text</label>
            <input
              id="wm-text"
              type="text"
              bind:value={tempWatermark.text}
              placeholder="e.g. CONFIDENTIAL"
              class="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs outline-none focus:border-blue-500 font-bold tracking-wider uppercase"
            />
          </div>

          <!-- Quick Presets -->
          <div>
            <span class="block text-[11px] text-slate-500 mb-1">Presets:</span>
            <div class="flex flex-wrap gap-1">
              {#each presets as preset}
                <button
                  type="button"
                  class="px-2 py-0.5 rounded text-[10px] bg-slate-100 hover:bg-blue-100 hover:text-blue-700 text-slate-600 transition-colors"
                  on:click={() => (tempWatermark.text = preset)}
                >
                  {preset}
                </button>
              {/each}
            </div>
          </div>

          <!-- Formatting options: Angle & Opacity -->
          <div class="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
            <div>
              <label class="block font-semibold text-slate-700 mb-1" for="wm-angle">Orientation</label>
              <select
                id="wm-angle"
                bind:value={tempWatermark.angle}
                class="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs outline-none bg-white"
              >
                <option value={-45}>Diagonal (-45°)</option>
                <option value={0}>Horizontal (0°)</option>
              </select>
            </div>
            <div>
              <label class="block font-semibold text-slate-700 mb-1" for="wm-opacity">
                Opacity ({Math.round(tempWatermark.opacity * 100)}%)
              </label>
              <input
                id="wm-opacity"
                type="range"
                min="0.05"
                max="0.5"
                step="0.05"
                bind:value={tempWatermark.opacity}
                class="w-full accent-blue-600 cursor-pointer mt-1"
              />
            </div>
          </div>
        {/if}
      </div>

      <!-- Actions -->
      <div class="pt-5 border-t border-slate-100 mt-5 flex items-center justify-between">
        {#if watermark.enabled}
          <button
            class="text-xs text-rose-600 hover:text-rose-700 font-semibold"
            on:click={handleRemove}
          >
            Remove Watermark
          </button>
        {:else}
          <div></div>
        {/if}

        <div class="flex items-center space-x-2">
          <button
            class="px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-medium"
            on:click={() => dispatch('close')}
          >
            Cancel
          </button>
          <button
            class="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs"
            on:click={handleSave}
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}
