<script lang="ts">
  import { onMount } from 'svelte';
  import type { WorkspaceMode, WriterDocument, SpreadsheetWorkbook, SlideDeck } from './types';
  import Header from './components/layout/Header.svelte';
  import StatusBar from './components/layout/StatusBar.svelte';
  import ShortcutsModal from './components/layout/ShortcutsModal.svelte';
  import CommandPalette from './components/layout/CommandPalette.svelte';
  import type { Command } from './lib/commands';
  import ErrorBoundary from './components/layout/ErrorBoundary.svelte';
  import SettingsModal from './components/layout/SettingsModal.svelte';
  import type { AppSettings } from './types';
  import { loadSettings, DEFAULT_SETTINGS } from './lib/settings';
  import { applyTheme } from './lib/theme';
  import Writer from './components/writer/Writer.svelte';
  import Sheets from './components/sheets/Sheets.svelte';
  import Slides from './components/slides/Slides.svelte';
  import {
    openFileDialogNative,
    saveFileDialogNative,
    readTextFileNative,
    writeTextFileNative,
  } from './lib/tauri';
  import { autoSaver } from './lib/storage';
  import { clearAutoSaveSnapshotNative } from './lib/tauri';
  import { evaluateRecovery, describeSnapshot, type RecoveryDecision } from './lib/recovery';
  import { downloadFile, triggerPrintToPdf, htmlToMarkdown } from './lib/utils';
  import { htmlToPlainText, sanitizeHtml } from './lib/sanitize';
  import {
    exportToDocx,
    exportToRtf,
    exportToXlsx,
    exportToPptxXml,
    parseDocumentContent,
    parseSpreadsheetContent,
    sanitizeImportedSlideDeck,
    sanitizeImportedWriterDocument,
    sanitizeImportedWorkbook
  } from './lib/fileFormats';
  import { recalculateGrid } from './components/sheets/formulaEngine';

  function safeJsonParse(content: string): unknown {
    try {
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  /** Loads a foreign spreadsheet grid and grows the sheet to fit it. */
  function applyImportedGrid(grid: Record<string, any>) {
    let maxRow = 50;
    let maxCol = 26;
    for (const key of Object.keys(grid)) {
      const m = key.match(/^([A-Z]+)(\d+)$/);
      if (!m) continue;
      maxRow = Math.max(maxRow, parseInt(m[2], 10) + 10);
      let col = 0;
      for (const ch of m[1]) col = col * 26 + (ch.charCodeAt(0) - 64);
      maxCol = Math.max(maxCol, col);
    }
    sheetsWorkbook.sheets[0].cells = grid;
    sheetsWorkbook.sheets[0].rowCount = maxRow;
    sheetsWorkbook.sheets[0].colCount = Math.max(maxCol + 4, 35);
  }

  let recovery: (RecoveryDecision & { data?: unknown; module: string; documentId: string }) | null = null;
  let recovering = false;

  /** Offers back autosaved work after a crash, and only when it is genuinely newer. */
  async function checkForRecovery() {
    const candidates: Array<{ module: 'writer' | 'sheets' | 'slides'; documentId: string }> = [
      { module: 'writer', documentId: writerDoc.meta.id },
      { module: 'sheets', documentId: sheetsWorkbook.meta.id },
      { module: 'slides', documentId: slidesDeck.meta.id },
    ];

    for (const candidate of candidates) {
      const snapshot = await autoSaver.recoverLatestSnapshot(candidate.module, candidate.documentId);
      const meta =
        candidate.module === 'writer' ? writerDoc.meta : candidate.module === 'sheets' ? sheetsWorkbook.meta : slidesDeck.meta;
      const decision = evaluateRecovery(snapshot, { lastSavedAt: meta.lastSaved, filePath: meta.filePath });
      if (decision.shouldOffer && snapshot) {
        recovery = { ...decision, data: snapshot.data, module: candidate.module, documentId: candidate.documentId };
        return;
      }
    }
  }

  async function acceptRecovery() {
    if (!recovery?.data) return;
    recovering = true;
    try {
      if (recovery.module === 'writer') {
        writerDoc = sanitizeImportedWriterDocument(recovery.data as Record<string, unknown>, writerDoc.meta);
        activeMode = 'writer';
      } else if (recovery.module === 'sheets') {
        const restored = sanitizeImportedWorkbook(recovery.data, sheetsWorkbook.meta);
        if (restored) sheetsWorkbook = restored;
        activeMode = 'sheets';
      } else {
        const restored = sanitizeImportedSlideDeck(recovery.data, slidesDeck.meta);
        if (restored) slidesDeck = restored;
        activeMode = 'slides';
      }
      triggerAutoSave();
    } finally {
      recovering = false;
      recovery = null;
    }
  }

  async function declineRecovery() {
    if (recovery) {
      try {
        await clearAutoSaveSnapshotNative(recovery.module, recovery.documentId);
      } catch (err) {
        console.warn('Could not clear recovery snapshot:', err);
      }
    }
    recovery = null;
  }

  let activeMode: WorkspaceMode = 'writer';
  let showShortcutsModal = false;
  let showSettingsModal = false;
  let showCommandPalette = false;
  let recentCommandIds: string[] = [];
  let appSettings: AppSettings = loadSettings();

  let stopThemeSync: (() => void) | null = null;

  function syncTheme() {
    stopThemeSync?.();
    stopThemeSync = applyTheme(appSettings.theme);
  }

  onMount(() => {
    appSettings = loadSettings();
    if (appSettings.defaultMode) {
      activeMode = appSettings.defaultMode;
    }
    // Settings now actually drive the UI; before this the theme control was
    // stored but never applied.
    syncTheme();
    void checkForRecovery();
    return () => stopThemeSync?.();
  });

  $: if (appSettings.theme) syncTheme();

  let writerRef: Writer;
  let sheetsRef: Sheets;
  let slidesRef: Slides;
  // Review mode: 'editing' | 'suggesting' | 'viewing'
  let writerEditorMode: 'editing' | 'suggesting' | 'viewing' = 'editing';
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
      <h1>SOS Project Brief</h1>
      <p>Welcome to <strong>SOS Writer</strong>, a local document editor built with Svelte and Tauri. This is an alpha build, so a few things are still prototypes.</p>
      <h2>What works today</h2>
      <ul>
        <li><strong>Typography</strong>: Inter, Arial, Times New Roman, Georgia, Merriweather, JetBrains Mono, Courier New, Trebuchet MS, with sizes, bold, italic, underline, strike, colors, highlights, sub/superscript, and line spacing.</li>
        <li><strong>File formats</strong>: import <strong>.docx (text and basic bold/italic), .md, .txt, .html, .rtf, and suite .sosw</strong>; export Markdown, plain text, HTML, RTF, suite JSON, and a <strong>.docx-named HTML adapter</strong> that is not a binary Word file.</li>
        <li><strong>Document elements</strong>: tables, embedded local images, hyperlinks, dividers, and find &amp; replace.</li>
        <li><strong>Local by default</strong>: your documents stay on this machine. Cloud AI is optional and only used if you configure a provider in Settings.</li>
      </ul>
      <blockquote>&quot;Simplicity is the soul of efficiency.&quot; — Austin Freeman</blockquote>
      <p>Everything runs locally on this machine. Nothing is uploaded unless you configure a cloud AI provider.</p>
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
        title: 'SOS',
        bgColor: '#0f172a',
        elements: [
          {
            id: 'e1',
            type: 'title',
            x: 10,
            y: 20,
            width: 80,
            height: 15,
            content: 'SOS',
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
            content: 'A local-first alpha suite with a small footprint',
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
            content: 'Local-First • Optional Cloud AI • Honest Limits',
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
            content: '• Font & typography selections\\n• Local file adapters: .docx text, .md, .html, .rtf, .csv, .tsv\\n• Formula engine (SUM, AVERAGE, IF, COUNTIF, VLOOKUP, …)\\n• Slide organizer with presenter timer',
            fontSize: 16,
          },
          {
            id: 'e6',
            type: 'code',
            x: 54,
            y: 26,
            width: 38,
            height: 55,
            content: '// Sanitized document HTML\\nexport function toSafeHtml(input) {\\n  return DOMPurify.sanitize(input, CONFIG);\\n}',
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
      : activeMode === 'slides'
      ? slidesDeck.meta
      : slidesDeck.meta;

  function triggerAutoSave() {
    currentMeta.isDirty = true;
    if (activeMode === 'writer') {
      autoSaver.scheduleAutoSave('writer', writerDoc.meta.id, writerDoc);
    } else if (activeMode === 'sheets') {
      autoSaver.scheduleAutoSave('sheets', sheetsWorkbook.meta.id, sheetsWorkbook);
    } else if (activeMode === 'slides') {
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
    } else if (activeMode === 'slides') {
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
        name: 'All Supported Formats (*.docx, *.xlsx, *.pptx, *.csv, *.md, *.txt, *.json)',
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

      // Auto-detect mode based on file format or parsed payload
      if (['xlsx', 'xls', 'csv', 'tsv', 'soss'].includes(ext || '') || (content.startsWith('{') && content.includes('"cells":'))) {
        activeMode = 'sheets';
        if (content.startsWith('{') && content.includes('"cells":')) {
          // A native workbook keeps formatting, merges, validation, charts and
          // frozen panes; a foreign file only contributes its cell grid.
          const sanitized = sanitizeImportedWorkbook(safeJsonParse(content), sheetsWorkbook.meta);
          if (sanitized) {
            sheetsWorkbook = sanitized;
          } else {
            applyImportedGrid(parseSpreadsheetContent(content, selectedPath));
          }
        } else {
          applyImportedGrid(parseSpreadsheetContent(content, selectedPath));
        }
        sheetsWorkbook.meta.filePath = selectedPath;
        if (!content.startsWith('{')) {
          sheetsWorkbook.meta.title = selectedPath.split('/').pop()?.replace(/\.[^/.]+$/, '') || 'Spreadsheet';
        }
        sheetsWorkbook.meta.isDirty = false;
        sheetsWorkbook.meta.lastSaved = new Date().toISOString();
      } else if (['pptx', 'odp', 'sosp'].includes(ext || '')) {
        activeMode = 'slides';
        let importedDeck: SlideDeck | null = null;
        try {
          importedDeck = sanitizeImportedSlideDeck(JSON.parse(content), slidesDeck.meta);
        } catch {
          importedDeck = null;
        }
        if (importedDeck) {
          slidesDeck = importedDeck;
        } else {
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
            writerDoc = sanitizeImportedWriterDocument(JSON.parse(content), writerDoc.meta);
          } catch {
            writerDoc.contentHtml = sanitizeHtml(content);
          }
        } else {
          writerDoc.contentHtml = parseDocumentContent(content, selectedPath);
        }
        writerDoc.contentHtml = sanitizeHtml(writerDoc.contentHtml);
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
        payload = htmlToPlainText(writerDoc.contentHtml);
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
    } else if (activeMode === 'slides') {
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
      const data = htmlToPlainText(writerDoc.contentHtml);
      downloadFile(`${baseName}.txt`, data, 'text/plain');
    } else if (fmt === 'html') {
      downloadFile(`${baseName}.html`, sanitizeHtml(writerDoc.contentHtml), 'text/html');
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

  let uiZoom = 100;
  let isFullscreen = false;

  const ZOOM_STEPS = [50, 67, 75, 90, 100, 110, 125, 150, 175, 200, 300];

  function applyZoom(next: number) {
    uiZoom = Math.min(300, Math.max(50, Math.round(next)));
  }

  function handleZoomIn() {
    const next = ZOOM_STEPS.find((z) => z > uiZoom) ?? ZOOM_STEPS[ZOOM_STEPS.length - 1];
    applyZoom(next);
  }

  function handleZoomOut() {
    const next = [...ZOOM_STEPS].reverse().find((z) => z < uiZoom) ?? ZOOM_STEPS[0];
    applyZoom(next);
  }

  function handleZoomReset() {
    applyZoom(100);
  }

  async function handleToggleFullscreen() {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        isFullscreen = true;
      } else {
        await document.exitFullscreen();
        isFullscreen = false;
      }
    } catch {
      isFullscreen = false;
    }
  }

  function handleFullscreenChange() {
    isFullscreen = Boolean(document.fullscreenElement);
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

  function handleRibbonAction(e: CustomEvent<{ action: string; payload?: any }>) {
    const { action, payload } = e.detail;

    if (action === 'zoomIn') return handleZoomIn();
    if (action === 'zoomOut') return handleZoomOut();
    if (action === 'zoomReset') return handleZoomReset();
    if (action === 'toggleFullscreen') return handleToggleFullscreen();

    if (activeMode === 'writer') {
      if (['bold', 'italic', 'underline', 'strike'].includes(action)) {
        document.execCommand(action === 'strike' ? 'strikeThrough' : action, false);
      } else if (action === 'align') {
        const cmd = payload === 'center' ? 'justifyCenter' : payload === 'right' ? 'justifyRight' : payload === 'justify' ? 'justifyFull' : 'justifyLeft';
        document.execCommand(cmd, false);
      } else if (action === 'bullet') {
        document.execCommand('insertUnorderedList', false);
      } else if (action === 'ordered') {
        document.execCommand('insertOrderedList', false);
      } else if (action === 'checklist') {
        writerRef?.insertChecklist();
      } else if (action === 'insertTable') {
        writerRef?.insertTable();
      } else if (action === 'insertImage') {
        writerRef?.insertImage();
      } else if (action === 'insertLink') {
        writerRef?.insertLink();
      } else if (action === 'insertCallout') {
        writerRef?.insertCallout();
      } else if (action === 'insertToc') {
        writerRef?.insertTableOfContents();
      } else if (action === 'toggleOutline') {
        writerRef?.toggleOutline();
      } else if (action === 'pageSetup') {
        writerRef?.openPageSetup();
      } else if (action === 'wordCount') {
        writerRef?.openWordCount();
      } else if (action === 'insertText') {
        document.execCommand('insertText', false, payload);
      } else if (action === 'orientation') {
        writerRef?.setPageSetup({ orientation: payload });
      } else if (action === 'pageSize') {
        writerRef?.setPageSetup({ size: payload });
      } else if (action === 'columns') {
        writerRef?.setColumns(Number(payload));
      } else if (action === 'insertFootnote') {
        writerRef?.insertFootnote();
      } else if (action === 'insertCitation') {
        writerRef?.insertCitation();
      } else if (action === 'addComment') {
        writerRef?.addComment();
      } else if (action === 'openComments') {
        writerRef?.openCommentsDrawer();
      } else if (action === 'versionHistory') {
        writerRef?.openVersionHistory();
      } else if (action === 'watermarkDialog') {
        writerRef?.openWatermarkDialog();
      } else if (action === 'specialChars') {
        writerRef?.openSpecialCharacters();
      } else if (action === 'trackChanges') {
        writerRef?.toggleTrackChanges();
      } else if (action === 'watermark') {
        writerRef?.toggleWatermark();
      } else if (action === 'protectDoc') {
        writerRef?.setProtected(true);
      } else if (action === 'lockReadOnly') {
        writerRef?.setReadOnly(true);
      } else if (action === 'insertChecklist') {
        writerRef?.insertChecklist();
      } else if (action === 'insertCallout') {
        writerRef?.insertCallout(payload);
      } else if (action === 'insertCodeBlock') {
        writerRef?.insertCodeBlock();
      } else if (action === 'insertHighlight') {
        writerRef?.insertHighlight();
      } else if (action === 'suggestDelete') {
        writerRef?.suggestDelete();
      } else if (action === 'clearFormat') {
        document.execCommand('removeFormat', false);
      } else if (action === 'fontFamily') {
        writerRef?.execFormat('fontName', payload);
      } else if (action === 'fontSize') {
        writerRef?.execFormat('fontSize', payload);
      } else if (action === 'growFont' || action === 'shrinkFont') {
        writerRef?.stepFontSize(action === 'growFont' ? 1 : -1);
      } else if (action === 'textColor') {
        writerRef?.execFormat('foreColor', payload);
      } else if (action === 'highlightColor') {
        writerRef?.execFormat('hiliteColor', payload);
      } else if (action === 'sub' || action === 'sup') {
        document.execCommand(action === 'sub' ? 'subscript' : 'superscript', false);
      } else if (action === 'indent') {
        document.execCommand('indent', false);
      } else if (action === 'outdent') {
        document.execCommand('outdent', false);
      } else if (action === 'lineSpacing') {
        writerRef?.setLineSpacing(payload);
      } else if (action === 'insertDivider') {
        writerRef?.insertDivider();
      } else if (action === 'insertDate') {
        writerRef?.insertDate();
      } else if (action === 'find') {
        writerRef?.openFind();
      } else if (action === 'replace') {
        writerRef?.openFind(true);
      } else if (action === 'pageBreak') {
        writerRef?.insertPageBreak();
      }
    } else if (activeMode === 'sheets') {
      if (action === 'bold') sheetsRef?.toggleBold();
      else if (action === 'italic') sheetsRef?.toggleItalic();
      else if (action === 'underline') sheetsRef?.toggleUnderline();
      else if (action === 'autoSum') sheetsRef?.insertFormula('SUM');
      else if (action === 'formulaQuick') sheetsRef?.insertFormula(payload);
      else if (action === 'insertChart') sheetsRef?.openChartDialog();
      else if (action === 'conditionalFormatting') sheetsRef?.openConditionalFormatting();
      else if (action === 'sortAsc') sheetsRef?.sortActiveColumn(true);
      else if (action === 'sortDesc') sheetsRef?.sortActiveColumn(false);
      else if (action === 'insertRowAbove') sheetsRef?.insertRow(true);
      else if (action === 'insertRowBelow') sheetsRef?.insertRow(false);
      else if (action === 'deleteRow') sheetsRef?.deleteCurrentRow();
      else if (action === 'insertColLeft') sheetsRef?.insertColumn(true);
      else if (action === 'insertColRight') sheetsRef?.insertColumn(false);
      else if (action === 'deleteCol') sheetsRef?.deleteCurrentColumn();
      else if (action === 'find') sheetsRef?.toggleFindBar();
      else if (action === 'insertFx') {
        const fxBtn = document.querySelector('button[title*="Insert Function"]') as HTMLButtonElement;
        if (fxBtn) fxBtn.click();
      } else if (action === 'importFile') {
        sheetsRef?.handleImportSpreadsheet();
      } else if (action === 'insertText') {
        sheetsRef?.commitValue(sheetsActiveCell, payload);
      } else if (action === 'toggleFilter') {
        sheetsRef?.toggleFilter();
      } else if (action === 'recalculate') {
        sheetsRef?.recalculate();
      } else if (action === 'openCalculator') {
        sheetsRef?.openCalculator();
      } else if (action === 'mergeCells') {
        sheetsRef?.mergeCells();
      } else if (action === 'freezeHeader') {
        sheetsRef?.toggleFreezeHeader();
      } else if (action === 'numberFormat') {
        sheetsRef?.applyNumberFormat(payload);
      } else if (action === 'wrapText') {
        sheetsRef?.toggleWrapText();
      } else if (action === 'alignCell') {
        sheetsRef?.setCellAlign(payload);
      } else if (action === 'textColor') {
        sheetsRef?.applyTextColor(payload);
      } else if (action === 'fillColor') {
        sheetsRef?.applyFillColor(payload);
      } else if (action === 'insertBorder') {
        sheetsRef?.applyBorder(payload);
      } else if (action === 'dataValidation') {
        sheetsRef?.openDataValidation();
      }
    } else if (activeMode === 'slides') {
      if (action === 'newSlide') slidesRef?.addNewSlide();
      else if (action === 'present') slidesRef?.startPresenting();
      else if (action === 'slideTheme') slidesRef?.setTheme(payload);
      else if (action === 'aspectRatio') slidesDeck.aspectRatio = payload;
      else if (action === 'transition') slidesRef?.setTransition(payload);
      else if (action === 'duplicateSlide') slidesRef?.duplicateSlide();
      else if (action === 'deleteSlide') slidesRef?.deleteCurrentSlide();
      else if (action === 'insertTextBox') slidesRef?.insertElement('text');
      else if (action === 'insertShape') slidesRef?.insertElement('shape');
      else if (action === 'insertStat') slidesRef?.insertElement('stat');
      else if (action === 'insertImage') slidesRef?.insertImage();
      else if (action === 'insertNotes') slidesRef?.focusNotes();
      else if (action === 'alignElement') slidesRef?.alignSelected(payload);
      else if (action === 'elementAnimation') slidesRef?.setElementAnimation(payload);
      else if (action === 'animationDelay') slidesRef?.setAnimationDelay(Number(payload));
      else if (action === 'animationAutoPlay') slidesRef?.toggleAutoPlayAnimation();
      else if (action === 'clearAnimations') slidesRef?.clearAnimations();
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

    // Settings shortcut: Cmd+, or Ctrl+,
    if (mod && e.key === ',') {
      e.preventDefault();
      showSettingsModal = !showSettingsModal;
    }

    // Keyboard Shortcuts cheat sheet: Cmd+/ or Ctrl+/
    if (mod && (e.key === '/' || e.key === '?')) {
      e.preventDefault();
      showShortcutsModal = !showShortcutsModal;
    }

    // Command palette: Cmd+K / Ctrl+K
    if (mod && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      showCommandPalette = !showCommandPalette;
    }
  }

  const PALETTE_COMMANDS: Command[] = [
    { id: 'file.new', title: 'New document', category: 'File', priority: 1, keywords: ['create', 'blank'] },
    { id: 'file.open', title: 'Open…', category: 'File', priority: 2, keywords: ['browse', 'load'] },
    { id: 'file.save', title: 'Save', category: 'File', priority: 3, keywords: ['write', 'store'] },
    { id: 'file.saveAs', title: 'Save as…', category: 'File', priority: 4, keywords: ['duplicate', 'copy'] },
    { id: 'file.print', title: 'Print', category: 'File', priority: 5, keywords: ['pdf', 'paper'] },

    { id: 'view.writer', title: 'Switch to Writer', category: 'View', priority: 20, keywords: ['document', 'word', 'text'] },
    { id: 'view.sheets', title: 'Switch to Sheets', category: 'View', priority: 21, keywords: ['spreadsheet', 'excel', 'cells'] },
    { id: 'view.slides', title: 'Switch to Slides', category: 'View', priority: 22, keywords: ['presentation', 'deck', 'powerpoint'] },

    { id: 'view.theme.dark', title: 'Theme: Dark', category: 'View', priority: 30, keywords: ['appearance', 'glass', 'night'] },
    { id: 'view.theme.light', title: 'Theme: Light', category: 'View', priority: 31, keywords: ['appearance', 'day', 'bright'] },
    { id: 'view.theme.system', title: 'Theme: Match system', category: 'View', priority: 32, keywords: ['appearance', 'auto', 'os'] },

    { id: 'file.settings', title: 'Open settings', category: 'Preferences', priority: 40, keywords: ['preferences', 'options', 'config'] },
    { id: 'file.shortcuts', title: 'Keyboard shortcuts', category: 'Help', priority: 41, keywords: ['keys', 'bindings', 'cheatsheet'] },
  ];

  function runCommand(command: Command) {
    if (!command) {
      showCommandPalette = false;
      return;
    }
    recentCommandIds = [command.id, ...recentCommandIds.filter((id) => id !== command.id)].slice(0, 8);
    showCommandPalette = false;
    COMMAND_ACTIONS[command.id]?.();
  }

  // Registry for the palette. Anything not listed here is simply omitted from
  // the palette rather than rendered as a no-op row.
  const COMMAND_ACTIONS: Record<string, () => void> = {
    'file.new': handleNewDoc,
    'file.open': handleOpenDoc,
    'file.save': handleSaveDoc,
    'file.saveAs': handleSaveAsDoc,
    'file.print': handlePrintPdf,
    'file.settings': () => (showSettingsModal = true),
    'file.shortcuts': () => (showShortcutsModal = true),
    'view.writer': () => (activeMode = 'writer'),
    'view.sheets': () => (activeMode = 'sheets'),
    'view.slides': () => (activeMode = 'slides'),
    'view.theme.dark': () => (appSettings = { ...appSettings, theme: 'dark' }),
    'view.theme.light': () => (appSettings = { ...appSettings, theme: 'light' }),
    'view.theme.system': () => (appSettings = { ...appSettings, theme: 'system' }),
  };

  $: paletteCommands = PALETTE_COMMANDS.filter((c) => c.id in COMMAND_ACTIONS);
</script>

<svelte:window on:keydown={handleGlobalKeydown} on:fullscreenchange={handleFullscreenChange} />

<div class="lg-grain h-screen w-screen flex flex-col overflow-hidden font-sans text-[color:var(--lg-text)]">
  <div class="lg-aurora" aria-hidden="true"></div>
  <!-- Top OnlyOffice Style Navigation & File Ribbon Actions -->
  <Header
    {activeMode}
    meta={currentMeta}
    settings={appSettings}
    zoom={uiZoom}
    on:changeMode={(e) => (activeMode = e.detail)}
    on:newDoc={handleNewDoc}
    on:openDoc={handleOpenDoc}
    on:saveDoc={handleSaveDoc}
    on:saveAsDoc={handleSaveAsDoc}
    on:exportFormat={handleExportFormat}
    on:printPdf={handlePrintPdf}
    on:openShortcuts={() => (showShortcutsModal = true)}
    on:openSettings={() => (showSettingsModal = true)}
    on:undo={handleUndo}
    on:redo={handleRedo}
    on:ribbonAction={handleRibbonAction}
  />

  <!-- Active Workspace Module -->
  <ErrorBoundary on:recover={() => (activeMode = activeMode)}>
  <main class="flex-1 flex overflow-hidden relative">
    <div class="flex-1 flex overflow-hidden origin-top-left" style={`transform: scale(${uiZoom / 100}); width: ${10000 / uiZoom}%; height: ${10000 / uiZoom}%`}>
    {#if activeMode === 'writer'}
      <Writer
        bind:this={writerRef}
        meta={writerDoc.meta}
        bind:contentHtml={writerDoc.contentHtml}
        bind:pageSetup={writerDoc.pageSetup}
        bind:showWatermark={writerDoc.watermark}
        bind:watermarkOptions={writerDoc.watermarkOptions}
        bind:comments={writerDoc.comments}
        bind:versions={writerDoc.versions}
        bind:editorMode={writerEditorMode}
        on:watermarkChange={() => triggerAutoSave()}
        on:watermarkOptionsChange={() => triggerAutoSave()}
        on:commentsChange={() => triggerAutoSave()}
        on:versionsChange={() => triggerAutoSave()}
        on:editorModeChange={(e) => (writerEditorMode = e.detail.mode)}
        on:pageSetupChange={() => triggerAutoSave()}
        on:columnCountChange={() => triggerAutoSave()}
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
    </div>
  </main>
  </ErrorBoundary>

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
    zoom={uiZoom}
    fullscreen={isFullscreen}
  />

  <!-- ⌘K Command Palette -->
  {#if showCommandPalette}
    <CommandPalette
      commands={paletteCommands}
      recentIds={recentCommandIds}
      on:select={(e) => runCommand(e.detail)}
    />
  {/if}

  <!-- Keyboard Shortcuts Cheat Sheet Modal -->
  {#if showShortcutsModal}
    {#if recovery}
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true">
      <div class="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-5 text-slate-700 shadow-2xl">
        <h3 class="text-sm font-semibold text-slate-900">{recovery.label}</h3>
        <p class="mt-1.5 text-[11px] leading-relaxed text-slate-600">
          An autosave from a previous session is newer than anything saved to disk
          ({describeSnapshot(recovery.data)}). Restore it, or discard it and keep the current document.
        </p>
        <div class="mt-5 flex items-center justify-end gap-2">
          <button
            class="px-3 py-1.5 rounded-md border border-slate-300 text-xs font-medium hover:bg-slate-50"
            on:click={declineRecovery}
          >
            Discard
          </button>
          <button
            class="px-3 py-1.5 rounded-md bg-slate-900 text-white text-xs font-medium hover:bg-slate-700 disabled:opacity-50"
            disabled={recovering}
            on:click={acceptRecovery}
          >
            {recovering ? 'Restoring...' : 'Restore'}
          </button>
        </div>
      </div>
    </div>
  {/if}

  <ShortcutsModal on:close={() => (showShortcutsModal = false)} />
  {/if}

  <!-- Application Settings Modal -->
  {#if showSettingsModal}
    <SettingsModal
      bind:settings={appSettings}
      on:close={() => (showSettingsModal = false)}
      on:save={(e) => {
        appSettings = e.detail;
      }}
      on:reset={() => {
        appSettings = { ...DEFAULT_SETTINGS };
      }}
    />
  {/if}
</div>
