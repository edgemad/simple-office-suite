<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import {
    Bold,
    Italic,
    Underline,
    Strikethrough,
    Link,
    Highlighter,
    MessageSquare,
    Baseline
  } from 'lucide-svelte';

  export let x: number = 0;
  export let y: number = 0;

  const dispatch = createEventDispatcher<{
    format: { command: string; value?: string };
    addComment: void;
  }>();

  function exec(command: string, value: string = '') {
    dispatch('format', { command, value });
  }

  function handleLink() {
    const url = prompt('Enter Hyperlink URL (e.g. https://google.com):');
    if (url) {
      exec('createLink', url);
    }
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="fixed z-50 bg-slate-900 text-white rounded-xl shadow-2xl px-2 py-1 flex items-center space-x-0.5 text-xs animate-in fade-in zoom-in-95 duration-100 select-none border border-slate-700 -translate-x-1/2 -translate-y-full mb-2"
  style="left: {x}px; top: {y}px;"
  on:click|stopPropagation
>
  <button
    class="p-1.5 rounded hover:bg-white/20 text-slate-200 hover:text-white transition-colors font-bold"
    on:click={() => exec('bold')}
    title="Bold (Ctrl+B)"
  >
    <Bold size={13} />
  </button>
  <button
    class="p-1.5 rounded hover:bg-white/20 text-slate-200 hover:text-white transition-colors"
    on:click={() => exec('italic')}
    title="Italic (Ctrl+I)"
  >
    <Italic size={13} />
  </button>
  <button
    class="p-1.5 rounded hover:bg-white/20 text-slate-200 hover:text-white transition-colors"
    on:click={() => exec('underline')}
    title="Underline (Ctrl+U)"
  >
    <Underline size={13} />
  </button>
  <button
    class="p-1.5 rounded hover:bg-white/20 text-slate-200 hover:text-white transition-colors"
    on:click={() => exec('strikeThrough')}
    title="Strikethrough"
  >
    <Strikethrough size={13} />
  </button>

  <div class="h-4 w-px bg-slate-700 mx-0.5"></div>

  <button
    class="p-1.5 rounded hover:bg-white/20 text-slate-200 hover:text-white transition-colors"
    on:click={handleLink}
    title="Insert Link"
  >
    <Link size={13} />
  </button>

  <button
    class="p-1.5 rounded hover:bg-white/20 text-amber-400 hover:text-amber-300 transition-colors"
    on:click={() => exec('hiliteColor', '#fef08a')}
    title="Highlight Yellow"
  >
    <Highlighter size={13} />
  </button>

  <div class="h-4 w-px bg-slate-700 mx-0.5"></div>

  <button
    class="flex items-center space-x-1 px-2 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-colors"
    on:click={() => dispatch('addComment')}
    title="Add Comment to selection"
  >
    <MessageSquare size={12} />
    <span class="text-[10px]">Comment</span>
  </button>
</div>
