<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import {
    X,
    Lock,
    Globe,
    Copy,
    Check,
    Download,
    Printer,
    FileText,
    Sheet,
    Presentation,
    CheckSquare,
    HardDrive,
    ShieldCheck,
    Share2,
    Users
  } from 'lucide-svelte';
  import type { WorkspaceMode, DocumentMeta } from '../../types';

  export let meta: DocumentMeta;
  export let activeMode: WorkspaceMode;

  const dispatch = createEventDispatcher<{
    close: void;
    exportFormat: string;
    printPdf: void;
  }>();

  let copied = false;
  let accessLevel: 'restricted' | 'anyone' = 'restricted';
  let shareEmailInput = '';
  let collaborators = [
    { name: 'Offline Workspace User (You)', email: 'offline.user@local.mac', role: 'Owner', avatarBg: 'bg-blue-600' },
    { name: 'Local Team Colleague', email: 'team.colleague@local.mac', role: 'Editor', avatarBg: 'bg-emerald-600' },
  ];

  function copyOfflineLink() {
    const offlineUrl = meta.filePath ? `file://${meta.filePath}` : `simpleoffice://${activeMode}/${meta.id}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(offlineUrl);
    }
    copied = true;
    setTimeout(() => (copied = false), 2500);
  }

  function addCollaborator() {
    if (!shareEmailInput.trim()) return;
    collaborators = [
      ...collaborators,
      {
        name: shareEmailInput.split('@')[0],
        email: shareEmailInput.trim(),
        role: 'Editor',
        avatarBg: 'bg-purple-600'
      }
    ];
    shareEmailInput = '';
  }

  function getAppInfo() {
    if (activeMode === 'sheets') return { label: 'Google Sheet', icon: Sheet, color: 'text-emerald-600', bg: 'bg-emerald-50' };
    if (activeMode === 'slides') return { label: 'Google Slides', icon: Presentation, color: 'text-amber-600', bg: 'bg-amber-50' };
    if (activeMode === 'forms') return { label: 'Google Form', icon: CheckSquare, color: 'text-purple-600', bg: 'bg-purple-50' };
    if (activeMode === 'drive') return { label: 'Google Drive', icon: HardDrive, color: 'text-blue-600', bg: 'bg-blue-50' };
    return { label: 'Google Doc', icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50' };
  }

  $: appInfo = getAppInfo();
</script>

<div class="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 select-none animate-in fade-in duration-150">
  <div class="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col animate-in zoom-in-95 duration-150 text-slate-800">
    <!-- Header -->
    <div class="px-6 pt-5 pb-3 flex items-center justify-between border-b border-slate-100">
      <div class="flex items-center space-x-2.5">
        <div class="w-8 h-8 rounded-lg {appInfo.bg} flex items-center justify-center {appInfo.color}">
          <svelte:component this={appInfo.icon} size={18} />
        </div>
        <div>
          <h2 class="text-base font-semibold text-slate-900 leading-tight">Share "{meta.title}"</h2>
          <span class="text-xs text-slate-500 font-medium">100% Offline Local Device Sharing</span>
        </div>
      </div>
      <button
        class="p-1.5 rounded-full hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors"
        on:click={() => dispatch('close')}
      >
        <X size={18} />
      </button>
    </div>

    <!-- Body -->
    <div class="p-6 space-y-5 text-xs">
      <!-- Add People Input -->
      <div>
        <label class="block font-medium text-slate-700 mb-1.5">Add local users, groups, or device peers</label>
        <div class="flex items-center space-x-2">
          <input
            type="text"
            bind:value={shareEmailInput}
            placeholder="Enter name, email, or local network ID..."
            on:keydown={(e) => e.key === 'Enter' && addCollaborator()}
            class="flex-1 bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-slate-900"
          />
          <button
            class="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors"
            on:click={addCollaborator}
          >
            Add
          </button>
        </div>
      </div>

      <!-- People with Access List -->
      <div>
        <span class="block font-semibold text-slate-700 mb-2">People with access</span>
        <div class="space-y-2 max-h-36 overflow-y-auto pr-1">
          {#each collaborators as c}
            <div class="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 border border-slate-100">
              <div class="flex items-center space-x-2.5">
                <div class="w-7 h-7 rounded-full {c.avatarBg} text-white font-semibold flex items-center justify-center text-xs">
                  {c.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <span class="font-medium text-slate-900 block">{c.name}</span>
                  <span class="text-[10px] text-slate-500">{c.email}</span>
                </div>
              </div>
              <span class="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[11px] font-medium">{c.role}</span>
            </div>
          {/each}
        </div>
      </div>

      <!-- General Access -->
      <div class="pt-2 border-t border-slate-100">
        <span class="block font-semibold text-slate-700 mb-2">General access</span>
        <div class="flex items-start space-x-3 p-3 rounded-xl bg-slate-50 border border-slate-200/80">
          <div class="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-700 shrink-0 mt-0.5">
            {#if accessLevel === 'restricted'}
              <Lock size={15} />
            {:else}
              <Globe size={15} class="text-blue-600" />
            {/if}
          </div>
          <div class="flex-1">
            <select
              bind:value={accessLevel}
              class="font-semibold text-slate-900 bg-transparent outline-none cursor-pointer"
            >
              <option value="restricted">Restricted (Only invited local users)</option>
              <option value="anyone">Anyone with the local file path</option>
            </select>
            <p class="text-[11px] text-slate-500 mt-0.5">
              {accessLevel === 'restricted'
                ? 'Only people added above can open and view this file on this Mac.'
                : 'Anyone on this machine or connected storage can open this document.'}
            </p>
          </div>
        </div>
      </div>

      <!-- Export & Download Quick Actions -->
      <div class="pt-2 border-t border-slate-100">
        <span class="block font-semibold text-slate-700 mb-2">Export / Offline Delivery</span>
        <div class="grid grid-cols-3 gap-2">
          {#if activeMode === 'writer'}
            <button
              class="flex items-center justify-center space-x-1.5 p-2 rounded-lg border border-slate-200 hover:bg-blue-50 hover:border-blue-300 text-slate-700 hover:text-blue-700 transition-all font-medium"
              on:click={() => { dispatch('exportFormat', 'docx'); dispatch('close'); }}
            >
              <Download size={13} />
              <span>Word (.docx)</span>
            </button>
          {:else if activeMode === 'sheets'}
            <button
              class="flex items-center justify-center space-x-1.5 p-2 rounded-lg border border-slate-200 hover:bg-emerald-50 hover:border-emerald-300 text-slate-700 hover:text-emerald-700 transition-all font-medium"
              on:click={() => { dispatch('exportFormat', 'xlsx'); dispatch('close'); }}
            >
              <Download size={13} />
              <span>Excel (.xlsx)</span>
            </button>
          {:else if activeMode === 'slides'}
            <button
              class="flex items-center justify-center space-x-1.5 p-2 rounded-lg border border-slate-200 hover:bg-amber-50 hover:border-amber-300 text-slate-700 hover:text-amber-700 transition-all font-medium"
              on:click={() => { dispatch('exportFormat', 'pptx'); dispatch('close'); }}
            >
              <Download size={13} />
              <span>PowerPoint</span>
            </button>
          {/if}
          <button
            class="flex items-center justify-center space-x-1.5 p-2 rounded-lg border border-slate-200 hover:bg-rose-50 hover:border-rose-300 text-slate-700 hover:text-rose-700 transition-all font-medium"
            on:click={() => { dispatch('printPdf'); dispatch('close'); }}
          >
            <Printer size={13} />
            <span>PDF Print</span>
          </button>
          <button
            class="flex items-center justify-center space-x-1.5 p-2 rounded-lg border border-slate-200 hover:bg-purple-50 hover:border-purple-300 text-slate-700 hover:text-purple-700 transition-all font-medium"
            on:click={() => { dispatch('exportFormat', 'json'); dispatch('close'); }}
          >
            <Download size={13} />
            <span>JSON Backup</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
      <button
        class="flex items-center space-x-1.5 px-3 py-1.5 rounded-full border border-slate-300 hover:bg-white text-blue-600 hover:text-blue-700 font-medium text-xs transition-colors shadow-2xs"
        on:click={copyOfflineLink}
      >
        {#if copied}
          <Check size={14} class="text-emerald-600" />
          <span class="text-emerald-700 font-semibold">Link Copied!</span>
        {:else}
          <Copy size={14} />
          <span>Copy link</span>
        {/if}
      </button>

      <button
        class="px-5 py-1.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs transition-colors shadow-xs"
        on:click={() => dispatch('close')}
      >
        Done
      </button>
    </div>
  </div>
</div>
