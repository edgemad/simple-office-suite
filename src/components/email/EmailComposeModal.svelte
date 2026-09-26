<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import {
    X,
    Send,
    Paperclip,
    Sparkles,
    Trash2,
    Save,
    Bold,
    Italic,
    Underline,
    List,
    ListOrdered,
    ChevronDown,
    FileText,
    FileSpreadsheet,
    Presentation,
    FileCheck,
    Loader2
  } from '@lucide/svelte';
  import type { EmailMessage, EmailAttachment, AppSettings } from '../../types';
  import { processAiRequest } from '../../lib/ai';
  import { escapeHtml, sanitizeHtml } from '../../lib/sanitize';

  export let initialSubject: string = '';
  export let initialTo: string = '';
  export let initialBodyHtml: string = '';
  export let settings: AppSettings;
  export let replyToEmail: EmailMessage | null = null;

  const dispatch = createEventDispatcher<{
    close: void;
    send: {
      to: string[];
      cc: string[];
      subject: string;
      bodyHtml: string;
      attachments: EmailAttachment[];
    };
    saveDraft: {
      to: string[];
      subject: string;
      bodyHtml: string;
      attachments: EmailAttachment[];
    };
  }>();

  let toInput: string = initialTo;
  let ccInput: string = '';
  let showCc: boolean = false;
  let subject: string = initialSubject;
  let bodyHtml: string = sanitizeHtml(initialBodyHtml);
  let attachments: EmailAttachment[] = [];
  let isAiGenerating = false;
  let showAiDropdown = false;
  let aiCustomPrompt = '';
  let showCustomAiInput = false;

  let bodyEditorEl: HTMLDivElement;

  function collectBody(): string {
    return sanitizeHtml(bodyEditorEl ? bodyEditorEl.innerHTML : bodyHtml);
  }

  function handleSend() {
    const toRecipients = toInput
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    if (toRecipients.length === 0) {
      alert('Please specify at least one recipient email address.');
      return;
    }

    const ccRecipients = ccInput
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    const fullBody = collectBody();

    dispatch('send', {
      to: toRecipients,
      cc: ccRecipients,
      subject: subject || 'Untitled Message',
      bodyHtml: fullBody,
      attachments,
    });
  }

  function handleSaveDraft() {
    const toRecipients = toInput
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    const fullBody = collectBody();

    dispatch('saveDraft', {
      to: toRecipients,
      subject: subject || 'Draft Message',
      bodyHtml: fullBody,
      attachments,
    });
  }

  function formatCmd(cmd: string, val: string | undefined = undefined) {
    document.execCommand(cmd, false, val);
  }

  async function handleAiDraft(action: string) {
    isAiGenerating = true;
    showAiDropdown = false;
    showCustomAiInput = false;

    let prompt = action;
    if (replyToEmail) {
      prompt += ` in response to email from ${replyToEmail.fromName} with subject "${replyToEmail.subject}". Original content: "${replyToEmail.preview}"`;
    }

    try {
      const generated = await processAiRequest(
        `Draft professional email: ${prompt}`,
        bodyEditorEl ? bodyEditorEl.innerText : '',
        settings
      );

      const htmlFormatted = sanitizeHtml(
        generated
          .split('\n\n')
          .map(p => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
          .join('')
      );

      if (bodyEditorEl) {
        bodyEditorEl.innerHTML = htmlFormatted;
      }
      bodyHtml = htmlFormatted;
    } catch (err) {
      console.error('AI Draft failed:', err);
    } finally {
      isAiGenerating = false;
    }
  }

  function attachCurrentOfficeFile(type: 'doc' | 'sheet' | 'slide' | 'pdf') {
    if (type === 'doc') {
      attachments = [
        ...attachments,
        { id: `att_${Date.now()}`, name: 'Document_Attachment.docx', size: '28 KB', type: 'document' },
      ];
    } else if (type === 'sheet') {
      attachments = [
        ...attachments,
        { id: `att_${Date.now()}`, name: 'Financial_Model.xlsx', size: '45 KB', type: 'spreadsheet' },
      ];
    } else if (type === 'slide') {
      attachments = [
        ...attachments,
        { id: `att_${Date.now()}`, name: 'Presentation_Deck.pptx', size: '1.8 MB', type: 'presentation' },
      ];
    } else {
      attachments = [
        ...attachments,
        { id: `att_${Date.now()}`, name: 'Signed_Agreement.pdf', size: '320 KB', type: 'pdf' },
      ];
    }
  }

  function removeAttachment(id: string) {
    attachments = attachments.filter(a => a.id !== id);
  }
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 select-none">
  <!-- Compose Dialog -->
  <div class="bg-[#1e2024] text-slate-200 border border-[#363a40] rounded-xl shadow-2xl w-full max-w-3xl h-[620px] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
    
    <!-- Header -->
    <div class="h-11 px-4 bg-[#18191c] border-b border-[#2d3136] flex items-center justify-between shrink-0">
      <div class="flex items-center space-x-2">
        <span class="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
        <h3 class="text-xs font-semibold text-white tracking-wide">
          {replyToEmail ? `Reply to ${replyToEmail.fromName}` : 'New Message — Simple Office Mail'}
        </h3>
      </div>

      <div class="flex items-center space-x-1">
        <button
          class="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          on:click={handleSaveDraft}
          title="Save Draft"
        >
          <Save size={14} />
        </button>
        <button
          class="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          on:click={() => dispatch('close')}
          title="Close"
        >
          <X size={15} />
        </button>
      </div>
    </div>

    <!-- Recipient Fields -->
    <div class="bg-[#24272c] px-4 py-2 border-b border-slate-700/60 text-xs space-y-2 shrink-0">
      <div class="flex items-center space-x-3">
        <span class="text-slate-400 w-12 font-medium">To:</span>
        <input
          type="email"
          bind:value={toInput}
          placeholder="recipient@example.com"
          class="flex-1 bg-transparent border-none text-white focus:outline-none placeholder-slate-500 font-sans"
        />
        <button
          type="button"
          class="text-indigo-400 hover:text-indigo-300 text-[11px] font-medium"
          on:click={() => (showCc = !showCc)}
        >
          {showCc ? 'Hide Cc' : 'Cc / Bcc'}
        </button>
      </div>

      {#if showCc}
        <div class="flex items-center space-x-3 pt-1 border-t border-slate-700/40">
          <span class="text-slate-400 w-12 font-medium">Cc:</span>
          <input
            type="email"
            bind:value={ccInput}
            placeholder="colleague@example.com"
            class="flex-1 bg-transparent border-none text-white focus:outline-none placeholder-slate-500 font-sans"
          />
        </div>
      {/if}

      <div class="flex items-center space-x-3 pt-1 border-t border-slate-700/40">
        <span class="text-slate-400 w-12 font-medium">Subject:</span>
        <input
          type="text"
          bind:value={subject}
          placeholder="Subject of your email"
          class="flex-1 bg-transparent border-none text-white font-medium focus:outline-none placeholder-slate-500 font-sans"
        />
      </div>
    </div>

    <!-- Formatting Toolbar & AI Features -->
    <div class="h-9 px-4 bg-[#1a1c1f] border-b border-[#2d3136] flex items-center justify-between text-xs shrink-0">
      <!-- Rich Text Formatting -->
      <div class="flex items-center space-x-1 text-slate-300">
        <button class="p-1 rounded hover:bg-white/10 font-bold" on:click={() => formatCmd('bold')} title="Bold (⌘+B)">
          <Bold size={13} />
        </button>
        <button class="p-1 rounded hover:bg-white/10 italic" on:click={() => formatCmd('italic')} title="Italic (⌘+I)">
          <Italic size={13} />
        </button>
        <button class="p-1 rounded hover:bg-white/10 underline" on:click={() => formatCmd('underline')} title="Underline (⌘+U)">
          <Underline size={13} />
        </button>
        <div class="h-4 w-px bg-slate-700 mx-1"></div>
        <button class="p-1 rounded hover:bg-white/10" on:click={() => formatCmd('insertUnorderedList')} title="Bullet List">
          <List size={13} />
        </button>
        <button class="p-1 rounded hover:bg-white/10" on:click={() => formatCmd('insertOrderedList')} title="Numbered List">
          <ListOrdered size={13} />
        </button>

        <!-- Quick Attach Office File -->
        <div class="h-4 w-px bg-slate-700 mx-1"></div>
        <div class="flex items-center space-x-1">
          <button
            class="flex items-center space-x-1 px-1.5 py-0.5 rounded hover:bg-white/10 text-blue-400 text-[11px]"
            on:click={() => attachCurrentOfficeFile('doc')}
            title="Attach Word .docx"
          >
            <FileText size={12} />
            <span class="hidden sm:inline">Attach Word</span>
          </button>
          <button
            class="flex items-center space-x-1 px-1.5 py-0.5 rounded hover:bg-white/10 text-emerald-400 text-[11px]"
            on:click={() => attachCurrentOfficeFile('sheet')}
            title="Attach Sheet .xlsx"
          >
            <FileSpreadsheet size={12} />
            <span class="hidden sm:inline">Attach Sheet</span>
          </button>
          <button
            class="flex items-center space-x-1 px-1.5 py-0.5 rounded hover:bg-white/10 text-orange-400 text-[11px]"
            on:click={() => attachCurrentOfficeFile('slide')}
            title="Attach Slides .pptx"
          >
            <Presentation size={12} />
            <span class="hidden sm:inline">Attach Slides</span>
          </button>
          <button
            class="flex items-center space-x-1 px-1.5 py-0.5 rounded hover:bg-white/10 text-rose-400 text-[11px]"
            on:click={() => attachCurrentOfficeFile('pdf')}
            title="Attach PDF"
          >
            <FileCheck size={12} />
            <span class="hidden sm:inline">Attach PDF</span>
          </button>
        </div>
      </div>

      <!-- AI Email Writing Assistant -->
      <div class="relative">
        <button
          class="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/40 text-purple-200 text-xs font-semibold transition-all shadow-xs"
          on:click={() => (showAiDropdown = !showAiDropdown)}
          disabled={isAiGenerating}
        >
          {#if isAiGenerating}
            <Loader2 size={13} class="animate-spin text-purple-300" />
            <span>Generating...</span>
          {:else}
            <Sparkles size={13} class="text-purple-300" />
            <span>AI Draft</span>
            <ChevronDown size={11} class="text-purple-400" />
          {/if}
        </button>

        {#if showAiDropdown}
          <div class="absolute right-0 mt-1.5 w-64 bg-slate-900 border border-purple-500/40 rounded-xl shadow-2xl p-1.5 z-50 text-xs text-slate-200 space-y-1">
            <div class="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-purple-400 border-b border-slate-800">
              OnlyOffice AI Assistant
            </div>
            
            <button
              class="w-full px-2.5 py-1.5 text-left rounded-lg hover:bg-purple-600/30 flex items-center justify-between"
              on:click={() => handleAiDraft('Draft a professional and polite reply acknowledging receipt and confirming next steps')}
            >
              <span>Confirm & Next Steps</span>
              <span class="text-[10px] text-purple-400">Formal</span>
            </button>

            <button
              class="w-full px-2.5 py-1.5 text-left rounded-lg hover:bg-purple-600/30 flex items-center justify-between"
              on:click={() => handleAiDraft('Polite decline due to full capacity and resource constraints')}
            >
              <span>Polite Decline</span>
              <span class="text-[10px] text-amber-400">Diplomatic</span>
            </button>

            <button
              class="w-full px-2.5 py-1.5 text-left rounded-lg hover:bg-purple-600/30 flex items-center justify-between"
              on:click={() => handleAiDraft('Request clarification and additional technical specifications before proceeding')}
            >
              <span>Request More Info</span>
              <span class="text-[10px] text-blue-400">Clarification</span>
            </button>

            <button
              class="w-full px-2.5 py-1.5 text-left rounded-lg hover:bg-purple-600/30 flex items-center justify-between"
              on:click={() => handleAiDraft('Rewrite and polish existing message with executive professional tone and perfect grammar')}
            >
              <span>Polish & Refine Tone</span>
              <span class="text-[10px] text-emerald-400">Enhance</span>
            </button>

            <div class="border-t border-slate-800 my-1"></div>
            <button
              class="w-full px-2.5 py-1.5 text-left rounded-lg hover:bg-slate-800 text-purple-300 font-medium"
              on:click={() => { showCustomAiInput = true; showAiDropdown = false; }}
            >
              Custom Prompt...
            </button>
          </div>
        {/if}
      </div>
    </div>

    <!-- Custom AI Prompt Bar -->
    {#if showCustomAiInput}
      <div class="px-4 py-2 bg-purple-950/40 border-b border-purple-800/40 flex items-center space-x-2 shrink-0">
        <Sparkles size={14} class="text-purple-400 shrink-0" />
        <input
          type="text"
          bind:value={aiCustomPrompt}
          placeholder="Ask AI to draft... e.g., 'Write an invitation for project kickoff meeting on Monday'"
          class="flex-1 bg-black/30 border border-purple-500/40 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-purple-400"
          on:keydown={(e) => { if (e.key === 'Enter' && aiCustomPrompt.trim()) handleAiDraft(aiCustomPrompt.trim()); }}
        />
        <button
          class="px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-semibold"
          on:click={() => { if (aiCustomPrompt.trim()) handleAiDraft(aiCustomPrompt.trim()); }}
        >
          Generate
        </button>
        <button
          class="p-1 text-slate-400 hover:text-white"
          on:click={() => (showCustomAiInput = false)}
        >
          <X size={14} />
        </button>
      </div>
    {/if}

    <!-- Attachments Chip List -->
    {#if attachments.length > 0}
      <div class="px-4 py-2 bg-slate-900/60 border-b border-slate-800 flex flex-wrap gap-2 shrink-0">
        {#each attachments as att}
          <div class="flex items-center space-x-1.5 px-2.5 py-1 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-300">
            <Paperclip size={12} class="text-slate-400" />
            <span class="font-medium text-white truncate max-w-[180px]">{att.name}</span>
            <span class="text-[10px] text-slate-500">({att.size})</span>
            <button
              class="text-slate-400 hover:text-rose-400 ml-1"
              on:click={() => removeAttachment(att.id)}
              title="Remove attachment"
            >
              <X size={12} />
            </button>
          </div>
        {/each}
      </div>
    {/if}

    <!-- Email Body Canvas (ContentEditable) -->
    <div
      bind:this={bodyEditorEl}
      contenteditable="true"
      role="textbox"
      tabindex="0"
      class="flex-1 p-5 bg-[#1e2024] text-slate-100 text-sm overflow-y-auto focus:outline-none font-sans leading-relaxed selection:bg-indigo-600 selection:text-white"
    >
      {@html sanitizeHtml(bodyHtml)}
    </div>

    <!-- Modal Footer -->
    <div class="h-13 px-5 bg-[#18191c] border-t border-[#2d3136] flex items-center justify-between shrink-0">
      <div class="flex items-center space-x-2">
        <button
          type="button"
          class="flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition-all"
          on:click={handleSend}
        >
          <Send size={13} />
          <span>Send Message</span>
        </button>

        <button
          type="button"
          class="px-3 py-2 rounded-lg text-slate-300 hover:bg-white/5 border border-slate-700 text-xs font-medium transition-colors"
          on:click={handleSaveDraft}
        >
          Save Draft
        </button>
      </div>

      <div class="flex items-center space-x-2 text-xs text-slate-400">
        <span class="text-[11px] hidden sm:inline">100% Offline Local Mail Queue</span>
        <button
          type="button"
          class="p-2 rounded-lg hover:bg-rose-600/20 text-slate-400 hover:text-rose-400 transition-colors"
          on:click={() => dispatch('close')}
          title="Discard Draft"
        >
          <Trash2 size={15} />
        </button>
      </div>
    </div>

  </div>
</div>
