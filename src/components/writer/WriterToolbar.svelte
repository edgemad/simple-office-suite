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
    RemoveFormatting
  } from 'lucide-svelte';

  const dispatch = createEventDispatcher<{
    format: { command: string; value?: string };
    insertTable: void;
  }>();

  let activeBlock = 'p';

  function exec(command: string, value: string = '') {
    dispatch('format', { command, value });
  }

  function handleBlockChange(e: Event) {
    const val = (e.target as HTMLSelectElement).value;
    exec('formatBlock', val);
    activeBlock = val;
  }
</script>

<div class="no-print h-10 bg-white border-b border-slate-200 px-4 flex items-center space-x-1 overflow-x-auto select-none text-slate-700 text-xs">
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
  <div class="px-2 border-r border-slate-200">
    <select
      bind:value={activeBlock}
      on:change={handleBlockChange}
      class="bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs text-slate-700 outline-none hover:bg-slate-100 cursor-pointer font-medium"
    >
      <option value="p">Paragraph</option>
      <option value="h1">Heading 1</option>
      <option value="h2">Heading 2</option>
      <option value="h3">Heading 3</option>
      <option value="blockquote">Blockquote</option>
      <option value="pre">Code Block</option>
    </select>
  </div>

  <!-- Text Formatting -->
  <div class="flex items-center space-x-0.5 px-2 border-r border-slate-200">
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
  </div>

  <!-- Alignment -->
  <div class="flex items-center space-x-0.5 px-2 border-r border-slate-200">
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
  <div class="flex items-center space-x-0.5 px-2 border-r border-slate-200">
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

  <!-- Inserts & Cleanup -->
  <div class="flex items-center space-x-0.5 pl-2">
    <button
      class="p-1.5 rounded hover:bg-slate-100 hover:text-slate-900 transition-colors"
      on:click={() => dispatch('insertTable')}
      title="Insert Table (3x3)"
    >
      <Table size={15} />
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
  </div>
</div>
