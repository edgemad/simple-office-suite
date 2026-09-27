<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import {
    getMatchingFormulas,
    detectActiveFormula,
    type FormulaDefinition,
  } from './formulaDefinitions';
  import { FunctionSquare, Sparkles, CornerDownLeft, Info } from 'lucide-svelte';

  export let inputValue: string = '';
  export let smartSuggestion: string | null = null;
  export let selectedIndex: number = 0;

  const dispatch = createEventDispatcher<{
    select: { formula: FormulaDefinition; completedText: string };
    acceptSmartSuggestion: string;
    close: void;
  }>();

  // Detect state:
  // 1. Is user typing function name (e.g. =S, =SUM)?
  // 2. Is user inside arguments (e.g. =SUM(?
  // 3. Is user just at '=' with smart suggestion?

  $: isFormula = inputValue.trim().startsWith('=');
  $: activeFormulaInfo = isFormula ? detectActiveFormula(inputValue) : null;

  // Extract function search prefix when before '('
  $: searchPrefix = (() => {
    if (!isFormula || activeFormulaInfo) return '';
    const match = inputValue.match(/^=([A-Z0-9_]*)$/i);
    return match ? match[1] : '';
  })();

  $: showAutocomplete = isFormula && !activeFormulaInfo && inputValue.match(/^=[A-Za-z0-9_]*$/) !== null;
  $: suggestions = showAutocomplete ? getMatchingFormulas(searchPrefix) : [];

  $: if (suggestions.length > 0 && selectedIndex >= suggestions.length) {
    selectedIndex = 0;
  }

  export function moveSelection(delta: number): boolean {
    if (suggestions.length === 0) return false;
    selectedIndex = (selectedIndex + delta + suggestions.length) % suggestions.length;
    return true;
  }

  export function getSelectedFormula(): FormulaDefinition | null {
    if (suggestions.length === 0) return null;
    return suggestions[selectedIndex] || null;
  }

  function handleSelect(formula: FormulaDefinition) {
    const completed = `=${formula.name}(`;
    dispatch('select', { formula, completedText: completed });
  }

  function handleAcceptSmart() {
    if (smartSuggestion) {
      dispatch('acceptSmartSuggestion', smartSuggestion);
    }
  }

  function getCategoryColor(cat: string): string {
    switch (cat) {
      case 'Math':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'Statistical':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'Logical':
        return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'Text':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'Lookup':
        return 'bg-cyan-100 text-cyan-800 border-cyan-300';
      case 'Filter & Array':
        return 'bg-indigo-100 text-indigo-800 border-indigo-300';
      case 'Date & Time':
        return 'bg-rose-100 text-rose-800 border-rose-300';
      case 'Google':
        return 'bg-teal-100 text-teal-800 border-teal-300';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-300';
    }
  }
</script>

