<script lang="ts">
  import { onMount } from 'svelte';
  import type { WorkspaceMode, WriterDocument, SpreadsheetWorkbook, SlideDeck, PdfDocument, FormDocument } from './types';
  import Header from './components/layout/Header.svelte';
  import StatusBar from './components/layout/StatusBar.svelte';
  import ShortcutsModal from './components/layout/ShortcutsModal.svelte';
  import SettingsModal from './components/layout/SettingsModal.svelte';
  import CommandPalette from './components/layout/CommandPalette.svelte';
  import DocumentTabs from './components/layout/DocumentTabs.svelte';
  import type { OpenTab } from './types';
  import FileBackstageModal from './components/layout/FileBackstageModal.svelte';
  import type { OfficeTemplate } from './lib/templates';
  import type { AppSettings } from './types';
  import { loadSettings, saveSettings, DEFAULT_SETTINGS } from './lib/settings';
  import Writer from './components/writer/Writer.svelte';
  import Sheets from './components/sheets/Sheets.svelte';
  import Slides from './components/slides/Slides.svelte';
  import PdfViewer from './components/pdf/PdfViewer.svelte';
  import Forms from './components/forms/Forms.svelte';
  import DriveHub from './components/drive/DriveHub.svelte';
  import GeminiSidePanel from './components/layout/GeminiSidePanel.svelte';
  import {
    openFileDialogNative,
    saveFileDialogNative,
    readTextFileNative,
    writeTextFileNative,
    listenNativeMenuEvents
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
  let showSettingsModal = false;
  let showCommandPalette = false;
  let showFileBackstage = false;
  let showGeminiSidePanel = false;

  let openTabs: OpenTab[] = [
    { id: "doc_writer_1", title: "Untitled Document", mode: "writer", isDirty: false },
  ];

  let activeTabId: string = "doc_writer_1";

  function handleSwitchMode(mode: WorkspaceMode, targetTabId?: string) {
    activeMode = mode;

    if (targetTabId) {
      activeTabId = targetTabId;
    } else {
      let tab = openTabs.find((t) => t.mode === mode);
      if (!tab) {
        const newId = `doc_${mode}_${Date.now()}`;
        const title =
          mode === "drive" ? "Files" :
          mode === "writer" ? (writerDoc?.meta?.title || "Untitled Document") :
          mode === "sheets" ? (sheetsWorkbook?.meta?.title || "Untitled Spreadsheet") :
          mode === "slides" ? (slidesDeck?.meta?.title || "Untitled Presentation") :
          mode === "pdf" ? (pdfDoc?.meta?.title || "Document.pdf") :
          (formDoc?.meta?.title || "Untitled Form");

        tab = {
          id: newId,
          title,
          mode,
          isDirty: false,
        };
        openTabs = [...openTabs, tab];
      }
      activeTabId = tab.id;
    }
  }

  function handleSelectTab(e: CustomEvent<{ id: string; mode: WorkspaceMode }>) {
    handleSwitchMode(e.detail.mode, e.detail.id);
  }

  function handleCloseTab(e: CustomEvent<{ id: string }>) {
    if (openTabs.length <= 1) return;
    const tabToClose = openTabs.find((t) => t.id === e.detail.id);
    openTabs = openTabs.filter((t) => t.id !== e.detail.id);
    if (tabToClose && activeTabId === tabToClose.id) {
      const nextTab = openTabs[openTabs.length - 1];
      if (nextTab) {
        handleSwitchMode(nextTab.mode, nextTab.id);
      }
    }
  }

  function handleNewTab(e: CustomEvent<{ mode: WorkspaceMode }>) {
    const mode = e.detail.mode;
    const newId = `doc_${mode}_${Date.now()}`;
    const newTab: OpenTab = {
      id: newId,
      title:
        mode === "writer" ? "Untitled Document" :
        mode === "sheets" ? "Untitled Spreadsheet" :
        mode === "slides" ? "Untitled Presentation" :
        mode === "pdf" ? "Untitled PDF" :
        mode === "forms" ? "Untitled Form" :
        "New Workspace",
      mode,
      isDirty: false,
    };
    openTabs = [...openTabs, newTab];
    handleSwitchMode(mode, newId);
  }
  let appSettings: AppSettings = loadSettings();

  onMount(() => {
    appSettings = loadSettings();
    if (appSettings.defaultMode) {
      activeMode = appSettings.defaultMode;
    }

    // Safely listen to native macOS system menu bar events
    let unlistenFn: (() => void) | null = null;
    listenNativeMenuEvents((id) => {
      if (id === "settings") {
        showSettingsModal = true;
      } else if (id === "command_palette") {
        showCommandPalette = true;
      } else if (id === "shortcuts") {
        showShortcutsModal = true;
      } else if (id === "new_doc") {
        handleNewDoc();
      } else if (id === "open_doc") {
        handleOpenDoc();
      } else if (id === "save_doc") {
        handleSaveDoc();
      } else if (id === "save_as_doc") {
        handleSaveAsDoc();
      } else if (id === "print_doc") {
        handlePrintPdf();
      } else if (id.startsWith("mode_")) {
        const mode = id.replace("mode_", "") as WorkspaceMode;
        handleSwitchMode(mode);
      }
    }).then((unlisten) => {
      unlistenFn = unlisten;
    }).catch(() => {});

    return () => {
      if (unlistenFn) unlistenFn();
    };
  });

  let writerRef: Writer;
  let sheetsRef: Sheets;
  let slidesRef: Slides;
  let pdfRef: PdfViewer;
  let formsRef: Forms;

  // Active status bar statistics
  // Active status bar statistics (Clean blank state)
  let formQuestionCount = 1;
  let formResponseCount = 0;
  let writerWordCount = 0;
  let writerCharCount = 0;
  let sheetsActiveCell = 'A1';
  let sheetsSelectionSum: number | null = null;
  let slidesIndex = 0;
  let slidesTotal = 1;
  let pdfPage = 1;
  let pdfTotalPages = 1;

  // --- Initial Default Documents (Ready for a New File) ---
  let writerDoc: WriterDocument = {
    meta: {
      id: 'doc_writer_1',
      title: 'Untitled Document',
      isDirty: false,
      mode: 'writer',
    },
    contentHtml: '<p><br></p>',
    contentMarkdown: '',
    wordCount: 0,
    charCount: 0,
    pageCount: 1,
  };

  let sheetsWorkbook: SpreadsheetWorkbook = {
    meta: {
      id: 'doc_sheets_1',
      title: 'Untitled Spreadsheet',
      isDirty: false,
      mode: 'sheets',
    },
    activeSheetId: 'sheet_1',
    sheets: [
      {
        id: 'sheet_1',
        name: 'Sheet 1',
        rowCount: 50,
        colCount: 26,
        cells: {},
      },
    ],
  };

  let slidesDeck: SlideDeck = {
    meta: {
      id: 'doc_slides_1',
      title: 'Untitled Presentation',
      isDirty: false,
      mode: 'slides',
    },
    aspectRatio: '16:9',
    slides: [
      {
        id: 's1',
        title: 'Untitled Presentation',
        bgColor: '#ffffff',
        elements: [
          {
            id: 'e1',
            type: 'title',
            x: 10,
            y: 35,
            width: 80,
            height: 18,
            content: 'Click to add title',
            fontColor: '#0f172a',
            fontSize: 44,
          },
          {
            id: 'e2',
            type: 'text',
            x: 10,
            y: 55,
            width: 80,
            height: 15,
            content: 'Click to add subtitle',
            fontColor: '#64748b',
            fontSize: 20,
          },
        ],
        notes: '',
      },
    ],
  };

  let pdfDoc: PdfDocument = {
    meta: {
      id: 'doc_pdf_1',
      title: 'Untitled Document.pdf',
      isDirty: false,
      mode: 'pdf',
    },
    title: 'Untitled Document.pdf',
    pageCount: 1,
    currentPage: 1,
    textContent: '',
    formFields: [],
  };

  let driveMeta = {
    id: 'doc_drive_hub',
    title: 'Files',
    isDirty: false,
    mode: 'drive' as WorkspaceMode,
  };

  let formDoc: FormDocument = {
    meta: {
      id: "doc_forms_1",
      title: "Untitled Form",
      isDirty: false,
      mode: "forms",
    },
    title: "Untitled Form",
    description: "",
    headerColor: "#673AB7",
    bgColor: "#f0ebf8",
    acceptingResponses: true,
    settings: {
      isQuiz: false,
      defaultPoints: 10,
      collectEmail: false,
      limitOneResponse: false,
      allowResponseEdit: true,
      showProgressBar: false,
      shuffleQuestions: false,
      confirmationMessage: "Your response has been recorded.",
      requireQuestionsByDefault: false,
    },
    questions: [
      {
        id: "q_1",
        type: "multiple_choice",
        title: "Untitled Question",
        description: "",
        required: false,
        options: [{ id: "opt_1", text: "Option 1" }],
      },
    ],
    responses: [],
  };

  $: currentMeta =
    activeMode === 'drive'
      ? driveMeta
      : activeMode === 'writer'
      ? writerDoc.meta
      : activeMode === 'sheets'
      ? sheetsWorkbook.meta
      : activeMode === 'slides'
      ? slidesDeck.meta
      : activeMode === 'pdf'
      ? pdfDoc.meta
      : formDoc.meta;

  function handleOpenFromDrive(e: CustomEvent<{ item: any; mode: WorkspaceMode; documentId?: string; title: string }>) {
    const { mode, documentId, title } = e.detail;
    handleSwitchMode(mode, documentId);
  }

  function triggerAutoSave() {
    currentMeta.isDirty = true;
    if (activeMode === 'writer') {
      autoSaver.scheduleAutoSave('writer', writerDoc.meta.id, writerDoc);
    } else if (activeMode === 'sheets') {
      autoSaver.scheduleAutoSave('sheets', sheetsWorkbook.meta.id, sheetsWorkbook);
    } else if (activeMode === 'slides') {
      autoSaver.scheduleAutoSave('slides', slidesDeck.meta.id, slidesDeck);
    } else if (activeMode === 'pdf') {
      autoSaver.scheduleAutoSave('pdf', pdfDoc.meta.id, pdfDoc);
    } else {
      autoSaver.scheduleAutoSave('forms', formDoc.meta.id, formDoc);
    }
  }


  function handleLinkFormsToSheets(detail: {
    headers: string[];
    rows: (string | number)[][];
    formTitle: string;
  }) {
    const timestamp = Date.now();
    const newSheetId = `sheet_forms_${timestamp}`;
    const newCells: Record<string, any> = {};

    // Row 1: Green Google Sheets Header formatting
    detail.headers.forEach((h, colIdx) => {
      const colLetter = String.fromCharCode(65 + (colIdx % 26));
      const cellId = `${colLetter}1`;
      newCells[cellId] = {
        raw: h,
        computed: h,
        format: {
          bold: true,
          bgColor: "#dcfce7",
          textColor: "#166534",
          borders: { bottom: true, color: "#16a34a", style: "solid" },
        },
      };
    });

    // Row 2..N: Data rows
    detail.rows.forEach((row, rowIdx) => {
      const rowNum = rowIdx + 2;
      row.forEach((val, colIdx) => {
        const colLetter = String.fromCharCode(65 + (colIdx % 26));
        const cellId = `${colLetter}${rowNum}`;
        newCells[cellId] = {
          raw: String(val),
          computed: String(val),
        };
      });
    });

    const newSheetTab = {
      id: newSheetId,
      name: "Form Responses",
      cells: newCells,
      rowCount: Math.max(50, detail.rows.length + 10),
      colCount: Math.max(15, detail.headers.length + 3),
      tabColor: "#16a34a",
    };

    sheetsWorkbook.sheets = [...sheetsWorkbook.sheets, newSheetTab];
    sheetsWorkbook.activeSheetId = newSheetId;
    sheetsWorkbook.meta.isDirty = true;
    handleSwitchMode("sheets");
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
        try {
          slidesDeck = JSON.parse(content);
        } catch {
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

  function getCurrentContextForGemini(): string {
    if (activeMode === 'writer') {
      return writerDoc.contentHtml.replace(/<[^>]+>/g, ' ').slice(0, 3000);
    }
    if (activeMode === 'sheets') {
      const activeSheet = sheetsWorkbook.sheets.find(s => s.id === sheetsWorkbook.activeSheetId) || sheetsWorkbook.sheets[0];
      const keys = Object.keys(activeSheet?.cells || {}).slice(0, 30);
      return keys.map(k => `${k}: ${activeSheet.cells[k]?.raw || ''}`).join(', ');
    }
    if (activeMode === 'slides') {
      const slide = slidesDeck.slides[slidesIndex] || slidesDeck.slides[0];
      return `Slide Title: ${slide?.title || ''}\nElements: ${slide?.elements?.map(e => e.content).join('; ') || ''}`;
    }
    if (activeMode === 'forms') {
      return `Form: ${formDoc.title}\nQuestions: ${formDoc.questions.map(q => q.title).join('; ')}`;
    }
    if (activeMode === 'pdf') {
      return pdfDoc.textContent?.slice(0, 3000) || '';
    }
    return '';
  }

  function handleApplyGeminiOutput(e: CustomEvent<{ text: string; mode: WorkspaceMode; action?: string }>) {
    const { text, mode } = e.detail;
    if (mode === 'writer') {
      const paragraphs = text.split('\n\n').map(p => {
        if (p.startsWith('### ')) return `<h3>${p.slice(4)}</h3>`;
        if (p.startsWith('## ')) return `<h2>${p.slice(3)}</h2>`;
        if (p.startsWith('# ')) return `<h1>${p.slice(2)}</h1>`;
        if (p.startsWith('- ') || p.startsWith('• ')) {
          const items = p.split('\n').map(li => `<li>${li.replace(/^[-•]\s*/, '')}</li>`).join('');
          return `<ul>${items}</ul>`;
        }
        return `<p>${p.replace(/\n/g, '<br/>')}</p>`;
      }).join('');
      writerRef?.insertHtml(paragraphs);
    } else if (mode === 'sheets') {
      if (text.includes('|') && text.includes('---')) {
        sheetsRef?.insertTableFromMarkdown(text);
      } else if (text.trim().startsWith('=')) {
        const formula = text.trim().split('\n')[0].trim();
        sheetsRef?.insertFormulaToActiveCell(formula);
      } else {
        sheetsRef?.insertFormulaToActiveCell(text.trim());
      }
    } else if (mode === 'slides') {
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      const titleLine = lines.find(l => l.startsWith('#') || l.toLowerCase().includes('title:')) || lines[0] || 'Gemini Generated Slide';
      const cleanTitle = titleLine.replace(/^[#:\s]+/, '').replace(/^title:\s*/i, '');
      const bullets = lines.filter(l => l.startsWith('-') || l.startsWith('•') || l.startsWith('*')).map(l => l.replace(/^[-•*]\s*/, ''));
      slidesRef?.addSlideFromAi(cleanTitle, bullets.length > 0 ? bullets : lines.slice(1, 5));
    }
  }

  function handleRibbonAction(e: CustomEvent<{ action: string; payload?: any }>) {
    const { action, payload } = e.detail;

    // Universal clipboard & search actions
    if (action === 'copy') {
      document.execCommand('copy');
      return;
    } else if (action === 'paste') {
      if (navigator.clipboard) {
        navigator.clipboard.readText().then((t) => document.execCommand('insertText', false, t)).catch(() => {});
      } else {
        document.execCommand('paste');
      }
      return;
    } else if (action === 'selectAll') {
      document.execCommand('selectAll');
      return;
    } else if (action === 'toggleSearch') {
      if (activeMode === 'writer') writerRef?.toggleSearch();
      else if (activeMode === 'sheets') sheetsRef?.toggleFindBar();
      return;
    } else if (action === 'toggleComments') {
      if (activeMode === 'writer') writerRef?.toggleCommentsDrawer();
      return;
    } else if (action === 'openAiModal') {
      showGeminiSidePanel = true;
      return;
    }

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
      } else if (action === 'insertSpecialChar') {
        writerRef?.openSpecialCharacters();
      } else if (action === 'openWatermark') {
        writerRef?.openWatermark();
      } else if (action === 'insertPageBreak') {
        writerRef?.insertPageBreak();
      } else if (action === 'removeFormat') {
        document.execCommand('removeFormat', false);
      } else if (action === 'insertText') {
        document.execCommand('insertText', false, payload);
      }
    } else if (activeMode === 'sheets') {
      if (action === 'bold') sheetsRef?.toggleBold();
      else if (action === 'italic') sheetsRef?.toggleItalic();
      else if (action === 'underline') sheetsRef?.toggleUnderline();
      else if (action === 'strike') sheetsRef?.toggleStrike();
      else if (action === 'align') sheetsRef?.setAlign(payload);
      else if (action === 'verticalAlign') sheetsRef?.setVerticalAlign(payload);
      else if (action === 'textRotation') sheetsRef?.setTextRotation(payload);
      else if (action === 'numberFormat') sheetsRef?.setNumberFormat(payload);
      else if (action === 'mergeCells') sheetsRef?.mergeCells(payload);
      else if (action === 'removeFormat') sheetsRef?.clearActiveFormatting();
      else if (action === 'autoSum') sheetsRef?.insertFormula('SUM');
      else if (action === 'formulaQuick') sheetsRef?.insertFormula(payload);
      else if (action === 'insertChart') sheetsRef?.openChartDialog();
      else if (action === 'conditionalFormatting' || action === 'openConditionalFormatting') sheetsRef?.openConditionalFormatting();
      else if (action === 'openDataValidation') sheetsRef?.openDataValidation();
      else if (action === 'openBorders') sheetsRef?.openBorders();
      else if (action === 'toggleFilter') sheetsRef?.toggleFilter();
      else if (action === 'sortAsc' || action === 'sortAZ') sheetsRef?.sortActiveColumn(true);
      else if (action === 'sortDesc' || action === 'sortZA') sheetsRef?.sortActiveColumn(false);
      else if (action === 'sortSheetAZ') sheetsRef?.sortSheet(true);
      else if (action === 'sortSheetZA') sheetsRef?.sortSheet(false);
      else if (action === 'insertRowAbove') sheetsRef?.insertRow(true);
      else if (action === 'insertRowBelow') sheetsRef?.insertRow(false);
      else if (action === 'deleteRow') sheetsRef?.deleteCurrentRow();
      else if (action === 'insertColLeft') sheetsRef?.insertColumn(true);
      else if (action === 'insertColRight') sheetsRef?.insertColumn(false);
      else if (action === 'deleteCol') sheetsRef?.deleteCurrentColumn();
      else if (action === 'find') sheetsRef?.toggleFindBar();
      else if (action === 'pasteValuesOnly') sheetsRef?.pasteValuesOnly();
      else if (action === 'pasteFormatOnly') sheetsRef?.pasteFormatOnly();
      else if (action === 'pasteFormulaOnly') sheetsRef?.pasteFormulaOnly();
      else if (action === 'pasteTransposed') sheetsRef?.pasteTransposed();
      else if (action === 'deleteCellsUp') sheetsRef?.deleteCells('up');
      else if (action === 'deleteCellsLeft') sheetsRef?.deleteCells('left');
      else if (action === 'toggleFormulaBar') sheetsRef?.toggleFormulaBar();
      else if (action === 'toggleGridlines') sheetsRef?.toggleGridlines();
      else if (action === 'toggleShowFormulas') sheetsRef?.toggleShowFormulas();
      else if (action === 'freezeRows') sheetsRef?.setFreezeRows(payload);
      else if (action === 'freezeCols') sheetsRef?.setFreezeCols(payload);
      else if (action === 'zoom') sheetsRef?.setZoom(payload);
      else if (action === 'insertCheckbox') sheetsRef?.insertCheckbox();
      else if (action === 'insertDropdown') sheetsRef?.insertDropdown();
      else if (action === 'insertLink') sheetsRef?.insertLink(payload);
      else if (action === 'insertComment') sheetsRef?.insertComment();
      else if (action === 'insertNote') sheetsRef?.insertNote();
      else if (action === 'insertCellsDown') sheetsRef?.insertCells('down');
      else if (action === 'insertCellsRight') sheetsRef?.insertCells('right');
      else if (action === 'insertPrebuiltTable') sheetsRef?.insertPrebuiltTable(payload);
      else if (action === 'alternatingColors') sheetsRef?.openAlternatingColors();
      else if (action === 'trimWhitespace') sheetsRef?.trimWhitespace();
      else if (action === 'removeDuplicates') sheetsRef?.removeDuplicates();
      else if (action === 'splitTextToColumns') sheetsRef?.splitTextToColumns(payload);
      else if (action === 'randomizeRange') sheetsRef?.randomizeRange();
      else if (action === 'columnStats') sheetsRef?.openColumnStats();
      else if (action === 'createForm') sheetsRef?.createFormFromSheet();
      else if (action === 'spreadsheetSettings') sheetsRef?.openSpreadsheetSettings();
      else if (action === 'appsScript') sheetsRef?.openAppsScript();
      else if (action === 'functionList') sheetsRef?.openFunctionList();
      else if (action === 'spellCheck') sheetsRef?.spellCheck();
      else if (action === 'insertFx') sheetsRef?.openFunctionList();
      else if (action === 'importFile' || action === 'importSpreadsheet') sheetsRef?.handleImportSpreadsheet();
      else if (action === 'insertText') sheetsRef?.commitValue(sheetsActiveCell, payload);
    } else if (activeMode === 'slides') {
      if (action === 'newSlide') slidesRef?.addNewSlide();
      else if (action === 'duplicateSlide') slidesRef?.duplicateCurrentSlide();
      else if (action === 'deleteSlide') slidesRef?.deleteCurrentSlide();
      else if (action === 'changeTheme') slidesRef?.openThemeModal();
      else if (action === 'changeTransition') slidesRef?.openTransitions();
      else if (action === 'present') slidesRef?.startPresenting();
      else if (action === 'slideTheme') slidesRef?.setTheme(payload);
      else if (action === 'aspectRatio') slidesDeck.aspectRatio = payload;
    } else if (activeMode === 'pdf') {
      if (action === 'addTextField') pdfRef?.addFormField('text');
      else if (action === 'addCheckboxField') pdfRef?.addFormField('checkbox');
      else if (action === 'addSignatureField') pdfRef?.addFormField('signature');
      else if (action === 'exportFormData') pdfRef?.exportFormData();
      else if (action === 'print') triggerPrintToPdf(pdfDoc.title);
    }
  }

  function handleLoadTemplate(e: CustomEvent<{ template: OfficeTemplate }>) {
    const tpl = e.detail.template;
    if (tpl.mode === "writer") {
      handleSwitchMode("writer");
      writerDoc.meta.title = tpl.title;
      writerDoc.contentHtml = tpl.content;
      writerDoc.meta.updatedAt = new Date().toISOString();
      triggerAutoSave();
    } else if (tpl.mode === "sheets") {
      handleSwitchMode("sheets");
      sheetsWorkbook.meta.title = tpl.title;
      const sheet = sheetsWorkbook.sheets[0];
      if (sheet) {
        sheet.cells = { ...tpl.content.cells };
        recalculateGrid(sheet.cells);
      }
      sheetsWorkbook.meta.updatedAt = new Date().toISOString();
      triggerAutoSave();
    } else if (tpl.mode === "slides") {
      handleSwitchMode("slides");
      slidesDeck.meta.title = tpl.title;
      slidesDeck.slides = JSON.parse(JSON.stringify(tpl.content));
      slidesDeck.meta.updatedAt = new Date().toISOString();
      triggerAutoSave();
    }
  }

  function handleCommandExecute(e: CustomEvent<{ actionId: string; payload?: any }>) {
    const { actionId } = e.detail;
    if (actionId.startsWith("mode_")) {
      const mode = actionId.replace("mode_", "") as WorkspaceMode;
      handleSwitchMode(mode);
    } else if (actionId === "save") {
      handleSaveDoc();
    } else if (actionId === "export_pdf") {
      handleExportDoc("pdf");
    } else if (actionId === "print") {
      handlePrintPdf();
    } else if (actionId === "version_history") {
      if (activeMode === "writer") writerRef?.openVersionHistory();
    } else if (actionId === "page_setup") {
      if (activeMode === "writer") writerRef?.openPageSetup();
    } else if (actionId === "watermark") {
      if (activeMode === "writer") writerRef?.openWatermark();
    } else if (actionId === "word_count") {
      if (activeMode === "writer") writerRef?.openWordCount();
    } else if (actionId === "find_replace") {
      handleRibbonAction("find");
    } else if (actionId === "insert_table") {
      handleRibbonAction("insertTable");
    } else if (actionId === "insert_chart") {
      if (activeMode === "sheets") sheetsRef?.openChartDialog();
    } else if (actionId === "conditional_formatting") {
      if (activeMode === "sheets") sheetsRef?.openConditionalFormatting();
    } else if (actionId === "data_validation") {
      if (activeMode === "sheets") sheetsRef?.openDataValidation();
    } else if (actionId === "cell_borders") {
      if (activeMode === "sheets") sheetsRef?.openBorders();
    } else if (actionId === "toggle_filter") {
      if (activeMode === "sheets") sheetsRef?.toggleFilter();
    } else if (actionId === "present") {
      if (activeMode === "slides") slidesRef?.startPresenting();
    } else if (actionId === "slide_transitions") {
      if (activeMode === "slides") {
        const transBtn = document.querySelector("button[title*=\"Slide Transitions\"]") as HTMLButtonElement;
        if (transBtn) transBtn.click();
      }

    } else if (actionId === "settings") {
      showSettingsModal = true;
    } else if (actionId === "shortcuts") {
      showShortcutsModal = true;
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
      } else if (e.key === '0' || e.key.toLowerCase() === 'd') {
        e.preventDefault();
        handleSwitchMode('drive');
      } else if (e.key === '1') {
        e.preventDefault();
        handleSwitchMode('writer');
      } else if (e.key === '2') {
        e.preventDefault();
        handleSwitchMode('sheets');
      } else if (e.key === '3') {
        e.preventDefault();
        handleSwitchMode('slides');
      } else if (e.key === '4') {
        e.preventDefault();
        handleSwitchMode('pdf');
      } else if (e.key === '5') {
        e.preventDefault();
        handleSwitchMode('forms');
      }
    } else if (mod && e.shiftKey && !e.altKey) {
      if (e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSaveAsDoc();
      }
    }

    // Universal Command Palette shortcut: Cmd+K or Ctrl+K
    if (mod && e.key.toLowerCase() === "k") {
      e.preventDefault();
      showCommandPalette = !showCommandPalette;
      return;
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


<div class="h-screen w-screen flex flex-col bg-slate-100 overflow-hidden font-sans">
  <!-- Top OnlyOffice Style Navigation & File Ribbon Actions -->
  <Header
    {activeMode}
    meta={currentMeta}
    settings={appSettings}
    on:changeMode={(e) => handleSwitchMode(e.detail)}
    on:newDoc={handleNewDoc}
    on:openDoc={handleOpenDoc}
    on:saveDoc={handleSaveDoc}
    on:saveAsDoc={handleSaveAsDoc}
    on:exportFormat={handleExportFormat}
    on:printPdf={handlePrintPdf}
    on:openShortcuts={() => (showShortcutsModal = true)}
    on:openSettings={() => (showSettingsModal = true)}
    on:openCommandPalette={() => (showCommandPalette = true)}
    on:openFileBackstage={() => (showFileBackstage = true)}
    on:undo={handleUndo}
    on:redo={handleRedo}
    on:ribbonAction={handleRibbonAction}
    on:toggleGeminiSidePanel={() => (showGeminiSidePanel = !showGeminiSidePanel)}
    on:openGeminiAction={() => (showGeminiSidePanel = true)}
  />

  <!-- Multi-Document Workspace Tabs Bar -->
  <DocumentTabs
    tabs={openTabs}
    {activeTabId}
    on:selectTab={handleSelectTab}
    on:closeTab={handleCloseTab}
    on:newTab={handleNewTab}
  />

  <!-- Active Workspace Module -->
  <main class="flex-1 flex overflow-hidden relative z-0">
    {#if activeMode === 'drive'}
      <DriveHub
        activeWorkspaceDocIds={openTabs.map((t) => t.id)}
        on:openDocument={handleOpenFromDrive}
        on:newDoc={(e) => {
          handleSwitchMode(e.detail.type);
          handleNewDoc();
        }}
      />
    {:else if activeMode === 'writer'}
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
        on:createForm={(e) => {
          formDoc.title = `Form for ${sheetsWorkbook.meta.title}`;
          formDoc.questions = e.detail.questions.map((q, idx) => ({
            id: `q_${Date.now()}_${idx}`,
            title: q.title,
            type: q.type,
            required: false,
            options: ['Option 1', 'Option 2'],
          }));
          activeMode = 'forms';
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
    {:else if activeMode === 'forms'}
      <Forms
        bind:this={formsRef}
        bind:form={formDoc}
        on:change={triggerAutoSave}
        on:updateStats={(e) => {
          formQuestionCount = e.detail.questionCount;
          formResponseCount = e.detail.responseCount;
        }}
        on:linkToSheets={(e) => handleLinkFormsToSheets(e.detail)}
      />
    {/if}

    <!-- Google Gemini Collapsible Side Panel -->
    <GeminiSidePanel
      isOpen={showGeminiSidePanel}
      {activeMode}
      currentContext={getCurrentContextForGemini()}
      settings={appSettings}
      on:close={() => (showGeminiSidePanel = false)}
      on:apply={handleApplyGeminiOutput}
      on:openAccountModal={() => {
        const avatarBtn = document.querySelector('button[title*="Account"]') as HTMLButtonElement;
        if (avatarBtn) avatarBtn.click();
      }}
      on:openSettings={() => (showSettingsModal = true)}
    />
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
    {formQuestionCount}
    {formResponseCount}
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

  <!-- Universal Command Palette (Cmd+K / Ctrl+K) -->
  <CommandPalette
    isOpen={showCommandPalette}
    {activeMode}
    on:close={() => (showCommandPalette = false)}
    on:execute={handleCommandExecute}
  />

  <!-- Full-Featured File Backstage Hub & Properties (OnlyOffice & MS Office style) -->
  <FileBackstageModal
    isOpen={showFileBackstage}
    {activeMode}
    meta={currentMeta}
    wordCount={writerWordCount}
    charCount={writerCharCount}
    settings={appSettings}
    on:close={() => (showFileBackstage = false)}
    on:newDoc={handleNewDoc}
    on:openDoc={handleOpenDoc}
    on:saveDoc={handleSaveDoc}
    on:saveAsDoc={handleSaveAsDoc}
    on:exportFormat={handleExportFormat}
    on:printPdf={handlePrintPdf}
    on:openSettings={() => (showSettingsModal = true)}
    on:openVersionHistory={() => {
      if (activeMode === "writer") writerRef?.openVersionHistory();
    }}
    on:openPageSetup={() => {
      if (activeMode === "writer") writerRef?.openPageSetup();
    }}
    on:openWatermark={() => {
      if (activeMode === "writer") writerRef?.openWatermark();
    }}
    on:loadTemplate={handleLoadTemplate}
    on:loadRecent={() => {
      handleOpenDoc();
    }}
  />
</div>

