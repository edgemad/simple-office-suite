<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { X, Keyboard, FileText, Sheet, Presentation, Globe } from '@lucide/svelte';

  const dispatch = createEventDispatcher<{
    close: void;
  }>();

  let activeTab: 'global' | 'writer' | 'sheets' | 'slides' = 'global';

  const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  const modKey = isMac ? '⌘' : 'Ctrl';
  const altKey = isMac ? '⌥' : 'Alt';

  const globalShortcuts = [
    { key: `${modKey} + S`, desc: 'Save active document locally' },
    { key: `${modKey} + ⇧ + S`, desc: 'Save As (new file name/format)' },
    { key: `${modKey} + O`, desc: 'Open file (.docx, .xlsx, .pptx, .csv, etc.)' },
    { key: `${modKey} + N`, desc: 'Create new document / sheet / slide' },
    { key: `${modKey} + P`, desc: 'Print / Export to PDF' },
    { key: `${modKey} + 1`, desc: 'Switch to the Word document editor' },
    { key: `${modKey} + 2`, desc: 'Switch to the Sheet spreadsheet editor' },
    { key: `${modKey} + 3`, desc: 'Switch to the Slides presentation editor' },
    { key: `${modKey} + /`, desc: 'Open Keyboard Shortcuts cheat sheet' },
  ];

  const writerShortcuts = [
    { key: `${modKey} + B`, desc: 'Bold selected text' },
    { key: `${modKey} + I`, desc: 'Italicize selected text' },
    { key: `${modKey} + U`, desc: 'Underline selected text' },
    { key: `${modKey} + K`, desc: 'Insert hyperlink' },
    { key: `${modKey} + F`, desc: 'Find & Replace in document' },
    { key: `${modKey} + Z`, desc: 'Undo text edit' },
    { key: `${modKey} + Y / ${modKey} + ⇧ + Z`, desc: 'Redo text edit' },
    { key: `${modKey} + ⇧ + C`, desc: 'Display word and character count' },
    { key: `${modKey} + ⇧ + L`, desc: 'Align Left' },
    { key: `${modKey} + ⇧ + E`, desc: 'Align Center' },
    { key: `${modKey} + ⇧ + R`, desc: 'Align Right' },
    { key: `${modKey} + ⇧ + J`, desc: 'Justify' },
    { key: `${modKey} + ⇧ + 7`, desc: 'Numbered list' },
    { key: `${modKey} + ⇧ + 8`, desc: 'Bulleted list' },
    { key: `${modKey} + ${altKey} + 1/2/3`, desc: 'Heading 1, 2, or 3' },
    { key: `${modKey} + ${altKey} + 0`, desc: 'Normal body text' },
  ];

  const sheetsShortcuts = [
    { key: `${modKey} + B`, desc: 'Toggle bold on active cell' },
    { key: `${modKey} + I`, desc: 'Toggle italic on active cell' },
    { key: `${modKey} + U`, desc: 'Toggle underline on active cell' },
    { key: `${modKey} + C`, desc: 'Copy cell value to clipboard' },
    { key: `${modKey} + X`, desc: 'Cut cell value' },
    { key: `${modKey} + V`, desc: 'Paste value into cell' },
    { key: `${modKey} + Z`, desc: 'Undo cell edit' },
    { key: `${modKey} + Y / ${modKey} + ⇧ + Z`, desc: 'Redo cell edit' },
    { key: 'Enter / F2', desc: 'Edit active cell in-place' },
    { key: 'Enter / ⇧ + Enter', desc: 'Commit and move down / up' },
    { key: 'Tab / ⇧ + Tab', desc: 'Commit and move right / left' },
    { key: 'Arrow Keys (↑ ↓ ← →)', desc: 'Navigate grid cells' },
    { key: 'Delete / Backspace', desc: 'Clear cell contents' },
    { key: 'Esc', desc: 'Cancel cell editing' },
    { key: 'Type alphanumeric / =', desc: 'Start entering value/formula directly' },
  ];

  const slidesShortcuts = [
    { key: `${modKey} + M`, desc: 'Create new slide' },
    { key: `${modKey} + D`, desc: 'Duplicate current slide' },
    { key: 'Delete / Backspace', desc: 'Delete selected element or slide' },
    { key: 'F5 / ' + `${modKey} + Enter`, desc: 'Start presentation mode' },
    { key: 'Esc', desc: 'Exit presentation view / Deselect element' },
    { key: 'PageDown / Arrow Down', desc: 'Go to next slide' },
    { key: 'PageUp / Arrow Up', desc: 'Go to previous slide' },
    { key: `${modKey} + Z`, desc: 'Undo slide action' },
    { key: `${modKey} + Y`, desc: 'Redo slide action' },
  ];
