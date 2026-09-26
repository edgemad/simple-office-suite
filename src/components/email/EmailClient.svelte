<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import {
    Inbox,
    Star,
    Send,
    FileText,
    Archive,
    Trash2,
    AlertOctagon,
    Search,
    Filter,
    Plus,
    Paperclip,
    Reply,
    ReplyAll,
    Forward,
    Sparkles,
    ChevronDown,
    Mail,
    RefreshCw,
    Download,
    X,
    Loader2
  } from '@lucide/svelte';
  import type { EmailMessage, EmailFolder, EmailAccount, AppSettings } from '../../types';
  import { DEFAULT_ACCOUNTS, loadEmails, saveEmails } from '../../lib/emailStore';
  import { processAiRequest } from '../../lib/ai';
  import { buildReplyQuoteHtml, htmlToPlainText, sanitizeHtml, textToSafeHtml } from '../../lib/sanitize';
  import EmailComposeModal from './EmailComposeModal.svelte';

  export let settings: AppSettings;

  const dispatch = createEventDispatcher<{
    updateStats: { total: number; unread: number; activeFolder: string };
    change: void;
  }>();

  let accounts: EmailAccount[] = DEFAULT_ACCOUNTS;
  let activeAccount: EmailAccount = accounts[0];
  let emails: EmailMessage[] = [];
  let activeFolder: EmailFolder = 'inbox';
  let selectedEmailId: string | null = null;
  let searchQuery: string = '';
  let filterUnreadOnly: boolean = false;
  let showComposeModal: boolean = false;
  let composeReplyEmail: EmailMessage | null = null;

  // AI Feature States
  let aiSummary: string | null = null;
  let isAiSummarizing: boolean = false;
  let inlineReplyText: string = '';
  let isAiGeneratingReply: boolean = false;

  onMount(() => {
    emails = loadEmails();
    if (emails.length > 0) {
      const firstInFolder = emails.find(e => e.folder === activeFolder) || emails[0];
      selectedEmailId = firstInFolder.id;
    }
    updateSuiteStats();
  });

  $: filteredEmails = emails
    .filter(email => {
      // Folder filter
      if (activeFolder === 'starred') {
        if (!email.isStarred) return false;
      } else {
        if (email.folder !== activeFolder) return false;
      }

      // Unread filter
      if (filterUnreadOnly && !email.isUnread) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesSubject = email.subject.toLowerCase().includes(q);
        const matchesFrom = email.fromName.toLowerCase().includes(q) || email.fromEmail.toLowerCase().includes(q);
        const matchesPreview = email.preview.toLowerCase().includes(q);
        if (!matchesSubject && !matchesFrom && !matchesPreview) return false;
      }

      return true;
    })
    .sort((a, b) => (b.id > a.id ? 1 : -1));

  $: selectedEmail = emails.find(e => e.id === selectedEmailId) || null;

  $: folderCounts = {
    inbox: emails.filter(e => e.folder === 'inbox').length,
    inboxUnread: emails.filter(e => e.folder === 'inbox' && e.isUnread).length,
    starred: emails.filter(e => e.isStarred).length,
    sent: emails.filter(e => e.folder === 'sent').length,
    drafts: emails.filter(e => e.folder === 'drafts').length,
    archive: emails.filter(e => e.folder === 'archive').length,
    trash: emails.filter(e => e.folder === 'trash').length,
    junk: emails.filter(e => e.folder === 'junk').length,
  };

  function updateSuiteStats() {
    const unread = emails.filter(e => e.folder === 'inbox' && e.isUnread).length;
    dispatch('updateStats', {
      total: emails.length,
      unread,
      activeFolder: activeFolder.toUpperCase(),
    });
  }

  function selectEmail(email: EmailMessage) {
    selectedEmailId = email.id;
    aiSummary = null;
    inlineReplyText = '';
    if (email.isUnread) {
      email.isUnread = false;
      emails = [...emails];
      saveEmails(emails);
      updateSuiteStats();
    }
  }

  function toggleStar(email: EmailMessage, e?: Event) {
    if (e) e.stopPropagation();
    email.isStarred = !email.isStarred;
    emails = [...emails];
    saveEmails(emails);
  }

  function handleFolderChange(folder: EmailFolder) {
    activeFolder = folder;
    aiSummary = null;
    const firstInFolder = emails.find(e => (folder === 'starred' ? e.isStarred : e.folder === folder));
    selectedEmailId = firstInFolder ? firstInFolder.id : null;
    updateSuiteStats();
  }

  function handleArchive(email: EmailMessage) {
    email.folder = 'archive';
    emails = [...emails];
    saveEmails(emails);
    updateSuiteStats();
  }

  function handleDelete(email: EmailMessage) {
    if (email.folder === 'trash') {
      emails = emails.filter(e => e.id !== email.id);
    } else {
      email.folder = 'trash';
    }
    emails = [...emails];
    saveEmails(emails);
    updateSuiteStats();
  }

  function handleReply(email: EmailMessage) {
    composeReplyEmail = email;
    showComposeModal = true;
  }

  function handleOpenNewCompose() {
    composeReplyEmail = null;
    showComposeModal = true;
  }

  function handleSendCompose(e: CustomEvent<{ to: string[]; cc: string[]; subject: string; bodyHtml: string; attachments: any[] }>) {
    const { to, cc, subject, bodyHtml, attachments } = e.detail;
    const safeBody = sanitizeHtml(bodyHtml);
    const signature = settings.emailSignature
      ? `<span style="color:#64748b; font-size:11px;">${textToSafeHtml(settings.emailSignature)}</span>`
      : '';
    const newMail: EmailMessage = {
      id: `mail_${Date.now()}`,
      fromName: activeAccount.name,
      fromEmail: activeAccount.email,
      to,
      cc,
      subject,
      date: 'Just now',
      preview: htmlToPlainText(safeBody).slice(0, 100),
      bodyHtml: sanitizeHtml(`${safeBody}<br><br>${signature}`),
      folder: 'sent',
      isUnread: false,
      isStarred: false,
      attachments,
    };

    emails = [newMail, ...emails];
    saveEmails(emails);
    showComposeModal = false;
    updateSuiteStats();
  }

  function handleSaveDraftCompose(e: CustomEvent<{ to: string[]; subject: string; bodyHtml: string; attachments: any[] }>) {
    const { to, subject, bodyHtml, attachments } = e.detail;
    const safeBody = sanitizeHtml(bodyHtml);
    const draft: EmailMessage = {
      id: `draft_${Date.now()}`,
      fromName: activeAccount.name,
      fromEmail: activeAccount.email,
      to,
      subject,
      date: 'Just now',
      preview: htmlToPlainText(safeBody).slice(0, 100),
      bodyHtml: safeBody,
      folder: 'drafts',
      isUnread: false,
      isStarred: false,
      attachments,
    };

    emails = [draft, ...emails];
    saveEmails(emails);
    showComposeModal = false;
    updateSuiteStats();
  }

  // --- AI Email Features ---
  async function handleAiSummarize() {
    if (!selectedEmail) return;
    isAiSummarizing = true;
    try {
      const summary = await processAiRequest(
        'Summarize email with key takeaways and bullet point action items',
        `From: ${selectedEmail.fromName} (${selectedEmail.fromEmail})\nSubject: ${selectedEmail.subject}\nBody: ${htmlToPlainText(selectedEmail.bodyHtml)}`,
        settings
      );
      aiSummary = summary;
    } catch (err) {
      console.error('AI Summarize failed:', err);
    } finally {
      isAiSummarizing = false;
    }
  }

  async function handleAiQuickReply(prompt: string) {
    if (!selectedEmail) return;
    isAiGeneratingReply = true;
    try {
      const generated = await processAiRequest(
        `Draft reply: ${prompt}`,
        `Original Email: ${selectedEmail.subject}\nFrom: ${selectedEmail.fromName}\nText: ${selectedEmail.preview}`,
        settings
      );
      inlineReplyText = generated;
    } catch (err) {
      console.error('AI Reply generation failed:', err);
    } finally {
      isAiGeneratingReply = false;
    }
  }

  function sendInlineReply() {
    if (!selectedEmail || !inlineReplyText.trim()) return;
    const newMail: EmailMessage = {
      id: `mail_${Date.now()}`,
      fromName: activeAccount.name,
      fromEmail: activeAccount.email,
      to: [selectedEmail.fromEmail],
      subject: selectedEmail.subject.startsWith('Re:') ? selectedEmail.subject : `Re: ${selectedEmail.subject}`,
      date: 'Just now',
      preview: inlineReplyText.slice(0, 100),
      bodyHtml: sanitizeHtml(`<p>${textToSafeHtml(inlineReplyText)}</p>`),
      folder: 'sent',
      isUnread: false,
      isStarred: false,
    };

    emails = [newMail, ...emails];
    saveEmails(emails);
    inlineReplyText = '';
    alert('Reply sent successfully!');
    updateSuiteStats();
  }

  function buildReplyQuote(email: EmailMessage): string {
    return buildReplyQuoteHtml(email.fromName, email.bodyHtml);
  }

  // Exposed for Header Ribbon triggers
  export function triggerRibbonAction(action: string, _payload?: any) {
    if (action === 'newMail') handleOpenNewCompose();
    else if (action === 'reply' && selectedEmail) handleReply(selectedEmail);
    else if (action === 'archive' && selectedEmail) handleArchive(selectedEmail);
    else if (action === 'delete' && selectedEmail) handleDelete(selectedEmail);
    else if (action === 'star' && selectedEmail) toggleStar(selectedEmail);
    else if (action === 'markUnread' && selectedEmail) {
      selectedEmail.isUnread = true;
      emails = [...emails];
      saveEmails(emails);
      updateSuiteStats();
    }
  }
