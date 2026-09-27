<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { WorkspaceMode, DocumentMeta, AppSettings } from '../../types';
  import {
    FileText,
    Sheet,
    Presentation,
    CheckSquare,
    HardDrive,
    FileCheck,
    Star,
    Cloud,
    FolderKanban,
    History,
    MessageSquare,
    Lock,
    Search,
    Sliders,
    Settings,
    Keyboard,
    Download,
    Printer,
    Undo2,
    Redo2,
    ChevronDown,
    Plus,
    Copy,
    Trash2,
    Check,
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
    Sigma,
    Filter,
    ArrowDownAZ,
    ArrowUpZA,
    LayoutTemplate,
    PenTool,
    ShieldCheck,
    ExternalLink,
    User,
    BarChart2,
    BarChart3,
    Palette,
    Square,
    Code2
  } from 'lucide-svelte';
  import GoogleShareModal from './GoogleShareModal.svelte';
  import GoogleAccountModal from './GoogleAccountModal.svelte';
  import GoogleSyncModal from './GoogleSyncModal.svelte';
  import GoogleAppsManagerModal from './GoogleAppsManagerModal.svelte';
  import {
    currentSyncStatus,
    syncSettings,
    isNetworkOnline,
    performCloudSync,
    activeAccount
  } from '../../lib/googleSync';

  export let activeMode: WorkspaceMode;
  export let meta: DocumentMeta;
  export let settings: AppSettings | undefined = undefined;

  const dispatch = createEventDispatcher<{
    changeMode: WorkspaceMode;
    newDoc: void;
    openDoc: void;
    saveDoc: void;
    saveAsDoc: void;
    exportFormat: string;
    printPdf: void;
    openShortcuts: void;
    openSettings: void;
    openCommandPalette: void;
    openFileBackstage: void;
    undo: void;
    redo: void;
    ribbonAction: { action: string; payload?: any };
    toggleGeminiSidePanel: void;
    openGeminiAction: { action: string; payload?: any };
  }>();

  let isRenaming = false;
  let tempTitle = '';
  let isStarred = false;
  let showShareModal = false;
  let showAccountModal = false;
  let showSyncModal = false;
  let showAppsManagerModal = false;
  let activeOpenMenu: string | null = null;
  let showOfflineTooltip = false;

  let enabledAppIds: string[] = (() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const raw = localStorage.getItem('google_enabled_apps_v1');
        if (raw) return JSON.parse(raw);
      } catch {}
    }
    return ['drive', 'writer', 'sheets', 'slides', 'forms', 'pdf'];
  })();

  function handleSaveAppsConfig(e: CustomEvent<{ enabledAppIds: string[]; defaultAppId: string }>) {
    enabledAppIds = e.detail.enabledAppIds;
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem('google_enabled_apps_v1', JSON.stringify(enabledAppIds));
    }
    if (!enabledAppIds.includes(activeMode)) {
      dispatch('changeMode', enabledAppIds[0] as WorkspaceMode);
    }
  }

  const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const modKey = isMac ? '⌘' : 'Ctrl';

  // Menus per Google Workspace Application (Includes Gemini)
  const menusByMode: Record<WorkspaceMode, string[]> = {
    writer: ['File', 'Edit', 'View', 'Insert', 'Format', 'Tools', 'Gemini', 'Extensions', 'Help'],
    sheets: ['File', 'Edit', 'View', 'Insert', 'Format', 'Data', 'Tools', 'Gemini', 'Extensions', 'Help'],
    slides: ['File', 'Edit', 'View', 'Insert', 'Format', 'Slide', 'Arrange', 'Tools', 'Gemini', 'Extensions', 'Help'],
    forms: ['File', 'Edit', 'View', 'Insert', 'Tools', 'Gemini', 'Responses', 'Help'],
    drive: ['File', 'New', 'View', 'Sort', 'Tools', 'Gemini', 'Help'],
    pdf: ['File', 'Edit', 'View', 'Annotate', 'Tools', 'Gemini', 'Help'],
  };

  $: currentMenus = menusByMode[activeMode] || menusByMode.writer;

  function commitRename() {
    if (tempTitle.trim() && tempTitle !== meta.title) {
      meta.title = tempTitle.trim();
      meta.isDirty = true;
    }
    isRenaming = false;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') commitRename();
    if (e.key === 'Escape') isRenaming = false;
  }

  function toggleMenu(menu: string) {
    activeOpenMenu = activeOpenMenu === menu ? null : menu;
  }

  function closeMenus() {
    activeOpenMenu = null;
  }

  function triggerAction(action: string, payload?: any) {
    closeMenus();
    dispatch('ribbonAction', { action, payload });
  }

  function handleExport(format: string) {
    closeMenus();
    dispatch('exportFormat', format);
  }

  function getAppBranding(mode: WorkspaceMode) {
    if (mode === 'sheets') {
      return {
        name: 'Spreadsheet',
        shortName: 'Sheets',
        icon: Sheet,
        color: '#0F9D58',
        textColor: 'text-emerald-700',
        bgColor: 'bg-emerald-600',
        lightBg: 'bg-emerald-50',
        borderFocus: 'border-emerald-500'
      };
    }
    if (mode === 'slides') {
      return {
        name: 'Presentation',
        shortName: 'Slides',
        icon: Presentation,
        color: '#F4B400',
        textColor: 'text-amber-700',
        bgColor: 'bg-amber-500',
        lightBg: 'bg-amber-50',
        borderFocus: 'border-amber-500'
      };
    }
    if (mode === 'forms') {
      return {
        name: 'Form Editor',
        shortName: 'Forms',
        icon: CheckSquare,
        color: '#673AB7',
        textColor: 'text-purple-700',
        bgColor: 'bg-purple-600',
        lightBg: 'bg-purple-50',
        borderFocus: 'border-purple-500'
      };
    }
    if (mode === 'drive') {
      return {
        name: 'Files & Storage',
        shortName: 'Files',
        icon: HardDrive,
        color: '#4285F4',
        textColor: 'text-blue-700',
        bgColor: 'bg-blue-600',
        lightBg: 'bg-blue-50',
        borderFocus: 'border-blue-500'
      };
    }
    if (mode === 'pdf') {
      return {
        name: 'PDF Viewer',
        shortName: 'PDF',
        icon: FileCheck,
        color: '#EA4335',
        textColor: 'text-rose-700',
        bgColor: 'bg-rose-600',
        lightBg: 'bg-rose-50',
        borderFocus: 'border-rose-500'
      };
    }
    return {
      name: 'Document Editor',
      shortName: 'Docs',
      icon: FileText,
      color: '#1a73e8',
      textColor: 'text-blue-700',
      bgColor: 'bg-blue-600',
      lightBg: 'bg-blue-50',
      borderFocus: 'border-blue-500'
    };
  }

  $: brand = getAppBranding(activeMode);
</script>

<svelte:window on:click={closeMenus} />

