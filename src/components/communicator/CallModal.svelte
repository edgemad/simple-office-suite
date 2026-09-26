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
    Info,
    
    
    UserPlus,
    X,
    
    UserMinus,
    Volume2,
    VolumeX
  } from '@lucide/svelte';
  import type { CommunicatorUser } from '../../types';

  export let channelName: string = 'general';
  export let currentUser: CommunicatorUser;
  export let initialParticipants: CommunicatorUser[] = [];
  export let availableUsers: CommunicatorUser[] = [];

  const dispatch = createEventDispatcher<{
    close: void;
  }>();

  let isMuted: boolean = false;
  let isVideoOff: boolean = false;
  let isScreenSharing: boolean = false;
  let callSeconds: number = 0;
  let timerInterval: any = null;

  let showInviteDialog = false;
  let newGuestName = '';
  let newGuestEmail = '';
  let selectedExistingUserId = '';

  let activeSpeakerId: string = currentUser.id;

  // Active participants in this call
  let participants: (CommunicatorUser & { isMuted?: boolean })[] = [];

  onMount(() => {
    // Initialize participants
    const selfUser = { ...currentUser, isSelf: true };
    const others = initialParticipants.filter(p => p.id !== currentUser.id);
    participants = [selfUser, ...(others.length > 0 ? others : availableUsers.slice(0, 3))];

    timerInterval = setInterval(() => {
      callSeconds += 1;
      if (callSeconds % 5 === 0 && participants.length > 1) {
        const otherP = participants.filter(p => !p.isMuted && !p.isSelf);
        if (otherP.length > 0) {
          activeSpeakerId = otherP[Math.floor(Math.random() * otherP.length)].id;
        }
      }
    }, 1000);
  });

  onDestroy(() => {
    if (timerInterval) clearInterval(timerInterval);
  });

  $: callDurationFormatted = `${Math.floor(callSeconds / 60)
    .toString()
    .padStart(2, '0')}:${(callSeconds % 60).toString().padStart(2, '0')}`;
  $: nonCallUsers = availableUsers.filter(u => !participants.some(p => p.id === u.id));

  function addExistingParticipant() {
    if (!selectedExistingUserId) return;
    const found = availableUsers.find(u => u.id === selectedExistingUserId);
    if (found && !participants.some(p => p.id === found.id)) {
      participants = [...participants, { ...found, isMuted: false }];
    }
    selectedExistingUserId = '';
    showInviteDialog = false;
  }

  function addNewGuest() {
    if (!newGuestName.trim()) return;
    const guest: CommunicatorUser = {
      id: `guest_${Date.now()}`,
      name: newGuestName.trim(),
      email: newGuestEmail.trim() || `${newGuestName.toLowerCase().replace(/\s+/g, '.')}@guest.local`,
      avatar: newGuestName.slice(0, 2).toUpperCase(),
      role: 'Invited Guest',
      presence: 'online',
    };
    participants = [...participants, { ...guest, isMuted: false }];
    newGuestName = '';
    newGuestEmail = '';
    showInviteDialog = false;
  }

  function removeParticipant(id: string) {
    participants = participants.filter(p => p.id !== id);
  }

  function toggleParticipantMute(id: string) {
    participants = participants.map(p => {
      if (p.id === id) {
        return { ...p, isMuted: !p.isMuted };
      }
      return p;
    });
  }
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 select-none animate-in fade-in">
  <div class="bg-[#181a1d] text-slate-200 border border-slate-700/80 rounded-2xl shadow-2xl w-full max-w-4xl h-[640px] flex flex-col overflow-hidden animate-in zoom-in-95 relative">
    
    <!-- Call Header -->
    <div class="h-12 px-5 bg-[#121315] border-b border-[#25282c] flex items-center justify-between shrink-0">
      <div class="flex items-center space-x-3">
        <span class="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse"></span>
        <div>
          <h3 class="font-bold text-sm text-white">Demo Call: #{channelName}</h3>
          <div class="flex items-center space-x-2 text-[11px] text-slate-400">
            <span>{callDurationFormatted}</span>
            <span>•</span>
            <span class="text-amber-300 flex items-center space-x-1">
              <Info size={12} />
              <span>Simulated call</span>
            </span>
          </div>
        </div>
      </div>

      <div class="flex items-center space-x-2">
        <button
          type="button"
          class="flex items-center space-x-1.5 px-3 py-1 rounded-lg bg-cyan-600/30 border border-cyan-500/40 text-xs text-cyan-300 hover:bg-cyan-600/50 transition-colors font-medium"
          on:click={() => (showInviteDialog = !showInviteDialog)}
        >
          <UserPlus size={13} />
          <span>Add People</span>
        </button>

        <div class="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-white/5 text-xs text-slate-300" title="Number of sample participants shown in this local demo">
          <Users size={14} class="text-slate-400" />
          <span>{participants.length}</span>
        </div>
      </div>
    </div>

    <div class="px-5 py-2 bg-amber-950/40 border-b border-amber-700/40 text-[11px] text-amber-100 flex items-start space-x-2 shrink-0">
      <Info size={13} class="text-amber-300 shrink-0 mt-0.5" />
      <span>
        Demo only: this screen is a local simulation. No microphone, camera, screen share, or network call is used, the
        participants and timer are sample data, and the controls below only change this mock UI.
      </span>
    </div>

    <!-- Video Grid -->
    <div
      class="flex-1 p-4 grid gap-3 overflow-y-auto bg-[#161719]
        {participants.length <= 2 ? 'grid-cols-2' : participants.length <= 4 ? 'grid-cols-2 grid-rows-2' : 'grid-cols-3'}"
    >
      {#each participants as p (p.id)}
        {@const isSpeaking = activeSpeakerId === p.id && !p.isMuted}
        <div
          class="relative rounded-xl overflow-hidden bg-slate-900 border-2 transition-all flex flex-col items-center justify-center group min-h-[160px]
            {isSpeaking ? 'border-cyan-500 ring-4 ring-cyan-500/20 shadow-lg' : 'border-slate-800'}"
        >
          <!-- Sample Video Tile / Avatar -->
          <div class="w-20 h-20 rounded-2xl bg-gradient-to-tr from-slate-800 to-slate-700 border border-slate-600 flex items-center justify-center text-white text-2xl font-bold shadow-inner">
            {p.avatar}
          </div>

          <!-- Name & Mute Badge -->
          <div class="absolute bottom-2.5 left-2.5 flex items-center space-x-2 bg-black/70 backdrop-blur-xs px-2.5 py-1 rounded-lg text-xs text-white z-10">
            <span class="font-medium text-[11px]">{p.name} {p.isSelf ? '(You)' : ''}</span>
            {#if (p.isSelf && isMuted) || p.isMuted}
              <MicOff size={11} class="text-rose-400" />
            {:else if isSpeaking}
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
            {/if}
          </div>

          <!-- Video Off overlay if self is toggled off -->
          {#if p.isSelf && isVideoOff}
            <div class="absolute inset-0 bg-black/85 flex items-center justify-center z-10">
              <span class="text-xs text-slate-400 font-medium">Camera Off</span>
            </div>
          {/if}

          <!-- Participant Management Actions (Hover over tile) -->
          {#if !p.isSelf}
            <div class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center space-x-1 z-20">
              <button
                class="p-1.5 rounded-md bg-black/60 hover:bg-black/90 text-slate-300 hover:text-white transition-colors"
                on:click={() => toggleParticipantMute(p.id)}
                title={p.isMuted ? 'Unmute participant' : 'Mute participant'}
              >
                {#if p.isMuted}
                  <VolumeX size={12} class="text-rose-400" />
                {:else}
                  <Volume2 size={12} />
                {/if}
              </button>
              <button
                class="p-1.5 rounded-md bg-rose-600/80 hover:bg-rose-600 text-white transition-colors"
                on:click={() => removeParticipant(p.id)}
                title="Remove from call"
              >
                <UserMinus size={12} />
              </button>
            </div>
          {/if}
        </div>
      {/each}
    </div>

    <!-- Invite Dialog Popover -->
    {#if showInviteDialog}
      <div class="absolute top-14 right-5 w-80 bg-[#1e2023] border border-cyan-500/40 rounded-xl shadow-2xl p-4 z-40 animate-in fade-in slide-in-from-top-2 text-xs">
        <div class="flex items-center justify-between pb-2 border-b border-white/10 mb-3">
          <span class="font-bold text-white flex items-center space-x-1.5">
            <UserPlus size={14} class="text-cyan-400" />
            <span>Invite to Meeting</span>
          </span>
          <button class="text-slate-400 hover:text-white p-0.5" on:click={() => (showInviteDialog = false)}>
            <X size={14} />
          </button>
        </div>

        {#if nonCallUsers.length > 0}
          <div class="mb-3">
            <label class="block text-[10px] text-slate-400 mb-1" for="call-directory-select">Select from Team Directory</label>
            <div class="flex items-center space-x-1.5">
              <select
                id="call-directory-select"
                bind:value={selectedExistingUserId}
                class="flex-1 h-7 bg-white/5 border border-white/10 rounded px-2 text-xs text-white outline-none focus:border-cyan-500"
              >
                <option value="">Choose participant...</option>
                {#each nonCallUsers as u}
                  <option value={u.id}>{u.name} ({u.role})</option>
                {/each}
              </select>
              <button
                class="px-2.5 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded font-semibold disabled:opacity-40"
                disabled={!selectedExistingUserId}
                on:click={addExistingParticipant}
              >
                Add
              </button>
            </div>
          </div>
        {/if}

        <div class="pt-2 border-t border-white/10">
          <label class="block text-[10px] text-slate-400 mb-1" for="call-guest-name">Or Invite by Name / Email</label>
          <div class="space-y-1.5">
            <input
              id="call-guest-name"
              type="text"
              bind:value={newGuestName}
              placeholder="Full name (e.g. David Ross)"
              class="w-full h-7 bg-white/5 border border-white/10 rounded px-2 text-xs text-white outline-none placeholder-slate-500 focus:border-cyan-500"
            />
            <input
              type="email"
              bind:value={newGuestEmail}
              aria-label="Email address (optional)"
              placeholder="Email address (optional)"
              class="w-full h-7 bg-white/5 border border-white/10 rounded px-2 text-xs text-white outline-none placeholder-slate-500 focus:border-cyan-500"
            />
            <button
              class="w-full py-1 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded transition-colors disabled:opacity-40"
              disabled={!newGuestName.trim()}
              on:click={addNewGuest}
            >
              Add to Meeting Call
            </button>
          </div>
        </div>
      </div>
    {/if}

    <!-- Call Control Bar -->
    <div class="h-16 px-6 bg-[#121315] border-t border-[#25282c] flex items-center justify-center space-x-4 shrink-0">
      
      <!-- Microphone Toggle -->
      <button
        type="button"
        class="flex flex-col items-center justify-center w-11 h-11 rounded-xl transition-all
          {isMuted ? 'bg-rose-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'}"
        on:click={() => (isMuted = !isMuted)}
        title={isMuted ? 'Unmute (demo control)' : 'Mute (demo control)'}
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
        title={isVideoOff ? 'Turn on camera (demo control)' : 'Turn off camera (demo control)'}
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
        title="Share screen (demo control, nothing is captured)"
      >
        <ScreenShare size={18} />
      </button>

      <!-- Invite button in toolbar -->
      <button
        type="button"
        class="flex flex-col items-center justify-center w-11 h-11 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-400 transition-all"
        on:click={() => (showInviteDialog = !showInviteDialog)}
        title="Invite / Add People"
      >
        <UserPlus size={18} />
      </button>

      <!-- End Call Button -->
      <button
        type="button"
        class="flex items-center space-x-2 px-5 h-11 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-lg transition-all"
        on:click={() => dispatch('close')}
        title="Closes this simulated call screen"
      >
        <PhoneOff size={18} />
        <span>Leave Demo Call</span>
      </button>

    </div>

  </div>
</div>
