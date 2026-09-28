<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { ListTree, X, ChevronRight,  Bookmark } from '@lucide/svelte';
  import type { DocumentHeading } from '../../types';

  export let contentHtml: string = '';
  export let isOpen: boolean = true;

  const dispatch = createEventDispatcher<{
    close: void;
    jumpToHeading: { id: string; text: string; level: number };
    insertToc: void;
  }>();

  let headings: DocumentHeading[] = [];

  // Extract H1, H2, H3 headings reactively from contentHtml
  $: {
    if (typeof window !== 'undefined' && contentHtml) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(contentHtml, 'text/html');
      const nodes = doc.querySelectorAll('h1, h2, h3, h4');
      const list: DocumentHeading[] = [];

      nodes.forEach((node, idx) => {
        const text = node.textContent?.trim() || '';
        if (text) {
          const level = parseInt(node.tagName.substring(1), 10);
          const id = node.id || `heading-${idx}-${text.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
          list.push({ id, text, level });
        }
      });
      headings = list;
    } else {
      headings = [];
    }
  }

  function handleJump(h: DocumentHeading) {
    dispatch('jumpToHeading', h);
  }
</script>

{#if isOpen}
  <aside
    class="glass glass--panel w-64 flex flex-col h-full select-none text-xs transition-all z-10 shrink-0 text-[color:var(--lg-text)]"
  >
    <!-- Header -->
    <div class="h-10 px-3 border-b border-slate-200 flex items-center justify-between bg-white text-slate-700">
      <div class="flex items-center space-x-1.5 font-semibold text-slate-800">
        <ListTree size={15} class="text-blue-600" />
        <span>Document Outline</span>
      </div>
      <div class="flex items-center space-x-1">
        <button
          class="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700"
          on:click={() => dispatch('close')}
          title="Close Outline"
        >
          <X size={14} />
        </button>
      </div>
    </div>

    <!-- Quick Action: Insert TOC -->
    <div class="p-2 border-b border-slate-200 bg-white/60">
      <button
        class="w-full py-1.5 px-2 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md text-blue-700 font-medium flex items-center justify-center space-x-1.5 transition-colors"
        on:click={() => dispatch('insertToc')}
        title="Insert clickable Table of Contents into document"
      >
        <Bookmark size={13} />
        <span>Insert Table of Contents</span>
      </button>
    </div>

    <!-- Headings List -->
    <div class="flex-1 overflow-y-auto p-2 space-y-1">
      {#if headings.length === 0}
        <div class="p-4 text-center text-slate-400 text-xs">
          <p class="font-medium mb-1">No headings yet</p>
          <p class="text-[11px] leading-relaxed">
            Headings (H1, H2, H3) you add to the document will appear here to create a clickable outline.
          </p>
        </div>
      {:else}
        {#each headings as h}
          <button
            class="w-full text-left px-2 py-1.5 rounded hover:bg-blue-50 hover:text-blue-700 flex items-start space-x-1.5 transition-colors text-slate-700 group
              {h.level === 1 ? 'font-semibold text-slate-900' : h.level === 2 ? 'pl-4 font-medium text-slate-700' : 'pl-6 text-slate-600'}"
            on:click={() => handleJump(h)}
            title="Jump to {h.text}"
          >
            <ChevronRight
              size={12}
              class="mt-0.5 shrink-0 text-slate-300 group-hover:text-blue-500 transition-colors"
            />
            <span class="truncate flex-1">{h.text}</span>
          </button>
        {/each}
      {/if}
    </div>

    <!-- Footer Stats summary -->
    <div class="p-2.5 border-t border-slate-200 bg-white text-[11px] text-slate-500 flex items-center justify-between">
      <span>{headings.length} heading{headings.length === 1 ? '' : 's'}</span>
      <span class="text-slate-400">Google Docs Outline</span>
    </div>
  </aside>
{/if}
