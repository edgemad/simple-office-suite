<script lang="ts">
  import { clampColumnCount, stepFontSizeLevel, fontSizeLevelFor } from '$lib/spreadsheetOps';
  import { createEventDispatcher, tick } from 'svelte';
  import WriterToolbar from './WriterToolbar.svelte';
  import WriterCanvas from './WriterCanvas.svelte';
  import DocumentOutline from './DocumentOutline.svelte';
  import TableInsertModal from './TableInsertModal.svelte';
  import PageSetupModal from './PageSetupModal.svelte';
  import type { DocumentMeta, DocumentPageSetup } from '../../types';
  import { Search, X, Replace, FileText } from '@lucide/svelte';

  export let meta: DocumentMeta;
  export let contentHtml: string = `
    <h1>Simple Office Suite (SOS) Project Brief</h1>
    <p>Welcome to <strong>SOS Writer</strong> — your full-featured, lightweight, and offline-first word processor inspired by Google Docs and OnlyOffice.</p>
    <h2>Comprehensive Capabilities</h2>
    <ul>
      <li>Full font family typography selection (Inter, Arial, Times New Roman, Georgia, Merriweather, JetBrains Mono)</li>
      <li>Rich styling: sizes, bold, italic, underline, strike, colors, highlighter, subscript and superscript</li>
      <li>Tables, embedded local images, hyperlinks, dividers, and real-time word counting</li>
      <li>Universal format compatibility: Open and Export <strong>.docx, .rtf, .md, .txt, .html, and PDF</strong></li>
    </ul>
    <h2>Document Architecture</h2>
    <p>Use the left outline sidebar to navigate across sections, insert checklists, configure pageless or paginated views, and format layouts seamlessly.</p>
    <blockquote>\"Simplicity is the soul of efficiency.\" — Austin Freeman</blockquote>
    <p>Start drafting your executive brief, novel, or documentation below...</p>
  `;

  let canvasRef: WriterCanvas;
  let showOutline = true;
  let showTableModal = false;
  let showPageSetupModal = false;
  let showSearch = false;
  let showWordCountModal = false;

  let findQuery = '';
  let replaceQuery = '';
  let currentWords = 0;
  let currentChars = 0;

  export let pageSetup: DocumentPageSetup = {
    margin: 'normal',
    orientation: 'portrait',
    size: 'a4',
  };
  let isPageless = false;
  export let columnCount = 1;

  // --- Ribbon-driven document features ---
  let trackChanges = false;
  let isProtected = false;
  let isReadOnly = false;
  export let showWatermark = '';
  let footnotes: { id: number; text: string }[] = [];
  let footnoteCounter = 0;
  let citationCounter = 0;
  let comments: { id: number; quote: string; text: string; author: string }[] = [];
  let commentCounter = 0;
  let findInput: HTMLInputElement;
  let replaceInput: HTMLInputElement;

  const dispatch = createEventDispatcher<{
    updateStats: { words: number; chars: number };
    contentChange: { html: string; text: string; words: number; chars: number };
    watermarkChange: { watermark: string };
    pageSetupChange: { pageSetup: DocumentPageSetup };
    columnCountChange: { columnCount: number };
  }>();

  export function triggerUndo() {
    if (canvasRef) canvasRef.execCommand('undo');
  }

  export function triggerRedo() {
    if (canvasRef) canvasRef.execCommand('redo');
  }

  export function execFormat(command: string, value?: string) {
    if (canvasRef) canvasRef.execCommand(command, value);
  }

  export function insertTable() {
    showTableModal = true;
  }

  export function insertImage() {
    handleInsertImage();
  }

  export function insertLink() {
    handleInsertLink();
  }

  export function insertChecklist() {
    if (canvasRef) canvasRef.insertChecklist();
  }

  export function insertCallout(type: 'info' | 'tip' | 'warning' = 'info') {
    if (canvasRef) canvasRef.insertCallout(type);
  }

  export function insertTableOfContents() {
    if (canvasRef) canvasRef.insertTableOfContents();
  }

  export function toggleOutline() {
    showOutline = !showOutline;
  }

  export function openPageSetup() {
    showPageSetupModal = true;
  }

  export function openWordCount() {
    showWordCountModal = true;
  }

  export function setColumns(count: number) {
    columnCount = clampColumnCount(count);
    dispatch('columnCountChange', { columnCount });
  }

  export function setPageSetup(patch: Partial<DocumentPageSetup>) {
    pageSetup = { ...pageSetup, ...patch };
    dispatch('pageSetupChange', { pageSetup });
  }

  export function stepFontSize(direction: 1 | -1) {
    if (!canvasRef) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const node = sel.getRangeAt(0).startContainer;
    const el = node instanceof HTMLElement ? node : node.parentElement;
    if (!el) return;
    const pixels = Number.parseFloat(window.getComputedStyle(el).fontSize) || 11;
    const next = stepFontSizeLevel(fontSizeLevelFor(pixels), direction);
    canvasRef.execCommand('fontSize', String(next));
  }

  export function setLineSpacing(value: string) {
    if (!canvasRef) return;
    canvasRef.setBlockStyle('line-height', value);
  }

  export function insertDivider() {
    canvasRef?.insertHorizontalRule();
  }

  export function insertDate() {
    canvasRef?.insertDate();
  }

  export function insertCodeBlock() {
    canvasRef?.insertCodeBlock();
  }

  export function insertHighlight() {
    canvasRef?.insertHighlight();
  }

  export function suggestDelete() {
    canvasRef?.suggestDelete();
  }

  export function openFind(focusReplace: boolean = false) {
    showSearch = true;
    if (focusReplace) {
      tick().then(() => replaceInput?.focus());
    } else {
      tick().then(() => findInput?.focus());
    }
  }

  export function insertPageBreak() {
    canvasRef?.insertPageBreak();
  }

  export function insertFootnote() {
    if (!canvasRef) return;
    footnoteCounter += 1;
    const id = footnoteCounter;
    footnotes = [...footnotes, { id, text: '' }];
    canvasRef.insertFootnoteRef(id);
  }

  export function insertCitation() {
    if (!canvasRef) return;
    citationCounter += 1;
    const year = new Date().getFullYear();
    canvasRef.insertInlineNode(
      `<span class="citation" title="Local reference ${citationCounter}"> [Ref ${citationCounter}, ${year}]</span>`
    );
  }

  export function addComment() {
    const sel = window.getSelection();
    const quote = sel ? sel.toString().trim() : '';
    if (!quote) {
      alert('Select some text first, then add a comment.');
      return;
    }
    const text = prompt(`Comment on "${quote.slice(0, 40)}":`);
    if (!text) return;
    commentCounter += 1;
    comments = [...comments, { id: commentCounter, quote, text, author: 'You' }];
    canvasRef?.markComment(quote, commentCounter);
  }

  export function toggleTrackChanges() {
    trackChanges = !trackChanges;
    canvasRef?.setTrackChanges(trackChanges);
  }

  export function toggleWatermark() {
    showWatermark = showWatermark ? '' : 'DRAFT';
    dispatch('watermarkChange', { watermark: showWatermark });
  }

  export function setWatermark(text: string) {
    showWatermark = text;
    dispatch('watermarkChange', { watermark: showWatermark });
  }

  export function setProtected(value: boolean) {
    isProtected = value;
    canvasRef?.setEditable(!value && !isReadOnly);
  }

  export function setReadOnly(value: boolean) {
    isReadOnly = value;
    canvasRef?.setEditable(!value && !isProtected);
  }



  function handleFormat(e: CustomEvent<{ command: string; value?: string }> | { detail: { command: string; value?: string } }) {
    if (canvasRef) {
      canvasRef.execCommand(e.detail.command, e.detail.value);
    }
  }

  function handleTableInsert(e: CustomEvent<{ rows: number; cols: number; hasHeader: boolean }>) {
    if (canvasRef) {
      canvasRef.insertCustomTable(e.detail.rows, e.detail.cols, e.detail.hasHeader);
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
    const url = prompt('Enter Hyperlink URL (e.g. https://google.com):');
    if (url && canvasRef) {
      canvasRef.insertLink(url);
    }
  }

  function handleFindNext() {
    if (findQuery && canvasRef) {
      (window as unknown as Window & { find: (text: string, caseSensitive?: boolean, backward?: boolean, wrapAround?: boolean) => boolean }).find(findQuery, false, false, true);
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
    currentWords = e.detail.words;
    currentChars = e.detail.chars;
    dispatch('contentChange', e.detail);
    dispatch('updateStats', { words: e.detail.words, chars: e.detail.chars });
  }

  function handleKeydown(e: KeyboardEvent) {
    const mod = e.ctrlKey || e.metaKey;

    if (mod && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'f') {
      e.preventDefault();
      showSearch = !showSearch;
    } else if (mod && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      handleInsertLink();
    } else if (mod && e.shiftKey && e.key.toLowerCase() === 'c') {
      e.preventDefault();
      showWordCountModal = true;
    } else if (mod && e.shiftKey && e.key.toLowerCase() === 'l') {
      e.preventDefault();
      handleFormat({ detail: { command: 'justifyLeft' } });
    } else if (mod && e.shiftKey && e.key.toLowerCase() === 'e') {
      e.preventDefault();
      handleFormat({ detail: { command: 'justifyCenter' } });
    } else if (mod && e.shiftKey && e.key.toLowerCase() === 'r') {
      e.preventDefault();
      handleFormat({ detail: { command: 'justifyRight' } });
    } else if (mod && e.shiftKey && e.key.toLowerCase() === 'j') {
      e.preventDefault();
      handleFormat({ detail: { command: 'justifyFull' } });
    } else if (mod && e.shiftKey && (e.key === '7' || e.key === '&')) {
      e.preventDefault();
      handleFormat({ detail: { command: 'insertOrderedList' } });
    } else if (mod && e.shiftKey && (e.key === '8' || e.key === '*')) {
      e.preventDefault();
      handleFormat({ detail: { command: 'insertUnorderedList' } });
    } else if (mod && e.shiftKey && (e.key === '9' || e.key === '(')) {
      e.preventDefault();
      insertChecklist();
    } else if (mod && e.altKey) {
      if (e.key === '1') {
        e.preventDefault();
        handleFormat({ detail: { command: 'formatBlock', value: 'h1' } });
      } else if (e.key === '2') {
        e.preventDefault();
        handleFormat({ detail: { command: 'formatBlock', value: 'h2' } });
      } else if (e.key === '3') {
        e.preventDefault();
        handleFormat({ detail: { command: 'formatBlock', value: 'h3' } });
      } else if (e.key === '0') {
        e.preventDefault();
        handleFormat({ detail: { command: 'formatBlock', value: 'p' } });
      }
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="flex-1 flex flex-col h-full overflow-hidden bg-slate-100">
  <WriterToolbar
    {showOutline}
    on:format={handleFormat}
    on:insertTable={() => (showTableModal = true)}
    on:insertImage={handleInsertImage}
    on:insertLink={handleInsertLink}
    on:insertChecklist={insertChecklist}
    on:insertDate={() => canvasRef?.insertDate()}
    on:insertCallout={() => insertCallout('info')}
    on:toggleOutline={toggleOutline}
    on:openPageSetup={openPageSetup}
    on:openWordCount={openWordCount}
    on:toggleSearch={() => (showSearch = !showSearch)}
  />

  <!-- Find & Replace Floating / Top Bar -->
  {#if showSearch}
    <div class="no-print bg-white border-b border-slate-200 px-4 py-2 flex items-center justify-between text-xs shadow-md z-20 animate-in fade-in slide-in-from-top duration-150">
      <div class="flex items-center space-x-2">
        <div class="flex items-center space-x-1.5 bg-slate-100 px-2.5 py-1 rounded border border-slate-300">
          <Search size={13} class="text-slate-400" />
          <input
            type="text"
            placeholder="Find text..."
            bind:this={findInput}
            bind:value={findQuery}
            class="bg-transparent outline-none text-xs w-36 text-slate-800"
            on:keydown={(e) => e.key === 'Enter' && handleFindNext()}
          />
        </div>

        <button
          class="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded border border-slate-300 text-slate-700 font-medium transition-colors"
          on:click={handleFindNext}
        >
          Find Next
        </button>

        <div class="flex items-center space-x-1.5 bg-slate-100 px-2.5 py-1 rounded border border-slate-300 ml-2">
          <Replace size={13} class="text-slate-400" />
          <input
            type="text"
            placeholder="Replace with..."
            bind:this={replaceInput}
            bind:value={replaceQuery}
            class="bg-transparent outline-none text-xs w-36 text-slate-800"
          />
        </div>

        <button
          class="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200 text-blue-700 font-medium transition-colors"
          on:click={() => handleReplace(false)}
        >
          Replace
        </button>

        <button
          class="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200 text-blue-700 font-medium transition-colors"
          on:click={() => handleReplace(true)}
        >
          Replace All
        </button>
      </div>

      <button
        class="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
        on:click={() => (showSearch = false)}
        title="Close (Esc)"
      >
        <X size={15} />
      </button>
    </div>
  {/if}

  <!-- Main Body: Document Outline Sidebar + Canvas -->
  <div class="flex-1 flex overflow-hidden relative">
    <DocumentOutline
      isOpen={showOutline}
      {contentHtml}
      on:close={() => (showOutline = false)}
      on:jumpToHeading={(e) => canvasRef?.scrollToHeading(e.detail.text)}
      on:insertToc={insertTableOfContents}
    />

    <WriterCanvas
      bind:this={canvasRef}
      bind:contentHtml
      {pageSetup}
      {isPageless}
      watermark={showWatermark}
      {columnCount}
      on:change={handleCanvasChange}
    />
  </div>

  <!-- Table Insert Grid Modal -->
  <TableInsertModal
    isOpen={showTableModal}
    on:close={() => (showTableModal = false)}
    on:insert={handleTableInsert}
  />

  <!-- Page Setup Modal (Google Docs style) -->
  <PageSetupModal
    isOpen={showPageSetupModal}
    {pageSetup}
    {isPageless}
    on:close={() => (showPageSetupModal = false)}
    on:save={(e) => {
      pageSetup = e.detail.pageSetup;
      dispatch('pageSetupChange', { pageSetup });
      isPageless = e.detail.isPageless;
    }}
  />

  <!-- Google Docs Style Word Count Modal (Cmd+Shift+C) -->
  {#if showWordCountModal}
    <div class="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div class="bg-white rounded-xl shadow-2xl border border-slate-200 p-6 w-80 text-xs text-slate-700 animate-in fade-in zoom-in-95 duration-100">
        <div class="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
          <div class="flex items-center space-x-2 font-bold text-slate-800 text-sm">
            <FileText size={16} class="text-blue-600" />
            <span>Word count</span>
          </div>
          <button class="p-1 rounded-full hover:bg-slate-100 text-slate-400" on:click={() => (showWordCountModal = false)}>
            <X size={15} />
          </button>
        </div>
        <div class="space-y-3">
          <div class="flex items-center justify-between py-1 border-b border-slate-50">
            <span class="text-slate-500">Pages</span>
            <span class="font-bold text-slate-800 font-mono">{isPageless ? 'Pageless' : '1'}</span>
          </div>
          <div class="flex items-center justify-between py-1 border-b border-slate-50">
            <span class="text-slate-500">Words</span>
            <span class="font-bold text-slate-800 font-mono">{currentWords}</span>
          </div>
          <div class="flex items-center justify-between py-1 border-b border-slate-50">
            <span class="text-slate-500">Characters</span>
            <span class="font-bold text-slate-800 font-mono">{currentChars}</span>
          </div>
          <div class="flex items-center justify-between py-1 border-b border-slate-50">
            <span class="text-slate-500">Characters (no spaces)</span>
            <span class="font-bold text-slate-800 font-mono">{Math.max(0, currentChars - Math.floor(currentWords * 0.8))}</span>
          </div>
          <div class="flex items-center justify-between py-1">
            <span class="text-slate-500">Est. reading time</span>
            <span class="font-bold text-blue-600 font-mono">~{Math.ceil(currentWords / 200)} min</span>
          </div>
        </div>
        <div class="pt-5 flex justify-end">
          <button
            class="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm transition-colors"
            on:click={() => (showWordCountModal = false)}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>
