<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { FormDocument, FormResponse, FormQuestion } from '../../types';
  import {
    X,
    CheckCircle2,
    RotateCcw,
    AlertCircle,
    Calendar,
    Clock,
    Award,
    ChevronDown,
    ExternalLink
  } from 'lucide-svelte';

  export let form: FormDocument;

  const dispatch = createEventDispatcher<{
    close: void;
    submit: FormResponse;
    change: void;
  }>();

  let respondentEmail = '';
  let answers: Record<string, any> = {};
  let otherAnswers: Record<string, string> = {};
  let errors: Record<string, string> = {};
  let isSubmitted = false;
  let submissionResult: { score?: number; maxScore?: number } | null = null;
  let showScoreBreakdown = false;

  function handleRadioChange(questionId: string, val: string) {
    answers[questionId] = val;
    delete errors[questionId];
    errors = { ...errors };
  }

  function handleCheckboxToggle(questionId: string, val: string) {
    if (!answers[questionId] || !Array.isArray(answers[questionId])) {
      answers[questionId] = [];
    }
    const arr: string[] = answers[questionId];
    if (arr.includes(val)) {
      answers[questionId] = arr.filter((x) => x !== val);
    } else {
      answers[questionId] = [...arr, val];
    }
    delete errors[questionId];
    errors = { ...errors };
  }

  function validateForm(): boolean {
    const newErrors: Record<string, string> = {};

    // Validate email if required
    if (form.settings.collectEmail) {
      if (!respondentEmail.trim()) {
        newErrors['email'] = 'Email address is required';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(respondentEmail.trim())) {
        newErrors['email'] = 'Please enter a valid email address';
      }
    }

    // Validate required questions
    for (const q of form.questions) {
      if (q.required) {
        const val = answers[q.id];
        if (val === undefined || val === null || val === '') {
          newErrors[q.id] = 'This is a required question';
        } else if (Array.isArray(val) && val.length === 0) {
          newErrors[q.id] = 'This is a required question';
        }
      }
    }

    errors = newErrors;
    return Object.keys(newErrors).length === 0;
  }

  function handleSubmit() {
    if (!form.acceptingResponses) {
      alert('This form is currently closed and not accepting new responses.');
      return;
    }

    if (!validateForm()) {
      // Scroll to first error
      return;
    }

    // Compile answers
    const finalAnswers: Record<string, any> = {};
    for (const q of form.questions) {
      let ans = answers[q.id];
      if (ans === 'Other...' && otherAnswers[q.id]) {
        ans = `Other: ${otherAnswers[q.id]}`;
      } else if (Array.isArray(ans)) {
        ans = ans.map((item) => (item === 'Other...' && otherAnswers[q.id] ? `Other: ${otherAnswers[q.id]}` : item));
      }
      finalAnswers[q.id] = ans ?? '';
    }

    // Quiz scoring
    let score = 0;
    let maxScore = 0;
    if (form.settings.isQuiz) {
      for (const q of form.questions) {
        const pts = q.points || 0;
        maxScore += pts;
        const userAns = finalAnswers[q.id];
        const correct = q.correctAnswers || [];

        if (correct.length > 0) {
          if (q.type === 'multiple_choice' || q.type === 'dropdown') {
            if (correct.includes(String(userAns))) {
              score += pts;
            }
          } else if (q.type === 'checkboxes') {
            const userArr = Array.isArray(userAns) ? userAns : [];
            const isAllCorrect =
              correct.length === userArr.length &&
              correct.every((c) => userArr.includes(c));
            if (isAllCorrect) {
              score += pts;
            }
          }
        }
      }
      submissionResult = { score, maxScore };
    }

    const response: FormResponse = {
      id: 'resp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      submittedAt: new Date().toISOString(),
      respondentEmail: form.settings.collectEmail ? respondentEmail : undefined,
      score: form.settings.isQuiz ? score : undefined,
      maxScore: form.settings.isQuiz ? maxScore : undefined,
      answers: finalAnswers,
    };

    if (!form.responses) form.responses = [];
    form.responses = [...form.responses, response];

    isSubmitted = true;
    dispatch('submit', response);
    dispatch('change');
  }

  function handleReset() {
    answers = {};
    otherAnswers = {};
    errors = {};
    respondentEmail = '';
    isSubmitted = false;
    submissionResult = null;
    showScoreBreakdown = false;
  }
</script>

