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
    Plus,
    LayoutTemplate,
    Sparkles,
    Baseline,
    TrendingUp,
    Table,
    BarChart3,
    AlignLeft,
    AlignCenter,
    AlignRight
  } from 'lucide-svelte';
  import type { SlideElementType } from '../../types';

  export let selectedElementId: string | null = null;
  export let slideBgColor: string = '#ffffff';
  export let selectedFont: string = 'Inter, sans-serif';
  export let selectedFontSize: number = 24;
  export let selectedColor: string = '#0f172a';

  const dispatch = createEventDispatcher<{
    addElement: { type: SlideElementType };
    addShape: string;
    addTable: void;
    addChart: void;
    openTransitions: void;
    alignElement: { alignment: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom' };
    bringToFront: void;
    sendToBack: void;
    deleteElement: void;
    changeBg: string;
    changeFont: string;
    changeFontSize: number;
    changeColor: string;
    applyLayout: string;
    present: void;
    addSlide: void;
    uploadImage: void;
  }>();

  const fontFamilies = [
    { label: 'Sans (Default)', value: 'Inter, sans-serif' },
    { label: 'Arial', value: 'Arial, sans-serif' },
    { label: 'Times New Roman', value: '"Times New Roman", serif' },
    { label: 'Georgia', value: 'Georgia, serif' },
    { label: 'Merriweather', value: 'Merriweather, serif' },
    { label: 'JetBrains Mono', value: '"JetBrains Mono", monospace' },
    { label: 'Trebuchet MS', value: '"Trebuchet MS", sans-serif' },
  ];

  const fontSizes = [14, 18, 24, 32, 40, 48, 60, 72];

  const themes = [
    { label: 'Minimalist White', color: '#ffffff' },
    { label: 'Executive Slate', color: '#f8fafc' },
    { label: 'Midnight Navy', color: '#0f172a' },
    { label: 'Deep Indigo', color: '#1e1b4b' },
    { label: 'Emerald Tech', color: '#064e3b' },
    { label: 'Warm Terracotta', color: '#431407' },
  ];

  function handleFontChange(e: Event) {
    const val = (e.target as HTMLSelectElement).value;
    dispatch('changeFont', val);
  }

  function handleFontSizeChange(e: Event) {
    const val = parseInt((e.target as HTMLSelectElement).value, 10);
    dispatch('changeFontSize', val);
  }

  function handleColorChange(e: Event) {
    const val = (e.target as HTMLInputElement).value;
    dispatch('changeColor', val);
  }

  function handleImageUploadClick() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = () => {
          dispatch('addElement', { type: 'image' });
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  }
</script>

<div class="no-print bg-white border-b border-slate-200 px-3 py-1 flex items-center justify-between select-none text-xs text-slate-700 shadow-sm overflow-x-auto">
  <div class="flex items-center space-x-1.5">
    <!-- Add Slide -->
    <button
      class="flex items-center space-x-1 px-2.5 py-1 rounded bg-orange-50 hover:bg-orange-100 text-orange-700 font-medium transition-colors"
      on:click={() => dispatch('addSlide')}
      title="Add new slide"
    >
      <Plus size={14} />
      <span>New Slide</span>
    </button>

    <!-- Slide Layouts Dropdown -->
    <div class="border-r border-slate-200 pr-1.5">
      <select
        on:change={(e) => dispatch('applyLayout', e.currentTarget.value)}
        class="h-7 bg-slate-50 border border-slate-200 rounded px-2 text-xs text-slate-700 outline-none hover:bg-slate-100 cursor-pointer font-medium"
        title="Apply Slide Layout"
      >
        <option value="">Layouts...</option>
        <option value="title">Title Slide</option>
        <option value="content">Title & Content</option>
        <option value="two-column">Two Columns Comparison</option>
        <option value="stat">Big Stat / KPI Callout</option>
        <option value="blank">Blank Slide</option>
      </select>
    </div>

    <!-- Font Family (User Requested) -->
    <div class="border-r border-slate-200 pr-1.5">
      <select
        bind:value={selectedFont}
        on:change={handleFontChange}
        class="h-7 bg-slate-50 border border-slate-200 rounded px-2 text-xs text-slate-700 outline-none hover:bg-slate-100 cursor-pointer font-medium"
        title="Font Family"
      >
        {#each fontFamilies as font}
          <option value={font.value}>{font.label}</option>
        {/each}
      </select>
    </div>

    <!-- Font Size (User Requested) -->
    <div class="border-r border-slate-200 pr-1.5">
      <select
        bind:value={selectedFontSize}
        on:change={handleFontSizeChange}
        class="h-7 bg-slate-50 border border-slate-200 rounded px-1.5 text-xs text-slate-700 outline-none hover:bg-slate-100 cursor-pointer font-medium"
        title="Font Size"
      >
        {#each fontSizes as s}
          <option value={s}>{s}px</option>
        {/each}
      </select>
    </div>

    <!-- Font Color Picker -->
    <div class="flex items-center space-x-1 border-r border-slate-200 pr-1.5">
      <label class="p-1 rounded hover:bg-slate-100 cursor-pointer relative" title="Text Color">
        <Baseline size={14} style="color: {selectedColor};" />
        <input type="color" bind:value={selectedColor} on:input={handleColorChange} class="opacity-0 absolute inset-0 w-full h-full cursor-pointer" />
      </label>
    </div>

    <!-- Insert Elements -->
    <div class="flex items-center space-x-0.5 border-r border-slate-200 pr-1.5">
      <button
        class="flex items-center space-x-1 px-1.5 py-1 rounded hover:bg-slate-100 text-slate-700"
        on:click={() => dispatch('addElement', { type: 'title' })}
        title="Insert Title"
      >
        <Heading size={13} />
        <span>Title</span>
      </button>

      <button
        class="flex items-center space-x-1 px-1.5 py-1 rounded hover:bg-slate-100 text-slate-700"
        on:click={() => dispatch('addElement', { type: 'text' })}
        title="Insert Text Box"
      >
        <Type size={13} />
        <span>Text</span>
      </button>

      <!-- Shapes Dropdown (Google Slides) -->
      <div class="pr-1">
        <select
          on:change={(e) => {
            const val = e.currentTarget.value;
            if (val) {
              dispatch('addShape', val);
              e.currentTarget.value = '';
            }
          }}
          class="h-7 bg-slate-50 border border-slate-200 rounded px-1.5 text-xs text-slate-700 outline-none hover:bg-slate-100 cursor-pointer font-medium"
          title="Insert Shape (Google Slides)"
        >
          <option value="">Shapes...</option>
          <option value="rectangle">Card / Box</option>
          <option value="circle">Circle / Ellipse</option>
          <option value="pill">Pill / Badge</option>
          <option value="star">Star Milestone ★</option>
          <option value="arrow-right">Process Arrow ➔</option>
          <option value="arrow-left">Return Arrow ⬅</option>
          <option value="diamond">Decision Diamond ◊</option>
          <option value="triangle">Priority Triangle ▲</option>
          <option value="callout">Callout Quote 💬</option>
          <option value="banner">Ribbon Banner 🏷</option>
        </select>
      </div>

      <button
        class="flex items-center space-x-1 px-1.5 py-1 rounded hover:bg-slate-100 text-slate-700"
        on:click={() => dispatch('addTable')}
        title="Insert Editable Table"
      >
        <Table size={13} />
        <span>Table</span>
      </button>

      <button
        class="flex items-center space-x-1 px-1.5 py-1 rounded hover:bg-slate-100 text-slate-700"
        on:click={() => dispatch('addChart')}
        title="Insert Chart (Bar, Column)"
      >
        <BarChart3 size={13} />
        <span>Chart</span>
      </button>

      <button
        class="flex items-center space-x-1 px-1.5 py-1 rounded hover:bg-slate-100 text-slate-700"
        on:click={() => dispatch('addElement', { type: 'stat' })}
        title="Insert Stat / Metric"
      >
        <TrendingUp size={13} />
        <span>Metric</span>
      </button>

      <button
        class="flex items-center space-x-1 px-1.5 py-1 rounded hover:bg-slate-100 text-slate-700"
        on:click={() => dispatch('addElement', { type: 'code' })}
        title="Insert Code Snippet"
      >
        <Code2 size={13} />
        <span>Code</span>
      </button>

      <button
        class="flex items-center space-x-1 px-1.5 py-1 rounded hover:bg-slate-100 text-slate-700"
        on:click={handleImageUploadClick}
        title="Insert Image (Local Upload)"
      >
        <Image size={13} />
        <span>Image</span>
      </button>

      <button
        class="flex items-center space-x-1 px-2 py-1 rounded bg-orange-50 hover:bg-orange-100 text-orange-800 font-medium transition-colors ml-1"
        on:click={() => dispatch('openTransitions')}
        title="Slide Transitions"
      >
        <Sparkles size={13} class="text-orange-500" />
        <span>Transitions</span>
      </button>
    </div>

    <!-- Slide Themes / Backgrounds -->
    <div class="flex items-center space-x-1">
      <Palette size={13} class="text-slate-400 mr-0.5" />
      {#each themes as t}
        <button
          class="w-4 h-4 rounded-full border border-slate-300 shadow-sm transition-transform hover:scale-110 {slideBgColor === t.color ? 'ring-2 ring-orange-500 ring-offset-1' : ''}"
          style="background-color: {t.color}"
          on:click={() => dispatch('changeBg', t.color)}
          title="Theme: {t.label}"
        ></button>
      {/each}
    </div>

    {#if selectedElementId}
      <div class="flex items-center space-x-1 border-l border-slate-200 pl-1.5 ml-1">
        <div class="flex items-center space-x-0.5 border-r border-slate-200 pr-1">
          <button class="p-1 rounded hover:bg-slate-100 text-slate-600" on:click={() => dispatch('alignElement', { alignment: 'left' })} title="Align Left">
            <AlignLeft size={13} />
          </button>
          <button class="p-1 rounded hover:bg-slate-100 text-slate-600" on:click={() => dispatch('alignElement', { alignment: 'center' })} title="Align Center">
            <AlignCenter size={13} />
          </button>
          <button class="p-1 rounded hover:bg-slate-100 text-slate-600" on:click={() => dispatch('alignElement', { alignment: 'right' })} title="Align Right">
            <AlignRight size={13} />
          </button>
        </div>

        <button
          class="px-1.5 py-0.5 rounded hover:bg-slate-100 text-slate-700 font-medium text-[11px] transition-colors"
          on:click={() => dispatch('bringToFront')}
          title="Bring Element to Front (Ctrl+])"
        >
          Front ↑
        </button>
        <button
          class="px-1.5 py-0.5 rounded hover:bg-slate-100 text-slate-700 font-medium text-[11px] transition-colors"
          on:click={() => dispatch('sendToBack')}
          title="Send Element to Back (Ctrl+[)"
        >
          Back ↓
        </button>
        <button
          class="p-1.5 rounded hover:bg-rose-50 text-rose-600 transition-colors ml-1"
          on:click={() => dispatch('deleteElement')}
          title="Delete Selected Element"
        >
          <Trash2 size={14} />
        </button>
      </div>
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
