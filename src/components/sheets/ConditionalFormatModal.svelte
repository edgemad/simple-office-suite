<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { Sparkles, X, Plus, Trash2, Check } from 'lucide-svelte';
  import type { ConditionalFormatRule } from '../../types';

  export let isOpen: boolean = false;
  export let rules: ConditionalFormatRule[] = [];
  export let defaultRange: string = 'B2:B20';

  const dispatch = createEventDispatcher<{
    close: void;
    saveRules: ConditionalFormatRule[];
  }>();

  let tempRules: ConditionalFormatRule[] = [];

  $: if (isOpen) {
    tempRules = rules ? JSON.parse(JSON.stringify(rules)) : [];
  }

  function addRule() {
    tempRules = [
      ...tempRules,
      {
        id: `rule_${Date.now()}`,
        range: defaultRange,
        condition: 'greaterThan',
        value: '100',
        bgColor: '#dcfce7',
        textColor: '#15803d',
      },
    ];
  }

  function removeRule(id: string) {
    tempRules = tempRules.filter((r) => r.id !== id);
  }

  function handleSave() {
    dispatch('saveRules', tempRules);
    dispatch('close');
  }
</script>

{#if isOpen}
  <div class="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div
      class="bg-white rounded-xl shadow-2xl border border-slate-200 p-6 w-[480px] text-xs text-slate-700 animate-in fade-in zoom-in-95 duration-100 flex flex-col max-h-[85vh]"
      on:click|stopPropagation
    >
      <div class="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
        <div class="flex items-center space-x-2 font-bold text-slate-800 text-sm">
          <Sparkles size={16} class="text-emerald-600" />
          <span>Conditional Formatting Rules</span>
        </div>
        <button
          class="p-1 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600"
          on:click={() => dispatch('close')}
        >
          <X size={15} />
        </button>
      </div>

      <!-- Add Rule Button -->
      <div class="mb-3">
        <button
          type="button"
          class="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg text-emerald-800 font-semibold flex items-center space-x-1.5 transition-colors"
          on:click={addRule}
        >
          <Plus size={14} />
          <span>Add new rule</span>
        </button>
      </div>

      <!-- Rules list -->
      <div class="flex-1 overflow-y-auto space-y-3 pr-1">
        {#if tempRules.length === 0}
          <div class="p-6 text-center text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
            <p class="font-medium mb-1">No conditional formatting rules</p>
            <p class="text-[11px]">Click "Add new rule" to highlight cells based on thresholds or values.</p>
          </div>
        {:else}
          {#each tempRules as rule (rule.id)}
            <div class="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2.5">
              <div class="flex items-center justify-between">
                <span class="font-semibold text-slate-800">Rule: Format cells if...</span>
                <button
                  class="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                  on:click={() => removeRule(rule.id)}
                  title="Delete rule"
                >
                  <Trash2 size={13} />
                </button>
              </div>

              <div class="grid grid-cols-2 gap-2">
                <div>
                  <label class="block text-[10px] text-slate-500 mb-0.5">Apply to range</label>
                  <input
                    type="text"
                    bind:value={rule.range}
                    class="w-full h-7 px-2 bg-white border border-slate-300 rounded font-mono text-xs text-slate-800 outline-none uppercase"
                  />
                </div>
                <div>
                  <label class="block text-[10px] text-slate-500 mb-0.5">Condition</label>
                  <select
                    bind:value={rule.condition}
                    class="w-full h-7 px-1 bg-white border border-slate-300 rounded text-xs text-slate-800 outline-none"
                  >
                    <option value="greaterThan">Greater than</option>
                    <option value="lessThan">Less than</option>
                    <option value="equals">Is equal to</option>
                    <option value="contains">Text contains</option>
                    <option value="notEmpty">Is not empty</option>
                  </select>
                </div>
              </div>

              {#if rule.condition !== 'notEmpty'}
                <div>
                  <label class="block text-[10px] text-slate-500 mb-0.5">Threshold / Value</label>
                  <input
                    type="text"
                    bind:value={rule.value}
                    placeholder="Value or threshold"
                    class="w-full h-7 px-2 bg-white border border-slate-300 rounded text-xs text-slate-800 outline-none"
                  />
                </div>
              {/if}

              <!-- Color formatting styling -->
              <div class="flex items-center space-x-3 pt-1 border-t border-slate-200/60">
                <span class="text-[10px] font-medium text-slate-600">Style:</span>
                <label class="flex items-center space-x-1 cursor-pointer">
                  <span class="text-[10px] text-slate-500">Bg:</span>
                  <input type="color" bind:value={rule.bgColor} class="w-6 h-6 p-0 border-0 rounded cursor-pointer" />
                </label>
                <label class="flex items-center space-x-1 cursor-pointer">
                  <span class="text-[10px] text-slate-500">Text:</span>
                  <input type="color" bind:value={rule.textColor} class="w-6 h-6 p-0 border-0 rounded cursor-pointer" />
                </label>
                <div
                  class="ml-auto px-2 py-0.5 rounded text-[11px] font-semibold border"
                  style="background-color: {rule.bgColor}; color: {rule.textColor}; border-color: rgba(0,0,0,0.1);"
                >
                  Preview Cell
                </div>
              </div>
            </div>
          {/each}
        {/if}
      </div>

      <div class="mt-4 pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
        <button
          type="button"
          class="px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-600 font-medium transition-colors"
          on:click={() => dispatch('close')}
        >
          Cancel
        </button>
        <button
          type="button"
          class="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-sm transition-colors flex items-center space-x-1"
          on:click={handleSave}
        >
          <Check size={14} />
          <span>Apply Rules</span>
        </button>
      </div>
    </div>
  </div>
{/if}
