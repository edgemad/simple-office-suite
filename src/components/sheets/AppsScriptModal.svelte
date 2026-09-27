<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { X, Code2, Play, Save, Terminal, CheckCircle2 } from 'lucide-svelte';

  export let isOpen = false;

  const dispatch = createEventDispatcher<{
    close: void;
  }>();

  let scriptCode = `// Google Apps Script (Offline Runtime)
function onEdit(e) {
  // Custom spreadsheet automation
  console.log("Triggered on edit");
}

function calculateDiscount(price, rate) {
  return price * (1 - (rate || 0.10));
}
`;

  let logs: string[] = ['[Apps Script] Runtime initialized in offline sandbox.'];
  let isRunning = false;
  let successNotice = '';

  function handleRun() {
    isRunning = true;
    logs = [...logs, `> Running script at ${new Date().toLocaleTimeString()}...`];
    try {
      // Execute in sandbox function
      const fn = new Function('console', scriptCode);
      const customConsole = {
        log: (...args: any[]) => {
          logs = [...logs, `[LOG]: ${args.join(' ')}`];
        },
        warn: (...args: any[]) => {
          logs = [...logs, `[WARN]: ${args.join(' ')}`];
        },
        error: (...args: any[]) => {
          logs = [...logs, `[ERROR]: ${args.join(' ')}`];
        },
      };
      fn(customConsole);
      logs = [...logs, 'Execution completed successfully.'];
    } catch (err: any) {
      logs = [...logs, `Execution Error: ${err.message}`];
    } finally {
      isRunning = false;
    }
  }

  function handleSave() {
    successNotice = 'Script saved successfully!';
    setTimeout(() => (successNotice = ''), 3000);
  }
</script>

{#if isOpen}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-100 select-none text-slate-800"
    on:click={() => dispatch('close')}
  >
    <div
      class="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-100 flex flex-col max-h-[85vh]"
      on:click|stopPropagation
    >
      <!-- Header -->
      <div class="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
        <div class="flex items-center space-x-2">
          <div class="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
            <Code2 size={18} />
          </div>
          <div>
            <h3 class="font-semibold text-sm text-slate-900 leading-tight">Apps Script Editor</h3>
            <span class="text-[11px] text-slate-500">Spreadsheet automation & custom functions</span>
          </div>
        </div>
        <div class="flex items-center space-x-2">
          <button
            class="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-2xs transition-colors"
            on:click={handleRun}
            disabled={isRunning}
          >
            <Play size={13} />
            <span>Run</span>
          </button>
          <button
            class="flex items-center space-x-1 px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-medium transition-colors"
            on:click={handleSave}
          >
            <Save size={13} />
            <span>Save</span>
          </button>
          <button
            class="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 ml-2"
            on:click={() => dispatch('close')}
          >
            <X size={17} />
          </button>
        </div>
      </div>

      <!-- Notice -->
      {#if successNotice}
        <div class="px-5 py-2 bg-emerald-50 text-emerald-800 text-xs flex items-center space-x-1.5 border-b border-emerald-100">
          <CheckCircle2 size={14} class="text-emerald-600" />
          <span>{successNotice}</span>
        </div>
      {/if}

      <!-- Code Editor -->
      <div class="flex-1 flex flex-col p-4 space-y-3 overflow-hidden text-xs">
        <div class="flex-1 min-h-[220px] flex flex-col">
          <label for="script-editor" class="block font-semibold text-slate-700 mb-1">Code.gs</label>
          <textarea
            id="script-editor"
            bind:value={scriptCode}
            class="w-full flex-1 p-3 bg-slate-900 text-emerald-400 font-mono text-xs rounded-xl border border-slate-700 outline-none resize-none leading-relaxed shadow-inner"
            spellcheck="false"
          ></textarea>
        </div>

        <!-- Execution Log -->
        <div class="h-32 flex flex-col bg-slate-100 rounded-xl border border-slate-200 overflow-hidden">
          <div class="px-3 py-1.5 bg-slate-200/70 border-b border-slate-200 text-[11px] font-semibold text-slate-600 flex items-center space-x-1.5">
            <Terminal size={13} />
            <span>Execution Log</span>
          </div>
          <div class="flex-1 p-2 overflow-y-auto font-mono text-[11px] text-slate-700 space-y-0.5 select-text">
            {#each logs as log}
              <div>{log}</div>
            {/each}
          </div>
        </div>
      </div>
    </div>
  </div>
{/if}
