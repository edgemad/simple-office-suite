<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { countWordsAndChars } from '../../lib/utils';

  export let contentHtml: string = '';

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

  export function insertTable() {
    if (!editorElement) return;
    editorElement.focus();
    const tableHtml = `
      <table style="width: 100%; border-collapse: collapse; margin: 1rem 0;">
        <thead>
          <tr>
            <th style="border: 1px solid #cbd5e1; padding: 8px; background: #f8fafc;">Header 1</th>
            <th style="border: 1px solid #cbd5e1; padding: 8px; background: #f8fafc;">Header 2</th>
            <th style="border: 1px solid #cbd5e1; padding: 8px; background: #f8fafc;">Header 3</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="border: 1px solid #cbd5e1; padding: 8px;">Cell 1</td>
            <td style="border: 1px solid #cbd5e1; padding: 8px;">Cell 2</td>
            <td style="border: 1px solid #cbd5e1; padding: 8px;">Cell 3</td>
          </tr>
          <tr>
            <td style="border: 1px solid #cbd5e1; padding: 8px;">Data A</td>
            <td style="border: 1px solid #cbd5e1; padding: 8px;">Data B</td>
            <td style="border: 1px solid #cbd5e1; padding: 8px;">Data C</td>
          </tr>
        </tbody>
      </table>
      <p><br></p>
    `;
    document.execCommand('insertHTML', false, tableHtml);
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

  // Watch for external content resets (e.g. File Open)
  $: if (editorElement && contentHtml !== editorElement.innerHTML) {
    editorElement.innerHTML = contentHtml;
    handleInput();
  }
</script>

<div class="flex-1 bg-slate-100 overflow-y-auto px-4 py-8 flex flex-col items-center">
  <!-- A4 Document Page Canvas -->
  <div
    bind:this={editorElement}
    contenteditable="true"
    spellcheck="true"
    class="document-page shadow-md hover:shadow-lg transition-shadow cursor-text"
    on:input={handleInput}
    on:keyup={handleInput}
  >
  </div>
</div>
