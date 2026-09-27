<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import {
    Heading1,
    Heading2,
    Heading3,
    Table,
    List,
    ListOrdered,
    ListChecks,
    MessageSquareQuote,
    Quote,
    Code,
    Minus,
    Calendar,
    Stamp,
    Sparkles
  } from 'lucide-svelte';

  export let x: number = 0;
  export let y: number = 0;
  export let filterText: string = '';

  const dispatch = createEventDispatcher<{
    select: { command: string; value?: string };
    close: void;
  }>();

  let selectedIndex = 0;

  interface SlashItem {
    id: string;
    title: string;
    description: string;
    icon: any;
    command: string;
    value?: string;
  }

  const items: SlashItem[] = [
    { id: 'h1', title: 'Heading 1', description: 'Big section heading', icon: Heading1, command: 'formatBlock', value: 'h1' },
    { id: 'h2', title: 'Heading 2', description: 'Medium subsection', icon: Heading2, command: 'formatBlock', value: 'h2' },
    { id: 'h3', title: 'Heading 3', description: 'Small section title', icon: Heading3, command: 'formatBlock', value: 'h3' },
    { id: 'todo', title: 'To-do checklist', description: 'Track tasks with checkboxes', icon: ListChecks, command: 'insertChecklist' },
    { id: 'bullet', title: 'Bulleted list', description: 'Create a simple bulleted list', icon: List, command: 'insertUnorderedList' },
    { id: 'number', title: 'Numbered list', description: 'Create a numbered sequence', icon: ListOrdered, command: 'insertOrderedList' },
    { id: 'table', title: 'Table', description: 'Insert a 3x3 table', icon: Table, command: 'insertTable' },
    { id: 'callout', title: 'Callout box', description: 'Highlighted info or tip box', icon: MessageSquareQuote, command: 'insertCallout' },
    { id: 'quote', title: 'Quote', description: 'Capture a block quote', icon: Quote, command: 'formatBlock', value: 'blockquote' },
    { id: 'code', title: 'Code block', description: 'Code snippet with syntax background', icon: Code, command: 'formatBlock', value: 'pre' },
    { id: 'divider', title: 'Horizontal divider', description: 'Visually divide sections', icon: Minus, command: 'insertHorizontalRule' },
    { id: 'date', title: 'Today\'s date', description: 'Insert formatted current date', icon: Calendar, command: 'insertDate' },
  ];

  $: filteredItems = items.filter((item) => {
    if (!filterText.trim()) return true;
    const q = filterText.toLowerCase().trim();
    return item.title.toLowerCase().includes(q) || item.id.includes(q) || item.description.toLowerCase().includes(q);
  });

  $: if (filteredItems.length > 0 && selectedIndex >= filteredItems.length) {
    selectedIndex = filteredItems.length - 1;
  }

  export function handleKeydown(e: KeyboardEvent): boolean {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIndex = (selectedIndex + 1) % Math.max(1, filteredItems.length);
      return true;
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIndex = (selectedIndex - 1 + filteredItems.length) % Math.max(1, filteredItems.length);
      return true;
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredItems[selectedIndex]) {
        dispatch('select', {
          command: filteredItems[selectedIndex].command,
          value: filteredItems[selectedIndex].value,
        });
      }
      return true;
    } else if (e.key === 'Escape') {
      e.preventDefault();
      dispatch('close');
      return true;
    }
    return false;
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="fixed z-50 bg-white rounded-xl shadow-2xl border border-slate-200 p-1.5 w-64 max-h-72 overflow-y-auto text-xs text-slate-700 animate-in fade-in zoom-in-95 duration-100 select-none"
  style="left: {x}px; top: {y}px;"
  on:click|stopPropagation
>
  <div class="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 mb-1">
    Basic Blocks
  </div>

  {#if filteredItems.length === 0}
    <div class="py-4 text-center text-slate-400 text-xs">
      No matching blocks
    </div>
  {:else}
    {#each filteredItems as item, idx}
      <button
        class="w-full text-left px-2.5 py-1.5 rounded-lg flex items-center space-x-2.5 transition-colors {selectedIndex === idx
          ? 'bg-blue-600 text-white font-medium shadow-2xs'
          : 'hover:bg-slate-100 text-slate-700'}"
        on:click={() => dispatch('select', { command: item.command, value: item.value })}
        on:mouseenter={() => (selectedIndex = idx)}
      >
        <div class="w-6 h-6 rounded flex items-center justify-center {selectedIndex === idx ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}">
          <svelte:component this={item.icon} size={14} />
        </div>
        <div class="flex-1 truncate">
          <div class="text-xs leading-tight font-semibold {selectedIndex === idx ? 'text-white' : 'text-slate-800'}">
            {item.title}
          </div>
          <div class="text-[10px] leading-tight {selectedIndex === idx ? 'text-blue-100' : 'text-slate-400'}">
            {item.description}
          </div>
        </div>
      </button>
    {/each}
  {/if}
</div>
