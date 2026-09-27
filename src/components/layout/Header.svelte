<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { WorkspaceMode, DocumentMeta } from '../../types';
  import {
    FileText,
    Sheet,
    Presentation,
    Save,
    Download,
    ChevronDown,
    Cloud,
    Star,
    Keyboard,
    Undo2,
    Redo2,
    Sparkles,
    History,
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
    CheckCircle2,
    Shield,
    Lock,
    ZoomIn,
    ZoomOut,
    Maximize,
    Palette,
    Play,
    Calculator,
    MessageSquare,
    Plus,
    FileSpreadsheet,
    Settings,
    Baseline,
    ArrowRight,
    ArrowLeft,
    Calendar,
    BarChart3,
    Upload,
    Copy,
    Trash2,
    Quote,
    Search,
    Replace } from '@lucide/svelte';
  import type { AppSettings } from '../../types';
  import AiAssistantModal from './AiAssistantModal.svelte';

  export let activeMode: WorkspaceMode;
  export let meta: DocumentMeta;
  export let settings: AppSettings | undefined = undefined;
  export let zoom: number = 100;

  const dispatch = createEventDispatcher<{
    changeMode: WorkspaceMode;
    newDoc: void;
    openDoc: void;
    saveDoc: void;
    saveAsDoc: void;
    exportFormat: { format: string };
    printPdf: void;
    openShortcuts: void;
    openSettings: void;
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
  let aiContext = '';

  const moduleLabels: Record<WorkspaceMode, string> = {
    writer: 'Writer (document editor)',
    sheets: 'Sheet (spreadsheet editor)',
    slides: 'Slides (presentation editor)',
  };

  // Google-style typography controls shared by the ribbon
  const FONT_FAMILIES = [
    { label: 'Sans (Inter)', value: 'Inter, -apple-system, sans-serif' },
    { label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
    { label: 'Times New Roman', value: '"Times New Roman", Times, serif' },
    { label: 'Georgia', value: 'Georgia, serif' },
    { label: 'Merriweather', value: 'Merriweather, serif' },
    { label: 'Courier New', value: '"Courier New", Courier, monospace' },
    { label: 'JetBrains Mono', value: '"JetBrains Mono", Consolas, monospace' },
    { label: 'Trebuchet MS', value: '"Trebuchet MS", sans-serif' },
    { label: 'Verdana', value: 'Verdana, sans-serif' },
  ];

  const FONT_SIZES = [
    { label: '9', exec: '1' },
    { label: '10', exec: '2' },
    { label: '11', exec: '3' },
    { label: '12', exec: '4' },
    { label: '14', exec: '5' },
    { label: '18', exec: '6' },
    { label: '24', exec: '7' },
    { label: '36', exec: '8' },
  ];

  let fontFamily = FONT_FAMILIES[0].value;
  let fontSize = FONT_SIZES[2].exec;
  let textColor = '#0f172a';
  let highlightColor = '#fef08a';
  let lineSpacing = '1';

  const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  const modKey = isMac ? '⌘' : 'Ctrl';

  // Ribbon tab layout per workspace module
  const tabsByMode: Record<WorkspaceMode, string[]> = {
    writer: ['File', 'Home', 'Insert', 'Layout', 'References', 'Collaboration', 'Protection', 'View', 'Tools', 'AI'],
    sheets: ['File', 'Home', 'Insert', 'Layout', 'Formula', 'Data', 'References', 'Collaboration', 'Protection', 'View', 'Tools', 'AI'],
    slides: ['File', 'Home', 'Insert', 'Design', 'Transitions', 'Animation', 'Layout', 'References', 'Collaboration', 'Protection', 'View', 'Tools', 'AI'],
  };

  $: currentTabs = tabsByMode[activeMode] || tabsByMode.writer;

  // Active theme accent color per workspace module
  $: accentColor =
    activeMode === 'writer'
      ? { text: 'text-blue-500', hex: '#3b82f6', bg: 'bg-blue-600', ring: 'ring-blue-500' }
      : activeMode === 'sheets'
      ? { text: 'text-emerald-500', hex: '#16a34a', bg: 'bg-emerald-600', ring: 'ring-emerald-500' }
      : { text: 'text-orange-500', hex: '#ea580c', bg: 'bg-orange-600', ring: 'ring-orange-500' };

  function handleTabClick(tab: string) {
    if (tab === 'File') {
      showFileMenu = !showFileMenu;
      return;
    }
    showFileMenu = false;
    activeTab = tab;
    if (tab === 'AI') {
      openAiModal();
    }
  }

  function openAiModal() {
    aiContext = buildAiContext();
    showAiModal = true;
  }

  function collectWorkspaceText(): string {
    if (typeof document === 'undefined') return '';
    const root = document.querySelector('main');
    if (!root) return '';
    const text = (root.textContent || '').replace(/\s+/g, ' ').trim();
    return text.length > 1600 ? `${text.slice(0, 1600)}...` : text;
  }

  function buildAiContext(): string {
    const selection =
      typeof window !== 'undefined' ? (window.getSelection()?.toString() || '').trim() : '';
    const parts = [
      `Workspace module: ${moduleLabels[activeMode]}`,
      `Document title: ${meta.title || 'Untitled'}`,
      `File path: ${meta.filePath || 'not saved yet'}`,
      `Last saved: ${meta.lastSaved || 'never'}`,
      `Unsaved changes: ${meta.isDirty ? 'yes' : 'no'}`,
    ];
    if (selection) {
      parts.push(`Selected text: ${selection.slice(0, 1200)}`);
    }
    const workspaceText = collectWorkspaceText();
    if (workspaceText) {
      parts.push(`Visible workspace text: ${workspaceText}`);
    }
    return parts.join('\n');
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
          <div class="w-6 h-6 rounded bg-blue-600 flex items-center justify-center text-white shadow-xs" title="SOS Writer">
            <FileText size={14} />
          </div>
          <span class="font-bold text-slate-100 text-xs tracking-tight hidden sm:inline">Word</span>
        {:else if activeMode === 'sheets'}
          <div class="w-6 h-6 rounded bg-emerald-600 flex items-center justify-center text-white shadow-xs" title="SOS Sheet">
            <Sheet size={14} />
          </div>
          <span class="font-bold text-slate-100 text-xs tracking-tight hidden sm:inline">Sheet</span>
        {:else if activeMode === 'slides'}
          <div class="w-6 h-6 rounded bg-orange-600 flex items-center justify-center text-white shadow-xs" title="SOS Slides">
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

    <!-- Center: Workspace Switcher -->
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

    </nav>

    <!-- Right: Export & Shortcuts -->
    <div class="flex items-center space-x-1.5">
      <!-- Settings button -->
      <button
        class="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
        on:click={() => dispatch('openSettings')}
        title="Settings ({modKey}+,)"
      >
        <Settings size={14} />
      </button>

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
                  <span>Word HTML adapter (.docx)</span>
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
                  <span>Spreadsheet XML adapter (.xlsx)</span>
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
                  <span>Slide XML adapter (.pptx)</span>
                  <span class="text-[9px] text-slate-400 font-mono">PPTX</span>
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

  <!-- RIBBON TAB STRIP -->
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

        <!-- Active Tab Underline Indicator -->
        {#if isActive}
          <div
            class="absolute bottom-0 left-0 right-0 h-[3px] transition-all"
            style="background-color: {accentColor.hex};"
          ></div>
        {/if}

        <!-- File Dropdown Menu -->
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
            <div class="border-t border-slate-800 my-1"></div>
            <button class="w-full px-3.5 py-1.5 text-left hover:bg-blue-600 flex items-center justify-between" on:click|stopPropagation={() => { showFileMenu = false; dispatch('openSettings'); }}>
              <span>Settings...</span>
              <span class="text-[10px] text-slate-400 font-mono">{modKey}+,</span>
            </button>
          </div>
        {/if}
      </div>
    {/each}
  </div>

  <!-- RIBBON ACTION TOOLBAR -->
  <div class="h-10 px-4 bg-[#2b2d31] border-b border-[#36393f] flex items-center justify-between text-xs text-slate-300 overflow-x-auto shadow-inner">
    {#if activeTab === 'Home'}
      <!-- HOME TAB: Google-style typography, colours, paragraph and mode-specific controls -->
      <div class="flex items-center space-x-2">
        <select
          class="bg-slate-700/60 hover:bg-slate-600/60 text-slate-200 text-[11px] rounded px-1.5 py-1 outline-none max-w-[9.5rem]"
          value={fontFamily}
          on:change={(e) => triggerAction('fontFamily', (e.currentTarget as HTMLSelectElement).value)}
          title="Font family"
        >
          {#each FONT_FAMILIES as font}
            <option value={font.value}>{font.label}</option>
          {/each}
        </select>
        <select
          class="bg-slate-700/60 hover:bg-slate-600/60 text-slate-200 text-[11px] rounded px-1 py-1 outline-none"
          value={fontSize}
          on:change={(e) => triggerAction('fontSize', (e.currentTarget as HTMLSelectElement).value)}
          title="Font size"
        >
          {#each FONT_SIZES as size}
            <option value={size.exec}>{size.label}</option>
          {/each}
        </select>
        <button class="p-1 rounded hover:bg-white/10 text-slate-300 text-xs font-bold" on:click={() => triggerAction('growFont')} title="Increase font size">
          <span>A+</span>
        </button>
        <button class="p-1 rounded hover:bg-white/10 text-slate-300 text-xs font-bold" on:click={() => triggerAction('shrinkFont')} title="Decrease font size">
          <span>A-</span>
        </button>

        <div class="relative flex items-center">
          <input
            type="color"
            class="absolute inset-0 opacity-0 w-6 h-6 cursor-pointer"
            value={textColor}
            on:input={(e) => triggerAction('textColor', (e.currentTarget as HTMLInputElement).value)}
            title="Text colour"
            aria-label="Text colour"
          />
          <span class="w-6 h-6 rounded flex items-center justify-center text-slate-300" style={`color: ${textColor}`}>
            <Baseline size={14} />
          </span>
        </div>
        <div class="relative flex items-center">
          <input
            type="color"
            class="absolute inset-0 opacity-0 w-6 h-6 cursor-pointer"
            value={highlightColor}
            on:input={(e) => triggerAction('highlightColor', (e.currentTarget as HTMLInputElement).value)}
            title="Highlight colour"
            aria-label="Highlight colour"
          />
          <span class="w-6 h-6 rounded flex items-center justify-center" style={`background: ${highlightColor}`}>
            <Highlighter size={14} class="text-slate-800/70" />
          </span>
        </div>

        <div class="h-4 w-px bg-slate-700 mx-1"></div>

        <select
          class="bg-slate-700/60 hover:bg-slate-600/60 text-slate-200 text-[11px] rounded px-1.5 py-1 outline-none"
          value={lineSpacing}
          on:change={(e) => triggerAction('lineSpacing', (e.currentTarget as HTMLSelectElement).value)}
          title="Line spacing"
        >
          <option value="1">Single spacing</option>
          <option value="1.5">1.5 spacing</option>
          <option value="2">Double spacing</option>
        </select>
        <button class="p-1 rounded hover:bg-white/10 text-slate-300" on:click={() => triggerAction('indent')} title="Increase indent">
          <ArrowRight size={14} />
        </button>
        <button class="p-1 rounded hover:bg-white/10 text-slate-300" on:click={() => triggerAction('outdent')} title="Decrease indent">
          <ArrowLeft size={14} />
        </button>
        <button class="p-1 rounded hover:bg-white/10 text-slate-300" on:click={() => triggerAction('clearFormat')} title="Clear formatting">
          <Eraser size={14} />
        </button>

        <div class="h-4 w-px bg-slate-700 mx-1"></div>

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
        {/if}
      </div>

    {:else if activeTab === 'Insert'}
      <div class="flex items-center space-x-2">
        {#if activeMode === 'writer'}
          <button class="ribbon-btn" on:click={() => triggerAction('insertTable')} title="Insert table">
            <Table size={14} class="text-blue-400" /><span>Table</span>
          </button>
          <button class="ribbon-btn" on:click={() => triggerAction('insertImage')} title="Insert image from this device">
            <Image size={14} class="text-emerald-400" /><span>Image</span>
          </button>
          <button class="ribbon-btn" on:click={() => triggerAction('insertLink')} title="Insert hyperlink">
            <Link size={14} class="text-amber-400" /><span>Link</span>
          </button>
          <button class="ribbon-btn" on:click={() => triggerAction('insertChecklist')} title="Insert checklist">
            <CheckCircle2 size={14} class="text-emerald-400" /><span>Checklist</span>
          </button>
          <button class="ribbon-btn" on:click={() => triggerAction('insertCallout', 'info')} title="Insert callout box">
            <MessageSquare size={14} class="text-cyan-400" /><span>Callout</span>
          </button>
          <button class="ribbon-btn" on:click={() => triggerAction('insertCodeBlock')} title="Insert code block">
            <span class="font-mono text-[10px]">{`</>`}</span><span>Code</span>
          </button>
          <button class="ribbon-btn" on:click={() => triggerAction('insertHighlight')} title="Highlight selection">
            <Highlighter size={14} class="text-amber-300" /><span>Highlight</span>
          </button>
          <button class="ribbon-btn" on:click={() => triggerAction('insertDate')} title="Insert today's date">
            <Calendar size={14} class="text-slate-300" /><span>Date</span>
          </button>
          <button class="ribbon-btn" on:click={() => triggerAction('pageBreak')} title="Insert page break">
            <ArrowRight size={14} class="text-slate-300" /><span>Page break</span>
          </button>
        {:else if activeMode === 'sheets'}
          <button class="ribbon-btn" on:click={() => triggerAction('insertChart')} title="Insert chart">
            <BarChart3 size={14} class="text-emerald-400" /><span>Chart</span>
          </button>
          <button class="ribbon-btn" on:click={() => triggerAction('conditionalFormatting')} title="Conditional formatting">
            <Sparkles size={14} class="text-purple-400" /><span>Conditional</span>
          </button>
          <button class="ribbon-btn" on:click={() => triggerAction('insertFx')} title="Insert function">
            <FunctionSquare size={14} class="text-purple-400" /><span>Function</span>
          </button>
          <button class="ribbon-btn" on:click={() => triggerAction('mergeCells')} title="Merge cells">
            <Columns size={14} class="text-slate-300" /><span>Merge</span>
          </button>
          <button class="ribbon-btn" on:click={() => triggerAction('freezeHeader')} title="Freeze first row">
            <Lock size={14} class="text-slate-300" /><span>Freeze</span>
          </button>
          <button class="ribbon-btn" on:click={() => triggerAction('dataValidation')} title="Data validation list">
            <CheckCircle2 size={14} class="text-emerald-400" /><span>Validation</span>
          </button>
          <button class="ribbon-btn" on:click={() => triggerAction('insertRowAbove')} title="Insert row above">
            <Plus size={14} class="text-slate-300" /><span>Row</span>
          </button>
          <button class="ribbon-btn" on:click={() => triggerAction('insertColLeft')} title="Insert column left">
            <Plus size={14} class="text-slate-300" /><span>Column</span>
          </button>
          <button class="ribbon-btn" on:click={() => triggerAction('importFile')} title="Import CSV or Excel">
            <Upload size={14} class="text-sky-400" /><span>Import</span>
          </button>
        {:else}
          <button class="ribbon-btn" on:click={() => triggerAction('insertTextBox')} title="Insert text box">
            <FileText size={14} class="text-orange-400" /><span>Text box</span>
          </button>
          <button class="ribbon-btn" on:click={() => triggerAction('insertShape')} title="Insert shape">
            <Palette size={14} class="text-orange-400" /><span>Shape</span>
          </button>
          <button class="ribbon-btn" on:click={() => triggerAction('insertStat')} title="Insert stat callout">
            <Calculator size={14} class="text-orange-400" /><span>Stat</span>
          </button>
          <button class="ribbon-btn" on:click={() => triggerAction('insertImage')} title="Insert image">
            <Image size={14} class="text-emerald-400" /><span>Image</span>
          </button>
          <button class="ribbon-btn" on:click={() => triggerAction('newSlide')} title="New slide">
            <Plus size={14} class="text-orange-400" /><span>New slide</span>
          </button>
          <button class="ribbon-btn" on:click={() => triggerAction('duplicateSlide')} title="Duplicate slide">
            <Copy size={14} class="text-slate-300" /><span>Duplicate</span>
          </button>
          <button class="ribbon-btn" on:click={() => triggerAction('deleteSlide')} title="Delete slide">
            <Trash2 size={14} class="text-rose-400" /><span>Delete</span>
          </button>
          <button class="ribbon-btn" on:click={() => triggerAction('insertNotes')} title="Speaker notes">
            <FileText size={14} class="text-slate-300" /><span>Notes</span>
          </button>
        {/if}
      </div>

    

    {:else if activeTab === 'Animation'}
      <div class="flex items-center space-x-2">
        <span class="text-[11px] text-slate-400">Entrance</span>
        <button class="ribbon-btn" on:click={() => triggerAction('elementAnimation', 'none')} title="No animation">None</button>
        <button class="ribbon-btn" on:click={() => triggerAction('elementAnimation', 'fade')} title="Fade in">Fade</button>
        <button class="ribbon-btn" on:click={() => triggerAction('elementAnimation', 'slideUp')} title="Slide up">Up</button>
        <button class="ribbon-btn" on:click={() => triggerAction('elementAnimation', 'slideDown')} title="Slide down">Down</button>
        <button class="ribbon-btn" on:click={() => triggerAction('elementAnimation', 'slideLeft')} title="Slide from the right">Left</button>
        <button class="ribbon-btn" on:click={() => triggerAction('elementAnimation', 'slideRight')} title="Slide from the left">Right</button>
        <button class="ribbon-btn" on:click={() => triggerAction('elementAnimation', 'zoom')} title="Zoom in">Zoom</button>
        <button class="ribbon-btn" on:click={() => triggerAction('elementAnimation', 'pop')} title="Pop">Pop</button>
        <div class="h-4 w-px bg-slate-700 mx-1"></div>
        <button class="ribbon-btn" on:click={() => triggerAction('animationDelay', 0)} title="Start immediately">0ms</button>
        <button class="ribbon-btn" on:click={() => triggerAction('animationDelay', 250)} title="Delay a quarter second">250ms</button>
        <button class="ribbon-btn" on:click={() => triggerAction('animationDelay', 500)} title="Delay half a second">500ms</button>
        <button class="ribbon-btn" on:click={() => triggerAction('animationDelay', 1000)} title="Delay one second">1s</button>
        <button class="ribbon-btn" on:click={() => triggerAction('animationAutoPlay')} title="Repeat while the slide is shown">Loop</button>
        <button class="ribbon-btn" on:click={() => triggerAction('clearAnimations')} title="Remove every animation on this slide">Clear</button>
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

    

    {:else if activeTab === 'Transitions'}
      <div class="flex items-center space-x-2">
        <span class="text-[11px] text-slate-400">Slide transition</span>
        <button class="ribbon-btn" on:click={() => triggerAction('transition', 'none')} title="No transition">None</button>
        <button class="ribbon-btn" on:click={() => triggerAction('transition', 'fade')} title="Fade transition">Fade</button>
        <button class="ribbon-btn" on:click={() => triggerAction('transition', 'slide')} title="Slide transition">Push</button>
        <button class="ribbon-btn" on:click={() => triggerAction('transition', 'zoom')} title="Zoom transition">Zoom</button>
        <div class="h-4 w-px bg-slate-700 mx-1"></div>
        <button class="ribbon-btn" on:click={() => triggerAction('alignElement', 'centerH')} title="Centre selected element horizontally">
          <AlignCenter size={14} /><span>Centre</span>
        </button>
        <button class="ribbon-btn" on:click={() => triggerAction('alignElement', 'centerV')} title="Centre selected element vertically">
          <AlignLeft size={14} class="rotate-90" /><span>Middle</span>
        </button>
        <button class="ribbon-btn" on:click={() => triggerAction('present')} title="Present from the start">
          <Play size={14} /><span>Present</span>
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
      <div class="flex items-center space-x-2">
        {#if activeMode === 'writer'}
          <button class="ribbon-btn" on:click={() => triggerAction('insertToc')} title="Insert table of contents">
            <BookOpen size={14} class="text-blue-400" /><span>Contents</span>
          </button>
          <button class="ribbon-btn" on:click={() => triggerAction('insertFootnote')} title="Insert footnote">
            <FileText size={14} class="text-slate-300" /><span>Footnote</span>
          </button>
          <button class="ribbon-btn" on:click={() => triggerAction('insertCitation')} title="Insert citation">
            <Quote size={14} class="text-blue-400" /><span>Citation</span>
          </button>
          <button class="ribbon-btn" on:click={() => triggerAction('addComment')} title="Comment on the selected text">
            <MessageSquare size={14} class="text-amber-300" /><span>Comment</span>
          </button>
        {:else if activeMode === 'sheets'}
          <button class="ribbon-btn" on:click={() => triggerAction('dataValidation')} title="Validation list for this cell">
            <CheckCircle2 size={14} class="text-emerald-400" /><span>Validation</span>
          </button>
          <button class="ribbon-btn" on:click={() => triggerAction('toggleFilter')} title="Filter this column">
            <Filter size={14} class="text-sky-400" /><span>Filter</span>
          </button>
          <button class="ribbon-btn" on:click={() => triggerAction('conditionalFormatting')} title="Conditional formatting">
            <Sparkles size={14} class="text-purple-400" /><span>Conditional</span>
          </button>
        {:else}
          <button class="ribbon-btn" on:click={() => triggerAction('insertNotes')} title="Edit speaker notes">
            <FileText size={14} class="text-slate-300" /><span>Speaker notes</span>
          </button>
          <button class="ribbon-btn" on:click={() => triggerAction('duplicateSlide')} title="Duplicate this slide">
            <Copy size={14} class="text-slate-300" /><span>Duplicate</span>
          </button>
        {/if}
      </div>



    {:else if activeTab === 'Collaboration'}
      <div class="flex items-center space-x-2">
        <button class="ribbon-btn" on:click={() => triggerAction('addComment')} title="Comment on the selected text">
          <MessageSquare size={14} class="text-amber-300" /><span>Comment</span>
        </button>
        <button class="ribbon-btn" on:click={() => triggerAction('openComments')} title="Open the comments panel with replies and resolved threads">
          <MessageSquare size={14} class="text-amber-200" /><span>All comments</span>
        </button>
        <button class="ribbon-btn" on:click={() => triggerAction('versionHistory')} title="Browse and restore earlier versions">
          <History size={14} class="text-slate-300" /><span>Version history</span>
        </button>
        <button class="ribbon-btn" on:click={() => triggerAction('trackChanges')} title="Track changes while typing">
          <Shield size={14} class="text-purple-400" /><span>Suggesting</span>
        </button>
        <button class="ribbon-btn" on:click={() => triggerAction('suggestDelete')} title="Mark the selection as a deletion">
          <Strikethrough size={14} class="text-rose-400" /><span>Mark deletion</span>
        </button>
      </div>



    {:else if activeTab === 'Protection'}
      <div class="flex items-center space-x-2">
        <button class="ribbon-btn" on:click={() => triggerAction('protectDoc')} title="Protect this document from editing">
          <Lock size={14} class="text-amber-300" /><span>Protect</span>
        </button>
        <button class="ribbon-btn" on:click={() => triggerAction('lockReadOnly')} title="Make this document read only">
          <Shield size={14} class="text-slate-300" /><span>Read only</span>
        </button>
        <button class="ribbon-btn" on:click={() => triggerAction('watermark')} title="Toggle a DRAFT watermark">
          <Palette size={14} class="text-sky-300" /><span>Watermark</span>
        </button>
        <button class="ribbon-btn" on:click={() => triggerAction('watermarkDialog')} title="Watermark text, angle, opacity, and colour">
          <Palette size={14} class="text-sky-200" /><span>Watermark style</span>
        </button>
        <button class="ribbon-btn" on:click={() => triggerAction('specialChars')} title="Insert a special character">
          <Sparkles size={14} class="text-violet-300" /><span>Symbols</span>
        </button>
      </div>



    

    

    

    

    

    

    {:else if activeTab === 'View'}
      <div class="flex items-center space-x-2">
        <button class="ribbon-btn" on:click={() => triggerAction('zoomOut')} title="Zoom out">
          <ZoomOut size={14} /><span>Out</span>
        </button>
        <button class="ribbon-btn" on:click={() => triggerAction('zoomReset')} title="Reset zoom to 100%">
          <span class="font-mono">{zoom}%</span>
        </button>
        <button class="ribbon-btn" on:click={() => triggerAction('zoomIn')} title="Zoom in">
          <ZoomIn size={14} /><span>In</span>
        </button>
        <div class="h-4 w-px bg-slate-700 mx-1"></div>
        <button class="ribbon-btn" on:click={() => triggerAction('toggleFullscreen')} title="Toggle full screen">
          <Maximize size={14} /><span>Full screen</span>
        </button>
        {#if activeMode === 'slides'}
          <button class="ribbon-btn" on:click={() => triggerAction('present')} title="Present">
            <Play size={14} /><span>Present</span>
          </button>
        {/if}
      </div>

    {:else if activeTab === 'Tools'}
      <div class="flex items-center space-x-2">
        <button class="ribbon-btn" on:click={() => triggerAction('wordCount')} title="Word count and reading time">
          <FileText size={14} class="text-slate-300" /><span>Word count</span>
        </button>
        <button class="ribbon-btn" on:click={() => triggerAction('openCalculator')} title="Open the calculator">
          <Calculator size={14} class="text-emerald-400" /><span>Calculator</span>
        </button>
        <button class="ribbon-btn" on:click={() => triggerAction('find')} title="Find text">
          <Search size={14} class="text-sky-400" /><span>Find</span>
        </button>
        <button class="ribbon-btn" on:click={() => triggerAction('replace')} title="Find and replace">
          <Replace size={14} class="text-sky-400" /><span>Replace</span>
        </button>
        <button class="ribbon-btn" on:click={() => triggerAction('recalculate')} title="Recalculate all formulas">
          <Sigma size={14} class="text-purple-400" /><span>Recalculate</span>
        </button>
      </div>



    {:else if activeTab === 'AI'}
      <div class="flex items-center space-x-3">
        <button class="flex items-center space-x-1.5 px-3 py-1 rounded bg-purple-600 hover:bg-purple-700 text-white font-semibold shadow-xs" on:click={openAiModal}>
          <Sparkles size={13} />
          <span>Open AI Assistant</span>
        </button>
        <button class="px-2 py-1 rounded hover:bg-white/10 text-purple-300" on:click={openAiModal}>
          <span>Summarize Document</span>
        </button>
        <button class="px-2 py-1 rounded hover:bg-white/10 text-purple-300" on:click={openAiModal}>
          <span>Rewrite & Polish</span>
        </button>
        {#if activeMode === 'sheets'}
          <button class="px-2 py-1 rounded hover:bg-white/10 text-emerald-300" on:click={openAiModal}>
            <span>Build Formula</span>
          </button>
        {/if}
      </div>
    {/if}

    <!-- Right Side Indicator -->
    <div class="flex items-center space-x-2 text-[11px] text-slate-400 font-mono">
      <span>{moduleLabels[activeMode]}</span>
    </div>
  </div>

</header>

<!-- AI Assistant Modal Dialog -->
{#if showAiModal}
  <AiAssistantModal
    {activeMode}
    {settings}
    currentContext={aiContext}
    on:apply={handleAiApply}
    on:close={() => (showAiModal = false)}
  />
{/if}
