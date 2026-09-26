<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { AlertTriangle, Trash2, } from '@lucide/svelte';
  import type { ChatChannel } from '../../types';

  export let isOpen: boolean = false;
  export let channel: ChatChannel | null = null;
  export let messageCount: number = 0;

  const dispatch = createEventDispatcher<{
    close: void;
    confirmDelete: string; // channelId
  }>();

  function handleDelete() {
    if (!channel) return;
    dispatch('confirmDelete', channel.id);
    dispatch('close');
  }
</script>

{#if isOpen && channel}
  <div class="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div
      role="presentation"
      class="bg-[#1e2023] rounded-xl shadow-2xl border border-rose-500/30 p-6 w-[420px] text-xs text-slate-300 animate-in fade-in zoom-in-95 duration-100 flex flex-col"
      on:click|stopPropagation
    >
      <div class="flex items-start space-x-3 mb-4">
        <div class="w-10 h-10 rounded-full bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0">
          <AlertTriangle size={20} />
        </div>
        <div class="flex-1">
          <h3 class="text-sm font-bold text-white mb-1">
            Delete {channel.type === 'channel' ? `channel #${channel.name}` : `chat with ${channel.name}`}?
          </h3>
          <p class="text-slate-400 leading-relaxed text-[11px]">
            This action will permanently delete this conversation and purge its {messageCount} message{messageCount === 1 ? '' : 's'} and attachments from your local encrypted vault.
          </p>
          <div class="mt-2.5 p-2 rounded bg-rose-950/40 border border-rose-800/40 text-[10px] text-rose-300">
            <strong>Warning:</strong> Just like deleting in MS Teams, Zoom, or Google Meet, this cannot be undone.
          </div>
        </div>
      </div>

      <div class="mt-4 pt-3 border-t border-white/10 flex items-center justify-end space-x-2">
        <button
          type="button"
          class="px-3.5 py-1.5 rounded-lg border border-white/10 hover:bg-white/5 text-slate-300 font-medium transition-colors"
          on:click={() => dispatch('close')}
        >
          Cancel
        </button>
        <button
          type="button"
          class="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold shadow-sm transition-colors flex items-center space-x-1.5"
          on:click={handleDelete}
        >
          <Trash2 size={13} />
          <span>Delete Chat</span>
        </button>
      </div>
    </div>
  </div>
{/if}
