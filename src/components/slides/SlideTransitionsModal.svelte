<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { SlideTransition, SlideTransitionType } from '../../types';
  import { Sparkles, X, Play, Check } from 'lucide-svelte';

  export let isOpen: boolean = false;
  export let currentTransition: SlideTransition = {
    type: 'fade',
    durationSec: 0.5,
  };

  const dispatch = createEventDispatcher<{
    close: void;
    apply: { transition: SlideTransition; applyToAll: boolean };
  }>();

  let tempType: SlideTransitionType = currentTransition.type || 'fade';
  let tempDuration: number = currentTransition.durationSec || 0.5;

  const transitionOptions: { id: SlideTransitionType; label: string; desc: string }[] = [
    { id: 'none', label: 'None', desc: 'Instant switch between slides' },
    { id: 'fade', label: 'Fade / Dissolve', desc: 'Smooth crossfade dissolve' },
    { id: 'slide-left', label: 'Slide from Right', desc: 'Horizontal slide animation' },
    { id: 'slide-right', label: 'Slide from Left', desc: 'Horizontal slide animation' },
    { id: 'zoom', label: 'Zoom In', desc: 'Scales up dynamically' },
    { id: 'flip', label: 'Flip 3D', desc: 'Perspective flip rotation' },
  ];

  function handleSave(applyToAll: boolean = false) {
    dispatch('apply', {
      transition: { type: tempType, durationSec: tempDuration },
      applyToAll,
    });
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
          <Sparkles size={16} class="text-orange-500" />
          <h3 class="font-bold text-sm text-slate-800">Slide Transitions</h3>
        </div>
        <button
          class="p-1 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700"
          on:click={() => dispatch('close')}
        >
          <X size={16} />
        </button>
      </div>

      <div class="space-y-4">
        <!-- Transition List -->
        <div>
          <span class="block font-semibold text-slate-700 mb-1.5">Transition Animation</span>
          <div class="space-y-1.5 max-h-52 overflow-y-auto pr-1">
            {#each transitionOptions as opt}
              <button
                class="w-full text-left px-3 py-2 rounded-xl border transition-all flex items-center justify-between {tempType === opt.id
                  ? 'border-orange-500 bg-orange-50/70 font-semibold text-orange-950 ring-1 ring-orange-400/40'
                  : 'border-slate-200 hover:bg-slate-50 text-slate-700'}"
                on:click={() => (tempType = opt.id)}
              >
                <div>
                  <div class="text-xs">{opt.label}</div>
                  <div class="text-[10px] text-slate-400 font-normal">{opt.desc}</div>
                </div>
                {#if tempType === opt.id}
                  <Check size={14} class="text-orange-600 shrink-0" />
                {/if}
              </button>
            {/each}
          </div>
        </div>

        <!-- Duration Slider -->
        {#if tempType !== 'none'}
          <div class="pt-2 border-t border-slate-100">
            <div class="flex items-center justify-between font-semibold text-slate-700 mb-1">
              <span>Duration</span>
              <span class="text-orange-600 font-mono text-[11px]">{tempDuration.toFixed(1)}s</span>
            </div>
            <input
              type="range"
              min="0.2"
              max="2.0"
              step="0.1"
              bind:value={tempDuration}
              class="w-full accent-orange-500 cursor-pointer"
            />
            <div class="flex justify-between text-[9px] text-slate-400 mt-0.5">
              <span>Fast (0.2s)</span>
              <span>Medium (0.8s)</span>
              <span>Slow (2.0s)</span>
            </div>
          </div>
        {/if}
      </div>

      <!-- Action Buttons -->
      <div class="pt-5 border-t border-slate-100 mt-5 flex items-center justify-between">
        <button
          class="text-xs text-orange-600 hover:text-orange-700 font-semibold"
          on:click={() => handleSave(true)}
        >
          Apply to All Slides
        </button>

        <div class="flex items-center space-x-2">
          <button
            class="px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-medium"
            on:click={() => dispatch('close')}
          >
            Cancel
          </button>
          <button
            class="px-4 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold shadow-xs"
            on:click={() => handleSave(false)}
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}
