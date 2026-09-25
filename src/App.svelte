<script lang="ts">
  import { onMount } from 'svelte';
  import type { WorkspaceMode, WriterDocument, SpreadsheetWorkbook, SlideDeck } from './types';
  import Header from './components/layout/Header.svelte';
  import StatusBar from './components/layout/StatusBar.svelte';
  import ShortcutsModal from './components/layout/ShortcutsModal.svelte';
  import Writer from './components/writer/Writer.svelte';
  import Sheets from './components/sheets/Sheets.svelte';
  import Slides from './components/slides/Slides.svelte';
  import {
    openFileDialogNative,
    saveFileDialogNative,
    readTextFileNative,
    writeTextFileNative
  } from './lib/tauri';
  import { autoSaver } from './lib/storage';
  import { downloadFile, triggerPrintToPdf, htmlToMarkdown } from './lib/utils';
  import {
    exportToDocx,
    exportToRtf,
    exportToXlsx,
    exportToPptxXml,
    parseDocumentContent,
    parseSpreadsheetContent
  } from './lib/fileFormats';
  import { recalculateGrid } from './components/sheets/formulaEngine';

  let activeMode: WorkspaceMode = 'writer';
  let showShortcutsModal = false;

  let writerRef: Writer;
  let sheetsRef: Sheets;
  let slidesRef: Slides;

  // Active status bar statistics
  let writerWordCount = 48;
  let writerCharCount = 312;
  let sheetsActiveCell = 'B5';
  let sheetsSelectionSum: number | null = 14500;
  let slidesIndex = 0;
  let slidesTotal = 3;

  // --- Initial Default Documents ---
  let writerDoc: WriterDocument = {
    meta: {
      id: 'doc_writer_1',
      title: 'SOS Project Brief',
      isDirty: false,
      mode: 'writer',
    },
    contentHtml: `
      <h1>Simple Office Suite (SOS) Project Brief</h1>
      <p>Welcome to <strong>SOS Docs</strong> — your lightweight, high-performance, full-featured office word processor.</p>
      <h2>Comprehensive Features Included</h2>
      <ul>
        <li><strong>Full Font Selections</strong>: Inter, Arial, Times New Roman, Georgia, Merriweather, JetBrains Mono, Courier New, Trebuchet MS.</li>
        <li><strong>Rich Typography</strong>: Font sizes, bold, italic, underline, strike, colors, highlights, subscript, superscript, line spacing.</li>
        <li><strong>Universal File Formats</strong>: Open & Export <strong>.docx, .rtf, .md, .txt, .html, and PDF</strong>.</li>
        <li><strong>Document Elements</strong>: Insert tables, embed local images, create hyperlinks, dividers, and real-time Find & Replace.</li>
      </ul>
      <blockquote>\"Simplicity is the soul of efficiency.\" — Austin Freeman</blockquote>
      <p>Draft your thoughts with zero bloat and complete privacy.</p>
    `,
    contentMarkdown: '',
    wordCount: 65,
    charCount: 420,
    pageCount: 1,
  };

  let sheetsWorkbook: SpreadsheetWorkbook = {
    meta: {
      id: 'doc_sheets_1',
      title: 'Q3 Financial Model',
      isDirty: false,
      mode: 'sheets',
    },
    activeSheetId: 'sheet_1',
    sheets: [
      {
        id: 'sheet_1',
        name: 'Budget 2026',
        rowCount: 50,
        colCount: 26,
        cells: recalculateGrid({
          A1: { raw: 'Category', computed: 'Category', format: { bold: true, fontFamily: 'Inter, sans-serif' } },
          B1: { raw: 'Q1 Budget', computed: 'Q1 Budget', format: { bold: true, align: 'right' } },
          C1: { raw: 'Q2 Budget', computed: 'Q2 Budget', format: { bold: true, align: 'right' } },
          D1: { raw: 'Total', computed: 'Total', format: { bold: true, align: 'right' } },

          A2: { raw: 'Hardware & Devices', computed: 'Hardware & Devices' },
          B2: { raw: '5000', computed: 5000, format: { align: 'right', format: 'currency' } },
          C2: { raw: '4200', computed: 4200, format: { align: 'right', format: 'currency' } },
          D2: { raw: '=SUM(B2:C2)', computed: 9200, format: { align: 'right', bold: true, format: 'currency' } },

          A3: { raw: 'Software & Cloud', computed: 'Software & Cloud' },
          B3: { raw: '3500', computed: 3500, format: { align: 'right', format: 'currency' } },
          C3: { raw: '3800', computed: 3800, format: { align: 'right', format: 'currency' } },
          D3: { raw: '=SUM(B3:C3)', computed: 7300, format: { align: 'right', bold: true, format: 'currency' } },

          A4: { raw: 'Research & Prototyping', computed: 'Research & Prototyping' },
          B4: { raw: '6000', computed: 6000, format: { align: 'right', format: 'currency' } },
          C4: { raw: '6500', computed: 6500, format: { align: 'right', format: 'currency' } },
          D4: { raw: '=SUM(B4:C4)', computed: 12500, format: { align: 'right', bold: true, format: 'currency' } },

          A5: { raw: 'Total Expenses', computed: 'Total Expenses', format: { bold: true } },
          B5: { raw: '=SUM(B2:B4)', computed: 14500, format: { bold: true, align: 'right', format: 'currency' } },
          C5: { raw: '=SUM(C2:C4)', computed: 14500, format: { bold: true, align: 'right', format: 'currency' } },
          D5: { raw: '=SUM(D2:D4)', computed: 29000, format: { bold: true, align: 'right', format: 'currency' } },
        }),
      },
    ],
  };

  let slidesDeck: SlideDeck = {
    meta: {
      id: 'doc_slides_1',
      title: 'Simple Office Architecture',
      isDirty: false,
      mode: 'slides',
    },
    aspectRatio: '16:9',
    slides: [
      {
        id: 's1',
        title: 'Simple Office Suite (SOS)',
        bgColor: '#0f172a',
        elements: [
          {
            id: 'e1',
            type: 'title',
            x: 10,
            y: 20,
            width: 80,
            height: 15,
            content: 'Simple Office Suite (SOS)',
            fontColor: '#ffffff',
            fontSize: 44,
          },
          {
            id: 'e2',
            type: 'text',
            x: 10,
            y: 42,
            width: 80,
            height: 25,
            content: 'Full-Featured, Powerhouse Productivity with Sub-30MB Footprint',
            fontColor: '#94a3b8',
            fontSize: 20,
          },
          {
            id: 'e3',
            type: 'shape',
            x: 10,
            y: 65,
            width: 45,
            height: 18,
            content: '⚡ Cross-Platform • Offline-First • Multi-Format',
            bgColor: '#1e293b',
            fontColor: '#38bdf8',
          },
        ],
        notes: 'Introduce SOS vision and performance targets.',
      },
      {
        id: 's2',
        title: 'Core Architecture',
        bgColor: '#ffffff',
        elements: [
          {
            id: 'e4',
            type: 'title',
            x: 8,
            y: 10,
            width: 84,
            height: 12,
            content: 'Full Office Suite Feature Set',
            fontSize: 32,
          },
          {
            id: 'e5',
            type: 'text',
            x: 8,
            y: 26,
            width: 44,
            height: 55,
            content: '• Comprehensive Font & Typography selections\n• Full MS Office format compatibility (.docx, .xlsx, .pptx)\n• Math & Logic formula engine (SUM, AVG, COUNT, IF, VLOOKUP)\n• Interactive Slide Layouts & Presenter Stopwatch',
            fontSize: 16,
          },
          {
            id: 'e6',
            type: 'code',
            x: 54,
            y: 26,
            width: 38,
            height: 55,
            content: '// Multi-Format Universal Engine\nexport function exportToDocx(doc) {\n  return generateWordXml(doc);\n}',
          },
        ],
        notes: 'Walk through technical stack and modularity.',
      },
      {
        id: 's3',
        title: 'Performance & Metrics',
        bgColor: '#f8fafc',
        elements: [
          {
            id: 'e7',
            type: 'title',
            x: 8,
            y: 12,
            width: 84,
            height: 12,
            content: 'Speed & Efficiency Targets',
            fontSize: 32,
          },
          {
            id: 'e8',
            type: 'stat',
            x: 15,
            y: 35,
            width: 32,
            height: 35,
            content: '3.1 MB',
            fontSize: 48,
            fontColor: '#2563eb',
          },
          {
            id: 'e9',
            type: 'stat',
            x: 52,
            y: 35,
            width: 32,
            height: 35,
            content: '0 Cloud',
            fontSize: 48,
            fontColor: '#059669',
          },
        ],
        notes: 'Highlight lightweight binary advantages.',
      },
    ],
  };

  $: currentMeta =
    activeMode === 'writer'
      ? writerDoc.meta
      : activeMode === 'sheets'
      ? sheetsWorkbook.meta
      : slidesDeck.meta;

  function triggerAutoSave() {
    currentMeta.isDirty = true;
    if (activeMode === 'writer') {
      autoSaver.scheduleAutoSave('writer', writerDoc.meta.id, writerDoc);
    } else if (activeMode === 'sheets') {
      autoSaver.scheduleAutoSave('sheets', sheetsWorkbook.meta.id, sheetsWorkbook);
    } else {
      autoSaver.scheduleAutoSave('slides', slidesDeck.meta.id, slidesDeck);
    }
  }

  function handleNewDoc() {
    if (currentMeta.isDirty && !confirm('Discard unsaved changes?')) return;
    const timestamp = Date.now();
    if (activeMode === 'writer') {
      writerDoc = {
        meta: { id: `doc_${timestamp}`, title: 'Untitled Document', isDirty: false, mode: 'writer' },
        contentHtml: '<h1>Untitled Document</h1><p>Start writing here...</p>',
        contentMarkdown: '',
        wordCount: 0,
        charCount: 0,
        pageCount: 1,
      };
    } else if (activeMode === 'sheets') {
      sheetsWorkbook = {
        meta: { id: `sheet_${timestamp}`, title: 'Untitled Spreadsheet', isDirty: false, mode: 'sheets' },
        activeSheetId: 's1',
        sheets: [{ id: 's1', name: 'Sheet 1', rowCount: 50, colCount: 26, cells: {} }],
      };
    } else {
      slidesDeck = {
        meta: { id: `deck_${timestamp}`, title: 'Untitled Presentation', isDirty: false, mode: 'slides' },
        aspectRatio: '16:9',
        slides: [
          {
            id: `s_${timestamp}`,
            title: 'Slide 1',
            bgColor: '#ffffff',
            elements: [{ id: `e1`, type: 'title', x: 10, y: 35, width: 80, height: 20, content: 'Presentation Title' }],
          },
        ],
      };
    }
  }

  async function handleOpenDoc() {
    const filters = [
      {
        name: 'All Office Formats (*.docx, *.xlsx, *.pptx, *.csv, *.md, *.txt, *.json)',
        extensions: ['docx', 'doc', 'xlsx', 'xls', 'pptx', 'csv', 'tsv', 'md', 'txt', 'html', 'rtf', 'json', 'sosw', 'soss', 'sosp'],
      },
      { name: 'Word Documents (*.docx, *.doc, *.rtf, *.odt)', extensions: ['docx', 'doc', 'rtf', 'odt', 'txt', 'md'] },
      { name: 'Excel Spreadsheets (*.xlsx, *.xls, *.csv, *.tsv)', extensions: ['xlsx', 'xls', 'csv', 'tsv'] },
      { name: 'PowerPoint Presentations (*.pptx, *.odp)', extensions: ['pptx', 'odp'] },
      { name: 'All Files (*)', extensions: ['*'] },
    ];

    try {
      const selectedPath = await openFileDialogNative('Open Office Document', filters);
      if (!selectedPath) return;

      const content = await readTextFileNative(selectedPath);
      const ext = selectedPath.split('.').pop()?.toLowerCase();

      // Auto-detect mode based on file format
      if (['xlsx', 'xls', 'csv', 'tsv', 'soss'].includes(ext || '')) {
        activeMode = 'sheets';
        let parsedGrid: Record<string, any> = {};
        if (content.startsWith('{') && content.includes('"cells":')) {
          try {
            const parsed = JSON.parse(content);
            parsedGrid = recalculateGrid(parsed.cells || {});
          } catch {
            parsedGrid = parseSpreadsheetContent(content, selectedPath);
          }
        } else {
          parsedGrid = parseSpreadsheetContent(content, selectedPath);
        }
        sheetsWorkbook.sheets[0].cells = parsedGrid;
        const cellKeys = Object.keys(parsedGrid);
        let maxRow = 50;
        let maxCol = 26;
        for (const k of cellKeys) {
          const m = k.match(/^([A-Z]+)([0-9]+)$/);
          if (m) {
            const r = parseInt(m[2], 10);
            if (r > maxRow) maxRow = r + 10;
          }
        }
        sheetsWorkbook.sheets[0].rowCount = maxRow;
        sheetsWorkbook.sheets[0].colCount = Math.max(maxCol, 35);
        sheetsWorkbook.meta.filePath = selectedPath;
        sheetsWorkbook.meta.title = selectedPath.split('/').pop()?.replace(/\.[^/.]+$/, '') || 'Spreadsheet';
        sheetsWorkbook.meta.isDirty = false;
        sheetsWorkbook.meta.lastSaved = new Date().toISOString();
      } else if (['pptx', 'odp', 'sosp'].includes(ext || '')) {
        activeMode = 'slides';
        try {
          slidesDeck = JSON.parse(content);
        } catch {
          slidesDeck.meta.title = selectedPath.split('/').pop()?.replace(/\.[^/.]+$/, '') || 'Presentation';
        }
        slidesDeck.meta.filePath = selectedPath;
        slidesDeck.meta.isDirty = false;
        slidesDeck.meta.lastSaved = new Date().toISOString();
      } else {
        // Document / Writer mode (.docx, .doc, .rtf, .md, .txt, .html, .sosw)
        activeMode = 'writer';
        if (selectedPath.endsWith('.sosw') || (selectedPath.endsWith('.json') && content.includes('contentHtml'))) {
          try {
            writerDoc = JSON.parse(content);
          } catch {
            writerDoc.contentHtml = content;
          }
        } else {
          writerDoc.contentHtml = parseDocumentContent(content, selectedPath);
        }
        writerDoc.meta.filePath = selectedPath;
        writerDoc.meta.title = selectedPath.split('/').pop()?.replace(/\.[^/.]+$/, '') || 'Document';
        writerDoc.meta.isDirty = false;
        writerDoc.meta.lastSaved = new Date().toISOString();
      }
    } catch (err) {
      console.error('Open file error:', err);
      alert(`Could not open file: ${err}`);
    }
  }

  async function handleSaveDoc() {
    if (currentMeta.filePath) {
      await saveToFile(currentMeta.filePath);
    } else {
      await handleSaveAsDoc();
    }
  }

  async function handleSaveAsDoc() {
    let defaultName = `${currentMeta.title.replace(/\s+/g, '_').toLowerCase()}`;
    let ext = 'docx';
    if (activeMode === 'sheets') ext = 'xlsx';
    else if (activeMode === 'slides') ext = 'pptx';

    defaultName += `.${ext}`;

    const filters = [
      { name: `Office Document (*.${ext})`, extensions: [ext] },
      { name: 'JSON Suite Format (*.json)', extensions: ['json'] },
    ];

    try {
      const chosenPath = await saveFileDialogNative('Save File As', defaultName, filters);
      if (chosenPath) {
        await saveToFile(chosenPath);
      }
    } catch (err) {
      console.error('Save As error:', err);
    }
  }

  async function saveToFile(filePath: string) {
    let payload = '';
    const ext = filePath.split('.').pop()?.toLowerCase();

    if (activeMode === 'writer') {
      if (ext === 'docx' || ext === 'doc') {
        payload = exportToDocx(writerDoc);
      } else if (ext === 'rtf') {
        payload = exportToRtf(writerDoc);
      } else if (ext === 'md') {
        payload = htmlToMarkdown(writerDoc.contentHtml);
      } else if (ext === 'txt') {
        payload = writerDoc.contentHtml.replace(/<[^>]+>/g, '');
      } else {
        payload = JSON.stringify(writerDoc, null, 2);
      }
    } else if (activeMode === 'sheets') {
      if (ext === 'xlsx' || ext === 'xls') {
        payload = exportToXlsx(sheetsWorkbook);
      } else if (ext === 'csv') {
        const rows: string[] = [];
        const activeSheet = sheetsWorkbook.sheets[0];
        for (let r = 0; r < activeSheet.rowCount; r++) {
          const rowVals: string[] = [];
          for (let c = 0; c < activeSheet.colCount; c++) {
            const k = `${String.fromCharCode(65 + c)}${r + 1}`;
            rowVals.push(String(activeSheet.cells[k]?.computed ?? ''));
          }
          if (rowVals.some(v => v !== '')) rows.push(rowVals.join(','));
        }
        payload = rows.join('\n');
      } else {
        payload = JSON.stringify(sheetsWorkbook, null, 2);
      }
    } else {
      if (ext === 'pptx') {
        payload = exportToPptxXml(slidesDeck);
      } else {
        payload = JSON.stringify(slidesDeck, null, 2);
      }
    }

    try {
      await writeTextFileNative(filePath, payload);
      currentMeta.filePath = filePath;
      currentMeta.isDirty = false;
      currentMeta.lastSaved = new Date().toISOString();
    } catch (err) {
      console.error('Failed to save file:', err);
      alert(`Failed to save: ${err}`);
    }
  }

  function handleExportFormat(e: CustomEvent<{ format: string }>) {
    const fmt = e.detail.format;
    const baseName = currentMeta.title.replace(/\s+/g, '_') || 'document';

    if (fmt === 'docx') {
      const data = exportToDocx(writerDoc);
      downloadFile(`${baseName}.docx`, data, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    } else if (fmt === 'rtf') {
      const data = exportToRtf(writerDoc);
      downloadFile(`${baseName}.rtf`, data, 'application/rtf');
    } else if (fmt === 'md') {
      const data = htmlToMarkdown(writerDoc.contentHtml);
      downloadFile(`${baseName}.md`, data, 'text/markdown');
    } else if (fmt === 'txt') {
      const data = writerDoc.contentHtml.replace(/<[^>]+>/g, '');
      downloadFile(`${baseName}.txt`, data, 'text/plain');
    } else if (fmt === 'html') {
      downloadFile(`${baseName}.html`, writerDoc.contentHtml, 'text/html');
    } else if (fmt === 'xlsx') {
      const data = exportToXlsx(sheetsWorkbook);
      downloadFile(`${baseName}.xlsx`, data, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    } else if (fmt === 'csv') {
      const sheetsRefEl = document.querySelector('button[title="Download as CSV"]') as HTMLButtonElement;
      if (sheetsRefEl) sheetsRefEl.click();
    } else if (fmt === 'pptx') {
      const data = exportToPptxXml(slidesDeck);
      downloadFile(`${baseName}.pptx`, data, 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
    } else if (fmt === 'json') {
      const payload = activeMode === 'writer' ? writerDoc : activeMode === 'sheets' ? sheetsWorkbook : slidesDeck;
      downloadFile(`${baseName}.json`, JSON.stringify(payload, null, 2), 'application/json');
    }
  }

  function handlePrintPdf() {
    triggerPrintToPdf(currentMeta.title);
  }

  function handleUndo() {
    if (activeMode === 'writer' && writerRef) {
      writerRef.triggerUndo();
    } else if (activeMode === 'sheets' && sheetsRef) {
      sheetsRef.triggerUndo();
    } else if (activeMode === 'slides' && slidesRef) {
      slidesRef.triggerUndo();
    }
  }

  function handleRedo() {
    if (activeMode === 'writer' && writerRef) {
      writerRef.triggerRedo();
    } else if (activeMode === 'sheets' && sheetsRef) {
      sheetsRef.triggerRedo();
    } else if (activeMode === 'slides' && slidesRef) {
      slidesRef.triggerRedo();
    }
  }

  // --- Suite Global Keyboard Shortcuts ---
  function handleGlobalKeydown(e: KeyboardEvent) {
    const mod = e.ctrlKey || e.metaKey;

    if (mod && !e.shiftKey && !e.altKey) {
      if (e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSaveDoc();
      } else if (e.key.toLowerCase() === 'o') {
        e.preventDefault();
        handleOpenDoc();
      } else if (e.key.toLowerCase() === 'n') {
        e.preventDefault();
        handleNewDoc();
      } else if (e.key.toLowerCase() === 'p') {
        e.preventDefault();
        handlePrintPdf();
      } else if (e.key === '1') {
        e.preventDefault();
        activeMode = 'writer';
      } else if (e.key === '2') {
        e.preventDefault();
        activeMode = 'sheets';
      } else if (e.key === '3') {
        e.preventDefault();
        activeMode = 'slides';
      }
    } else if (mod && e.shiftKey && !e.altKey) {
      if (e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSaveAsDoc();
      }
    }

    // Keyboard Shortcuts cheat sheet: Cmd+/ or Ctrl+/
    if (mod && (e.key === '/' || e.key === '?')) {
      e.preventDefault();
      showShortcutsModal = !showShortcutsModal;
    }
  }
</script>

<svelte:window on:keydown={handleGlobalKeydown} />

<div class="h-screen w-screen flex flex-col bg-slate-100 overflow-hidden font-sans">
  <!-- Top Navigation & File Actions -->
  <Header
    {activeMode}
    meta={currentMeta}
    on:changeMode={(e) => (activeMode = e.detail)}
    on:newDoc={handleNewDoc}
    on:openDoc={handleOpenDoc}
    on:saveDoc={handleSaveDoc}
    on:saveAsDoc={handleSaveAsDoc}
    on:exportFormat={handleExportFormat}
    on:printPdf={handlePrintPdf}
    on:openShortcuts={() => (showShortcutsModal = true)}
    on:undo={handleUndo}
    on:redo={handleRedo}
  />

  <!-- Active Workspace Module -->
  <main class="flex-1 flex overflow-hidden relative">
    {#if activeMode === 'writer'}
      <Writer
        bind:this={writerRef}
        meta={writerDoc.meta}
        bind:contentHtml={writerDoc.contentHtml}
        on:contentChange={triggerAutoSave}
        on:updateStats={(e) => {
          writerWordCount = e.detail.words;
          writerCharCount = e.detail.chars;
        }}
      />
    {:else if activeMode === 'sheets'}
      <Sheets
        bind:this={sheetsRef}
        bind:workbook={sheetsWorkbook}
        on:change={triggerAutoSave}
        on:updateStats={(e) => {
          sheetsActiveCell = e.detail.activeCell;
          sheetsSelectionSum = e.detail.selectionSum;
        }}
      />
    {:else if activeMode === 'slides'}
      <Slides
        bind:this={slidesRef}
        bind:deck={slidesDeck}
        on:change={triggerAutoSave}
        on:updateStats={(e) => {
          slidesIndex = e.detail.slideIndex;
          slidesTotal = e.detail.totalSlides;
        }}
      />
    {/if}
  </main>

  <!-- Bottom Application Status Bar -->
  <StatusBar
    {activeMode}
    meta={currentMeta}
    wordCount={writerWordCount}
    charCount={writerCharCount}
    activeCell={sheetsActiveCell}
    selectionSum={sheetsSelectionSum}
    slideIndex={slidesIndex}
    totalSlides={slidesTotal}
  />

  <!-- Keyboard Shortcuts Cheat Sheet Modal -->
  {#if showShortcutsModal}
    <ShortcutsModal on:close={() => (showShortcutsModal = false)} />
  {/if}
</div>
