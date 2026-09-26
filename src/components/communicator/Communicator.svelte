<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import {
    Hash,
    Info,
    Video,
    ExternalLink,
    Send,
    Sparkles,
    FileText,
    FileSpreadsheet,
    Presentation,
    FileCheck,
    ChevronDown,
    Building2,
    LogIn
  } from '@lucide/svelte';
  import type {
    CommunicatorUser,
    ChatChannel,
    ChatMessage,
    ChatAttachment,
    AppSettings
  } from '../../types';
  import {
    INITIAL_CHANNELS,
    COMMUNICATOR_DEMO_NOTICE,
    loadCurrentCommunicatorUser,
    loadCommunicatorMessages,
    saveCommunicatorMessages
  } from '../../lib/communicatorStore';
  import { processAiRequest } from '../../lib/ai';
  import LoginModal from './LoginModal.svelte';
  import CallModal from './CallModal.svelte';

  export let settings: AppSettings;
  export let isStandaloneWindow: boolean = false;

  const dispatch = createEventDispatcher<{
    updateStats: { unread: number; activeChannel: string };
    openOfficeDoc: { type: string; name: string };
    detachWindow: void;
  }>();

  let currentUser: CommunicatorUser = loadCurrentCommunicatorUser();
  let channels: ChatChannel[] = INITIAL_CHANNELS;
  let activeChannelId: string = 'chan_general';
  let messagesByChannel: Record<string, ChatMessage[]> = loadCommunicatorMessages();

  let chatInputText: string = '';
  let showLoginModal: boolean = false;
  let showCallModal: boolean = false;
  let isAiDrafting: boolean = false;

  let chatScrollContainer: HTMLDivElement;

  $: activeChannel = channels.find(c => c.id === activeChannelId) || channels[0];
  $: currentMessages = messagesByChannel[activeChannelId] || [];

  $: totalUnread = channels.reduce((acc, c) => acc + (c.unreadCount || 0), 0);

  $: userOrgName = getOrgName(currentUser.email);

  function getOrgName(email: string): string {
    if (!email || !email.includes('@')) return 'Demo workspace';
    const domain = email.split('@')[1].toLowerCase();
    return `Demo workspace • ${domain}`;
  }

  onMount(() => {
    updateStats();
    scrollToBottom();
  });

  function updateStats() {
    dispatch('updateStats', {
      unread: totalUnread,
      activeChannel: activeChannel ? (activeChannel.type === 'channel' ? `#${activeChannel.name}` : activeChannel.name) : 'Communicator',
    });
  }

  function scrollToBottom() {
    setTimeout(() => {
      if (chatScrollContainer) {
        chatScrollContainer.scrollTop = chatScrollContainer.scrollHeight;
      }
    }, 50);
  }

  function switchChannel(channel: ChatChannel) {
    activeChannelId = channel.id;
    channel.unreadCount = 0;
    channels = [...channels];
    updateStats();
    scrollToBottom();
  }

  function sendMessage() {
    if (!chatInputText.trim()) return;

    const newMsg: ChatMessage = {
      id: `msg_${Date.now()}`,
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderAvatar: currentUser.avatar,
      senderRole: currentUser.role,
      content: chatInputText.trim(),
      timestamp: 'Just now',
      isEncrypted: false,
      reactions: {},
    };

    if (!messagesByChannel[activeChannelId]) {
      messagesByChannel[activeChannelId] = [];
    }

    messagesByChannel[activeChannelId] = [...messagesByChannel[activeChannelId], newMsg];
    saveCommunicatorMessages(messagesByChannel);
    chatInputText = '';
    scrollToBottom();

    if (activeChannelId === 'dm_ai') {
      setTimeout(async () => {
        const aiResponse = await processAiRequest(
          'Provide a helpful reply for this demo chat',
          newMsg.content,
          settings
        );
        const botMsg: ChatMessage = {
          id: `msg_ai_${Date.now()}`,
          senderId: 'user_ai',
          senderName: 'Suite AI Assistant',
          senderAvatar: 'AI',
          senderRole: 'Built-in Assistant',
          content: aiResponse,
          timestamp: 'Just now',
          isEncrypted: false,
        };
        messagesByChannel[activeChannelId] = [...messagesByChannel[activeChannelId], botMsg];
        saveCommunicatorMessages(messagesByChannel);
        scrollToBottom();
      }, 400);
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function addReaction(msg: ChatMessage, emoji: string) {
    if (!msg.reactions) msg.reactions = {};
    msg.reactions[emoji] = (msg.reactions[emoji] || 0) + 1;
    messagesByChannel = { ...messagesByChannel };
    saveCommunicatorMessages(messagesByChannel);
  }

  function attachSuiteFile(type: 'docx' | 'xlsx' | 'pptx' | 'pdf') {
    const names = {
      docx: 'Sample_Document.docx',
      xlsx: 'Sample_Budget.xlsx',
      pptx: 'Sample_Deck.pptx',
      pdf: 'Sample_Agreement.pdf',
    };
    const sizes = { docx: '34 KB', xlsx: '28 KB', pptx: '2.4 MB', pdf: '410 KB' };

    const att: ChatAttachment = {
      id: `att_${Date.now()}`,
      name: names[type],
      type,
      size: sizes[type],
    };

    const newMsg: ChatMessage = {
      id: `msg_${Date.now()}`,
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderAvatar: currentUser.avatar,
      senderRole: currentUser.role,
      content: `Added a demo document entry to this channel: **${names[type]}** (placeholder only, no file was uploaded)`,
      timestamp: 'Just now',
      isEncrypted: false,
      attachments: [att],
    };

    messagesByChannel[activeChannelId] = [...(messagesByChannel[activeChannelId] || []), newMsg];
    saveCommunicatorMessages(messagesByChannel);
    scrollToBottom();
  }

  async function handleAiAssist() {
    isAiDrafting = true;
    try {
      const transcript = currentMessages
        .slice(-6)
        .map(m => `${m.senderName}: ${m.content}`)
        .join('\n');
      const generated = await processAiRequest(
        `Draft a short team update for the demo channel #${activeChannel.name}`,
        transcript || 'Local demo workspace for the Simple Office Suite sample build.',
        settings
      );
      chatInputText = generated;
    } catch (err) {
      console.error('AI Draft failed:', err);
    } finally {
      isAiDrafting = false;
    }
  }

  function handleDetach() {
    // 1. If in Tauri desktop, attempt to open standalone window
    if (typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__) {
      try {
        const { invoke } = (window as any).__TAURI_INTERNALS__;
        if (invoke) {
          invoke('open_detached_communicator').catch(() => {
            window.open('index.html?mode=communicator', '_blank', 'width=1050,height=720');
          });
        }
      } catch {
        window.open('index.html?mode=communicator', '_blank', 'width=1050,height=720');
      }
    } else {
      window.open('index.html?mode=communicator', '_blank', 'width=1050,height=720');
    }
    dispatch('detachWindow');
  }

  export function triggerRibbonAction(action: string, _payload?: any) {
    if (action === 'meetNow') showCallModal = true;
    else if (action === 'detach') handleDetach();
    else if (action === 'switchAccount') showLoginModal = true;
    else if (action === 'aiDraft') handleAiAssist();
  }
</script>

<div class="flex-1 flex overflow-hidden bg-[#18191c] text-slate-200 select-none font-sans">
  
  <!-- LEFT: Sample Channels & Direct Messages Sidebar -->
  <aside class="w-64 bg-[#141517] border-r border-[#26282b] flex flex-col shrink-0">
    
    <!-- Workspace / Organization Banner -->
    <div class="p-3 border-b border-[#26282b] bg-[#101113]">
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-2 truncate">
          <div class="w-7 h-7 rounded-lg bg-gradient-to-tr from-cyan-600 to-indigo-600 flex items-center justify-center text-white font-bold text-xs shadow-xs">
            <Building2 size={14} />
          </div>
          <div class="truncate">
            <span class="font-bold text-white text-xs block truncate">{userOrgName}</span>
            <div class="flex items-center space-x-1 text-[10px] text-amber-300 font-medium">
              <Info size={11} />
              <span>Local demo chat • not encrypted</span>
            </div>
          </div>
        </div>

        <button
          class="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white"
          on:click={() => (showLoginModal = true)}
          title="Switch Account / Login"
        >
          <LogIn size={14} />
        </button>
      </div>

      <!-- Current User Profile Card -->
      <button
        type="button"
        class="mt-2.5 p-2 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between cursor-pointer hover:bg-white/10 transition-colors w-full text-left"
        on:click={() => (showLoginModal = true)}
        title="Edit Profile & Email"
      >
        <div class="flex items-center space-x-2 min-w-0">
          <div class="relative">
            <div class="w-7 h-7 rounded-lg bg-indigo-600 text-white font-bold flex items-center justify-center text-xs">
              {currentUser.avatar}
            </div>
            <span
              class="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#141517]
                {currentUser.presence === 'online' ? 'bg-emerald-400' : currentUser.presence === 'busy' ? 'bg-rose-500' : currentUser.presence === 'away' ? 'bg-amber-400' : 'bg-slate-500'}"
            ></span>
          </div>

          <div class="min-w-0">
            <span class="text-xs font-semibold text-white block truncate">{currentUser.name}</span>
            <span class="text-[10px] text-slate-400 block truncate">{currentUser.email}</span>
          </div>
        </div>

        <ChevronDown size={13} class="text-slate-400" />
      </button>
    </div>

    <!-- Navigation List: Channels & DMs -->
    <nav class="flex-1 p-2 space-y-4 overflow-y-auto text-xs">
      
      <!-- CHANNELS -->
      <div>
        <div class="flex items-center justify-between px-2 mb-1">
          <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Channels</span>
        </div>

        <div class="space-y-0.5">
          {#each channels.filter(c => c.type === 'channel') as chan (chan.id)}
            {@const isActive = activeChannelId === chan.id}
            <button
              class="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg transition-colors
                {isActive ? 'bg-cyan-600/30 text-cyan-200 font-semibold border border-cyan-500/30 shadow-xs' : 'text-slate-300 hover:text-white hover:bg-white/5'}"
              on:click={() => switchChannel(chan)}
            >
              <div class="flex items-center space-x-2 truncate">
                <Hash size={14} class={isActive ? 'text-cyan-400' : 'text-slate-400'} />
                <span class="truncate">{chan.name}</span>
              </div>

              {#if chan.unreadCount > 0}
                <span class="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-cyan-400 text-cyan-950">
                  {chan.unreadCount}
                </span>
              {/if}
            </button>
          {/each}
        </div>
      </div>

      <!-- DIRECT MESSAGES -->
      <div>
        <div class="flex items-center justify-between px-2 mb-1">
          <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Direct Messages</span>
        </div>

        <div class="space-y-0.5">
          {#each channels.filter(c => c.type === 'dm') as dm (dm.id)}
            {@const isActive = activeChannelId === dm.id}
            <button
              class="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg transition-colors
                {isActive ? 'bg-cyan-600/30 text-cyan-200 font-semibold border border-cyan-500/30 shadow-xs' : 'text-slate-300 hover:text-white hover:bg-white/5'}"
              on:click={() => switchChannel(dm)}
            >
              <div class="flex items-center space-x-2 truncate">
                <div class="relative">
                  <div class="w-5 h-5 rounded-md bg-slate-700 text-white font-bold flex items-center justify-center text-[10px]">
                    {dm.recipientUser?.avatar || dm.name[0]}
                  </div>
                  <span
                    class="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-[#141517]
                      {dm.recipientUser?.presence === 'online' ? 'bg-emerald-400' : dm.recipientUser?.presence === 'busy' ? 'bg-rose-500' : dm.recipientUser?.presence === 'away' ? 'bg-amber-400' : 'bg-slate-500'}"
                  ></span>
                </div>
                <span class="truncate">{dm.name}</span>
              </div>

              {#if dm.unreadCount > 0}
                <span class="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-cyan-400 text-cyan-950">
                  {dm.unreadCount}
                </span>
              {/if}
            </button>
          {/each}
        </div>
      </div>

    </nav>

    <!-- Bottom Quick Action: Detach Standalone Button -->
    <div class="p-3 bg-[#101113] border-t border-[#26282b] flex items-center justify-between text-xs">
      {#if !isStandaloneWindow}
        <button
          type="button"
          class="flex items-center space-x-1.5 text-cyan-400 hover:text-cyan-300 font-medium text-[11px]"
          on:click={handleDetach}
          title="Open Communicator in an independent standalone window"
        >
          <ExternalLink size={13} />
          <span>Detach Standalone App</span>
        </button>
      {/if}

      <span class="text-[10px] text-slate-500 font-mono">v1.0.0</span>
    </div>

  </aside>

  <!-- RIGHT: Active Chat & Communication Area -->
  <main class="flex-1 flex flex-col bg-[#1a1c1e] overflow-hidden">
    
    <!-- Top Channel Header -->
    <header class="h-12 px-5 bg-[#141517] border-b border-[#26282b] flex items-center justify-between text-xs shrink-0">
      <div class="flex items-center space-x-3">
        <div class="flex items-center space-x-1.5 font-bold text-white text-sm">
          {#if activeChannel.type === 'channel'}
            <Hash size={16} class="text-cyan-400" />
            <span>{activeChannel.name}</span>
          {:else}
            <span class="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
            <span>{activeChannel.name}</span>
          {/if}
        </div>

        {#if activeChannel.description}
          <span class="hidden md:inline text-slate-400 text-xs border-l border-slate-700 pl-3 truncate max-w-md">
            {activeChannel.description}
          </span>
        {/if}
      </div>

      <!-- Action Buttons -->
      <div class="flex items-center space-x-2">
        
        <div class="flex items-center space-x-1 px-2 py-0.5 rounded-full bg-amber-950/50 border border-amber-500/30 text-amber-200 text-[10px] font-medium">
          <Info size={11} class="text-amber-300" />
          <span>Local demo data</span>
        </div>

        <button
          class="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-all shadow-xs"
          on:click={() => (showCallModal = true)}
          title="Open the simulated call screen (no audio, video, or network)"
        >
          <Video size={13} />
          <span>Meet Now</span>
        </button>

        <!-- Detach Button -->
        {#if !isStandaloneWindow}
          <button
            type="button"
            class="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
            on:click={handleDetach}
            title="Detach into Standalone Window"
          >
            <ExternalLink size={15} />
          </button>
        {/if}
      </div>
    </header>

    <div class="px-5 py-2 bg-amber-950/40 border-b border-amber-700/40 text-[11px] text-amber-100 flex items-start space-x-2 shrink-0">
      <Info size={13} class="text-amber-300 shrink-0 mt-0.5" />
      <span>{COMMUNICATOR_DEMO_NOTICE} Messages and attachments are stored as plain text in the app profile.</span>
    </div>

    <!-- Messages Feed -->
    <div
      bind:this={chatScrollContainer}
      class="flex-1 p-5 overflow-y-auto space-y-4"
    >
      {#each currentMessages as msg (msg.id)}
        <div class="flex items-start space-x-3 group">
          <!-- Avatar -->
          <div class="w-8 h-8 rounded-lg bg-gradient-to-tr from-slate-700 to-slate-600 text-white font-bold flex items-center justify-center text-xs shrink-0 shadow-xs">
            {msg.senderAvatar}
          </div>

          <!-- Content Box -->
          <div class="flex-1 min-w-0">
            <div class="flex items-baseline space-x-2">
              <span class="font-bold text-xs text-white">{msg.senderName}</span>
              {#if msg.senderRole}
                <span class="text-[10px] text-cyan-400/90 font-medium">[{msg.senderRole}]</span>
              {/if}
              <span class="text-[10px] text-slate-500">{msg.timestamp}</span>
            </div>

            <!-- Text Body -->
            <div class="mt-1 text-xs text-slate-200 leading-relaxed font-sans select-text whitespace-pre-wrap">
              {msg.content}
            </div>

            <!-- Attached Office Documents (Interactive) -->
            {#if msg.attachments && msg.attachments.length > 0}
              <div class="mt-2.5 flex flex-wrap gap-2">
                {#each msg.attachments as att}
                  <div class="flex items-center space-x-2.5 p-2.5 bg-[#202226] border border-slate-700 rounded-xl hover:border-cyan-500 transition-colors">
                    {#if att.type === 'docx'}
                      <FileText size={18} class="text-blue-400 shrink-0" />
                    {:else if att.type === 'xlsx'}
                      <FileSpreadsheet size={18} class="text-emerald-400 shrink-0" />
                    {:else if att.type === 'pptx'}
                      <Presentation size={18} class="text-orange-400 shrink-0" />
                    {:else}
                      <FileCheck size={18} class="text-rose-400 shrink-0" />
                    {/if}

                    <div class="min-w-0 pr-2">
                      <span class="font-semibold text-xs text-white block truncate">{att.name}</span>
                      <span class="text-[10px] text-slate-400">{att.size}</span>
                    </div>

                    <button
                      class="px-2 py-1 rounded bg-white/10 hover:bg-cyan-600 hover:text-white text-[11px] font-medium text-slate-200 transition-colors"
                      on:click={() => dispatch('openOfficeDoc', { type: att.type, name: att.name })}
                      title="Switches to the matching workspace. The demo attachment has no stored file."
                    >
                      Open
                    </button>
                  </div>
                {/each}
              </div>
              <p class="mt-1.5 text-[10px] text-amber-200/70">
                Demo attachment: no file data is stored or transferred. "Open" only switches workspaces.
              </p>
            {/if}

            <!-- Reactions Bar -->
            <div class="mt-2 flex items-center space-x-1">
              {#if msg.reactions}
                {#each Object.entries(msg.reactions) as [emoji, count]}
                  <button
                    class="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 text-xs flex items-center space-x-1"
                    on:click={() => addReaction(msg, emoji)}
                  >
                    <span>{emoji}</span>
                    <span class="text-[10px] text-slate-400">{count}</span>
                  </button>
                {/each}
              {/if}

              <!-- Add reaction triggers (visible on hover) -->
              <div class="opacity-0 group-hover:opacity-100 transition-opacity flex items-center space-x-0.5 pl-1">
                <button class="p-1 rounded hover:bg-white/10 text-xs" on:click={() => addReaction(msg, '👍')}>👍</button>
                <button class="p-1 rounded hover:bg-white/10 text-xs" on:click={() => addReaction(msg, '❤️')}>❤️</button>
                <button class="p-1 rounded hover:bg-white/10 text-xs" on:click={() => addReaction(msg, '🚀')}>🚀</button>
                <button class="p-1 rounded hover:bg-white/10 text-xs" on:click={() => addReaction(msg, '🎉')}>🎉</button>
              </div>
            </div>

          </div>
        </div>
      {/each}
    </div>

    <!-- Bottom Message Input Toolbar -->
    <div class="p-4 bg-[#141517] border-t border-[#26282b] shrink-0">
      <div class="bg-[#1f2125] border border-slate-700/80 rounded-xl p-2.5 focus-within:border-cyan-500 transition-all shadow-md">
        
        <!-- Textarea -->
        <textarea
          bind:value={chatInputText}
          on:keydown={handleKeydown}
          rows="2"
          placeholder={`Message ${activeChannel.type === 'channel' ? '#' + activeChannel.name : activeChannel.name}...`}
          class="w-full bg-transparent border-none text-xs text-white focus:outline-none resize-none font-sans placeholder-slate-500"
        ></textarea>

        <!-- Bottom Controls Bar -->
        <div class="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs">
          <!-- Office Quick Attachments -->
          <div class="flex items-center space-x-1 text-slate-400">
            <button
              class="flex items-center space-x-1 px-1.5 py-0.5 rounded hover:bg-white/10 text-blue-400 text-[11px]"
              on:click={() => attachSuiteFile('docx')}
              title="Attach Word Document"
            >
              <FileText size={13} />
              <span class="hidden sm:inline">Word</span>
            </button>

            <button
              class="flex items-center space-x-1 px-1.5 py-0.5 rounded hover:bg-white/10 text-emerald-400 text-[11px]"
              on:click={() => attachSuiteFile('xlsx')}
              title="Attach Sheet Spreadsheet"
            >
              <FileSpreadsheet size={13} />
              <span class="hidden sm:inline">Sheet</span>
            </button>

            <button
              class="flex items-center space-x-1 px-1.5 py-0.5 rounded hover:bg-white/10 text-orange-400 text-[11px]"
              on:click={() => attachSuiteFile('pptx')}
              title="Attach Presentation Slides"
            >
              <Presentation size={13} />
              <span class="hidden sm:inline">Slides</span>
            </button>

            <button
              class="flex items-center space-x-1 px-1.5 py-0.5 rounded hover:bg-white/10 text-rose-400 text-[11px]"
              on:click={() => attachSuiteFile('pdf')}
              title="Attach PDF Document"
            >
              <FileCheck size={13} />
              <span class="hidden sm:inline">PDF</span>
            </button>
          </div>

          <!-- AI Assistant & Send Button -->
          <div class="flex items-center space-x-2">
            <button
              class="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/40 text-purple-200 text-xs font-semibold transition-all shadow-xs"
              on:click={handleAiAssist}
              disabled={isAiDrafting}
              title="Draft an update with the built-in template assistant or the model configured in Settings"
            >
              <Sparkles size={12} class="text-purple-300" />
              <span>{isAiDrafting ? 'Drafting...' : 'AI Assist'}</span>
            </button>

            <button
              class="flex items-center space-x-1.5 px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs shadow-md transition-all disabled:opacity-50"
              on:click={sendMessage}
              disabled={!chatInputText.trim()}
            >
              <Send size={12} />
              <span>Send</span>
            </button>
          </div>
        </div>

      </div>
    </div>

  </main>

  <!-- Login / Switch Account Modal -->
  {#if showLoginModal}
    <LoginModal
      {currentUser}
      on:close={() => (showLoginModal = false)}
      on:login={(e) => {
        currentUser = e.detail;
        showLoginModal = false;
      }}
    />
  {/if}

  <!-- Video Meeting Call Modal -->
  {#if showCallModal}
    <CallModal
      channelName={activeChannel.name}
      {currentUser}
      on:close={() => (showCallModal = false)}
    />
  {/if}

</div>
