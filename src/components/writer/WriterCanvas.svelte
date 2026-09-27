<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { countWordsAndChars } from '../../lib/utils';
  import type { DocumentPageSetup, DocumentWatermark, DocumentHeaderFooter, EditorMode } from '../../types';
  import SlashMenu from './SlashMenu.svelte';
  import FloatingToolbar from './FloatingToolbar.svelte';

  export let contentHtml: string = '';
  export let pageSetup: DocumentPageSetup = {
    margin: 'normal',
    orientation: 'portrait',
    size: 'a4',
  };
  export let isPageless: boolean = false;
  export let watermark: DocumentWatermark = {
    enabled: false,
    text: 'CONFIDENTIAL',
    opacity: 0.15,
    angle: -45,
  };
  export let headerFooter: DocumentHeaderFooter = {
    headerText: '',
    footerText: '',
    showPageNumbers: true,
    firstPageDifferent: false,
  };
  export let editorMode: EditorMode = 'editing';

  const dispatch = createEventDispatcher<{
    change: { html: string; text: string; words: number; chars: number };
    selectComment: { commentId: string };
    selectionChange: { text: string };
  }>();

  let editorElement: HTMLDivElement;
  let slashMenuRef: SlashMenu;
  let showSlashMenu = false;
  let slashX = 0;
  let slashY = 0;
  let slashFilter = "";
  let showFloatingToolbar = false;
  let floatX = 0;
  let floatY = 0;

  export function execCommand(command: string, value: string = '') {
    if (!editorElement) return;
    editorElement.focus();
    document.execCommand(command, false, value);
    handleInput();
  }

  export function insertCharacter(char: string) {
    if (!editorElement) return;
    editorElement.focus();
    document.execCommand('insertText', false, char);
    handleInput();
  }

  export function insertImage(src: string, alt: string = 'Image') {
    if (!editorElement) return;
    editorElement.focus();
    const imgHtml = `<p><img src="${src}" alt="${alt}" style="max-width: 100%; height: auto; border-radius: 6px; margin: 12px 0; box-shadow: 0 2px 8px rgba(0,0,0,0.1);" /></p><p><br></p>`;
    document.execCommand('insertHTML', false, imgHtml);
    handleInput();
  }

  export function insertLink(url: string) {
    if (!editorElement) return;
    editorElement.focus();
    document.execCommand('createLink', false, url);
    handleInput();
  }

  export function insertCustomTable(rows: number = 3, cols: number = 3, hasHeader: boolean = true) {
    if (!editorElement) return;
    editorElement.focus();

    let theadHtml = '';
    if (hasHeader) {
      theadHtml = '<thead><tr>';
      for (let c = 0; c < cols; c++) {
        theadHtml += `<th style="border: 1px solid #cbd5e1; padding: 10px 14px; background: #f1f5f9; text-align: left; font-weight: 600; color: #1e293b;">Header ${c + 1}</th>`;
      }
      theadHtml += '</tr></thead>';
    }

    let tbodyHtml = '<tbody>';
    for (let r = 0; r < rows; r++) {
      tbodyHtml += '<tr>';
      for (let c = 0; c < cols; c++) {
        tbodyHtml += `<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #334155;">Cell ${r + 1},${c + 1}</td>`;
      }
      tbodyHtml += '</tr>';
    }
    tbodyHtml += '</tbody>';

    const tableHtml = `
      <table style="width: 100%; border-collapse: collapse; margin: 1.25rem 0; font-size: 0.95rem; border-radius: 6px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
        ${theadHtml}
        ${tbodyHtml}
      </table>
      <p><br></p>
    `;
    document.execCommand('insertHTML', false, tableHtml);
    handleInput();
  }

  export function insertChecklist() {
    if (!editorElement) return;
    editorElement.focus();
    const itemHtml = `
      <div style="display: flex; align-items: center; margin: 6px 0; gap: 8px;">
        <input type="checkbox" style="cursor: pointer; width: 16px; height: 16px; accent-color: #2563eb;" onchange="this.nextElementSibling.style.textDecoration = this.checked ? 'line-through' : 'none'; this.nextElementSibling.style.opacity = this.checked ? '0.6' : '1';" />
        <span contenteditable="true" style="outline: none;">New to-do action item</span>
      </div>
      <p><br></p>
    `;
    document.execCommand('insertHTML', false, itemHtml);
    handleInput();
  }

  export function insertCallout(type: 'info' | 'tip' | 'warning' = 'info') {
    if (!editorElement) return;
    editorElement.focus();
    const bg = type === 'tip' ? '#f0fdf4' : type === 'warning' ? '#fffbeb' : '#eff6ff';
    const border = type === 'tip' ? '#22c55e' : type === 'warning' ? '#f59e0b' : '#3b82f6';
    const calloutHtml = `
      <div style="background-color: ${bg}; border-left: 4px solid ${border}; padding: 12px 16px; border-radius: 6px; margin: 1rem 0; color: #1e293b;">
        <strong>Note:</strong> Enter important callout or executive summary here...
      </div>
      <p><br></p>
    `;
    document.execCommand('insertHTML', false, calloutHtml);
    handleInput();
  }

  export function insertHorizontalRule() {
    if (!editorElement) return;
    editorElement.focus();
    document.execCommand('insertHorizontalRule', false);
    handleInput();
  }

  export function insertPageBreak() {
    if (!editorElement) return;
    editorElement.focus();
    const pbHtml = `<div class="page-break" style="page-break-after: always; break-after: page; border-top: 2px dashed #94a3b8; margin: 2rem 0; position: relative;"><span style="position: absolute; top: -10px; right: 10px; font-size: 10px; color: #94a3b8; background: #fff; padding: 0 4px; text-transform: uppercase;">Page Break</span></div><p><br></p>`;
    document.execCommand('insertHTML', false, pbHtml);
    handleInput();
  }

  export function insertFootnote(noteText: string) {
    if (!editorElement || !noteText) return;
    editorElement.focus();
    const footnoteIndex = editorElement.querySelectorAll('.footnote-ref').length + 1;
    const fnHtml = `<sup class="footnote-ref" style="color: #2563eb; font-weight: bold; cursor: pointer;" title="${noteText}">[${footnoteIndex}]</sup> `;
    document.execCommand('insertHTML', false, fnHtml);

    // Append footnote section if not present
    let fnSection = editorElement.querySelector('.document-footnotes');
    if (!fnSection) {
      const secHtml = `<hr style="margin-top: 2.5rem; border-color: #cbd5e1;" /><div class="document-footnotes" style="font-size: 0.8rem; color: #64748b; margin-top: 0.5rem;"><ol style="padding-left: 1.25rem;"><li id="fn-${footnoteIndex}">${noteText}</li></ol></div>`;
      editorElement.insertAdjacentHTML('beforeend', secHtml);
    } else {
      const ol = fnSection.querySelector('ol');
      if (ol) {
        ol.insertAdjacentHTML('beforeend', `<li id="fn-${footnoteIndex}">${noteText}</li>`);
      }
    }
    handleInput();
  }

  export function insertDate() {
    if (!editorElement) return;
    editorElement.focus();
    const dateStr = new Date().toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    document.execCommand('insertHTML', false, `<span>${dateStr}</span> `);
    handleInput();
  }

  export function insertTableOfContents() {
    if (!editorElement) return;
    editorElement.focus();
    const headings = editorElement.querySelectorAll('h1, h2, h3');
    if (headings.length === 0) {
      document.execCommand(
        'insertHTML',
        false,
        `<div style="padding: 12px; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 6px; margin: 1rem 0; font-size: 0.85rem; color: #64748b;"><em>Table of contents: Add headings (H1, H2, H3) to populate</em></div><p><br></p>`
      );
      handleInput();
      return;
    }

    let tocHtml = `<div style="padding: 14px 18px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin: 1.5rem 0;">`;
    tocHtml += `<div style="font-weight: 700; font-size: 1rem; color: #0f172a; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">Table of Contents</div><ul style="list-style: none; padding-left: 0; margin: 0; line-height: 1.8;">`;

    headings.forEach((h, idx) => {
      const text = h.textContent?.trim() || `Section ${idx + 1}`;
      const level = parseInt(h.tagName.substring(1), 10);
      const indent = (level - 1) * 18;
      const id = h.id || `heading-${idx}`;
      h.id = id;
      tocHtml += `<li style="padding-left: ${indent}px;"><a href="#${id}" style="color: #2563eb; text-decoration: none;">${text}</a></li>`;
    });

    tocHtml += `</ul></div><p><br></p>`;
    document.execCommand('insertHTML', false, tocHtml);
    handleInput();
  }

  export function scrollToHeading(text: string) {
    if (!editorElement) return;
    const headings = editorElement.querySelectorAll('h1, h2, h3, h4');
    for (let i = 0; i < headings.length; i++) {
      if (headings[i].textContent?.trim() === text) {
        headings[i].scrollIntoView({ behavior: 'smooth', block: 'center' });
        const el = headings[i] as HTMLElement;
        const origBg = el.style.backgroundColor;
        el.style.backgroundColor = '#dbeafe';
        el.style.transition = 'background-color 0.4s';
        setTimeout(() => {
          el.style.backgroundColor = origBg;
        }, 800);
        break;
      }
    }
  }

  // Get currently selected text in the editor
  export function getSelectedText(): string {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return '';
    return sel.toString().trim();
  }

  // Highlight selection with comment anchor
  export function anchorComment(commentId: string) {
    if (!editorElement) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
    const range = sel.getRangeAt(0);

    const mark = document.createElement('mark');
    mark.className = 'doc-comment-mark bg-amber-100/80 border-b-2 border-amber-400 cursor-pointer rounded-xs px-0.5';
    mark.setAttribute('data-comment-id', commentId);
    mark.onclick = (e) => {
      e.stopPropagation();
      dispatch('selectComment', { commentId });
    };

    try {
      range.surroundContents(mark);
      handleInput();
    } catch {
      // Fallback if cross-boundary selection
      document.execCommand('hiliteColor', false, '#fef08a');
      handleInput();
    }
  }

  // Table manipulation tools
  export function insertTableRow(above: boolean = false) {
    if (!editorElement) return;
    const sel = window.getSelection();
    const cell = sel?.anchorNode?.parentElement?.closest('td, th') as HTMLTableCellElement | null;
    if (!cell) return;
    const row = cell.closest('tr');
    const table = cell.closest('table');
    if (!row || !table) return;

    const colCount = row.children.length;
    const newRow = document.createElement('tr');
    for (let i = 0; i < colCount; i++) {
      const td = document.createElement('td');
      td.style.border = '1px solid #cbd5e1';
      td.style.padding = '8px 12px';
      td.innerHTML = '&nbsp;';
      newRow.appendChild(td);
    }

    if (above) {
      row.parentElement?.insertBefore(newRow, row);
    } else {
      row.parentElement?.insertBefore(newRow, row.nextSibling);
    }
    handleInput();
  }

  export function insertTableColumn(left: boolean = false) {
    if (!editorElement) return;
    const sel = window.getSelection();
    const cell = sel?.anchorNode?.parentElement?.closest('td, th') as HTMLTableCellElement | null;
    if (!cell) return;
    const table = cell.closest('table');
    if (!table) return;

    const cellIndex = Array.from(cell.parentElement?.children || []).indexOf(cell);
    if (cellIndex === -1) return;

    const rows = table.querySelectorAll('tr');
    rows.forEach((row) => {
      const isHeader = row.parentElement?.tagName.toLowerCase() === 'thead';
      const newCell = document.createElement(isHeader ? 'th' : 'td');
      newCell.style.border = '1px solid #cbd5e1';
      newCell.style.padding = isHeader ? '10px 14px' : '8px 12px';
      if (isHeader) {
        newCell.style.background = '#f1f5f9';
        newCell.style.fontWeight = '600';
        newCell.textContent = 'Header';
      } else {
        newCell.innerHTML = '&nbsp;';
      }

      const targetCol = row.children[cellIndex];
      if (left) {
        row.insertBefore(newCell, targetCol);
      } else {
        row.insertBefore(newCell, targetCol ? targetCol.nextSibling : null);
      }
    });
    handleInput();
  }

  export function deleteTableRow() {
    if (!editorElement) return;
    const sel = window.getSelection();
    const cell = sel?.anchorNode?.parentElement?.closest('td, th') as HTMLTableCellElement | null;
    if (!cell) return;
    const row = cell.closest('tr');
    if (!row) return;
    row.remove();
    handleInput();
  }

  export function deleteTableColumn() {
    if (!editorElement) return;
    const sel = window.getSelection();
    const cell = sel?.anchorNode?.parentElement?.closest('td, th') as HTMLTableCellElement | null;
    if (!cell) return;
    const table = cell.closest('table');
    if (!table) return;

    const cellIndex = Array.from(cell.parentElement?.children || []).indexOf(cell);
    if (cellIndex === -1) return;

    const rows = table.querySelectorAll('tr');
    rows.forEach((row) => {
      if (row.children[cellIndex]) {
        row.children[cellIndex].remove();
      }
    });
    handleInput();
  }

  export function deleteTable() {
    if (!editorElement) return;
    const sel = window.getSelection();
    const cell = sel?.anchorNode?.parentElement?.closest('td, th') as HTMLTableCellElement | null;
    if (!cell) return;
    const table = cell.closest('table');
    if (table) {
      table.remove();
      handleInput();
    }
  }

  export function setTableCellBg(color: string) {
    if (!editorElement) return;
    const sel = window.getSelection();
    const cell = sel?.anchorNode?.parentElement?.closest('td, th') as HTMLTableCellElement | null;
    if (cell) {
      cell.style.backgroundColor = color;
      handleInput();
    }
  }

  export function replaceText(findStr: string, replaceStr: string, all: boolean = false) {
    if (!editorElement || !findStr) return;
    const html = editorElement.innerHTML;
    if (all) {
      const regex = new RegExp(findStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      editorElement.innerHTML = html.replace(regex, replaceStr);
    } else {
      editorElement.innerHTML = html.replace(findStr, replaceStr);
    }
    handleInput();
  }

  function handleInput() {
    if (!editorElement) return;
    const html = editorElement.innerHTML;
    const text = editorElement.innerText || '';
    const { words, chars } = countWordsAndChars(text);

    dispatch('change', {
      html,
      text,
      words,
      chars,
    });
  }

  function handleSelection() {
    const text = getSelectedText();
    dispatch('selectionChange', { text });

    const sel = window.getSelection();
    if (sel && !sel.isCollapsed && sel.toString().trim().length > 0) {
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      floatX = Math.max(120, rect.left + rect.width / 2);
      floatY = Math.max(50, rect.top - 8);
      showFloatingToolbar = true;
    } else {
      showFloatingToolbar = false;
    }
  }

  function handleEditorKeydown(e: KeyboardEvent) {
    if (showSlashMenu) {
      if (["ArrowUp", "ArrowDown", "Enter", "Escape"].includes(e.key)) {
        if (slashMenuRef?.handleKeydown(e)) {
          return;
        }
      }
      if (e.key === "Backspace") {
        if (slashFilter.length > 0) {
          slashFilter = slashFilter.slice(0, -1);
        } else {
          showSlashMenu = false;
        }
      } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
        slashFilter += e.key;
      }
    }

    if (e.key === "/") {
      setTimeout(() => {
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
          const range = sel.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          slashX = Math.min(window.innerWidth - 280, Math.max(20, rect.left));
          slashY = Math.min(window.innerHeight - 300, rect.bottom + 6);
          slashFilter = "";
          showSlashMenu = true;
        }
      }, 10);
    }
  }

  function handleSlashSelect(e: CustomEvent<{ command: string; value?: string }>) {
    showSlashMenu = false;
    const { command, value } = e.detail;

    // Delete the slash trigger text
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      for (let i = 0; i <= slashFilter.length; i++) {
        document.execCommand("delete", false);
      }
    }

    if (command === "insertTable") {
      insertCustomTable(3, 3, true);
    } else if (command === "insertChecklist") {
      insertChecklist();
    } else if (command === "insertCallout") {
      insertCallout("info");
    } else if (command === "insertHorizontalRule") {
      insertHorizontalRule();
    } else if (command === "insertDate") {
      insertDate();
    } else {
      execCommand(command, value);
    }
  }

  onMount(() => {
    if (editorElement && contentHtml) {
      editorElement.innerHTML = contentHtml;
      handleInput();
    }
  });

  $: if (editorElement && contentHtml !== editorElement.innerHTML) {
    editorElement.innerHTML = contentHtml;
    handleInput();
  }

  // Margin CSS computation
  $: marginStyle =
    pageSetup.margin === 'narrow'
      ? 'padding: 0.5in;'
      : pageSetup.margin === 'wide'
      ? 'padding: 1.5in;'
      : 'padding: 1.0in;';

  // Dimension computation
  $: dimensionClass = isPageless
    ? 'w-full max-w-4xl min-h-screen rounded-none shadow-none border-none my-0 py-10 px-8'
    : pageSetup.orientation === 'landscape'
    ? pageSetup.size === 'letter'
      ? 'w-[11in] min-h-[8.5in]'
      : pageSetup.size === 'legal'
      ? 'w-[14in] min-h-[8.5in]'
      : 'w-[297mm] min-h-[210mm]'
    : pageSetup.size === 'letter'
    ? 'w-[8.5in] min-h-[11in]'
    : pageSetup.size === 'legal'
    ? 'w-[8.5in] min-h-[14in]'
    : 'w-[210mm] min-h-[297mm]';
