<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { WorkspaceMode, DocumentMeta } from '../../types';
  import {
    FileText,
    Sheet,
    Presentation,
    Save,
    Download,
    Printer,
    ChevronDown,
    Cloud,
    Star,
    Keyboard,
    Undo2,
    Redo2,
    Sparkles,
    Table,
    Image,
    Link,
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
    PenTool,
    Highlighter,
    Eraser,
    LayoutTemplate,
    Columns,
    Sigma,
    FunctionSquare,
    Filter,
    ArrowDownAZ,
    ArrowUpZA,
    BookOpen,
    CheckSquare,
    CheckCircle2,
    Shield,
    Lock,
    Eye,
    ZoomIn,
    ZoomOut,
    Maximize,
    Sliders,
    Palette,
    Play,
    Calculator,
    MessageSquare,
    Plus,
    X,
    FileSpreadsheet,
    FileCheck
  } from 'lucide-svelte';
  import AiAssistantModal from './AiAssistantModal.svelte';

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
    ribbonAction: { action: string; payload?: any };
  }>();

  let isRenaming = false;
  let tempTitle = meta.title;
  let showExportMenu = false;
  let showAiModal = false;
  let activeTab: string = 'Home';
  let isStarred = false;
  let showFileMenu = false;

  const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  const modKey = isMac ? '⌘' : 'Ctrl';

  // Ribbon tabs configuration strictly matching OnlyOffice user images
  const tabsByMode: Record<WorkspaceMode, string[]> = {
    writer: ['File', 'Home', 'Insert', 'Draw', 'Layout', 'References', 'Collaboration', 'Protection', 'View', 'Plugins', 'AI'],
    sheets: ['File', 'Home', 'Insert', 'Draw', 'Layout', 'Formula', 'Data', 'Collaboration', 'Protection', 'View', 'Plugins', 'AI'],
    pdf: ['File', 'Home', 'Insert', 'Draw', 'Layout', 'References', 'Forms', 'Collaboration', 'Protection', 'View', 'Plugins', 'AI'],
    slides: ['File', 'Home', 'Insert', 'Draw', 'Design', 'Transitions', 'Animation', 'Collaboration', 'Protection', 'View', 'Plugins', 'AI'],
  };

  $: currentTabs = tabsByMode[activeMode] || tabsByMode.writer;

  // Active theme accent color matching OnlyOffice brand guidelines
  $: accentColor =
    activeMode === 'writer'
      ? { text: 'text-blue-500', hex: '#3b82f6', bg: 'bg-blue-600', ring: 'ring-blue-500' }
      : activeMode === 'sheets'
      ? { text: 'text-emerald-500', hex: '#16a34a', bg: 'bg-emerald-600', ring: 'ring-emerald-500' }
      : activeMode === 'pdf'
      ? { text: 'text-rose-500', hex: '#e0564c', bg: 'bg-rose-600', ring: 'ring-rose-500' }
      : { text: 'text-orange-500', hex: '#ea580c', bg: 'bg-orange-600', ring: 'ring-orange-500' };

  function handleTabClick(tab: string) {
    if (tab === 'File') {
      showFileMenu = !showFileMenu;
      return;
    }
    showFileMenu = false;
    activeTab = tab;
    if (tab === 'AI') {
      showAiModal = true;
    }
  }

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
    showFileMenu = false;
    dispatch('exportFormat', { format });
  }

  function triggerAction(action: string, payload?: any) {
    dispatch('ribbonAction', { action, payload });
  }

  function handleAiApply(e: CustomEvent<string>) {
    triggerAction('insertText', e.detail);
  }
</script>

<svelte:window on:click={() => { showFileMenu = false; showExportMenu = false; }} />

