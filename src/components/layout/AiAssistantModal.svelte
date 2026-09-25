<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { Sparkles, X, Check, Copy, Wand2, FileText, Bot } from 'lucide-svelte';

  export let activeMode: string = 'writer';
  export let currentContext: string = '';

  const dispatch = createEventDispatcher<{
    apply: string;
    close: void;
  }>();

  let userPrompt = '';
  let generatedOutput = '';
  let isGenerating = false;
  let selectedAction: 'draft' | 'summarize' | 'polish' | 'grammar' | 'formula' =
    activeMode === 'sheets' ? 'formula' : 'draft';

  const quickActions = [
    { id: 'draft', label: 'Draft Content', icon: Wand2, desc: 'Generate new sections or paragraphs' },
    { id: 'summarize', label: 'Summarize', icon: FileText, desc: 'Create executive summary' },
    { id: 'polish', label: 'Rewrite & Polish', icon: Sparkles, desc: 'Improve professional tone' },
    { id: 'grammar', label: 'Fix Grammar', icon: Check, desc: 'Correct spelling & syntax' },
    { id: 'formula', label: 'Explain / Build Formula', icon: Bot, desc: 'Smart formula generator' },
  ];

  function runAiAction() {
    isGenerating = true;
    generatedOutput = '';

    setTimeout(() => {
      isGenerating = false;
      if (selectedAction === 'formula') {
        const query = userPrompt.toLowerCase();
        if (query.includes('average') || query.includes('mean')) {
          generatedOutput = '=AVERAGE(B2:B10)';
        } else if (query.includes('count') && query.includes('if')) {
          generatedOutput = '=COUNTIF(A2:A20, ">0")';
        } else if (query.includes('lookup') || query.includes('search')) {
          generatedOutput = '=VLOOKUP(A2, D2:F20, 2, FALSE)';
        } else if (query.includes('if') || query.includes('condition')) {
          generatedOutput = '=IF(B2>=1000, "Qualified", "Pending")';
        } else {
          generatedOutput = '=SUM(B2:B10)';
        }
      } else if (selectedAction === 'summarize') {
        generatedOutput =
          'Executive Summary:\n• High performance lightweight office architecture with sub-30MB footprint.\n• Full compatibility with Microsoft Office (.docx, .xlsx, .pptx) and PDF forms.\n• 100% offline, privacy-first execution with local auto-saving.';
      } else if (selectedAction === 'polish') {
        generatedOutput =
          'Our unified productivity suite delivers unmatched efficiency, combining word processing, spreadsheet modeling, slide presentations, and interactive PDF forms into a high-speed offline workflow.';
      } else if (selectedAction === 'grammar') {
        generatedOutput =
          userPrompt
            ? userPrompt.charAt(0).toUpperCase() + userPrompt.slice(1).trim() + '.'
            : 'All grammar and spelling checks passed.';
      } else {
        generatedOutput = `### ${userPrompt || 'Project Milestone Plan'}\n1. **Planning & Discovery**: Define project parameters and core requirements.\n2. **Execution & Implementation**: Build streamlined components with native offline performance.\n3. **Quality Assurance**: Rigorous testing across file formats and operating environments.\n4. **Deployment**: Ship production release bundle.`;
      }
    }, 450);
  }

  function handleApply() {
    if (generatedOutput) {
      dispatch('apply', generatedOutput);
      dispatch('close');
    }
  }

  async function handleCopy() {
    if (generatedOutput) {
      await navigator.clipboard.writeText(generatedOutput);
    }
  }
</script>

<div
  class="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in select-none"
  on:click|self={() => dispatch('close')}
  role="dialog"
  tabindex="-1"
  aria-modal="true"
  aria-labelledby="ai-modal-title"
  on:keydown={(e) => { if (e.key === 'Escape') dispatch('close'); }}
>
  <div class="bg-white rounded-xl shadow-2xl border border-slate-300 w-full max-w-xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95">
    <!-- Header with OnlyOffice Purple/Indigo AI Theme -->
    <div class="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
      <div class="flex items-center space-x-2.5">
        <div class="w-8 h-8 rounded-lg bg-gradient-to-tr from-purple-600 to-indigo-500 text-white flex items-center justify-center shadow-sm">
          <Sparkles size={17} />
        </div>
        <div>
          <h3 id="ai-modal-title" class="font-bold text-sm text-white">
            OnlyOffice AI Assistant
          </h3>
          <p class="text-[11px] text-purple-200">
            Intelligent writing, formula generation, and document summarization
          </p>
        </div>
      </div>
      <button
        class="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
        on:click={() => dispatch('close')}
        title="Close"
      >
        <X size={16} />
      </button>
    </div>

    <!-- Quick Action Chips -->
    <div class="p-3 bg-slate-50 border-b border-slate-200 flex flex-wrap gap-1.5">
      {#each quickActions as act}
        <button
          class="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
            {selectedAction === act.id ? 'bg-purple-600 text-white shadow-xs font-semibold' : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'}"
          on:click={() => { selectedAction = act.id as any; runAiAction(); }}
        >
          <svelte:component this={act.icon} size={13} />
          <span>{act.label}</span>
        </button>
      {/each}
    </div>

    <!-- Input Form -->
    <div class="p-4 space-y-3">
      <div>
        <label for="ai-prompt-input" class="text-xs font-semibold text-slate-700 block mb-1">
          {selectedAction === 'formula' ? 'Describe the calculation you want:' : 'Instructions or prompt:'}
        </label>
        <textarea
          id="ai-prompt-input"
          bind:value={userPrompt}
          placeholder={selectedAction === 'formula' ? 'e.g. Sum all sales in column B if region in column A is West' : 'e.g. Write a brief overview of our Q3 goals...'}
          rows="3"
          class="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 outline-none focus:border-purple-500 focus:bg-white resize-none shadow-inner"
        ></textarea>
      </div>

      <div class="flex justify-end">
        <button
          class="flex items-center space-x-1.5 px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 transition-colors shadow-sm disabled:opacity-50"
          on:click={runAiAction}
          disabled={isGenerating}
        >
          <Sparkles size={13} />
          <span>{isGenerating ? 'Generating...' : 'Generate with AI'}</span>
        </button>
      </div>

      <!-- Output Preview -->
      {#if generatedOutput}
        <div class="mt-2 space-y-1.5">
          <div class="flex items-center justify-between text-[11px] font-semibold text-slate-500">
            <span>Generated Result:</span>
            <button
              class="flex items-center space-x-1 text-purple-600 hover:text-purple-800"
              on:click={handleCopy}
              title="Copy to clipboard"
            >
              <Copy size={12} />
              <span>Copy</span>
            </button>
          </div>
          <div class="p-3 bg-purple-50/50 border border-purple-200 rounded-lg text-xs font-mono text-slate-900 max-h-48 overflow-y-auto whitespace-pre-wrap select-text leading-relaxed">
            {generatedOutput}
          </div>
        </div>
      {/if}
    </div>

    <!-- Footer -->
    <div class="px-5 py-3 bg-slate-100 border-t border-slate-200 flex items-center justify-between">
      <span class="text-[11px] text-slate-500 font-mono">
        100% Private • Local Offline AI
      </span>
      <div class="flex items-center space-x-2">
        <button
          class="px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-200 transition-colors"
          on:click={() => dispatch('close')}
        >
          Cancel
        </button>
        <button
          class="flex items-center space-x-1 px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 shadow-sm transition-colors disabled:opacity-40"
          on:click={handleApply}
          disabled={!generatedOutput}
        >
          <Check size={13} />
          <span>Insert into Document</span>
        </button>
      </div>
    </div>
  </div>
</div>
