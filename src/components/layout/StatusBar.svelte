<script lang="ts">
  import { onMount } from 'svelte';
  import type { WorkspaceMode, DocumentMeta } from '../../types';
  import { FileCode, Layers, Wifi, WifiOff, Info } from '@lucide/svelte';
  import { isNetworkOnline, subscribeNetworkStatus } from '../../lib/tauri';

  export let activeMode: WorkspaceMode;
  export let meta: DocumentMeta;
  export let wordCount: number = 0;
  export let charCount: number = 0;
  export let activeCell: string = 'A1';
  export let selectionSum: number | null = null;
  export let slideIndex: number = 0;
  export let totalSlides: number = 1;
  export let pdfPage: number = 1;
  export let pdfTotalPages: number = 1;
  export let emailTotal: number = 5;
  export let emailUnread: number = 1;
  export let emailFolder: string = 'INBOX';
  export let communicatorChannel: string = '#general';
  export let communicatorOnline: number = 4;

  let isOnline: boolean = isNetworkOnline();
  let unsubscribe: (() => void) | null = null;

  onMount(() => {
    isOnline = isNetworkOnline();
    unsubscribe = subscribeNetworkStatus((value) => (isOnline = value));
    return () => {
      if (unsubscribe) unsubscribe();
    };
  });
</script>

<footer class="no-print h-7 bg-white border-t border-slate-200 px-4 flex items-center justify-between text-xs text-slate-500 select-none z-20 shadow-inner">
  <!-- Left: File Path / Status -->
  <div class="flex items-center space-x-4">
    <div class="flex items-center space-x-1.5 text-slate-600 truncate max-w-sm">
      <FileCode size={13} class="text-slate-400 flex-shrink-0" />
      <span class="truncate">{meta.filePath || 'Local Untitled'}</span>
    </div>

    {#if meta.lastSaved}
      <span class="text-slate-400 border-l border-slate-200 pl-3">
        Saved: {new Date(meta.lastSaved).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </span>
    {/if}
  </div>

  <!-- Center/Right: Contextual Stats depending on active workspace -->
  <div class="flex items-center space-x-4 font-mono text-[11px]">
    {#if activeMode === 'writer'}
      <div class="flex items-center space-x-3">
        <span>{wordCount.toLocaleString()} words</span>
        <span class="text-slate-300">•</span>
        <span>{charCount.toLocaleString()} characters</span>
      </div>
    {:else if activeMode === 'sheets'}
      <div class="flex items-center space-x-3">
        <span>Cell: <strong>{activeCell}</strong></span>
        {#if selectionSum !== null}
          <span class="text-slate-300">•</span>
          <span class="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-bold">SUM: {selectionSum}</span>
        {/if}
      </div>
    {:else if activeMode === 'slides'}
      <div class="flex items-center space-x-2">
        <Layers size={13} class="text-orange-500" />
        <span>Slide {slideIndex + 1} of {totalSlides}</span>
      </div>
    {:else if activeMode === 'pdf'}
      <div class="flex items-center space-x-2">
        <span class="text-rose-600 font-semibold font-sans">PDF / Forms</span>
        <span class="text-slate-300">•</span>
        <span>Page {pdfPage} of {pdfTotalPages}</span>
      </div>
    {:else if activeMode === 'email'}
      <div class="flex items-center space-x-2">
        <span class="text-indigo-600 font-semibold font-sans">Mail (demo): {emailFolder || 'INBOX'}</span>
        <span class="text-slate-300">•</span>
        <span class="text-indigo-700 font-medium">{emailUnread} unread</span>
        <span class="text-slate-300">•</span>
        <span>{emailTotal} sample messages</span>
        <span class="text-slate-300">•</span>
        <span class="text-amber-700 font-sans text-[10px] flex items-center space-x-1" title="No mail server is connected. Messages are sample data stored on this device.">
          <Info size={10} />
          <span>No mail server connected</span>
        </span>
      </div>
    {:else if activeMode === 'communicator'}
      <div class="flex items-center space-x-2">
        <span class="text-cyan-600 font-semibold font-sans">Chat (demo): {communicatorChannel}</span>
        <span class="text-slate-300">•</span>
        <span class="text-emerald-600 font-medium">{communicatorOnline} sample members shown</span>
        <span class="text-slate-300">•</span>
        <span class="text-amber-700 font-sans text-[10px] flex items-center space-x-1" title="Simulated chat stored as plain text on this device. No messaging service or call is used.">
          <Info size={10} />
          <span>Simulated, not encrypted</span>
        </span>
      </div>
    {/if}

    <div class="flex items-center space-x-2 border-l border-slate-200 pl-3 text-slate-400">
      <span class="flex items-center space-x-1 {isOnline ? 'text-emerald-600' : 'text-amber-600'}" title={isOnline ? 'Network is available. Cloud AI providers are only contacted when you configure and use them.' : 'No network connection detected. Local editing and the built-in template assistant keep working.'}>
        {#if isOnline}
          <Wifi size={12} />
          <span class="font-sans">Online</span>
        {:else}
          <WifiOff size={12} />
          <span class="font-sans">Offline</span>
        {/if}
      </span>
      <span>•</span>
      <span>UTF-8</span>
      <span>•</span>
      <span>100% Zoom</span>
    </div>
  </div>
</footer>
