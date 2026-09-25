<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import WriterToolbar from './WriterToolbar.svelte';
  import WriterCanvas from './WriterCanvas.svelte';
  import type { DocumentMeta } from '../../types';

  export let meta: DocumentMeta;
  export let contentHtml: string = `
    <h1>Simple Office Suite (SOS) Project Brief</h1>
    <p>Welcome to <strong>SOS Writer</strong> — your lightweight, distraction-free, 100% offline word processor.</p>
    <h2>Key Capabilities</h2>
    <ul>
      <li>Fast, responsive document canvas running at 60 FPS</li>
      <li>Instant auto-save to local disk with zero telemetry</li>
      <li>Export directly to Markdown, plain text, or printable PDF</li>
    </ul>
    <blockquote>"Simplicity is prerequisite for reliability." — Edsger W. Dijkstra</blockquote>
    <p>Start typing your thoughts here...</p>
  `;

  let canvasRef: WriterCanvas;

  const dispatch = createEventDispatcher<{
    updateStats: { words: number; chars: number };
    contentChange: { html: string; text: string; words: number; chars: number };
  }>();

  function handleFormat(e: CustomEvent<{ command: string; value?: string }>) {
    if (canvasRef) {
      canvasRef.execCommand(e.detail.command, e.detail.value);
    }
  }

  function handleInsertTable() {
    if (canvasRef) {
      canvasRef.insertTable();
    }
  }

  function handleCanvasChange(e: CustomEvent<{ html: string; text: string; words: number; chars: number }>) {
    contentHtml = e.detail.html;
    meta.isDirty = true;
    dispatch('contentChange', e.detail);
    dispatch('updateStats', { words: e.detail.words, chars: e.detail.chars });
  }

  function handleKeydown(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
      e.preventDefault();
      handleFormat(new CustomEvent('format', { detail: { command: 'bold' } }));
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
      e.preventDefault();
      handleFormat(new CustomEvent('format', { detail: { command: 'italic' } }));
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'u') {
      e.preventDefault();
      handleFormat(new CustomEvent('format', { detail: { command: 'underline' } }));
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="flex-1 flex flex-col h-full overflow-hidden bg-slate-100">
  <WriterToolbar
    on:format={handleFormat}
    on:insertTable={handleInsertTable}
  />
  <WriterCanvas
    bind:this={canvasRef}
    bind:contentHtml
    on:change={handleCanvasChange}
  />
</div>
