<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { DocumentVersion } from '../../types';
  import { sanitizeHtml } from '../../lib/sanitize';
  import { History, X, RotateCcw, Clock, Tag, Check } from '@lucide/svelte';

  export let isOpen: boolean = false;
  export let versions: DocumentVersion[] = [];
  export let currentContent: string = '';

  const dispatch = createEventDispatcher<{
    close: void;
    restore: { content: string };
    nameVersion: { name: string };
  }>();

  let selectedVersionId: string | null = null;
  let newVersionName: string = '';
  let showNameInput: boolean = false;

  // Version bodies are document HTML, so they are sanitized before rendering.
  // Unescaped here, a stored <script> in a snapshot would run with access to the
  // IPC bridge and anything held in webview storage.
  $: activePreview = sanitizeHtml(
    selectedVersionId
      ? versions.find((v) => v.id === selectedVersionId)?.content ?? currentContent
      : currentContent
  );

  function handleRestore(version: DocumentVersion) {
    if (confirm(`Restore version from ${new Date(version.timestamp).toLocaleString()}? Current unsaved edits will be replaced.`)) {
      dispatch('restore', { content: version.content });
      dispatch('close');
    }
  }

  function handleCreateNamedVersion() {
    if (!newVersionName.trim()) return;
    dispatch('nameVersion', { name: newVersionName.trim() });
    newVersionName = '';
    showNameInput = false;
  }
</script>

{#if isOpen}
  <div class="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      on:click|stopPropagation
    >
      <!-- Modal Header -->
      <div class="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
        <div class="flex items-center space-x-3">
          <div class="w-9 h-9 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold shadow-xs">
            <History size={18} />
          </div>
          <div>
            <h2 class="text-base font-bold text-slate-800">Version History</h2>
            <p class="text-xs text-slate-500">Inspect past document snapshots and restore previous revisions</p>
          </div>
        </div>

        <div class="flex items-center space-x-2">
          {#if !showNameInput}
            <button
              class="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-semibold transition-colors"
              on:click={() => (showNameInput = true)}
            >
              <Tag size={13} />
              <span>Name Current Version</span>
            </button>
          {:else}
            <div class="flex items-center space-x-1">
              <input
                type="text"
                placeholder="e.g. Pre-review Draft"
                bind:value={newVersionName}
                class="px-2.5 py-1 text-xs border border-slate-300 rounded-lg outline-none focus:border-blue-500 w-44"
                on:keydown={(e) => e.key === 'Enter' && handleCreateNamedVersion()}
              />
              <button
                class="p-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                on:click={handleCreateNamedVersion}
                title="Save named version"
              >
                <Check size={14} />
              </button>
              <button
                class="p-1.5 hover:bg-slate-200 text-slate-500 rounded-lg"
                on:click={() => (showNameInput = false)}
              >
                <X size={14} />
              </button>
            </div>
          {/if}

          <button
            class="p-1.5 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition-colors ml-2"
            on:click={() => dispatch('close')}
          >
            <X size={18} />
          </button>
        </div>
      </div>

      <!-- Main Layout: Version List on Left, Preview on Right -->
      <div class="flex-1 flex overflow-hidden">
        <!-- Sidebar Version List -->
        <div class="w-80 border-r border-slate-200 bg-slate-50/60 overflow-y-auto p-3 space-y-2">
          <div class="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-2 py-1">
            Timeline Snapshots ({versions.length + 1})
          </div>

          <!-- Current Live Version Item -->
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            class="p-3 rounded-xl border text-xs cursor-pointer transition-all {selectedVersionId === null
              ? 'bg-blue-50/80 border-blue-300 shadow-xs ring-1 ring-blue-400/30'
              : 'bg-white border-slate-200 hover:border-slate-300'}"
            on:click={() => (selectedVersionId = null)}
          >
            <div class="flex items-center justify-between font-semibold text-slate-800">
              <span class="flex items-center space-x-1.5">
                <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Current State (Live)</span>
              </span>
              <span class="text-[10px] text-emerald-700 font-mono bg-emerald-50 px-1.5 py-0.5 rounded">Active</span>
            </div>
            <div class="text-[11px] text-slate-500 mt-1 flex items-center space-x-1">
              <Clock size={11} />
              <span>Right Now</span>
            </div>
          </div>

          <!-- Past Revisions -->
          {#each versions as version (version.id)}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
              class="p-3 rounded-xl border text-xs cursor-pointer transition-all {selectedVersionId === version.id
                ? 'bg-blue-50/80 border-blue-300 shadow-xs ring-1 ring-blue-400/30'
                : 'bg-white border-slate-200 hover:border-slate-300'}"
              on:click={() => (selectedVersionId = version.id)}
            >
              <div class="flex items-center justify-between font-semibold text-slate-800">
                <span class="truncate">{version.name || 'Auto Snapshot'}</span>
                {#if selectedVersionId === version.id}
                  <button
                    class="flex items-center space-x-1 px-2 py-0.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-[10px] font-bold shadow-xs transition-colors"
                    on:click|stopPropagation={() => handleRestore(version)}
                    title="Restore this version"
                  >
                    <RotateCcw size={10} />
                    <span>Restore</span>
                  </button>
                {/if}
              </div>
              <div class="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
                <span class="flex items-center space-x-1">
                  <Clock size={11} />
                  <span>{new Date(version.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </span>
                <span class="text-[10px] text-slate-400">{version.authorName}</span>
              </div>
              <div class="text-[10px] text-slate-400 mt-0.5">
                {new Date(version.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
              </div>
            </div>
          {/each}
        </div>

        <!-- Preview Pane -->
        <div class="flex-1 bg-slate-100 flex flex-col overflow-hidden">
          <div class="px-5 py-2.5 bg-white border-b border-slate-200 flex items-center justify-between text-xs text-slate-600">
            <span class="font-medium">
              {selectedVersionId ? 'Viewing past snapshot' : 'Viewing current live version'}
            </span>
            {#if selectedVersionId}
              {@const selectedVer = versions.find((v) => v.id === selectedVersionId)}
              {#if selectedVer}
                <button
                  class="flex items-center space-x-1.5 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-xs shadow-xs transition-colors"
                  on:click={() => handleRestore(selectedVer)}
                >
                  <RotateCcw size={13} />
                  <span>Restore This Version</span>
                </button>
              {/if}
            {/if}
          </div>

          <div class="flex-1 overflow-y-auto p-8 flex justify-center">
            <div class="w-full max-w-2xl bg-white shadow-md rounded-lg p-10 min-h-[500px] border border-slate-200/80 prose prose-slate text-sm">
              <!-- Render Version Content -->
              {@html activePreview}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
{/if}
