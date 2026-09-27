<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { FormDocument, FormQuestion, FormOption, QuestionType } from '../../types';
  import QuestionCard from './QuestionCard.svelte';
  import FormPreviewModal from './FormPreviewModal.svelte';
  import ResponsesView from './ResponsesView.svelte';
  import FormSettingsModal from './FormSettingsModal.svelte';
  import {
    Plus,
    PlusCircle,
    Eye,
    Palette,
    Undo2,
    Redo2,
    Send,
    MoreVertical,
    FileText,
    Image,
    Layers,
    Type,
    Download,
    Upload,
    Check,
    Copy,
    Share2,
    CheckSquare,
    Sparkles,
    Trash2,
    X,
    FileSpreadsheet,
    HelpCircle
  } from 'lucide-svelte';
  import { downloadFile } from '../../lib/utils';

  export let form: FormDocument;

  const dispatch = createEventDispatcher<{
    change: void;
    updateStats: { questionCount: number; responseCount: number };
    linkToSheets: {
      headers: string[];
      rows: (string | number)[][];
      formTitle: string;
    };
  }>();

  type TabType = 'questions' | 'responses' | 'settings';
  let activeTab: TabType = 'questions';

  let activeQuestionId: string | null = form.questions?.[0]?.id || null;
  let showPreviewModal = false;
  let showThemePicker = false;
  let showShareModal = false;
  let showImportModal = false;
  let showMoreMenu = false;
  let copyNotification = false;

  const THEME_PALETTES = [
    { name: 'Classic Purple', header: '#673AB7', bg: '#f0ebf8' },
    { name: 'Indigo Deep', header: '#3F51B5', bg: '#eceef8' },
    { name: 'Teal Forest', header: '#009688', bg: '#e8f5f4' },
    { name: 'Ruby Red', header: '#E91E63', bg: '#fbebf0' },
    { name: 'Sunset Orange', header: '#FF5722', bg: '#fdf1ec' },
    { name: 'Blue Slate', header: '#455A64', bg: '#edf0f2' },
  ];

  $: {
    // Notify parent of updated statistics
    dispatch('updateStats', {
      questionCount: form.questions?.length || 0,
      responseCount: form.responses?.length || 0,
    });
  }

  function handleFormChange() {
    form.meta.isDirty = true;
    dispatch('change');
  }

  function setActiveQuestion(id: string) {
    activeQuestionId = id;
  }

  function addQuestion(type: QuestionType = 'multiple_choice') {
    const newId = 'q_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    const newQ: FormQuestion = {
      id: newId,
      type,
      title: 'Untitled Question',
      required: form.settings.requireQuestionsByDefault ?? false,
      options: ['multiple_choice', 'checkboxes', 'dropdown'].includes(type)
        ? [{ id: 'opt_' + Math.random().toString(36).substr(2, 6), text: 'Option 1' }]
        : [],
      points: form.settings.isQuiz ? form.settings.defaultPoints : 0,
      scaleMin: type === 'linear_scale' ? 1 : undefined,
      scaleMax: type === 'linear_scale' ? 5 : undefined,
    };

    if (!form.questions) form.questions = [];

    // Insert after active question or at the end
    const activeIdx = form.questions.findIndex((q) => q.id === activeQuestionId);
    if (activeIdx !== -1) {
      form.questions.splice(activeIdx + 1, 0, newQ);
      form.questions = [...form.questions];
    } else {
      form.questions = [...form.questions, newQ];
    }

    activeQuestionId = newId;
    handleFormChange();
  }

  function duplicateQuestion(questionId: string) {
    const idx = form.questions.findIndex((q) => q.id === questionId);
    if (idx === -1) return;

    const source = form.questions[idx];
    const newId = 'q_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    const clone: FormQuestion = {
      ...JSON.parse(JSON.stringify(source)),
      id: newId,
      title: `${source.title} (Copy)`,
    };

    form.questions.splice(idx + 1, 0, clone);
    form.questions = [...form.questions];
    activeQuestionId = newId;
    handleFormChange();
  }

  function deleteQuestion(questionId: string) {
    if (form.questions.length <= 1) {
      alert('A form must have at least one question.');
      return;
    }
    const idx = form.questions.findIndex((q) => q.id === questionId);
    form.questions = form.questions.filter((q) => q.id !== questionId);
    const nextQ = form.questions[Math.min(idx, form.questions.length - 1)];
    activeQuestionId = nextQ ? nextQ.id : null;
    handleFormChange();
  }

  function moveQuestion(questionId: string, direction: 'up' | 'down') {
    const idx = form.questions.findIndex((q) => q.id === questionId);
    if (idx === -1) return;
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= form.questions.length) return;

    const temp = form.questions[idx];
    form.questions[idx] = form.questions[targetIdx];
    form.questions[targetIdx] = temp;
    form.questions = [...form.questions];
    activeQuestionId = questionId;
    handleFormChange();
  }

  function addTitleAndDescription() {
    addQuestion('short_answer');
  }

  function addSectionBreak() {
    addQuestion('short_answer');
  }

  function setThemePalette(p: { header: string; bg: string }) {
    form.headerColor = p.header;
    form.bgColor = p.bg;
    showThemePicker = false;
    handleFormChange();
  }

  function copyShareLink() {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      copyNotification = true;
      setTimeout(() => (copyNotification = false), 2500);
    }
  }

  function exportFormJson() {
    downloadFile(
      `${(form.title || 'Form').toLowerCase().replace(/\s+/g, '_')}.json`,
      JSON.stringify(form, null, 2),
      'application/json'
    );
  }

  function importQuestions(preset: 'satisfaction' | 'quiz' | 'event') {
    let imported: FormQuestion[] = [];
    if (preset === 'satisfaction') {
      imported = [
        {
          id: 'q_' + Math.random().toString(36).substr(2, 6),
          type: 'linear_scale',
          title: 'How satisfied are you with our service?',
          required: true,
          options: [],
          scaleMin: 1,
          scaleMax: 5,
          scaleMinLabel: 'Very Unsatisfied',
          scaleMaxLabel: 'Very Satisfied',
        },
        {
          id: 'q_' + Math.random().toString(36).substr(2, 6),
          type: 'multiple_choice',
          title: 'How often do you interact with our platform?',
          required: true,
          options: [
            { id: 'o1', text: 'Daily' },
            { id: 'o2', text: 'Weekly' },
            { id: 'o3', text: 'Monthly' },
            { id: 'o4', text: 'First time today' },
          ],
        },
        {
          id: 'q_' + Math.random().toString(36).substr(2, 6),
          type: 'paragraph',
          title: 'What features would you like to see next?',
          required: false,
          options: [],
        },
      ];
    } else if (preset === 'quiz') {
      form.settings.isQuiz = true;
      imported = [
        {
          id: 'q_' + Math.random().toString(36).substr(2, 6),
          type: 'multiple_choice',
          title: 'Which protocol is used for secure offline encryption?',
          required: true,
          points: 10,
          options: [
            { id: 'o1', text: 'AES-256-GCM' },
            { id: 'o2', text: 'ROT13' },
            { id: 'o3', text: 'MD5' },
            { id: 'o4', text: 'Plaintext' },
          ],
          correctAnswers: ['AES-256-GCM'],
        },
        {
          id: 'q_' + Math.random().toString(36).substr(2, 6),
          type: 'checkboxes',
          title: 'Select all native office documents supported by SOS:',
          required: true,
          points: 10,
          options: [
            { id: 'o1', text: 'Word (.docx)' },
            { id: 'o2', text: 'Spreadsheet (.xlsx)' },
            { id: 'o3', text: 'Presentation (.pptx)' },
            { id: 'o4', text: 'Adobe Flash (.swf)' },
          ],
          correctAnswers: ['Word (.docx)', 'Spreadsheet (.xlsx)', 'Presentation (.pptx)'],
        },
      ];
    } else {
      imported = [
        {
          id: 'q_' + Math.random().toString(36).substr(2, 6),
          type: 'short_answer',
          title: 'Full Name',
          required: true,
          options: [],
        },
        {
          id: 'q_' + Math.random().toString(36).substr(2, 6),
          type: 'dropdown',
          title: 'Dietary Preferences',
          required: false,
          options: [
            { id: 'o1', text: 'None / Standard' },
            { id: 'o2', text: 'Vegetarian' },
            { id: 'o3', text: 'Vegan' },
            { id: 'o4', text: 'Gluten-Free' },
          ],
        },
        {
          id: 'q_' + Math.random().toString(36).substr(2, 6),
          type: 'date',
          title: 'Arrival Date',
          required: true,
          options: [],
        },
      ];
    }

    form.questions = [...form.questions, ...imported];
    activeQuestionId = imported[0]?.id || activeQuestionId;
    showImportModal = false;
    handleFormChange();
  }
