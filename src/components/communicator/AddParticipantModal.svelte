<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { UserPlus, X, Check, Mail, User, Briefcase, } from '@lucide/svelte';
  import type { CommunicatorUser, UserPresence } from '../../types';

  export let isOpen: boolean = false;
  export let activeChannelName: string = '';
  export let isGroupChannel: boolean = false;

  const dispatch = createEventDispatcher<{
    close: void;
    addParticipant: { user: CommunicatorUser; startDm: boolean; addToChannel: boolean };
  }>();

  let name = '';
  let email = '';
  let role = 'Team Member';
  let presence: UserPresence = 'online';
  let statusMessage = '';
  let startDm = true;
  let addToChannel = isGroupChannel;

  $: if (isGroupChannel) {
    addToChannel = true;
  }

  function getInitials(fullName: string): string {
    if (!fullName) return 'U';
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function handleSubmit() {
    if (!name.trim() || !email.trim()) return;

    const id = `user_${Date.now()}`;
    const newUser: CommunicatorUser = {
      id,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      avatar: getInitials(name),
      role: role.trim() || 'Team Member',
      presence,
      statusMessage: statusMessage.trim() || 'Available for collaboration',
    };

    dispatch('addParticipant', { user: newUser, startDm, addToChannel });
    name = '';
    email = '';
    role = 'Team Member';
    statusMessage = '';
    dispatch('close');
  }
</script>

{#if isOpen}
  <div class="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div
      role="presentation"
      class="bg-[#1e2023] rounded-xl shadow-2xl border border-white/10 p-6 w-[440px] text-xs text-slate-300 animate-in fade-in zoom-in-95 duration-100 flex flex-col"
      on:click|stopPropagation
    >
      <!-- Modal Header -->
      <div class="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
        <div class="flex items-center space-x-2 font-bold text-white text-sm">
          <UserPlus size={16} class="text-cyan-400" />
          <span>Add Participant / Team Member</span>
        </div>
        <button
          class="p-1 rounded-full hover:bg-white/10 text-slate-400 hover:text-white"
          on:click={() => dispatch('close')}
        >
          <X size={15} />
        </button>
      </div>

      <form on:submit|preventDefault={handleSubmit} class="space-y-3.5">
        <!-- Full Name -->
        <div>
          <label class="block text-[11px] font-semibold text-slate-300 mb-1" for="add-participant-name">Full Name</label>
          <div class="flex items-center space-x-2 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 focus-within:border-cyan-500">
            <User size={13} class="text-slate-400" />
            <input
              id="add-participant-name"
              type="text"
              bind:value={name}
              placeholder="e.g. Jessica Taylor, Robert Vance"
              required
              class="bg-transparent flex-1 outline-none text-xs text-white placeholder-slate-500"
            />
          </div>
        </div>

        <!-- Email Address -->
        <div>
          <label class="block text-[11px] font-semibold text-slate-300 mb-1" for="add-participant-email">Email Address</label>
          <div class="flex items-center space-x-2 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 focus-within:border-cyan-500">
            <Mail size={13} class="text-slate-400" />
            <input
              id="add-participant-email"
              type="email"
              bind:value={email}
              placeholder="e.g. jessica.taylor@company.com"
              required
              class="bg-transparent flex-1 outline-none text-xs text-white placeholder-slate-500"
            />
          </div>
        </div>

        <!-- Role / Title -->
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="block text-[11px] font-semibold text-slate-300 mb-1" for="add-participant-role">Role / Department</label>
            <div class="flex items-center space-x-2 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 focus-within:border-cyan-500">
              <Briefcase size={13} class="text-slate-400" />
              <input
                id="add-participant-role"
                type="text"
                bind:value={role}
                placeholder="Product Manager"
                class="bg-transparent flex-1 outline-none text-xs text-white placeholder-slate-500"
              />
            </div>
          </div>
          <div>
            <label class="block text-[11px] font-semibold text-slate-300 mb-1" for="add-participant-presence">Initial Presence</label>
            <select
              id="add-participant-presence"
              bind:value={presence}
              class="w-full h-8 bg-white/5 border border-white/10 rounded-lg px-2 text-xs text-white outline-none focus:border-cyan-500"
            >
              <option value="online" class="bg-[#1e2023]">Available (Online)</option>
              <option value="busy" class="bg-[#1e2023]">Busy / In Meeting</option>
              <option value="away" class="bg-[#1e2023]">Away</option>
              <option value="offline" class="bg-[#1e2023]">Appear Offline</option>
            </select>
          </div>
        </div>

        <!-- Status Message -->
        <div>
          <label class="block text-[11px] font-semibold text-slate-300 mb-1" for="add-participant-status">Custom Status (Optional)</label>
          <input
            id="add-participant-status"
            type="text"
            bind:value={statusMessage}
            placeholder="e.g. Working on Q3 Roadmap"
            class="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 outline-none text-xs text-white placeholder-slate-500 focus:border-cyan-500"
          />
        </div>

        <!-- Quick Action Checkboxes -->
        <div class="pt-2 border-t border-white/10 space-y-2">
          <label class="flex items-center space-x-2 cursor-pointer text-slate-300 hover:text-white">
            <input type="checkbox" bind:checked={startDm} class="rounded text-cyan-600 focus:ring-cyan-500" />
            <span>Create 1:1 Direct Message chat with this participant</span>
          </label>
          {#if isGroupChannel}
            <label class="flex items-center space-x-2 cursor-pointer text-slate-300 hover:text-white">
              <input type="checkbox" bind:checked={addToChannel} class="rounded text-cyan-600 focus:ring-cyan-500" />
              <span>Add to current channel (#{activeChannelName})</span>
            </label>
          {/if}
        </div>

        <!-- Actions -->
        <div class="mt-5 pt-3 border-t border-white/10 flex items-center justify-end space-x-2">
          <button
            type="button"
            class="px-3 py-1.5 rounded-lg border border-white/10 hover:bg-white/5 text-slate-300 font-medium transition-colors"
            on:click={() => dispatch('close')}
          >
            Cancel
          </button>
          <button
            type="submit"
            class="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold shadow-sm transition-colors flex items-center space-x-1.5"
          >
            <Check size={14} />
            <span>Add Participant</span>
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}
