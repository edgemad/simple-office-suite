<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import {
    X,
    Sliders,
    FileText,
    Sheet,
    Presentation,
    FileCheck,
    Sparkles,
    Download,
    Info,
    RotateCcw,
    Check,
    ShieldCheck,
    Laptop,
    Moon,
    Sun,
    ExternalLink,
    HardDrive
  } from 'lucide-svelte';
  import type { AppSettings } from '../../types';
  import { DEFAULT_SETTINGS, saveSettings } from '../../lib/settings';

  export let settings: AppSettings;

  const dispatch = createEventDispatcher<{
    close: void;
    save: AppSettings;
    reset: void;
  }>();

  let activeCategory: 'general' | 'word' | 'sheet' | 'slides' | 'pdf' | 'ai' | 'installers' | 'about' = 'general';
  let tempSettings: AppSettings = JSON.parse(JSON.stringify(settings));
  let savedNotice = false;

  function handleSave() {
    settings = { ...tempSettings };
    saveSettings(settings);
    savedNotice = true;
    setTimeout(() => {
      savedNotice = false;
      dispatch('save', settings);
      dispatch('close');
    }, 400);
  }

  function handleReset() {
    if (confirm('Reset all settings to default values?')) {
      tempSettings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
      settings = { ...tempSettings };
      saveSettings(settings);
      dispatch('reset');
    }
  }

  const fontOptions = [
    'Inter, sans-serif',
    'Arial, sans-serif',
    'Times New Roman, serif',
    'Calibri, sans-serif',
    'Georgia, serif',
    'Courier New, monospace',
    'JetBrains Mono, monospace'
  ];

  const languages = [
    { code: 'en-US', label: 'English (United States)' },
    { code: 'es-ES', label: 'Español (Spanish)' },
    { code: 'fr-FR', label: 'Français (French)' },
    { code: 'de-DE', label: 'Deutsch (German)' },
    { code: 'zh-CN', label: '中文 (Simplified Chinese)' },
    { code: 'ja-JP', label: '日本語 (Japanese)' }
  ];
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 select-none">
  <!-- Settings Window -->
  <div class="bg-[#1e2023] text-slate-200 border border-[#363a40] rounded-xl shadow-2xl w-full max-w-4xl h-[620px] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
    
    <!-- Modal Header -->
    <div class="h-12 px-5 bg-[#18191c] border-b border-[#2d3136] flex items-center justify-between shrink-0">
      <div class="flex items-center space-x-2.5">
        <div class="w-6 h-6 rounded bg-slate-700 flex items-center justify-center text-slate-300">
          <Sliders size={14} />
        </div>
        <h2 class="text-sm font-semibold text-white tracking-wide">Application Settings</h2>
        <span class="text-[11px] text-slate-400 bg-white/5 px-2 py-0.5 rounded-full border border-white/5">Simple Office Suite</span>
      </div>

      <button
        class="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
        on:click={() => dispatch('close')}
        title="Close"
      >
        <X size={16} />
      </button>
    </div>

    <!-- Modal Body: Sidebar & Content -->
    <div class="flex-1 flex overflow-hidden">
      <!-- Left Category Sidebar -->
      <aside class="w-56 bg-[#161719] border-r border-[#2d3136] p-2 space-y-1 overflow-y-auto shrink-0">
        <button
          class="w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors
            {activeCategory === 'general' ? 'bg-blue-600 text-white font-semibold' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}"
          on:click={() => (activeCategory = 'general')}
        >
          <Sliders size={15} />
          <span>General</span>
        </button>

        <button
          class="w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors
            {activeCategory === 'word' ? 'bg-blue-600 text-white font-semibold' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}"
          on:click={() => (activeCategory = 'word')}
        >
          <FileText size={15} class={activeCategory === 'word' ? 'text-white' : 'text-blue-400'} />
          <span>Word & Document</span>
        </button>

        <button
          class="w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors
            {activeCategory === 'sheet' ? 'bg-emerald-600 text-white font-semibold' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}"
          on:click={() => (activeCategory = 'sheet')}
        >
          <Sheet size={15} class={activeCategory === 'sheet' ? 'text-white' : 'text-emerald-400'} />
          <span>Spreadsheets</span>
        </button>

        <button
          class="w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors
            {activeCategory === 'slides' ? 'bg-orange-600 text-white font-semibold' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}"
          on:click={() => (activeCategory = 'slides')}
        >
          <Presentation size={15} class={activeCategory === 'slides' ? 'text-white' : 'text-orange-400'} />
          <span>Presentations</span>
        </button>

        <button
          class="w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors
            {activeCategory === 'pdf' ? 'bg-rose-600 text-white font-semibold' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}"
          on:click={() => (activeCategory = 'pdf')}
        >
          <FileCheck size={15} class={activeCategory === 'pdf' ? 'text-white' : 'text-rose-400'} />
          <span>PDF & Forms</span>
        </button>

        <button
          class="w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors
            {activeCategory === 'ai' ? 'bg-purple-600 text-white font-semibold' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}"
          on:click={() => (activeCategory = 'ai')}
        >
          <Sparkles size={15} class={activeCategory === 'ai' ? 'text-white' : 'text-purple-400'} />
          <span>AI Assistant</span>
        </button>

        <div class="pt-2 pb-1 border-t border-slate-800 my-1">
          <div class="px-3 text-[10px] uppercase font-bold text-slate-500 tracking-wider">Deployment</div>
        </div>

        <button
          class="w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors
            {activeCategory === 'installers' ? 'bg-indigo-600 text-white font-semibold' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}"
          on:click={() => (activeCategory = 'installers')}
        >
          <Download size={15} class={activeCategory === 'installers' ? 'text-white' : 'text-indigo-400'} />
          <span>Cross-Platform Installers</span>
        </button>

        <button
          class="w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors
            {activeCategory === 'about' ? 'bg-slate-700 text-white font-semibold' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}"
          on:click={() => (activeCategory = 'about')}
        >
          <Info size={15} />
          <span>About & Privacy</span>
        </button>
      </aside>

      <!-- Right Content Panel -->
      <main class="flex-1 bg-[#1e2023] p-6 overflow-y-auto space-y-6 text-xs">
        
        <!-- GENERAL TAB -->
        {#if activeCategory === 'general'}
          <div class="space-y-5">
            <div>
              <h3 class="text-sm font-semibold text-white">General Preferences</h3>
              <p class="text-slate-400 text-[11px]">Configure appearance, startup behavior, and automated saving.</p>
            </div>

            <!-- Theme Selection -->
            <div class="bg-[#24272c] p-4 rounded-xl border border-slate-700/60 space-y-3">
              <label class="block font-medium text-slate-200">Application Theme</label>
              <div class="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  class="flex flex-col items-center p-3 rounded-lg border-2 text-center transition-all
                    {tempSettings.theme === 'dark' ? 'border-blue-500 bg-blue-600/10 text-white' : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600'}"
                  on:click={() => (tempSettings.theme = 'dark')}
                >
                  <Moon size={20} class="mb-1.5 text-blue-400" />
                  <span class="font-semibold text-xs">OnlyOffice Dark</span>
                  <span class="text-[10px] text-slate-500">Dark background</span>
                </button>

                <button
                  type="button"
                  class="flex flex-col items-center p-3 rounded-lg border-2 text-center transition-all
                    {tempSettings.theme === 'light' ? 'border-blue-500 bg-blue-600/10 text-white' : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600'}"
                  on:click={() => (tempSettings.theme = 'light')}
                >
                  <Sun size={20} class="mb-1.5 text-amber-400" />
                  <span class="font-semibold text-xs">Clean Light</span>
                  <span class="text-[10px] text-slate-500">Bright background</span>
                </button>

                <button
                  type="button"
                  class="flex flex-col items-center p-3 rounded-lg border-2 text-center transition-all
                    {tempSettings.theme === 'system' ? 'border-blue-500 bg-blue-600/10 text-white' : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600'}"
                  on:click={() => (tempSettings.theme = 'system')}
                >
                  <Laptop size={20} class="mb-1.5 text-emerald-400" />
                  <span class="font-semibold text-xs">System Synchronized</span>
                  <span class="text-[10px] text-slate-500">Follow macOS / OS</span>
                </button>
              </div>
            </div>

            <!-- Startup Mode -->
            <div class="bg-[#24272c] p-4 rounded-xl border border-slate-700/60 flex items-center justify-between">
              <div>
                <span class="font-medium text-slate-200 block">Default Mode on Startup</span>
                <span class="text-[11px] text-slate-400">Select which editor opens when you launch the application.</span>
              </div>
              <select
                bind:value={tempSettings.defaultMode}
                class="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
              >
                <option value="writer">Word / Document Editor</option>
                <option value="sheets">Sheet / Spreadsheet Editor</option>
                <option value="slides">Slides / Presentation Editor</option>
                <option value="pdf">PDF & Forms Editor</option>
              </select>
            </div>

            <!-- Autosave Interval -->
            <div class="bg-[#24272c] p-4 rounded-xl border border-slate-700/60 flex items-center justify-between">
              <div>
                <span class="font-medium text-slate-200 block">Background Auto-Save</span>
                <span class="text-[11px] text-slate-400">Regularly save documents to local cache to prevent loss.</span>
              </div>
              <select
                bind:value={tempSettings.autoSaveIntervalMin}
                class="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
              >
                <option value={1}>Every 1 minute</option>
                <option value={5}>Every 5 minutes (Recommended)</option>
                <option value={10}>Every 10 minutes</option>
                <option value={0}>Disabled</option>
              </select>
            </div>

            <!-- Language -->
            <div class="bg-[#24272c] p-4 rounded-xl border border-slate-700/60 flex items-center justify-between">
              <div>
                <span class="font-medium text-slate-200 block">Interface Language</span>
                <span class="text-[11px] text-slate-400">Choose the language for menus, dialogs, and tooltips.</span>
              </div>
              <select
                bind:value={tempSettings.language}
                class="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
              >
                {#each languages as lang}
                  <option value={lang.code}>{lang.label}</option>
                {/each}
              </select>
            </div>

            <!-- UI Toggles -->
            <div class="bg-[#24272c] p-4 rounded-xl border border-slate-700/60 space-y-3">
              <span class="font-medium text-slate-200 block">View Elements</span>
              <div class="space-y-2">
                <label class="flex items-center space-x-2.5 cursor-pointer">
                  <input type="checkbox" bind:checked={tempSettings.showRuler} class="rounded bg-slate-800 border-slate-700 text-blue-500 focus:ring-0" />
                  <span class="text-slate-300">Show document margin ruler</span>
                </label>
                <label class="flex items-center space-x-2.5 cursor-pointer">
                  <input type="checkbox" bind:checked={tempSettings.showStatusBar} class="rounded bg-slate-800 border-slate-700 text-blue-500 focus:ring-0" />
                  <span class="text-slate-300">Show bottom application status bar</span>
                </label>
              </div>
            </div>
          </div>

        <!-- WORD TAB -->
        {:else if activeCategory === 'word'}
          <div class="space-y-5">
            <div>
              <h3 class="text-sm font-semibold text-white">Word & Document Preferences</h3>
              <p class="text-slate-400 text-[11px]">Set defaults for new documents and text editing behavior.</p>
            </div>

            <div class="bg-[#24272c] p-4 rounded-xl border border-slate-700/60 space-y-4">
              <div class="flex items-center justify-between">
                <div>
                  <span class="font-medium text-slate-200 block">Default Font Family</span>
                  <span class="text-[11px] text-slate-400">Used as the starting font for newly created documents.</span>
                </div>
                <select
                  bind:value={tempSettings.wordDefaultFont}
                  class="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                >
                  {#each fontOptions as f}
                    <option value={f}>{f.split(',')[0]}</option>
                  {/each}
                </select>
              </div>

              <div class="flex items-center justify-between border-t border-slate-800 pt-3">
                <div>
                  <span class="font-medium text-slate-200 block">Default Font Size</span>
                  <span class="text-[11px] text-slate-400">Standard body font size (points).</span>
                </div>
                <select
                  bind:value={tempSettings.wordDefaultFontSize}
                  class="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                >
                  <option value={10}>10 pt</option>
                  <option value={11}>11 pt (Standard)</option>
                  <option value={12}>12 pt</option>
                  <option value={14}>14 pt</option>
                </select>
              </div>

              <div class="flex items-center justify-between border-t border-slate-800 pt-3">
                <div>
                  <span class="font-medium text-slate-200 block">Default Paper Format</span>
                  <span class="text-[11px] text-slate-400">Page dimensions used for canvas rendering and print.</span>
                </div>
                <div class="flex space-x-2">
                  <button
                    type="button"
                    class="px-3 py-1.5 rounded-lg border text-xs font-medium transition-all
                      {tempSettings.wordDefaultPageSize === 'a4' ? 'bg-blue-600 text-white border-blue-500' : 'bg-slate-800 border-slate-700 text-slate-400'}"
                    on:click={() => (tempSettings.wordDefaultPageSize = 'a4')}
                  >
                    A4 (210 × 297 mm)
                  </button>
                  <button
                    type="button"
                    class="px-3 py-1.5 rounded-lg border text-xs font-medium transition-all
                      {tempSettings.wordDefaultPageSize === 'letter' ? 'bg-blue-600 text-white border-blue-500' : 'bg-slate-800 border-slate-700 text-slate-400'}"
                    on:click={() => (tempSettings.wordDefaultPageSize = 'letter')}
                  >
                    US Letter (8.5 × 11 in)
                  </button>
                </div>
              </div>

              <div class="flex items-center justify-between border-t border-slate-800 pt-3">
                <div>
                  <span class="font-medium text-slate-200 block">Spell Checking & Grammar</span>
                  <span class="text-[11px] text-slate-400">Highlight unrecognized words with red squiggly underlines.</span>
                </div>
                <input type="checkbox" bind:checked={tempSettings.wordSpellCheck} class="rounded bg-slate-800 border-slate-700 text-blue-500" />
              </div>
            </div>
          </div>

        <!-- SPREADSHEET TAB -->
        {:else if activeCategory === 'sheet'}
          <div class="space-y-5">
            <div>
              <h3 class="text-sm font-semibold text-white">Spreadsheet Preferences</h3>
              <p class="text-slate-400 text-[11px]">Configure calculation engine, formula behavior, and grid visibility.</p>
            </div>

            <div class="bg-[#24272c] p-4 rounded-xl border border-slate-700/60 space-y-4">
              <div class="flex items-center justify-between">
                <div>
                  <span class="font-medium text-slate-200 block">Gridlines Visibility</span>
                  <span class="text-[11px] text-slate-400">Display subtle border lines around all empty cells.</span>
                </div>
                <input type="checkbox" bind:checked={tempSettings.sheetShowGridlines} class="rounded bg-slate-800 border-slate-700 text-emerald-500" />
              </div>

              <div class="flex items-center justify-between border-t border-slate-800 pt-3">
                <div>
                  <span class="font-medium text-slate-200 block">Formula Bar</span>
                  <span class="text-[11px] text-slate-400">Show the fx formula input bar below the ribbon toolbar.</span>
                </div>
                <input type="checkbox" bind:checked={tempSettings.sheetShowFormulaBar} class="rounded bg-slate-800 border-slate-700 text-emerald-500" />
              </div>

              <div class="flex items-center justify-between border-t border-slate-800 pt-3">
                <div>
                  <span class="font-medium text-slate-200 block">Calculation Mode</span>
                  <span class="text-[11px] text-slate-400">Automatic re-evaluates all dependent formulas whenever a cell changes.</span>
                </div>
                <select
                  bind:value={tempSettings.sheetCalculationMode}
                  class="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="auto">Automatic (Recommended)</option>
                  <option value="manual">Manual (Press F9 or Recalculate)</option>
                </select>
              </div>
            </div>
          </div>

        <!-- SLIDES TAB -->
        {:else if activeCategory === 'slides'}
          <div class="space-y-5">
            <div>
              <h3 class="text-sm font-semibold text-white">Presentation Preferences</h3>
              <p class="text-slate-400 text-[11px]">Aspect ratio and layout options for presentation slide decks.</p>
            </div>

            <div class="bg-[#24272c] p-4 rounded-xl border border-slate-700/60 space-y-4">
              <div class="flex items-center justify-between">
                <div>
                  <span class="font-medium text-slate-200 block">Default Slide Aspect Ratio</span>
                  <span class="text-[11px] text-slate-400">16:9 is ideal for modern screens; 4:3 is legacy standard.</span>
                </div>
                <div class="flex space-x-2">
                  <button
                    type="button"
                    class="px-3 py-1.5 rounded-lg border text-xs font-medium transition-all
                      {tempSettings.slideDefaultRatio === '16:9' ? 'bg-orange-600 text-white border-orange-500' : 'bg-slate-800 border-slate-700 text-slate-400'}"
                    on:click={() => (tempSettings.slideDefaultRatio = '16:9')}
                  >
                    16:9 Widescreen
                  </button>
                  <button
                    type="button"
                    class="px-3 py-1.5 rounded-lg border text-xs font-medium transition-all
                      {tempSettings.slideDefaultRatio === '4:3' ? 'bg-orange-600 text-white border-orange-500' : 'bg-slate-800 border-slate-700 text-slate-400'}"
                    on:click={() => (tempSettings.slideDefaultRatio = '4:3')}
                  >
                    4:3 Standard
                  </button>
                </div>
              </div>

              <div class="flex items-center justify-between border-t border-slate-800 pt-3">
                <div>
                  <span class="font-medium text-slate-200 block">Default Theme</span>
                  <span class="text-[11px] text-slate-400">Initial color palette for new decks.</span>
                </div>
                <select
                  bind:value={tempSettings.slideDefaultTheme}
                  class="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-orange-500"
                >
                  <option value="dark">Midnight Dark</option>
                  <option value="light">Clean Light</option>
                  <option value="navy">Corporate Navy</option>
                </select>
              </div>
            </div>
          </div>

        <!-- PDF TAB -->
        {:else if activeCategory === 'pdf'}
          <div class="space-y-5">
            <div>
              <h3 class="text-sm font-semibold text-white">PDF & Form Preferences</h3>
              <p class="text-slate-400 text-[11px]">Settings for viewing, annotating, and completing fillable PDF documents.</p>
            </div>

            <div class="bg-[#24272c] p-4 rounded-xl border border-slate-700/60 space-y-4">
              <div class="flex items-center justify-between">
                <div>
                  <span class="font-medium text-slate-200 block">Default Zoom Level</span>
                  <span class="text-[11px] text-slate-400">Initial view magnification when opening PDF files.</span>
                </div>
                <select
                  bind:value={tempSettings.pdfDefaultZoom}
                  class="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-rose-500"
                >
                  <option value="100%">100% (Actual Size)</option>
                  <option value="125%">125%</option>
                  <option value="150%">150%</option>
                  <option value="width">Fit to Width</option>
                  <option value="page">Fit to Page</option>
                </select>
              </div>

              <div class="flex items-center justify-between border-t border-slate-800 pt-3">
                <div>
                  <span class="font-medium text-slate-200 block">Highlight Fillable Fields</span>
                  <span class="text-[11px] text-slate-400">Display blue tinted outlines on interactive form inputs.</span>
                </div>
                <input type="checkbox" bind:checked={tempSettings.pdfHighlightFields} class="rounded bg-slate-800 border-slate-700 text-rose-500" />
              </div>
            </div>
          </div>

        <!-- AI ASSISTANT TAB -->
        {:else if activeCategory === 'ai'}
          <div class="space-y-5">
            <div>
              <h3 class="text-sm font-semibold text-white">OnlyOffice AI Assistant Configuration</h3>
              <p class="text-slate-400 text-[11px]">Configure local or cloud AI models for writing, summarizing, and formulas.</p>
            </div>

            <div class="bg-[#24272c] p-4 rounded-xl border border-slate-700/60 space-y-4">
              <div class="flex items-center justify-between">
                <div>
                  <span class="font-medium text-slate-200 block">AI Engine Provider</span>
                  <span class="text-[11px] text-slate-400">Built-in local engine works 100% offline without API keys.</span>
                </div>
                <select
                  bind:value={tempSettings.aiProvider}
                  class="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500"
                >
                  <option value="local">Built-in Offline Engine (Default)</option>
                  <option value="openai">OpenAI (ChatGPT 4o / mini)</option>
                  <option value="anthropic">Anthropic (Claude 3.5)</option>
                  <option value="ollama">Ollama (Local LLM server)</option>
                </select>
              </div>

              {#if tempSettings.aiProvider !== 'local'}
                <div class="space-y-1.5 border-t border-slate-800 pt-3">
                  <label class="block font-medium text-slate-200">
                    {tempSettings.aiProvider === 'ollama' ? 'Ollama Server URL' : 'API Key'}
                  </label>
                  <input
                    type="password"
                    bind:value={tempSettings.aiApiKey}
                    placeholder={tempSettings.aiProvider === 'ollama' ? 'http://localhost:11434' : 'sk-...'}
                    class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500 font-mono"
                  />
                </div>

                <div class="space-y-1.5">
                  <label class="block font-medium text-slate-200">Model Name</label>
                  <input
                    type="text"
                    bind:value={tempSettings.aiModel}
                    placeholder="gpt-4o or claude-3-5-sonnet"
                    class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500 font-mono"
                  />
                </div>
              {/if}

              <div class="space-y-1.5 border-t border-slate-800 pt-3">
                <div class="flex items-center justify-between">
                  <span class="font-medium text-slate-200">Creativity / Temperature</span>
                  <span class="font-mono text-purple-400">{tempSettings.aiTemperature}</span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="1.0"
                  step="0.1"
                  bind:value={tempSettings.aiTemperature}
                  class="w-full accent-purple-500"
                />
                <div class="flex justify-between text-[10px] text-slate-500">
                  <span>Precise / Factual (0.0)</span>
                  <span>Balanced (0.7)</span>
                  <span>Creative (1.0)</span>
                </div>
              </div>
            </div>
          </div>

        <!-- CROSS-PLATFORM INSTALLERS TAB -->
        {:else if activeCategory === 'installers'}
          <div class="space-y-5">
            <div>
              <h3 class="text-sm font-semibold text-white">Cross-Platform Application Installers</h3>
              <p class="text-slate-400 text-[11px]">Installers and standalone binaries prepared for macOS, Windows, and Linux.</p>
            </div>

            <!-- macOS Bundle -->
            <div class="bg-[#24272c] p-4 rounded-xl border border-slate-700/60 space-y-2">
              <div class="flex items-center justify-between">
                <div class="flex items-center space-x-2.5">
                  <div class="w-8 h-8 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center font-bold">
                    macOS
                  </div>
                  <div>
                    <span class="font-semibold text-white text-xs block">macOS Disk Image & Bundle</span>
                    <span class="text-[11px] text-slate-400">Apple Silicon (M1/M2/M3/M4) & Intel Universal</span>
                  </div>
                </div>
                <span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Built & Ready
                </span>
              </div>
              <div class="mt-2 p-2.5 bg-black/30 rounded-lg font-mono text-[11px] text-slate-300 space-y-1">
                <div class="flex items-center justify-between">
                  <span>📦 Simple-Office-Suite-1.0.0-macOS-arm64.dmg</span>
                  <span class="text-slate-500">Apple Disk Image (Drag & Drop)</span>
                </div>
                <div class="flex items-center justify-between">
                  <span>📦 Simple-Office-Suite-1.0.0-macOS-arm64.zip</span>
                  <span class="text-slate-500">Portable Release Archive</span>
                </div>
                <div class="flex items-center justify-between">
                  <span>📁 Simple Office Suite.app</span>
                  <span class="text-slate-500">Native macOS Application Bundle</span>
                </div>
              </div>
            </div>

            <!-- Windows Bundle -->
            <div class="bg-[#24272c] p-4 rounded-xl border border-slate-700/60 space-y-2">
              <div class="flex items-center justify-between">
                <div class="flex items-center space-x-2.5">
                  <div class="w-8 h-8 rounded-lg bg-sky-600/20 text-sky-400 flex items-center justify-center font-bold">
                    Win
                  </div>
                  <div>
                    <span class="font-semibold text-white text-xs block">Windows x64 Setup & Portable Package</span>
                    <span class="text-[11px] text-slate-400">Windows 10, 11 (64-bit Architecture)</span>
                  </div>
                </div>
                <span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Packaged
                </span>
              </div>
              <div class="mt-2 p-2.5 bg-black/30 rounded-lg font-mono text-[11px] text-slate-300 space-y-1">
                <div class="flex items-center justify-between">
                  <span>📦 Simple-Office-Suite-1.0.0-Windows-x64-Portable.zip</span>
                  <span class="text-slate-500">Windows Portable Suite + Shell Launchers</span>
                </div>
                <div class="flex items-center justify-between">
                  <span>⚙️ install-windows.ps1 & install-windows.bat</span>
                  <span class="text-slate-500">One-click Desktop & Start Menu installer</span>
                </div>
                <div class="flex items-center justify-between">
                  <span>📜 Simple-Office-Suite.nsi</span>
                  <span class="text-slate-500">Nullsoft Scriptable Installer source</span>
                </div>
              </div>
            </div>

            <!-- Linux Bundle -->
            <div class="bg-[#24272c] p-4 rounded-xl border border-slate-700/60 space-y-2">
              <div class="flex items-center justify-between">
                <div class="flex items-center space-x-2.5">
                  <div class="w-8 h-8 rounded-lg bg-amber-600/20 text-amber-400 flex items-center justify-center font-bold">
                    Linux
                  </div>
                  <div>
                    <span class="font-semibold text-white text-xs block">Debian/Ubuntu (.deb) & Portable Tarball</span>
                    <span class="text-[11px] text-slate-400">Ubuntu, Debian, Fedora, Arch, Linux Mint</span>
                  </div>
                </div>
                <span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Packaged
                </span>
              </div>
              <div class="mt-2 p-2.5 bg-black/30 rounded-lg font-mono text-[11px] text-slate-300 space-y-1">
                <div class="flex items-center justify-between">
                  <span>📦 simple-office-suite_1.0.0_amd64.deb</span>
                  <span class="text-slate-500">Debian / Ubuntu Package</span>
                </div>
                <div class="flex items-center justify-between">
                  <span>📦 simple-office-suite-1.0.0-linux-x86_64.tar.gz</span>
                  <span class="text-slate-500">Standalone Portable Tarball</span>
                </div>
                <div class="flex items-center justify-between">
                  <span>⚙️ install-linux.sh</span>
                  <span class="text-slate-500">Desktop & App Menu installer script</span>
                </div>
              </div>
            </div>

            <div class="p-3 bg-indigo-950/40 border border-indigo-500/30 rounded-lg text-indigo-300 flex items-center space-x-2">
              <HardDrive size={16} class="shrink-0" />
              <span>All installer files are compiled and saved in the suite's <code>dist-installer/</code> directory on your drive.</span>
            </div>
          </div>

        <!-- ABOUT & PRIVACY TAB -->
        {:else if activeCategory === 'about'}
          <div class="space-y-5">
            <div>
              <h3 class="text-sm font-semibold text-white">About Simple Office Suite</h3>
              <p class="text-slate-400 text-[11px]">System information, offline guarantees, and license.</p>
            </div>

            <div class="bg-[#24272c] p-4 rounded-xl border border-slate-700/60 space-y-4">
              <div class="flex items-center space-x-3">
                <div class="w-12 h-12 rounded-xl bg-gradient-to-tr from-blue-600 via-emerald-600 to-orange-500 flex items-center justify-center text-white font-black text-xl shadow-lg">
                  SOS
                </div>
                <div>
                  <h4 class="text-base font-bold text-white">Simple Office Suite</h4>
                  <div class="flex items-center space-x-2 text-slate-400 text-xs mt-0.5">
                    <span>Version 1.0.0 (Release)</span>
                    <span>•</span>
                    <span class="text-emerald-400 font-medium">Production Build</span>
                  </div>
                </div>
              </div>

              <div class="grid grid-cols-2 gap-3 text-xs border-t border-slate-800 pt-3">
                <div class="bg-black/20 p-2.5 rounded-lg">
                  <span class="text-slate-500 text-[10px] uppercase font-bold block">Engine Core</span>
                  <span class="text-slate-200 font-mono text-[11px]">Tauri 2.0 + Rust + WebKit</span>
                </div>
                <div class="bg-black/20 p-2.5 rounded-lg">
                  <span class="text-slate-500 text-[10px] uppercase font-bold block">Frontend UI</span>
                  <span class="text-slate-200 font-mono text-[11px]">Svelte 4 + Tailwind CSS</span>
                </div>
                <div class="bg-black/20 p-2.5 rounded-lg">
                  <span class="text-slate-500 text-[10px] uppercase font-bold block">Memory Footprint</span>
                  <span class="text-emerald-400 font-mono text-[11px]">~28 MB (90% lighter than Electron)</span>
                </div>
                <div class="bg-black/20 p-2.5 rounded-lg">
                  <span class="text-slate-500 text-[10px] uppercase font-bold block">License</span>
                  <span class="text-slate-200 text-[11px]">Open Source (MIT License)</span>
                </div>
              </div>

              <!-- Offline & Zero Telemetry Badge -->
              <div class="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-lg flex items-center space-x-3">
                <ShieldCheck size={24} class="text-emerald-400 shrink-0" />
                <div>
                  <span class="font-semibold text-emerald-300 text-xs block">100% Offline-First & Zero Telemetry</span>
                  <span class="text-[11px] text-emerald-200/70">
                    Your documents, spreadsheets, and presentations never touch any external server without your explicit command.
                  </span>
                </div>
              </div>
            </div>

            <!-- Danger Zone / Factory Reset -->
            <div class="bg-rose-950/20 p-4 rounded-xl border border-rose-900/40 flex items-center justify-between">
              <div>
                <span class="font-medium text-rose-300 block">Reset Application Preferences</span>
                <span class="text-[11px] text-rose-200/60">Restore all settings to their original factory defaults.</span>
              </div>
              <button
                type="button"
                class="px-3 py-1.5 rounded-lg bg-rose-600/30 hover:bg-rose-600 border border-rose-500/40 text-rose-200 hover:text-white text-xs font-medium transition-colors flex items-center space-x-1.5"
                on:click={handleReset}
              >
                <RotateCcw size={13} />
                <span>Reset Defaults</span>
              </button>
            </div>
          </div>
        {/if}
      </main>
    </div>

    <!-- Modal Footer -->
    <div class="h-14 px-6 bg-[#18191c] border-t border-[#2d3136] flex items-center justify-between shrink-0">
      <div class="flex items-center space-x-2">
        <button
          type="button"
          class="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 text-xs transition-colors flex items-center space-x-1"
          on:click={handleReset}
        >
          <RotateCcw size={12} />
          <span>Reset</span>
        </button>
        {#if savedNotice}
          <span class="text-emerald-400 text-xs flex items-center space-x-1">
            <Check size={14} />
            <span>Settings saved!</span>
          </span>
        {/if}
      </div>

      <div class="flex items-center space-x-2">
        <button
          type="button"
          class="px-4 py-1.5 rounded-lg text-slate-300 hover:bg-white/5 border border-slate-700 text-xs font-medium transition-colors"
          on:click={() => dispatch('close')}
        >
          Cancel
        </button>
        <button
          type="button"
          class="px-5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md transition-all flex items-center space-x-1.5"
          on:click={handleSave}
        >
          <Check size={13} />
          <span>Apply & Save</span>
        </button>
      </div>
    </div>

  </div>
</div>
