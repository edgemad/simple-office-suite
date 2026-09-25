<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { countWordsAndChars } from '../../lib/utils';

  export let contentHtml: string = '';
  export let pageSize: 'a4' | 'letter' = 'a4';

  const dispatch = createEventDispatcher<{
    change: { html: string; text: string; words: number; chars: number };
  }>();

  let editorElement: HTMLDivElement;

  export function execCommand(command: string, value: string = '') {
    if (!editorElement) return;
    editorElement.focus();
    document.execCommand(command, false, value);
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

  export function insertTable() {
    if (!editorElement) return;
    editorElement.focus();
    const tableHtml = `
      <table style="width: 100%; border-collapse: collapse; margin: 1rem 0;">
        <thead>
          <tr>
            <th style="border: 1px solid #cbd5e1; padding: 8px 12px; background: #f8fafc; text-align: left;">Header 1</th>
            <th style="border: 1px solid #cbd5e1; padding: 8px 12px; background: #f8fafc; text-align: left;">Header 2</th>
            <th style="border: 1px solid #cbd5e1; padding: 8px 12px; background: #f8fafc; text-align: left;">Header 3</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="border: 1px solid #cbd5e1; padding: 8px 12px;">Cell 1</td>
            <td style="border: 1px solid #cbd5e1; padding: 8px 12px;">Cell 2</td>
            <td style="border: 1px solid #cbd5e1; padding: 8px 12px;">Cell 3</td>
          </tr>
          <tr>
            <td style="border: 1px solid #cbd5e1; padding: 8px 12px;">Data A</td>
            <td style="border: 1px solid #cbd5e1; padding: 8px 12px;">Data B</td>
            <td style="border: 1px solid #cbd5e1; padding: 8px 12px;">Data C</td>
          </tr>
        </tbody>
      </table>
      <p><br></p>
    `;
    document.execCommand('insertHTML', false, tableHtml);
    handleInput();
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
</script>

<div class="flex-1 bg-slate-100 overflow-y-auto px-4 py-8 flex flex-col items-center">
  <!-- Document Page Canvas -->
  <div
    bind:this={editorElement}
    contenteditable="true"
    spellcheck="true"
    role="textbox"
    aria-multiline="true"
    class="document-page shadow-md hover:shadow-lg transition-all cursor-text {pageSize === 'letter' ? 'w-[8.5in] min-h-[11in]' : 'w-[210mm] min-h-[297mm]'}"
    on:input={handleInput}
    on:keyup={handleInput}
  >
  </div>
</div>