<header class="no-print select-none z-[100] relative bg-[#F9FBFD] border-b border-slate-200/90 text-slate-700 font-sans shadow-2xs">
  <!-- Top Bar: App Branding, Document Title, Google Workspace Menus, Mode Switcher, Share -->
  <div class="h-16 px-4 flex items-center justify-between">
    <!-- Left: Google App Logo & Info Stack -->
    <div class="flex items-center space-x-3.5">
      <!-- App Icon (Click opens Google Drive Backstage) -->
      <button
        class="w-10 h-10 rounded-xl {brand.bgColor} text-white flex items-center justify-center shadow-xs hover:scale-105 transition-transform"
        on:click|stopPropagation={() => dispatch('openFileBackstage')}
        title="{brand.name} — Click to open Google Drive Hub"
      >
        <svelte:component this={brand.icon} size={22} />
      </button>

      <!-- Document Metadata & Menu Bar -->
      <div class="flex flex-col justify-center">
        <!-- Top Row: Document Title, Star, Folder, Offline Badge -->
        <div class="flex items-center space-x-1.5 h-6">
          {#if isRenaming}
            <input
              type="text"
              bind:value={tempTitle}
              on:blur={commitRename}
              on:keydown={handleKeydown}
              class="bg-white text-slate-900 border {brand.borderFocus} px-2 py-0.5 rounded text-sm font-medium outline-none shadow-xs"
              autoFocus
            />
          {:else}
            <button
              class="font-medium text-slate-800 hover:bg-slate-200/70 px-2 py-0.5 rounded text-sm truncate max-w-[260px] text-left transition-colors"
              on:click|stopPropagation={() => { tempTitle = meta.title; isRenaming = true; }}
              title="Click to rename"
            >
              {meta.title}
            </button>
          {/if}

          <!-- Star Icon -->
          <button
            class="p-1 rounded-full hover:bg-slate-200/70 transition-colors {isStarred ? 'text-amber-500' : 'text-slate-400 hover:text-slate-600'}"
            on:click|stopPropagation={() => (isStarred = !isStarred)}
            title="Star document"
          >
            <Star size={14} fill={isStarred ? 'currentColor' : 'none'} />
          </button>

          <!-- Move to Drive Folder Icon -->
          <button
            class="p-1 rounded-full hover:bg-slate-200/70 text-slate-400 hover:text-slate-600 transition-colors"
            on:click|stopPropagation={() => dispatch('changeMode', 'drive')}
            title="Move to folder in Google Drive"
          >
            <FolderKanban size={14} />
          </button>

          <!-- Offline Status Icon Badge -->
          <div class="relative">
            <button
              class="flex items-center space-x-1 px-1.5 py-0.5 rounded-full hover:bg-slate-200/70 text-slate-500 transition-colors text-[11px]"
              on:click|stopPropagation={() => (showOfflineTooltip = !showOfflineTooltip)}
              title="Document status"
            >
              <Cloud size={13} class="text-blue-600" />
              <Check size={10} class="text-blue-600 -ml-1.5 stroke-[3]" />
              <span class="text-[10px] text-slate-500 hidden xl:inline">Saved to Mac</span>
            </button>

            {#if showOfflineTooltip}
              <div class="absolute left-0 top-6 w-60 bg-white border border-slate-200 rounded-xl shadow-xl p-3 z-50 text-xs text-slate-700 animate-in fade-in zoom-in-95 duration-100">
                <div class="flex items-center space-x-2 text-emerald-700 font-semibold mb-1">
                  <ShieldCheck size={16} />
                  <span>100% Offline Document</span>
                </div>
                <p class="text-[11px] text-slate-500 leading-relaxed">
                  All changes are securely saved to your local disk storage. Zero data leaves your machine.
                </p>
              </div>
            {/if}
          </div>

          {#if meta.isDirty}
            <span class="w-2 h-2 rounded-full bg-amber-500 animate-pulse" title="Unsaved edits"></span>
          {/if}
        </div>

        <!-- Bottom Row: Authentic Google Workspace Menu Bar -->
        <div class="flex items-center space-x-0.5 text-xs text-slate-700 font-normal -ml-1 relative">
          {#each currentMenus as menu}
            {@const isOpen = activeOpenMenu === menu}
            <div class="relative">
              <button
                class="px-2 py-0.5 rounded hover:bg-slate-200/70 transition-colors text-xs
                  {isOpen ? 'bg-slate-200 text-slate-900 font-medium' : 'text-slate-700'}"
                on:click|stopPropagation={() => toggleMenu(menu)}
              >
                {menu}
              </button>

              <!-- Dropdown Menu -->
              {#if isOpen}
                <div
                  class="absolute left-0 top-7 min-w-[230px] max-h-[calc(100vh-80px)] overflow-y-auto bg-white border border-slate-200/90 rounded-xl shadow-2xl py-1.5 z-50 text-xs text-slate-700 divide-y divide-slate-100 animate-in fade-in zoom-in-95 duration-75 select-none"
                  on:click|stopPropagation
                >
                  <!-- FILE MENU -->
                  {#if menu === 'File'}
                    {#if activeMode === 'sheets'}
                      <div class="py-1">
                        <button class="w-full px-3.5 py-1.5 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => { closeMenus(); dispatch('newDoc'); }}>
                          <span class="flex items-center space-x-2"><Plus size={14} class="text-emerald-600" /><span>New spreadsheet</span></span>
                          <span class="text-[10px] text-slate-400 font-mono">{modKey}+N</span>
                        </button>
                        <button class="w-full px-3.5 py-1.5 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => { closeMenus(); triggerAction('insertPrebuiltTable', 'project_budget'); }}>
                          <span>From template gallery</span>
                        </button>
                        <button class="w-full px-3.5 py-1.5 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => { closeMenus(); dispatch('openDoc'); }}>
                          <span>Open</span>
                          <span class="text-[10px] text-slate-400 font-mono">{modKey}+O</span>
                        </button>
                        <button class="w-full px-3.5 py-1.5 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => { closeMenus(); triggerAction('importSpreadsheet'); }}>
                          <span>Import (.xlsx, .csv, .tsv)</span>
                        </button>
                        <button class="w-full px-3.5 py-1.5 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => { closeMenus(); dispatch('saveAsDoc'); }}>
                          <span>Make a copy</span>
                        </button>
                      </div>
                      <div class="py-1">
                        <button class="w-full px-3.5 py-1.5 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => { closeMenus(); showShareModal = true; }}>
                          <span class="flex items-center space-x-2"><Lock size={13} class="text-emerald-600" /><span>Share with others</span></span>
                        </button>
                        <button class="w-full px-3.5 py-1.5 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => { closeMenus(); handleExport('html'); }}>
                          <span>Publish to web (HTML)</span>
                        </button>
                        <button class="w-full px-3.5 py-1.5 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => { closeMenus(); dispatch('saveDoc'); }}>
                          <span>Save spreadsheet</span>
                          <span class="text-[10px] text-slate-400 font-mono">{modKey}+S</span>
                        </button>
                      </div>
                      <div class="py-1">
                        <span class="px-3.5 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Download</span>
                        <button class="w-full px-3.5 py-1 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => handleExport('xlsx')}>
                          <span>Microsoft Excel (.xlsx)</span>
                        </button>
                        <button class="w-full px-3.5 py-1 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => handleExport('xlsx')}>
                          <span>OpenDocument (.ods)</span>
                        </button>
                        <button class="w-full px-3.5 py-1 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => { closeMenus(); dispatch('printPdf'); }}>
                          <span>PDF Document (.pdf)</span>
                        </button>
                        <button class="w-full px-3.5 py-1 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => handleExport('html')}>
                          <span>Web page (.html)</span>
                        </button>
                        <button class="w-full px-3.5 py-1 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => handleExport('csv')}>
                          <span>Comma Separated (.csv)</span>
                        </button>
                        <button class="w-full px-3.5 py-1 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => handleExport('tsv')}>
                          <span>Tab Separated (.tsv)</span>
                        </button>
                      </div>
                      <div class="py-1">
                        <button class="w-full px-3.5 py-1.5 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => { closeMenus(); tempTitle = meta.title; isRenaming = true; }}>
                          <span>Rename</span>
                        </button>
                        <button class="w-full px-3.5 py-1.5 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => { closeMenus(); dispatch('changeMode', 'drive'); }}>
                          <span>Move to Drive</span>
                        </button>
                        <button class="w-full px-3.5 py-1.5 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => { closeMenus(); showSyncModal = true; }}>
                          <span>Add shortcut to Drive</span>
                        </button>
                        <button class="w-full px-3.5 py-1.5 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => { closeMenus(); showOfflineTooltip = true; }}>
                          <span>Make available offline</span>
                        </button>
                        <button class="w-full px-3.5 py-1.5 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => triggerAction('spreadsheetSettings')}>
                          <span>Settings (Calculation)</span>
                        </button>
                      </div>
                      <div class="py-1">
                        <button class="w-full px-3.5 py-1.5 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => { closeMenus(); dispatch('printPdf'); }}>
                          <span class="flex items-center space-x-2"><Printer size={13} /><span>Print</span></span>
                          <span class="text-[10px] text-slate-400 font-mono">{modKey}+P</span>
                        </button>
                      </div>
                    {:else}
                      <div class="py-1">
                        <button class="w-full px-3.5 py-1.5 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => { closeMenus(); dispatch('newDoc'); }}>
                          <span class="flex items-center space-x-2"><Plus size={14} class="text-blue-600" /><span>New</span></span>
                          <span class="text-[10px] text-slate-400 font-mono">{modKey}+N</span>
                        </button>
                        <button class="w-full px-3.5 py-1.5 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => { closeMenus(); dispatch('openDoc'); }}>
                          <span>Open</span>
                          <span class="text-[10px] text-slate-400 font-mono">{modKey}+O</span>
                        </button>
                        <button class="w-full px-3.5 py-1.5 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => { closeMenus(); dispatch('saveAsDoc'); }}>
                          <span>Make a copy</span>
                        </button>
                      </div>
                      <div class="py-1">
                        <button class="w-full px-3.5 py-1.5 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => { closeMenus(); showShareModal = true; }}>
                          <span class="flex items-center space-x-2"><Lock size={13} class="text-blue-600" /><span>Share</span></span>
                        </button>
                        <button class="w-full px-3.5 py-1.5 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => { closeMenus(); dispatch('saveDoc'); }}>
                          <span>Save</span>
                          <span class="text-[10px] text-slate-400 font-mono">{modKey}+S</span>
                        </button>
                      </div>
                      <div class="py-1">
                        <span class="px-3.5 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Download</span>
                        {#if activeMode === 'writer'}
                          <button class="w-full px-3.5 py-1 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => handleExport('docx')}>
                            <span>Microsoft Word (.docx)</span>
                          </button>
                          <button class="w-full px-3.5 py-1 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => handleExport('rtf')}>
                            <span>Rich Text Format (.rtf)</span>
                          </button>
                          <button class="w-full px-3.5 py-1 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => handleExport('md')}>
                            <span>Markdown (.md)</span>
                          </button>
                          <button class="w-full px-3.5 py-1 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => handleExport('txt')}>
                            <span>Plain Text (.txt)</span>
                          </button>
                        {:else if activeMode === 'slides'}
                          <button class="w-full px-3.5 py-1 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => handleExport('pptx')}>
                            <span>PowerPoint (.pptx)</span>
                          </button>
                        {/if}
                        <button class="w-full px-3.5 py-1 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => { closeMenus(); dispatch('printPdf'); }}>
                          <span>PDF Document (.pdf)</span>
                        </button>
                      </div>
                      <div class="py-1">
                        <button class="w-full px-3.5 py-1.5 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => { closeMenus(); dispatch('printPdf'); }}>
                          <span class="flex items-center space-x-2"><Printer size={13} /><span>Print</span></span>
                          <span class="text-[10px] text-slate-400 font-mono">{modKey}+P</span>
                        </button>
                      </div>
                    {/if}

                  <!-- EDIT MENU -->
                  {:else if menu === 'Edit'}
                    {#if activeMode === 'sheets'}
                      <div class="py-1">
                        <button class="w-full px-3.5 py-1.5 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => { closeMenus(); dispatch('undo'); }}>
                          <span>Undo</span>
                          <span class="text-[10px] text-slate-400 font-mono">{modKey}+Z</span>
                        </button>
                        <button class="w-full px-3.5 py-1.5 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => { closeMenus(); dispatch('redo'); }}>
                          <span>Redo</span>
                          <span class="text-[10px] text-slate-400 font-mono">{modKey}+Y</span>
                        </button>
                      </div>
                      <div class="py-1">
                        <button class="w-full px-3.5 py-1.5 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => triggerAction('cut')}>
                          <span>Cut</span>
                          <span class="text-[10px] text-slate-400 font-mono">{modKey}+X</span>
                        </button>
                        <button class="w-full px-3.5 py-1.5 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => triggerAction('copy')}>
                          <span>Copy</span>
                          <span class="text-[10px] text-slate-400 font-mono">{modKey}+C</span>
                        </button>
                        <button class="w-full px-3.5 py-1.5 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => triggerAction('paste')}>
                          <span>Paste</span>
                          <span class="text-[10px] text-slate-400 font-mono">{modKey}+V</span>
                        </button>
                      </div>
                      <div class="py-1">
                        <span class="px-3.5 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Paste special</span>
                        <button class="w-full px-3.5 py-1 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => triggerAction('pasteValuesOnly')}>
                          <span>Values only</span>
                          <span class="text-[10px] text-slate-400 font-mono">{modKey}+⇧+V</span>
                        </button>
                        <button class="w-full px-3.5 py-1 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => triggerAction('pasteFormatOnly')}>
                          <span>Format only</span>
                          <span class="text-[10px] text-slate-400 font-mono">{modKey}+⌥+V</span>
                        </button>
                        <button class="w-full px-3.5 py-1 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => triggerAction('pasteFormulaOnly')}>
                          <span>Formula only</span>
                        </button>
                        <button class="w-full px-3.5 py-1 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => triggerAction('conditionalFormatting')}>
                          <span>Conditional formatting only</span>
                        </button>
                        <button class="w-full px-3.5 py-1 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => triggerAction('openDataValidation')}>
                          <span>Data validation only</span>
                        </button>
                        <button class="w-full px-3.5 py-1 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => triggerAction('pasteTransposed')}>
                          <span>Transposed</span>
                        </button>
                      </div>
                      <div class="py-1">
                        <span class="px-3.5 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Delete</span>
                        <button class="w-full px-3.5 py-1 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => triggerAction('insertText', '')}>
                          <span>Values</span>
                          <span class="text-[10px] text-slate-400 font-mono">Del</span>
                        </button>
                        <button class="w-full px-3.5 py-1 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => triggerAction('deleteRow')}>
                          <span>Delete selected row</span>
                        </button>
                        <button class="w-full px-3.5 py-1 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => triggerAction('deleteCol')}>
                          <span>Delete selected column</span>
                        </button>
                        <button class="w-full px-3.5 py-1 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => triggerAction('deleteCellsUp')}>
                          <span>Cells and shift up</span>
                        </button>
                        <button class="w-full px-3.5 py-1 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => triggerAction('deleteCellsLeft')}>
                          <span>Cells and shift left</span>
                        </button>
                      </div>
                      <div class="py-1">
                        <button class="w-full px-3.5 py-1.5 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => triggerAction('toggleSearch')}>
                          <span class="flex items-center space-x-2"><Search size={13} /><span>Find and replace</span></span>
                          <span class="text-[10px] text-slate-400 font-mono">{modKey}+H</span>
                        </button>
                      </div>
                    {:else}
                      <div class="py-1">
                        <button class="w-full px-3.5 py-1.5 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => { closeMenus(); dispatch('undo'); }}>
                          <span>Undo</span>
                          <span class="text-[10px] text-slate-400 font-mono">{modKey}+Z</span>
                        </button>
                        <button class="w-full px-3.5 py-1.5 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => { closeMenus(); dispatch('redo'); }}>
                          <span>Redo</span>
                          <span class="text-[10px] text-slate-400 font-mono">{modKey}+Y</span>
                        </button>
                      </div>
                      <div class="py-1">
                        <button class="w-full px-3.5 py-1.5 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => triggerAction('copy')}>
                          <span>Copy</span>
                          <span class="text-[10px] text-slate-400 font-mono">{modKey}+C</span>
                        </button>
                        <button class="w-full px-3.5 py-1.5 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => triggerAction('paste')}>
                          <span>Paste</span>
                          <span class="text-[10px] text-slate-400 font-mono">{modKey}+V</span>
                        </button>
                        <button class="w-full px-3.5 py-1.5 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => triggerAction('selectAll')}>
                          <span>Select all</span>
                          <span class="text-[10px] text-slate-400 font-mono">{modKey}+A</span>
                        </button>
                      </div>
                      <div class="py-1">
                        <button class="w-full px-3.5 py-1.5 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => triggerAction('toggleSearch')}>
                          <span class="flex items-center space-x-2"><Search size={13} /><span>Find and replace</span></span>
                          <span class="text-[10px] text-slate-400 font-mono">{modKey}+H</span>
                        </button>
                      </div>
                    {/if}

                  <!-- VIEW MENU -->
                  {:else if menu === 'View'}
                    {#if activeMode === 'sheets'}
                      <div class="py-1">
                        <span class="px-3.5 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Show</span>
                        <button class="w-full px-3.5 py-1 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => triggerAction('toggleFormulaBar')}>
                          <span>Formula bar</span>
                          <Check size={13} class="text-emerald-600" />
                        </button>
                        <button class="w-full px-3.5 py-1 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => triggerAction('toggleGridlines')}>
                          <span>Gridlines</span>
                          <Check size={13} class="text-emerald-600" />
                        </button>
                        <button class="w-full px-3.5 py-1 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => triggerAction('toggleShowFormulas')}>
                          <span>Formulas</span>
                          <span class="text-[10px] text-slate-400 font-mono">{modKey}+~</span>
                        </button>
                      </div>
                      <div class="py-1">
                        <span class="px-3.5 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Freeze Rows</span>
                        <button class="w-full px-3.5 py-1 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => triggerAction('freezeRows', 0)}>
                          <span>No rows</span>
                        </button>
                        <button class="w-full px-3.5 py-1 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => triggerAction('freezeRows', 1)}>
                          <span>1 row</span>
                        </button>
                        <button class="w-full px-3.5 py-1 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => triggerAction('freezeRows', 2)}>
                          <span>2 rows</span>
                        </button>
                      </div>
                      <div class="py-1">
                        <span class="px-3.5 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Freeze Columns</span>
                        <button class="w-full px-3.5 py-1 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => triggerAction('freezeCols', 0)}>
                          <span>No columns</span>
                        </button>
                        <button class="w-full px-3.5 py-1 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => triggerAction('freezeCols', 1)}>
                          <span>1 column</span>
                        </button>
                        <button class="w-full px-3.5 py-1 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => triggerAction('freezeCols', 2)}>
                          <span>2 columns</span>
                        </button>
                      </div>
                      <div class="py-1">
                        <span class="px-3.5 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Zoom</span>
                        <button class="w-full px-3.5 py-1 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => triggerAction('zoom', 75)}>
                          <span>75%</span>
                        </button>
                        <button class="w-full px-3.5 py-1 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => triggerAction('zoom', 100)}>
                          <span>100% (Default)</span>
                        </button>
                        <button class="w-full px-3.5 py-1 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => triggerAction('zoom', 125)}>
                          <span>125%</span>
                        </button>
                        <button class="w-full px-3.5 py-1 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => triggerAction('zoom', 150)}>
                          <span>150%</span>
                        </button>
                      </div>
                    {:else}
                      <div class="py-1">
                        <button class="w-full px-3.5 py-1.5 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => triggerAction('toggleOutline')}>
                          <span>Show document outline</span>
                        </button>
                        <button class="w-full px-3.5 py-1.5 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => triggerAction('toggleComments')}>
                          <span>Show comments</span>
                        </button>
                      </div>
                    {/if}

                  <!-- INSERT MENU -->
                  {:else if menu === 'Insert'}
                    {#if activeMode === 'sheets'}
                      <div class="py-1">
                        <button class="w-full px-3.5 py-1.5 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => triggerAction('insertRowAbove')}>
                          <span>Insert 1 row above</span>
                        </button>
                        <button class="w-full px-3.5 py-1.5 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => triggerAction('insertRowBelow')}>
                          <span>Insert 1 row below</span>
                        </button>
                        <button class="w-full px-3.5 py-1.5 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => triggerAction('insertColLeft')}>
                          <span>Insert 1 column left</span>
                        </button>
                        <button class="w-full px-3.5 py-1.5 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => triggerAction('insertColRight')}>
                          <span>Insert 1 column right</span>
                        </button>
                        <button class="w-full px-3.5 py-1.5 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => triggerAction('insertCellsDown')}>
                          <span>Insert cells and shift down</span>
                        </button>
                      </div>
                      <div class="py-1">
                        <span class="px-3.5 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Pre-built tables</span>
                        <button class="w-full px-3.5 py-1 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => triggerAction('insertPrebuiltTable', 'task_tracker')}>
                          <span>Task tracker</span>
                        </button>
                        <button class="w-full px-3.5 py-1 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => triggerAction('insertPrebuiltTable', 'project_budget')}>
                          <span>Project budget</span>
                        </button>
                        <button class="w-full px-3.5 py-1 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => triggerAction('insertPrebuiltTable', 'employee_roster')}>
                          <span>Employee roster</span>
                        </button>
                        <button class="w-full px-3.5 py-1 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => triggerAction('insertPrebuiltTable', 'expense_report')}>
                          <span>Expense report</span>
                        </button>
                      </div>
                      <div class="py-1">
                        <button class="w-full px-3.5 py-1.5 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => triggerAction('insertChart')}>
                          <span class="flex items-center space-x-2"><BarChart3 size={13} class="text-blue-600" /><span>Chart</span></span>
                        </button>
                        <button class="w-full px-3.5 py-1.5 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => triggerAction('functionList')}>
                          <span class="flex items-center space-x-2"><Sigma size={13} class="text-emerald-600" /><span>Function list...</span></span>
                        </button>
                        <button class="w-full px-3.5 py-1.5 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => triggerAction('insertCheckbox')}>
                          <span class="flex items-center space-x-2"><CheckSquare size={13} class="text-purple-600" /><span>Checkbox</span></span>
                        </button>
                        <button class="w-full px-3.5 py-1.5 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => triggerAction('openDataValidation')}>
                          <span>Dropdown list</span>
                        </button>
                        <button class="w-full px-3.5 py-1.5 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => triggerAction('insertLink')}>
                          <span class="flex items-center space-x-2"><Link size={13} class="text-blue-600" /><span>Link</span></span>
                          <span class="text-[10px] text-slate-400 font-mono">{modKey}+K</span>
                        </button>
                        <button class="w-full px-3.5 py-1.5 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => triggerAction('insertComment')}>
                          <span>Comment</span>
                          <span class="text-[10px] text-slate-400 font-mono">{modKey}+⌥+M</span>
                        </button>
                        <button class="w-full px-3.5 py-1.5 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => triggerAction('insertNote')}>
                          <span>Note</span>
                          <span class="text-[10px] text-slate-400 font-mono">⇧+F2</span>
                        </button>
                      </div>
                    {:else}
                      <div class="py-1">
                        <button class="w-full px-3.5 py-1.5 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => triggerAction('insertImage')}>
                          <span class="flex items-center space-x-2"><Image size={14} class="text-blue-600" /><span>Image</span></span>
                        </button>
                        <button class="w-full px-3.5 py-1.5 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => triggerAction('insertTable')}>
                          <span class="flex items-center space-x-2"><Table size={14} class="text-emerald-600" /><span>Table</span></span>
                        </button>
                        <button class="w-full px-3.5 py-1.5 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => triggerAction('insertLink')}>
                          <span class="flex items-center space-x-2"><Link size={14} class="text-indigo-600" /><span>Link</span></span>
                          <span class="text-[10px] text-slate-400 font-mono">{modKey}+K</span>
                        </button>
                        <button class="w-full px-3.5 py-1.5 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => triggerAction('toggleComments')}>
                          <span class="flex items-center space-x-2"><MessageSquare size={14} class="text-amber-600" /><span>Comment</span></span>
                          <span class="text-[10px] text-slate-400 font-mono">{modKey}+⌥+M</span>
                        </button>
                      </div>
                    {/if}

                  <!-- FORMAT MENU -->
                  {:else if menu === 'Format'}
                    {#if activeMode === 'sheets'}
                      <div class="py-1">
                        <span class="px-3.5 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Number</span>
                        <button class="w-full px-3.5 py-1 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => triggerAction('numberFormat', 'general')}>
                          <span>Automatic</span>
                        </button>
                        <button class="w-full px-3.5 py-1 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => triggerAction('numberFormat', 'text')}>
                          <span>Plain text</span>
                        </button>
                        <button class="w-full px-3.5 py-1 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => triggerAction('numberFormat', 'number')}>
                          <span>Number (1,000.12)</span>
                        </button>
                        <button class="w-full px-3.5 py-1 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => triggerAction('numberFormat', 'percent')}>
                          <span>Percent (10.12%)</span>
                        </button>
                        <button class="w-full px-3.5 py-1 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => triggerAction('numberFormat', 'currency')}>
                          <span>Currency ($1,000.12)</span>
                        </button>
                        <button class="w-full px-3.5 py-1 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => triggerAction('numberFormat', 'accounting')}>
                          <span>Accounting</span>
                        </button>
                        <button class="w-full px-3.5 py-1 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => triggerAction('numberFormat', 'scientific')}>
                          <span>Scientific (1.01E+03)</span>
                        </button>
                        <button class="w-full px-3.5 py-1 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => triggerAction('numberFormat', 'date')}>
                          <span>Date (YYYY-MM-DD)</span>
                        </button>
                        <button class="w-full px-3.5 py-1 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => triggerAction('numberFormat', 'time')}>
                          <span>Time (HH:MM:SS)</span>
                        </button>
                        <button class="w-full px-3.5 py-1 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => triggerAction('numberFormat', 'duration')}>
                          <span>Duration (24:01:00)</span>
                        </button>
                      </div>
                      <div class="py-1">
                        <span class="px-3.5 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Text</span>
                        <button class="w-full px-3.5 py-1 text-left hover:bg-slate-100 flex items-center justify-between font-bold" on:click={() => triggerAction('bold')}>
                          <span>Bold</span>
                          <span class="text-[10px] text-slate-400 font-mono">{modKey}+B</span>
                        </button>
                        <button class="w-full px-3.5 py-1 text-left hover:bg-slate-100 flex items-center justify-between italic" on:click={() => triggerAction('italic')}>
                          <span>Italic</span>
                          <span class="text-[10px] text-slate-400 font-mono">{modKey}+I</span>
                        </button>
                        <button class="w-full px-3.5 py-1 text-left hover:bg-slate-100 flex items-center justify-between underline" on:click={() => triggerAction('underline')}>
                          <span>Underline</span>
                          <span class="text-[10px] text-slate-400 font-mono">{modKey}+U</span>
                        </button>
                        <button class="w-full px-3.5 py-1 text-left hover:bg-slate-100 flex items-center justify-between line-through" on:click={() => triggerAction('strike')}>
                          <span>Strikethrough</span>
                        </button>
                      </div>
                      <div class="py-1">
                        <span class="px-3.5 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Alignment</span>
                        <button class="w-full px-3.5 py-1 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => triggerAction('align', 'left')}>
                          <span>Left</span>
                        </button>
                        <button class="w-full px-3.5 py-1 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => triggerAction('align', 'center')}>
                          <span>Center</span>
                        </button>
                        <button class="w-full px-3.5 py-1 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => triggerAction('align', 'right')}>
                          <span>Right</span>
                        </button>
                        <button class="w-full px-3.5 py-1 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => triggerAction('verticalAlign', 'top')}>
                          <span>Top</span>
                        </button>
                        <button class="w-full px-3.5 py-1 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => triggerAction('verticalAlign', 'middle')}>
                          <span>Middle</span>
                        </button>
                        <button class="w-full px-3.5 py-1 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => triggerAction('verticalAlign', 'bottom')}>
                          <span>Bottom</span>
                        </button>
                      </div>
                      <div class="py-1">
                        <span class="px-3.5 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Merge cells</span>
                        <button class="w-full px-3.5 py-1 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => triggerAction('mergeCells', 'all')}>
                          <span>Merge all</span>
                        </button>
                        <button class="w-full px-3.5 py-1 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => triggerAction('mergeCells', 'unmerge')}>
                          <span>Unmerge</span>
                        </button>
                      </div>
                      <div class="py-1">
                        <button class="w-full px-3.5 py-1.5 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => triggerAction('openBorders')}>
                          <span class="flex items-center space-x-2"><Square size={13} /><span>Borders</span></span>
                        </button>
                        <button class="w-full px-3.5 py-1.5 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => triggerAction('conditionalFormatting')}>
                          <span class="flex items-center space-x-2"><Sparkles size={13} class="text-amber-500" /><span>Conditional formatting</span></span>
                        </button>
                        <button class="w-full px-3.5 py-1.5 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => triggerAction('alternatingColors')}>
                          <span class="flex items-center space-x-2"><Palette size={13} class="text-emerald-600" /><span>Alternating colors</span></span>
                        </button>
                        <button class="w-full px-3.5 py-1.5 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => triggerAction('removeFormat')}>
                          <span>Clear formatting</span>
                          <span class="text-[10px] text-slate-400 font-mono">{modKey}+\</span>
                        </button>
                      </div>
                    {:else}
                      <div class="py-1">
                        <button class="w-full px-3.5 py-1.5 text-left hover:bg-slate-100 flex items-center justify-between font-bold" on:click={() => triggerAction('bold')}>
                          <span>Bold</span>
                          <span class="text-[10px] text-slate-400 font-mono">{modKey}+B</span>
                        </button>
                        <button class="w-full px-3.5 py-1.5 text-left hover:bg-slate-100 flex items-center justify-between italic" on:click={() => triggerAction('italic')}>
                          <span>Italic</span>
                          <span class="text-[10px] text-slate-400 font-mono">{modKey}+I</span>
                        </button>
                        <button class="w-full px-3.5 py-1.5 text-left hover:bg-slate-100 flex items-center justify-between underline" on:click={() => triggerAction('underline')}>
                          <span>Underline</span>
                          <span class="text-[10px] text-slate-400 font-mono">{modKey}+U</span>
                        </button>
                        <button class="w-full px-3.5 py-1.5 text-left hover:bg-slate-100 flex items-center justify-between line-through" on:click={() => triggerAction('strike')}>
                          <span>Strikethrough</span>
                        </button>
                      </div>
                    {/if}

                  <!-- DATA MENU (SHEETS) -->
                  {:else if menu === 'Data'}
                    <div class="py-1">
                      <span class="px-3.5 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Sort sheet</span>
                      <button class="w-full px-3.5 py-1 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => triggerAction('sortSheetAZ')}>
                        <span class="flex items-center space-x-2"><ArrowDownAZ size={13} /><span>Sort sheet by Column A → Z</span></span>
                      </button>
                      <button class="w-full px-3.5 py-1 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => triggerAction('sortSheetZA')}>
                        <span class="flex items-center space-x-2"><ArrowUpZA size={13} /><span>Sort sheet by Column Z → A</span></span>
                      </button>
                    </div>
                    <div class="py-1">
                      <span class="px-3.5 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Sort range</span>
                      <button class="w-full px-3.5 py-1 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => triggerAction('sortAsc')}>
                        <span>Sort range by Column A → Z</span>
                      </button>
                      <button class="w-full px-3.5 py-1 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => triggerAction('sortDesc')}>
                        <span>Sort range by Column Z → A</span>
                      </button>
                    </div>
                    <div class="py-1">
                      <button class="w-full px-3.5 py-1.5 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => triggerAction('toggleFilter')}>
                        <span class="flex items-center space-x-2"><Filter size={13} /><span>Create a filter</span></span>
                      </button>
                      <button class="w-full px-3.5 py-1.5 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => triggerAction('randomizeRange')}>
                        <span>Randomize range</span>
                      </button>
                      <button class="w-full px-3.5 py-1.5 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => triggerAction('columnStats')}>
                        <span class="flex items-center space-x-2"><BarChart2 size={13} /><span>Column stats</span></span>
                      </button>
                      <button class="w-full px-3.5 py-1.5 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => triggerAction('openDataValidation')}>
                        <span>Data validation</span>
                      </button>
                    </div>
                    <div class="py-1">
                      <span class="px-3.5 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Data cleanup</span>
                      <button class="w-full px-3.5 py-1 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => triggerAction('removeDuplicates')}>
                        <span>Remove duplicates</span>
                      </button>
                      <button class="w-full px-3.5 py-1 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => triggerAction('trimWhitespace')}>
                        <span>Trim whitespace</span>
                      </button>
                      <button class="w-full px-3.5 py-1 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => triggerAction('splitTextToColumns')}>
                        <span>Split text to columns</span>
                      </button>
                    </div>

                  <!-- SLIDE MENU (SLIDES) -->
                  {:else if menu === 'Slide'}
                    <div class="py-1">
                      <button class="w-full px-3.5 py-1.5 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => triggerAction('newSlide')}>
                        <span>New slide</span>
                        <span class="text-[10px] text-slate-400 font-mono">{modKey}+M</span>
                      </button>
                      <button class="w-full px-3.5 py-1.5 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => triggerAction('duplicateSlide')}>
                        <span>Duplicate slide</span>
                        <span class="text-[10px] text-slate-400 font-mono">{modKey}+D</span>
                      </button>
                      <button class="w-full px-3.5 py-1.5 text-left hover:bg-slate-100 flex items-center justify-between text-rose-600" on:click={() => triggerAction('deleteSlide')}>
                        <span>Delete slide</span>
                      </button>
                    </div>
                    <div class="py-1">
                      <button class="w-full px-3.5 py-1.5 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => triggerAction('changeTheme')}>
                        <span>Change theme</span>
                      </button>
                      <button class="w-full px-3.5 py-1.5 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => triggerAction('changeTransition')}>
                        <span>Change transition</span>
                      </button>
                    </div>

                  <!-- TOOLS MENU -->
                  {:else if menu === 'Tools'}
                    {#if activeMode === 'sheets'}
                      <div class="py-1">
                        <button class="w-full px-3.5 py-1.5 text-left hover:bg-slate-100 flex items-center justify-between text-emerald-700 font-semibold" on:click={() => triggerAction('createForm')}>
                          <span class="flex items-center space-x-2"><CheckSquare size={13} class="text-purple-600" /><span>Create a new form</span></span>
                        </button>
                        <button class="w-full px-3.5 py-1.5 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => triggerAction('spellCheck')}>
                          <span>Spelling: Spell check</span>
                        </button>
                        <button class="w-full px-3.5 py-1.5 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => triggerAction('spreadsheetSettings')}>
                          <span>Calculation settings</span>
                        </button>
                      </div>
                    {/if}
                    <div class="py-1">
                      <button class="w-full px-3.5 py-1.5 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => { closeMenus(); dispatch('openCommandPalette'); }}>
                        <span class="flex items-center space-x-2"><Search size={13} /><span>Command Palette</span></span>
                        <span class="text-[10px] text-slate-400 font-mono">{modKey}+K</span>
                      </button>
                      <button class="w-full px-3.5 py-1.5 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => { closeMenus(); dispatch('openSettings'); }}>
                        <span class="flex items-center space-x-2"><Settings size={13} /><span>Preferences</span></span>
                        <span class="text-[10px] text-slate-400 font-mono">{modKey}+,</span>
                      </button>
                    </div>

                  <!-- GEMINI MENU (Google Gemini in Docs, Sheets, Slides, Forms, Drive) -->
                  {:else if menu === 'Gemini'}
                    {#if activeMode === 'sheets'}
                      <div class="py-1">
                        <button class="w-full px-3.5 py-1.5 text-left hover:bg-slate-100 flex items-center justify-between text-purple-700 font-semibold" on:click={() => { closeMenus(); dispatch('openGeminiAction', { action: 'organize' }); }}>
                          <span class="flex items-center space-x-2"><Table size={13} class="text-purple-600" /><span>Help me organize (Table / Tracker)</span></span>
                        </button>
                        <button class="w-full px-3.5 py-1.5 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => { closeMenus(); dispatch('openGeminiAction', { action: 'formula' }); }}>
                          <span class="flex items-center space-x-2"><Sigma size={13} class="text-emerald-600" /><span>Generate formula with Gemini</span></span>
                        </button>
                        <button class="w-full px-3.5 py-1.5 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => { closeMenus(); dispatch('openGeminiAction', { action: 'insights' }); }}>
                          <span class="flex items-center space-x-2"><Sparkles size={13} class="text-blue-600" /><span>Data insights & summary</span></span>
                        </button>
                        <button class="w-full px-3.5 py-1.5 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => { closeMenus(); dispatch('openGeminiAction', { action: 'budget' }); }}>
                          <span>Create financial budget model</span>
                        </button>
                      </div>
                    {:else if activeMode === 'slides'}
                      <div class="py-1">
                        <button class="w-full px-3.5 py-1.5 text-left hover:bg-slate-100 flex items-center justify-between text-purple-700 font-semibold" on:click={() => { closeMenus(); dispatch('openGeminiAction', { action: 'new_slide' }); }}>
                          <span class="flex items-center space-x-2"><Presentation size={13} class="text-amber-600" /><span>Create slide from topic</span></span>
                        </button>
                        <button class="w-full px-3.5 py-1.5 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => { closeMenus(); dispatch('openGeminiAction', { action: 'outline' }); }}>
                          <span>Generate presentation outline</span>
                        </button>
                        <button class="w-full px-3.5 py-1.5 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => { closeMenus(); dispatch('openGeminiAction', { action: 'notes' }); }}>
                          <span>Generate speaker notes</span>
                        </button>
                        <button class="w-full px-3.5 py-1.5 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => { closeMenus(); dispatch('openGeminiAction', { action: 'summarize_deck' }); }}>
                          <span>Summarize slide deck</span>
                        </button>
                      </div>
                    {:else if activeMode === 'forms'}
                      <div class="py-1">
                        <button class="w-full px-3.5 py-1.5 text-left hover:bg-slate-100 flex items-center justify-between text-purple-700 font-semibold" on:click={() => { closeMenus(); dispatch('openGeminiAction', { action: 'survey' }); }}>
                          <span class="flex items-center space-x-2"><Sparkles size={13} class="text-purple-600" /><span>Help me create a form / quiz</span></span>
                        </button>
                        <button class="w-full px-3.5 py-1.5 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => { closeMenus(); dispatch('openGeminiAction', { action: 'analyze_resp' }); }}>
                          <span>Analyze survey responses</span>
                        </button>
                      </div>
                    {:else}
                      <!-- Docs (Writer) / Universal -->
                      <div class="py-1">
                        <button class="w-full px-3.5 py-1.5 text-left hover:bg-slate-100 flex items-center justify-between text-purple-700 font-semibold" on:click={() => { closeMenus(); dispatch('openGeminiAction', { action: 'help_write' }); }}>
                          <span class="flex items-center space-x-2"><Sparkles size={13} class="text-purple-600" /><span>Help me write...</span></span>
                        </button>
                        <button class="w-full px-3.5 py-1.5 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => { closeMenus(); dispatch('openGeminiAction', { action: 'summarize_doc' }); }}>
                          <span class="flex items-center space-x-2"><FileText size={13} class="text-blue-600" /><span>Summarize document</span></span>
                        </button>
                        <button class="w-full px-3.5 py-1.5 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => { closeMenus(); dispatch('openGeminiAction', { action: 'proofread' }); }}>
                          <span>Proofread & polish</span>
                        </button>
                        <button class="w-full px-3.5 py-1.5 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => { closeMenus(); dispatch('openGeminiAction', { action: 'brainstorm' }); }}>
                          <span>Brainstorm ideas & outline</span>
                        </button>
                      </div>
                      <div class="py-1">
                        <span class="px-3.5 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Refine Tone</span>
                        <button class="w-full px-3.5 py-1 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => { closeMenus(); dispatch('openGeminiAction', { action: 'tone_formal' }); }}>
                          <span>Formal / Professional</span>
                        </button>
                        <button class="w-full px-3.5 py-1 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => { closeMenus(); dispatch('openGeminiAction', { action: 'tone_concise' }); }}>
                          <span>Concise & Shorten</span>
                        </button>
                      </div>
                    {/if}
                    <div class="py-1">
                      <button class="w-full px-3.5 py-1.5 text-left hover:bg-slate-100 flex items-center justify-between font-semibold text-purple-700" on:click={() => { closeMenus(); dispatch('toggleGeminiSidePanel'); }}>
                        <span class="flex items-center space-x-2"><Sparkles size={13} class="text-purple-600" /><span>Open Gemini Side Panel</span></span>
                      </button>
                      <button class="w-full px-3.5 py-1.5 text-left hover:bg-slate-100 flex items-center justify-between text-slate-600" on:click={() => { closeMenus(); showAccountModal = true; }}>
                        <span>Account: {$activeAccount ? ($activeAccount.accountType === 'personal' ? 'Personal Account' : 'Workspace') : 'Local (Offline)'}</span>
                      </button>
                    </div>

                  <!-- EXTENSIONS MENU -->
                  {:else if menu === 'Extensions'}
                    <div class="py-1">
                      {#if activeMode === 'sheets'}
                        <button class="w-full px-3.5 py-1.5 text-left hover:bg-slate-100 flex items-center justify-between font-medium text-emerald-700" on:click={() => triggerAction('appsScript')}>
                          <span class="flex items-center space-x-2"><Code2 size={13} class="text-emerald-600" /><span>Apps Script</span></span>
                        </button>
                        <button class="w-full px-3.5 py-1.5 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => triggerAction('createForm')}>
                          <span>AppSheet (Build App)</span>
                        </button>
                      {/if}
                      <button class="w-full px-3.5 py-1.5 text-left hover:bg-slate-100 flex items-center justify-between text-purple-600 font-medium" on:click={() => triggerAction('openAiModal')}>
                        <span class="flex items-center space-x-2"><Sparkles size={14} /><span>AI Assistant</span></span>
                      </button>
                    </div>

                  <!-- HELP MENU -->
                  {:else if menu === 'Help'}
                    <div class="py-1">
                      {#if activeMode === 'sheets'}
                        <button class="w-full px-3.5 py-1.5 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => triggerAction('functionList')}>
                          <span class="flex items-center space-x-2"><Sigma size={13} class="text-emerald-600" /><span>Function list (50+ formulas)</span></span>
                        </button>
                      {/if}
                      <button class="w-full px-3.5 py-1.5 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => { closeMenus(); dispatch('openShortcuts'); }}>
                        <span class="flex items-center space-x-2"><Keyboard size={13} /><span>Keyboard shortcuts</span></span>
                        <span class="text-[10px] text-slate-400 font-mono">{modKey}+/</span>
                      </button>
                      <button class="w-full px-3.5 py-1.5 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => { closeMenus(); dispatch('openSettings'); }}>
                        <span>About Simple Office Suite</span>
                      </button>
                    </div>
                  {:else}
                    <div class="py-1">
                      <button class="w-full px-3.5 py-1.5 text-left hover:bg-slate-100 flex items-center justify-between" on:click={() => { closeMenus(); dispatch('openSettings'); }}>
                        <span>Options</span>
                      </button>
                    </div>
                  {/if}
                </div>
              {/if}
            </div>
          {/each}
        </div>
      </div>
    </div>

    <!-- Center: App Switcher Pills (Filtered by user choice) -->
    <div class="hidden md:flex items-center space-x-1 bg-slate-200/60 p-1 rounded-full border border-slate-300/40">
      {#if enabledAppIds.includes('writer')}
        <button
          class="flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all
            {activeMode === 'writer' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'}"
          on:click={() => dispatch('changeMode', 'writer')}
          title="Docs ({modKey}+1)"
        >
          <FileText size={13} class="text-blue-600" />
          <span>Docs</span>
        </button>
      {/if}

      {#if enabledAppIds.includes('sheets')}
        <button
          class="flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all
            {activeMode === 'sheets' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'}"
          on:click={() => dispatch('changeMode', 'sheets')}
          title="Sheets ({modKey}+2)"
        >
          <Sheet size={13} class="text-emerald-600" />
          <span>Sheets</span>
        </button>
      {/if}

      {#if enabledAppIds.includes('slides')}
        <button
          class="flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all
            {activeMode === 'slides' ? 'bg-white text-amber-700 shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'}"
          on:click={() => dispatch('changeMode', 'slides')}
          title="Slides ({modKey}+3)"
        >
          <Presentation size={13} class="text-amber-500" />
          <span>Slides</span>
        </button>
      {/if}

      {#if enabledAppIds.includes('forms')}
        <button
          class="flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all
            {activeMode === 'forms' ? 'bg-white text-purple-700 shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'}"
          on:click={() => dispatch('changeMode', 'forms')}
          title="Forms ({modKey}+5)"
        >
          <CheckSquare size={13} class="text-purple-600" />
          <span>Forms</span>
        </button>
      {/if}

      {#if enabledAppIds.includes('drive')}
        <button
          class="flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all
            {activeMode === 'drive' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'}"
          on:click={() => dispatch('changeMode', 'drive')}
          title="Files ({modKey}+D)"
        >
          <HardDrive size={13} class="text-blue-600" />
          <span>Files</span>
        </button>
      {/if}

      {#if enabledAppIds.includes('pdf')}
        <button
          class="flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all
            {activeMode === 'pdf' ? 'bg-white text-rose-700 shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'}"
          on:click={() => dispatch('changeMode', 'pdf')}
          title="PDF ({modKey}+4)"
        >
          <FileCheck size={13} class="text-rose-600" />
          <span>PDF</span>
        </button>
      {/if}
    </div>

    <!-- Right: Collaboration, Sync, Share Pill, Apps Manager, Account Avatar -->
    <div class="flex items-center space-x-2">
      <!-- Cloud Sync Live Status Pill (Optional Google Drive file syncing) -->
      <button
        class="flex items-center space-x-1.5 px-3 py-1 rounded-full border transition-all text-xs font-medium
          {$activeAccount
            ? ($currentSyncStatus === 'syncing' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100')
            : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200'}"
        on:click|stopPropagation={() => (showSyncModal = true)}
        title={$activeAccount ? `Google Drive Sync: ${$activeAccount.email}` : "Link Google Account for file syncing"}
      >
        {#if $activeAccount}
          {#if $currentSyncStatus === 'syncing'}
            <span class="w-2 h-2 rounded-full bg-blue-500 animate-ping mr-0.5"></span>
            <span class="text-[11px] font-semibold">Syncing</span>
          {:else if $isNetworkOnline}
            <Cloud size={13} class="text-emerald-600" />
            <span class="text-[11px] font-semibold">Drive Synced</span>
          {:else}
            <span class="text-[11px]">Drive Offline</span>
          {/if}
        {:else}
          <Cloud size={13} class="text-slate-400" />
          <span class="text-[11px]">Link Google Drive</span>
        {/if}
      </button>

      <!-- Customize Apps Button -->
      <button
        class="p-1.5 rounded-full hover:bg-slate-200/70 text-slate-600 hover:text-slate-900 transition-colors"
        on:click|stopPropagation={() => (showAppsManagerModal = true)}
        title="Customize Office Modules in Suite"
      >
        <Sliders size={15} />
      </button>

      <!-- Comment History -->
      <button
        class="p-2 rounded-full hover:bg-slate-200/70 text-slate-600 hover:text-slate-900 transition-colors"
        on:click={() => triggerAction('toggleComments')}
        title="Open comment history (⌘⌥M)"
      >
        <MessageSquare size={16} />
      </button>

      <!-- Gemini Sparkle Button -->
      <button
        class="flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-purple-50 via-indigo-50 to-blue-50 hover:from-purple-100 hover:to-blue-100 text-purple-700 border border-purple-200/80 font-semibold text-xs shadow-2xs hover:shadow-xs transition-all"
        on:click|stopPropagation={() => dispatch('toggleGeminiSidePanel')}
        title="Ask Gemini ({$activeAccount ? ($activeAccount.accountType === 'personal' ? 'Personal Account' : 'Workspace Account') : 'Offline Assistant'})"
      >
        <Sparkles size={14} class="text-purple-600" />
        <span class="hidden sm:inline">Gemini</span>
      </button>

      <!-- Share Button -->
      <button
        class="flex items-center space-x-2 px-4 py-1.5 rounded-full bg-[#1a73e8] hover:bg-[#1557b0] text-white font-medium text-xs shadow-xs hover:shadow transition-all"
        on:click|stopPropagation={() => (showShareModal = true)}
        title="Share document or export offline"
      >
        <Lock size={13} />
        <span>Share</span>
      </button>

      <!-- Profile Avatar / Link Google Account -->
      <div class="relative">
        <button
          class="w-8 h-8 rounded-full text-white font-semibold text-xs flex items-center justify-center ring-2 transition-all shadow-xs relative"
          style="background-color: {$activeAccount ? $activeAccount.avatarColor : '#64748b'};"
          class:ring-blue-300={$activeAccount?.accountType === 'personal'}
          class:ring-emerald-300={$activeAccount?.accountType === 'workspace'}
          class:ring-slate-200={!$activeAccount}
          on:click|stopPropagation={() => (showAccountModal = !showAccountModal)}
          title={$activeAccount ? `${$activeAccount.name} (${$activeAccount.email})` : "Account & Cloud Sync"}
        >
          {#if $activeAccount}
            {($activeAccount.name || 'U').charAt(0).toUpperCase()}
            <span
              class="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white"
              class:bg-blue-600={$activeAccount?.accountType === 'personal'}
              class:bg-emerald-600={$activeAccount?.accountType === 'workspace'}
            ></span>
          {:else}
            <User size={15} class="text-white" />
          {/if}
        </button>

        {#if showAccountModal}
          <GoogleAccountModal
            on:close={() => (showAccountModal = false)}
            on:openSettings={() => dispatch('openSettings')}
            on:openShortcuts={() => dispatch('openShortcuts')}
            on:openDrive={() => dispatch('changeMode', 'drive')}
            on:openSyncModal={() => (showSyncModal = true)}
            on:openGeminiSettings={() => dispatch('openSettings')}
          />
        {/if}
      </div>
    </div>
  </div>
</header>

<!-- Google Share Modal Dialog -->
{#if showShareModal}
  <GoogleShareModal
    {meta}
    {activeMode}
    on:close={() => (showShareModal = false)}
    on:exportFormat={(e) => dispatch('exportFormat', e.detail)}
    on:printPdf={() => dispatch('printPdf')}
  />
{/if}

<!-- Google Account & Cloud Sync Modal -->
{#if showSyncModal}
  <GoogleSyncModal on:close={() => (showSyncModal = false)} />
{/if}

<!-- Google Apps Manager Modal -->
{#if showAppsManagerModal}
  <GoogleAppsManagerModal
    {enabledAppIds}
    defaultAppId={activeMode}
    on:close={() => (showAppsManagerModal = false)}
    on:save={handleSaveAppsConfig}
  />
{/if}
