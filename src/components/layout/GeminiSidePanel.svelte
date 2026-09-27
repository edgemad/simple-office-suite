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
    Table,
    Presentation,
    Loader2,
    Send,
    User,
    Building2,
    Settings,
    ArrowRight,
    HelpCircle,
    BarChart3,
    Sigma,
    CheckCircle2,
    RefreshCw,
    KeyRound,
    ExternalLink,
    AlertCircle
  } from 'lucide-svelte';
  import type { WorkspaceMode, AppSettings } from '../../types';
  import { processAiRequest } from '../../lib/ai';
  import { saveSettings } from '../../lib/settings';

  export let isOpen: boolean = false;
  export let activeMode: WorkspaceMode = 'writer';
  export let currentContext: string = '';
  export let settings: AppSettings | undefined = undefined;

  const dispatch = createEventDispatcher<{
    close: void;
    apply: { text: string; mode: WorkspaceMode; action?: string };
    openAccountModal: void;
    openSettings: void;
  }>();

  let userPrompt = '';
  let isGenerating = false;
  let chatHistory: Array<{
    id: string;
    role: 'user' | 'gemini';
    content: string;
    actionType?: string;
  }> = [];

  // Inline API Key input
  let inlineKey = '';
  let showKeyInput = false;

  interface QuickPrompt {
    id: string;
    label: string;
    icon: any;
    prompt: string;
  }

  $: quickPrompts = getQuickPrompts(activeMode);

  function getQuickPrompts(mode: WorkspaceMode): QuickPrompt[] {
    if (mode === 'sheets') {
      return [
        { id: 'organize', label: 'Help me organize', icon: Table, prompt: 'Create a structured project tracker table with tasks, assignees, status, and hours' },
        { id: 'budget', label: 'Financial Budget', icon: Table, prompt: 'Create a quarterly budget model with planned, actual, variance, and =SUM formulas' },
        { id: 'formula_xlookup', label: 'Formula: XLOOKUP', icon: Sigma, prompt: 'Generate an =XLOOKUP formula to find a price in another sheet' },
        { id: 'formula_sumifs', label: 'Formula: SUMIFS', icon: Sigma, prompt: 'Generate a =SUMIFS formula to sum expenses by department and approval status' },
        { id: 'insights', label: 'Data Insights', icon: BarChart3, prompt: 'Analyze this spreadsheet data and summarize top trends, drivers, and recommendations' },
      ];
    }
    if (mode === 'slides') {
      return [
        { id: 'new_slide', label: 'Create Slide', icon: Presentation, prompt: 'Create a high-impact slide about our key strategic growth pillars' },
        { id: 'outline', label: 'Deck Outline', icon: Presentation, prompt: 'Generate a 4-slide presentation outline for a product kickoff meeting' },
        { id: 'notes', label: 'Speaker Notes', icon: Sparkles, prompt: 'Write engaging speaker notes for the current presentation slide' },
        { id: 'summarize_deck', label: 'Summarize Deck', icon: FileText, prompt: 'Provide an executive summary of this presentation deck' },
      ];
    }
    if (mode === 'forms') {
      return [
        { id: 'survey', label: 'Create Survey', icon: HelpCircle, prompt: 'Generate 6 questions for a customer satisfaction and product feedback survey' },
        { id: 'quiz', label: 'Create Quiz', icon: HelpCircle, prompt: 'Generate 5 multiple-choice quiz questions on workspace productivity' },
        { id: 'analyze_resp', label: 'Analyze Responses', icon: BarChart3, prompt: 'Analyze survey responses and highlight key satisfaction trends' },
      ];
    }
    if (mode === 'drive') {
      return [
        { id: 'search_files', label: 'Search Drive', icon: Sparkles, prompt: 'Find all recent project documents, contracts, and financial models' },
        { id: 'summarize_folder', label: 'Summarize Files', icon: FileText, prompt: 'Summarize key information from documents stored in this Google Drive folder' },
      ];
    }
    // Default: Google Docs (Writer)
    return [
      { id: 'help_write', label: 'Help me write', icon: Wand2, prompt: 'Draft a comprehensive project proposal outlining objectives, scope, and timeline' },
      { id: 'summarize_doc', label: 'Summarize doc', icon: FileText, prompt: 'Summarize this entire document with key takeaways and immediate action items' },
      { id: 'tone_formal', label: 'Formal Tone', icon: Sparkles, prompt: 'Rewrite the document text to sound more professional, polished, and formal' },
      { id: 'tone_concise', label: 'Make Concise', icon: Sparkles, prompt: 'Condense and shorten the text to the most essential bullet points' },
      { id: 'proofread', label: 'Proofread', icon: CheckCircle2, prompt: 'Proofread and fix all grammar, punctuation, and wording errors' },
      { id: 'brainstorm', label: 'Brainstorm Ideas', icon: Sparkles, prompt: 'Brainstorm 5 innovative ideas and outline next steps for this initiative' },
    ];
  }

  function handleSaveInlineKey() {
    if (!inlineKey.trim() || !settings) return;
    settings.aiApiKey = inlineKey.trim();
    settings.aiProvider = 'gemini';
    saveSettings(settings);
    inlineKey = '';
    showKeyInput = false;
  }

  async function handleSend(customText?: string, actionType?: string) {
    const textToSend = (customText || userPrompt).trim();
    if (!textToSend || isGenerating) return;

    const userMsgId = `msg_${Date.now()}`;
    chatHistory = [
      ...chatHistory,
      { id: userMsgId, role: 'user', content: textToSend, actionType }
    ];
    userPrompt = '';
    isGenerating = true;

    try {
      const responseText = await processAiRequest(textToSend, currentContext, settings);
      chatHistory = [
        ...chatHistory,
        {
          id: `gemini_${Date.now()}`,
          role: 'gemini',
          content: responseText,
          actionType
        }
      ];
    } catch (err: any) {
      chatHistory = [
        ...chatHistory,
        {
          id: `gemini_${Date.now()}`,
          role: 'gemini',
          content: `❌ Error: ${err.message || 'Gemini encountered an error.'}`
        }
      ];
    } finally {
      isGenerating = false;
    }
  }

  function handleApplyResult(content: string, actionType?: string) {
    dispatch('apply', { text: content, mode: activeMode, action: actionType });
  }

  function handleCopy(content: string) {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(content);
    }
  }
