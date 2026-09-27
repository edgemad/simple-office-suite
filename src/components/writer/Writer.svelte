<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import WriterToolbar from './WriterToolbar.svelte';
  import WriterCanvas from './WriterCanvas.svelte';
  import DocumentOutline from './DocumentOutline.svelte';
  import TableInsertModal from './TableInsertModal.svelte';
  import PageSetupModal from './PageSetupModal.svelte';
  import VersionHistoryModal from './VersionHistoryModal.svelte';
  import CommentsDrawer from './CommentsDrawer.svelte';
  import SpecialCharactersModal from './SpecialCharactersModal.svelte';
  import WatermarkModal from './WatermarkModal.svelte';
  import type {
    DocumentMeta,
    DocumentPageSetup,
    DocumentVersion,
    DocumentComment,
    DocumentWatermark,
    DocumentHeaderFooter,
    EditorMode
  } from '../../types';
  import {
    Search,
    X,
    Replace,
    FileText,
    ChevronDown,
    ChevronUp,
    CheckSquare,
    Stamp,
    MessageSquare,
    History,
    Sparkles
  } from 'lucide-svelte';

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
  let showComments = false;
  let showTableModal = false;
  let showPageSetupModal = false;
  let showSearch = false;
  let showWordCountModal = false;
  let showVersionModal = false;
  let showSpecialCharModal = false;
  let showWatermarkModal = false;

  let editorMode: EditorMode = 'editing';
  let selectedQuote = '';

  // Find & Replace Advanced State (Google Docs style)
  let findQuery = '';
  let replaceQuery = '';
  let matchCase = false;
  let wholeWord = false;
  let useRegex = false;
  let matchCount = 0;
  let currentMatchIndex = 0;

  let currentWords = 0;
  let currentChars = 0;

  let pageSetup: DocumentPageSetup = {
    margin: 'normal',
    orientation: 'portrait',
    size: 'a4',
  };
  let isPageless = false;

  let watermark: DocumentWatermark = {
    enabled: false,
    text: 'CONFIDENTIAL',
    opacity: 0.15,
    angle: -45,
  };

  let headerFooter: DocumentHeaderFooter = {
    headerText: 'Simple Office Suite — Executive Brief',
    footerText: 'Confidential & Proprietary',
    showPageNumbers: true,
    firstPageDifferent: false,
  };

  let versions: DocumentVersion[] = [
    {
      id: 'v_init',
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      authorName: 'Edgar Madeja',
      name: 'Initial Template',
      content: contentHtml,
      isAutoSave: true,
    },
  ];

  let comments: DocumentComment[] = [
    {
      id: 'c_1',
      authorName: 'Sarah Jenkins',
      content: 'Make sure to add the export to PDF verification test here.',
      timestamp: new Date(Date.now() - 1800000).toISOString(),
      quotedText: 'Universal format compatibility',
      resolved: false,
      replies: [
        {
          id: 'r_1',
          authorName: 'Edgar Madeja',
          content: 'Added in the latest release pipeline!',
          timestamp: new Date(Date.now() - 900000).toISOString(),
        },
      ],
    },
  ];

  const dispatch = createEventDispatcher<{
    updateStats: { words: number; chars: number };
    contentChange: { html: string; text: string; words: number; chars: number };
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

  export function insertHtml(html: string) {
    if (canvasRef) canvasRef.execCommand('insertHTML', html);
  }

  export function insertText(text: string) {
    if (canvasRef) canvasRef.execCommand('insertText', text);
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

  export function openVersionHistory() {
    showVersionModal = true;
  }

  export function openWatermark() {
    showWatermarkModal = true;
  }

  export function toggleCommentsDrawer() {
    showComments = !showComments;
  }

  export function openSpecialCharacters() {
    showSpecialCharModal = true;
  }

  // Quick Table context actions
  export function tableInsertRowAbove() {
    canvasRef?.insertTableRow(true);
  }

  export function tableInsertRowBelow() {
    canvasRef?.insertTableRow(false);
  }

  export function tableInsertColLeft() {
    canvasRef?.insertTableColumn(true);
  }

  export function tableInsertColRight() {
    canvasRef?.insertTableColumn(false);
  }

  export function tableDeleteRow() {
    canvasRef?.deleteTableRow();
  }

  export function tableDeleteCol() {
    canvasRef?.deleteTableColumn();
  }

  export function tableDelete() {
    canvasRef?.deleteTable();
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
    if (!findQuery) return;
    window.find(findQuery, matchCase, false, true);
  }

  function handleReplace(all: boolean = false) {
    if (canvasRef && findQuery) {
      canvasRef.replaceText(findQuery, replaceQuery, all);
      handleFindNext();
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

  function handleSelectionChange(e: CustomEvent<{ text: string }>) {
    selectedQuote = e.detail.text;
  }

  function handleAddComment(e: CustomEvent<{ text: string; quotedText: string }>) {
    const newComment: DocumentComment = {
      id: `c_${Date.now()}`,
      authorName: 'You (Author)',
      content: e.detail.text,
      timestamp: new Date().toISOString(),
      quotedText: e.detail.quotedText,
      resolved: false,
      replies: [],
    };
    comments = [newComment, ...comments];
    canvasRef?.anchorComment(newComment.id);
  }

  function handleReplyComment(e: CustomEvent<{ commentId: string; text: string }>) {
    comments = comments.map((c) => {
      if (c.id === e.detail.commentId) {
        return {
          ...c,
          replies: [
            ...c.replies,
            {
              id: `r_${Date.now()}`,
              authorName: 'You',
              content: e.detail.text,
              timestamp: new Date().toISOString(),
            },
          ],
        };
      }
      return c;
    });
  }

  function handleResolveComment(e: CustomEvent<{ commentId: string }>) {
    comments = comments.map((c) => (c.id === e.detail.commentId ? { ...c, resolved: !c.resolved } : c));
  }

  function handleDeleteComment(e: CustomEvent<{ commentId: string }>) {
    comments = comments.filter((c) => c.id !== e.detail.commentId);
  }

  function handleSaveNamedVersion(e: CustomEvent<{ name: string }>) {
    const newVer: DocumentVersion = {
      id: `v_${Date.now()}`,
      timestamp: new Date().toISOString(),
      authorName: 'You',
      name: e.detail.name,
      content: contentHtml,
      isAutoSave: false,
    };
    versions = [newVer, ...versions];
  }

  function handleRestoreVersion(e: CustomEvent<{ content: string }>) {
    contentHtml = e.detail.content;
    meta.isDirty = true;
  }

  function handleKeydown(e: KeyboardEvent) {
    const mod = e.ctrlKey || e.metaKey;

    if (mod && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'f') {
      e.preventDefault();
      showSearch = !showSearch;
    } else if (mod && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      handleInsertLink();
    } else if (mod && e.altKey && e.key.toLowerCase() === 'm') {
      // Google Docs shortcut: Add comment (Cmd+Alt+M)
      e.preventDefault();
      showComments = true;
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
    {showComments}
    openCommentsCount={comments.filter((c) => !c.resolved).length}
    on:format={handleFormat}
    on:insertTable={() => (showTableModal = true)}
    on:insertImage={handleInsertImage}
    on:insertLink={handleInsertLink}
    on:insertChecklist={insertChecklist}
    on:insertDate={() => canvasRef?.insertDate()}
    on:insertCallout={() => insertCallout('info')}
    on:insertPageBreak={() => canvasRef?.insertPageBreak()}
    on:insertSpecialChar={() => (showSpecialCharModal = true)}
    on:openWatermark={() => (showWatermarkModal = true)}
    on:openVersionHistory={() => (showVersionModal = true)}
    on:toggleComments={() => (showComments = !showComments)}
    on:toggleOutline={toggleOutline}
    on:openPageSetup={openPageSetup}
    on:openWordCount={openWordCount}
    on:toggleSearch={() => (showSearch = !showSearch)}
  />

  <!-- Google Docs Style Find & Replace Floating Panel -->
  {#if showSearch}
    <div class="no-print bg-white border-b border-slate-200 px-4 py-2 flex flex-wrap items-center justify-between text-xs shadow-md z-20 animate-in fade-in slide-in-from-top duration-150 gap-2">
      <div class="flex items-center flex-wrap gap-2">
        <!-- Find Input -->
        <div class="flex items-center space-x-1.5 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-300">
          <Search size={13} class="text-slate-400" />
          <input
            type="text"
            placeholder="Find in document..."
            bind:value={findQuery}
            class="bg-transparent outline-none text-xs w-40 text-slate-800"
            on:keydown={(e) => e.key === 'Enter' && handleFindNext()}
          />
        </div>

        <button
          class="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-300 text-slate-700 font-medium transition-colors"
          on:click={handleFindNext}
        >
          Find Next
        </button>

        <!-- Replace Input -->
        <div class="flex items-center space-x-1.5 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-300">
          <Replace size={13} class="text-slate-400" />
          <input
            type="text"
            placeholder="Replace with..."
            bind:value={replaceQuery}
            class="bg-transparent outline-none text-xs w-40 text-slate-800"
            on:keydown={(e) => e.key === 'Enter' && handleReplace(false)}
          />
        </div>

        <button
          class="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 text-blue-700 font-medium transition-colors"
          on:click={() => handleReplace(false)}
        >
          Replace
        </button>

        <button
          class="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 text-blue-700 font-medium transition-colors"
          on:click={() => handleReplace(true)}
        >
          Replace All
        </button>

        <!-- Advanced Options Checkboxes -->
        <div class="flex items-center space-x-3 ml-2 text-[11px] text-slate-600">
          <label class="flex items-center space-x-1 cursor-pointer">
            <input type="checkbox" bind:checked={matchCase} class="w-3.5 h-3.5 accent-blue-600 rounded" />
            <span>Match case</span>
          </label>
        </div>
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

  <!-- Main Body: Document Outline Sidebar + Canvas + Comments Drawer -->
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
      {watermark}
      {headerFooter}
      {editorMode}
      on:change={handleCanvasChange}
      on:selectionChange={handleSelectionChange}
      on:selectComment={(e) => {
        showComments = true;
      }}
    />

    <CommentsDrawer
      isOpen={showComments}
      {comments}
      {editorMode}
      bind:selectedQuote
      on:close={() => (showComments = false)}
      on:addComment={handleAddComment}
      on:replyComment={handleReplyComment}
      on:resolveComment={handleResolveComment}
      on:deleteComment={handleDeleteComment}
      on:changeMode={(e) => (editorMode = e.detail.mode)}
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
      isPageless = e.detail.isPageless;
    }}
  />

  <!-- Google Docs Style Word Count Modal (Cmd+Shift+C) -->
  {#if showWordCountModal}
    <div class="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="bg-white rounded-xl shadow-2xl border border-slate-200 p-6 w-80 text-xs text-slate-700 animate-in fade-in zoom-in-95 duration-100"
        on:click|stopPropagation
      >
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
            class="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-xs transition-colors"
            on:click={() => (showWordCountModal = false)}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Version History Modal -->
  <VersionHistoryModal
    isOpen={showVersionModal}
    {versions}
    currentContent={contentHtml}
    on:close={() => (showVersionModal = false)}
    on:nameVersion={handleSaveNamedVersion}
    on:restore={handleRestoreVersion}
  />

  <!-- Special Characters Modal -->
  <SpecialCharactersModal
    isOpen={showSpecialCharModal}
    on:close={() => (showSpecialCharModal = false)}
    on:insert={(e) => canvasRef?.insertCharacter(e.detail.char)}
  />

  <!-- Watermark Modal -->
  <WatermarkModal
    isOpen={showWatermarkModal}
    {watermark}
    on:close={() => (showWatermarkModal = false)}
    on:save={(e) => (watermark = e.detail.watermark)}
  />
</div>
