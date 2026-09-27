<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { FormSettings } from '../../types';
  import {
    Award,
    Mail,
    Sliders,
    MessageSquare,
    Check,
    X,
    HelpCircle,
    CheckSquare,
    Eye
  } from 'lucide-svelte';

  export let settings: FormSettings;
  export let isModal: boolean = false;

  const dispatch = createEventDispatcher<{
    change: void;
    close: void;
  }>();

  function handleToggle(key: keyof FormSettings) {
    if (typeof settings[key] === 'boolean') {
      (settings as any)[key] = !(settings as any)[key];
      dispatch('change');
    }
  }
</script>

<div class="{isModal ? 'fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150' : 'space-y-4 animate-in fade-in duration-150'}">
  <div class="{isModal ? 'bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden p-6 space-y-6 max-h-[90vh] overflow-y-auto' : 'space-y-4'}">
    {#if isModal}
      <div class="flex items-center justify-between border-b border-slate-100 pb-3">
        <div class="flex items-center space-x-2">
          <Sliders size={18} class="text-[#673AB7]" />
          <h2 class="text-base font-bold text-slate-800">Form Settings</h2>
        </div>
        <button
          type="button"
          class="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          on:click={() => dispatch('close')}
        >
          <X size={18} />
        </button>
      </div>
    {/if}

    <!-- SECTION 1: Make this a quiz -->
    <div class="bg-white rounded-xl shadow-xs border border-slate-200/80 p-5 space-y-4">
      <div class="flex items-center justify-between">
        <div class="space-y-0.5">
          <div class="flex items-center space-x-2">
            <Award size={16} class="text-[#673AB7]" />
            <span class="text-sm font-bold text-slate-800">Make this a quiz</span>
          </div>
          <p class="text-xs text-slate-400 max-w-md">
            Assign point values, set answer keys, and automatically calculate scores for multiple choice, checkbox, and dropdown questions.
          </p>
        </div>

        <button
          type="button"
          class="w-10 h-6 flex items-center rounded-full p-0.5 transition-colors shrink-0 {settings.isQuiz ? 'bg-[#673AB7]' : 'bg-slate-300'}"
          on:click={() => handleToggle('isQuiz')}
        >
          <div
            class="bg-white w-5 h-5 rounded-full shadow-xs transform transition-transform {settings.isQuiz ? 'translate-x-4' : 'translate-x-0'}"
          ></div>
        </button>
      </div>

      {#if settings.isQuiz}
        <div class="pt-3 border-t border-slate-100 space-y-3 animate-in fade-in duration-150">
          <div class="flex items-center justify-between text-xs">
            <div>
              <span class="font-semibold text-slate-700 block">Default question points</span>
              <span class="text-slate-400 text-[11px]">Points automatically assigned to new questions</span>
            </div>
            <div class="flex items-center space-x-1.5">
              <input
                type="number"
                min="0"
                max="100"
                bind:value={settings.defaultPoints}
                on:input={() => dispatch('change')}
                class="w-16 bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs text-center font-bold text-[#673AB7] focus:outline-none focus:border-[#673AB7]"
              />
              <span class="text-slate-400 text-xs">pts</span>
            </div>
          </div>
        </div>
      {/if}
    </div>

    <!-- SECTION 2: Responses Settings -->
    <div class="bg-white rounded-xl shadow-xs border border-slate-200/80 p-5 space-y-4">
      <div class="flex items-center space-x-2 text-sm font-bold text-slate-800 border-b border-slate-100 pb-2">
        <Mail size={16} class="text-[#673AB7]" />
        <span>Responses & Email Collection</span>
      </div>

      <div class="space-y-4 pt-1">
        <!-- Collect Email -->
        <div class="flex items-center justify-between text-xs">
          <div class="space-y-0.5">
            <span class="font-semibold text-slate-700 block">Collect email addresses</span>
            <span class="text-slate-400 text-[11px]">Responders are required to enter their email before submitting</span>
          </div>
          <button
            type="button"
            class="w-9 h-5 flex items-center rounded-full p-0.5 transition-colors shrink-0 {settings.collectEmail ? 'bg-[#673AB7]' : 'bg-slate-300'}"
            on:click={() => handleToggle('collectEmail')}
          >
            <div
              class="bg-white w-4 h-4 rounded-full shadow-xs transform transition-transform {settings.collectEmail ? 'translate-x-4' : 'translate-x-0'}"
            ></div>
          </button>
        </div>

        <!-- Limit to 1 response -->
        <div class="flex items-center justify-between text-xs">
          <div class="space-y-0.5">
            <span class="font-semibold text-slate-700 block">Limit to 1 response</span>
            <span class="text-slate-400 text-[11px]">Require responders to sign in / only submit one response</span>
          </div>
          <button
            type="button"
            class="w-9 h-5 flex items-center rounded-full p-0.5 transition-colors shrink-0 {settings.limitOneResponse ? 'bg-[#673AB7]' : 'bg-slate-300'}"
            on:click={() => handleToggle('limitOneResponse')}
          >
            <div
              class="bg-white w-4 h-4 rounded-full shadow-xs transform transition-transform {settings.limitOneResponse ? 'translate-x-4' : 'translate-x-0'}"
            ></div>
          </button>
        </div>

        <!-- Allow response edit -->
        <div class="flex items-center justify-between text-xs">
          <div class="space-y-0.5">
            <span class="font-semibold text-slate-700 block">Allow response editing</span>
            <span class="text-slate-400 text-[11px]">Responses can be changed after submission</span>
          </div>
          <button
            type="button"
            class="w-9 h-5 flex items-center rounded-full p-0.5 transition-colors shrink-0 {settings.allowResponseEdit ? 'bg-[#673AB7]' : 'bg-slate-300'}"
            on:click={() => handleToggle('allowResponseEdit')}
          >
            <div
              class="bg-white w-4 h-4 rounded-full shadow-xs transform transition-transform {settings.allowResponseEdit ? 'translate-x-4' : 'translate-x-0'}"
            ></div>
          </button>
        </div>
      </div>
    </div>

    <!-- SECTION 3: Presentation -->
    <div class="bg-white rounded-xl shadow-xs border border-slate-200/80 p-5 space-y-4">
      <div class="flex items-center space-x-2 text-sm font-bold text-slate-800 border-b border-slate-100 pb-2">
        <MessageSquare size={16} class="text-[#673AB7]" />
        <span>Presentation & Confirmation</span>
      </div>

      <div class="space-y-4 pt-1">
        <!-- Show Progress Bar -->
        <div class="flex items-center justify-between text-xs">
          <div class="space-y-0.5">
            <span class="font-semibold text-slate-700 block">Show progress bar</span>
            <span class="text-slate-400 text-[11px]">Display section progress indicator to respondents</span>
          </div>
          <button
            type="button"
            class="w-9 h-5 flex items-center rounded-full p-0.5 transition-colors shrink-0 {settings.showProgressBar ? 'bg-[#673AB7]' : 'bg-slate-300'}"
            on:click={() => handleToggle('showProgressBar')}
          >
            <div
              class="bg-white w-4 h-4 rounded-full shadow-xs transform transition-transform {settings.showProgressBar ? 'translate-x-4' : 'translate-x-0'}"
            ></div>
          </button>
        </div>

        <!-- Shuffle Question Order -->
        <div class="flex items-center justify-between text-xs">
          <div class="space-y-0.5">
            <span class="font-semibold text-slate-700 block">Shuffle question order</span>
            <span class="text-slate-400 text-[11px]">Randomize question presentation for quizzes and tests</span>
          </div>
          <button
            type="button"
            class="w-9 h-5 flex items-center rounded-full p-0.5 transition-colors shrink-0 {settings.shuffleQuestions ? 'bg-[#673AB7]' : 'bg-slate-300'}"
            on:click={() => handleToggle('shuffleQuestions')}
          >
            <div
              class="bg-white w-4 h-4 rounded-full shadow-xs transform transition-transform {settings.shuffleQuestions ? 'translate-x-4' : 'translate-x-0'}"
            ></div>
          </button>
        </div>

        <!-- Confirmation Message Customization -->
        <div class="space-y-1.5 pt-2 border-t border-slate-100">
          <label class="block text-xs font-semibold text-slate-700">Confirmation Message</label>
          <textarea
            bind:value={settings.confirmationMessage}
            on:input={() => dispatch('change')}
            rows="2"
            placeholder="Your response has been recorded."
            class="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-[#673AB7] transition-colors resize-y font-sans"
          ></textarea>
          <span class="text-[10px] text-slate-400 block">Shown to respondents immediately upon successful form submission.</span>
        </div>
      </div>
    </div>

    <!-- SECTION 4: Question Defaults -->
    <div class="bg-white rounded-xl shadow-xs border border-slate-200/80 p-5 space-y-3">
      <div class="flex items-center space-x-2 text-sm font-bold text-slate-800 border-b border-slate-100 pb-2">
        <CheckSquare size={16} class="text-[#673AB7]" />
        <span>Question Defaults</span>
      </div>

      <div class="flex items-center justify-between text-xs pt-1">
        <div class="space-y-0.5">
          <span class="font-semibold text-slate-700 block">Make questions required by default</span>
          <span class="text-slate-400 text-[11px]">Newly added questions will be set to required automatically</span>
        </div>
        <button
          type="button"
          class="w-9 h-5 flex items-center rounded-full p-0.5 transition-colors shrink-0 {settings.requireQuestionsByDefault ? 'bg-[#673AB7]' : 'bg-slate-300'}"
          on:click={() => handleToggle('requireQuestionsByDefault')}
        >
          <div
            class="bg-white w-4 h-4 rounded-full shadow-xs transform transition-transform {settings.requireQuestionsByDefault ? 'translate-x-4' : 'translate-x-0'}"
          ></div>
        </button>
      </div>
    </div>

    {#if isModal}
      <div class="flex justify-end pt-2">
        <button
          type="button"
          class="px-5 py-2 rounded-lg bg-[#673AB7] hover:bg-[#512DA8] text-white text-xs font-semibold shadow-xs transition-colors"
          on:click={() => dispatch('close')}
        >
          Close Settings
        </button>
      </div>
    {/if}
  </div>
</div>
