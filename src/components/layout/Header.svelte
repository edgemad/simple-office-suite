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
    ShieldCheck,
    Cpu
  } from 'lucide-svelte';

  export let activeMode: WorkspaceMode;
  export let meta: DocumentMeta;
  export let memoryUsageMb: number = 42.5;

  const dispatch = createEventDispatcher<{
    changeMode: WorkspaceMode;
    newDoc: void;
    openDoc: void;
    saveDoc: void;
    saveAsDoc: void;
    exportMarkdown: void;
    exportPdf: void;
    exportCsv: void;
  }>();

  let isRenaming = false;
  let tempTitle = meta.title;

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
          autofocus
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
        title="New File (Ctrl+N)"
      >
        <FilePlus size={16} />
      </button>

      <button
        class="p-1.5 rounded hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors"
        on:click={() => dispatch('openDoc')}
        title="Open File (Ctrl+O)"
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

      {#if activeMode === 'writer'}
        <button
          class="p-1.5 rounded hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors"
          on:click={() => dispatch('exportMarkdown')}
          title="Export as Markdown"
        >
          <Download size={16} />
        </button>
        <button
          class="p-1.5 rounded hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors"
          on:click={() => dispatch('exportPdf')}
          title="Print / Save to PDF (Ctrl+P)"
        >
          <Printer size={16} />
        </button>
      {:else if activeMode === 'sheets'}
        <button
          class="p-1.5 rounded hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors"
          on:click={() => dispatch('exportCsv')}
          title="Export CSV"
        >
          <Download size={16} />
        </button>
      {/if}
    </div>
  </div>

  <!-- Right: Offline Status & Memory Metrics -->
  <div class="flex items-center space-x-3 text-xs">
    <div class="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80 font-medium">
      <ShieldCheck size={14} class="text-emerald-600" />
      <span class="hidden md:inline">100% Offline Safe</span>
    </div>

    <div class="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
      <Cpu size={14} class="text-slate-500" />
      <span>{memoryUsageMb.toFixed(1)} MB RAM</span>
    </div>
  </div>
</header>
