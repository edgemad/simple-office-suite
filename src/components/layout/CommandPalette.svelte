<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import type { WorkspaceMode } from '../../types';
  import {
    Search,
    X,
    FileText,
    Sheet,
    Presentation,
    FileCheck,
    HardDrive,
    Save,
    Download,
    Printer,
    Table,
    BarChart3,
    Sparkles,
    CheckSquare,
    Square,
    Filter,
    Settings,
    Keyboard,
    History,
    Stamp,
    Play,
    Compass,
    Check
  } from 'lucide-svelte';

  export let isOpen: boolean = false;
  export let activeMode: WorkspaceMode = 'writer';

  const dispatch = createEventDispatcher<{
    close: void;
    execute: { actionId: string; payload?: any };
  }>();

  let searchQuery = '';
  let selectedIndex = 0;
  let searchInput: HTMLInputElement;

  interface CommandItem {
    id: string;
    title: string;
    description: string;
    category: 'Workspaces' | 'File' | 'Tools' | 'Formatting' | 'System';
    icon: any;
    shortcut?: string;
    modes?: WorkspaceMode[];
  }

  const commands: CommandItem[] = [
    // Workspaces
    { id: 'mode_drive', title: 'Switch to Google Drive', description: 'Offline files and folders hub', category: 'Workspaces', icon: HardDrive, shortcut: 'Cmd+0' },
    { id: 'mode_writer', title: 'Switch to Word Processor', description: 'Create and edit documents', category: 'Workspaces', icon: FileText, shortcut: 'Cmd+1' },
    { id: 'mode_sheets', title: 'Switch to Spreadsheets', description: 'Analyze data and formulas', category: 'Workspaces', icon: Sheet, shortcut: 'Cmd+2' },
    { id: 'mode_slides', title: 'Switch to Presentations', description: 'Design slide decks', category: 'Workspaces', icon: Presentation, shortcut: 'Cmd+3' },
    { id: 'mode_pdf', title: 'Switch to PDF & Forms', description: 'Annotate and sign documents', category: 'Workspaces', icon: FileCheck, shortcut: 'Cmd+4' },

    // File
    { id: 'save', title: 'Save Document', description: 'Save changes to local disk', category: 'File', icon: Save, shortcut: 'Cmd+S' },
    { id: 'export_pdf', title: 'Export to PDF', description: 'Save as standardized PDF document', category: 'File', icon: Download },
    { id: 'print', title: 'Print Document', description: 'Print or save via system dialog', category: 'File', icon: Printer, shortcut: 'Cmd+P' },
    { id: 'version_history', title: 'Version History', description: 'Browse and restore past revisions', category: 'File', icon: History },
    { id: 'page_setup', title: 'Page Setup', description: 'Configure margins, orientation, paper size', category: 'File', icon: FileText, modes: ['writer'] },
    { id: 'watermark', title: 'Document Watermark', description: 'Set Confidential, Draft or custom watermark', category: 'File', icon: Stamp, modes: ['writer'] },

    // Tools & Inserts
    { id: 'insert_table', title: 'Insert Table', description: 'Add a formatted grid table', category: 'Tools', icon: Table },
    { id: 'insert_chart', title: 'Insert Visualization Chart', description: 'Create Bar, Line, or Pie charts', category: 'Tools', icon: BarChart3, modes: ['sheets', 'slides'] },
    { id: 'conditional_formatting', title: 'Conditional Formatting', description: 'Highlight cells matching rules', category: 'Tools', icon: Sparkles, modes: ['sheets'] },
    { id: 'data_validation', title: 'Data Validation', description: 'Dropdown lists and input criteria', category: 'Tools', icon: CheckSquare, modes: ['sheets'] },
    { id: 'cell_borders', title: 'Cell Borders', description: 'Configure borders and line styles', category: 'Tools', icon: Square, modes: ['sheets'] },
    { id: 'toggle_filter', title: 'Create Filter Views', description: 'Enable sorting and column filters', category: 'Tools', icon: Filter, modes: ['sheets'] },
    { id: 'slide_transitions', title: 'Slide Transitions', description: 'Configure slide change animations', category: 'Tools', icon: Sparkles, modes: ['slides'] },
    { id: 'present', title: 'Start Fullscreen Presentation', description: 'Presenter view with laser & pen', category: 'Tools', icon: Play, shortcut: 'F5', modes: ['slides'] },
    { id: 'word_count', title: 'Word & Character Count', description: 'Inspect detailed document statistics', category: 'Tools', icon: FileText, shortcut: 'Cmd+Shift+C', modes: ['writer'] },
    { id: 'find_replace', title: 'Find & Replace', description: 'Search text and replace occurrences', category: 'Tools', icon: Search, shortcut: 'Cmd+F' },



    // System
    { id: 'settings', title: 'Preferences & Settings', description: 'Configure theme, AI, and defaults', category: 'System', icon: Settings, shortcut: 'Cmd+,' },
    { id: 'shortcuts', title: 'Keyboard Shortcuts', description: 'View cheat sheet of hotkeys', category: 'System', icon: Keyboard, shortcut: '?' },
  ];

  $: filteredCommands = commands.filter((c) => {
    // Mode filter
    if (c.modes && !c.modes.includes(activeMode)) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      c.title.toLowerCase().includes(q) ||
      c.description.toLowerCase().includes(q) ||
      c.category.toLowerCase().includes(q)
    );
  });

  $: if (filteredCommands.length > 0 && selectedIndex >= filteredCommands.length) {
    selectedIndex = filteredCommands.length - 1;
  }

  function handleSelect(cmd: CommandItem) {
    dispatch('execute', { actionId: cmd.id });
    dispatch('close');
  }

  function handleKeydown(e: KeyboardEvent) {
    if (!isOpen) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIndex = (selectedIndex + 1) % Math.max(1, filteredCommands.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIndex = (selectedIndex - 1 + filteredCommands.length) % Math.max(1, filteredCommands.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredCommands[selectedIndex]) {
        handleSelect(filteredCommands[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      dispatch('close');
    }
  }

  $: if (isOpen) {
    searchQuery = '';
    selectedIndex = 0;
    setTimeout(() => {
      searchInput?.focus();
    }, 50);
  }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if isOpen}
  <div class="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-start justify-center pt-24 p-4 animate-in fade-in duration-100">
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="bg-white rounded-2xl shadow-2xl border border-slate-200/90 w-full max-w-xl flex flex-col overflow-hidden text-xs text-slate-700 animate-in zoom-in-95 duration-100"
      on:click|stopPropagation
    >
      <!-- Search Input Header -->
      <div class="px-4 py-3.5 border-b border-slate-200 flex items-center space-x-3 bg-slate-50/50">
        <Search size={18} class="text-slate-400 shrink-0" />
        <input
          bind:this={searchInput}
          type="text"
          bind:value={searchQuery}
          placeholder="Type a command, tool, or search workspaces..."
          class="w-full bg-transparent text-sm text-slate-800 placeholder-slate-400 outline-none font-medium"
        />
        <div class="flex items-center space-x-1 shrink-0">
          <kbd class="px-1.5 py-0.5 text-[10px] font-mono bg-white border border-slate-200 rounded text-slate-500 shadow-2xs">ESC</kbd>
        </div>
      </div>

      <!-- Results List -->
      <div class="max-h-80 overflow-y-auto p-2 space-y-1">
        {#if filteredCommands.length === 0}
          <div class="py-10 text-center text-slate-400 text-xs">
            <Compass size={28} class="mx-auto mb-2 opacity-30 text-slate-400" />
            <p>No matching commands found</p>
          </div>
        {:else}
          {#each filteredCommands as cmd, idx}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
              class="px-3 py-2 rounded-xl flex items-center justify-between cursor-pointer transition-all {selectedIndex === idx
                ? 'bg-blue-600 text-white shadow-xs'
                : 'hover:bg-slate-100 text-slate-700'}"
              on:click={() => handleSelect(cmd)}
              on:mouseenter={() => (selectedIndex = idx)}
            >
              <div class="flex items-center space-x-3">
                <div
                  class="w-7 h-7 rounded-lg flex items-center justify-center {selectedIndex === idx
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-100 text-slate-600'}"
                >
                  <svelte:component this={cmd.icon} size={15} />
                </div>
                <div>
                  <div class="font-semibold text-xs leading-tight {selectedIndex === idx ? 'text-white' : 'text-slate-800'}">
                    {cmd.title}
                  </div>
                  <div class="text-[10px] {selectedIndex === idx ? 'text-blue-100' : 'text-slate-400'}">
                    {cmd.description}
                  </div>
                </div>
              </div>

              <div class="flex items-center space-x-2">
                <span
                  class="px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider font-bold {selectedIndex === idx
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-100 text-slate-500'}"
                >
                  {cmd.category}
                </span>
                {#if cmd.shortcut}
                  <kbd
                    class="px-1.5 py-0.5 text-[10px] font-mono rounded border shadow-2xs {selectedIndex === idx
                      ? 'bg-white/20 border-white/30 text-white'
                      : 'bg-white border-slate-200 text-slate-500'}"
                  >
                    {cmd.shortcut}
                  </kbd>
                {/if}
              </div>
            </div>
          {/each}
        {/if}
      </div>

      <!-- Footer Hints -->
      <div class="px-4 py-2 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-[10px] text-slate-400">
        <div class="flex items-center space-x-3">
          <span><kbd class="font-mono bg-white px-1 py-0.5 border rounded">↑</kbd> <kbd class="font-mono bg-white px-1 py-0.5 border rounded">↓</kbd> Navigate</span>
          <span><kbd class="font-mono bg-white px-1 py-0.5 border rounded">↵</kbd> Execute</span>
        </div>
        <span class="font-medium text-slate-500">Universal Palette</span>
      </div>
    </div>
  </div>
{/if}
