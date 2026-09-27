<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { FORMULA_CATALOG, type FormulaDefinition } from './formulaDefinitions';
  import { X, Search, FunctionSquare, Check, Sparkles } from 'lucide-svelte';

  const dispatch = createEventDispatcher<{
    insert: string;
    close: void;
  }>();

  let searchQuery = '';
  let selectedCategory: string = 'All';
  let selectedFormula: FormulaDefinition = FORMULA_CATALOG[0];

  const categories = [
    'All',
    'Lookup',
    'Filter & Array',
    'Math',
    'Statistical',
    'Logical',
    'Text',
    'Date & Time',
    'Google',
  ];

  $: filteredFormulas = FORMULA_CATALOG.filter((f) => {
    const matchesCat = selectedCategory === 'All' || f.category === selectedCategory;
    const matchesSearch =
      !searchQuery.trim() ||
      f.name.toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
      f.description.toLowerCase().includes(searchQuery.trim().toLowerCase());
    return matchesCat && matchesSearch;
  });

  $: if (filteredFormulas.length > 0 && !filteredFormulas.includes(selectedFormula)) {
    selectedFormula = filteredFormulas[0];
  }

  function handleInsert() {
    if (selectedFormula) {
      dispatch('insert', selectedFormula.example || `=${selectedFormula.name}()`);
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      dispatch('close');
    } else if (e.key === 'Enter') {
      handleInsert();
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

<!-- Modal Backdrop -->
<div
  class="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150 select-none"
  on:click|self={() => dispatch('close')}
  on:keydown={(e) => { if (e.key === 'Escape') dispatch('close'); }}
  role="dialog"
  tabindex="-1"
  aria-modal="true"
  aria-labelledby="insert-func-title"
>
  <!-- Modal Window -->
  <div class="bg-white rounded-xl shadow-2xl border border-slate-300 w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150">
    <!-- Header (OnlyOffice Style) -->
    <div class="px-5 py-3.5 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
      <div class="flex items-center space-x-2.5">
        <div class="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-sm">
          <FunctionSquare size={18} />
        </div>
        <div>
          <h3 id="insert-func-title" class="font-bold text-slate-800 text-sm">
            Insert Function
          </h3>
          <p class="text-[11px] text-slate-500">
            Select a formula to insert into the active spreadsheet cell
          </p>
        </div>
      </div>
      <button
        class="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors"
        on:click={() => dispatch('close')}
        title="Close dialog"
      >
        <X size={16} />
      </button>
    </div>

    <!-- Filter & Search Controls -->
    <div class="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-center gap-3">
      <!-- Search Input -->
      <div class="relative flex-1 w-full">
        <Search size={14} class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          bind:value={searchQuery}
          placeholder="Search for function or keyword (e.g. SUM, average, count)..."
          class="w-full h-8 pl-8 pr-3 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all shadow-inner"
        />
      </div>

      <!-- Category Filter -->
      <div class="w-full sm:w-auto">
        <select
          bind:value={selectedCategory}
          class="w-full h-8 px-3 bg-white border border-slate-300 rounded-lg text-xs text-slate-700 outline-none focus:border-emerald-500 cursor-pointer font-medium"
        >
          {#each categories as cat}
            <option value={cat}>{cat === 'All' ? 'All Categories' : cat}</option>
          {/each}
        </select>
      </div>
    </div>

    <!-- Main Content Area: Split View -->
    <div class="flex-1 flex flex-col md:flex-row overflow-hidden min-h-[300px]">
      <!-- Left: Function List -->
      <div class="w-full md:w-5/12 border-r border-slate-200 overflow-y-auto divide-y divide-slate-100 bg-white">
        {#if filteredFormulas.length === 0}
          <div class="p-6 text-center text-slate-400 text-xs">
            No functions found matching "{searchQuery}"
          </div>
        {:else}
          {#each filteredFormulas as formula}
            {@const isSelected = selectedFormula.name === formula.name}
            <button
              class="w-full px-4 py-2.5 text-left flex items-center justify-between transition-colors
                {isSelected ? 'bg-emerald-50 text-emerald-900 border-l-4 border-emerald-600 font-semibold' : 'hover:bg-slate-50 text-slate-700'}"
              on:click={() => (selectedFormula = formula)}
              on:dblclick={handleInsert}
            >
              <div class="flex flex-col">
                <span class="font-mono text-xs">{formula.name}</span>
                <span class="text-[10px] text-slate-400 font-normal">{formula.category}</span>
              </div>
              {#if isSelected}
                <Check size={14} class="text-emerald-600" />
              {/if}
            </button>
          {/each}
        {/if}
      </div>

      <!-- Right: Detailed Documentation & Example Preview -->
      <div class="w-full md:w-7/12 p-5 bg-slate-50 overflow-y-auto flex flex-col justify-between">
        {#if selectedFormula}
          <div class="space-y-4">
            <div>
              <div class="flex items-center space-x-2">
                <span class="text-lg font-bold font-mono text-slate-900">{selectedFormula.name}</span>
                <span class="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold border border-emerald-200">
                  {selectedFormula.category}
                </span>
              </div>
              <p class="text-xs text-slate-600 mt-1 leading-relaxed">
                {selectedFormula.description}
              </p>
            </div>

            <!-- Syntax Card -->
            <div class="p-3 bg-white rounded-lg border border-slate-200 shadow-xs">
              <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Syntax
              </span>
              <div class="font-mono text-xs text-emerald-800 font-semibold bg-emerald-50/60 p-2 rounded border border-emerald-100 select-text">
                {selectedFormula.syntax}
              </div>
            </div>

            <!-- Arguments Breakdown -->
            {#if selectedFormula.args.length > 0}
              <div class="p-3 bg-white rounded-lg border border-slate-200 shadow-xs">
                <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                  Arguments
                </span>
                <div class="flex flex-wrap gap-1.5">
                  {#each selectedFormula.args as arg}
                    <span class="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[11px] border border-slate-200">
                      {arg}
                    </span>
                  {/each}
                </div>
              </div>
            {/if}

            <!-- Example Usage -->
            <div class="p-3 bg-white rounded-lg border border-slate-200 shadow-xs">
              <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Example Usage
              </span>
              <div class="font-mono text-xs text-slate-800 bg-slate-100 p-2 rounded border border-slate-200 select-text">
                {selectedFormula.example}
              </div>
            </div>
          </div>
        {:else}
          <div class="flex-1 flex items-center justify-center text-slate-400 text-xs">
            Select a function to view details
          </div>
        {/if}
      </div>
    </div>

    <!-- Footer Controls -->
    <div class="px-5 py-3 bg-slate-100 border-t border-slate-200 flex items-center justify-between">
      <span class="text-[11px] text-slate-500 font-mono">
        Double click any function to insert immediately
      </span>
      <div class="flex items-center space-x-2">
        <button
          class="px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-200 transition-colors"
          on:click={() => dispatch('close')}
        >
          Cancel
        </button>
        <button
          class="flex items-center space-x-1.5 px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition-colors"
          on:click={handleInsert}
        >
          <Sparkles size={13} />
          <span>Insert Function</span>
        </button>
      </div>
    </div>
  </div>
</div>
