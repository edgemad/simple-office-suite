<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { WorkspaceMode, DocumentMeta } from '../../types';
  import {
    FileText,
    Sheet,
    Presentation,
    FolderOpen,
    Save,
    Download,
    FilePlus,
    Printer,
    ChevronDown,
    FileCode,
    FileType
  } from 'lucide-svelte';

  export let activeMode: WorkspaceMode;
  export let meta: DocumentMeta;

  const dispatch = createEventDispatcher<{
    changeMode: WorkspaceMode;
    newDoc: void;
    openDoc: void;
    saveDoc: void;
    saveAsDoc: void;
    exportFormat: { format: string };
    printPdf: void;
  }>();

  let isRenaming = false;
  let tempTitle = meta.title;
  let showExportMenu = false;

  function commitRename() {
    if (tempTitle.trim()) {
      meta.title = tempTitle.trim();
      meta.isDirty = true;
    }
    isRenaming = false;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') commitRename();
    if (e.key === 'Escape') {
      tempTitle = meta.title;
      isRenaming = false;
    }
  }

  function handleExport(format: string) {
    showExportMenu = false;
    dispatch('exportFormat', { format });
  }
</script>

<header class="no-print h-14 bg-white border-b border-slate-200 px-4 flex items-center justify-between select-none z-30 relative shadow-sm">
  <!-- Left: Branding & Module Switcher -->
  <div class="flex items-center space-x-6">
    <div class="flex items-center space-x-2">
      <div class="w-8 h-8 rounded-lg bg-gradient-to-tr from-sky-600 to-indigo-600 flex items-center justify-center text-white font-bold shadow-md shadow-sky-500/20">
        <span class="text-xs tracking-wider">SOS</span>
      </div>
      <span class="font-bold text-slate-800 text-sm tracking-tight hidden sm:inline">Simple Office</span>
    </div>

    <!-- Workspace Tabs -->
    <nav class="flex items-center space-x-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
      <button
        class="flex items-center space-x-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all {activeMode === 'writer' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}"
        on:click={() => dispatch('changeMode', 'writer')}
      >
        <FileText size={15} />
        <span>Writer</span>
      </button>

      <button
        class="flex items-center space-x-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all {activeMode === 'sheets' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}"
        on:click={() => dispatch('changeMode', 'sheets')}
      >
        <Sheet size={15} />
        <span>Sheets</span>
      </button>

      <button
        class="flex items-center space-x-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all {activeMode === 'slides' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}"
        on:click={() => dispatch('changeMode', 'slides')}
      >
        <Presentation size={15} />
        <span>Slides</span>
      </button>
    </nav>
  </div>

  <!-- Center: Document Title & File Actions -->
  <div class="flex items-center space-x-4">
    <div class="flex items-center space-x-2">
      {#if isRenaming}
        <input
          type="text"
          bind:value={tempTitle}
          on:blur={commitRename}
          on:keydown={handleKeydown}
          class="border border-blue-400 px-2 py-1 rounded text-sm font-medium outline-none shadow-inner"
        />
      {:else}
        <button
          class="font-semibold text-slate-700 hover:text-slate-950 text-sm hover:bg-slate-100 px-2.5 py-1 rounded-md transition-colors flex items-center space-x-1.5"
          on:click={() => { tempTitle = meta.title; isRenaming = true; }}
          title="Click to rename document"
        >
          <span>{meta.title}</span>
          {#if meta.isDirty}
            <span class="w-2 h-2 rounded-full bg-amber-500 inline-block animate-pulse" title="Unsaved changes"></span>
          {/if}
        </button>
      {/if}
    </div>

    <!-- Quick File Action Buttons -->
    <div class="flex items-center space-x-1 border-l border-slate-200 pl-3">
      <button
        class="p-1.5 rounded hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors"
        on:click={() => dispatch('newDoc')}
        title="New Document (Ctrl+N)"
      >
        <FilePlus size={16} />
      </button>

      <button
        class="p-1.5 rounded hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors"
        on:click={() => dispatch('openDoc')}
        title="Open File (Ctrl+O) - Supports all formats"
      >
        <FolderOpen size={16} />
      </button>

      <button
        class="p-1.5 rounded hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors flex items-center space-x-1"
        on:click={() => dispatch('saveDoc')}
        title="Save File (Ctrl+S)"
      >
        <Save size={16} class={meta.isDirty ? 'text-blue-600' : ''} />
      </button>

      <button
        class="p-1.5 rounded hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors"
        on:click={() => dispatch('printPdf')}
        title="Print / Save to PDF (Ctrl+P)"
      >
        <Printer size={16} />
      </button>
    </div>
  </div>

  <!-- Right: Clean Export Dropdown Menu (No offline/RAM badges) -->
  <div class="relative">
    <button
      class="flex items-center space-x-1.5 px-3 py-1.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition-colors border border-slate-200"
      on:click={() => (showExportMenu = !showExportMenu)}
    >
      <Download size={14} class="text-slate-500" />
      <span>Export As</span>
      <ChevronDown size={13} class="text-slate-400" />
    </button>

    {#if showExportMenu}
      <div
        class="absolute right-0 mt-1.5 w-52 bg-white rounded-lg shadow-xl border border-slate-200 py-1 z-50 text-xs text-slate-700 divide-y divide-slate-100"
      >
        {#if activeMode === 'writer'}
          <div class="py-1">
            <button
              class="w-full px-3 py-1.5 text-left hover:bg-blue-50 flex items-center justify-between"
              on:click={() => handleExport('docx')}
            >
              <span class="font-medium">Microsoft Word (.docx)</span>
              <span class="text-[10px] text-slate-400">DOCX</span>
            </button>
            <button
              class="w-full px-3 py-1.5 text-left hover:bg-blue-50 flex items-center justify-between"
              on:click={() => handleExport('rtf')}
            >
              <span>Rich Text (.rtf)</span>
              <span class="text-[10px] text-slate-400">RTF</span>
            </button>
            <button
              class="w-full px-3 py-1.5 text-left hover:bg-blue-50 flex items-center justify-between"
              on:click={() => handleExport('md')}
            >
              <span>Markdown (.md)</span>
              <span class="text-[10px] text-slate-400">MD</span>
            </button>
            <button
              class="w-full px-3 py-1.5 text-left hover:bg-blue-50 flex items-center justify-between"
              on:click={() => handleExport('txt')}
            >
              <span>Plain Text (.txt)</span>
              <span class="text-[10px] text-slate-400">TXT</span>
            </button>
            <button
              class="w-full px-3 py-1.5 text-left hover:bg-blue-50 flex items-center justify-between"
              on:click={() => handleExport('html')}
            >
              <span>HTML Document (.html)</span>
              <span class="text-[10px] text-slate-400">HTML</span>
            </button>
          </div>
        {:else if activeMode === 'sheets'}
          <div class="py-1">
            <button
              class="w-full px-3 py-1.5 text-left hover:bg-emerald-50 flex items-center justify-between"
              on:click={() => handleExport('xlsx')}
            >
              <span class="font-medium">Microsoft Excel (.xlsx)</span>
              <span class="text-[10px] text-slate-400">XLSX</span>
            </button>
            <button
              class="w-full px-3 py-1.5 text-left hover:bg-emerald-50 flex items-center justify-between"
              on:click={() => handleExport('csv')}
            >
              <span>Comma Separated (.csv)</span>
              <span class="text-[10px] text-slate-400">CSV</span>
            </button>
            <button
              class="w-full px-3 py-1.5 text-left hover:bg-emerald-50 flex items-center justify-between"
              on:click={() => handleExport('tsv')}
            >
              <span>Tab Separated (.tsv)</span>
              <span class="text-[10px] text-slate-400">TSV</span>
            </button>
          </div>
        {:else if activeMode === 'slides'}
          <div class="py-1">
            <button
              class="w-full px-3 py-1.5 text-left hover:bg-orange-50 flex items-center justify-between"
              on:click={() => handleExport('pptx')}
            >
              <span class="font-medium">PowerPoint Deck (.pptx)</span>
              <span class="text-[10px] text-slate-400">PPTX</span>
            </button>
            <button
              class="w-full px-3 py-1.5 text-left hover:bg-orange-50 flex items-center justify-between"
              on:click={() => handleExport('html')}
            >
              <span>Web Presentation (.html)</span>
              <span class="text-[10px] text-slate-400">HTML</span>
            </button>
          </div>
        {/if}
        <div class="py-1">
          <button
            class="w-full px-3 py-1.5 text-left hover:bg-slate-50 flex items-center justify-between font-medium text-slate-600"
            on:click={() => dispatch('printPdf')}
          >
            <span>Print / PDF Document</span>
            <span class="text-[10px] text-slate-400">PDF</span>
          </button>
          <button
            class="w-full px-3 py-1.5 text-left hover:bg-slate-50 flex items-center justify-between text-slate-500"
            on:click={() => handleExport('json')}
          >
            <span>Native Suite Backup (.json)</span>
            <span class="text-[10px] text-slate-400">JSON</span>
          </button>
        </div>
      </div>
    {/if}
  </div>
</header>
