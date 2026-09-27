<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import type { WorkspaceMode, DocumentMeta, AppSettings } from '../../types';
  import {
    ArrowLeft,
    Info,
    PlusCircle,
    FolderOpen,
    Save,
    Download,
    Printer,
    Sliders,
    History,
    Lock,
    Settings,
    FileText,
    Sheet,
    Presentation,
    FileCheck,
    Clock,
    FileSpreadsheet,
    FileCode,
    Sparkles,
    CheckCircle2,
    Calendar,
    File,
    Trash2
  } from 'lucide-svelte';
  import {
    WRITER_TEMPLATES,
    SHEETS_TEMPLATES,
    SLIDES_TEMPLATES,
    type OfficeTemplate
  } from '../../lib/templates';

  export let isOpen: boolean = false;
  export let activeMode: WorkspaceMode = 'writer';
  export let meta: DocumentMeta;
  export let wordCount: number = 0;
  export let charCount: number = 0;
  export let settings: AppSettings;

  const dispatch = createEventDispatcher<{
    close: void;
    newDoc: void;
    openDoc: void;
    saveDoc: void;
    saveAsDoc: void;
    exportFormat: { format: string };
    printPdf: void;
    openSettings: void;
    openVersionHistory: void;
    openPageSetup: void;
    openWatermark: void;
    loadTemplate: { template: OfficeTemplate };
    loadRecent: { path: string; mode: WorkspaceMode };
  }>();

  type BackstageTab = 'info' | 'new' | 'open' | 'save' | 'print' | 'protection' | 'history';
  let activeTab: BackstageTab = 'info';

  const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  const modKey = isMac ? '⌘' : 'Ctrl';

  interface RecentItem {
    id: string;
    title: string;
    path: string;
    mode: WorkspaceMode;
    timestamp: number;
    sizeFormatted?: string;
  }

  let recentFiles: RecentItem[] = [];

  onMount(() => {
    loadRecentHistory();
  });

  function loadRecentHistory() {
    try {
      const saved = localStorage.getItem('simple_office_recent_files');
      if (saved) {
        recentFiles = JSON.parse(saved);
      } else {
        recentFiles = [
          {
            id: 'rec_1',
            title: 'SOS Project Brief.docx',
            path: '~/Documents/SOS Project Brief.docx',
            mode: 'writer',
            timestamp: Date.now() - 3600000,
            sizeFormatted: '48 KB',
          },
          {
            id: 'rec_2',
            title: 'Q3 Financial Model.xlsx',
            path: '~/Documents/Q3 Financial Model.xlsx',
            mode: 'sheets',
            timestamp: Date.now() - 7200000,
            sizeFormatted: '112 KB',
          },
          {
            id: 'rec_3',
            title: 'Product Launch 2026.pptx',
            path: '~/Documents/Product Launch 2026.pptx',
            mode: 'slides',
            timestamp: Date.now() - 86400000,
            sizeFormatted: '3.2 MB',
          },
        ];
      }
    } catch {
      recentFiles = [];
    }
  }

  function handleSelectTemplate(tpl: OfficeTemplate) {
    dispatch('loadTemplate', { template: tpl });
    dispatch('close');
  }

  function handleOpenRecent(item: RecentItem) {
    dispatch('loadRecent', { path: item.path, mode: item.mode });
    dispatch('close');
  }

  function handleExport(format: string) {
    dispatch('exportFormat', { format });
    dispatch('close');
  }
</script>

