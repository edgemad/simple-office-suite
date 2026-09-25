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
    Cloud,
    HelpCircle,
    Star,
    Keyboard,
    Undo2,
    Redo2,
    Search,
    Link,
    Table,
    FileSpreadsheet
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
    openShortcuts: void;
    undo: void;
    redo: void;
  }>();

  let isRenaming = false;
  let tempTitle = meta.title;
  let showExportMenu = false;
  let activeMenu: string | null = null;
  let isStarred = false;

  const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  const modKey = isMac ? '⌘' : 'Ctrl';

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
    activeMenu = null;
    dispatch('exportFormat', { format });
  }

  function closeMenus() {
    activeMenu = null;
    showExportMenu = false;
  }
</script>

<svelte:window on:click={closeMenus} />

<header class="no-print bg-white border-b border-slate-200 select-none z-30 relative shadow-sm">
  <!-- Top Row: Icon, Title, Offline Status, Mode Tabs, and Quick Actions -->
  <div class="h-13 px-4 flex items-center justify-between">
    <!-- Left: App Icon & Title & Offline Indicator -->
    <div class="flex items-center space-x-3">
      <!-- Google-Style App Icon -->
      <div class="flex items-center space-x-2">
        {#if activeMode === 'writer'}
          <div class="w-8 h-8 rounded bg-blue-600 flex items-center justify-center text-white shadow-sm shadow-blue-500/20" title="Google Docs Compatible Word Processor">
            <FileText size={18} />
          </div>
        {:else if activeMode === 'sheets'}
          <div class="w-8 h-8 rounded bg-emerald-600 flex items-center justify-center text-white shadow-sm shadow-emerald-500/20" title="Google Sheets Compatible Spreadsheet">
            <Sheet size={18} />
          </div>
        {:else}
          <div class="w-8 h-8 rounded bg-amber-500 flex items-center justify-center text-white shadow-sm shadow-amber-500/20" title="Google Slides Compatible Presentations">
            <Presentation size={18} />
          </div>
        {/if}
      </div>

      <!-- Title & Star & Offline Indicator -->
      <div class="flex flex-col">
        <div class="flex items-center space-x-2">
          {#if isRenaming}
            <input
              type="text"
              bind:value={tempTitle}
              on:blur={commitRename}
              on:keydown={handleKeydown}
              class="border border-blue-500 px-1.5 py-0.5 rounded text-sm font-semibold text-slate-800 outline-none shadow-inner"
            />
          {:else}
            <button
              class="font-semibold text-slate-800 hover:text-slate-950 text-sm hover:bg-slate-100 px-2 py-0.5 rounded transition-colors text-left truncate max-w-[240px]"
              on:click|stopPropagation={() => { tempTitle = meta.title; isRenaming = true; }}
              title="Click to rename document"
            >
              {meta.title}
            </button>
          {/if}

          <!-- Star Icon -->
          <button
            class="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-amber-500 transition-colors {isStarred ? 'text-amber-400' : ''}"
            on:click|stopPropagation={() => (isStarred = !isStarred)}
            title="Star Document"
          >
            <Star size={14} fill={isStarred ? 'currentColor' : 'none'} />
          </button>

          <!-- Google Workspace Style Offline Cloud Badge -->
          <div
            class="flex items-center space-x-1 px-1.5 py-0.5 rounded text-[11px] text-slate-500 hover:bg-slate-100 cursor-help transition-colors"
            title="All changes saved to this Mac. 100% private & offline."
          >
            <Cloud size={14} class="text-slate-500" />
            <span class="hidden md:inline font-medium">Saved to device</span>
          </div>

          {#if meta.isDirty}
            <span class="w-2 h-2 rounded-full bg-amber-500 animate-pulse" title="Unsaved changes"></span>
          {/if}
        </div>

        <!-- Google-Style Dropdown Menu Bar (File, Edit, View, Insert, Format, Help) -->
        <div class="flex items-center space-x-1 -ml-1 text-[11px] text-slate-600 font-medium">
          <!-- File Menu -->
          <div class="relative">
            <button
              class="px-1.5 py-0.5 rounded hover:bg-slate-100 hover:text-slate-900 {activeMenu === 'file' ? 'bg-slate-100 text-slate-900' : ''}"
              on:click|stopPropagation={() => (activeMenu = activeMenu === 'file' ? null : 'file')}
            >
              File
            </button>
            {#if activeMenu === 'file'}
              <div class="absolute left-0 top-6 z-50 w-56 bg-white border border-slate-200 rounded-lg shadow-xl py-1 text-xs text-slate-700">
                <button class="w-full px-3 py-1.5 text-left hover:bg-blue-50 flex items-center justify-between" on:click|stopPropagation={() => { closeMenus(); dispatch('newDoc'); }}>
                  <span>New Document</span>
                  <span class="text-[10px] text-slate-400 font-mono">{modKey}+N</span>
                </button>
                <button class="w-full px-3 py-1.5 text-left hover:bg-blue-50 flex items-center justify-between" on:click|stopPropagation={() => { closeMenus(); dispatch('openDoc'); }}>
                  <span>Open...</span>
                  <span class="text-[10px] text-slate-400 font-mono">{modKey}+O</span>
                </button>
                <div class="border-t border-slate-100 my-1"></div>
                <button class="w-full px-3 py-1.5 text-left hover:bg-blue-50 flex items-center justify-between" on:click|stopPropagation={() => { closeMenus(); dispatch('saveDoc'); }}>
                  <span>Save</span>
                  <span class="text-[10px] text-slate-400 font-mono">{modKey}+S</span>
                </button>
                <button class="w-full px-3 py-1.5 text-left hover:bg-blue-50 flex items-center justify-between" on:click|stopPropagation={() => { closeMenus(); dispatch('saveAsDoc'); }}>
                  <span>Save As...</span>
                  <span class="text-[10px] text-slate-400 font-mono">{modKey}+⇧+S</span>
                </button>
                <div class="border-t border-slate-100 my-1"></div>
                <button class="w-full px-3 py-1.5 text-left hover:bg-blue-50 flex items-center justify-between" on:click|stopPropagation={() => { closeMenus(); dispatch('printPdf'); }}>
                  <span>Print / Save to PDF</span>
                  <span class="text-[10px] text-slate-400 font-mono">{modKey}+P</span>
                </button>
              </div>
            {/if}
          </div>

          <!-- Edit Menu -->
          <div class="relative">
            <button
              class="px-1.5 py-0.5 rounded hover:bg-slate-100 hover:text-slate-900 {activeMenu === 'edit' ? 'bg-slate-100 text-slate-900' : ''}"
              on:click|stopPropagation={() => (activeMenu = activeMenu === 'edit' ? null : 'edit')}
            >
              Edit
            </button>
            {#if activeMenu === 'edit'}
              <div class="absolute left-0 top-6 z-50 w-52 bg-white border border-slate-200 rounded-lg shadow-xl py-1 text-xs text-slate-700">
                <button class="w-full px-3 py-1.5 text-left hover:bg-blue-50 flex items-center justify-between" on:click|stopPropagation={() => { closeMenus(); dispatch('undo'); }}>
                  <span>Undo</span>
                  <span class="text-[10px] text-slate-400 font-mono">{modKey}+Z</span>
                </button>
                <button class="w-full px-3 py-1.5 text-left hover:bg-blue-50 flex items-center justify-between" on:click|stopPropagation={() => { closeMenus(); dispatch('redo'); }}>
                  <span>Redo</span>
                  <span class="text-[10px] text-slate-400 font-mono">{modKey}+Y</span>
                </button>
              </div>
            {/if}
          </div>

          <!-- Help Menu -->
          <div class="relative">
            <button
              class="px-1.5 py-0.5 rounded hover:bg-slate-100 hover:text-slate-900 {activeMenu === 'help' ? 'bg-slate-100 text-slate-900' : ''}"
              on:click|stopPropagation={() => (activeMenu = activeMenu === 'help' ? null : 'help')}
            >
              Help
            </button>
            {#if activeMenu === 'help'}
              <div class="absolute left-0 top-6 z-50 w-60 bg-white border border-slate-200 rounded-lg shadow-xl py-1 text-xs text-slate-700">
                <button class="w-full px-3 py-1.5 text-left hover:bg-blue-50 flex items-center justify-between font-medium text-slate-800" on:click|stopPropagation={() => { closeMenus(); dispatch('openShortcuts'); }}>
                  <div class="flex items-center space-x-2">
                    <Keyboard size={14} class="text-blue-600" />
                    <span>Keyboard Shortcuts</span>
                  </div>
                  <span class="text-[10px] text-slate-400 font-mono">{modKey}+/</span>
                </button>
              </div>
            {/if}
          </div>
        </div>
      </div>
    </div>

    <!-- Center: Google Workspace App Switcher (Docs, Sheets, Slides) -->
    <nav class="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
      <button
        class="flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all {activeMode === 'writer' ? 'bg-white text-blue-600 shadow-sm border border-slate-200/60' : 'text-slate-600 hover:text-slate-900'}"
        on:click={() => dispatch('changeMode', 'writer')}
        title="Google Docs Mode ({modKey}+1)"
      >
        <FileText size={15} class={activeMode === 'writer' ? 'text-blue-600' : ''} />
        <span>Docs</span>
      </button>

      <button
        class="flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all {activeMode === 'sheets' ? 'bg-white text-emerald-600 shadow-sm border border-slate-200/60' : 'text-slate-600 hover:text-slate-900'}"
        on:click={() => dispatch('changeMode', 'sheets')}
        title="Google Sheets Mode ({modKey}+2)"
      >
        <Sheet size={15} class={activeMode === 'sheets' ? 'text-emerald-600' : ''} />
        <span>Sheets</span>
      </button>

      <button
        class="flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all {activeMode === 'slides' ? 'bg-white text-amber-600 shadow-sm border border-slate-200/60' : 'text-slate-600 hover:text-slate-900'}"
        on:click={() => dispatch('changeMode', 'slides')}
        title="Google Slides Mode ({modKey}+3)"
      >
        <Presentation size={15} class={activeMode === 'slides' ? 'text-amber-600' : ''} />
        <span>Slides</span>
      </button>
    </nav>

    <!-- Right: Quick Actions & Export Menu -->
    <div class="flex items-center space-x-2">
      <!-- Shortcuts button -->
      <button
        class="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors"
        on:click={() => dispatch('openShortcuts')}
        title="Keyboard Shortcuts ({modKey}+/)"
      >
        <Keyboard size={16} />
      </button>

      <!-- Save Button -->
      <button
        class="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors {meta.isDirty ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}"
        on:click={() => dispatch('saveDoc')}
        title="Save File ({modKey}+S)"
      >
        <Save size={14} />
        <span>Save</span>
      </button>

      <!-- Export Dropdown -->
      <div class="relative">
        <button
          class="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors border border-slate-200"
          on:click|stopPropagation={() => (showExportMenu = !showExportMenu)}
        >
          <Download size={14} class="text-slate-500" />
          <span>Export</span>
          <ChevronDown size={13} class="text-slate-400" />
        </button>

        {#if showExportMenu}
          <div
            class="absolute right-0 mt-1.5 w-56 bg-white rounded-xl shadow-2xl border border-slate-200 py-1.5 z-50 text-xs text-slate-700 divide-y divide-slate-100"
          >
            {#if activeMode === 'writer'}
              <div class="py-1">
                <button class="w-full px-3.5 py-1.5 text-left hover:bg-blue-50 flex items-center justify-between" on:click={() => handleExport('docx')}>
                  <span class="font-medium text-slate-800">Microsoft Word (.docx)</span>
                  <span class="text-[10px] text-slate-400 font-mono">DOCX</span>
                </button>
                <button class="w-full px-3.5 py-1.5 text-left hover:bg-blue-50 flex items-center justify-between" on:click={() => handleExport('rtf')}>
                  <span>Rich Text (.rtf)</span>
                  <span class="text-[10px] text-slate-400 font-mono">RTF</span>
                </button>
                <button class="w-full px-3.5 py-1.5 text-left hover:bg-blue-50 flex items-center justify-between" on:click={() => handleExport('md')}>
                  <span>Markdown (.md)</span>
                  <span class="text-[10px] text-slate-400 font-mono">MD</span>
                </button>
                <button class="w-full px-3.5 py-1.5 text-left hover:bg-blue-50 flex items-center justify-between" on:click={() => handleExport('txt')}>
                  <span>Plain Text (.txt)</span>
                  <span class="text-[10px] text-slate-400 font-mono">TXT</span>
                </button>
                <button class="w-full px-3.5 py-1.5 text-left hover:bg-blue-50 flex items-center justify-between" on:click={() => handleExport('html')}>
                  <span>Web Page (.html)</span>
                  <span class="text-[10px] text-slate-400 font-mono">HTML</span>
                </button>
              </div>
            {:else if activeMode === 'sheets'}
              <div class="py-1">
                <button class="w-full px-3.5 py-1.5 text-left hover:bg-emerald-50 flex items-center justify-between" on:click={() => handleExport('xlsx')}>
                  <span class="font-medium text-slate-800">Microsoft Excel (.xlsx)</span>
                  <span class="text-[10px] text-slate-400 font-mono">XLSX</span>
                </button>
                <button class="w-full px-3.5 py-1.5 text-left hover:bg-emerald-50 flex items-center justify-between" on:click={() => handleExport('csv')}>
                  <span>Comma Separated (.csv)</span>
                  <span class="text-[10px] text-slate-400 font-mono">CSV</span>
                </button>
                <button class="w-full px-3.5 py-1.5 text-left hover:bg-emerald-50 flex items-center justify-between" on:click={() => handleExport('tsv')}>
                  <span>Tab Separated (.tsv)</span>
                  <span class="text-[10px] text-slate-400 font-mono">TSV</span>
                </button>
              </div>
            {:else if activeMode === 'slides'}
              <div class="py-1">
                <button class="w-full px-3.5 py-1.5 text-left hover:bg-amber-50 flex items-center justify-between" on:click={() => handleExport('pptx')}>
                  <span class="font-medium text-slate-800">PowerPoint Deck (.pptx)</span>
                  <span class="text-[10px] text-slate-400 font-mono">PPTX</span>
                </button>
                <button class="w-full px-3.5 py-1.5 text-left hover:bg-amber-50 flex items-center justify-between" on:click={() => handleExport('html')}>
                  <span>Web Presentation (.html)</span>
                  <span class="text-[10px] text-slate-400 font-mono">HTML</span>
                </button>
              </div>
            {/if}
            <div class="py-1">
              <button class="w-full px-3.5 py-1.5 text-left hover:bg-slate-50 flex items-center justify-between font-medium text-slate-700" on:click={() => dispatch('printPdf')}>
                <span>PDF Document</span>
                <span class="text-[10px] text-slate-400 font-mono">PDF</span>
              </button>
              <button class="w-full px-3.5 py-1.5 text-left hover:bg-slate-50 flex items-center justify-between text-slate-500" on:click={() => handleExport('json')}>
                <span>Suite Backup (.json)</span>
                <span class="text-[10px] text-slate-400 font-mono">JSON</span>
              </button>
            </div>
          </div>
        {/if}
      </div>
    </div>
  </div>
</header>
