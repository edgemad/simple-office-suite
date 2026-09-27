<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { X, Search, Sparkles } from 'lucide-svelte';

  export let isOpen: boolean = false;

  const dispatch = createEventDispatcher<{
    close: void;
    insert: { char: string };
  }>();

  let searchQuery = '';
  let activeCategory: 'math' | 'arrows' | 'currency' | 'symbols' | 'greek' | 'accents' = 'math';

  const categories = [
    { id: 'math', label: 'Math & Logic' },
    { id: 'arrows', label: 'Arrows' },
    { id: 'currency', label: 'Currency' },
    { id: 'symbols', label: 'Symbols' },
    { id: 'greek', label: 'Greek' },
    { id: 'accents', label: 'Accents' },
  ] as const;

  const characterMap: Record<string, string[]> = {
    math: ['±', '×', '÷', '≠', '≤', '≥', '≈', '≡', '√', '∞', '∫', '∑', '∏', '∂', '∇', '∈', '∉', '∩', '∪', '⊂', '⊃', '⊆', '⊇', '∧', '∨', '¬', '∀', '∃', '∴', '∵', '‰', '‱', '°', '′', '″', '¼', '½', '¾', '⅓', '⅔', '⅛', '⅜', '⅝', '⅞', '²', '³', 'ⁿ', '⁺', '⁻', '⁼'],
    arrows: ['←', '→', '↑', '↓', '↔', '↕', '↖', '↗', '↘', '↙', '⇄', '⇆', '⇒', '⇐', '⇑', '⇓', '⇔', '➔', '➜', '➤', '↵', '↳', '↩', '↻', '↺', '⇒', '⇌', '⇋', '⇠', '⇢', '⇡', '⇣'],
    currency: ['$', '€', '£', '¥', '₱', '₹', '₩', '₿', '¢', '¤', '฿', '₫', '₪', '₸', '₺', '₴', '₲', '₵', '₭', '₮', '₦', '₡'],
    symbols: ['©', '®', '™', '•', '‣', '⁃', '¶', '§', '†', '‡', '※', '⁂', '—', '–', '«', '»', '“', '”', '‘', '’', '‹', '›', '¡', '¿', '‽', '◊', '♠', '♣', '♥', '♦', '★', '☆', '✦', '✧', '✔', '✖', '✉', '☎', '✓', '✗'],
    greek: ['α', 'β', 'γ', 'δ', 'ε', 'ζ', 'η', 'θ', 'ι', 'κ', 'λ', 'μ', 'ν', 'ξ', 'ο', 'π', 'ρ', 'σ', 'τ', 'υ', 'φ', 'χ', 'ψ', 'ω', 'Α', 'Β', 'Γ', 'Δ', 'Ε', 'Ζ', 'Η', 'Θ', 'Ι', 'Κ', 'Λ', 'Μ', 'Ν', 'Ξ', 'Ο', 'Π', 'Ρ', 'Σ', 'Τ', 'Υ', 'Φ', 'Χ', 'Ψ', 'Ω'],
    accents: ['à', 'á', 'â', 'ã', 'ä', 'å', 'æ', 'ç', 'è', 'é', 'ê', 'ë', 'ì', 'í', 'î', 'ï', 'ð', 'ñ', 'ò', 'ó', 'ô', 'õ', 'ö', 'ø', 'ù', 'ú', 'û', 'ü', 'ý', 'þ', 'ÿ', 'À', 'Á', 'Â', 'Ã', 'Ä', 'Å', 'Æ', 'Ç', 'È', 'É', 'Ê', 'Ë', 'Ì', 'Í', 'Î', 'Ï', 'Ñ', 'Ò', 'Ó', 'Ô', 'Õ', 'Ö', 'Ø', 'Ù', 'Ú', 'Û', 'Ü', 'Ý'],
  };

  $: displayChars = (() => {
    const list = characterMap[activeCategory] || [];
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase().trim();
    // Search across all categories if user typed search
    let all: string[] = [];
    Object.values(characterMap).forEach((chars) => {
      all = all.concat(chars);
    });
    return all.filter((c) => c.toLowerCase().includes(q));
  })();

  function handleSelect(char: string) {
    dispatch('insert', { char });
  }
</script>

{#if isOpen}
  <div class="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="bg-white rounded-2xl shadow-2xl border border-slate-200 p-5 w-full max-w-lg text-xs text-slate-700 animate-in fade-in zoom-in-95 duration-100 flex flex-col max-h-[85vh]"
      on:click|stopPropagation
    >
      <!-- Header -->
      <div class="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
        <div class="flex items-center space-x-2">
          <div class="w-7 h-7 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
            Ω
          </div>
          <div>
            <h3 class="font-bold text-sm text-slate-800">Insert Special Characters</h3>
            <p class="text-[11px] text-slate-500">Click any symbol or character to insert at cursor</p>
          </div>
        </div>
        <button
          class="p-1 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
          on:click={() => dispatch('close')}
        >
          <X size={16} />
        </button>
      </div>

      <!-- Search & Categories Bar -->
      <div class="space-y-2 mb-3">
        <div class="flex items-center space-x-2 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
          <Search size={14} class="text-slate-400" />
          <input
            type="text"
            placeholder="Search characters or paste symbol..."
            bind:value={searchQuery}
            class="bg-transparent outline-none text-xs w-full text-slate-800"
          />
          {#if searchQuery}
            <button on:click={() => (searchQuery = '')} class="text-slate-400 hover:text-slate-600">
              <X size={13} />
            </button>
          {/if}
        </div>

        {#if !searchQuery}
          <div class="flex items-center space-x-1 overflow-x-auto pb-1 border-b border-slate-100">
            {#each categories as cat}
              <button
                class="px-2.5 py-1 rounded-md text-[11px] font-medium whitespace-nowrap transition-colors {activeCategory === cat.id
                  ? 'bg-blue-600 text-white font-semibold'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}"
                on:click={() => (activeCategory = cat.id)}
              >
                {cat.label}
              </button>
            {/each}
          </div>
        {/if}
      </div>

      <!-- Characters Grid -->
      <div class="flex-1 overflow-y-auto min-h-[220px] max-h-[300px] p-2 bg-slate-50/50 rounded-xl border border-slate-200">
        <div class="grid grid-cols-8 sm:grid-cols-10 gap-1.5">
          {#each displayChars as char}
            <button
              class="w-9 h-9 rounded-lg bg-white border border-slate-200 hover:border-blue-500 hover:bg-blue-50 text-slate-800 hover:text-blue-700 font-sans text-base flex items-center justify-center transition-all shadow-2xs hover:scale-110 active:scale-95"
              on:click={() => handleSelect(char)}
              title="Insert {char}"
            >
              {char}
            </button>
          {/each}
        </div>
      </div>

      <!-- Footer -->
      <div class="pt-3 border-t border-slate-100 mt-3 flex items-center justify-between">
        <span class="text-[10px] text-slate-400">Characters are inserted without closing the picker</span>
        <button
          class="px-4 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold text-xs transition-colors"
          on:click={() => dispatch('close')}
        >
          Done
        </button>
      </div>
    </div>
  </div>
{/if}
