<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { Users, X, UserPlus, Trash2, Mail, ShieldCheck, Check } from 'lucide-svelte';
  import type { CommunicatorUser, ChatChannel } from '../../types';

  export let isOpen: boolean = false;
  export let channel: ChatChannel;
  export let allUsers: CommunicatorUser[] = [];

  const dispatch = createEventDispatcher<{
    close: void;
    addMember: string; // userId
    removeMember: string; // userId
    openInviteModal: void;
  }>();

  let selectedUserIdToAdd = '';

  // Get members of this channel
  $: channelMembers = (() => {
    if (channel.type === 'dm') {
      return channel.recipientUser ? [channel.recipientUser] : [];
    }
    if (channel.memberIds && channel.memberIds.length > 0) {
      return allUsers.filter(u => channel.memberIds?.includes(u.id));
    }
    // Default: all users are in public channels
    return allUsers;
  })();

  $: nonMembers = allUsers.filter(u => !channelMembers.some(m => m.id === u.id));

  function handleAddSelected() {
    if (!selectedUserIdToAdd) return;
    dispatch('addMember', selectedUserIdToAdd);
    selectedUserIdToAdd = '';
  }
</script>

{#if isOpen}
  <div class="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div
      class="bg-[#1e2023] rounded-xl shadow-2xl border border-white/10 p-6 w-[450px] text-xs text-slate-300 animate-in fade-in zoom-in-95 duration-100 flex flex-col max-h-[85vh]"
      on:click|stopPropagation
    >
      <!-- Header -->
      <div class="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
        <div class="flex items-center space-x-2 font-bold text-white text-sm">
          <Users size={16} class="text-cyan-400" />
          <span>{channel.type === 'channel' ? `#${channel.name}` : channel.name} Members</span>
          <span class="text-xs text-cyan-400 font-normal">({channelMembers.length})</span>
        </div>
        <button
          class="p-1 rounded-full hover:bg-white/10 text-slate-400 hover:text-white"
          on:click={() => dispatch('close')}
        >
          <X size={15} />
        </button>
      </div>

      <!-- Add Existing Member to Channel -->
      {#if channel.type === 'channel' && nonMembers.length > 0}
        <div class="mb-4 p-2.5 bg-white/5 border border-white/10 rounded-lg flex items-center space-x-2">
          <select
            bind:value={selectedUserIdToAdd}
            class="flex-1 h-8 bg-black/40 border border-white/10 rounded-md px-2 text-xs text-white outline-none focus:border-cyan-500"
          >
            <option value="">Select participant to add...</option>
            {#each nonMembers as u}
              <option value={u.id}>{u.name} ({u.email})</option>
            {/each}
          </select>
          <button
            class="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white font-medium rounded-md transition-colors flex items-center space-x-1 shrink-0"
            on:click={handleAddSelected}
            disabled={!selectedUserIdToAdd}
          >
            <UserPlus size={13} />
            <span>Add</span>
          </button>
        </div>
      {/if}

      <!-- Members list -->
      <div class="flex-1 overflow-y-auto space-y-1.5 pr-1">
        {#each channelMembers as member (member.id)}
          <div class="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/5 hover:border-white/10 transition-colors">
            <div class="flex items-center space-x-2.5">
              <div class="relative">
                <div class="w-8 h-8 rounded-full bg-cyan-600/30 border border-cyan-500/40 flex items-center justify-center text-xs font-bold text-cyan-200">
                  {member.avatar}
                </div>
                <!-- Presence dot -->
                <span
                  class="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#1e2023]
                    {member.presence === 'online' ? 'bg-emerald-500' : member.presence === 'busy' ? 'bg-rose-500' : member.presence === 'away' ? 'bg-amber-500' : 'bg-slate-500'}"
                ></span>
              </div>
              <div>
                <div class="flex items-center space-x-1.5">
                  <span class="font-bold text-white text-xs">{member.name}</span>
                  {#if member.isSelf}
                    <span class="text-[9px] px-1.5 py-0.2 bg-cyan-950 text-cyan-400 rounded border border-cyan-800 font-mono">You</span>
                  {/if}
                </div>
                <p class="text-[10px] text-slate-400">{member.role} • {member.email}</p>
                {#if member.statusMessage}
                  <p class="text-[10px] text-slate-500 italic mt-0.5">"{member.statusMessage}"</p>
                {/if}
              </div>
            </div>

            {#if channel.type === 'channel' && !member.isSelf}
              <button
                class="p-1.5 rounded hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 transition-colors"
                on:click={() => dispatch('removeMember', member.id)}
                title="Remove from channel"
              >
                <Trash2 size={13} />
              </button>
            {/if}
          </div>
        {/each}
      </div>

      <!-- Footer with Invite button -->
      <div class="mt-4 pt-3 border-t border-white/10 flex items-center justify-between">
        <button
          type="button"
          class="px-3 py-1.5 rounded-lg border border-cyan-500/30 bg-cyan-950/40 hover:bg-cyan-900/60 text-cyan-300 font-semibold transition-colors flex items-center space-x-1.5"
          on:click={() => {
            dispatch('close');
            dispatch('openInviteModal');
          }}
        >
          <UserPlus size={13} />
          <span>Invite New Person</span>
        </button>

        <button
          type="button"
          class="px-4 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium transition-colors"
          on:click={() => dispatch('close')}
        >
          Done
        </button>
      </div>
    </div>
  </div>
{/if}