<div class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-150">
  <div class="relative bg-[#f0ebf8] w-full max-w-2xl rounded-2xl shadow-2xl border border-purple-200/80 overflow-hidden flex flex-col my-auto max-h-[92vh]">
    <!-- Modal Header Controls -->
    <div class="sticky top-0 z-30 bg-white/90 backdrop-blur-md px-5 py-3 border-b border-purple-100 flex items-center justify-between shadow-2xs">
      <div class="flex items-center space-x-2">
        <span class="w-3 h-3 rounded-full bg-[#673AB7]"></span>
        <span class="text-xs font-bold text-slate-800 tracking-tight">Form Live Preview</span>
        <span class="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">Interactive Demo</span>
      </div>

      <div class="flex items-center space-x-2">
        <button
          type="button"
          class="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
          on:click={() => dispatch('close')}
          title="Exit Preview"
        >
          <X size={18} />
        </button>
      </div>
    </div>

    <!-- Scrollable Form Container -->
    <div class="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
      {#if !isSubmitted}
        <!-- Form Header Card -->
        <div class="bg-white rounded-xl shadow-xs border border-slate-200/80 overflow-hidden">
          <div class="h-2.5 bg-[#673AB7] w-full"></div>
          <div class="p-6 space-y-3">
            <h1 class="text-2xl font-bold text-slate-900 tracking-tight">{form.title || 'Untitled Form'}</h1>
            {#if form.description}
              <p class="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">{form.description}</p>
            {/if}

            <div class="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              {#if form.settings.collectEmail}
                <div class="flex items-center space-x-1.5 text-purple-700 font-medium">
                  <span>* Email collection active</span>
                </div>
              {/if}
              <span class="text-rose-500 font-semibold">* Indicates required question</span>
            </div>
          </div>
        </div>

        <!-- Collect Email Card if enabled -->
        {#if form.settings.collectEmail}
          <div class="bg-white rounded-xl shadow-xs border {errors['email'] ? 'border-rose-400 ring-1 ring-rose-300' : 'border-slate-200/80'} p-6 space-y-3">
            <label class="block text-sm font-semibold text-slate-800">
              Email address <span class="text-rose-500 font-bold">*</span>
            </label>
            <input
              type="email"
              bind:value={respondentEmail}
              placeholder="your.email@example.com"
              class="w-full max-w-md bg-transparent text-sm text-slate-800 py-2 border-b-2 {errors['email'] ? 'border-rose-400' : 'border-slate-200 focus:border-[#673AB7]'} focus:outline-none transition-colors"
            />
            {#if errors['email']}
              <div class="flex items-center space-x-1 text-xs text-rose-500 font-medium">
                <AlertCircle size={13} />
                <span>{errors['email']}</span>
              </div>
            {/if}
          </div>
        {/if}

        <!-- Question Cards List -->
        {#each form.questions as question, idx (question.id)}
          {@const hasError = Boolean(errors[question.id])}
          <div class="bg-white rounded-xl shadow-xs border {hasError ? 'border-rose-400 ring-1 ring-rose-300' : 'border-slate-200/80'} p-6 space-y-4 transition-all">
            <!-- Question Title & Description -->
            <div class="space-y-1">
              <div class="flex items-start justify-between">
                <h3 class="text-sm font-semibold text-slate-900 leading-snug">
                  <span>{question.title || `Question ${idx + 1}`}</span>
                  {#if question.required}
                    <span class="text-rose-500 font-bold ml-0.5">*</span>
                  {/if}
                </h3>

                {#if form.settings.isQuiz && question.points}
                  <span class="text-[11px] font-semibold text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-full border border-purple-200">
                    {question.points} {question.points === 1 ? 'point' : 'points'}
                  </span>
                {/if}
              </div>

              {#if question.description}
                <p class="text-xs text-slate-500 leading-normal">{question.description}</p>
              {/if}
            </div>

            <!-- Question Inputs according to Type -->
            <div class="pt-1">
              <!-- Short Answer -->
              {#if question.type === 'short_answer'}
                <input
                  type="text"
                  bind:value={answers[question.id]}
                  on:input={() => { delete errors[question.id]; errors = { ...errors }; }}
                  placeholder="Your answer"
                  class="w-full max-w-sm bg-transparent text-sm text-slate-800 py-1.5 border-b-2 {hasError ? 'border-rose-400' : 'border-slate-200 focus:border-[#673AB7]'} focus:outline-none transition-colors"
                />

              <!-- Paragraph -->
              {:else if question.type === 'paragraph'}
                <textarea
                  bind:value={answers[question.id]}
                  on:input={() => { delete errors[question.id]; errors = { ...errors }; }}
                  rows="3"
                  placeholder="Your answer"
                  class="w-full bg-transparent text-sm text-slate-800 p-2.5 rounded-lg border {hasError ? 'border-rose-400' : 'border-slate-200 focus:border-[#673AB7]'} focus:outline-none transition-colors resize-y"
                ></textarea>

              <!-- Multiple Choice -->
              {:else if question.type === 'multiple_choice'}
                <div class="space-y-2.5">
                  {#each question.options as opt}
                    <label class="flex items-center space-x-3 text-xs text-slate-700 cursor-pointer hover:text-slate-900 group">
                      <input
                        type="radio"
                        name={`q_${question.id}`}
                        value={opt.text}
                        checked={answers[question.id] === opt.text}
                        on:change={() => handleRadioChange(question.id, opt.text)}
                        class="w-4 h-4 text-[#673AB7] border-slate-300 focus:ring-[#673AB7] cursor-pointer"
                      />
                      {#if opt.isOther}
                        <div class="flex items-center space-x-2 flex-1">
                          <span>Other:</span>
                          <input
                            type="text"
                            bind:value={otherAnswers[question.id]}
                            on:focus={() => handleRadioChange(question.id, 'Other...')}
                            placeholder="Type other answer..."
                            class="flex-1 bg-transparent text-xs py-0.5 border-b border-slate-300 focus:border-[#673AB7] focus:outline-none"
                          />
                        </div>
                      {:else}
                        <span class="group-hover:translate-x-0.5 transition-transform">{opt.text}</span>
                      {/if}
                    </label>
                  {/each}
                </div>

              <!-- Checkboxes -->
              {:else if question.type === 'checkboxes'}
                <div class="space-y-2.5">
                  {#each question.options as opt}
                    {@const isChecked = Boolean(answers[question.id]?.includes(opt.text))}
                    <label class="flex items-center space-x-3 text-xs text-slate-700 cursor-pointer hover:text-slate-900 group">
                      <input
                        type="checkbox"
                        value={opt.text}
                        checked={isChecked}
                        on:change={() => handleCheckboxToggle(question.id, opt.text)}
                        class="w-4 h-4 rounded-xs text-[#673AB7] border-slate-300 focus:ring-[#673AB7] cursor-pointer"
                      />
                      {#if opt.isOther}
                        <div class="flex items-center space-x-2 flex-1">
                          <span>Other:</span>
                          <input
                            type="text"
                            bind:value={otherAnswers[question.id]}
                            on:focus={() => {
                              if (!isChecked) handleCheckboxToggle(question.id, 'Other...');
                            }}
                            placeholder="Type other answer..."
                            class="flex-1 bg-transparent text-xs py-0.5 border-b border-slate-300 focus:border-[#673AB7] focus:outline-none"
                          />
                        </div>
                      {:else}
                        <span class="group-hover:translate-x-0.5 transition-transform">{opt.text}</span>
                      {/if}
                    </label>
                  {/each}
                </div>

              <!-- Dropdown -->
              {:else if question.type === 'dropdown'}
                <div class="relative max-w-xs">
                  <select
                    bind:value={answers[question.id]}
                    on:change={() => { delete errors[question.id]; errors = { ...errors }; }}
                    class="w-full appearance-none bg-white border {hasError ? 'border-rose-400' : 'border-slate-300 focus:border-[#673AB7]'} text-xs text-slate-700 rounded-lg px-3 py-2 pr-8 shadow-2xs focus:outline-none"
                  >
                    <option value="" disabled selected>Choose an option</option>
                    {#each question.options as opt}
                      <option value={opt.text}>{opt.text}</option>
                    {/each}
                  </select>
                  <ChevronDown size={14} class="absolute right-2.5 top-3 text-slate-400 pointer-events-none" />
                </div>

              <!-- Linear Scale -->
              {:else if question.type === 'linear_scale'}
                <div class="py-2">
                  <div class="flex items-center justify-between text-[11px] text-slate-500 mb-2">
                    <span>{question.scaleMinLabel || ''}</span>
                    <span>{question.scaleMaxLabel || ''}</span>
                  </div>
                  <div class="flex items-center justify-between gap-1 overflow-x-auto py-1">
                    {#each Array.from({ length: (question.scaleMax ?? 5) - (question.scaleMin ?? 1) + 1 }, (_, i) => (question.scaleMin ?? 1) + i) as n}
                      {@const isSelected = answers[question.id] === n}
                      <button
                        type="button"
                        class="flex-1 max-w-[48px] aspect-square rounded-full border flex flex-col items-center justify-center text-xs font-semibold transition-all {isSelected
                          ? 'bg-[#673AB7] border-[#673AB7] text-white shadow-sm scale-105'
                          : 'bg-white border-slate-200 text-slate-700 hover:border-purple-300 hover:bg-purple-50/50'}"
                        on:click={() => {
                          answers[question.id] = n;
                          delete errors[question.id];
                          errors = { ...errors };
                        }}
                      >
                        {n}
                      </button>
                    {/each}
                  </div>
                </div>

              <!-- Date -->
              {:else if question.type === 'date'}
                <div class="relative max-w-xs">
                  <input
                    type="date"
                    bind:value={answers[question.id]}
                    on:input={() => { delete errors[question.id]; errors = { ...errors }; }}
                    class="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-700 shadow-2xs focus:border-[#673AB7] focus:outline-none"
                  />
                </div>

              <!-- Time -->
              {:else if question.type === 'time'}
                <div class="relative max-w-xs">
                  <input
                    type="time"
                    bind:value={answers[question.id]}
                    on:input={() => { delete errors[question.id]; errors = { ...errors }; }}
                    class="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-700 shadow-2xs focus:border-[#673AB7] focus:outline-none"
                  />
                </div>
              {/if}
            </div>

            <!-- Error message if validation failed -->
            {#if hasError}
              <div class="flex items-center space-x-1.5 text-xs text-rose-500 font-medium pt-1 animate-in fade-in duration-100">
                <AlertCircle size={14} />
                <span>{errors[question.id]}</span>
              </div>
            {/if}
          </div>
        {/each}

        <!-- Submission Buttons Card -->
        <div class="flex items-center justify-between pt-2 pb-6">
          <button
            type="button"
            class="px-7 py-2.5 bg-[#673AB7] hover:bg-[#512DA8] text-white text-xs font-semibold rounded-lg shadow-md hover:shadow-lg transition-all active:scale-95"
            on:click={handleSubmit}
          >
            Submit Form
          </button>

          <button
            type="button"
            class="text-xs text-slate-500 hover:text-slate-800 font-medium px-3 py-1.5 rounded hover:bg-white/40 transition-colors"
            on:click={handleReset}
          >
            Clear form
          </button>
        </div>

      {:else}
        <!-- SUBMITTED CONFIRMATION SCREEN -->
        <div class="bg-white rounded-xl shadow-xs border border-slate-200/80 overflow-hidden text-center p-8 space-y-5 animate-in zoom-in-95 duration-200">
          <div class="w-16 h-16 rounded-full bg-purple-100 text-[#673AB7] flex items-center justify-center mx-auto shadow-inner">
            <CheckCircle2 size={36} />
          </div>

          <div class="space-y-1.5">
            <h2 class="text-xl font-bold text-slate-900 tracking-tight">{form.title || 'Form'}</h2>
            <p class="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
              {form.settings.confirmationMessage || 'Your response has been recorded.'}
            </p>
          </div>

          {#if form.settings.isQuiz && submissionResult}
            <div class="bg-purple-50 rounded-xl p-4 max-w-sm mx-auto border border-purple-200 text-center space-y-1">
              <div class="flex items-center justify-center space-x-1.5 text-[#673AB7] text-xs font-semibold">
                <Award size={16} />
                <span>Quiz Score</span>
              </div>
              <div class="text-2xl font-black text-purple-900 font-mono">
                {submissionResult.score} / {submissionResult.maxScore}
              </div>
            </div>
          {/if}

          <div class="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              class="w-full sm:w-auto px-5 py-2 rounded-lg bg-[#673AB7] hover:bg-[#512DA8] text-white text-xs font-semibold shadow-xs transition-colors"
              on:click={handleReset}
            >
              Submit another response
            </button>
            <button
              type="button"
              class="w-full sm:w-auto px-4 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors"
              on:click={() => dispatch('close')}
            >
              Close preview
            </button>
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>
