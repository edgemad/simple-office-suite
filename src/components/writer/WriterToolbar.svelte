<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import {
    Bold,
    Italic,
    Underline,
    Strikethrough,
    AlignLeft,
    AlignCenter,
    AlignRight,
    AlignJustify,
    List,
    ListOrdered,
    Quote,
    Code,
    Table,
    Minus,
    Undo2,
    Redo2,
    RemoveFormatting,
    Image,
    Link,
    Subscript,
    Superscript,
    Search,
    Type,
    Baseline,
    Highlighter
  } from 'lucide-svelte';

  const dispatch = createEventDispatcher<{
    format: { command: string; value?: string };
    insertTable: void;
    insertImage: void;
    insertLink: void;
    toggleSearch: void;
  }>();

  let activeBlock = 'p';
  let selectedFont = 'Inter, sans-serif';
  let selectedSize = '3'; // execCommand font size 1-7 or inline style
  let textColor = '#000000';
  let highlightColor = '#ffff00';

  const fontFamilies = [
    { label: 'Default (Sans)', value: 'Inter, -apple-system, sans-serif' },
    { label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
    { label: 'Times New Roman', value: '"Times New Roman", Times, serif' },
    { label: 'Georgia', value: 'Georgia, serif' },
    { label: 'Merriweather', value: 'Merriweather, serif' },
    { label: 'JetBrains Mono', value: '"JetBrains Mono", Consolas, monospace' },
    { label: 'Courier New', value: '"Courier New", Courier, monospace' },
    { label: 'Trebuchet MS', value: '"Trebuchet MS", sans-serif' },
    { label: 'Verdana', value: 'Verdana, sans-serif' },
  ];

  const fontSizes = [
    { label: '9pt', value: '1' },
    { label: '10pt', value: '2' },
    { label: '11pt (Normal)', value: '3' },
    { label: '14pt (Subhead)', value: '4' },
    { label: '18pt (Heading)', value: '5' },
    { label: '24pt (Title)', value: '6' },
    { label: '36pt (Display)', value: '7' },
  ];

  function exec(command: string, value: string = '') {
    dispatch('format', { command, value });
  }

  function handleBlockChange(e: Event) {
    const val = (e.target as HTMLSelectElement).value;
    exec('formatBlock', val);
    activeBlock = val;
  }

  function handleFontChange(e: Event) {
    const val = (e.target as HTMLSelectElement).value;
    selectedFont = val;
    exec('fontName', val);
  }

  function handleSizeChange(e: Event) {
    const val = (e.target as HTMLSelectElement).value;
    selectedSize = val;
    exec('fontSize', val);
  }

  function handleTextColor(e: Event) {
    const color = (e.target as HTMLInputElement).value;
    textColor = color;
    exec('foreColor', color);
  }

  function handleHighlightColor(e: Event) {
    const color = (e.target as HTMLInputElement).value;
    highlightColor = color;
    exec('hiliteColor', color);
  }
</script>

<div class="no-print bg-white border-b border-slate-200 px-3 py-1 flex items-center space-x-1.5 overflow-x-auto select-none text-slate-700 text-xs shadow-sm">
  <!-- Undo / Redo -->
  <div class="flex items-center space-x-0.5 pr-2 border-r border-slate-200">
    <button
      class="p-1.5 rounded hover:bg-slate-100 hover:text-slate-900 transition-colors"
      on:click={() => exec('undo')}
      title="Undo (Ctrl+Z)"
    >
      <Undo2 size={15} />
    </button>
    <button
      class="p-1.5 rounded hover:bg-slate-100 hover:text-slate-900 transition-colors"
      on:click={() => exec('redo')}
      title="Redo (Ctrl+Y)"
    >
      <Redo2 size={15} />
    </button>
  </div>

  <!-- Style Dropdown (Headings) -->
  <div class="px-1 border-r border-slate-200">
    <select
      bind:value={activeBlock}
      on:change={handleBlockChange}
      class="h-7 bg-slate-50 border border-slate-200 rounded px-2 text-xs text-slate-700 outline-none hover:bg-slate-100 cursor-pointer font-medium"
      title="Styles / Headings"
    >
      <option value="p">Normal text</option>
      <option value="h1">Title (H1)</option>
      <option value="h2">Subtitle (H2)</option>
      <option value="h3">Heading (H3)</option>
      <option value="blockquote">Quote block</option>
      <option value="pre">Code block</option>
    </select>
  </div>

  <!-- Font Family Selector (User Requested) -->
  <div class="px-1 border-r border-slate-200">
    <select
      bind:value={selectedFont}
      on:change={handleFontChange}
      class="h-7 max-w-[130px] bg-slate-50 border border-slate-200 rounded px-2 text-xs text-slate-700 outline-none hover:bg-slate-100 cursor-pointer font-medium truncate"
      title="Font Family"
    >
      {#each fontFamilies as font}
        <option value={font.value}>{font.label}</option>
      {/each}
    </select>
  </div>

  <!-- Font Size Selector (User Requested) -->
  <div class="px-1 border-r border-slate-200">
    <select
      bind:value={selectedSize}
      on:change={handleSizeChange}
      class="h-7 bg-slate-50 border border-slate-200 rounded px-1.5 text-xs text-slate-700 outline-none hover:bg-slate-100 cursor-pointer font-medium"
      title="Font Size"
    >
      {#each fontSizes as s}
        <option value={s.value}>{s.label}</option>
      {/each}
    </select>
  </div>

  <!-- Text Formatting -->
  <div class="flex items-center space-x-0.5 px-1 border-r border-slate-200">
    <button
      class="p-1.5 rounded hover:bg-slate-100 hover:text-slate-900 transition-colors font-bold"
      on:click={() => exec('bold')}
      title="Bold (Ctrl+B)"
    >
      <Bold size={15} />
    </button>
    <button
      class="p-1.5 rounded hover:bg-slate-100 hover:text-slate-900 transition-colors"
      on:click={() => exec('italic')}
      title="Italic (Ctrl+I)"
    >
      <Italic size={15} />
    </button>
    <button
      class="p-1.5 rounded hover:bg-slate-100 hover:text-slate-900 transition-colors"
      on:click={() => exec('underline')}
      title="Underline (Ctrl+U)"
    >
      <Underline size={15} />
    </button>
    <button
      class="p-1.5 rounded hover:bg-slate-100 hover:text-slate-900 transition-colors"
      on:click={() => exec('strikeThrough')}
      title="Strikethrough"
    >
      <Strikethrough size={15} />
    </button>
    <button
      class="p-1.5 rounded hover:bg-slate-100 hover:text-slate-900 transition-colors"
      on:click={() => exec('subscript')}
      title="Subscript"
    >
      <Subscript size={15} />
    </button>
    <button
      class="p-1.5 rounded hover:bg-slate-100 hover:text-slate-900 transition-colors"
      on:click={() => exec('superscript')}
      title="Superscript"
    >
      <Superscript size={15} />
    </button>
  </div>

  <!-- Color & Highlight Pickers -->
  <div class="flex items-center space-x-1 px-1 border-r border-slate-200">
    <label class="p-1 rounded hover:bg-slate-100 cursor-pointer flex items-center space-x-0.5 relative" title="Text Color">
      <Baseline size={15} style="color: {textColor};" />
      <input type="color" bind:value={textColor} on:input={handleTextColor} class="opacity-0 absolute inset-0 w-full h-full cursor-pointer" />
    </label>
    <label class="p-1 rounded hover:bg-slate-100 cursor-pointer flex items-center space-x-0.5 relative" title="Highlight Color">
      <Highlighter size={15} style="color: {highlightColor === '#ffffff' ? '#eab308' : highlightColor};" />
      <input type="color" bind:value={highlightColor} on:input={handleHighlightColor} class="opacity-0 absolute inset-0 w-full h-full cursor-pointer" />
    </label>
  </div>

  <!-- Alignment -->
  <div class="flex items-center space-x-0.5 px-1 border-r border-slate-200">
    <button
      class="p-1.5 rounded hover:bg-slate-100 hover:text-slate-900 transition-colors"
      on:click={() => exec('justifyLeft')}
      title="Align Left"
    >
      <AlignLeft size={15} />
    </button>
    <button
      class="p-1.5 rounded hover:bg-slate-100 hover:text-slate-900 transition-colors"
      on:click={() => exec('justifyCenter')}
      title="Align Center"
    >
      <AlignCenter size={15} />
    </button>
    <button
      class="p-1.5 rounded hover:bg-slate-100 hover:text-slate-900 transition-colors"
      on:click={() => exec('justifyRight')}
      title="Align Right"
    >
      <AlignRight size={15} />
    </button>
    <button
      class="p-1.5 rounded hover:bg-slate-100 hover:text-slate-900 transition-colors"
      on:click={() => exec('justifyFull')}
      title="Justify"
    >
      <AlignJustify size={15} />
    </button>
  </div>

  <!-- Lists & Quotes -->
  <div class="flex items-center space-x-0.5 px-1 border-r border-slate-200">
    <button
      class="p-1.5 rounded hover:bg-slate-100 hover:text-slate-900 transition-colors"
      on:click={() => exec('insertUnorderedList')}
      title="Bullet List"
    >
      <List size={15} />
    </button>
    <button
      class="p-1.5 rounded hover:bg-slate-100 hover:text-slate-900 transition-colors"
      on:click={() => exec('insertOrderedList')}
      title="Numbered List"
    >
      <ListOrdered size={15} />
    </button>
    <button
      class="p-1.5 rounded hover:bg-slate-100 hover:text-slate-900 transition-colors"
      on:click={() => exec('formatBlock', 'blockquote')}
      title="Quote"
    >
      <Quote size={15} />
    </button>
    <button
      class="p-1.5 rounded hover:bg-slate-100 hover:text-slate-900 transition-colors"
      on:click={() => exec('formatBlock', 'pre')}
      title="Code Block"
    >
      <Code size={15} />
    </button>
  </div>

  <!-- Inserts: Table, Image, Link, Divider -->
  <div class="flex items-center space-x-0.5 pl-1">
    <button
      class="p-1.5 rounded hover:bg-slate-100 hover:text-slate-900 transition-colors"
      on:click={() => dispatch('insertTable')}
      title="Insert Table (3x3)"
    >
      <Table size={15} />
    </button>
    <button
      class="p-1.5 rounded hover:bg-slate-100 hover:text-slate-900 transition-colors"
      on:click={() => dispatch('insertImage')}
      title="Insert Local Image"
    >
      <Image size={15} />
    </button>
    <button
      class="p-1.5 rounded hover:bg-slate-100 hover:text-slate-900 transition-colors"
      on:click={() => dispatch('insertLink')}
      title="Insert Hyperlink (Ctrl+K)"
    >
      <Link size={15} />
    </button>
    <button
      class="p-1.5 rounded hover:bg-slate-100 hover:text-slate-900 transition-colors"
      on:click={() => exec('insertHorizontalRule')}
      title="Horizontal Divider"
    >
      <Minus size={15} />
    </button>
    <button
      class="p-1.5 rounded hover:bg-slate-100 hover:text-slate-900 transition-colors text-slate-500 hover:text-rose-600"
      on:click={() => exec('removeFormat')}
      title="Clear Formatting"
    >
      <RemoveFormatting size={15} />
    </button>
    <button
      class="p-1.5 rounded hover:bg-slate-100 hover:text-slate-900 transition-colors ml-1 text-slate-600"
      on:click={() => dispatch('toggleSearch')}
      title="Find and Replace (Ctrl+F)"
    >
      <Search size={15} />
    </button>
  </div>
</div>
