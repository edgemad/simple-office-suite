<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { countWordsAndChars } from '../../lib/utils';
  import type { DocumentPageSetup } from '../../types';
  import { escapeHtml, sanitizeHtml, sanitizeImageUrl, sanitizeLinkUrl } from '../../lib/sanitize';

  export let contentHtml: string = '';
  export let pageSetup: DocumentPageSetup = {
    margin: 'normal',
    orientation: 'portrait',
    size: 'a4',
  };
  export let isPageless: boolean = false;
  export let watermark: string = '';
  export let watermarkOptions: { opacity: number; angle: number; color?: string } = {
    opacity: 0.15,
    angle: -45,
    color: '#0f172a',
  };
  export let columnCount: number = 1;

  const dispatch = createEventDispatcher<{
    change: { html: string; text: string; words: number; chars: number };
  }>();

  let editorElement: HTMLDivElement;
  let isEditable = true;
  let trackChangesOn = false;
  let editorMode: 'editing' | 'suggesting' | 'viewing' = 'editing';
  let footnoteTotal = 0;

  $: safeContentHtml = sanitizeHtml(contentHtml);

  function setEditorHtml(html: string) {
    if (!editorElement) return;
    editorElement.innerHTML = sanitizeHtml(html);
    handleInput();
  }

  export function execCommand(command: string, value: string = '') {
    if (!editorElement || !isEditable) return;
    editorElement.focus();
    if (command === 'insertText' && trackChangesOn) {
      insertTrackedHtml(sanitizeHtml(`<span>${escapeHtml(value)}</span>`));
    } else {
      document.execCommand(command, false, value);
    }
    handleInput();
  }

  export function insertImage(src: string, alt: string = 'Image') {
    if (!editorElement) return;
    const safeSrc = sanitizeImageUrl(src);
    if (!safeSrc) return;
    editorElement.focus();
    const imgHtml = `<p><img src="${escapeHtml(safeSrc)}" alt="${escapeHtml(alt)}" style="max-width: 100%; height: auto; border-radius: 6px; margin: 12px 0; box-shadow: 0 2px 8px rgba(0,0,0,0.1);" /></p><p><br></p>`;
    document.execCommand('insertHTML', false, sanitizeHtml(imgHtml));
    handleInput();
  }

  export function insertLink(url: string) {
    if (!editorElement) return;
    const safeUrl = sanitizeLinkUrl(url);
    if (!safeUrl) return;
    editorElement.focus();
    document.execCommand('createLink', false, safeUrl);
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
    document.execCommand('insertHTML', false, sanitizeHtml(tableHtml));
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
        // Briefly flash heading to highlight it
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

  export function replaceText(findStr: string, replaceStr: string, all: boolean = false) {
    if (!editorElement || !findStr) return;
    const html = editorElement.innerHTML;
    if (all) {
      const regex = new RegExp(findStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      setEditorHtml(html.replace(regex, replaceStr));
    } else {
      setEditorHtml(html.replace(findStr, replaceStr));
    }
  }

  export function setEditable(value: boolean) {
    isEditable = value;
    if (editorElement) editorElement.contentEditable = value ? 'true' : 'false';
  }

  export function setTrackChanges(value: boolean) {
    trackChangesOn = value;
  }

  /**
   * 'editing' allows typing, 'viewing' freezes the page, and 'suggesting'
   * turns edits into tracked suggestions instead of direct changes.
   */
  export function setEditorMode(mode: 'editing' | 'suggesting' | 'viewing') {
    editorMode = mode;
    if (!editorElement) return;
    if (mode === 'viewing') {
      editorElement.contentEditable = 'false';
    } else {
      editorElement.contentEditable = isEditable ? 'true' : 'false';
    }
    trackChangesOn = mode === 'suggesting';
  }

  export function suggestDelete() {
    // Keep the text and mark it as a suggested deletion, which is what a
    // reviewer can accept or reject. Strike-through alone is just formatting
    // and disappears on reload.
    markSelectionDeleted();
    if (!editorElement) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
    editorElement.focus();
    wrapSelection('del', 'tracked-deletion');
    handleInput();
  }

  export function setBlockStyle(property: string, value: string) {
    if (!editorElement) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    let node: HTMLElement | null = sel.anchorNode
      ? (sel.anchorNode.nodeType === Node.ELEMENT_NODE
          ? (sel.anchorNode as HTMLElement)
          : (sel.anchorNode.parentElement as HTMLElement | null))
      : null;
    while (node && node !== editorElement && !['P', 'H1', 'H2', 'H3', 'LI', 'BLOCKQUOTE', 'TD', 'TH', 'DIV'].includes(node.tagName)) {
      node = node.parentElement;
    }
    if (!node || node === editorElement) return;
    node.style.setProperty(property, value);
    handleInput();
  }

  export function insertInlineNode(html: string) {
    if (!editorElement) return;
    editorElement.focus();
    document.execCommand('insertHTML', false, sanitizeHtml(html));
    handleInput();
  }

  export function insertPageBreak() {
    insertInlineNode('<div class="doc-page-break"></div><p><br></p>');
  }

  /**
   * Inserts a footnote marker where the caret is and files the note body in the
   * document's footnote section. The previous version appended the note text
   * inline, so the note landed in the middle of the paragraph it referred to.
   */
  export function insertFootnoteRef(id: number) {
    if (!editorElement) return;
    footnoteTotal = Math.max(footnoteTotal, id);
    editorElement.focus();
    // `id` is a forbidden attribute under the sanitizer, so an anchor to a note
    // would link to a target that is stripped on the next save. The marker is
    // therefore a plain number matched to the trailing note list.
    document.execCommand('insertHTML', false, `<sup class="footnote-ref">${id}</sup>`);
    appendFootnote(id);
    handleInput();
  }

  /** Appends a note to the trailing footnote section, creating it if needed. */
  function appendFootnote(id: number) {
    if (!editorElement) return;
    let section = editorElement.querySelector('.document-footnotes');
    if (!section) {
      section = document.createElement('section');
      section.className = 'document-footnotes';
      const heading = document.createElement('hr');
      const title = document.createElement('h2');
      title.textContent = 'Footnotes';
      section.append(heading, title);
      editorElement.appendChild(section);
    }
    const entry = document.createElement('p');
    entry.className = 'footnote-entry';
    const label = document.createElement('strong');
    label.textContent = `${id}. `;
    entry.append(label, document.createTextNode(''));
    section.appendChild(entry);
  }

  /**
   * Anchors a comment to the live selection. The previous implementation
   * searched the raw HTML for the quoted text, which matched the first
   * textual occurrence anywhere in the document, including inside tags, and
   * could slice the markup mid-tag and corrupt it.
   */
  export function markComment(_quote: string, id: number) {
    if (!editorElement) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
    const range = sel.getRangeAt(0);
    if (!editorElement.contains(range.commonAncestorContainer)) return;

    const anchor = document.createElement('span');
    anchor.className = 'comment-anchor';
    anchor.setAttribute('title', `Comment ${id}`);
    try {
      range.surroundContents(anchor);
    } catch {
      anchor.appendChild(range.extractContents());
      range.insertNode(anchor);
    }
    sel.removeAllRanges();
    handleInput();
  }

  /** Wraps the current selection as a tracked deletion instead of removing it. */
  export function markSelectionDeleted() {
    if (!editorElement) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
    const range = sel.getRangeAt(0);
    if (!editorElement.contains(range.commonAncestorContainer)) return;

    const del = document.createElement('del');
    del.className = 'tracked-deletion';
    try {
      range.surroundContents(del);
    } catch {
      del.appendChild(range.extractContents());
      range.insertNode(del);
    }
    sel.removeAllRanges();
    handleInput();
  }

  export function insertCodeBlock() {
    insertInlineNode('<pre><code>// code block</code></pre><p><br></p>');
  }

  export function insertHighlight(color: string = '#fef08a') {
    if (!editorElement) return;
    editorElement.focus();
    document.execCommand('hiliteColor', false, color);
    handleInput();
  }

  function wrapSelection(tag: string, className: string) {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
    const range = sel.getRangeAt(0);
    const wrapper = document.createElement(tag);
    wrapper.className = className;
    try {
      range.surroundContents(wrapper);
    } catch {
      wrapper.appendChild(range.extractContents());
      range.insertNode(wrapper);
    }
    sel.removeAllRanges();
  }

  /**
   * Intercepts a destructive edit while suggesting is on and marks the text
   * instead of dropping it. Returns true when the event was handled.
   */
  function interceptTrackedDeletion(e: InputEvent): boolean {
    if (!trackChangesOn || !editorElement) return false;
    const type = e.inputType || '';
    if (!type.startsWith('delete')) return false;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return false;

    if (!sel.isCollapsed) {
      e.preventDefault();
      markSelectionDeleted();
      return true;
    }

    // A collapsed backspace has no range, so remove one character ourselves.
    const range = sel.getRangeAt(0);
    if (!editorElement.contains(range.startContainer)) return false;
    const node = range.startContainer;
    if (node.nodeType !== 3) return false;

    e.preventDefault();
    const textNode = node as Text;
    const size = type.includes('Backward') ? 1 : 1;
    const start = type.includes('Backward') ? Math.max(0, range.startOffset - size) : range.startOffset;
    const end = Math.min(textNode.data.length, range.startOffset + size);
    if (end <= start) return true;

    const del = document.createElement('del');
    del.className = 'tracked-deletion';
    try {
      const cut = document.createRange();
      cut.setStart(textNode, start);
      cut.setEnd(textNode, end);
      del.appendChild(cut.extractContents());
      textNode.parentNode?.insertBefore(del, textNode);
      const caret = document.createRange();
      caret.setStart(textNode, start);
      caret.collapse(true);
      sel.removeAllRanges();
      sel.addRange(caret);
    } catch {
      // Fall through and let the browser perform the deletion.
      return false;
    }
    handleInput();
    return true;
  }

  function insertTrackedHtml(html: string) {
    if (trackChangesOn) {
      document.execCommand('insertHTML', false, `<ins class="tracked-insertion">${html}</ins>`);
    } else {
      document.execCommand('insertHTML', false, html);
    }
  }

  /**
   * Track changes that actually track. Only programmatic inserts were wrapped
   * before, so anything typed at the keyboard landed untracked, which is the
   * behaviour a reviewer would trust least.
   *
   * `beforeinput` records the caret, and the following `input` wraps exactly the
   * text that appeared after it. Deletions are intercepted and turned into
   * tracked deletions rather than silently removing text.
   */
  let pendingAnchor: { node: Text; offset: number } | null = null;

  function handleBeforeInput() {
    if (!trackChangesOn) return;
    pendingAnchor = null;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const node = sel.getRangeAt(0).startContainer;
    pendingAnchor = { node: node as Text, offset: sel.getRangeAt(0).startOffset };
  }

  function wrapTrackedInsertion() {
    const anchor = pendingAnchor;
    pendingAnchor = null;
    if (!anchor || !editorElement) return;
    const { node, offset } = anchor;
    // The node may have been replaced by the browser during the edit.
    if (!node.parentNode || !editorElement.contains(node) || node.nodeType !== 3) return;
    if (node.data.length <= offset) return;
    if (node.parentElement?.closest('ins, del')) return;

    const range = document.createRange();
    try {
      range.setStart(node, offset);
      range.setEnd(node, node.data.length);
      const ins = document.createElement('ins');
      ins.className = 'tracked-insertion';
      ins.appendChild(range.extractContents());
      node.parentNode?.insertBefore(ins, node.nextSibling);
    } catch {
      // Leave the text untracked rather than losing it.
    }
  }

  function handleInput() {
    if (trackChangesOn) wrapTrackedInsertion();
    if (!editorElement) return;
    const html = sanitizeHtml(editorElement.innerHTML);
    const text = editorElement.innerText || '';
    const { words, chars } = countWordsAndChars(text);

    dispatch('change', {
      html,
      text,
      words,
      chars,
    });
  }

  onMount(() => {
    if (editorElement) {
      setEditorHtml(contentHtml);
    }
  });

  $: if (editorElement && safeContentHtml !== editorElement.innerHTML) {
    editorElement.innerHTML = safeContentHtml;
    handleInput();
  }

  $: columnStyle = columnCount > 1 ? `column-count: ${columnCount}; column-gap: 2rem;` : '';

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

<div class="relative flex-1 bg-slate-200/80 overflow-y-auto px-4 py-8 flex flex-col items-center">
  <!-- Document Page Canvas -->
  <div class="relative w-full flex justify-center">
    {#if watermark}
      <div
        class="doc-watermark"
        style="opacity:{watermarkOptions.opacity};transform:rotate({watermarkOptions.angle}deg);color:{watermarkOptions.color ?? '#0f172a'}"
        aria-hidden="true"
      >{watermark}</div>
    {/if}
  <div
    bind:this={editorElement}
    contenteditable={editorMode === 'viewing' ? 'false' : 'true'}
    spellcheck="true"
    role="textbox"
    tabindex="0"
    aria-multiline="true"
    class="document-page bg-white shadow-md hover:shadow-lg transition-all cursor-text text-slate-800 {dimensionClass}"
    style={(isPageless ? '' : marginStyle) + columnStyle}
    on:beforeinput={(e) => {
      if (!interceptTrackedDeletion(e)) handleBeforeInput();
    }}
    on:input={handleInput}
    on:keyup={handleInput}
  >
  </div>
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
  .doc-watermark {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 5rem;
    font-weight: 800;
    letter-spacing: 0.1em;
    pointer-events: none;
    user-select: none;
    z-index: 0;
  }
  :global(.doc-page-break) {
    break-after: page;
    page-break-after: always;
    height: 0;
    margin: 1.5rem 0;
    border-top: 1px dashed #cbd5e1;
  }
  :global(.document-page ins.tracked-insertion) {
    text-decoration: underline;
    text-decoration-color: #2563eb;
    background: rgba(37, 99, 235, 0.08);
    color: #1d4ed8;
  }
  :global(.document-page del.tracked-deletion) {
    color: #b91c1c;
    background: rgba(220, 38, 38, 0.08);
    text-decoration: line-through;
  }
  :global(.document-page .comment-anchor) {
    background: #fef3c7;
    border-bottom: 2px solid #f59e0b;
    cursor: help;
  }
  :global(.document-page .citation) {
    color: #1d4ed8;
    font-size: 0.85em;
  }
  :global(.document-page .footnote-ref a) {
    color: #1d4ed8;
    text-decoration: none;
    font-weight: 700;
  }
  :global(.document-page .document-footnotes) {
    margin-top: 2rem;
    border-top: 1px solid rgb(226 232 240);
    padding-top: 0.75rem;
    font-size: 0.8rem;
    color: rgb(71 85 105);
  }
  :global(.document-page .document-footnotes h2) {
    font-size: 0.8rem;
    font-weight: 600;
    margin-bottom: 0.5rem;
  }
  :global(.document-page sup.footnote-ref) {
    color: rgb(37 99 235);
    font-weight: 600;
    margin-left: 1px;
  }
  :global(.document-page .footnote-entry) {
    font-size: 0.8em;
    color: #64748b;
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
</style>
