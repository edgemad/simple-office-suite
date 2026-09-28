<script lang="ts">
  /**
   * ⌘K command palette.
   *
   * Rendering and keyboard handling only — matching lives in lib/commands.ts so
   * it can be tested without a DOM.
   */
  import { createEventDispatcher } from 'svelte';
  import { onMount, tick } from 'svelte';
  import { cycleIndex, highlightRuns, rankCommands, type Command } from '../../lib/commands';

  export let commands: Command[] = [];
  export let recentIds: string[] = [];

  const dispatch = createEventDispatcher<{ select: Command }>();

  let query = '';
  let activeIndex = 0;
  let inputEl: HTMLInputElement | undefined;
  let listEl: HTMLDivElement | undefined;

  $: results = rankCommands(commands, query, { recentIds });
  $: if (activeIndex >= results.length) activeIndex = Math.max(0, results.length - 1);

  onMount(() => {
    void tick().then(() => inputEl?.focus());
    // Keep focus inside the palette while it is open, so the window-level
    // keydown handler in App cannot act on a command the user did not pick.
    document.addEventListener('focusin', trapFocus, true);
    return () => document.removeEventListener('focusin', trapFocus, true);
  });

  function trapFocus(event: FocusEvent) {
    const root = listEl?.closest('[data-command-palette]') as HTMLElement | null;
    if (!root) return;
    if (!root.contains(event.target as Node)) {
      event.stopPropagation();
      inputEl?.focus();
    }
  }

  function select(command: Command | undefined) {
    if (!command) return;
    dispatch('select', command);
  }

  function onKeydown(event: KeyboardEvent) {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        activeIndex = cycleIndex(activeIndex, 1, results.length);
        scrollActiveIntoView();
        break;
      case 'ArrowUp':
        event.preventDefault();
        activeIndex = cycleIndex(activeIndex, -1, results.length);
        scrollActiveIntoView();
        break;
      case 'Home':
        event.preventDefault();
        activeIndex = 0;
        scrollActiveIntoView();
        break;
      case 'End':
        event.preventDefault();
        activeIndex = Math.max(0, results.length - 1);
        scrollActiveIntoView();
        break;
      case 'Enter':
        event.preventDefault();
        select(results[activeIndex]?.command);
        break;
      case 'Escape':
        event.preventDefault();
        event.stopPropagation();
        dispatch('select', undefined as unknown as Command);
        break;
    }
  }

  function scrollActiveIntoView() {
    void tick().then(() => {
      listEl
        ?.querySelector<HTMLElement>('[data-active="true"]')
        ?.scrollIntoView({ block: 'nearest' });
    });
  }

  function onInput() {
    activeIndex = 0;
  }

  /**
   * The dialog itself carries a keydown handler for a11y, but key events from
   * the search field bubble up here too — so only act when the dialog is
   * genuinely the target, otherwise every arrow press would move twice.
   */
  function onDialogKeydown(event: KeyboardEvent) {
    if (event.target !== event.currentTarget) return;
    onKeydown(event);
  }

  export function focusInput() {
    inputEl?.focus();
  }
</script>

<div
  data-command-palette
  class="lg-scrim fixed inset-0 z-[100] flex items-start justify-center pt-[12vh] px-4"
  role="dialog"
  aria-modal="true"
  aria-label="Command palette"
  tabindex="-1"
  on:click|self={() => dispatch('select', undefined as unknown as Command)}
  on:keydown={onDialogKeydown}
>
  <div
    class="glass glass--modal lg-enter w-full max-w-xl overflow-hidden flex flex-col"
    style="max-height: 70vh"
  >
    <!-- Search row -->
    <div class="flex items-center gap-3 px-4 h-14 border-b border-[color:var(--lg-edge)] shrink-0">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="2" stroke-linecap="round" class="text-[color:var(--lg-text-faint)] shrink-0">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <input
        bind:this={inputEl}
        bind:value={query}
        on:input={onInput}
        on:keydown={onKeydown}
        class="glass-input flex-1 h-9 px-3 text-sm border-0"
        style="background: transparent; box-shadow: none"
        placeholder="Search commands…"
        aria-label="Search commands"
        aria-autocomplete="list"
        aria-controls="command-palette-results"
        autocomplete="off"
        spellcheck="false"
      />
      <kbd class="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded border border-[color:var(--lg-edge-strong)] text-[color:var(--lg-text-faint)]">
        esc
      </kbd>
    </div>

    <!-- Results -->
    <div
      bind:this={listEl}
      id="command-palette-results"
      role="listbox"
      aria-label="Commands"
      class="flex-1 overflow-y-auto p-1.5 lg-scroll"
    >
      {#if results.length === 0}
        <div class="px-3 py-8 text-center">
          <p class="text-sm text-[color:var(--lg-text-dim)]">No matching commands</p>
          <p class="mt-1 text-[11px] text-[color:var(--lg-text-faint)]">
            Try “new”, “export”, “zoom”, or “theme”
          </p>
        </div>
      {:else}
        {#each results as result, index (result.command.id)}
          {@const active = index === activeIndex}
          <button
            role="option"
            aria-selected={active}
            data-active={active}
            class="w-full flex items-center gap-3 px-3 py-2 rounded-[10px] text-left transition-colors
                   {active ? 'bg-[color:var(--lg-accent-soft)]' : 'hover:bg-[color:var(--lg-hover)]'}"
            on:mouseenter={() => (activeIndex = index)}
            on:click={() => select(result.command)}
          >
            <span class="flex-1 min-w-0">
              <span class="block text-[13px] truncate">
                {#each highlightRuns(result.command.title, result.matches) as run, i (i)}
                  {#if run.hit}
                    <span class="font-semibold text-[color:var(--lg-accent)]">{run.text}</span>
                  {:else}
                    <span>{run.text}</span>
                  {/if}
                {/each}
              </span>
              <span class="block text-[10px] text-[color:var(--lg-text-faint)]">
                {result.command.category}
              </span>
            </span>
            {#if recentIds.includes(result.command.id)}
              <span class="shrink-0 text-[9px] uppercase tracking-wide text-[color:var(--lg-text-faint)]">
                recent
              </span>
            {/if}
            {#if active}
              <span class="shrink-0 text-[10px] text-[color:var(--lg-text-faint)]">↵</span>
            {/if}
          </button>
        {/each}
      {/if}
    </div>

    <!-- Footer legend -->
    <div
      class="shrink-0 px-4 h-9 border-t border-[color:var(--lg-edge)] flex items-center gap-4 text-[10px] text-[color:var(--lg-text-faint)]"
    >
      <span><kbd class="font-medium">↑</kbd> <kbd class="font-medium">↓</kbd> navigate</span>
      <span><kbd class="font-medium">↵</kbd> run</span>
      <span><kbd class="font-medium">esc</kbd> dismiss</span>
      <span class="ml-auto">{(commands.length).toLocaleString()} commands</span>
    </div>
  </div>
</div>