</script>

<div
  class="flex-1 flex flex-col h-full overflow-hidden select-none font-sans"
  style="background-color: {form.bgColor || '#f0ebf8'};"
>
  <!-- TOP SUB-HEADER: Google Forms Material Navigation & Action Bar -->
  <div class="sticky top-0 z-30 bg-white border-b border-slate-200/80 px-4 sm:px-8 py-2.5 flex items-center justify-between shadow-2xs">
    <!-- Left: Form Branding & Mode Indicator -->
    <div class="flex items-center space-x-3">
      <div class="w-8 h-8 rounded-lg bg-[#673AB7] flex items-center justify-center text-white shadow-xs" title="Google Forms Editor">
        <CheckSquare size={18} />
      </div>
      <div>
        <input
          type="text"
          bind:value={form.title}
          on:input={handleFormChange}
          placeholder="Untitled Form"
          class="font-bold text-slate-800 text-sm hover:bg-slate-50 focus:bg-white px-2 py-0.5 rounded border border-transparent hover:border-slate-200 focus:border-[#673AB7] focus:outline-none transition-colors max-w-xs sm:max-w-md truncate"
        />
        <span class="text-[10px] text-slate-400 block px-2">All edits auto-saved offline</span>
      </div>
    </div>

    <!-- Center: Material Design 3 Navigation Tabs (Questions, Responses, Settings) -->
    <nav class="flex items-center space-x-1 sm:space-x-6">
      <button
        type="button"
        class="relative py-2.5 px-3 text-xs font-semibold transition-colors flex items-center space-x-1.5 {activeTab === 'questions'
          ? 'text-[#673AB7]'
          : 'text-slate-600 hover:text-slate-900'}"
        on:click={() => (activeTab = 'questions')}
      >
        <span>Questions</span>
        {#if activeTab === 'questions'}
          <div class="absolute bottom-0 left-0 right-0 h-0.75 bg-[#673AB7] rounded-t-full"></div>
        {/if}
      </button>

      <button
        type="button"
        class="relative py-2.5 px-3 text-xs font-semibold transition-colors flex items-center space-x-1.5 {activeTab === 'responses'
          ? 'text-[#673AB7]'
          : 'text-slate-600 hover:text-slate-900'}"
        on:click={() => (activeTab = 'responses')}
      >
        <span>Responses</span>
        {#if form.responses && form.responses.length > 0}
          <span class="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold {activeTab === 'responses' ? 'bg-[#673AB7] text-white' : 'bg-slate-200 text-slate-700'}">
            {form.responses.length}
          </span>
        {/if}
        {#if activeTab === 'responses'}
          <div class="absolute bottom-0 left-0 right-0 h-0.75 bg-[#673AB7] rounded-t-full"></div>
        {/if}
      </button>

      <button
        type="button"
        class="relative py-2.5 px-3 text-xs font-semibold transition-colors flex items-center space-x-1.5 {activeTab === 'settings'
          ? 'text-[#673AB7]'
          : 'text-slate-600 hover:text-slate-900'}"
        on:click={() => (activeTab = 'settings')}
      >
        <span>Settings</span>
        {#if activeTab === 'settings'}
          <div class="absolute bottom-0 left-0 right-0 h-0.75 bg-[#673AB7] rounded-t-full"></div>
        {/if}
      </button>
    </nav>

    <!-- Right: Top Utility Actions (Theme, Preview, Undo, Send) -->
    <div class="flex items-center space-x-1.5">
      <!-- Theme Palette Dropdown -->
      <div class="relative">
        <button
          type="button"
          class="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
          on:click|stopPropagation={() => (showThemePicker = !showThemePicker)}
          title="Customize Theme"
        >
          <Palette size={16} />
        </button>

        {#if showThemePicker}
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            class="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-200 p-3 z-40 space-y-2 animate-in fade-in zoom-in-95 duration-100"
            on:click|stopPropagation
          >
            <span class="text-xs font-bold text-slate-700 block">Theme Color</span>
            <div class="grid grid-cols-3 gap-2 pt-1">
              {#each THEME_PALETTES as p}
                <button
                  type="button"
                  class="flex flex-col items-center p-2 rounded-lg border border-slate-200 hover:border-purple-400 transition-colors"
                  on:click={() => setThemePalette(p)}
                >
                  <span class="w-6 h-6 rounded-full shadow-xs mb-1" style="background-color: {p.header}"></span>
                  <span class="text-[9px] text-slate-600 font-medium truncate w-full text-center">{p.name}</span>
                </button>
              {/each}
            </div>
          </div>
        {/if}
      </div>

      <!-- Preview (Eye Icon) -->
      <button
        type="button"
        class="p-2 text-slate-600 hover:text-[#673AB7] hover:bg-purple-50 rounded-lg transition-colors flex items-center space-x-1"
        on:click={() => (showPreviewModal = true)}
        title="Preview Form Live (Interactive)"
      >
        <Eye size={17} />
        <span class="text-xs font-semibold hidden md:inline">Preview</span>
      </button>

      <!-- Send / Share Button -->
      <button
        type="button"
        class="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-[#673AB7] hover:bg-[#512DA8] text-white text-xs font-semibold shadow-xs transition-colors"
        on:click={() => (showShareModal = true)}
      >
        <Send size={13} />
        <span>Send</span>
      </button>

      <!-- More Actions Menu -->
      <div class="relative">
        <button
          type="button"
          class="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
          on:click|stopPropagation={() => (showMoreMenu = !showMoreMenu)}
        >
          <MoreVertical size={16} />
        </button>

        {#if showMoreMenu}
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            class="absolute right-0 top-full mt-1 w-52 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-40 text-xs text-slate-700 animate-in fade-in zoom-in-95 duration-100"
            on:click|stopPropagation
          >
            <button
              type="button"
              class="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center space-x-2"
              on:click={() => {
                exportFormJson();
                showMoreMenu = false;
              }}
            >
              <Download size={14} class="text-slate-400" />
              <span>Export form definition (.json)</span>
            </button>

            <button
              type="button"
              class="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center space-x-2"
              on:click={() => {
                showImportModal = true;
                showMoreMenu = false;
              }}
            >
              <Upload size={14} class="text-slate-400" />
              <span>Import question templates...</span>
            </button>
          </div>
        {/if}
      </div>
    </div>
  </div>

  <!-- MAIN SCROLLABLE CONTENT AREA -->
  <div class="flex-1 overflow-y-auto px-4 py-6">
    <div class="max-w-2xl mx-auto relative pb-24">
      <!-- ================= TAB 1: QUESTIONS ================= -->
      {#if activeTab === 'questions'}
        <div class="space-y-4">
          <!-- Form Header Card -->
          <div class="bg-white rounded-xl shadow-xs border border-slate-200/80 overflow-hidden">
            <!-- Purple Top Accent Strip -->
            <div class="h-2.5 w-full" style="background-color: {form.headerColor || '#673AB7'};"></div>

            <div class="p-6 space-y-3">
              <input
                type="text"
                bind:value={form.title}
                on:input={handleFormChange}
                placeholder="Form Title"
                class="w-full text-2xl font-bold text-slate-900 border-b border-transparent hover:border-slate-200 focus:border-[#673AB7] focus:outline-none transition-colors py-1 placeholder:text-slate-300"
              />

              <textarea
                bind:value={form.description}
                on:input={handleFormChange}
                rows="2"
                placeholder="Form description (Give respondents instructions or context)"
                class="w-full text-xs text-slate-600 border-b border-transparent hover:border-slate-200 focus:border-[#673AB7] focus:outline-none transition-colors py-1 resize-y font-sans placeholder:text-slate-400 leading-relaxed"
              ></textarea>

              {#if form.settings.collectEmail}
                <div class="pt-2 border-t border-slate-100 flex items-center space-x-2 text-xs text-purple-700 font-medium">
                  <span class="w-1.5 h-1.5 rounded-full bg-[#673AB7]"></span>
                  <span>Collecting email addresses from all respondents</span>
                </div>
              {/if}
            </div>
          </div>

          <!-- Question Cards Stack -->
          {#each form.questions as question, idx (question.id)}
            <QuestionCard
              {question}
              isActive={question.id === activeQuestionId}
              index={idx}
              totalQuestions={form.questions.length}
              isQuiz={form.settings.isQuiz}
              themeColor={form.headerColor || '#673AB7'}
              on:select={(e) => setActiveQuestion(e.detail)}
              on:change={handleFormChange}
              on:duplicate={(e) => duplicateQuestion(e.detail)}
              on:delete={(e) => deleteQuestion(e.detail)}
              on:moveUp={(e) => moveQuestion(e.detail, 'up')}
              on:moveDown={(e) => moveQuestion(e.detail, 'down')}
            />
          {/each}
        </div>

        <!-- FLOATING ACTION TOOLBAR (Google Forms right sidebar pill) -->
        <div class="fixed right-6 bottom-8 sm:static sm:absolute sm:-right-14 sm:top-24 z-20">
          <div class="bg-white rounded-full sm:rounded-2xl shadow-xl border border-slate-200 p-1.5 flex sm:flex-col items-center space-x-1 sm:space-x-0 sm:space-y-1.5 backdrop-blur-md">
            <!-- Add Question -->
            <button
              type="button"
              class="p-2.5 rounded-full text-slate-700 hover:text-white hover:bg-[#673AB7] transition-all group"
              on:click={() => addQuestion('multiple_choice')}
              title="Add question"
            >
              <PlusCircle size={20} class="text-[#673AB7] group-hover:text-white transition-colors" />
            </button>

            <!-- Import Questions -->
            <button
              type="button"
              class="p-2.5 rounded-full text-slate-500 hover:text-[#673AB7] hover:bg-purple-50 transition-colors"
              on:click={() => (showImportModal = true)}
              title="Import questions template"
            >
              <Download size={18} />
            </button>

            <!-- Add Title and Description -->
            <button
              type="button"
              class="p-2.5 rounded-full text-slate-500 hover:text-[#673AB7] hover:bg-purple-50 transition-colors"
              on:click={addTitleAndDescription}
              title="Add title & description"
            >
              <Type size={18} />
            </button>

            <!-- Add Linear Scale -->
            <button
              type="button"
              class="p-2.5 rounded-full text-slate-500 hover:text-[#673AB7] hover:bg-purple-50 transition-colors"
              on:click={() => addQuestion('linear_scale')}
              title="Add rating / linear scale"
            >
              <CheckSquare size={18} />
            </button>

            <!-- Add Section Break -->
            <button
              type="button"
              class="p-2.5 rounded-full text-slate-500 hover:text-[#673AB7] hover:bg-purple-50 transition-colors"
              on:click={addSectionBreak}
              title="Add section break"
            >
              <Layers size={18} />
            </button>
          </div>
        </div>

      <!-- ================= TAB 2: RESPONSES ================= -->
      {:else if activeTab === 'responses'}
        <ResponsesView
          bind:form
          on:change={handleFormChange}
          on:linkToSheets={(e) => dispatch('linkToSheets', e.detail)}
          on:openPreview={() => (showPreviewModal = true)}
        />

      <!-- ================= TAB 3: SETTINGS ================= -->
      {:else if activeTab === 'settings'}
        <FormSettingsModal
          bind:settings={form.settings}
          isModal={false}
          on:change={handleFormChange}
        />
      {/if}
    </div>
  </div>

  <!-- INTERACTIVE LIVE PREVIEW MODAL -->
  {#if showPreviewModal}
    <FormPreviewModal
      bind:form
      on:close={() => (showPreviewModal = false)}
      on:submit={handleFormChange}
      on:change={handleFormChange}
    />
  {/if}

  <!-- SHARE / SEND FORM MODAL -->
  {#if showShareModal}
    <div class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div class="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6 space-y-5">
        <div class="flex items-center justify-between border-b border-slate-100 pb-3">
          <div class="flex items-center space-x-2">
            <Share2 size={18} class="text-[#673AB7]" />
            <h3 class="text-base font-bold text-slate-800">Send & Share Form</h3>
          </div>
          <button
            type="button"
            class="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            on:click={() => (showShareModal = false)}
          >
            <X size={18} />
          </button>
        </div>

        <div class="space-y-3">
          <span class="text-xs text-slate-500 block">Copy link to distribute form:</span>
          <div class="flex items-center space-x-2 bg-slate-50 border border-slate-200 rounded-lg p-2">
            <input
              type="text"
              readonly
              value="https://forms.google.office.local/{form.meta.id}"
              class="w-full bg-transparent text-xs text-slate-700 font-mono focus:outline-none"
            />
            <button
              type="button"
              class="px-3 py-1 bg-[#673AB7] text-white text-xs font-semibold rounded hover:bg-[#512DA8] transition-colors shrink-0"
              on:click={copyShareLink}
            >
              {copyNotification ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>

        <div class="pt-2 border-t border-slate-100 flex justify-between items-center text-xs">
          <button
            type="button"
            class="text-[#673AB7] hover:underline font-semibold flex items-center space-x-1"
            on:click={exportFormJson}
          >
            <Download size={14} />
            <span>Download JSON form backup</span>
          </button>
          <button
            type="button"
            class="px-4 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700"
            on:click={() => (showShareModal = false)}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- IMPORT QUESTIONS MODAL -->
  {#if showImportModal}
    <div class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div class="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6 space-y-4">
        <div class="flex items-center justify-between border-b border-slate-100 pb-3">
          <div class="flex items-center space-x-2">
            <Upload size={18} class="text-[#673AB7]" />
            <h3 class="text-base font-bold text-slate-800">Import Question Templates</h3>
          </div>
          <button
            type="button"
            class="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            on:click={() => (showImportModal = false)}
          >
            <X size={18} />
          </button>
        </div>

        <p class="text-xs text-slate-500">
          Choose a pre-built template to quickly append verified question sets into your form:
        </p>

        <div class="space-y-2 pt-1">
          <button
            type="button"
            class="w-full text-left p-3 rounded-xl border border-slate-200 hover:border-purple-300 hover:bg-purple-50/50 transition-colors space-y-0.5"
            on:click={() => importQuestions('satisfaction')}
          >
            <span class="text-xs font-bold text-slate-800 block">Customer Satisfaction & CSAT</span>
            <span class="text-[11px] text-slate-400">Includes linear scale (1-5), frequency radio, and feedback text.</span>
          </button>

          <button
            type="button"
            class="w-full text-left p-3 rounded-xl border border-slate-200 hover:border-purple-300 hover:bg-purple-50/50 transition-colors space-y-0.5"
            on:click={() => importQuestions('quiz')}
          >
            <span class="text-xs font-bold text-slate-800 block">Auto-Graded Multiple Choice Quiz</span>
            <span class="text-[11px] text-slate-400">Pre-configured with point values and answer key grading.</span>
          </button>

          <button
            type="button"
            class="w-full text-left p-3 rounded-xl border border-slate-200 hover:border-purple-300 hover:bg-purple-50/50 transition-colors space-y-0.5"
            on:click={() => importQuestions('event')}
          >
            <span class="text-xs font-bold text-slate-800 block">Event Registration & RSVP</span>
            <span class="text-[11px] text-slate-400">Includes name, dietary dropdown, and arrival date picker.</span>
          </button>
        </div>

        <div class="flex justify-end pt-2">
          <button
            type="button"
            class="px-4 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs"
            on:click={() => (showImportModal = false)}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>