{#if isFormula}
  <div
    class="onlyoffice-suggestion-panel absolute z-50 bg-white rounded-lg shadow-2xl border border-slate-300 text-slate-800 select-none overflow-hidden text-xs min-w-[340px] max-w-[420px] transition-all animate-in fade-in zoom-in-95 duration-100"
    role="dialog"
    aria-label="Formula suggestions"
  >
    <!-- State 1: Smart Suggestion Banner (when just '=' or beginning of formula) -->
    {#if smartSuggestion && (inputValue === '=' || inputValue.trim() === '')}
      <div
        role="button"
        tabindex="0"
        class="bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-emerald-200 p-2.5 flex items-center justify-between cursor-pointer hover:bg-emerald-100/70 transition-colors"
        on:mousedown|preventDefault={handleAcceptSmart}
        on:keydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleAcceptSmart(); } }}
      >
        <div class="flex items-center space-x-2">
          <div class="w-6 h-6 rounded-md bg-emerald-600 text-white flex items-center justify-center shadow-sm">
            <Sparkles size={13} />
          </div>
          <div class="flex flex-col">
            <span class="text-[10px] font-semibold text-emerald-800 uppercase tracking-wider">Suggested Formula</span>
            <span class="font-mono font-bold text-emerald-950 text-xs">{smartSuggestion}</span>
          </div>
        </div>
        <div class="flex items-center space-x-1 px-1.5 py-0.5 rounded bg-emerald-200/80 text-[10px] text-emerald-800 font-mono font-semibold">
          <span>Tab</span>
          <CornerDownLeft size={10} />
        </div>
      </div>
    {/if}

    <!-- State 2: Parameter Syntax Helper Tooltip (When inside function arguments e.g. =SUM(A1, ) -->
    {#if activeFormulaInfo && activeFormulaInfo.def}
      {@const def = activeFormulaInfo.def}
      <div class="p-2.5 bg-slate-900 text-white border-l-4 border-emerald-500 shadow-inner">
        <div class="flex items-center justify-between mb-1">
          <div class="flex items-center space-x-1.5">
            <FunctionSquare size={14} class="text-emerald-400" />
            <span class="font-bold text-emerald-300 font-mono text-xs">{def.name}</span>
          </div>
          <span class="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 border border-slate-700 font-medium">
            {def.category}
          </span>
        </div>

        <!-- Syntax with active argument highlighted -->
        <div class="font-mono text-[11px] bg-slate-950/80 px-2 py-1 rounded border border-slate-800 text-slate-300 my-1.5 flex flex-wrap items-center">
          <span class="text-emerald-400 font-bold">{def.name}(</span>
          {#each def.args as arg, idx}
            {@const isActive = idx === activeFormulaInfo.argIndex}
            <span class="transition-colors {isActive ? 'text-white font-bold bg-emerald-700/80 px-1 rounded ring-1 ring-emerald-400' : 'text-slate-400'}">
              {arg}
            </span>
            {#if idx < def.args.length - 1}
              <span class="text-slate-500 mr-1">, </span>
            {/if}
          {/each}
          <span class="text-emerald-400 font-bold">)</span>
        </div>

        <div class="text-[10px] text-slate-300 flex items-start space-x-1 mt-1 leading-relaxed">
          <Info size={11} class="text-emerald-400 shrink-0 mt-0.5" />
          <span>{def.description}</span>
        </div>
      </div>

    <!-- State 3: Formula Autocomplete List (When typing =S, =SUM, etc.) -->
    {:else if showAutocomplete && suggestions.length > 0}
      <!-- Header Bar -->
      <div class="px-2.5 py-1.5 bg-slate-100 border-b border-slate-200 flex items-center justify-between text-[11px] text-slate-600 font-medium">
        <div class="flex items-center space-x-1.5">
          <FunctionSquare size={13} class="text-emerald-600" />
          <span>Formulas</span>
        </div>
        <span class="text-[10px] text-slate-400 font-mono">{suggestions.length} available</span>
      </div>

      <!-- Scrollable List of Matching Formulas -->
      <div class="max-h-56 overflow-y-auto divide-y divide-slate-100">
        {#each suggestions as formula, idx}
          {@const isHighlighted = idx === selectedIndex}
          <div
            role="button"
            tabindex="0"
            class="px-2.5 py-1.5 flex flex-col cursor-pointer transition-colors
              {isHighlighted ? 'bg-emerald-50 border-l-4 border-emerald-600 text-slate-900' : 'hover:bg-slate-50 text-slate-700'}"
            on:mousedown|preventDefault={() => handleSelect(formula)}
            on:keydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSelect(formula); } }}
          >
            <div class="flex items-center justify-between">
              <div class="flex items-center space-x-2">
                <span class="font-mono font-bold text-xs {isHighlighted ? 'text-emerald-700' : 'text-slate-800'}">
                  {formula.name}
                </span>
                <span class="font-mono text-[10px] text-slate-400">
                  {formula.syntax}
                </span>
              </div>
              <span class="text-[9px] font-semibold px-1.5 py-0.5 rounded border {getCategoryColor(formula.category)}">
                {formula.category}
              </span>
            </div>
            <p class="text-[10px] text-slate-500 mt-0.5 line-clamp-1">
              {formula.description}
            </p>
          </div>
        {/each}
      </div>

      <!-- Footer Instructions -->
      <div class="px-2.5 py-1 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-400 font-medium">
        <span>Press <kbd class="px-1 py-0.2 rounded bg-white border border-slate-200 text-slate-600 font-mono text-[9px]">Tab</kbd> or <kbd class="px-1 py-0.2 rounded bg-white border border-slate-200 text-slate-600 font-mono text-[9px]">Enter</kbd> to insert</span>
        <span>Use <kbd class="px-1 py-0.2 rounded bg-white border border-slate-200 text-slate-600 font-mono text-[9px]">↑↓</kbd> to navigate</span>
      </div>
    {/if}
  </div>
{/if}
