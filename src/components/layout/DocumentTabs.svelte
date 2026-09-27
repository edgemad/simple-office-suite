<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { WorkspaceMode, DocumentMeta, OpenTab } from '../../types';
  import {
    FileText,
    Sheet,
    Presentation,
    FileCheck,
    CheckSquare,
    Plus,
    X,
    HardDrive
  } from 'lucide-svelte';

  export let tabs: OpenTab[] = [];
  export let activeTabId: string = '';

  const dispatch = createEventDispatcher<{
    selectTab: { id: string; mode: WorkspaceMode };
    closeTab: { id: string };
    newTab: { mode: WorkspaceMode };
  }>();

  let showNewMenu = false;

  function getIcon(mode: WorkspaceMode) {
    if (mode === 'drive') return HardDrive;
    if (mode === 'writer') return FileText;
    if (mode === 'sheets') return Sheet;
    if (mode === 'slides') return Presentation;
    if (mode === 'forms') return CheckSquare;
    return FileCheck;
  }

  function getModeColor(mode: WorkspaceMode, isActive: boolean) {
    if (mode === 'drive') return isActive ? 'text-blue-600' : 'text-blue-500';
    if (mode === 'writer') return isActive ? 'text-blue-600' : 'text-blue-500';
    if (mode === 'sheets') return isActive ? 'text-emerald-600' : 'text-emerald-500';
    if (mode === 'slides') return isActive ? 'text-amber-500' : 'text-amber-500';
    if (mode === 'forms') return isActive ? 'text-purple-600' : 'text-purple-500';
    return isActive ? 'text-rose-600' : 'text-rose-500';
  }
</script>

<svelte:window on:click={() => (showNewMenu = false)} />

<div class="no-print h-9 bg-[#EDF2FA] border-b border-slate-200/90 px-3 flex items-center justify-between select-none text-xs text-slate-600 font-sans">
  <div class="flex items-center space-x-1 overflow-x-auto max-w-4xl py-1">
    {#each tabs as tab (tab.id)}
      {@const isActive = tab.id === activeTabId}
      {@const Icon = getIcon(tab.mode)}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="group flex items-center space-x-2 px-3.5 py-1.5 rounded-t-lg transition-all cursor-pointer text-xs font-medium border-t-2 {isActive
          ? 'bg-white text-slate-900 border-blue-600 shadow-2xs font-semibold'
          : 'bg-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 border-transparent'}"
        on:click={() => dispatch('selectTab', { id: tab.id, mode: tab.mode })}
      >
        <span class={getModeColor(tab.mode, isActive)}>
          <svelte:component this={Icon} size={14} />
        </span>
        <span class="max-w-[140px] truncate">{tab.title || 'Untitled'}</span>
        {#if tab.isDirty}
          <span class="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" title="Unsaved changes"></span>
        {/if}
        {#if tabs.length > 1}
          <button
            class="p-0.5 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition-colors opacity-0 group-hover:opacity-100"
            on:click|stopPropagation={() => dispatch('closeTab', { id: tab.id })}
            title="Close Tab"
          >
            <X size={12} />
          </button>
        {/if}
      </div>
    {/each}

    <!-- Add New Tab Button & Menu -->
    <div class="relative ml-1">
      <button
        class="p-1 rounded-full hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors flex items-center justify-center"
        on:click|stopPropagation={() => (showNewMenu = !showNewMenu)}
        title="Create new Google Workspace document"
      >
        <Plus size={15} />
      </button>

      {#if showNewMenu}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="absolute left-0 mt-1 w-52 bg-white rounded-2xl shadow-xl border border-slate-200 py-1.5 z-50 text-xs text-slate-700 divide-y divide-slate-100 animate-in fade-in zoom-in-95 duration-100"
          on:click|stopPropagation
        >
          <div class="py-1">
            <button
              class="w-full px-3.5 py-1.5 text-left hover:bg-blue-50 flex items-center space-x-2.5 transition-colors text-slate-800 font-medium"
              on:click={() => {
                dispatch('newTab', { mode: 'writer' });
                showNewMenu = false;
              }}
            >
              <FileText size={15} class="text-blue-600" />
              <span>Google Doc</span>
            </button>
            <button
              class="w-full px-3.5 py-1.5 text-left hover:bg-emerald-50 flex items-center space-x-2.5 transition-colors text-slate-800 font-medium"
              on:click={() => {
                dispatch('newTab', { mode: 'sheets' });
                showNewMenu = false;
              }}
            >
              <Sheet size={15} class="text-emerald-600" />
              <span>Google Sheet</span>
            </button>
            <button
              class="w-full px-3.5 py-1.5 text-left hover:bg-amber-50 flex items-center space-x-2.5 transition-colors text-slate-800 font-medium"
              on:click={() => {
                dispatch('newTab', { mode: 'slides' });
                showNewMenu = false;
              }}
            >
              <Presentation size={15} class="text-amber-500" />
              <span>Google Slides</span>
            </button>
            <button
              class="w-full px-3.5 py-1.5 text-left hover:bg-purple-50 flex items-center space-x-2.5 transition-colors text-slate-800 font-medium"
              on:click={() => {
                dispatch('newTab', { mode: 'forms' });
                showNewMenu = false;
              }}
            >
              <CheckSquare size={15} class="text-purple-600" />
              <span>Google Form</span>
            </button>
          </div>
          <div class="py-1">
            <button
              class="w-full px-3.5 py-1.5 text-left hover:bg-blue-50 flex items-center space-x-2.5 transition-colors text-slate-800 font-medium"
              on:click={() => {
                dispatch('newTab', { mode: 'drive' });
                showNewMenu = false;
              }}
            >
              <HardDrive size={15} class="text-blue-600" />
              <span>Google Drive Hub</span>
            </button>
            <button
              class="w-full px-3.5 py-1.5 text-left hover:bg-rose-50 flex items-center space-x-2.5 transition-colors text-slate-800 font-medium"
              on:click={() => {
                dispatch('newTab', { mode: 'pdf' });
                showNewMenu = false;
              }}
            >
              <FileCheck size={15} class="text-rose-600" />
              <span>PDF Viewer</span>
            </button>
          </div>
        </div>
      {/if}
    </div>
  </div>

  <div class="flex items-center space-x-2 text-[11px] text-slate-500">
    <span>Google Workspace (Offline Edition)</span>
  </div>
</div>