</script>

{#if isOpen}
  <!-- Gemini Collapsible Side Panel -->
  <aside
    class="w-84 xl:w-96 bg-white border-l border-slate-200/90 flex flex-col h-full z-20 shadow-xl select-none animate-in slide-in-from-right duration-150 text-slate-800 shrink-0"
  >
    <!-- Top Header -->
    <div class="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-blue-50/50 via-purple-50/50 to-pink-50/30">
      <div class="flex items-center space-x-2.5">
        <div class="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#1a73e8] via-[#8e24aa] to-[#d81b60] text-white flex items-center justify-center shadow-xs">
          <Sparkles size={16} />
        </div>
        <div>
          <div class="flex items-center space-x-1.5">
            <h3 class="font-bold text-sm text-slate-900 leading-tight">Gemini</h3>
            <span class="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider {settings?.aiApiKey ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}">
              {settings?.aiApiKey ? 'Live API' : 'Key Needed'}
            </span>
          </div>
          <p class="text-[10px] text-slate-500 font-mono truncate max-w-[170px]">
            {settings?.aiApiKey ? (settings.aiModel || 'gemini-1.5-flash') : 'Free Key at aistudio.google.com'}
          </p>
        </div>
      </div>

      <div class="flex items-center space-x-1">
        <button
          class="p-1.5 rounded-lg hover:bg-slate-200/60 text-slate-400 hover:text-slate-700 transition-colors"
          on:click={() => dispatch('openSettings')}
          title="Gemini AI Settings"
        >
          <Settings size={15} />
        </button>
        <button
          class="p-1.5 rounded-lg hover:bg-slate-200/60 text-slate-400 hover:text-slate-700 transition-colors"
          on:click={() => dispatch('close')}
          title="Close Gemini Side Panel"
        >
          <X size={16} />
        </button>
      </div>
    </div>

    <!-- API Key Warning / Inline Config Box (Shown when key is not configured) -->
    {#if !settings?.aiApiKey || showKeyInput}
      <div class="p-3 mx-3 my-2.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs space-y-2 animate-in fade-in">
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-1.5 font-semibold text-amber-900">
            <KeyRound size={13} class="text-amber-700" />
            <span>Google Gemini API Key</span>
          </div>
          <a
            href="https://aistudio.google.com/apikey"
            target="_blank"
            class="text-[10px] text-blue-600 hover:underline flex items-center space-x-0.5"
          >
            <span>Get Free Key</span>
            <ExternalLink size={9} />
          </a>
        </div>
        <p class="text-[11px] text-amber-800 leading-tight">
          To generate live AI responses, enter your free Google Gemini API Key:
        </p>
        <div class="flex items-center space-x-1.5">
          <input
            type="password"
            placeholder="AIzaSy..."
            bind:value={inlineKey}
            class="flex-1 bg-white border border-amber-300 rounded-lg px-2 py-1 text-xs text-slate-900 outline-none font-mono focus:border-blue-500"
          />
          <button
            class="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-xs shadow-2xs"
            on:click={handleSaveInlineKey}
          >
            Save
          </button>
        </div>
      </div>
    {/if}

    <!-- Quick Action Chips -->
    <div class="p-3 border-b border-slate-100 bg-white">
      <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5 px-0.5">
        Suggested for {activeMode === 'sheets' ? 'Sheets' : activeMode === 'slides' ? 'Slides' : activeMode === 'forms' ? 'Forms' : 'Docs'}
      </span>
      <div class="flex flex-wrap gap-1.5">
        {#each quickPrompts as prompt}
          <button
            class="flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200/70 hover:border-blue-200 transition-all text-left"
            on:click={() => handleSend(prompt.prompt, prompt.id)}
            disabled={isGenerating}
          >
            <svelte:component this={prompt.icon} size={12} class="text-purple-600 shrink-0" />
            <span>{prompt.label}</span>
          </button>
        {/each}
      </div>
    </div>

    <!-- Chat Messages Scroll Area -->
    <div class="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs">
      {#if chatHistory.length === 0}
        <div class="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400 space-y-2">
          <div class="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-100 to-blue-100 text-purple-600 flex items-center justify-center shadow-xs">
            <Sparkles size={24} />
          </div>
          <span class="font-semibold text-slate-800 text-sm">Ask Gemini anything</span>
          <p class="text-[11px] text-slate-500 leading-relaxed max-w-[220px]">
            {activeMode === 'sheets'
              ? 'Organize tables, create complex formulas, or analyze spreadsheet numbers.'
              : activeMode === 'slides'
              ? 'Draft presentation slides, write speaker notes, or design outlines.'
              : 'Write documents, polish tone, summarize text, or brainstorm ideas.'}
          </p>
        </div>
      {:else}
        {#each chatHistory as msg}
          {#if msg.role === 'user'}
            <div class="flex justify-end">
              <div class="max-w-[85%] bg-blue-600 text-white p-2.5 rounded-2xl rounded-tr-xs shadow-xs text-xs font-normal">
                {msg.content}
              </div>
            </div>
          {:else}
            <!-- Gemini Response Bubble -->
            <div class="flex flex-col space-y-1.5 bg-slate-50/90 border border-slate-200/80 p-3 rounded-2xl rounded-tl-xs shadow-2xs">
              <div class="flex items-center justify-between text-[11px] font-semibold text-purple-700">
                <span class="flex items-center space-x-1">
                  <Sparkles size={12} />
                  <span>Gemini</span>
                </span>
                <div class="flex items-center space-x-1.5">
                  <button
                    class="p-1 rounded hover:bg-slate-200/70 text-slate-400 hover:text-slate-700 transition-colors"
                    on:click={() => handleCopy(msg.content)}
                    title="Copy response"
                  >
                    <Copy size={12} />
                  </button>
                </div>
              </div>

              <div class="text-slate-800 whitespace-pre-wrap leading-relaxed select-text font-sans">
                {msg.content}
              </div>

              <!-- Insertion / Apply Action -->
              <div class="pt-2 border-t border-slate-200/60 flex items-center justify-end space-x-2">
                <button
                  class="flex items-center space-x-1 px-3 py-1 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-semibold text-[11px] shadow-2xs transition-colors"
                  on:click={() => handleApplyResult(msg.content, msg.actionType)}
                >
                  <Check size={12} />
                  <span>
                    {activeMode === 'writer' ? 'Insert into Doc' : activeMode === 'sheets' ? 'Insert into Sheet' : activeMode === 'slides' ? 'Insert Slide' : 'Apply'}
                  </span>
                </button>
              </div>
            </div>
          {/if}
        {/each}
        {#if isGenerating}
          <div class="flex items-center space-x-2 text-purple-600 text-xs p-2">
            <Loader2 size={16} class="animate-spin" />
            <span>Gemini is generating response...</span>
          </div>
        {/if}
      {/if}
    </div>

    <!-- Input Bar -->
    <div class="p-3 border-t border-slate-200 bg-white">
      <div class="relative flex items-center">
        <textarea
          rows={2}
          bind:value={userPrompt}
          placeholder="Ask Gemini to write, format, calculate, summarize..."
          class="w-full bg-slate-100 hover:bg-slate-100/80 focus:bg-white text-slate-800 p-2.5 pr-10 rounded-2xl text-xs outline-none border border-transparent focus:border-purple-500/50 resize-none transition-all shadow-inner"
          on:keydown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        ></textarea>
        <button
          class="absolute right-2.5 p-1.5 rounded-full bg-purple-600 hover:bg-purple-700 text-white transition-all shadow-xs disabled:opacity-40"
          on:click={() => handleSend()}
          disabled={!userPrompt.trim() || isGenerating}
          title="Send to Gemini"
        >
          <Send size={13} />
        </button>
      </div>
      <div class="flex items-center justify-between mt-1 px-1 text-[10px] text-slate-400">
        <span>Shift + Enter for new line</span>
        <button class="hover:text-slate-600 text-[10px]" on:click={() => (showKeyInput = !showKeyInput)}>
          {settings?.aiApiKey ? 'Edit API Key' : 'Enter API Key'}
        </button>
      </div>
    </div>
  </aside>
{/if}
