<script lang="ts">
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  import {
    Mic,
    MicOff,
    Video,
    VideoOff,
    ScreenShare,
    PhoneOff,
    Users,
    ShieldCheck,
    Maximize2,
    Settings
  } from 'lucide-svelte';
  import type { CommunicatorUser } from '../../types';
  import { TEAM_USERS } from '../../lib/communicatorStore';

  export let channelName: string = 'general';
  export let currentUser: CommunicatorUser;

  const dispatch = createEventDispatcher<{
    close: void;
  }>();

  let isMuted: boolean = false;
  let isVideoOff: boolean = false;
  let isScreenSharing: boolean = false;
  let callSeconds: number = 0;
  let timerInterval: any = null;

  let activeSpeakerId: string = 'user_alex';

  $: callDurationFormatted = `${Math.floor(callSeconds / 60)
    .toString()
    .padStart(2, '0')}:${(callSeconds % 60).toString().padStart(2, '0')}`;

  onMount(() => {
    timerInterval = setInterval(() => {
      callSeconds += 1;
      // Cycle active speaker every few seconds for dynamic realism
      if (callSeconds % 6 === 0) {
        const speakers = ['user_alex', 'user_sarah', 'user_self', 'user_elena'];
        activeSpeakerId = speakers[Math.floor(Math.random() * speakers.length)];
      }
    }, 1000);
  });

  onDestroy(() => {
    if (timerInterval) clearInterval(timerInterval);
  });

  const participants = [
    { ...currentUser, isSelf: true },
    TEAM_USERS[0], // Alex Chen
    TEAM_USERS[1], // Sarah Jenkins
    TEAM_USERS[2], // Elena Rostova
  ];
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 select-none animate-in fade-in">
  <div class="bg-[#181a1d] text-slate-200 border border-slate-700/80 rounded-2xl shadow-2xl w-full max-w-4xl h-[640px] flex flex-col overflow-hidden animate-in zoom-in-95">
    
    <!-- Call Header -->
    <div class="h-12 px-5 bg-[#121315] border-b border-[#25282c] flex items-center justify-between shrink-0">
      <div class="flex items-center space-x-3">
        <span class="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
        <div>
          <h3 class="font-bold text-sm text-white">Teams Meeting: #{channelName}</h3>
          <div class="flex items-center space-x-2 text-[11px] text-slate-400">
            <span>{callDurationFormatted}</span>
            <span>•</span>
            <span class="text-cyan-400 flex items-center space-x-1">
              <ShieldCheck size={12} />
              <span>E2EE Audio/Video Guard</span>
            </span>
          </div>
        </div>
      </div>

      <div class="flex items-center space-x-2">
        <div class="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-white/5 text-xs text-slate-300">
          <Users size={14} class="text-slate-400" />
          <span>{participants.length}</span>
        </div>
      </div>
    </div>

    <!-- Video Grid -->
    <div class="flex-1 p-4 grid grid-cols-2 gap-3 overflow-hidden bg-[#161719]">
      {#each participants as p}
        {@const isSpeaking = activeSpeakerId === p.id}
        <div
          class="relative rounded-xl overflow-hidden bg-slate-900 border-2 transition-all flex flex-col items-center justify-center
            {isSpeaking ? 'border-cyan-500 ring-4 ring-cyan-500/20 shadow-lg' : 'border-slate-800'}"
        >
          <!-- Simulated Video Background Gradient / Avatar -->
          <div class="w-20 h-20 rounded-2xl bg-gradient-to-tr from-slate-800 to-slate-700 border border-slate-600 flex items-center justify-center text-white text-2xl font-bold shadow-inner">
            {p.avatar}
          </div>

          <!-- Name & Mute Badge -->
          <div class="absolute bottom-3 left-3 flex items-center space-x-2 bg-black/60 backdrop-blur-xs px-2.5 py-1 rounded-lg text-xs text-white">
            <span class="font-medium">{p.name} {p.isSelf ? '(You)' : ''}</span>
            {#if p.isSelf && isMuted}
              <MicOff size={12} class="text-rose-400" />
            {:else if isSpeaking}
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
            {/if}
          </div>

          <!-- Video Off overlay if self is toggled off -->
          {#if p.isSelf && isVideoOff}
            <div class="absolute inset-0 bg-black/80 flex items-center justify-center">
              <span class="text-xs text-slate-400">Camera Off</span>
            </div>
          {/if}
        </div>
      {/each}
    </div>

    <!-- Call Control Bar -->
    <div class="h-16 px-6 bg-[#121315] border-t border-[#25282c] flex items-center justify-center space-x-4 shrink-0">
      
      <!-- Microphone Toggle -->
      <button
        type="button"
        class="flex flex-col items-center justify-center w-11 h-11 rounded-xl transition-all
          {isMuted ? 'bg-rose-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'}"
        on:click={() => (isMuted = !isMuted)}
        title={isMuted ? 'Unmute' : 'Mute'}
      >
        {#if isMuted}
          <MicOff size={18} />
        {:else}
          <Mic size={18} />
        {/if}
      </button>

      <!-- Video Camera Toggle -->
      <button
        type="button"
        class="flex flex-col items-center justify-center w-11 h-11 rounded-xl transition-all
          {isVideoOff ? 'bg-rose-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'}"
        on:click={() => (isVideoOff = !isVideoOff)}
        title={isVideoOff ? 'Turn on Camera' : 'Turn off Camera'}
      >
        {#if isVideoOff}
          <VideoOff size={18} />
        {:else}
          <Video size={18} />
        {/if}
      </button>

      <!-- Screen Sharing Toggle -->
      <button
        type="button"
        class="flex flex-col items-center justify-center w-11 h-11 rounded-xl transition-all
          {isScreenSharing ? 'bg-cyan-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'}"
        on:click={() => (isScreenSharing = !isScreenSharing)}
        title="Share Screen"
      >
        <ScreenShare size={18} />
      </button>

      <!-- End Call Button -->
      <button
        type="button"
        class="flex items-center space-x-2 px-5 h-11 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-lg transition-all"
        on:click={() => dispatch('close')}
      >
        <PhoneOff size={18} />
        <span>Leave Call</span>
      </button>

    </div>

  </div>
</div>
