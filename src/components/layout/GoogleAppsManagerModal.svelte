<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import {
    X,
    FileText,
    Sheet,
    Presentation,
    CheckSquare,
    HardDrive,
    FileCheck,
    PenTool,
    StickyNote,
    Check,
    Sliders,
    Sparkles,
    ShieldCheck
  } from 'lucide-svelte';
  import type { WorkspaceMode } from '../../types';

  interface GoogleAppConfig {
    id: WorkspaceMode | 'keep' | 'drawings';
    name: string;
    description: string;
    icon: any;
    color: string;
    bgColor: string;
    enabled: boolean;
    isCore: boolean;
  }

  export let enabledAppIds: string[] = ['drive', 'writer', 'sheets', 'slides', 'forms', 'pdf'];
  export let defaultAppId: string = 'writer';

  const dispatch = createEventDispatcher<{
    close: void;
    save: { enabledAppIds: string[]; defaultAppId: string };
  }>();

  let apps: GoogleAppConfig[] = [
    {
      id: 'writer',
      name: 'Google Docs',
      description: 'Document processor with rich typography, outlines, tables, comments, and Word (.docx) export.',
      icon: FileText,
      color: 'text-blue-600',
      bgColor: 'bg-blue-600',
      enabled: enabledAppIds.includes('writer'),
      isCore: true
    },
    {
      id: 'sheets',
      name: 'Google Sheets',
      description: 'Spreadsheet engine with 80+ Google functions, formula range pointing, dynamic array spilling, charts, and Excel (.xlsx) export.',
      icon: Sheet,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-600',
      enabled: enabledAppIds.includes('sheets'),
      isCore: true
    },
    {
      id: 'slides',
      name: 'Google Slides',
      description: 'Presentation deck creator with 16:9 canvas, alignment guides, layouts, themes, transitions, and Presenter Mode.',
      icon: Presentation,
      color: 'text-amber-500',
      bgColor: 'bg-amber-500',
      enabled: enabledAppIds.includes('slides'),
      isCore: true
    },
    {
      id: 'forms',
      name: 'Google Forms',
      description: 'Interactive survey and self-grading quiz builder with live preview, analytics charts, and Link-to-Sheets export.',
      icon: CheckSquare,
      color: 'text-purple-600',
      bgColor: 'bg-purple-600',
      enabled: enabledAppIds.includes('forms'),
      isCore: false
    },
    {
      id: 'drive',
      name: 'Google Drive',
      description: 'Unified file hub for organizing all offline documents, search chips, folder hierarchies, and cloud sync.',
      icon: HardDrive,
      color: 'text-blue-600',
      bgColor: 'bg-blue-600',
      enabled: enabledAppIds.includes('drive'),
      isCore: true
    },
    {
      id: 'pdf',
      name: 'Google PDF Viewer',
      description: 'High-fidelity PDF document reader with interactive form field filling, digital signatures, and vector printing.',
      icon: FileCheck,
      color: 'text-rose-600',
      bgColor: 'bg-rose-600',
      enabled: enabledAppIds.includes('pdf'),
      isCore: false
    }
  ];

  function toggleApp(app: GoogleAppConfig) {
    app.enabled = !app.enabled;
    apps = [...apps];
  }

  function handleSave() {
    const selected = apps.filter((a) => a.enabled).map((a) => a.id);
    if (selected.length === 0) {
      alert('You must keep at least one Google Office Suite app enabled.');
      return;
    }
    dispatch('save', {
      enabledAppIds: selected,
      defaultAppId
    });
    dispatch('close');
  }
</script>

<div class="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 select-none animate-in fade-in duration-150">
  <div class="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-150 text-slate-800">
    <!-- Header -->
    <div class="px-6 pt-5 pb-3 flex items-center justify-between border-b border-slate-100">
      <div class="flex items-center space-x-2.5">
        <div class="w-9 h-9 rounded-2xl bg-gradient-to-tr from-blue-600 via-emerald-600 to-amber-500 flex items-center justify-center text-white shadow-xs">
          <Sliders size={18} />
        </div>
        <div>
          <h2 class="text-base font-semibold text-slate-900 leading-tight">Customize Google Workspace Suite</h2>
          <span class="text-xs text-slate-500 font-medium">Add or remove Google Office apps by choice</span>
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
    <div class="p-6 space-y-4 text-xs max-h-[70vh] overflow-y-auto">
      <p class="text-slate-600 text-xs leading-relaxed">
        Customize your suite to include only the tools you need—from a lightweight, stripped-down Docs & Sheets editor to the full Google Office Suite with Slides, Forms, Drive, and PDF.
      </p>

      <div class="space-y-2.5 pt-1">
        {#each apps as app}
          <div class="flex items-center justify-between p-3.5 rounded-2xl border transition-all {app.enabled ? 'bg-slate-50/80 border-slate-200' : 'bg-slate-100/40 border-slate-200/60 opacity-60'}">
            <div class="flex items-start space-x-3.5 pr-2">
              <div class="w-9 h-9 rounded-xl {app.bgColor} text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                <svelte:component this={app.icon} size={18} />
              </div>
              <div>
                <div class="flex items-center space-x-2">
                  <span class="font-semibold text-slate-900 text-sm">{app.name}</span>
                  {#if defaultAppId === app.id}
                    <span class="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold">DEFAULT</span>
                  {/if}
                </div>
                <p class="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{app.description}</p>
              </div>
            </div>

            <div class="flex items-center space-x-3 shrink-0">
              <button
                type="button"
                class="w-11 h-6 flex items-center rounded-full p-1 transition-colors {app.enabled ? 'bg-blue-600' : 'bg-slate-300'}"
                on:click={() => toggleApp(app)}
                title={app.enabled ? 'Disable app' : 'Enable app'}
              >
                <div class="bg-white w-4 h-4 rounded-full shadow-md transform transition-transform {app.enabled ? 'translate-x-5' : 'translate-x-0'}"></div>
              </button>
            </div>
          </div>
        {/each}
      </div>

      <!-- Default App Selector -->
      <div class="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between mt-4">
        <div>
          <span class="font-semibold text-slate-900 block">Default Application on Startup</span>
          <span class="text-[11px] text-slate-500">The editor that opens immediately when you launch the app.</span>
        </div>
        <select
          bind:value={defaultAppId}
          class="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-800 outline-none focus:border-blue-500 font-medium"
        >
          {#each apps.filter(a => a.enabled) as app}
            <option value={app.id}>{app.name}</option>
          {/each}
        </select>
      </div>
    </div>

    <!-- Footer -->
    <div class="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
      <span class="text-[11px] text-slate-400">Settings persist to local offline storage</span>
      <div class="flex items-center space-x-2">
        <button
          class="px-4 py-1.5 rounded-full text-slate-600 hover:bg-slate-200 font-medium text-xs transition-colors"
          on:click={() => dispatch('close')}
        >
          Cancel
        </button>
        <button
          class="px-5 py-1.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs transition-colors shadow-xs"
          on:click={handleSave}
        >
          Save Changes
        </button>
      </div>
    </div>
  </div>
</div>
