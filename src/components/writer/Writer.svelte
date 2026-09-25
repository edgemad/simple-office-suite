<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import WriterToolbar from './WriterToolbar.svelte';
  import WriterCanvas from './WriterCanvas.svelte';
  import type { DocumentMeta } from '../../types';
  import { Search, X, Replace, ArrowRight } from 'lucide-svelte';

  export let meta: DocumentMeta;
  export let contentHtml: string = `
    <h1>Simple Office Suite (SOS) Project Brief</h1>
    <p>Welcome to <strong>SOS Writer</strong> — your full-featured, lightweight, and offline-first word processor.</p>
    <h2>Comprehensive Capabilities</h2>
    <ul>
      <li>Full font family typography selection (Inter, Arial, Times New Roman, Georgia, Merriweather, JetBrains Mono)</li>
      <li>Rich styling: sizes, bold, italic, underline, strike, colors, highlighter, subscript and superscript</li>
      <li>Tables, embedded local images, hyperlinks, dividers, and real-time word counting</li>
      <li>Universal format compatibility: Open and Export <strong>.docx, .rtf, .md, .txt, .html, and PDF</strong></li>
    </ul>
    <blockquote>"Simplicity is the soul of efficiency." — Austin Freeman</blockquote>
    <p>Start drafting your executive brief, novel, or documentation below...</p>
  `;

  let canvasRef: WriterCanvas;
  let showSearch = false;
  let findQuery = '';
  let replaceQuery = '';

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

  function handleInsertImage() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file && canvasRef) {
        const reader = new FileReader();
        reader.onload = () => {
          canvasRef.insertImage(reader.result as string, file.name);
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  }

  function handleInsertLink() {
    const url = prompt('Enter Hyperlink URL (e.g. https://github.com):');
    if (url && canvasRef) {
      canvasRef.insertLink(url);
    }
  }

  function handleFindNext() {
    if (findQuery && canvasRef) {
      window.find(findQuery, false, false, true);
    }
  }

  function handleReplace(all: boolean = false) {
    if (canvasRef && findQuery) {
      canvasRef.replaceText(findQuery, replaceQuery, all);
    }
  }

  function handleCanvasChange(e: CustomEvent<{ html: string; text: string; words: number; chars: number }>) {
    contentHtml = e.detail.html;
    meta.isDirty = true;
    dispatch('contentChange', e.detail);
    dispatch('updateStats', { words: e.detail.words, chars: e.detail.chars });
  }

  function handleKeydown(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      e.preventDefault();
      showSearch = !showSearch;
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      handleInsertLink();
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="flex-1 flex flex-col h-full overflow-hidden bg-slate-100">
  <WriterToolbar
    on:format={handleFormat}
    on:insertTable={handleInsertTable}
    on:insertImage={handleInsertImage}
    on:insertLink={handleInsertLink}
    on:toggleSearch={() => (showSearch = !showSearch)}
  />

  <!-- Find & Replace Floating / Top Bar -->
  {#if showSearch}
    <div class="no-print bg-white border-b border-slate-200 px-4 py-2 flex items-center justify-between text-xs shadow-md z-10 animate-in fade-in slide-in-from-top duration-150">
      <div class="flex items-center space-x-2">
        <div class="flex items-center space-x-1.5 bg-slate-100 px-2 py-1 rounded border border-slate-300">
          <Search size={13} class="text-slate-400" />
          <input
            type="text"
            placeholder="Find text..."
            bind:value={findQuery}
            class="bg-transparent outline-none text-xs w-36 text-slate-800"
            on:keydown={(e) => e.key === 'Enter' && handleFindNext()}
          />
        </div>

        <button
          class="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded border border-slate-300 text-slate-700 font-medium"
          on:click={handleFindNext}
        >
          Find Next
        </button>

        <div class="flex items-center space-x-1.5 bg-slate-100 px-2 py-1 rounded border border-slate-300 ml-2">
          <Replace size={13} class="text-slate-400" />
          <input
            type="text"
            placeholder="Replace with..."
            bind:value={replaceQuery}
            class="bg-transparent outline-none text-xs w-36 text-slate-800"
          />
        </div>

        <button
          class="px-2 py-1 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200 text-blue-700 font-medium"
          on:click={() => handleReplace(false)}
        >
          Replace
        </button>

        <button
          class="px-2 py-1 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200 text-blue-700 font-medium"
          on:click={() => handleReplace(true)}
        >
          Replace All
        </button>
      </div>

      <button
        class="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700"
        on:click={() => (showSearch = false)}
        title="Close (Esc)"
      >
        <X size={15} />
      </button>
    </div>
  {/if}

  <WriterCanvas
    bind:this={canvasRef}
    bind:contentHtml
    on:change={handleCanvasChange}
  />
</div>