{#if isOpen}
  <!-- Full Screen Backstage Overlay -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 z-50 bg-[#16181b] text-slate-200 flex flex-col animate-in fade-in duration-150 select-none"
    on:click|stopPropagation
  >
    <!-- Top Backstage Bar -->
    <div class="h-12 bg-[#1f2226] border-b border-slate-700/80 px-4 flex items-center justify-between">
      <div class="flex items-center space-x-3">
        <button
          class="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs shadow-sm transition-colors"
          on:click={() => dispatch('close')}
          title="Return to editing ({modKey}+Esc)"
        >
          <ArrowLeft size={14} />
          <span>Back to Document</span>
        </button>

        <span class="text-sm font-semibold text-slate-100 flex items-center space-x-2">
          <span>File Management Hub</span>
          <span class="text-slate-500 text-xs">•</span>
          <span class="text-xs text-slate-400 font-normal">{meta.title}</span>
        </span>
      </div>

      <div class="flex items-center space-x-2 text-xs text-slate-400 font-mono">
        <span class="px-2 py-0.5 rounded bg-white/5 border border-white/10 uppercase text-[10px] text-blue-400 font-semibold">
          {activeMode}
        </span>
      </div>
    </div>

    <!-- Main Backstage Body -->
    <div class="flex-1 flex overflow-hidden">
      <!-- Left Sidebar Navigation Menu -->
      <aside class="w-56 bg-[#1b1d21] border-r border-slate-800 p-3 space-y-1 overflow-y-auto">
        <button
          class="w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors {activeTab === 'info'
            ? 'bg-blue-600 text-white shadow-xs'
            : 'text-slate-300 hover:bg-white/5 hover:text-white'}"
          on:click={() => (activeTab = 'info')}
        >
          <Info size={15} />
          <span>Info & Properties</span>
        </button>

        <button
          class="w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors {activeTab === 'new'
            ? 'bg-blue-600 text-white shadow-xs'
            : 'text-slate-300 hover:bg-white/5 hover:text-white'}"
          on:click={() => (activeTab = 'new')}
        >
          <PlusCircle size={15} />
          <span>New & Templates</span>
        </button>

        <button
          class="w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors {activeTab === 'open'
            ? 'bg-blue-600 text-white shadow-xs'
            : 'text-slate-300 hover:bg-white/5 hover:text-white'}"
          on:click={() => (activeTab = 'open')}
        >
          <FolderOpen size={15} />
          <span>Open Recent</span>
        </button>

        <div class="border-t border-slate-800 my-2"></div>

        <button
          class="w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors {activeTab === 'save'
            ? 'bg-blue-600 text-white shadow-xs'
            : 'text-slate-300 hover:bg-white/5 hover:text-white'}"
          on:click={() => (activeTab = 'save')}
        >
          <Download size={15} />
          <span>Save & Export</span>
        </button>

        <button
          class="w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors {activeTab === 'print'
            ? 'bg-blue-600 text-white shadow-xs'
            : 'text-slate-300 hover:bg-white/5 hover:text-white'}"
          on:click={() => (activeTab = 'print')}
        >
          <Printer size={15} />
          <span>Print & Setup</span>
        </button>

        <button
          class="w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors {activeTab === 'protection'
            ? 'bg-blue-600 text-white shadow-xs'
            : 'text-slate-300 hover:bg-white/5 hover:text-white'}"
          on:click={() => (activeTab = 'protection')}
        >
          <Lock size={15} />
          <span>Protection</span>
        </button>

        <button
          class="w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors {activeTab === 'history'
            ? 'bg-blue-600 text-white shadow-xs'
            : 'text-slate-300 hover:bg-white/5 hover:text-white'}"
          on:click={() => (activeTab = 'history')}
        >
          <History size={15} />
          <span>Version History</span>
        </button>

        <div class="border-t border-slate-800 my-2"></div>

        <button
          class="w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-300 hover:bg-white/5 hover:text-white transition-colors"
          on:click={() => {
            dispatch('openSettings');
            dispatch('close');
          }}
        >
          <Settings size={15} class="text-amber-400" />
          <span>Preferences ({modKey}+,)</span>
        </button>
      </aside>

      <!-- Right Tab Content Area -->
      <main class="flex-1 bg-[#141518] p-8 overflow-y-auto">
        <!-- 1. INFO TAB -->
        {#if activeTab === 'info'}
          <div class="max-w-3xl space-y-6 animate-in fade-in duration-100">
            <div>
              <h2 class="text-xl font-bold text-slate-100">{meta.title}</h2>
              <p class="text-xs text-slate-400 mt-1">Live document specifications and offline storage state</p>
            </div>

            <!-- Quick Action Cards -->
            <div class="grid grid-cols-3 gap-4">
              <div class="bg-[#1e2126] border border-slate-800 p-4 rounded-xl space-y-2">
                <div class="text-xs text-slate-400">Word Count</div>
                <div class="text-2xl font-bold text-white">{wordCount.toLocaleString()}</div>
                <div class="text-[11px] text-slate-500">{charCount.toLocaleString()} characters</div>
              </div>

              <div class="bg-[#1e2126] border border-slate-800 p-4 rounded-xl space-y-2">
                <div class="text-xs text-slate-400">Offline Auto-Save</div>
                <div class="flex items-center space-x-1.5 text-emerald-400 font-semibold text-sm">
                  <CheckCircle2 size={16} />
                  <span>Always Protected</span>
                </div>
                <div class="text-[11px] text-slate-500">Snapshots saved every {settings.autoSaveIntervalSeconds}s</div>
              </div>

              <div class="bg-[#1e2126] border border-slate-800 p-4 rounded-xl space-y-2">
                <div class="text-xs text-slate-400">File Type</div>
                <div class="text-lg font-bold text-blue-400 uppercase">{activeMode}</div>
                <div class="text-[11px] text-slate-500">100% OpenXML & PDF Compatible</div>
              </div>
            </div>

            <!-- Document Details Table -->
            <div class="bg-[#1e2126] border border-slate-800 rounded-xl divide-y divide-slate-800 text-xs">
              <div class="p-3.5 flex items-center justify-between">
                <span class="text-slate-400">Document Identifier</span>
                <span class="font-mono text-slate-300">{meta.id}</span>
              </div>
              <div class="p-3.5 flex items-center justify-between">
                <span class="text-slate-400">Created Date</span>
                <span class="text-slate-300">{new Date(meta.createdAt).toLocaleString()}</span>
              </div>
              <div class="p-3.5 flex items-center justify-between">
                <span class="text-slate-400">Last Modified</span>
                <span class="text-slate-300">{new Date(meta.updatedAt).toLocaleString()}</span>
              </div>
              <div class="p-3.5 flex items-center justify-between">
                <span class="text-slate-400">Storage Location</span>
                <span class="font-mono text-slate-300">Native Local Disk / Offline Cache</span>
              </div>
            </div>

            <!-- Quick Action Buttons -->
            <div class="flex items-center space-x-3 pt-2">
              <button
                class="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs transition-colors flex items-center space-x-1.5"
                on:click={() => { dispatch('saveDoc'); dispatch('close'); }}
              >
                <Save size={14} />
                <span>Save Now ({modKey}+S)</span>
              </button>
              <button
                class="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs transition-colors flex items-center space-x-1.5"
                on:click={() => { dispatch('printPdf'); dispatch('close'); }}
              >
                <Printer size={14} />
                <span>Print to PDF ({modKey}+P)</span>
              </button>
            </div>
          </div>

        <!-- 2. NEW & TEMPLATES TAB -->
        {:else if activeTab === 'new'}
          <div class="max-w-4xl space-y-6 animate-in fade-in duration-100">
            <div>
              <h2 class="text-xl font-bold text-slate-100">Create New from Template</h2>
              <p class="text-xs text-slate-400 mt-1">Jumpstart your work with professionally formatted office templates</p>
            </div>

            <!-- Writer Templates -->
            <div class="space-y-3">
              <div class="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-blue-400">
                <FileText size={14} />
                <span>Word / Document Templates</span>
              </div>
              <div class="grid grid-cols-2 gap-3">
                {#each WRITER_TEMPLATES as tpl}
                  <button
                    class="p-4 rounded-xl bg-[#1e2126] border border-slate-800 hover:border-blue-500/60 hover:bg-slate-800/80 transition-all text-left group"
                    on:click={() => handleSelectTemplate(tpl)}
                  >
                    <div class="font-semibold text-slate-100 group-hover:text-blue-400 text-xs mb-1">
                      {tpl.title}
                    </div>
                    <div class="text-[11px] text-slate-400 line-clamp-2">
                      {tpl.description}
                    </div>
                  </button>
                {/each}
              </div>
            </div>

            <!-- Sheets Templates -->
            <div class="space-y-3 pt-2">
              <div class="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-emerald-400">
                <Sheet size={14} />
                <span>Spreadsheet Templates</span>
              </div>
              <div class="grid grid-cols-2 gap-3">
                {#each SHEETS_TEMPLATES as tpl}
                  <button
                    class="p-4 rounded-xl bg-[#1e2126] border border-slate-800 hover:border-emerald-500/60 hover:bg-slate-800/80 transition-all text-left group"
                    on:click={() => handleSelectTemplate(tpl)}
                  >
                    <div class="font-semibold text-slate-100 group-hover:text-emerald-400 text-xs mb-1">
                      {tpl.title}
                    </div>
                    <div class="text-[11px] text-slate-400 line-clamp-2">
                      {tpl.description}
                    </div>
                  </button>
                {/each}
              </div>
            </div>

            <!-- Slides Templates -->
            <div class="space-y-3 pt-2">
              <div class="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-orange-400">
                <Presentation size={14} />
                <span>Presentation Pitch Decks</span>
              </div>
              <div class="grid grid-cols-2 gap-3">
                {#each SLIDES_TEMPLATES as tpl}
                  <button
                    class="p-4 rounded-xl bg-[#1e2126] border border-slate-800 hover:border-orange-500/60 hover:bg-slate-800/80 transition-all text-left group"
                    on:click={() => handleSelectTemplate(tpl)}
                  >
                    <div class="font-semibold text-slate-100 group-hover:text-orange-400 text-xs mb-1">
                      {tpl.title}
                    </div>
                    <div class="text-[11px] text-slate-400 line-clamp-2">
                      {tpl.description}
                    </div>
                  </button>
                {/each}
              </div>
            </div>
          </div>

        <!-- 3. OPEN RECENT TAB -->
        {:else if activeTab === 'open'}
          <div class="max-w-3xl space-y-6 animate-in fade-in duration-100">
            <div class="flex items-center justify-between">
              <div>
                <h2 class="text-xl font-bold text-slate-100">Open Documents</h2>
                <p class="text-xs text-slate-400 mt-1">Open files from disk or resume recent workspace sessions</p>
              </div>
              <button
                class="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs flex items-center space-x-1.5 transition-colors"
                on:click={() => { dispatch('openDoc'); dispatch('close'); }}
              >
                <FolderOpen size={14} />
                <span>Browse Local File... ({modKey}+O)</span>
              </button>
            </div>

            <div class="space-y-2">
              <div class="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Recent Files</div>
              <div class="bg-[#1e2126] border border-slate-800 rounded-xl divide-y divide-slate-800 overflow-hidden">
                {#each recentFiles as item}
                  <button
                    class="w-full p-3.5 flex items-center justify-between text-left hover:bg-white/5 transition-colors group"
                    on:click={() => handleOpenRecent(item)}
                  >
                    <div class="flex items-center space-x-3 truncate">
                      <div class="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-slate-300">
                        {#if item.mode === 'writer'}
                          <FileText size={16} class="text-blue-400" />
                        {:else if item.mode === 'sheets'}
                          <Sheet size={16} class="text-emerald-400" />
                        {:else if item.mode === 'slides'}
                          <Presentation size={16} class="text-orange-400" />
                        {:else}
                          <FileCheck size={16} class="text-rose-400" />
                        {/if}
                      </div>
                      <div class="truncate">
                        <div class="font-semibold text-slate-100 group-hover:text-blue-400 text-xs truncate">
                          {item.title}
                        </div>
                        <div class="text-[11px] text-slate-500 font-mono truncate">
                          {item.path}
                        </div>
                      </div>
                    </div>

                    <div class="text-right text-[11px] text-slate-500 shrink-0 ml-4">
                      <div>{new Date(item.timestamp).toLocaleDateString()}</div>
                      <div>{item.sizeFormatted || ''}</div>
                    </div>
                  </button>
                {/each}
              </div>
            </div>
          </div>

        <!-- 4. SAVE & EXPORT TAB -->
        {:else if activeTab === 'save'}
          <div class="max-w-3xl space-y-6 animate-in fade-in duration-100">
            <div>
              <h2 class="text-xl font-bold text-slate-100">Save & Export Formats</h2>
              <p class="text-xs text-slate-400 mt-1">Export your active document to industry standard file types</p>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <button
                class="p-4 rounded-xl bg-[#1e2126] border border-slate-800 hover:border-red-500/60 hover:bg-slate-800/80 transition-all text-left flex items-start space-x-3"
                on:click={() => handleExport('pdf')}
              >
                <div class="p-2 rounded-lg bg-red-950/60 text-red-400"><FileCheck size={20} /></div>
                <div>
                  <div class="font-semibold text-slate-100 text-xs">PDF Document (.pdf)</div>
                  <div class="text-[11px] text-slate-400 mt-0.5">Vector printable document with page setup & watermarks</div>
                </div>
              </button>

              <button
                class="p-4 rounded-xl bg-[#1e2126] border border-slate-800 hover:border-blue-500/60 hover:bg-slate-800/80 transition-all text-left flex items-start space-x-3"
                on:click={() => handleExport('docx')}
              >
                <div class="p-2 rounded-lg bg-blue-950/60 text-blue-400"><FileText size={20} /></div>
                <div>
                  <div class="font-semibold text-slate-100 text-xs">Microsoft Word (.docx)</div>
                  <div class="text-[11px] text-slate-400 mt-0.5">Full OpenXML Word processing format</div>
                </div>
              </button>

              <button
                class="p-4 rounded-xl bg-[#1e2126] border border-slate-800 hover:border-emerald-500/60 hover:bg-slate-800/80 transition-all text-left flex items-start space-x-3"
                on:click={() => handleExport('xlsx')}
              >
                <div class="p-2 rounded-lg bg-emerald-950/60 text-emerald-400"><Sheet size={20} /></div>
                <div>
                  <div class="font-semibold text-slate-100 text-xs">Microsoft Excel (.xlsx)</div>
                  <div class="text-[11px] text-slate-400 mt-0.5">Spreadsheet workbook with formulas and data</div>
                </div>
              </button>

              <button
                class="p-4 rounded-xl bg-[#1e2126] border border-slate-800 hover:border-orange-500/60 hover:bg-slate-800/80 transition-all text-left flex items-start space-x-3"
                on:click={() => handleExport('pptx')}
              >
                <div class="p-2 rounded-lg bg-orange-950/60 text-orange-400"><Presentation size={20} /></div>
                <div>
                  <div class="font-semibold text-slate-100 text-xs">Microsoft PowerPoint (.pptx)</div>
                  <div class="text-[11px] text-slate-400 mt-0.5">Standard presentation deck OpenXML archive</div>
                </div>
              </button>

              <button
                class="p-4 rounded-xl bg-[#1e2126] border border-slate-800 hover:border-purple-500/60 hover:bg-slate-800/80 transition-all text-left flex items-start space-x-3"
                on:click={() => handleExport('markdown')}
              >
                <div class="p-2 rounded-lg bg-purple-950/60 text-purple-400"><FileCode size={20} /></div>
                <div>
                  <div class="font-semibold text-slate-100 text-xs">Markdown Document (.md)</div>
                  <div class="text-[11px] text-slate-400 mt-0.5">Clean plain text with Markdown formatting</div>
                </div>
              </button>

              <button
                class="p-4 rounded-xl bg-[#1e2126] border border-slate-800 hover:border-cyan-500/60 hover:bg-slate-800/80 transition-all text-left flex items-start space-x-3"
                on:click={() => handleExport('csv')}
              >
                <div class="p-2 rounded-lg bg-cyan-950/60 text-cyan-400"><FileSpreadsheet size={20} /></div>
                <div>
                  <div class="font-semibold text-slate-100 text-xs">CSV Data (.csv)</div>
                  <div class="text-[11px] text-slate-400 mt-0.5">Comma-separated tabular data</div>
                </div>
              </button>
            </div>
          </div>

        <!-- 5. PRINT & SETUP TAB -->
        {:else if activeTab === 'print'}
          <div class="max-w-3xl space-y-6 animate-in fade-in duration-100">
            <div>
              <h2 class="text-xl font-bold text-slate-100">Print & Page Setup</h2>
              <p class="text-xs text-slate-400 mt-1">Configure layout, orientation, margins, and security watermarks</p>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <button
                class="p-5 rounded-xl bg-[#1e2126] border border-slate-800 hover:border-blue-500/60 hover:bg-slate-800/80 transition-all text-left"
                on:click={() => { dispatch('openPageSetup'); dispatch('close'); }}
              >
                <Sliders size={20} class="text-blue-400 mb-2" />
                <div class="font-semibold text-slate-100 text-xs">Page Setup</div>
                <div class="text-[11px] text-slate-400 mt-1">Margins (Normal/Narrow/Wide), Orientation (Portrait/Landscape), Paper Size (A4/Letter/Legal)</div>
              </button>

              <button
                class="p-5 rounded-xl bg-[#1e2126] border border-slate-800 hover:border-amber-500/60 hover:bg-slate-800/80 transition-all text-left"
                on:click={() => { dispatch('openWatermark'); dispatch('close'); }}
              >
                <Sparkles size={20} class="text-amber-400 mb-2" />
                <div class="font-semibold text-slate-100 text-xs">Document Watermark</div>
                <div class="text-[11px] text-slate-400 mt-1">Configure Confidential, Draft, or Custom stamped watermark text and angle</div>
              </button>
            </div>
          </div>

        <!-- 6. PROTECTION TAB -->
        {:else if activeTab === 'protection'}
          <div class="max-w-2xl space-y-6 animate-in fade-in duration-100">
            <div>
              <h2 class="text-xl font-bold text-slate-100">Document Protection & Encryption</h2>
              <p class="text-xs text-slate-400 mt-1">Secure confidential business records with native encryption</p>
            </div>

            <div class="p-6 rounded-xl bg-[#1e2126] border border-slate-800 space-y-4">
              <div class="flex items-center space-x-3 text-emerald-400">
                <Lock size={24} />
                <div>
                  <div class="font-bold text-sm text-slate-100">100% Offline Vault Security</div>
                  <div class="text-xs text-slate-400">Documents remain locally stored and encrypted on your Mac</div>
                </div>
              </div>
              <p class="text-xs text-slate-300 leading-relaxed">
                Simple Office Suite executes entirely on your hardware. No document text, spreadsheet numbers, or presentation decks are ever transferred to third-party cloud servers.
              </p>
            </div>
          </div>

        <!-- 7. VERSION HISTORY TAB -->
        {:else if activeTab === 'history'}
          <div class="max-w-2xl space-y-6 animate-in fade-in duration-100">
            <div>
              <h2 class="text-xl font-bold text-slate-100">Version History & Snapshots</h2>
              <p class="text-xs text-slate-400 mt-1">Review prior revisions and restore previous states</p>
            </div>

            <div class="p-6 rounded-xl bg-[#1e2126] border border-slate-800 space-y-4">
              <div class="flex items-center space-x-3 text-blue-400">
                <History size={24} />
                <div>
                  <div class="font-bold text-sm text-slate-100">Automated Revision Snapshots</div>
                  <div class="text-xs text-slate-400">Every editing session is automatically indexed</div>
                </div>
              </div>
              <button
                class="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-colors"
                on:click={() => { dispatch('openVersionHistory'); dispatch('close'); }}
              >
                Open Version History Browser
              </button>
            </div>
          </div>
        {/if}
      </main>
    </div>
  </div>
{/if}
