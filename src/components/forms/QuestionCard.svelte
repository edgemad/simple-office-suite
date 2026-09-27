<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { FormQuestion, FormOption, QuestionType } from '../../types';
  import {
    AlignLeft,
    CheckSquare,
    CircleDot,
    List,
    Sliders,
    Calendar,
    Clock,
    Plus,
    X,
    Trash2,
    Copy,
    GripVertical,
    ChevronUp,
    ChevronDown,
    MoreVertical,
    KeyRound,
    Image,
    Check,
    CheckCircle2,
    FileText
  } from 'lucide-svelte';

  export let question: FormQuestion;
  export let isActive: boolean = false;
  export let index: number = 0;
  export let totalQuestions: number = 1;
  export let isQuiz: boolean = false;
  export let themeColor: string = '#673AB7';

  const dispatch = createEventDispatcher<{
    select: string;
    change: void;
    duplicate: string;
    delete: string;
    moveUp: string;
    moveDown: string;
  }>();

  let showTypeDropdown = false;
  let showMoreMenu = false;
  let showAnswerKey = false;
  let isEditingDescription = Boolean(question.description);
  $: currentTypeInfo = getQuestionTypeInfo(question.type);

  const questionTypes: { type: QuestionType; label: string; icon: any }[] = [
    { type: 'short_answer', label: 'Short answer', icon: AlignLeft },
    { type: 'paragraph', label: 'Paragraph', icon: FileText },
    { type: 'multiple_choice', label: 'Multiple choice', icon: CircleDot },
    { type: 'checkboxes', label: 'Checkboxes', icon: CheckSquare },
    { type: 'dropdown', label: 'Dropdown', icon: List },
    { type: 'linear_scale', label: 'Linear scale', icon: Sliders },
    { type: 'date', label: 'Date', icon: Calendar },
    { type: 'time', label: 'Time', icon: Clock },
  ];

  function getQuestionTypeInfo(type: QuestionType) {
    return questionTypes.find((t) => t.type === type) || questionTypes[2];
  }

  function handleSelect() {
    if (!isActive) {
      dispatch('select', question.id);
    }
  }

  function handleTypeChange(newType: QuestionType) {
    question.type = newType;
    showTypeDropdown = false;

    // Initialize defaults if needed
    if (['multiple_choice', 'checkboxes', 'dropdown'].includes(newType)) {
      if (!question.options || question.options.length === 0) {
        question.options = [
          { id: 'opt_' + Math.random().toString(36).substr(2, 6), text: 'Option 1' }
        ];
      }
    } else if (newType === 'linear_scale') {
      question.scaleMin = question.scaleMin ?? 1;
      question.scaleMax = question.scaleMax ?? 5;
      question.scaleMinLabel = question.scaleMinLabel ?? '';
      question.scaleMaxLabel = question.scaleMaxLabel ?? '';
    }

    dispatch('change');
  }

  function addOption() {
    if (!question.options) question.options = [];
    const count = question.options.filter((o) => !o.isOther).length + 1;
    const newOpt: FormOption = {
      id: 'opt_' + Math.random().toString(36).substr(2, 6),
      text: `Option ${count}`,
    };
    
    // Insert before "Other" if other exists
    const otherIdx = question.options.findIndex((o) => o.isOther);
    if (otherIdx !== -1) {
      question.options.splice(otherIdx, 0, newOpt);
      question.options = [...question.options];
    } else {
      question.options = [...question.options, newOpt];
    }
    dispatch('change');
  }

  function addOtherOption() {
    if (!question.options) question.options = [];
    const hasOther = question.options.some((o) => o.isOther);
    if (!hasOther) {
      question.options = [
        ...question.options,
        {
          id: 'opt_other_' + Math.random().toString(36).substr(2, 6),
          text: 'Other...',
          isOther: true,
        },
      ];
      dispatch('change');
    }
  }

  function removeOption(optId: string) {
    if (!question.options) return;
    question.options = question.options.filter((o) => o.id !== optId);
    dispatch('change');
  }

  function toggleCorrectAnswer(optionText: string) {
    if (!question.correctAnswers) question.correctAnswers = [];
    if (question.type === 'multiple_choice' || question.type === 'dropdown') {
      // Single choice
      if (question.correctAnswers.includes(optionText)) {
        question.correctAnswers = [];
      } else {
        question.correctAnswers = [optionText];
      }
    } else {
      // Checkboxes (multiple)
      if (question.correctAnswers.includes(optionText)) {
        question.correctAnswers = question.correctAnswers.filter((a) => a !== optionText);
      } else {
        question.correctAnswers = [...question.correctAnswers, optionText];
      }
    }
    dispatch('change');
  }

  function isCorrect(optionText: string): boolean {
    return Boolean(question.correctAnswers?.includes(optionText));
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="relative bg-white rounded-xl transition-all duration-200 border {isActive
    ? 'shadow-lg border-slate-300 ring-1 ring-purple-100'
    : 'shadow-xs border-slate-200/80 hover:shadow-md'}"
  style={isActive ? `border-left: 6px solid ${themeColor};` : ''}
  on:click={handleSelect}
