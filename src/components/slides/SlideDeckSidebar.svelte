<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { Slide } from '../../types';
  import { Plus, Copy, Trash2, ArrowUp, ArrowDown } from '@lucide/svelte';

  export let slides: Slide[];
  export let activeSlideIndex: number = 0;

  const dispatch = createEventDispatcher<{
    selectSlide: number;
    addSlide: void;
    duplicateSlide: number;
    deleteSlide: number;
    moveSlide: { from: number; to: number };
  }>();

  function move(idx: number, delta: number) {
    const target = idx + delta;
    if (target >= 0 && target < slides.length) {
      dispatch('moveSlide', { from: idx, to: target });
    }
  }
</script>

<aside class="no-print w-56 bg-slate-50 border-r border-slate-200 flex flex-col h-full select-none">
  <!-- Sidebar Header -->
  <div class="h-10 px-3 border-b border-slate-200 flex items-center justify-between text-xs font-semibold text-slate-700 bg-white">
    <span>Slides ({slides.length})</span>
    <button
      class="p-1 rounded hover:bg-orange-50 text-orange-600 transition-colors"
      on:click={() => dispatch('addSlide')}
      title="Add Slide"
    >
      <Plus size={16} />
    </button>
  </div>

  <!-- Slide Thumbnails Container -->
  <div class="flex-1 overflow-y-auto p-3 space-y-3">
    {#each slides as slide, idx}
      {@const isActive = idx === activeSlideIndex}
      <div
        role="button"
        tabindex="0"
        aria-label={`Slide ${idx + 1}${slide.title ? `: ${slide.title}` : ''}`}
        aria-pressed={isActive}
        class="group relative rounded-lg border-2 p-1.5 transition-all cursor-pointer bg-white shadow-sm hover:shadow
          {isActive ? 'border-orange-500 ring-2 ring-orange-200' : 'border-slate-200 hover:border-slate-300'}"
        on:click={() => dispatch('selectSlide', idx)}
        on:keydown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            dispatch('selectSlide', idx);
          }
        }}
      >
        <!-- Slide Mini Thumbnail (16:9) -->
        <div
          class="w-full aspect-video rounded overflow-hidden p-2 flex flex-col justify-between border border-slate-100"
          style="background-color: {slide.bgColor}; color: {slide.bgColor === '#ffffff' || slide.bgColor === '#f8fafc' ? '#1e293b' : '#ffffff'};"
        >
          <div class="text-[9px] font-bold truncate line-clamp-1">
            {slide.title || `Slide ${idx + 1}`}
          </div>
          <div class="flex items-center justify-between text-[7px] opacity-60">
            <span>{slide.elements.length} elements</span>
            <span>#{idx + 1}</span>
          </div>
        </div>

        <!-- Hover Action Toolbar -->
        <div class="absolute top-2 right-2 hidden group-hover:flex items-center space-x-1 bg-white/90 backdrop-blur rounded p-0.5 shadow border border-slate-200 text-slate-600">
          {#if idx > 0}
            <button
              class="p-1 hover:text-slate-900 rounded"
              on:click|stopPropagation={() => move(idx, -1)}
              title="Move Up"
            >
              <ArrowUp size={11} />
            </button>
          {/if}
          {#if idx < slides.length - 1}
            <button
              class="p-1 hover:text-slate-900 rounded"
              on:click|stopPropagation={() => move(idx, 1)}
              title="Move Down"
            >
              <ArrowDown size={11} />
            </button>
          {/if}
          <button
            class="p-1 hover:text-orange-600 rounded"
            on:click|stopPropagation={() => dispatch('duplicateSlide', idx)}
            title="Duplicate Slide"
          >
            <Copy size={11} />
          </button>
          {#if slides.length > 1}
            <button
              class="p-1 hover:text-rose-600 rounded"
              on:click|stopPropagation={() => dispatch('deleteSlide', idx)}
              title="Delete Slide"
            >
              <Trash2 size={11} />
            </button>
          {/if}
        </div>
      </div>
    {/each}
  </div>
</aside>
