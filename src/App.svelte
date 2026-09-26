<script lang="ts">
  import { onMount } from 'svelte';
  import type { WorkspaceMode, DocumentMeta, WriterDocument, SpreadsheetWorkbook, SlideDeck, PdfDocument } from './types';
  import Header from './components/layout/Header.svelte';
  import StatusBar from './components/layout/StatusBar.svelte';
  import ShortcutsModal from './components/layout/ShortcutsModal.svelte';
  import SettingsModal from './components/layout/SettingsModal.svelte';
  import type { AppSettings } from './types';
  import { loadSettings, DEFAULT_SETTINGS } from './lib/settings';
  import Writer from './components/writer/Writer.svelte';
  import Sheets from './components/sheets/Sheets.svelte';
  import Slides from './components/slides/Slides.svelte';
  import PdfViewer from './components/pdf/PdfViewer.svelte';
  import EmailClient from './components/email/EmailClient.svelte';
  import Communicator from './components/communicator/Communicator.svelte';
  import {
    openFileDialogNative,
    saveFileDialogNative,
    readTextFileNative,
    writeTextFileNative,
    openDetachedCommunicatorNative
  } from './lib/tauri';
  import { autoSaver } from './lib/storage';
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
    sanitizeImportedWriterDocument
  } from './lib/fileFormats';
  import { recalculateGrid } from './components/sheets/formulaEngine';

  let activeMode: WorkspaceMode = 'writer';
  let showShortcutsModal = false;
  let showSettingsModal = false;
  let appSettings: AppSettings = loadSettings();

  onMount(() => {
    appSettings = loadSettings();
    if (appSettings.defaultMode) {
      activeMode = appSettings.defaultMode;
    }
  });

  let isStandaloneCommunicator = typeof window !== 'undefined' && window.location.search.includes('mode=communicator');

  let writerRef: Writer;
  let sheetsRef: Sheets;
  let slidesRef: Slides;
  let pdfRef: PdfViewer;
  let emailRef: EmailClient;
  let communicatorRef: Communicator;

  let communicatorChannel = '#general';
  let communicatorMeta: DocumentMeta = {
    id: 'doc_comm_1',
    title: 'Teams — Simple Communicator',
    isDirty: false,
    mode: 'communicator' as WorkspaceMode,
  };

  // Active email stats
  let emailTotal = 5;
  let emailUnread = 1;
  let emailFolder = 'INBOX';
  let emailMeta: DocumentMeta = {
    id: 'doc_email_1',
    title: 'Inbox — Simple Office Mail',
    isDirty: false,
    mode: 'email' as WorkspaceMode,
  };

  // Active status bar statistics
  let writerWordCount = 48;
  let writerCharCount = 312;
  let sheetsActiveCell = 'B5';
  let sheetsSelectionSum: number | null = 14500;
  let slidesIndex = 0;
  let slidesTotal = 3;
  let pdfPage = 1;
  let pdfTotalPages = 1;

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
      <p>Welcome to <strong>SOS Writer</strong>, a local document editor built with Svelte and Tauri. This is an alpha build, so a few things are still prototypes.</p>
      <h2>What works today</h2>
      <ul>
        <li><strong>Typography</strong>: Inter, Arial, Times New Roman, Georgia, Merriweather, JetBrains Mono, Courier New, Trebuchet MS, with sizes, bold, italic, underline, strike, colors, highlights, sub/superscript, and line spacing.</li>
        <li><strong>File formats</strong>: import <strong>.docx (text and basic bold/italic), .md, .txt, .html, .rtf, and suite .sosw</strong>; export Markdown, plain text, HTML, RTF, suite JSON, and a <strong>.docx-named HTML adapter</strong> that is not a binary Word file.</li>
        <li><strong>Document elements</strong>: tables, embedded local images, hyperlinks, dividers, and find &amp; replace.</li>
        <li><strong>Local by default</strong>: your documents stay on this machine. Cloud AI is optional and only used if you configure a provider in Settings.</li>
      </ul>
      <blockquote>&quot;Simplicity is the soul of efficiency.&quot; — Austin Freeman</blockquote>
      <p>Mail and Communicator are local demo modules with no mail or chat server behind them.</p>
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

  let pdfDoc: PdfDocument = {
    meta: {
      id: 'doc_pdf_1',
      title: 'Contract Agreement Form',
      isDirty: false,
      mode: 'pdf',
    },
    title: 'Standard Service Agreement & Form',
    pageCount: 2,
    currentPage: 1,
    textContent: 'This Agreement is entered into as of the Effective Date by and between the Client and the Provider. Both parties mutually agree to the terms, deliverables, and conditions set forth herein.',
    formFields: [
      {
        id: 'f1',
        type: 'text',
        name: 'Full Name',
        value: 'Jane Doe',
        x: 15,
        y: 35,
        width: 40,
        height: 5,
        page: 1,
      },
      {
        id: 'f2',
        type: 'checkbox',
        name: 'I Accept Terms',
        value: true,
        x: 15,
        y: 45,
        width: 30,
        height: 4,
        page: 1,
      },
      {
        id: 'f3',
        type: 'signature',
        name: 'Authorized Signature',
        value: 'Jane Doe (Signed)',
        x: 15,
        y: 55,
        width: 45,
        height: 6,
        page: 1,
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
      : activeMode === 'pdf'
      ? pdfDoc.meta
      : activeMode === 'email'
      ? emailMeta
      : communicatorMeta;

  function triggerAutoSave() {
    currentMeta.isDirty = true;
    if (activeMode === 'writer') {
      autoSaver.scheduleAutoSave('writer', writerDoc.meta.id, writerDoc);
    } else if (activeMode === 'sheets') {
      autoSaver.scheduleAutoSave('sheets', sheetsWorkbook.meta.id, sheetsWorkbook);
    } else if (activeMode === 'slides') {
      autoSaver.scheduleAutoSave('slides', slidesDeck.meta.id, slidesDeck);
    } else {
      autoSaver.scheduleAutoSave('pdf', pdfDoc.meta.id, pdfDoc);
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
    } else {
      pdfDoc = {
        meta: { id: `pdf_${timestamp}`, title: 'Untitled Form', isDirty: false, mode: 'pdf' },
        title: 'Untitled Document Form',
        pageCount: 1,
        currentPage: 1,
        textContent: '',
        formFields: [],
      };
    }
  }

  async function handleOpenDoc() {
    const filters = [
      {
        name: 'All Office Formats (*.docx, *.xlsx, *.pptx, *.pdf, *.csv, *.md, *.txt, *.json)',
        extensions: ['docx', 'doc', 'xlsx', 'xls', 'pptx', 'pdf', 'csv', 'tsv', 'md', 'txt', 'html', 'rtf', 'json', 'sosw', 'soss', 'sosp'],
      },
      { name: 'Word Documents (*.docx, *.doc, *.rtf, *.odt)', extensions: ['docx', 'doc', 'rtf', 'odt', 'txt', 'md'] },
      { name: 'Excel Spreadsheets (*.xlsx, *.xls, *.csv, *.tsv)', extensions: ['xlsx', 'xls', 'csv', 'tsv'] },
      { name: 'PowerPoint Presentations (*.pptx, *.odp)', extensions: ['pptx', 'odp'] },
      { name: 'PDF Documents (*.pdf)', extensions: ['pdf'] },
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
      } else if (ext === 'pdf') {
        activeMode = 'pdf';
        pdfDoc.meta.filePath = selectedPath;
        pdfDoc.meta.title = selectedPath.split('/').pop()?.replace(/\.[^/.]+$/, '') || 'PDF Document';
        pdfDoc.title = pdfDoc.meta.title;
        pdfDoc.textContent = content.slice(0, 5000);
        pdfDoc.meta.isDirty = false;
        pdfDoc.meta.lastSaved = new Date().toISOString();
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
    else if (activeMode === 'pdf') ext = 'pdf';

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
    } else {
      payload = JSON.stringify(pdfDoc, null, 2);
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
      const payload = activeMode === 'writer' ? writerDoc : activeMode === 'sheets' ? sheetsWorkbook : activeMode === 'slides' ? slidesDeck : pdfDoc;
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

  function handleRibbonAction(e: CustomEvent<{ action: string; payload?: any }>) {
    const { action, payload } = e.detail;

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
      } else if (action === 'insertTable') {
        writerRef?.insertTable();
      } else if (action === 'insertImage') {
        writerRef?.insertImage();
      } else if (action === 'insertLink') {
        writerRef?.insertLink();
      } else if (action === 'insertText') {
        document.execCommand('insertText', false, payload);
      }
    } else if (activeMode === 'sheets') {
      if (action === 'bold') sheetsRef?.toggleBold();
      else if (action === 'italic') sheetsRef?.toggleItalic();
      else if (action === 'underline') sheetsRef?.toggleUnderline();
      else if (action === 'autoSum') sheetsRef?.insertFormula('SUM');
      else if (action === 'formulaQuick') sheetsRef?.insertFormula(payload);
      else if (action === 'insertFx') {
        const fxBtn = document.querySelector('button[title*="Insert Function"]') as HTMLButtonElement;
        if (fxBtn) fxBtn.click();
      } else if (action === 'importFile') {
        sheetsRef?.handleImportSpreadsheet();
      } else if (action === 'insertText') {
        sheetsRef?.commitValue(sheetsActiveCell, payload);
      }
    } else if (activeMode === 'slides') {
      if (action === 'newSlide') slidesRef?.addNewSlide();
      else if (action === 'present') slidesRef?.startPresenting();
      else if (action === 'slideTheme') slidesRef?.setTheme(payload);
      else if (action === 'aspectRatio') slidesDeck.aspectRatio = payload;
    } else if (activeMode === 'pdf') {
      if (action === 'addTextField') pdfRef?.addFormField('text');
      else if (action === 'addCheckboxField') pdfRef?.addFormField('checkbox');
      else if (action === 'addSignatureField') pdfRef?.addFormField('signature');
      else if (action === 'exportFormData') pdfRef?.exportFormData();
      else if (action === 'print') triggerPrintToPdf(pdfDoc.title);
    } else if (activeMode === 'email') {
      emailRef?.triggerRibbonAction(action, payload);
    } else if (activeMode === 'communicator') {
      communicatorRef?.triggerRibbonAction(action, payload);
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
      } else if (e.key === '4') {
        e.preventDefault();
        activeMode = 'pdf';
      } else if (e.key === '5') {
        e.preventDefault();
        activeMode = 'email';
      } else if (e.key === '6') {
        e.preventDefault();
        activeMode = 'communicator';
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
  }
</script>

<svelte:window on:keydown={handleGlobalKeydown} />

{#if isStandaloneCommunicator}
  <div class="h-screen w-screen flex flex-col bg-[#141517] overflow-hidden font-sans">
    <Communicator
      settings={appSettings}
      isStandaloneWindow={true}
      on:openOfficeDoc={() => {
        window.open('index.html', '_blank');
      }}
    />
  </div>
{:else}
<div class="h-screen w-screen flex flex-col bg-slate-100 overflow-hidden font-sans">
  <!-- Top OnlyOffice Style Navigation & File Ribbon Actions -->
  <Header
    {activeMode}
    meta={currentMeta}
    settings={appSettings}
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
    {:else if activeMode === 'pdf'}
      <PdfViewer
        bind:this={pdfRef}
        bind:doc={pdfDoc}
        on:change={triggerAutoSave}
        on:updateStats={(e) => {
          pdfPage = e.detail.page;
          pdfTotalPages = e.detail.totalPages;
        }}
      />
    {:else if activeMode === 'email'}
      <EmailClient
        bind:this={emailRef}
        settings={appSettings}
        on:updateStats={(e) => {
          emailTotal = e.detail.total;
          emailUnread = e.detail.unread;
          emailFolder = e.detail.activeFolder;
        }}
      />
    {:else if activeMode === 'communicator'}
      <Communicator
        bind:this={communicatorRef}
        settings={appSettings}
        isStandaloneWindow={false}
        on:updateStats={(e) => {
          communicatorChannel = e.detail.activeChannel;
        }}
        on:detachWindow={openDetachedCommunicatorNative}
        on:openOfficeDoc={(e) => {
          const t = e.detail.type;
          if (t === 'docx') activeMode = 'writer';
          else if (t === 'xlsx') activeMode = 'sheets';
          else if (t === 'pptx') activeMode = 'slides';
          else if (t === 'pdf') activeMode = 'pdf';
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
    {pdfPage}
    {pdfTotalPages}
    {emailTotal}
    {emailUnread}
    {emailFolder}
    communicatorChannel={communicatorChannel}
    communicatorOnline={4}
  />

  <!-- Keyboard Shortcuts Cheat Sheet Modal -->
  {#if showShortcutsModal}
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
{/if}
