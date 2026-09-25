<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import {
    Sparkles,
    X,
    Check,
    Copy,
    Wand2,
    FileText,
    Bot,
    Mail,
    Presentation,
    Loader2
  } from 'lucide-svelte';
  import type { AppSettings } from '../../types';
  import { processAiRequest } from '../../lib/ai';

  export let activeMode: string = 'writer';
  export let currentContext: string = '';
  export let settings: AppSettings | undefined = undefined;

  const dispatch = createEventDispatcher<{
    apply: string;
    close: void;
  }>();

  let userPrompt = '';
  let generatedOutput = '';
  let isGenerating = false;
  let selectedAction: 'draft' | 'summarize' | 'polish' | 'grammar' | 'formula' | 'email' | 'slides' =
    activeMode === 'sheets'
      ? 'formula'
      : activeMode === 'email'
      ? 'email'
      : activeMode === 'slides'
      ? 'slides'
      : 'draft';

  const quickActions = [
    { id: 'draft', label: 'Draft Content', icon: Wand2, desc: 'Generate new sections or paragraphs' },
    { id: 'summarize', label: 'Summarize', icon: FileText, desc: 'Create executive summary' },
    { id: 'polish', label: 'Rewrite & Polish', icon: Sparkles, desc: 'Improve professional tone' },
    { id: 'grammar', label: 'Fix Grammar', icon: Check, desc: 'Correct spelling & syntax' },
    { id: 'formula', label: 'Build Formula (fx)', icon: Bot, desc: 'Smart formula generator' },
    { id: 'email', label: 'Draft Email', icon: Mail, desc: 'Professional emails & replies' },
    { id: 'slides', label: 'Slide Content', icon: Presentation, desc: 'Generate slide bullets' },
  ];

  async function runAiAction() {
    isGenerating = true;
    generatedOutput = '';

    try {
      const taskDescription =
        selectedAction === 'formula'
          ? `Generate spreadsheet formula for: ${userPrompt || 'Sum column B'}`
          : selectedAction === 'summarize'
          ? `Summarize document context: ${userPrompt || 'Create executive bullet points'}`
          : selectedAction === 'polish'
          ? `Rewrite and polish text to be professional and concise: ${userPrompt || currentContext}`
          : selectedAction === 'grammar'
          ? `Fix grammar, punctuation, and syntax errors: ${userPrompt || currentContext}`
          : selectedAction === 'email'
          ? `Draft professional office email: ${userPrompt || 'Project milestone update'}`
          : selectedAction === 'slides'
          ? `Generate presentation slide points: ${userPrompt || 'Quarterly strategic drivers'}`
          : `Draft document content: ${userPrompt || 'Project proposal overview'}`;

      const res = await processAiRequest(
        taskDescription,
        userPrompt || currentContext,
        settings
      );
      generatedOutput = res;
    } catch (err) {
      console.error('AI generation error:', err);
      generatedOutput = 'An error occurred during AI generation. Please check your settings or prompt.';
    } finally {
      isGenerating = false;
    }
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
  class="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in select-none"
  on:click|self={() => dispatch('close')}
  role="dialog"
  tabindex="-1"
  aria-modal="true"
  aria-labelledby="ai-modal-title"
  on:keydown={(e) => { if (e.key === 'Escape') dispatch('close'); }}
>
  <div class="bg-[#1e2024] text-slate-200 rounded-xl shadow-2xl border border-slate-700 w-full max-w-xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95">
    
    <!-- Header with OnlyOffice Purple/Indigo AI Theme -->
    <div class="px-5 py-3.5 bg-[#18191c] text-white border-b border-[#2d3136] flex items-center justify-between">
      <div class="flex items-center space-x-2.5">
        <div class="w-8 h-8 rounded-lg bg-gradient-to-tr from-purple-600 to-indigo-500 text-white flex items-center justify-center shadow-sm">
          <Sparkles size={17} />
        </div>
        <div>
          <h3 id="ai-modal-title" class="font-bold text-sm text-white">
            OnlyOffice AI Assistant & Copilot
          </h3>
          <p class="text-[11px] text-purple-300">
            Intelligent writing, formulas, email responses, and document analysis
          </p>
        </div>
      </div>
      <button
        class="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
        on:click={() => dispatch('close')}
        title="Close"
      >
        <X size={16} />
      </button>
    </div>

    <!-- Quick Action Chips -->
    <div class="p-3 bg-[#161719] border-b border-[#2d3136] flex flex-wrap gap-1.5">
      {#each quickActions as act}
        <button
          class="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
            {selectedAction === act.id ? 'bg-purple-600 text-white shadow-xs font-semibold' : 'bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700'}"
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
        <label for="ai-prompt-input" class="text-xs font-semibold text-slate-300 block mb-1">
          {#if selectedAction === 'formula'}
            Describe the calculation you want:
          {:else if selectedAction === 'email'}
            Email prompt or reply scenario:
          {:else}
            Instructions or prompt:
          {/if}
        </label>
        <textarea
          id="ai-prompt-input"
          bind:value={userPrompt}
          placeholder={
            selectedAction === 'formula'
              ? 'e.g. Sum all expenses in column B where department in column A is Marketing'
              : selectedAction === 'email'
              ? 'e.g. Write a friendly meeting confirmation for tomorrow at 2 PM'
              : 'e.g. Write a comprehensive executive summary for this report...'
          }
          rows="3"
          class="w-full p-2.5 bg-[#24272c] border border-slate-700 rounded-lg text-xs text-white outline-none focus:border-purple-500 resize-none font-sans"
        ></textarea>
      </div>

      <div class="flex justify-end">
        <button
          class="flex items-center space-x-1.5 px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 transition-colors shadow-sm disabled:opacity-50"
          on:click={runAiAction}
          disabled={isGenerating}
        >
          {#if isGenerating}
            <Loader2 size={13} class="animate-spin text-white" />
            <span>Processing...</span>
          {:else}
            <Sparkles size={13} />
            <span>Generate with AI</span>
          {/if}
        </button>
      </div>

      <!-- Output Preview -->
      {#if generatedOutput}
        <div class="mt-2 space-y-1.5">
          <div class="flex items-center justify-between text-[11px] font-semibold text-slate-400">
            <span>Generated Result:</span>
            <button
              class="flex items-center space-x-1 text-purple-400 hover:text-purple-300"
              on:click={handleCopy}
              title="Copy to clipboard"
            >
              <Copy size={12} />
              <span>Copy</span>
            </button>
          </div>
          <div class="p-3 bg-purple-950/30 border border-purple-800/40 rounded-lg text-xs font-sans text-slate-200 max-h-48 overflow-y-auto whitespace-pre-wrap select-text leading-relaxed">
            {generatedOutput}
          </div>
        </div>
      {/if}
    </div>

    <!-- Footer -->
    <div class="px-5 py-3 bg-[#18191c] border-t border-[#2d3136] flex items-center justify-between">
      <span class="text-[11px] text-slate-400 font-mono">
        {settings?.aiProvider === 'openai' ? 'OpenAI ChatGPT' : settings?.aiProvider === 'anthropic' ? 'Anthropic Claude' : '100% Offline • Zero-Cloud Telemetry'}
      </span>
      <div class="flex items-center space-x-2">
        <button
          class="px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
          on:click={() => dispatch('close')}
        >
          Cancel
        </button>
        <button
          class="flex items-center space-x-1 px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 shadow-sm transition-colors disabled:opacity-40"
          on:click={handleApply}
          disabled={!generatedOutput}
        >
          <Check size={13} />
          <span>Apply to Active Workspace</span>
        </button>
      </div>
    </div>
  </div>
</div>