>
  <!-- Card Content -->
  <div class="p-6">
    <!-- Top Row: Drag Handle & Reorder controls -->
    <div class="flex items-center justify-between -mt-2 mb-3 text-slate-400">
      <div class="flex items-center space-x-1 cursor-grab active:cursor-grabbing hover:text-slate-600">
        <GripVertical size={16} />
        <span class="text-[11px] font-medium text-slate-400 font-mono">Question {index + 1}</span>
      </div>

      <div class="flex items-center space-x-1">
        <button
          type="button"
          disabled={index === 0}
          class="p-1 rounded hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent text-slate-500 transition-colors"
          on:click|stopPropagation={() => dispatch('moveUp', question.id)}
          title="Move question up"
        >
          <ChevronUp size={15} />
        </button>
        <button
          type="button"
          disabled={index === totalQuestions - 1}
          class="p-1 rounded hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent text-slate-500 transition-colors"
          on:click|stopPropagation={() => dispatch('moveDown', question.id)}
          title="Move question down"
        >
          <ChevronDown size={15} />
        </button>
      </div>
    </div>

    {#if isActive}
      <!-- ACTIVE EDITOR STATE -->
      <div class="space-y-4">
        <!-- Question Title & Type Switcher Row -->
        <div class="grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
          <!-- Question Title Input -->
          <div class="md:col-span-8 relative">
            <input
              type="text"
              bind:value={question.title}
              on:input={() => dispatch('change')}
              placeholder="Question"
              class="w-full bg-[#f8f9fa] hover:bg-[#f1f3f4] focus:bg-white text-slate-800 font-medium text-base px-3.5 py-3 rounded-t-md border-b-2 border-slate-300 focus:border-[#673AB7] focus:outline-none transition-all placeholder:text-slate-400"
            />
          </div>

          <!-- Question Type Switcher Dropdown -->
          <div class="md:col-span-4 relative">
            <button
              type="button"
              class="w-full bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-medium text-xs px-3 py-2.5 rounded-lg flex items-center justify-between shadow-2xs transition-colors"
              on:click|stopPropagation={() => (showTypeDropdown = !showTypeDropdown)}
            >
              <div class="flex items-center space-x-2 truncate">
                <svelte:component this={currentTypeInfo.icon} size={16} class="text-[#673AB7] shrink-0" />
                <span class="truncate">{currentTypeInfo.label}</span>
              </div>
              <ChevronDown size={14} class="text-slate-400 shrink-0 ml-1" />
            </button>

            {#if showTypeDropdown}
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <div
                class="absolute right-0 top-full mt-1 w-56 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-40 text-xs text-slate-700 animate-in fade-in zoom-in-95 duration-100"
                on:click|stopPropagation
              >
                {#each questionTypes as qt}
                  <button
                    type="button"
                    class="w-full px-3 py-2 text-left hover:bg-purple-50 hover:text-[#673AB7] flex items-center space-x-2.5 transition-colors {question.type === qt.type ? 'bg-purple-50 font-semibold text-[#673AB7]' : ''}"
                    on:click={() => handleTypeChange(qt.type)}
                  >
                    <svelte:component this={qt.icon} size={15} class={question.type === qt.type ? 'text-[#673AB7]' : 'text-slate-400'} />
                    <span>{qt.label}</span>
                  </button>
                {/each}
              </div>
            {/if}
          </div>
        </div>

        <!-- Optional Question Description -->
        {#if isEditingDescription || question.description}
          <div class="relative">
            <input
              type="text"
              bind:value={question.description}
              on:input={() => dispatch('change')}
              placeholder="Description (optional guidance for respondent)"
              class="w-full bg-transparent text-slate-600 text-xs px-2 py-1 border-b border-dashed border-slate-300 focus:border-[#673AB7] focus:outline-none placeholder:text-slate-400 transition-colors"
            />
          </div>
        {/if}

        <!-- QUESTION BODY BY TYPE -->
        <div class="pt-2">
          <!-- Short Answer -->
          {#if question.type === 'short_answer'}
            <div class="max-w-md pt-2">
              <input
                type="text"
                disabled
                placeholder="Short answer text"
                class="w-full border-b border-dotted border-slate-300 text-slate-400 text-xs py-2 bg-transparent cursor-not-allowed"
              />
            </div>

          <!-- Paragraph -->
          {:else if question.type === 'paragraph'}
            <div class="max-w-lg pt-2">
              <textarea
                disabled
                rows="2"
                placeholder="Long answer text"
                class="w-full border-b border-dotted border-slate-300 text-slate-400 text-xs py-2 bg-transparent resize-none cursor-not-allowed"
              ></textarea>
            </div>

          <!-- Multiple Choice, Checkboxes, Dropdown -->
          {:else if question.type === 'multiple_choice' || question.type === 'checkboxes' || question.type === 'dropdown'}
            <div class="space-y-2.5">
              {#each question.options as option, optIdx (option.id)}
                <div class="flex items-center space-x-3 group">
                  <!-- Indicator Icon -->
                  {#if question.type === 'multiple_choice'}
                    <div class="w-4 h-4 rounded-full border-2 border-slate-300 shrink-0 group-hover:border-purple-400 transition-colors"></div>
                  {:else if question.type === 'checkboxes'}
                    <div class="w-4 h-4 rounded-xs border-2 border-slate-300 shrink-0 group-hover:border-purple-400 transition-colors"></div>
                  {:else}
                    <span class="text-xs text-slate-400 w-4 text-center font-mono">{optIdx + 1}.</span>
                  {/if}

                  <!-- Option Text Input -->
                  {#if option.isOther}
                    <div class="flex-1 flex items-center space-x-2 text-xs text-slate-500 py-1">
                      <span>Other...</span>
                      <span class="text-slate-300">|</span>
                      <span class="text-[11px] text-slate-400 italic">User will be prompted for custom input</span>
                    </div>
                  {:else}
                    <input
                      type="text"
                      bind:value={option.text}
                      on:input={() => dispatch('change')}
                      placeholder={`Option ${optIdx + 1}`}
                      class="flex-1 bg-transparent text-xs text-slate-700 py-1 border-b border-transparent hover:border-slate-200 focus:border-[#673AB7] focus:outline-none transition-colors"
                    />
                  {/if}

                  <!-- Remove Option Button -->
                  {#if question.options.length > 1}
                    <button
                      type="button"
                      class="p-1 text-slate-400 hover:text-rose-500 rounded transition-colors opacity-0 group-hover:opacity-100"
                      on:click|stopPropagation={() => removeOption(option.id)}
                      title="Remove option"
                    >
                      <X size={14} />
                    </button>
                  {/if}
                </div>
              {/each}

              <!-- Add Option & Add Other Buttons -->
              <div class="flex items-center space-x-3 pt-2 text-xs">
                {#if question.type === 'multiple_choice'}
                  <div class="w-4 h-4 rounded-full border-2 border-slate-300 opacity-40 shrink-0"></div>
                {:else if question.type === 'checkboxes'}
                  <div class="w-4 h-4 rounded-xs border-2 border-slate-300 opacity-40 shrink-0"></div>
                {:else}
                  <span class="text-xs text-slate-400 w-4 text-center font-mono opacity-40">{question.options.length + 1}.</span>
                {/if}

                <div class="flex items-center space-x-2">
                  <button
                    type="button"
                    class="text-slate-500 hover:text-[#673AB7] font-medium transition-colors hover:underline"
                    on:click|stopPropagation={addOption}
                  >
                    Add option
                  </button>

                  {#if !question.options.some((o) => o.isOther) && (question.type === 'multiple_choice' || question.type === 'checkboxes')}
                    <span class="text-slate-300">or</span>
                    <button
                      type="button"
                      class="text-blue-600 hover:text-blue-700 font-medium transition-colors hover:underline"
                      on:click|stopPropagation={addOtherOption}
                    >
                      add "Other"
                    </button>
                  {/if}
                </div>
              </div>
            </div>

          <!-- Linear Scale -->
          {:else if question.type === 'linear_scale'}
            <div class="space-y-4 pt-1">
              <!-- Scale Range Selector -->
              <div class="flex items-center space-x-3 text-xs text-slate-600">
                <select
                  bind:value={question.scaleMin}
                  on:change={() => dispatch('change')}
                  class="bg-slate-50 border border-slate-300 rounded px-2.5 py-1 text-slate-700 focus:outline-none focus:border-[#673AB7]"
                >
                  <option value={0}>0</option>
                  <option value={1}>1</option>
                </select>
                <span class="text-slate-400">to</span>
                <select
                  bind:value={question.scaleMax}
                  on:change={() => dispatch('change')}
                  class="bg-slate-50 border border-slate-300 rounded px-2.5 py-1 text-slate-700 focus:outline-none focus:border-[#673AB7]"
                >
                  <option value={3}>3</option>
                  <option value={4}>4</option>
                  <option value={5}>5 (Standard)</option>
                  <option value={7}>7</option>
                  <option value={10}>10 (NPS Style)</option>
                </select>
              </div>

              <!-- Min / Max Label Inputs -->
              <div class="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-lg">
                <div class="flex items-center space-x-2">
                  <span class="text-xs text-slate-400 font-mono w-4">{question.scaleMin ?? 1}.</span>
                  <input
                    type="text"
                    bind:value={question.scaleMinLabel}
                    on:input={() => dispatch('change')}
                    placeholder="Label (optional, e.g. Poor / Strongly Disagree)"
                    class="flex-1 bg-transparent text-xs text-slate-700 py-1 border-b border-slate-200 focus:border-[#673AB7] focus:outline-none placeholder:text-slate-400"
                  />
                </div>
                <div class="flex items-center space-x-2">
                  <span class="text-xs text-slate-400 font-mono w-4">{question.scaleMax ?? 5}.</span>
                  <input
                    type="text"
                    bind:value={question.scaleMaxLabel}
                    on:input={() => dispatch('change')}
                    placeholder="Label (optional, e.g. Excellent / Strongly Agree)"
                    class="flex-1 bg-transparent text-xs text-slate-700 py-1 border-b border-slate-200 focus:border-[#673AB7] focus:outline-none placeholder:text-slate-400"
                  />
                </div>
              </div>
            </div>

          <!-- Date -->
          {:else if question.type === 'date'}
            <div class="flex items-center space-x-2 max-w-xs text-xs text-slate-400 py-2 border-b border-dotted border-slate-300">
              <Calendar size={16} class="text-slate-400" />
              <span>Month, day, year</span>
            </div>

          <!-- Time -->
          {:else if question.type === 'time'}
            <div class="flex items-center space-x-2 max-w-xs text-xs text-slate-400 py-2 border-b border-dotted border-slate-300">
              <Clock size={16} class="text-slate-400" />
              <span>Time (HH : MM AM/PM)</span>
            </div>
          {/if}
        </div>

        <!-- QUIZ MODE: Answer Key Editor Drawer -->
        {#if isQuiz && showAnswerKey}
          <div class="mt-4 p-4 rounded-xl bg-purple-50/70 border border-purple-200/80 space-y-3 animate-in fade-in duration-150">
            <div class="flex items-center justify-between">
              <div class="flex items-center space-x-2 text-xs font-semibold text-[#673AB7]">
                <KeyRound size={15} />
                <span>Answer Key & Auto-Grading</span>
              </div>

              <!-- Points Input -->
              <div class="flex items-center space-x-1.5 bg-white px-2.5 py-1 rounded-lg border border-purple-200 shadow-2xs">
                <span class="text-[11px] text-slate-500 font-medium">Points:</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  bind:value={question.points}
                  on:input={() => dispatch('change')}
                  class="w-12 text-center text-xs font-bold text-[#673AB7] focus:outline-none"
                />
              </div>
            </div>

            <!-- Options Picker for Correct Answer -->
            {#if question.options && question.options.length > 0}
              <div class="space-y-1.5 pt-1">
                <span class="text-[11px] text-slate-500 block">Select the correct answer(s):</span>
                {#each question.options as opt}
                  {@const correct = isCorrect(opt.text)}
                  <button
                    type="button"
                    class="w-full text-left px-3 py-2 rounded-lg border text-xs flex items-center justify-between transition-colors {correct
                      ? 'bg-emerald-50 border-emerald-400 text-emerald-800 font-medium'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}"
                    on:click|stopPropagation={() => toggleCorrectAnswer(opt.text)}
                  >
                    <span>{opt.text}</span>
                    {#if correct}
                      <CheckCircle2 size={16} class="text-emerald-600 shrink-0" />
                    {/if}
                  </button>
                {/each}
              </div>
            {:else}
              <p class="text-xs text-slate-500">Correct answers are evaluated manually for open-ended text questions.</p>
            {/if}

            <div class="flex justify-end pt-1">
              <button
                type="button"
                class="px-4 py-1.5 rounded-lg bg-[#673AB7] text-white hover:bg-[#512DA8] text-xs font-semibold shadow-2xs transition-colors"
                on:click|stopPropagation={() => (showAnswerKey = false)}
              >
                Done
              </button>
            </div>
          </div>
        {/if}

        <!-- Bottom Action Bar (Divider & Controls) -->
        <div class="flex items-center justify-between pt-4 border-t border-slate-200/80">
          <div>
            {#if isQuiz}
              <button
                type="button"
                class="flex items-center space-x-1.5 text-xs font-semibold text-[#673AB7] hover:text-[#512DA8] hover:bg-purple-50 px-2.5 py-1.5 rounded-lg transition-colors"
                on:click|stopPropagation={() => (showAnswerKey = !showAnswerKey)}
              >
                <KeyRound size={14} />
                <span>Answer key ({question.points || 0} pts)</span>
              </button>
            {/if}
          </div>

          <div class="flex items-center space-x-2">
            <!-- Duplicate Button -->
            <button
              type="button"
              class="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
              on:click|stopPropagation={() => dispatch('duplicate', question.id)}
              title="Duplicate question"
            >
              <Copy size={16} />
            </button>

            <!-- Delete Button -->
            <button
              type="button"
              class="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
              on:click|stopPropagation={() => dispatch('delete', question.id)}
              title="Delete question"
            >
              <Trash2 size={16} />
            </button>

            <div class="h-5 w-px bg-slate-200 mx-1"></div>

            <!-- Required Toggle -->
            <div class="flex items-center space-x-2">
              <span class="text-xs text-slate-600 font-medium">Required</span>
              <button
                type="button"
                class="w-9 h-5 flex items-center rounded-full p-0.5 transition-colors {question.required ? 'bg-[#673AB7]' : 'bg-slate-300'}"
                on:click|stopPropagation={() => {
                  question.required = !question.required;
                  dispatch('change');
                }}
              >
                <div
                  class="bg-white w-4 h-4 rounded-full shadow-xs transform transition-transform {question.required ? 'translate-x-4' : 'translate-x-0'}"
                ></div>
              </button>
            </div>

            <!-- More Options -->
            <div class="relative">
              <button
                type="button"
                class="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                on:click|stopPropagation={() => (showMoreMenu = !showMoreMenu)}
                title="More options"
              >
                <MoreVertical size={16} />
              </button>

              {#if showMoreMenu}
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <div
                  class="absolute right-0 bottom-full mb-1 w-44 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-40 text-xs text-slate-700 animate-in fade-in zoom-in-95 duration-100"
                  on:click|stopPropagation
                >
                  <button
                    type="button"
                    class="w-full px-3 py-1.5 text-left hover:bg-slate-100 flex items-center justify-between"
                    on:click={() => {
                      isEditingDescription = !isEditingDescription;
                      showMoreMenu = false;
                      dispatch('change');
                    }}
                  >
                    <span>Description</span>
                    {#if isEditingDescription}
                      <Check size={14} class="text-[#673AB7]" />
                    {/if}
                  </button>
                </div>
              {/if}
            </div>
          </div>
        </div>
      </div>

    {:else}
      <!-- INACTIVE PREVIEW STATE -->
      <div class="space-y-3 cursor-pointer">
        <div class="flex items-start justify-between">
          <div class="space-y-1">
            <h3 class="text-sm font-medium text-slate-800 flex items-center space-x-1.5">
              <span>{question.title || 'Untitled Question'}</span>
              {#if question.required}
                <span class="text-rose-500 font-bold">*</span>
              {/if}
            </h3>
            {#if question.description}
              <p class="text-xs text-slate-500">{question.description}</p>
            {/if}
          </div>

          {#if isQuiz && question.points}
            <span class="text-[11px] font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
              {question.points} pts
            </span>
          {/if}
        </div>

        <!-- Compact preview of options -->
        {#if question.type === 'multiple_choice' || question.type === 'checkboxes' || question.type === 'dropdown'}
          <div class="space-y-1.5 pl-1 pt-1">
            {#each question.options.slice(0, 5) as opt, idx}
              <div class="flex items-center space-x-2 text-xs text-slate-600">
                {#if question.type === 'multiple_choice'}
                  <div class="w-3.5 h-3.5 rounded-full border border-slate-300"></div>
                {:else if question.type === 'checkboxes'}
                  <div class="w-3.5 h-3.5 rounded-xs border border-slate-300"></div>
                {:else}
                  <span class="text-[11px] text-slate-400 font-mono">{idx + 1}.</span>
                {/if}
                <span>{opt.text}</span>
              </div>
            {/each}
            {#if question.options.length > 5}
              <span class="text-[11px] text-slate-400 italic block pl-5">+ {question.options.length - 5} more options</span>
            {/if}
          </div>
        {:else if question.type === 'linear_scale'}
          <div class="flex items-center space-x-2 pt-2 text-xs text-slate-500">
            {#if question.scaleMinLabel}
              <span class="text-[11px]">{question.scaleMinLabel}</span>
            {/if}
            <div class="flex items-center space-x-1">
              {#each Array.from({ length: (question.scaleMax ?? 5) - (question.scaleMin ?? 1) + 1 }, (_, i) => (question.scaleMin ?? 1) + i) as n}
                <div class="w-7 h-7 rounded-full border border-slate-200 bg-slate-50 flex items-center justify-center font-mono text-[11px] text-slate-600">
                  {n}
                </div>
              {/each}
            </div>
            {#if question.scaleMaxLabel}
              <span class="text-[11px]">{question.scaleMaxLabel}</span>
            {/if}
          </div>
        {:else if question.type === 'short_answer'}
          <div class="w-48 border-b border-dotted border-slate-300 text-slate-400 text-xs py-1">Short answer</div>
        {:else if question.type === 'paragraph'}
          <div class="w-72 border-b border-dotted border-slate-300 text-slate-400 text-xs py-1">Paragraph answer</div>
        {:else if question.type === 'date'}
          <div class="flex items-center space-x-1.5 text-xs text-slate-400 py-1">
            <Calendar size={13} />
            <span>Date picker</span>
          </div>
        {:else if question.type === 'time'}
          <div class="flex items-center space-x-1.5 text-xs text-slate-400 py-1">
            <Clock size={13} />
            <span>Time picker</span>
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>