</script>

<div class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 select-none animate-in fade-in duration-150">
  <div class="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
    <!-- Header -->
    <div class="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
      <div class="flex items-center space-x-2.5">
        <div class="p-2 rounded-lg bg-blue-100 text-blue-700">
          <Keyboard size={20} />
        </div>
        <div>
          <h2 class="text-base font-bold text-slate-800">Keyboard Shortcuts</h2>
          <p class="text-xs text-slate-500">SOS keyboard shortcuts (keys differ per operating system)</p>
        </div>
      </div>
      <button
        class="p-1.5 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition-colors"
        on:click={() => dispatch('close')}
      >
        <X size={18} />
      </button>
    </div>

    <!-- Navigation Tabs -->
    <div class="px-6 pt-3 border-b border-slate-200 flex space-x-2 bg-slate-50/50">
      <button
        class="flex items-center space-x-1.5 px-3 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition-all {activeTab === 'global' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-slate-500 hover:text-slate-800'}"
        on:click={() => (activeTab = 'global')}
      >
        <Globe size={14} />
        <span>Suite Global</span>
      </button>
      <button
        class="flex items-center space-x-1.5 px-3 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition-all {activeTab === 'writer' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-slate-500 hover:text-slate-800'}"
        on:click={() => (activeTab = 'writer')}
      >
        <FileText size={14} />
        <span>Word (Writer)</span>
      </button>
      <button
        class="flex items-center space-x-1.5 px-3 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition-all {activeTab === 'sheets' ? 'border-emerald-600 text-emerald-600 bg-white' : 'border-transparent text-slate-500 hover:text-slate-800'}"
        on:click={() => (activeTab = 'sheets')}
      >
        <Sheet size={14} />
        <span>Sheets</span>
      </button>
      <button
        class="flex items-center space-x-1.5 px-3 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition-all {activeTab === 'slides' ? 'border-orange-600 text-orange-600 bg-white' : 'border-transparent text-slate-500 hover:text-slate-800'}"
        on:click={() => (activeTab = 'slides')}
      >
        <Presentation size={14} />
        <span>Slides</span>
      </button>
    </div>

    <!-- Shortcuts List Body -->
    <div class="p-6 overflow-y-auto flex-1 space-y-2 text-xs">
      {#if activeTab === 'global'}
        {#each globalShortcuts as item}
          <div class="flex items-center justify-between py-1.5 px-3 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-colors">
            <span class="text-slate-700 font-medium">{item.desc}</span>
            <kbd class="px-2.5 py-1 bg-slate-100 border border-slate-300 rounded font-mono font-semibold text-slate-800 shadow-sm text-[11px]">{item.key}</kbd>
          </div>
        {/each}
      {:else if activeTab === 'writer'}
        {#each writerShortcuts as item}
          <div class="flex items-center justify-between py-1.5 px-3 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-colors">
            <span class="text-slate-700 font-medium">{item.desc}</span>
            <kbd class="px-2.5 py-1 bg-slate-100 border border-slate-300 rounded font-mono font-semibold text-slate-800 shadow-sm text-[11px]">{item.key}</kbd>
          </div>
        {/each}
      {:else if activeTab === 'sheets'}
        {#each sheetsShortcuts as item}
          <div class="flex items-center justify-between py-1.5 px-3 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-colors">
            <span class="text-slate-700 font-medium">{item.desc}</span>
            <kbd class="px-2.5 py-1 bg-slate-100 border border-slate-300 rounded font-mono font-semibold text-slate-800 shadow-sm text-[11px]">{item.key}</kbd>
          </div>
        {/each}
      {:else if activeTab === 'slides'}
        {#each slidesShortcuts as item}
          <div class="flex items-center justify-between py-1.5 px-3 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-colors">
            <span class="text-slate-700 font-medium">{item.desc}</span>
            <kbd class="px-2.5 py-1 bg-slate-100 border border-slate-300 rounded font-mono font-semibold text-slate-800 shadow-sm text-[11px]">{item.key}</kbd>
          </div>
        {/each}
      {/if}
    </div>

    <!-- Footer -->
    <div class="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
      <span>Tip: Press <kbd class="px-1.5 py-0.5 bg-white border border-slate-300 rounded font-mono text-[10px]">{modKey} + /</kbd> anytime to open this guide.</span>
      <button
        class="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm transition-colors"
        on:click={() => dispatch('close')}
      >
        Got it
      </button>
    </div>
  </div>
</div>
