<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import {
    Heading,
    Type,
    Square,
    Code2,
    Image,
    Play,
    Palette,
    Trash2,
    Plus
  } from 'lucide-svelte';
  import type { SlideElementType } from '../../types';

  export let selectedElementId: string | null = null;
  export let slideBgColor: string = '#ffffff';

  const dispatch = createEventDispatcher<{
    addElement: { type: SlideElementType };
    deleteElement: void;
    changeBg: string;
    present: void;
    addSlide: void;
  }>();

  const bgColors = [
    { label: 'White', color: '#ffffff' },
    { label: 'Off-White', color: '#f8fafc' },
    { label: 'Navy Dark', color: '#0f172a' },
    { label: 'Indigo', color: '#1e1b4b' },
    { label: 'Emerald Dark', color: '#064e3b' },
  ];
</script>

<div class="no-print h-10 bg-white border-b border-slate-200 px-4 flex items-center justify-between select-none text-xs text-slate-700">
  <div class="flex items-center space-x-2">
    <!-- Add Slide Button -->
    <button
      class="flex items-center space-x-1 px-2.5 py-1 rounded bg-orange-50 hover:bg-orange-100 text-orange-700 font-medium transition-colors"
      on:click={() => dispatch('addSlide')}
      title="Add new slide"
    >
      <Plus size={14} />
      <span>New Slide</span>
    </button>

    <div class="h-4 w-px bg-slate-200"></div>

    <!-- Insert Elements -->
    <div class="flex items-center space-x-0.5">
      <button
        class="flex items-center space-x-1 px-2 py-1 rounded hover:bg-slate-100 text-slate-700"
        on:click={() => dispatch('addElement', { type: 'title' })}
        title="Insert Title Block"
      >
        <Heading size={14} />
        <span>Title</span>
      </button>

      <button
        class="flex items-center space-x-1 px-2 py-1 rounded hover:bg-slate-100 text-slate-700"
        on:click={() => dispatch('addElement', { type: 'text' })}
        title="Insert Text Box"
      >
        <Type size={14} />
        <span>Text</span>
      </button>

      <button
        class="flex items-center space-x-1 px-2 py-1 rounded hover:bg-slate-100 text-slate-700"
        on:click={() => dispatch('addElement', { type: 'shape' })}
        title="Insert Shape Card"
      >
        <Square size={14} />
        <span>Card</span>
      </button>

      <button
        class="flex items-center space-x-1 px-2 py-1 rounded hover:bg-slate-100 text-slate-700"
        on:click={() => dispatch('addElement', { type: 'code' })}
        title="Insert Code Snippet"
      >
        <Code2 size={14} />
        <span>Code</span>
      </button>

      <button
        class="flex items-center space-x-1 px-2 py-1 rounded hover:bg-slate-100 text-slate-700"
        on:click={() => dispatch('addElement', { type: 'image' })}
        title="Insert Image Placeholder"
      >
        <Image size={14} />
        <span>Image</span>
      </button>
    </div>

    <!-- Background Color Chooser -->
    <div class="flex items-center space-x-1 border-l border-slate-200 pl-2">
      <Palette size={14} class="text-slate-400 mr-1" />
      {#each bgColors as bg}
        <button
          class="w-4 h-4 rounded-full border border-slate-300 shadow-sm transition-transform hover:scale-110 {slideBgColor === bg.color ? 'ring-2 ring-orange-500 ring-offset-1' : ''}"
          style="background-color: {bg.color}"
          on:click={() => dispatch('changeBg', bg.color)}
          title="Background: {bg.label}"
        ></button>
      {/each}
    </div>

    {#if selectedElementId}
      <button
        class="p-1 rounded hover:bg-rose-50 text-rose-600 transition-colors ml-2"
        on:click={() => dispatch('deleteElement')}
        title="Delete Selected Element"
      >
        <Trash2 size={15} />
      </button>
    {/if}
  </div>

  <!-- Present Fullscreen Button -->
  <div>
    <button
      class="flex items-center space-x-1.5 px-3 py-1 rounded-md bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-medium shadow-sm transition-all"
      on:click={() => dispatch('present')}
      title="Start Fullscreen Presentation (F5)"
    >
      <Play size={13} fill="currentColor" />
      <span>Present</span>
    </button>
  </div>
</div>
