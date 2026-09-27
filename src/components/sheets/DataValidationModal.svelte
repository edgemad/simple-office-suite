<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { DataValidationRule, ValidationCriteria } from '../../types';
  import { CheckSquare, X, ListFilter, Trash2, Check } from 'lucide-svelte';

  export let isOpen: boolean = false;
  export let activeCell: string = 'A1';
  export let currentRule: DataValidationRule | undefined = undefined;

  const dispatch = createEventDispatcher<{
    close: void;
    save: { rule: DataValidationRule };
    remove: { range: string };
  }>();

  let range = activeCell;
  let criteria: ValidationCriteria = 'list';
  let listItemsStr = 'Active, In Progress, Review, Completed';
  let numberOperator: 'between' | 'greaterThan' | 'lessThan' | 'equals' = 'greaterThan';
  let minNum: number = 0;
  let maxNum: number = 100;
  let allowInvalid = true;

  $: if (isOpen) {
    if (currentRule) {
      range = currentRule.range;
      criteria = currentRule.criteria;
      allowInvalid = currentRule.allowInvalid;
      if (currentRule.options) listItemsStr = currentRule.options.join(', ');
      if (currentRule.min !== undefined) minNum = currentRule.min;
      if (currentRule.max !== undefined) maxNum = currentRule.max;
      if (currentRule.operator) numberOperator = currentRule.operator;
    } else {
      range = activeCell;
    }
  }

  function handleSave() {
    const rule: DataValidationRule = {
      id: currentRule?.id || `val_${Date.now()}`,
      range: range.trim().toUpperCase() || activeCell,
      criteria,
      allowInvalid,
      options: criteria === 'list' ? listItemsStr.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
      operator: criteria === 'number' ? numberOperator : undefined,
      min: criteria === 'number' ? minNum : undefined,
      max: criteria === 'number' && numberOperator === 'between' ? maxNum : undefined,
    };
    dispatch('save', { rule });
    dispatch('close');
  }

  function handleRemove() {
    dispatch('remove', { range });
    dispatch('close');
  }
</script>

{#if isOpen}
  <div class="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 w-full max-w-md text-xs text-slate-700 animate-in fade-in zoom-in-95 duration-100"
      on:click|stopPropagation
    >
      <div class="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
        <div class="flex items-center space-x-2">
          <CheckSquare size={16} class="text-emerald-600" />
          <h3 class="font-bold text-sm text-slate-800">Data Validation Rules</h3>
        </div>
        <button
          class="p-1 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700"
          on:click={() => dispatch('close')}
        >
          <X size={16} />
        </button>
      </div>

      <div class="space-y-4">
        <!-- Target Range -->
        <div>
          <label class="block font-semibold text-slate-700 mb-1">Cell Range</label>
          <input
            type="text"
            bind:value={range}
            placeholder="e.g. B2:B20 or C5"
            class="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs outline-none focus:border-emerald-500 font-mono"
          />
        </div>

        <!-- Criteria Type Selector -->
        <div>
          <label class="block font-semibold text-slate-700 mb-1">Validation Criteria</label>
          <select
            bind:value={criteria}
            class="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs outline-none bg-white font-medium"
          >
            <option value="list">Dropdown List of Items</option>
            <option value="checkbox">Checkbox (Interactive Checkbox Cell)</option>
            <option value="number">Number Limits</option>
            <option value="date">Valid Date</option>
            <option value="text">Valid Text (Non-empty)</option>
          </select>
        </div>

        <!-- Criteria Specific Inputs -->
        {#if criteria === 'list'}
          <div class="p-3 bg-emerald-50/50 rounded-xl border border-emerald-100 space-y-1.5">
            <label class="block font-semibold text-emerald-900">List items (comma-separated)</label>
            <textarea
              bind:value={listItemsStr}
              rows="3"
              placeholder="e.g. Yes, No, Maybe, N/A"
              class="w-full p-2 border border-slate-300 rounded-lg text-xs outline-none bg-white"
            ></textarea>
            <p class="text-[10px] text-slate-500">Each item will appear as a clickable dropdown option in the selected cell(s).</p>
          </div>
        {:else if criteria === 'number'}
          <div class="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <div>
              <label class="block font-semibold text-slate-700 mb-1">Condition</label>
              <select
                bind:value={numberOperator}
                class="w-full px-2.5 py-1 border border-slate-300 rounded-lg text-xs outline-none bg-white"
              >
                <option value="greaterThan">Greater than</option>
                <option value="lessThan">Less than</option>
                <option value="between">Between</option>
                <option value="equals">Equal to</option>
              </select>
            </div>
            <div class="flex items-center space-x-2">
              <input
                type="number"
                bind:value={minNum}
                class="w-full px-2.5 py-1 border border-slate-300 rounded-lg text-xs outline-none"
                placeholder="Value"
              />
              {#if numberOperator === 'between'}
                <span class="text-slate-400">and</span>
                <input
                  type="number"
                  bind:value={maxNum}
                  class="w-full px-2.5 py-1 border border-slate-300 rounded-lg text-xs outline-none"
                  placeholder="Max Value"
                />
              {/if}
            </div>
          </div>
        {:else if criteria === 'checkbox'}
          <div class="p-3 bg-blue-50/60 rounded-xl border border-blue-100 text-slate-700 text-[11px]">
            Displays an interactive checkbox in cell(s). Toggling will set cell value to <strong>TRUE</strong> or <strong>FALSE</strong>.
          </div>
        {/if}

        <!-- On Invalid Data -->
        <div class="pt-2 border-t border-slate-100">
          <label class="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              bind:checked={allowInvalid}
              class="w-4 h-4 accent-emerald-600 rounded"
            />
            <span class="text-xs text-slate-700">Show validation warning instead of blocking entry</span>
          </label>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="pt-4 border-t border-slate-100 mt-4 flex items-center justify-between">
        {#if currentRule}
          <button
            class="flex items-center space-x-1 text-xs text-rose-600 hover:text-rose-700 font-semibold"
            on:click={handleRemove}
          >
            <Trash2 size={13} />
            <span>Remove Rule</span>
          </button>
        {:else}
          <div></div>
        {/if}

        <div class="flex items-center space-x-2">
          <button
            class="px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-medium"
            on:click={() => dispatch('close')}
          >
            Cancel
          </button>
          <button
            class="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs"
            on:click={handleSave}
          >
            Save Rule
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}