<header class="no-print select-none z-30 relative shadow-md bg-[#222428] text-slate-200">
  <!-- Top Title & Quick Access Bar -->
  <div class="h-10 px-3 bg-[#1a1c1e] border-b border-[#2d3135] flex items-center justify-between text-xs">
    <!-- Left: App Brand Icon, Title & Save / Undo / Redo Shortcuts -->
    <div class="flex items-center space-x-3">
      <!-- App Mode Icon -->
      <div class="flex items-center space-x-1.5">
        {#if activeMode === 'writer'}
          <div class="w-6 h-6 rounded bg-blue-600 flex items-center justify-center text-white shadow-xs" title="OnlyOffice Document Editor">
            <FileText size={14} />
          </div>
          <span class="font-bold text-slate-100 text-xs tracking-tight hidden sm:inline">Word</span>
        {:else if activeMode === 'sheets'}
          <div class="w-6 h-6 rounded bg-emerald-600 flex items-center justify-center text-white shadow-xs" title="OnlyOffice Spreadsheet Editor">
            <Sheet size={14} />
          </div>
          <span class="font-bold text-slate-100 text-xs tracking-tight hidden sm:inline">Sheet</span>
        {:else if activeMode === 'pdf'}
          <div class="w-6 h-6 rounded bg-rose-600 flex items-center justify-center text-white shadow-xs" title="OnlyOffice PDF & Form Editor">
            <FileCheck size={14} />
          </div>
          <span class="font-bold text-slate-100 text-xs tracking-tight hidden sm:inline">PDF</span>
        {:else}
          <div class="w-6 h-6 rounded bg-orange-600 flex items-center justify-center text-white shadow-xs" title="OnlyOffice Presentation Editor">
            <Presentation size={14} />
          </div>
          <span class="font-bold text-slate-100 text-xs tracking-tight hidden sm:inline">Slides</span>
        {/if}
      </div>

      <!-- Quick Action Buttons -->
      <div class="flex items-center space-x-0.5 border-l border-slate-700 pl-2">
        <button
          class="p-1 rounded hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
          on:click={() => dispatch('saveDoc')}
          title="Save ({modKey}+S)"
        >
          <Save size={13} />
        </button>
        <button
          class="p-1 rounded hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
          on:click={() => dispatch('undo')}
          title="Undo ({modKey}+Z)"
        >
          <Undo2 size={13} />
        </button>
        <button
          class="p-1 rounded hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
          on:click={() => dispatch('redo')}
          title="Redo ({modKey}+Y)"
        >
          <Redo2 size={13} />
        </button>
      </div>

      <!-- Editable Document Title & Offline Badge -->
      <div class="flex items-center space-x-2 border-l border-slate-700 pl-2">
        {#if isRenaming}
          <input
            type="text"
            bind:value={tempTitle}
            on:blur={commitRename}
            on:keydown={handleKeydown}
            class="bg-slate-800 text-white border border-blue-500 px-1.5 py-0.5 rounded text-xs outline-none"
          />
        {:else}
          <button
            class="font-semibold text-slate-200 hover:text-white hover:bg-white/10 px-2 py-0.5 rounded text-xs truncate max-w-[200px]"
            on:click|stopPropagation={() => { tempTitle = meta.title; isRenaming = true; }}
            title="Click to rename"
          >
            {meta.title}
          </button>
        {/if}

        <button
          class="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-amber-400 transition-colors {isStarred ? 'text-amber-400' : ''}"
          on:click|stopPropagation={() => (isStarred = !isStarred)}
          title="Star Document"
        >
          <Star size={13} fill={isStarred ? 'currentColor' : 'none'} />
        </button>

        <div class="hidden md:flex items-center space-x-1 px-1.5 py-0.5 rounded bg-white/5 text-[10px] text-slate-400">
          <Cloud size={11} class="text-slate-400" />
          <span>Device</span>
        </div>

        {#if meta.isDirty}
          <span class="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" title="Unsaved changes"></span>
        {/if}
      </div>
    </div>

    <!-- Center: OnlyOffice 4-Mode Workspace Switcher (Word, Sheet, Slides, PDF) -->
    <nav class="flex items-center space-x-1 bg-black/40 p-0.5 rounded-lg border border-white/10">
      <button
        class="flex items-center space-x-1.5 px-2.5 py-1 rounded text-xs font-semibold transition-all
          {activeMode === 'writer' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'}"
        on:click={() => dispatch('changeMode', 'writer')}
        title="Word / Document Editor ({modKey}+1)"
      >
        <FileText size={13} />
        <span class="text-[11px]">Word</span>
      </button>

      <button
        class="flex items-center space-x-1.5 px-2.5 py-1 rounded text-xs font-semibold transition-all
          {activeMode === 'sheets' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'}"
        on:click={() => dispatch('changeMode', 'sheets')}
        title="Sheet / Spreadsheet Editor ({modKey}+2)"
      >
        <Sheet size={13} />
        <span class="text-[11px]">Sheet</span>
      </button>

      <button
        class="flex items-center space-x-1.5 px-2.5 py-1 rounded text-xs font-semibold transition-all
          {activeMode === 'slides' ? 'bg-orange-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'}"
        on:click={() => dispatch('changeMode', 'slides')}
        title="Slides / Presentation Editor ({modKey}+3)"
      >
        <Presentation size={13} />
        <span class="text-[11px]">Slides</span>
      </button>

      <button
        class="flex items-center space-x-1.5 px-2.5 py-1 rounded text-xs font-semibold transition-all
          {activeMode === 'pdf' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'}"
        on:click={() => dispatch('changeMode', 'pdf')}
        title="PDF & Form Editor ({modKey}+4)"
      >
        <FileCheck size={13} />
        <span class="text-[11px]">PDF</span>
      </button>
    </nav>

    <!-- Right: Export & Shortcuts -->
    <div class="flex items-center space-x-1.5">
      <!-- Shortcuts button -->
      <button
        class="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
        on:click={() => dispatch('openShortcuts')}
        title="Shortcuts ({modKey}+/)"
      >
        <Keyboard size={14} />
      </button>

      <!-- Export Dropdown Trigger -->
      <div class="relative">
        <button
          class="flex items-center space-x-1 px-2.5 py-1 rounded bg-white/10 hover:bg-white/15 text-slate-200 text-xs font-medium transition-colors border border-white/10"
          on:click|stopPropagation={() => (showExportMenu = !showExportMenu)}
        >
          <Download size={12} class="text-slate-300" />
          <span>Export</span>
          <ChevronDown size={11} class="text-slate-400" />
        </button>

        {#if showExportMenu}
          <div class="absolute right-0 mt-1 w-52 bg-slate-900 rounded-lg shadow-2xl border border-slate-700 py-1.5 z-50 text-xs text-slate-200 divide-y divide-slate-800">
            <div class="py-1">
              {#if activeMode === 'writer'}
                <button class="w-full px-3 py-1 text-left hover:bg-blue-600 flex items-center justify-between" on:click={() => handleExport('docx')}>
                  <span>Microsoft Word (.docx)</span>
                  <span class="text-[9px] text-slate-400 font-mono">DOCX</span>
                </button>
                <button class="w-full px-3 py-1 text-left hover:bg-blue-600 flex items-center justify-between" on:click={() => handleExport('rtf')}>
                  <span>Rich Text (.rtf)</span>
                  <span class="text-[9px] text-slate-400 font-mono">RTF</span>
                </button>
                <button class="w-full px-3 py-1 text-left hover:bg-blue-600 flex items-center justify-between" on:click={() => handleExport('md')}>
                  <span>Markdown (.md)</span>
                  <span class="text-[9px] text-slate-400 font-mono">MD</span>
                </button>
                <button class="w-full px-3 py-1 text-left hover:bg-blue-600 flex items-center justify-between" on:click={() => handleExport('txt')}>
                  <span>Plain Text (.txt)</span>
                  <span class="text-[9px] text-slate-400 font-mono">TXT</span>
                </button>
              {:else if activeMode === 'sheets'}
                <button class="w-full px-3 py-1 text-left hover:bg-emerald-600 flex items-center justify-between" on:click={() => handleExport('xlsx')}>
                  <span>Microsoft Excel (.xlsx)</span>
                  <span class="text-[9px] text-slate-400 font-mono">XLSX</span>
                </button>
                <button class="w-full px-3 py-1 text-left hover:bg-emerald-600 flex items-center justify-between" on:click={() => handleExport('csv')}>
                  <span>Comma Separated (.csv)</span>
                  <span class="text-[9px] text-slate-400 font-mono">CSV</span>
                </button>
                <button class="w-full px-3 py-1 text-left hover:bg-emerald-600 flex items-center justify-between" on:click={() => handleExport('tsv')}>
                  <span>Tab Separated (.tsv)</span>
                  <span class="text-[9px] text-slate-400 font-mono">TSV</span>
                </button>
              {:else if activeMode === 'slides'}
                <button class="w-full px-3 py-1 text-left hover:bg-orange-600 flex items-center justify-between" on:click={() => handleExport('pptx')}>
                  <span>PowerPoint Deck (.pptx)</span>
                  <span class="text-[9px] text-slate-400 font-mono">PPTX</span>
                </button>
              {:else if activeMode === 'pdf'}
                <button class="w-full px-3 py-1 text-left hover:bg-rose-600 flex items-center justify-between" on:click={() => dispatch('printPdf')}>
                  <span>Save / Print PDF</span>
                  <span class="text-[9px] text-slate-400 font-mono">PDF</span>
                </button>
              {/if}
            </div>
            <div class="py-1">
              <button class="w-full px-3 py-1 text-left hover:bg-slate-800 flex items-center justify-between font-medium" on:click={() => dispatch('printPdf')}>
                <span>PDF Document</span>
                <span class="text-[9px] text-slate-400 font-mono">PDF</span>
              </button>
              <button class="w-full px-3 py-1 text-left hover:bg-slate-800 flex items-center justify-between text-slate-400" on:click={() => handleExport('json')}>
                <span>Suite JSON Backup</span>
                <span class="text-[9px] text-slate-400 font-mono">JSON</span>
              </button>
            </div>
          </div>
        {/if}
      </div>
    </div>
  </div>

  <!-- ONLYOFFICE EXACT RIBBON TAB STRIP (As shown in user screenshots) -->
  <div class="h-9 px-3 bg-[#222428] border-b border-[#2d3135] flex items-center space-x-1 overflow-x-auto relative select-none">
    {#each currentTabs as tab}
      {@const isActive = activeTab === tab}
      <div class="relative h-full flex items-center">
        <button
          class="h-full px-3.5 text-xs font-medium transition-all relative flex items-center space-x-1.5
            {isActive ? 'text-white font-semibold' : 'text-slate-300 hover:text-white hover:bg-white/5'}"
          on:click|stopPropagation={() => handleTabClick(tab)}
        >
          {#if tab === 'AI'}
            <Sparkles size={12} class="text-purple-400" />
          {/if}
          <span>{tab}</span>
        </button>

        <!-- OnlyOffice Underline Indicator -->
        {#if isActive}
          <div
            class="absolute bottom-0 left-0 right-0 h-[3px] transition-all"
            style="background-color: {accentColor.hex};"
          ></div>
        {/if}

        <!-- OnlyOffice File Dropdown Menu -->
        {#if tab === 'File' && showFileMenu}
          <div class="absolute left-0 top-9 w-60 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl py-1 z-50 text-xs text-slate-200">
            <button class="w-full px-3.5 py-1.5 text-left hover:bg-blue-600 flex items-center justify-between" on:click|stopPropagation={() => { showFileMenu = false; dispatch('newDoc'); }}>
              <span>New Document</span>
              <span class="text-[10px] text-slate-400 font-mono">{modKey}+N</span>
            </button>
            <button class="w-full px-3.5 py-1.5 text-left hover:bg-blue-600 flex items-center justify-between" on:click|stopPropagation={() => { showFileMenu = false; dispatch('openDoc'); }}>
              <span>Open File...</span>
              <span class="text-[10px] text-slate-400 font-mono">{modKey}+O</span>
            </button>
            <div class="border-t border-slate-800 my-1"></div>
            <button class="w-full px-3.5 py-1.5 text-left hover:bg-blue-600 flex items-center justify-between" on:click|stopPropagation={() => { showFileMenu = false; dispatch('saveDoc'); }}>
              <span>Save</span>
              <span class="text-[10px] text-slate-400 font-mono">{modKey}+S</span>
            </button>
            <button class="w-full px-3.5 py-1.5 text-left hover:bg-blue-600 flex items-center justify-between" on:click|stopPropagation={() => { showFileMenu = false; dispatch('saveAsDoc'); }}>
              <span>Save As...</span>
              <span class="text-[10px] text-slate-400 font-mono">{modKey}+⇧+S</span>
            </button>
            <div class="border-t border-slate-800 my-1"></div>
            <button class="w-full px-3.5 py-1.5 text-left hover:bg-blue-600 flex items-center justify-between" on:click|stopPropagation={() => { showFileMenu = false; dispatch('printPdf'); }}>
              <span>Print / Save to PDF</span>
              <span class="text-[10px] text-slate-400 font-mono">{modKey}+P</span>
            </button>
          </div>
        {/if}
      </div>
    {/each}
  </div>

  <!-- ONLYOFFICE INTERACTIVE RIBBON ACTION TOOLBAR -->
  <div class="h-10 px-4 bg-[#2b2d31] border-b border-[#36393f] flex items-center justify-between text-xs text-slate-300 overflow-x-auto shadow-inner">
    {#if activeTab === 'Home'}
      <!-- HOME TAB: Universal Formatting, Fonts, Styles & Mode-Specific Essentials -->
      <div class="flex items-center space-x-2">
        <button class="p-1 rounded hover:bg-white/10 text-slate-300 font-bold" on:click={() => triggerAction('bold')} title="Bold ({modKey}+B)">
          <Bold size={14} />
        </button>
        <button class="p-1 rounded hover:bg-white/10 text-slate-300 italic" on:click={() => triggerAction('italic')} title="Italic ({modKey}+I)">
          <Italic size={14} />
        </button>
        <button class="p-1 rounded hover:bg-white/10 text-slate-300 underline" on:click={() => triggerAction('underline')} title="Underline ({modKey}+U)">
          <Underline size={14} />
        </button>
        <button class="p-1 rounded hover:bg-white/10 text-slate-300 line-through" on:click={() => triggerAction('strike')} title="Strikethrough">
          <Strikethrough size={14} />
        </button>

        <div class="h-4 w-px bg-slate-700 mx-1"></div>

        <button class="p-1 rounded hover:bg-white/10 text-slate-300" on:click={() => triggerAction('align', 'left')} title="Align Left">
          <AlignLeft size={14} />
        </button>
        <button class="p-1 rounded hover:bg-white/10 text-slate-300" on:click={() => triggerAction('align', 'center')} title="Align Center">
          <AlignCenter size={14} />
        </button>
        <button class="p-1 rounded hover:bg-white/10 text-slate-300" on:click={() => triggerAction('align', 'right')} title="Align Right">
          <AlignRight size={14} />
        </button>
        <button class="p-1 rounded hover:bg-white/10 text-slate-300" on:click={() => triggerAction('align', 'justify')} title="Justify">
          <AlignJustify size={14} />
        </button>

        <div class="h-4 w-px bg-slate-700 mx-1"></div>

        <button class="p-1 rounded hover:bg-white/10 text-slate-300" on:click={() => triggerAction('bullet')} title="Bulleted List">
          <List size={14} />
        </button>
        <button class="p-1 rounded hover:bg-white/10 text-slate-300" on:click={() => triggerAction('ordered')} title="Numbered List">
          <ListOrdered size={14} />
        </button>

        {#if activeMode === 'sheets'}
          <div class="h-4 w-px bg-slate-700 mx-1"></div>
          <button class="flex items-center space-x-1 px-2 py-0.5 rounded bg-emerald-600/40 hover:bg-emerald-600 text-emerald-300 hover:text-white" on:click={() => triggerAction('autoSum')} title="AutoSum">
            <Sigma size={13} />
            <span>AutoSum</span>
          </button>
        {:else if activeMode === 'slides'}
          <div class="h-4 w-px bg-slate-700 mx-1"></div>
          <button class="flex items-center space-x-1 px-2 py-0.5 rounded bg-orange-600/40 hover:bg-orange-600 text-orange-200 hover:text-white" on:click={() => triggerAction('newSlide')} title="New Slide">
            <Plus size={13} />
            <span>New Slide</span>
          </button>
        {:else if activeMode === 'pdf'}
          <div class="h-4 w-px bg-slate-700 mx-1"></div>
          <button class="flex items-center space-x-1 px-2 py-0.5 rounded bg-rose-600/40 hover:bg-rose-600 text-rose-200 hover:text-white" on:click={() => triggerAction('addTextField')} title="Add Text Field">
            <Plus size={13} />
            <span>Text Field</span>
          </button>
        {/if}
      </div>

    {:else if activeTab === 'Insert'}
      <!-- INSERT TAB: Tables, Images, Shapes, Links, Special Elements -->
      <div class="flex items-center space-x-3">
        <button class="flex items-center space-x-1 px-2 py-1 rounded hover:bg-white/10 text-slate-300" on:click={() => triggerAction('insertTable')} title="Insert Table">
          <Table size={14} class="text-blue-400" />
          <span>Table</span>
        </button>
        <button class="flex items-center space-x-1 px-2 py-1 rounded hover:bg-white/10 text-slate-300" on:click={() => triggerAction('insertImage')} title="Insert Image">
          <Image size={14} class="text-emerald-400" />
          <span>Picture</span>
        </button>
        <button class="flex items-center space-x-1 px-2 py-1 rounded hover:bg-white/10 text-slate-300" on:click={() => triggerAction('insertLink')} title="Insert Hyperlink">
          <Link size={14} class="text-amber-400" />
          <span>Link</span>
        </button>

        {#if activeMode === 'sheets'}
          <button class="flex items-center space-x-1 px-2 py-1 rounded hover:bg-white/10 text-slate-300" on:click={() => triggerAction('insertFx')} title="Insert Formula">
            <FunctionSquare size={14} class="text-purple-400" />
            <span>Function (fx)</span>
          </button>
        {:else if activeMode === 'pdf'}
          <button class="flex items-center space-x-1 px-2 py-1 rounded hover:bg-white/10 text-slate-300" on:click={() => triggerAction('addSignatureField')} title="Signature Field">
            <CheckSquare size={14} class="text-rose-400" />
            <span>Signature Line</span>
          </button>
        {:else if activeMode === 'slides'}
          <button class="flex items-center space-x-1 px-2 py-1 rounded hover:bg-white/10 text-slate-300" on:click={() => triggerAction('newSlide')} title="Insert Slide">
            <Presentation size={14} class="text-orange-400" />
            <span>New Slide</span>
          </button>
        {/if}
      </div>

    {:else if activeTab === 'Draw'}
      <!-- DRAW TAB: Freehand Pen, Highlighter, Eraser, Line Weight -->
      <div class="flex items-center space-x-2">
        <button class="flex items-center space-x-1 px-2 py-1 rounded hover:bg-white/10 text-blue-400" on:click={() => triggerAction('pen')} title="Pen Tool">
          <PenTool size={14} />
          <span>Pen</span>
        </button>
        <button class="flex items-center space-x-1 px-2 py-1 rounded hover:bg-white/10 text-amber-300" on:click={() => triggerAction('highlighter')} title="Highlighter">
          <Highlighter size={14} />
          <span>Highlighter</span>
        </button>
        <button class="flex items-center space-x-1 px-2 py-1 rounded hover:bg-white/10 text-slate-400" on:click={() => triggerAction('eraser')} title="Eraser">
          <Eraser size={14} />
          <span>Eraser</span>
        </button>
        <div class="h-4 w-px bg-slate-700 mx-1"></div>
        <span class="text-[11px] text-slate-400">Stroke:</span>
        <button class="px-2 py-0.5 rounded bg-white/10 text-xs" on:click={() => triggerAction('stroke', 1)}>1px</button>
        <button class="px-2 py-0.5 rounded bg-white/10 text-xs font-bold" on:click={() => triggerAction('stroke', 3)}>3px</button>
        <button class="px-2 py-0.5 rounded bg-white/10 text-xs font-extrabold" on:click={() => triggerAction('stroke', 6)}>6px</button>
      </div>

    {:else if activeTab === 'Layout'}
      <!-- LAYOUT TAB: Orientation, Margins, Paper Size, Columns -->
      <div class="flex items-center space-x-3">
        <button class="flex items-center space-x-1 px-2 py-1 rounded hover:bg-white/10 text-slate-300" on:click={() => triggerAction('orientation', 'portrait')} title="Portrait">
          <LayoutTemplate size={14} />
          <span>Portrait</span>
        </button>
        <button class="flex items-center space-x-1 px-2 py-1 rounded hover:bg-white/10 text-slate-300" on:click={() => triggerAction('orientation', 'landscape')} title="Landscape">
          <LayoutTemplate size={14} class="rotate-90" />
          <span>Landscape</span>
        </button>
        <div class="h-4 w-px bg-slate-700 mx-1"></div>
        <button class="flex items-center space-x-1 px-2 py-1 rounded hover:bg-white/10 text-slate-300" on:click={() => triggerAction('columns', 1)} title="1 Column">
          <Columns size={14} />
          <span>Single Col</span>
        </button>
        <button class="flex items-center space-x-1 px-2 py-1 rounded hover:bg-white/10 text-slate-300" on:click={() => triggerAction('columns', 2)} title="2 Columns">
          <Columns size={14} />
          <span>2 Columns</span>
        </button>
        <button class="flex items-center space-x-1 px-2 py-1 rounded hover:bg-white/10 text-slate-300" on:click={() => triggerAction('pageSize', 'a4')} title="A4 Standard">
          <span>A4</span>
        </button>
        <button class="flex items-center space-x-1 px-2 py-1 rounded hover:bg-white/10 text-slate-300" on:click={() => triggerAction('pageSize', 'letter')} title="US Letter">
          <span>Letter</span>
        </button>
      </div>

    {:else if activeTab === 'Formula'}
      <!-- FORMULA TAB (Sheets): Function Library, AutoSum, Quick Categories -->
      <div class="flex items-center space-x-3">
        <button class="flex items-center space-x-1 px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-xs" on:click={() => triggerAction('insertFx')} title="Insert Function">
          <FunctionSquare size={14} />
          <span>Insert Function (fx)</span>
        </button>
        <button class="flex items-center space-x-1 px-2 py-1 rounded hover:bg-white/10 text-slate-300" on:click={() => triggerAction('formulaQuick', 'SUM')}>
          <Sigma size={13} class="text-emerald-400" />
          <span>SUM</span>
        </button>
        <button class="flex items-center space-x-1 px-2 py-1 rounded hover:bg-white/10 text-slate-300" on:click={() => triggerAction('formulaQuick', 'AVERAGE')}>
          <span>AVERAGE</span>
        </button>
        <button class="flex items-center space-x-1 px-2 py-1 rounded hover:bg-white/10 text-slate-300" on:click={() => triggerAction('formulaQuick', 'COUNT')}>
          <span>COUNT</span>
        </button>
        <button class="flex items-center space-x-1 px-2 py-1 rounded hover:bg-white/10 text-slate-300" on:click={() => triggerAction('formulaQuick', 'IF')}>
          <span>IF</span>
        </button>
        <button class="flex items-center space-x-1 px-2 py-1 rounded hover:bg-white/10 text-slate-300" on:click={() => triggerAction('formulaQuick', 'VLOOKUP')}>
          <span>VLOOKUP</span>
        </button>
        <div class="h-4 w-px bg-slate-700 mx-1"></div>
        <button class="px-2 py-1 rounded hover:bg-white/10 text-emerald-400" on:click={() => triggerAction('recalculate')}>
          <span>Recalculate Sheet</span>
        </button>
      </div>

    {:else if activeTab === 'Data'}
      <!-- DATA TAB (Sheets): Sort, Filter, Validation, Data Tools -->
      <div class="flex items-center space-x-3">
        <button class="flex items-center space-x-1 px-2 py-1 rounded hover:bg-white/10 text-slate-300" on:click={() => triggerAction('sortAsc')} title="Sort Ascending">
          <ArrowDownAZ size={14} class="text-blue-400" />
          <span>Sort A → Z</span>
        </button>
        <button class="flex items-center space-x-1 px-2 py-1 rounded hover:bg-white/10 text-slate-300" on:click={() => triggerAction('sortDesc')} title="Sort Descending">
          <ArrowUpZA size={14} class="text-blue-400" />
          <span>Sort Z → A</span>
        </button>
        <div class="h-4 w-px bg-slate-700 mx-1"></div>
        <button class="flex items-center space-x-1 px-2 py-1 rounded hover:bg-white/10 text-slate-300" on:click={() => triggerAction('toggleFilter')} title="Toggle Filter">
          <Filter size={14} class="text-amber-400" />
          <span>AutoFilter</span>
        </button>
        <button class="flex items-center space-x-1 px-2 py-1 rounded hover:bg-white/10 text-slate-300" on:click={() => triggerAction('importFile')} title="Import CSV/Excel">
          <FileSpreadsheet size={14} class="text-emerald-400" />
          <span>Import Data</span>
        </button>
      </div>

    {:else if activeTab === 'Forms'}
      <!-- FORMS TAB (PDF): Text Box, Checkbox, Signature, Form Tools -->
      <div class="flex items-center space-x-3">
        <button class="flex items-center space-x-1 px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-700 text-white font-medium" on:click={() => triggerAction('addTextField')}>
          <Plus size={13} />
          <span>Text Box</span>
        </button>
        <button class="flex items-center space-x-1 px-2 py-1 rounded hover:bg-white/10 text-slate-300" on:click={() => triggerAction('addCheckboxField')}>
          <CheckSquare size={14} class="text-rose-400" />
          <span>Checkbox</span>
        </button>
        <button class="flex items-center space-x-1 px-2 py-1 rounded hover:bg-white/10 text-slate-300" on:click={() => triggerAction('addSignatureField')}>
          <PenTool size={14} class="text-rose-400" />
          <span>Signature Line</span>
        </button>
        <div class="h-4 w-px bg-slate-700 mx-1"></div>
        <button class="flex items-center space-x-1 px-2 py-1 rounded hover:bg-white/10 text-slate-300" on:click={() => triggerAction('exportFormData')}>
          <Download size={14} />
          <span>Export Form Data</span>
        </button>
      </div>

    {:else if activeTab === 'Design'}
      <!-- DESIGN TAB (Slides): Themes, Colors, Aspect Ratio -->
      <div class="flex items-center space-x-3">
        <button class="flex items-center space-x-1 px-2 py-1 rounded hover:bg-white/10 text-slate-300" on:click={() => triggerAction('slideTheme', 'dark')}>
          <Palette size={14} class="text-indigo-400" />
          <span>Midnight Dark</span>
        </button>
        <button class="flex items-center space-x-1 px-2 py-1 rounded hover:bg-white/10 text-slate-300" on:click={() => triggerAction('slideTheme', 'light')}>
          <span>Clean Light</span>
        </button>
        <button class="flex items-center space-x-1 px-2 py-1 rounded hover:bg-white/10 text-slate-300" on:click={() => triggerAction('slideTheme', 'navy')}>
          <span>Corporate Navy</span>
        </button>
        <div class="h-4 w-px bg-slate-700 mx-1"></div>
        <button class="px-2 py-1 rounded hover:bg-white/10 text-xs" on:click={() => triggerAction('aspectRatio', '16:9')}>
          <span>16:9 Widescreen</span>
        </button>
        <button class="px-2 py-1 rounded hover:bg-white/10 text-xs" on:click={() => triggerAction('aspectRatio', '4:3')}>
          <span>4:3 Standard</span>
        </button>
      </div>

    {:else if activeTab === 'Transitions' || activeTab === 'Animation'}
      <!-- TRANSITIONS & ANIMATION (Slides): Transition effects, Slideshow -->
      <div class="flex items-center space-x-3">
        <button class="flex items-center space-x-1 px-3 py-1 rounded bg-orange-600 hover:bg-orange-700 text-white font-medium" on:click={() => triggerAction('present')}>
          <Play size={13} />
          <span>Start Slide Show (F5)</span>
        </button>
        <button class="px-2 py-1 rounded hover:bg-white/10 text-slate-300" on:click={() => triggerAction('transition', 'fade')}>
          <span>Fade</span>
        </button>
        <button class="px-2 py-1 rounded hover:bg-white/10 text-slate-300" on:click={() => triggerAction('transition', 'slide')}>
          <span>Slide</span>
        </button>
        <button class="px-2 py-1 rounded hover:bg-white/10 text-slate-300" on:click={() => triggerAction('transition', 'zoom')}>
          <span>Zoom</span>
        </button>
      </div>

    {:else if activeTab === 'References'}
      <!-- REFERENCES TAB: Table of Contents, Footnotes, Citations -->
      <div class="flex items-center space-x-3">
        <button class="flex items-center space-x-1 px-2 py-1 rounded hover:bg-white/10 text-slate-300" on:click={() => triggerAction('insertToc')}>
          <BookOpen size={14} class="text-blue-400" />
          <span>Table of Contents</span>
        </button>
        <button class="flex items-center space-x-1 px-2 py-1 rounded hover:bg-white/10 text-slate-300" on:click={() => triggerAction('insertFootnote')}>
          <span>Insert Footnote</span>
        </button>
        <button class="flex items-center space-x-1 px-2 py-1 rounded hover:bg-white/10 text-slate-300" on:click={() => triggerAction('insertCitation')}>
          <span>Add Citation</span>
        </button>
      </div>

    {:else if activeTab === 'Collaboration'}
      <!-- COLLABORATION TAB: Comments, Track Changes, Offline Mode -->
      <div class="flex items-center space-x-3">
        <button class="flex items-center space-x-1 px-2 py-1 rounded hover:bg-white/10 text-slate-300" on:click={() => triggerAction('addComment')}>
          <MessageSquare size={14} class="text-emerald-400" />
          <span>Add Comment</span>
        </button>
        <button class="flex items-center space-x-1 px-2 py-1 rounded hover:bg-white/10 text-slate-300" on:click={() => triggerAction('trackChanges')}>
          <CheckCircle2 size={14} class="text-blue-400" />
          <span>Track Changes</span>
        </button>
        <div class="h-4 w-px bg-slate-700 mx-1"></div>
        <span class="text-[11px] text-slate-400 font-mono">100% Offline • Local Mac Storage</span>
      </div>

    {:else if activeTab === 'Protection'}
      <!-- PROTECTION TAB: Protect Document, Read-Only, Watermark -->
      <div class="flex items-center space-x-3">
        <button class="flex items-center space-x-1 px-2 py-1 rounded hover:bg-white/10 text-slate-300" on:click={() => triggerAction('protectDoc')}>
          <Shield size={14} class="text-amber-400" />
          <span>Protect Document</span>
        </button>
        <button class="flex items-center space-x-1 px-2 py-1 rounded hover:bg-white/10 text-slate-300" on:click={() => triggerAction('lockReadOnly')}>
          <Lock size={14} class="text-rose-400" />
          <span>Lock Read-Only</span>
        </button>
        <button class="flex items-center space-x-1 px-2 py-1 rounded hover:bg-white/10 text-slate-300" on:click={() => triggerAction('watermark')}>
          <span>Add Watermark</span>
        </button>
      </div>

    {:else if activeTab === 'View'}
      <!-- VIEW TAB: Zoom, Presentation Mode, Gridlines, Rulers -->
      <div class="flex items-center space-x-3">
        <button class="flex items-center space-x-1 px-2 py-1 rounded hover:bg-white/10 text-slate-300" on:click={() => triggerAction('zoomIn')}>
          <ZoomIn size={14} />
          <span>Zoom In</span>
        </button>
        <button class="flex items-center space-x-1 px-2 py-1 rounded hover:bg-white/10 text-slate-300" on:click={() => triggerAction('zoomOut')}>
          <ZoomOut size={14} />
          <span>Zoom Out</span>
        </button>
        <button class="px-2 py-1 rounded hover:bg-white/10 text-slate-300" on:click={() => triggerAction('zoomReset')}>
          <span>100%</span>
        </button>
        <div class="h-4 w-px bg-slate-700 mx-1"></div>
        {#if activeMode === 'slides'}
          <button class="flex items-center space-x-1 px-2.5 py-1 rounded bg-orange-600 text-white font-medium" on:click={() => triggerAction('present')}>
            <Play size={13} />
            <span>Slide Show</span>
          </button>
        {/if}
        <button class="flex items-center space-x-1 px-2 py-1 rounded hover:bg-white/10 text-slate-300" on:click={() => triggerAction('toggleFullscreen')}>
          <Maximize size={14} />
          <span>Full Screen</span>
        </button>
      </div>

    {:else if activeTab === 'Plugins'}
      <!-- PLUGINS TAB: Macro, Word Counter, Calculator -->
      <div class="flex items-center space-x-3">
        <button class="flex items-center space-x-1 px-2 py-1 rounded hover:bg-white/10 text-slate-300" on:click={() => triggerAction('openCalculator')}>
          <Calculator size={14} class="text-emerald-400" />
          <span>Calculator</span>
        </button>
        <button class="flex items-center space-x-1 px-2 py-1 rounded hover:bg-white/10 text-slate-300" on:click={() => triggerAction('wordCount')}>
          <FileText size={14} class="text-blue-400" />
          <span>Document Statistics</span>
        </button>
        <button class="flex items-center space-x-1 px-2 py-1 rounded hover:bg-white/10 text-slate-300" on:click={() => triggerAction('ocr')}>
          <span>OCR Text Extractor</span>
        </button>
      </div>

    {:else if activeTab === 'AI'}
      <!-- AI TAB: OnlyOffice AI Assistant Shortcuts -->
      <div class="flex items-center space-x-3">
        <button class="flex items-center space-x-1.5 px-3 py-1 rounded bg-purple-600 hover:bg-purple-700 text-white font-semibold shadow-xs" on:click={() => (showAiModal = true)}>
          <Sparkles size={13} />
          <span>Open AI Assistant</span>
        </button>
        <button class="px-2 py-1 rounded hover:bg-white/10 text-purple-300" on:click={() => { showAiModal = true; }}>
          <span>Summarize Document</span>
        </button>
        <button class="px-2 py-1 rounded hover:bg-white/10 text-purple-300" on:click={() => { showAiModal = true; }}>
          <span>Rewrite & Polish</span>
        </button>
        {#if activeMode === 'sheets'}
          <button class="px-2 py-1 rounded hover:bg-white/10 text-emerald-300" on:click={() => { showAiModal = true; }}>
            <span>Build Formula</span>
          </button>
        {/if}
      </div>
    {/if}

    <!-- Right Side Indicator -->
    <div class="flex items-center space-x-2 text-[11px] text-slate-400 font-mono">
      <span class="capitalize">{activeMode === 'writer' ? 'Word Document' : activeMode === 'sheets' ? 'Spreadsheet' : activeMode === 'pdf' ? 'PDF Form' : 'Slide Deck'}</span>
    </div>
  </div>
</header>

<!-- AI Assistant Modal Dialog -->
{#if showAiModal}
  <AiAssistantModal
    {activeMode}
    on:apply={handleAiApply}
    on:close={() => (showAiModal = false)}
  />
{/if}
