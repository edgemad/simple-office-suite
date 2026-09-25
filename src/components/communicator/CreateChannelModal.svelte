<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { Hash, Lock, X, Check, Users } from 'lucide-svelte';
  import type { CommunicatorUser, ChatChannel } from '../../types';

  export let isOpen: boolean = false;
  export let availableUsers: CommunicatorUser[] = [];

  const dispatch = createEventDispatcher<{
    close: void;
    createChannel: ChatChannel;
  }>();

  let name = '';
  let description = '';
  let isPrivate = false;
  let selectedUserIds: string[] = [];

  function sanitizeChannelName(val: string): string {
    return val.toLowerCase().replace(/[^a-z0-9-_]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  }

  function toggleUser(id: string) {
    if (selectedUserIds.includes(id)) {
      selectedUserIds = selectedUserIds.filter(u => u !== id);
    } else {
      selectedUserIds = [...selectedUserIds, id];
    }
  }

  function handleSubmit() {
    const cleanName = sanitizeChannelName(name);
    if (!cleanName) return;

    const id = `chan_${cleanName.replace(/-/g, '_')}_${Date.now()}`;
    const newChan: ChatChannel = {
      id,
      name: cleanName,
      description: description.trim() || 'Team collaboration channel',
      type: 'channel',
      unreadCount: 0,
      isPrivate,
      isEncrypted: true,
      memberIds: selectedUserIds,
      createdAt: 'Just now',
    };

    dispatch('createChannel', newChan);
    name = '';
    description = '';
    isPrivate = false;
    selectedUserIds = [];
    dispatch('close');
  }
</script>

{#if isOpen}
  <div class="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div
      class="bg-[#1e2023] rounded-xl shadow-2xl border border-white/10 p-6 w-[450px] text-xs text-slate-300 animate-in fade-in zoom-in-95 duration-100 flex flex-col"
      on:click|stopPropagation
    >
      <div class="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
        <div class="flex items-center space-x-2 font-bold text-white text-sm">
          <Hash size={16} class="text-cyan-400" />
          <span>Create New Channel</span>
        </div>
        <button
          class="p-1 rounded-full hover:bg-white/10 text-slate-400 hover:text-white"
          on:click={() => dispatch('close')}
        >
          <X size={15} />
        </button>
      </div>

      <form on:submit|preventDefault={handleSubmit} class="space-y-3.5">
        <!-- Channel Name -->
        <div>
          <label class="block text-[11px] font-semibold text-slate-300 mb-1">Channel Name</label>
          <div class="flex items-center space-x-1.5 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 focus-within:border-cyan-500">
            <span class="text-slate-500 font-bold">#</span>
            <input
              type="text"
              bind:value={name}
              placeholder="e.g. quarterly-goals, design-critique"
              required
              class="bg-transparent flex-1 outline-none text-xs text-white placeholder-slate-500 font-mono"
            />
          </div>
          {#if name}
            <span class="text-[10px] text-cyan-400 mt-1 block">Preview: #{sanitizeChannelName(name)}</span>
          {/if}
        </div>

        <!-- Description -->
        <div>
          <label class="block text-[11px] font-semibold text-slate-300 mb-1">Description (Optional)</label>
          <input
            type="text"
            bind:value={description}
            placeholder="What is this channel about?"
            class="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 outline-none text-xs text-white placeholder-slate-500 focus:border-cyan-500"
          />
        </div>

        <!-- Privacy Toggle -->
        <div>
          <label class="block text-[11px] font-semibold text-slate-300 mb-1">Privacy</label>
          <div class="grid grid-cols-2 gap-2">
            <button
              type="button"
              class="p-2.5 rounded-lg border text-left flex items-start space-x-2 transition-all
                {!isPrivate ? 'border-cyan-500 bg-cyan-950/40 text-white' : 'border-white/10 hover:bg-white/5 text-slate-400'}"
              on:click={() => (isPrivate = false)}
            >
              <Hash size={14} class="mt-0.5 text-cyan-400" />
              <div>
                <p class="font-bold text-xs">Public</p>
                <p class="text-[10px] opacity-75">Anyone in workspace can view and join</p>
              </div>
            </button>
            <button
              type="button"
              class="p-2.5 rounded-lg border text-left flex items-start space-x-2 transition-all
                {isPrivate ? 'border-cyan-500 bg-cyan-950/40 text-white' : 'border-white/10 hover:bg-white/5 text-slate-400'}"
              on:click={() => (isPrivate = true)}
            >
              <Lock size={14} class="mt-0.5 text-amber-400" />
              <div>
                <p class="font-bold text-xs">Private</p>
                <p class="text-[10px] opacity-75">Only invited members can view</p>
              </div>
            </button>
          </div>
        </div>

        <!-- Add Members to Channel -->
        <div>
          <label class="block text-[11px] font-semibold text-slate-300 mb-1.5">Add Members ({selectedUserIds.length} selected)</label>
          <div class="max-h-36 overflow-y-auto bg-white/5 border border-white/10 rounded-lg p-1.5 space-y-1">
            {#each availableUsers as user}
              <button
                type="button"
                class="w-full flex items-center justify-between p-1.5 rounded hover:bg-white/10 transition-colors cursor-pointer text-left
                  {selectedUserIds.includes(user.id) ? 'bg-cyan-950/30' : ''}"
                on:click={() => toggleUser(user.id)}
              >
                <div class="flex items-center space-x-2">
                  <div class="w-6 h-6 rounded-full bg-cyan-600/30 border border-cyan-500/40 flex items-center justify-center text-[10px] font-bold text-cyan-200">
                    {user.avatar}
                  </div>
                  <div>
                    <p class="font-semibold text-slate-200 leading-none">{user.name}</p>
                    <p class="text-[10px] text-slate-400 mt-0.5">{user.email}</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={selectedUserIds.includes(user.id)}
                  class="rounded text-cyan-600 focus:ring-cyan-500 pointer-events-none"
                />
              </button>
            {/each}
          </div>
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
            <span>Create Channel</span>
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}
