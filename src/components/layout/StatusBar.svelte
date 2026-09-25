<script lang="ts">
  import type { WorkspaceMode, DocumentMeta } from '../../types';
  import { FileCode, Layers, Info } from 'lucide-svelte';

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
    {/if}

    <div class="flex items-center space-x-2 border-l border-slate-200 pl-3 text-slate-400">
      <span>UTF-8</span>
      <span>•</span>
      <span>100% Zoom</span>
    </div>
  </div>
</footer>