</script>

<div class="flex-1 bg-slate-200/80 overflow-y-auto px-4 py-8 flex flex-col items-center relative">
  <!-- Document Page Container -->
  <div class="relative flex flex-col items-center w-full max-w-full">
    <!-- Header (Google Docs style) -->
    {#if !isPageless}
      <div
        class="w-full flex items-center justify-between text-[11px] text-slate-400 border-b border-dashed border-slate-300 pb-1.5 mb-2 px-8 max-w-[8.5in]"
        contenteditable="true"
        bind:innerText={headerFooter.headerText}
        placeholder="Header: Double click to customize document header..."
      ></div>
    {/if}

    <!-- Document Page Canvas with Watermark Overlay -->
    <div class="relative">
      {#if watermark.enabled}
        <div
          class="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden z-10 select-none"
          style="opacity: {watermark.opacity}; transform: rotate({watermark.angle}deg);"
        >
          <span
            class="text-7xl font-extrabold uppercase tracking-widest text-slate-900 border-4 border-slate-900/40 px-10 py-4 rounded-xl"
            style="color: {watermark.color || '#0f172a'}; border-color: {watermark.color || '#0f172a'};"
          >
            {watermark.text}
          </span>
        </div>
      {/if}

      <!-- Editable Document Canvas -->
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        bind:this={editorElement}
        contenteditable={editorMode !== 'viewing'}
        spellcheck="true"
        role="textbox"
        tabindex="0"
        aria-multiline="true"
        class="document-page bg-white shadow-md hover:shadow-lg transition-all text-slate-800 relative z-0 {dimensionClass} {editorMode === 'viewing' ? 'cursor-default' : 'cursor-text'}"
        style={isPageless ? '' : marginStyle}
        on:input={handleInput}
        on:keyup={() => { handleInput(); handleSelection(); }}
        on:mouseup={handleSelection}
        on:keydown={handleEditorKeydown}
      >
      </div>
    </div>

    <!-- Floating Bubble Selection Toolbar -->
    {#if showFloatingToolbar}
      <FloatingToolbar
        x={floatX}
        y={floatY}
        on:format={(e) => execCommand(e.detail.command, e.detail.value)}
        on:addComment={() => {
          showFloatingToolbar = false;
          dispatch('selectComment', { commentId: 'new' });
        }}
      />
    {/if}

    <!-- Slash Command Menu -->
    {#if showSlashMenu}
      <SlashMenu
        bind:this={slashMenuRef}
        x={slashX}
        y={slashY}
        filterText={slashFilter}
        on:select={handleSlashSelect}
        on:close={() => (showSlashMenu = false)}
      />
    {/if}

    <!-- Footer (Google Docs style) -->
    {#if !isPageless}
      <div class="w-full flex items-center justify-between text-[11px] text-slate-400 border-t border-dashed border-slate-300 pt-1.5 mt-2 px-8 max-w-[8.5in]">
        <div
          contenteditable="true"
          bind:innerText={headerFooter.footerText}
          placeholder="Footer: Custom department, date, or confidentiality notice..."
          class="outline-none"
        ></div>
        {#if headerFooter.showPageNumbers}
          <div class="font-mono text-[10px] text-slate-400">
            Page 1 of 1
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  :global(.document-page table td),
  :global(.document-page table th) {
    min-width: 50px;
    vertical-align: top;
  }
  :global(.document-page blockquote) {
    border-left: 3px solid #3b82f6;
    padding-left: 1rem;
    margin: 1rem 0;
    color: #475569;
    font-style: italic;
  }
  :global(.document-page pre) {
    background-color: #1e293b;
    color: #f8fafc;
    padding: 1rem;
    border-radius: 6px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.85rem;
    overflow-x: auto;
    margin: 1rem 0;
  }
  :global(.document-page mark.doc-comment-mark) {
    background-color: #fef08a;
    border-bottom: 2px solid #f59e0b;
    cursor: pointer;
    border-radius: 2px;
    padding: 1px 3px;
  }
  :global(.document-page mark.doc-comment-mark:hover) {
    background-color: #fde047;
  }
</style>
