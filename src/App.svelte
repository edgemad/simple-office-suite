<script lang="ts">
  import { onMount } from 'svelte';
  import type { WorkspaceMode, WriterDocument, SpreadsheetWorkbook, SlideDeck } from './types';
  import Header from './components/layout/Header.svelte';
  import StatusBar from './components/layout/StatusBar.svelte';
  import Writer from './components/writer/Writer.svelte';
  import Sheets from './components/sheets/Sheets.svelte';
  import Slides from './components/slides/Slides.svelte';
  import {
    openFileDialogNative,
    saveFileDialogNative,
    readTextFileNative,
    writeTextFileNative,
    getSystemMetricsNative
  } from './lib/tauri';
  import { autoSaver } from './lib/storage';
  import { downloadFile, triggerPrintToPdf, htmlToMarkdown } from './lib/utils';
  import { recalculateGrid } from './components/sheets/formulaEngine';

  let activeMode: WorkspaceMode = 'writer';
  let memoryUsageMb = 42.8;

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
      <p>Welcome to <strong>SOS Writer</strong> — your lightweight, distraction-free, 100% offline word processor.</p>
      <h2>Architecture & Core Principles</h2>
      <ul>
        <li><strong>Sub-30MB Binary</strong>: Powered by Tauri 2.0 and Rust.</li>
        <li><strong>Sub-150MB RAM</strong>: Ultra-fast Svelte rendering with zero bloat.</li>
        <li><strong>Zero Cloud Telemetry</strong>: All data is saved strictly to your local filesystem.</li>
      </ul>
      <blockquote>"Simplicity is the soul of efficiency." — Austin Freeman</blockquote>
      <p>Export this document as Markdown, plain text, or printable PDF anytime.</p>
    `,
    contentMarkdown: '',
    wordCount: 52,
    charCount: 350,
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
          A1: { raw: 'Category', computed: 'Category', format: { bold: true } },
          B1: { raw: 'Q1 Budget', computed: 'Q1 Budget', format: { bold: true, align: 'right' } },
          C1: { raw: 'Q2 Budget', computed: 'Q2 Budget', format: { bold: true, align: 'right' } },
          D1: { raw: 'Total', computed: 'Total', format: { bold: true, align: 'right' } },

          A2: { raw: 'Hardware & Devices', computed: 'Hardware & Devices' },
          B2: { raw: '5000', computed: 5000, format: { align: 'right' } },
          C2: { raw: '4200', computed: 4200, format: { align: 'right' } },
          D2: { raw: '=SUM(B2:C2)', computed: 9200, format: { align: 'right', bold: true } },

          A3: { raw: 'Software & Infrastructure', computed: 'Software & Infrastructure' },
          B3: { raw: '3500', computed: 3500, format: { align: 'right' } },
          C3: { raw: '3800', computed: 3800, format: { align: 'right' } },
          D3: { raw: '=SUM(B3:C3)', computed: 7300, format: { align: 'right', bold: true } },

          A4: { raw: 'Research & Prototyping', computed: 'Research & Prototyping' },
          B4: { raw: '6000', computed: 6000, format: { align: 'right' } },
          C4: { raw: '6500', computed: 6500, format: { align: 'right' } },
          D4: { raw: '=SUM(B4:C4)', computed: 12500, format: { align: 'right', bold: true } },

          A5: { raw: 'Total Expenses', computed: 'Total Expenses', format: { bold: true } },
          B5: { raw: '=SUM(B2:B4)', computed: 14500, format: { bold: true, align: 'right' } },
          C5: { raw: '=SUM(C2:C4)', computed: 14500, format: { bold: true, align: 'right' } },
          D5: { raw: '=SUM(D2:D4)', computed: 29000, format: { bold: true, align: 'right' } },
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
          },
          {
            id: 'e2',
            type: 'text',
            x: 10,
            y: 40,
            width: 80,
            height: 25,
            content: 'The Lightweight, Offline-First Productivity Suite for Modern Desktops',
            fontColor: '#94a3b8',
          },
          {
            id: 'e3',
            type: 'shape',
            x: 10,
            y: 65,
            width: 35,
            height: 18,
            content: '⚡ Sub-30MB Binary | < 150MB RAM',
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
            content: 'Tauri 2.0 Rust Core + Svelte 5',
          },
          {
            id: 'e5',
            type: 'text',
            x: 8,
            y: 26,
            width: 42,
            height: 55,
            content: '• Native OS File Dialogs & Direct File System I/O\n• Zero background telemetry or cloud sync\n• Virtualized spreadsheet engine supporting SUM, AVG, COUNT\n• Responsive WYSIWYG document pagination',
          },
          {
            id: 'e6',
            type: 'code',
            x: 52,
            y: 26,
            width: 40,
            height: 55,
            content: '// Tauri 2.0 Rust Command\n#[tauri::command]\nfn write_text_file(path: String, contents: String) {\n    std::fs::write(path, contents)\n}',
          },
        ],
        notes: 'Walk through technical stack and modularity.',
      },
      {
        id: 's3',
        title: 'Multi-OS Distribution',
        bgColor: '#f8fafc',
        elements: [
          {
            id: 'e7',
            type: 'title',
            x: 10,
            y: 12,
            width: 80,
            height: 12,
            content: 'Cross-Platform GitHub Actions Matrix',
          },
          {
            id: 'e8',
            type: 'text',
            x: 10,
            y: 30,
            width: 80,
            height: 40,
            content: '• macOS: Universal DMG (Apple Silicon & Intel)\n• Linux: AppImage and Debian (.deb) packages\n• Windows: Native MSI and NSIS installers\n• Automated GitHub Release generation on git tags',
          },
        ],
        notes: 'Conclude with release workflow.',
      },
    ],
  };

  // Active meta proxy
  $: currentMeta =
    activeMode === 'writer'
      ? writerDoc.meta
      : activeMode === 'sheets'
      ? sheetsWorkbook.meta
      : slidesDeck.meta;

  // Auto-save triggers
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

  // --- File Actions ---
  function handleNewDoc() {
    if (currentMeta.isDirty && !confirm('Discard unsaved changes?')) {
      return;
    }
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
    const filters =
      activeMode === 'writer'
        ? [
            { name: 'SOS Writer (*.sosw, *.md, *.txt)', extensions: ['sosw', 'md', 'txt', 'json'] },
            { name: 'All Files', extensions: ['*'] },
          ]
        : activeMode === 'sheets'
        ? [
            { name: 'SOS Sheets (*.soss, *.csv, *.json)', extensions: ['soss', 'csv', 'json'] },
            { name: 'All Files', extensions: ['*'] },
          ]
        : [
            { name: 'SOS Slides (*.sosp, *.json)', extensions: ['sosp', 'json'] },
            { name: 'All Files', extensions: ['*'] },
          ];

    try {
      const selectedPath = await openFileDialogNative('Open File', filters);
      if (!selectedPath) return;

      const content = await readTextFileNative(selectedPath);

      if (activeMode === 'writer') {
        if (selectedPath.endsWith('.md') || selectedPath.endsWith('.txt')) {
          writerDoc.contentHtml = `<pre>${content}</pre>`;
        } else {
          try {
            const parsed = JSON.parse(content);
            if (parsed.contentHtml) writerDoc = parsed;
          } catch {
            writerDoc.contentHtml = content;
          }
        }
        writerDoc.meta.filePath = selectedPath;
        writerDoc.meta.isDirty = false;
        writerDoc.meta.lastSaved = new Date().toISOString();
      } else if (activeMode === 'sheets') {
        if (selectedPath.endsWith('.csv')) {
          // Parse CSV
          const lines = content.split(/\r?\n/).filter(Boolean);
          const cells: Record<string, any> = {};
          lines.forEach((line, r) => {
            line.split(',').forEach((val, c) => {
              const letter = String.fromCharCode(65 + c);
              cells[`${letter}${r + 1}`] = { raw: val.trim(), computed: val.trim() };
            });
          });
          sheetsWorkbook.sheets[0].cells = recalculateGrid(cells);
        } else {
          try {
            sheetsWorkbook = JSON.parse(content);
          } catch (err) {
            alert('Invalid spreadsheet file format');
          }
        }
        sheetsWorkbook.meta.filePath = selectedPath;
        sheetsWorkbook.meta.isDirty = false;
        sheetsWorkbook.meta.lastSaved = new Date().toISOString();
      } else {
        try {
          slidesDeck = JSON.parse(content);
          slidesDeck.meta.filePath = selectedPath;
          slidesDeck.meta.isDirty = false;
          slidesDeck.meta.lastSaved = new Date().toISOString();
        } catch {
          alert('Invalid presentation file format');
        }
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
    let ext = 'json';
    if (activeMode === 'writer') ext = 'sosw';
    else if (activeMode === 'sheets') ext = 'soss';
    else if (activeMode === 'slides') ext = 'sosp';

    defaultName += `.${ext}`;

    const filters = [{ name: `SOS ${activeMode.toUpperCase()} (*.${ext})`, extensions: [ext, 'json'] }];

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
    if (activeMode === 'writer') {
      payload = JSON.stringify(writerDoc, null, 2);
    } else if (activeMode === 'sheets') {
      payload = JSON.stringify(sheetsWorkbook, null, 2);
    } else {
      payload = JSON.stringify(slidesDeck, null, 2);
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

  function handleExportMarkdown() {
    const md = htmlToMarkdown(writerDoc.contentHtml);
    downloadFile(`${writerDoc.meta.title || 'document'}.md`, md, 'text/markdown');
  }

  function handleExportPdf() {
    triggerPrintToPdf(currentMeta.title);
  }

  function handleExportCsv() {
    // Handled in Sheets component
    const sheetsRef = document.querySelector('button[title="Download as CSV"]') as HTMLButtonElement;
    if (sheetsRef) sheetsRef.click();
  }

  onMount(async () => {
    try {
      const metrics = await getSystemMetricsNative();
      memoryUsageMb = metrics.memory_used_mb;
    } catch {
      // fallback
    }
  });
</script>

<div class="h-screen w-screen flex flex-col bg-slate-100 overflow-hidden font-sans">
  <!-- Top Navigation & File Menu -->
  <Header
    {activeMode}
    meta={currentMeta}
    {memoryUsageMb}
    on:changeMode={(e) => (activeMode = e.detail)}
    on:newDoc={handleNewDoc}
    on:openDoc={handleOpenDoc}
    on:saveDoc={handleSaveDoc}
    on:saveAsDoc={handleSaveAsDoc}
    on:exportMarkdown={handleExportMarkdown}
    on:exportPdf={handleExportPdf}
    on:exportCsv={handleExportCsv}
  />

  <!-- Active Workspace Module -->
  <main class="flex-1 flex overflow-hidden relative">
    {#if activeMode === 'writer'}
      <Writer
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
        bind:workbook={sheetsWorkbook}
        on:change={triggerAutoSave}
        on:updateStats={(e) => {
          sheetsActiveCell = e.detail.activeCell;
          sheetsSelectionSum = e.detail.selectionSum;
        }}
      />
    {:else if activeMode === 'slides'}
      <Slides
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
</div>