</script>

<div class="flex-1 flex overflow-hidden bg-[#1a1c1e] text-slate-200 select-none font-sans">
  
  <!-- LEFT: Folder Sidebar -->
  <aside class="w-60 bg-[#141517] border-r border-[#26282b] flex flex-col shrink-0">
    <!-- Account Selector -->
    <div class="p-3 border-b border-[#26282b]">
      <div class="flex items-center space-x-2.5 p-2 rounded-lg bg-white/5 border border-white/5 cursor-pointer hover:bg-white/10 transition-colors">
        <div class="w-7 h-7 rounded-lg bg-indigo-600 text-white font-bold flex items-center justify-center text-xs shadow-xs">
          {activeAccount.avatar}
        </div>
        <div class="flex-1 min-w-0">
          <span class="text-xs font-semibold text-white block truncate">{activeAccount.name}</span>
          <span class="text-[10px] text-slate-400 block truncate">{activeAccount.email}</span>
        </div>
        <ChevronDown size={14} class="text-slate-400" />
      </div>

      <!-- New Message Button -->
      <button
        class="w-full mt-3 flex items-center justify-center space-x-2 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition-all"
        on:click={handleOpenNewCompose}
      >
        <Plus size={15} />
        <span>New Message</span>
      </button>
    </div>

    <!-- Folders List -->
    <nav class="flex-1 p-2 space-y-0.5 overflow-y-auto text-xs">
      <button
        class="w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors
          {activeFolder === 'inbox' ? 'bg-indigo-600 text-white font-semibold' : 'text-slate-300 hover:text-white hover:bg-white/5'}"
        on:click={() => handleFolderChange('inbox')}
      >
        <div class="flex items-center space-x-2.5">
          <Inbox size={15} />
          <span>Inbox</span>
        </div>
        {#if folderCounts.inboxUnread > 0}
          <span class="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-indigo-400 text-indigo-950">
            {folderCounts.inboxUnread}
          </span>
        {/if}
      </button>

      <button
        class="w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors
          {activeFolder === 'starred' ? 'bg-indigo-600 text-white font-semibold' : 'text-slate-300 hover:text-white hover:bg-white/5'}"
        on:click={() => handleFolderChange('starred')}
      >
        <div class="flex items-center space-x-2.5">
          <Star size={15} class={activeFolder === 'starred' ? 'text-white' : 'text-amber-400'} />
          <span>Starred</span>
        </div>
        {#if folderCounts.starred > 0}
          <span class="text-[10px] text-slate-400 font-medium">{folderCounts.starred}</span>
        {/if}
      </button>

      <button
        class="w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors
          {activeFolder === 'sent' ? 'bg-indigo-600 text-white font-semibold' : 'text-slate-300 hover:text-white hover:bg-white/5'}"
        on:click={() => handleFolderChange('sent')}
      >
        <div class="flex items-center space-x-2.5">
          <Send size={15} />
          <span>Sent</span>
        </div>
        {#if folderCounts.sent > 0}
          <span class="text-[10px] text-slate-400 font-medium">{folderCounts.sent}</span>
        {/if}
      </button>

      <button
        class="w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors
          {activeFolder === 'drafts' ? 'bg-indigo-600 text-white font-semibold' : 'text-slate-300 hover:text-white hover:bg-white/5'}"
        on:click={() => handleFolderChange('drafts')}
      >
        <div class="flex items-center space-x-2.5">
          <FileText size={15} />
          <span>Drafts</span>
        </div>
        {#if folderCounts.drafts > 0}
          <span class="text-[10px] text-slate-400 font-medium">{folderCounts.drafts}</span>
        {/if}
      </button>

      <button
        class="w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors
          {activeFolder === 'archive' ? 'bg-indigo-600 text-white font-semibold' : 'text-slate-300 hover:text-white hover:bg-white/5'}"
        on:click={() => handleFolderChange('archive')}
      >
        <div class="flex items-center space-x-2.5">
          <Archive size={15} />
          <span>Archive</span>
        </div>
      </button>

      <button
        class="w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors
          {activeFolder === 'junk' ? 'bg-indigo-600 text-white font-semibold' : 'text-slate-300 hover:text-white hover:bg-white/5'}"
        on:click={() => handleFolderChange('junk')}
      >
        <div class="flex items-center space-x-2.5">
          <AlertOctagon size={15} />
          <span>Junk / Spam</span>
        </div>
      </button>

      <button
        class="w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors
          {activeFolder === 'trash' ? 'bg-indigo-600 text-white font-semibold' : 'text-slate-300 hover:text-white hover:bg-white/5'}"
        on:click={() => handleFolderChange('trash')}
      >
        <div class="flex items-center space-x-2.5">
          <Trash2 size={15} />
          <span>Trash</span>
        </div>
      </button>

      <!-- Labels & Tags -->
      <div class="pt-3 pb-1 px-3">
        <span class="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Labels</span>
      </div>

      <div class="space-y-0.5 px-2">
        <div class="flex items-center space-x-2 px-2 py-1 rounded text-slate-400 hover:text-slate-200 cursor-pointer">
          <span class="w-2 h-2 rounded-full bg-blue-500"></span>
          <span>Finance</span>
        </div>
        <div class="flex items-center space-x-2 px-2 py-1 rounded text-slate-400 hover:text-slate-200 cursor-pointer">
          <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
          <span>Milestones</span>
        </div>
        <div class="flex items-center space-x-2 px-2 py-1 rounded text-slate-400 hover:text-slate-200 cursor-pointer">
          <span class="w-2 h-2 rounded-full bg-purple-500"></span>
          <span>Compliance</span>
        </div>
      </div>
    </nav>

    <!-- Bottom Offline Status -->
    <div class="p-3 bg-[#111214] border-t border-[#26282b] flex items-center justify-between text-[11px] text-slate-400">
      <div class="flex items-center space-x-1.5">
        <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
        <span>Local Offline Queue</span>
      </div>
      <RefreshCw size={12} class="text-slate-500 hover:text-white cursor-pointer" />
    </div>
  </aside>

  <!-- MIDDLE: Email List Pane -->
  <section class="w-84 md:w-96 bg-[#18191c] border-r border-[#26282b] flex flex-col shrink-0">
    <!-- Search Bar & Filters -->
    <div class="p-3 border-b border-[#26282b] space-y-2">
      <div class="relative">
        <Search size={14} class="absolute left-2.5 top-2.5 text-slate-400" />
        <input
          type="text"
          bind:value={searchQuery}
          placeholder="Search sender, subject, body..."
          class="w-full bg-[#24272c] border border-slate-700/60 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 font-sans"
        />
        {#if searchQuery}
          <button class="absolute right-2.5 top-2.5 text-slate-400 hover:text-white" on:click={() => (searchQuery = '')}>
            <X size={13} />
          </button>
        {/if}
      </div>

      <div class="flex items-center justify-between text-xs text-slate-400">
        <span class="font-medium capitalize">{activeFolder} ({filteredEmails.length})</span>
        <button
          class="flex items-center space-x-1 text-[11px] px-2 py-0.5 rounded transition-colors
            {filterUnreadOnly ? 'bg-indigo-600/30 text-indigo-300 font-semibold' : 'hover:bg-white/5 text-slate-400'}"
          on:click={() => (filterUnreadOnly = !filterUnreadOnly)}
        >
          <Filter size={11} />
          <span>Unread Only</span>
        </button>
      </div>
    </div>

    <!-- Email Item List -->
    <div class="flex-1 overflow-y-auto divide-y divide-[#26282b]">
      {#if filteredEmails.length === 0}
        <div class="p-8 text-center text-slate-500 text-xs">
          <Mail size={32} class="mx-auto mb-2 opacity-30" />
          <p>No messages found in {activeFolder}.</p>
        </div>
      {:else}
        {#each filteredEmails as email (email.id)}
          {@const isSelected = selectedEmailId === email.id}
          <div
            role="button"
            tabindex="0"
            aria-current={isSelected ? 'true' : undefined}
            class="p-3 cursor-pointer transition-colors relative
              {isSelected ? 'bg-indigo-950/40 border-l-3 border-indigo-500' : 'hover:bg-white/5'}
              {email.isUnread ? 'font-semibold text-white' : 'text-slate-300'}"
            on:click={() => selectEmail(email)}
            on:keydown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                selectEmail(email);
              }
            }}
          >
            <!-- Top row: Sender name, date, unread dot -->
            <div class="flex items-center justify-between mb-1 text-xs">
              <div class="flex items-center space-x-1.5 truncate max-w-[200px]">
                {#if email.isUnread}
                  <span class="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0"></span>
                {/if}
                <span class="truncate {email.isUnread ? 'font-bold text-white' : 'font-medium text-slate-200'}">
                  {email.fromName}
                </span>
              </div>

              <div class="flex items-center space-x-1 shrink-0 text-[10px] text-slate-500">
                {#if email.attachments && email.attachments.length > 0}
                  <Paperclip size={11} class="text-slate-400" />
                {/if}
                <span>{email.date}</span>
                <button
                  class="p-0.5 rounded hover:text-amber-400 text-slate-500"
                  on:click={(e) => toggleStar(email, e)}
                >
                  <Star size={12} fill={email.isStarred ? '#fbbf24' : 'none'} class={email.isStarred ? 'text-amber-400' : ''} />
                </button>
              </div>
            </div>

            <!-- Subject -->
            <h4 class="text-xs truncate mb-1 {email.isUnread ? 'text-slate-100 font-semibold' : 'text-slate-300'}">
              {email.subject}
            </h4>

            <!-- Snippet -->
            <p class="text-[11px] text-slate-400 line-clamp-2 leading-relaxed font-normal">
              {email.preview}
            </p>

            <!-- Labels -->
            {#if email.labels && email.labels.length > 0}
              <div class="mt-2 flex items-center space-x-1.5">
                {#each email.labels as label}
                  <span class="text-[9px] px-1.5 py-0.2 rounded bg-white/5 text-slate-400 border border-white/5">
                    {label}
                  </span>
                {/each}
              </div>
            {/if}
          </div>
        {/each}
      {/if}
    </div>
  </section>

  <!-- RIGHT: Email Reading & Action Pane -->
  <main class="flex-1 bg-[#1e2024] flex flex-col overflow-hidden">
    {#if selectedEmail}
      <!-- Email Action Toolbar -->
      <div class="h-11 px-5 bg-[#18191c] border-b border-[#26282b] flex items-center justify-between text-xs shrink-0">
        <!-- Reply & Management Actions -->
        <div class="flex items-center space-x-1.5">
          <button
            class="flex items-center space-x-1 px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-xs transition-colors"
            on:click={() => handleReply(selectedEmail)}
            title="Reply"
          >
            <Reply size={13} />
            <span>Reply</span>
          </button>

          <button
            class="flex items-center space-x-1 px-2 py-1 rounded hover:bg-white/10 text-slate-300 transition-colors"
            on:click={() => handleReply(selectedEmail)}
            title="Reply All"
          >
            <ReplyAll size={13} />
            <span>Reply All</span>
          </button>

          <button
            class="flex items-center space-x-1 px-2 py-1 rounded hover:bg-white/10 text-slate-300 transition-colors"
            on:click={() => handleReply(selectedEmail)}
            title="Forward"
          >
            <Forward size={13} />
            <span>Forward</span>
          </button>

          <div class="h-4 w-px bg-slate-700 mx-1"></div>

          <button
            class="p-1.5 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
            on:click={() => handleArchive(selectedEmail)}
            title="Archive"
          >
            <Archive size={14} />
          </button>

          <button
            class="p-1.5 rounded hover:bg-rose-600/20 text-slate-400 hover:text-rose-400 transition-colors"
            on:click={() => handleDelete(selectedEmail)}
            title="Delete"
          >
            <Trash2 size={14} />
          </button>
        </div>

        <!-- AI Assistant Action Button -->
        <div class="flex items-center space-x-2">
          <button
            class="flex items-center space-x-1.5 px-3 py-1 rounded-lg bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/40 text-purple-200 text-xs font-semibold transition-all shadow-xs"
            on:click={handleAiSummarize}
            disabled={isAiSummarizing}
            title="Summarize email using OnlyOffice AI"
          >
            {#if isAiSummarizing}
              <Loader2 size={13} class="animate-spin text-purple-300" />
              <span>Analyzing...</span>
            {:else}
              <Sparkles size={13} class="text-purple-300" />
              <span>AI Summarize</span>
            {/if}
          </button>
        </div>
      </div>

      <!-- Email Content Scroll Canvas -->
      <div class="flex-1 overflow-y-auto p-6 space-y-5">
        
        <!-- Subject Heading -->
        <div class="flex items-start justify-between border-b border-slate-700/60 pb-4">
          <div>
            <h2 class="text-lg font-bold text-white leading-snug">{selectedEmail.subject}</h2>
            <div class="flex items-center space-x-2 mt-2 text-xs text-slate-400">
              <span class="font-semibold text-slate-200">{selectedEmail.fromName}</span>
              <span>&lt;{selectedEmail.fromEmail}&gt;</span>
              <span>•</span>
              <span>{selectedEmail.date}</span>
            </div>
            <div class="text-[11px] text-slate-500 mt-0.5">
              <span>To: {selectedEmail.to.join(', ')}</span>
              {#if selectedEmail.cc && selectedEmail.cc.length > 0}
                <span class="ml-2">Cc: {selectedEmail.cc.join(', ')}</span>
              {/if}
            </div>
          </div>

          <button
            class="p-1.5 rounded hover:bg-white/10 text-slate-400 hover:text-amber-400 transition-colors"
            on:click={() => toggleStar(selectedEmail)}
          >
            <Star size={16} fill={selectedEmail.isStarred ? '#fbbf24' : 'none'} class={selectedEmail.isStarred ? 'text-amber-400' : ''} />
          </button>
        </div>

        <!-- AI Summary Card (If activated) -->
        {#if aiSummary}
          <div class="bg-purple-950/40 border border-purple-500/40 rounded-xl p-4 text-xs text-purple-100 space-y-2 animate-in fade-in duration-200 relative">
            <div class="flex items-center justify-between font-semibold text-purple-300">
              <div class="flex items-center space-x-1.5">
                <Sparkles size={14} class="text-purple-400" />
                <span>OnlyOffice AI Executive Summary</span>
              </div>
              <button class="text-purple-400 hover:text-white" on:click={() => (aiSummary = null)}>
                <X size={14} />
              </button>
            </div>
            <div class="text-slate-200 leading-relaxed space-y-1">
              {@html textToSafeHtml(aiSummary)}
            </div>
          </div>
        {/if}

        <!-- Attachment Badges -->
        {#if selectedEmail.attachments && selectedEmail.attachments.length > 0}
          <div class="bg-[#24272c] border border-slate-700/60 rounded-xl p-3 space-y-2">
            <div class="flex items-center space-x-1.5 text-xs font-semibold text-slate-300">
              <Paperclip size={13} class="text-slate-400" />
              <span>Attachments ({selectedEmail.attachments.length})</span>
            </div>
            <div class="flex flex-wrap gap-2">
              {#each selectedEmail.attachments as att}
                <div class="flex items-center space-x-2 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs hover:border-indigo-500 transition-colors cursor-pointer group">
                  <div>
                    <span class="font-medium text-white block">{att.name}</span>
                    <span class="text-[10px] text-slate-400">{att.size}</span>
                  </div>
                  <Download size={13} class="text-slate-400 group-hover:text-indigo-400 ml-1" />
                </div>
              {/each}
            </div>
          </div>
        {/if}

        <!-- Email Body HTML -->
        <div class="prose prose-invert max-w-none text-slate-200 text-sm leading-relaxed font-sans pt-2">
          {@html sanitizeHtml(selectedEmail.bodyHtml)}
        </div>

        <!-- Quick AI Smart Replies & Inline Response -->
        <div class="border-t border-slate-700/60 pt-6 mt-8 space-y-3">
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold text-slate-300">Quick Response</span>
            <div class="flex items-center space-x-2 text-[11px]">
              <span class="text-purple-400 font-medium">Smart AI Replies:</span>
              <button
                class="px-2 py-0.5 rounded bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 border border-purple-500/30 transition-colors"
                on:click={() => handleAiQuickReply('Confirm acceptance and propose next steps')}
                disabled={isAiGeneratingReply}
              >
                Accept & Next Steps
              </button>
              <button
                class="px-2 py-0.5 rounded bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 border border-purple-500/30 transition-colors"
                on:click={() => handleAiQuickReply('Polite decline due to resource limits')}
                disabled={isAiGeneratingReply}
              >
                Polite Decline
              </button>
              <button
                class="px-2 py-0.5 rounded bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 border border-purple-500/30 transition-colors"
                on:click={() => handleAiQuickReply('Request additional specifications and details')}
                disabled={isAiGeneratingReply}
              >
                Request Details
              </button>
            </div>
          </div>

          <div class="relative bg-[#18191c] border border-slate-700 rounded-xl p-3 focus-within:border-indigo-500 transition-colors">
            <textarea
              bind:value={inlineReplyText}
              rows="4"
              placeholder={`Write a quick reply to ${selectedEmail.fromName}...`}
              class="w-full bg-transparent border-none text-xs text-white focus:outline-none resize-none font-sans leading-relaxed placeholder-slate-500"
            ></textarea>

            <div class="flex items-center justify-between pt-2 border-t border-slate-800">
              <span class="text-[11px] text-slate-500">Press Send to deliver to local outbox</span>
              <button
                class="flex items-center space-x-1.5 px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all shadow-xs"
                on:click={sendInlineReply}
                disabled={!inlineReplyText.trim()}
              >
                <Send size={12} />
                <span>Send Reply</span>
              </button>
            </div>
          </div>
        </div>

      </div>
    {:else}
      <div class="flex-1 flex flex-col items-center justify-center text-slate-500 text-xs">
        <Mail size={48} class="opacity-20 mb-3" />
        <p>Select an email from the list to view its contents.</p>
      </div>
    {/if}
  </main>

  <!-- Compose Modal -->
  {#if showComposeModal}
    <EmailComposeModal
      initialTo={composeReplyEmail ? composeReplyEmail.fromEmail : ''}
      initialSubject={composeReplyEmail ? (composeReplyEmail.subject.startsWith('Re:') ? composeReplyEmail.subject : `Re: ${composeReplyEmail.subject}`) : ''}
      initialBodyHtml={composeReplyEmail ? buildReplyQuote(composeReplyEmail) : '<p><br></p>'}
      replyToEmail={composeReplyEmail}
      {settings}
      on:close={() => (showComposeModal = false)}
      on:send={handleSendCompose}
      on:saveDraft={handleSaveDraftCompose}
    />
  {/if}

</div>
