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

  const dispatch = createEventDispatcher<{
    change: { html: string; text: string; words: number; chars: number };
  }>();

  let editorElement: HTMLDivElement;

  $: safeContentHtml = sanitizeHtml(contentHtml);

  function setEditorHtml(html: string) {
    if (!editorElement) return;
    editorElement.innerHTML = sanitizeHtml(html);
    handleInput();
  }

  export function execCommand(command: string, value: string = '') {
    if (!editorElement) return;
    editorElement.focus();
    document.execCommand(command, false, value);
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

  function handleInput() {
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

<div class="flex-1 bg-slate-200/80 overflow-y-auto px-4 py-8 flex flex-col items-center">
  <!-- Document Page Canvas -->
  <div
    bind:this={editorElement}
    contenteditable="true"
    spellcheck="true"
    role="textbox"
    tabindex="0"
    aria-multiline="true"
    class="document-page bg-white shadow-md hover:shadow-lg transition-all cursor-text text-slate-800 {dimensionClass}"
    style={isPageless ? '' : marginStyle}
    on:input={handleInput}
    on:keyup={handleInput}
  >
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
</style>
