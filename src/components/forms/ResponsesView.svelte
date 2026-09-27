<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { FormDocument, FormResponse, FormQuestion } from '../../types';
  import {
    Sheet,
    Trash2,
    Download,
    Printer,
    ChevronLeft,
    ChevronRight,
    Users,
    BarChart3,
    PieChart,
    Layers,
    Clock,
    Calendar,
    Award,
    CheckCircle2,
    FileSpreadsheet,
    Eye,
    MoreVertical,
    FileText,
    RefreshCw
  } from 'lucide-svelte';
  import { downloadFile } from '../../lib/utils';

  export let form: FormDocument;

  const dispatch = createEventDispatcher<{
    change: void;
    linkToSheets: {
      headers: string[];
      rows: (string | number)[][];
      formTitle: string;
    };
    openPreview: void;
  }>();

  type ResponseSubTab = 'summary' | 'question' | 'individual';
  let activeSubTab: ResponseSubTab = 'summary';

  let selectedQuestionIndex = 0;
  let selectedResponseIndex = 0;
  let showMoreMenu = false;

  const CHART_COLORS = [
    '#4285F4', // Blue
    '#EA4335', // Red
    '#FBBC05', // Yellow
    '#34A853', // Green
    '#9C27B0', // Purple
    '#FF9800', // Orange
    '#00BCD4', // Cyan
    '#E91E63', // Pink
    '#607D8B', // Blue Grey
    '#3F51B5', // Indigo
  ];

  function toggleAcceptingResponses() {
    form.acceptingResponses = !form.acceptingResponses;
    dispatch('change');
  }

  function clearAllResponses() {
    if (confirm('Are you sure you want to delete all responses? This cannot be undone.')) {
      form.responses = [];
      selectedResponseIndex = 0;
      dispatch('change');
    }
  }

  // Generate CSV and data for "Link to Sheets"
  function getResponsesTableData(): { headers: string[]; rows: (string | number)[][] } {
    const headers = ['Timestamp', ...(form.settings.collectEmail ? ['Email Address'] : [])];
    if (form.settings.isQuiz) {
      headers.push('Score');
    }
    for (const q of form.questions) {
      headers.push(q.title || 'Question');
    }

    const rows: (string | number)[][] = [];
    for (const resp of form.responses) {
      const row: (string | number)[] = [
        new Date(resp.submittedAt).toLocaleString(),
        ...(form.settings.collectEmail ? [resp.respondentEmail || ''] : []),
      ];
      if (form.settings.isQuiz) {
        row.push(`${resp.score || 0} / ${resp.maxScore || 0}`);
      }
      for (const q of form.questions) {
        const val = resp.answers[q.id];
        if (Array.isArray(val)) {
          row.push(val.join('; '));
        } else if (val !== undefined && val !== null) {
          row.push(String(val));
        } else {
          row.push('');
        }
      }
      rows.push(row);
    }

    return { headers, rows };
  }

  function handleLinkToSheets() {
    const tableData = getResponsesTableData();
    dispatch('linkToSheets', {
      headers: tableData.headers,
      rows: tableData.rows,
      formTitle: form.title || 'Form Responses',
    });
  }

  function handleDownloadCsv() {
    const { headers, rows } = getResponsesTableData();
    const csvContent = [
      headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(','),
      ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    downloadFile(
      `${(form.title || 'Form').toLowerCase().replace(/\s+/g, '_')}_responses.csv`,
      csvContent,
      'text/csv;charset=utf-8;'
    );
  }

  // Calculate aggregation for multiple choice / dropdown / checkboxes
  function getOptionCounts(question: FormQuestion): { label: string; count: number; pct: number }[] {
    const counts: Record<string, number> = {};
    const totalResponses = form.responses.length;
    if (totalResponses === 0) return [];

    let totalSelected = 0;
    for (const resp of form.responses) {
      const ans = resp.answers[question.id];
      if (Array.isArray(ans)) {
        for (const item of ans) {
          counts[item] = (counts[item] || 0) + 1;
          totalSelected++;
        }
      } else if (ans !== undefined && ans !== null && ans !== '') {
        const str = String(ans);
        counts[str] = (counts[str] || 0) + 1;
        totalSelected++;
      }
    }

    // Ensure options are represented even if 0
    if (question.options) {
      for (const opt of question.options) {
        if (!opt.isOther && counts[opt.text] === undefined) {
          counts[opt.text] = 0;
        }
      }
    }

    const divisor = question.type === 'checkboxes' ? totalResponses : (totalSelected || 1);

    return Object.entries(counts).map(([label, count]) => ({
      label,
      count,
      pct: Math.round((count / divisor) * 100),
    }));
  }

  // Linear scale frequency
  function getLinearScaleDistribution(question: FormQuestion) {
    const min = question.scaleMin ?? 1;
    const max = question.scaleMax ?? 5;
    const dist: { num: number; count: number; pct: number }[] = [];
    const totalResponses = form.responses.length;

    for (let i = min; i <= max; i++) {
      let c = 0;
      for (const resp of form.responses) {
        if (Number(resp.answers[question.id]) === i) {
          c++;
        }
      }
      dist.push({
        num: i,
        count: c,
        pct: totalResponses > 0 ? Math.round((c / totalResponses) * 100) : 0,
      });
    }

    return dist;
  }

  // Text answers list
  function getTextAnswers(questionId: string): string[] {
    const list: string[] = [];
    for (const resp of form.responses) {
      const val = resp.answers[questionId];
      if (val !== undefined && val !== null && String(val).trim()) {
        list.push(String(val).trim());
      }
    }
    return list;
  }
</script>

<div class="space-y-5 animate-in fade-in duration-150">
  <!-- Top Summary Controls Card -->
  <div class="bg-white rounded-xl shadow-xs border border-slate-200/80 p-6 space-y-4">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <div class="flex items-center space-x-3">
          <h2 class="text-2xl font-bold text-slate-800 tracking-tight">
            {form.responses.length} {form.responses.length === 1 ? 'response' : 'responses'}
          </h2>
          {#if form.acceptingResponses}
            <span class="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 flex items-center space-x-1">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Accepting responses</span>
            </span>
          {:else}
            <span class="text-[11px] font-semibold text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200">
              Not accepting responses
            </span>
          {/if}
        </div>
        <p class="text-xs text-slate-400 mt-1">Automatic real-time summary aggregation</p>
      </div>

      <!-- Quick Action Buttons -->
      <div class="flex items-center space-x-2">
        <!-- Accepting responses toggle -->
        <div class="flex items-center space-x-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
          <span class="text-xs text-slate-600 font-medium">Accepting</span>
          <button
            type="button"
            class="w-9 h-5 flex items-center rounded-full p-0.5 transition-colors {form.acceptingResponses ? 'bg-[#673AB7]' : 'bg-slate-300'}"
            on:click={toggleAcceptingResponses}
          >
            <div
              class="bg-white w-4 h-4 rounded-full shadow-xs transform transition-transform {form.acceptingResponses ? 'translate-x-4' : 'translate-x-0'}"
            ></div>
          </button>
        </div>

        <!-- Link to Google Sheets button -->
        <button
          type="button"
          class="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-semibold shadow-2xs transition-colors"
          on:click={handleLinkToSheets}
          title="Open or link response data in Google Sheets"
        >
          <Sheet size={15} class="text-emerald-600" />
          <span>Link to Sheets</span>
        </button>

        <!-- More options button -->
        <div class="relative">
          <button
            type="button"
            class="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
            on:click|stopPropagation={() => (showMoreMenu = !showMoreMenu)}
            title="More actions"
          >
            <MoreVertical size={15} />
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
                class="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center space-x-2 text-slate-700"
                on:click={() => {
                  handleDownloadCsv();
                  showMoreMenu = false;
                }}
              >
                <Download size={14} class="text-slate-400" />
                <span>Download responses (.csv)</span>
              </button>

              <button
                type="button"
                class="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center space-x-2 text-slate-700"
                on:click={() => {
                  handleLinkToSheets();
                  showMoreMenu = false;
                }}
              >
                <FileSpreadsheet size={14} class="text-emerald-600" />
                <span>Export to Spreadsheet</span>
              </button>

              <div class="h-px bg-slate-100 my-1"></div>

              <button
                type="button"
                class="w-full px-3 py-2 text-left hover:bg-rose-50 flex items-center space-x-2 text-rose-600"
                on:click={() => {
                  clearAllResponses();
                  showMoreMenu = false;
                }}
              >
                <Trash2 size={14} class="text-rose-500" />
                <span>Delete all responses</span>
              </button>
            </div>
          {/if}
        </div>
      </div>
    </div>

    <!-- Secondary Sub-Navigation Tabs: Summary, Question, Individual -->
    {#if form.responses.length > 0}
      <div class="flex items-center space-x-1 border-t border-slate-100 pt-3">
        <button
          type="button"
          class="px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors {activeSubTab === 'summary'
            ? 'bg-purple-100 text-[#673AB7]'
            : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'}"
          on:click={() => (activeSubTab = 'summary')}
        >
          Summary
        </button>
        <button
          type="button"
          class="px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors {activeSubTab === 'question'
            ? 'bg-purple-100 text-[#673AB7]'
            : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'}"
          on:click={() => (activeSubTab = 'question')}
        >
          Question
        </button>
        <button
          type="button"
          class="px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors {activeSubTab === 'individual'
            ? 'bg-purple-100 text-[#673AB7]'
            : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'}"
          on:click={() => (activeSubTab = 'individual')}
        >
          Individual
        </button>
      </div>
    {/if}
  </div>

  <!-- EMPTY STATE: No Responses Yet -->
  {#if form.responses.length === 0}
    <div class="bg-white rounded-xl shadow-xs border border-slate-200/80 p-12 text-center space-y-4">
      <div class="w-16 h-16 rounded-full bg-purple-50 text-[#673AB7] flex items-center justify-center mx-auto border border-purple-100">
        <Users size={32} />
      </div>
      <div class="space-y-1">
        <h3 class="text-base font-semibold text-slate-800">Waiting for responses</h3>
        <p class="text-xs text-slate-500 max-w-sm mx-auto">
          Share your form or open the interactive preview to submit the first response and view real-time analytical charts.
        </p>
      </div>
      <div class="pt-2">
        <button
          type="button"
          class="px-5 py-2 rounded-lg bg-[#673AB7] hover:bg-[#512DA8] text-white text-xs font-semibold shadow-xs transition-colors"
          on:click={() => dispatch('openPreview')}
        >
          Fill out form in Preview
        </button>
      </div>
    </div>

  <!-- SUBTAB 1: SUMMARY (Analytical Charts) -->
  {:else if activeSubTab === 'summary'}
    <!-- Quiz Insights Card if enabled -->
    {#if form.settings.isQuiz}
      {@const scores = form.responses.map((r) => r.score || 0)}
      {@const avgScore = (scores.reduce((a, b) => a + b, 0) / (scores.length || 1)).toFixed(1)}
      {@const maxPts = form.questions.reduce((sum, q) => sum + (q.points || 0), 0)}
      <div class="bg-white rounded-xl shadow-xs border border-slate-200/80 p-6 space-y-4">
        <div class="flex items-center space-x-2 text-sm font-bold text-slate-800">
          <Award size={18} class="text-[#673AB7]" />
          <span>Insights: Quiz Scores</span>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
          <div class="bg-purple-50/60 border border-purple-100 rounded-xl p-4 text-center">
            <span class="text-[11px] text-slate-500 font-medium block">Average</span>
            <span class="text-2xl font-black text-[#673AB7] font-mono">{avgScore} / {maxPts}</span>
            <span class="text-[10px] text-slate-400 block mt-0.5">points</span>
          </div>

          <div class="bg-purple-50/60 border border-purple-100 rounded-xl p-4 text-center">
            <span class="text-[11px] text-slate-500 font-medium block">Median</span>
            <span class="text-2xl font-black text-[#673AB7] font-mono">
              {scores.sort((a, b) => a - b)[Math.floor(scores.length / 2)] || 0} / {maxPts}
            </span>
            <span class="text-[10px] text-slate-400 block mt-0.5">points</span>
          </div>

          <div class="bg-purple-50/60 border border-purple-100 rounded-xl p-4 text-center">
            <span class="text-[11px] text-slate-500 font-medium block">Range</span>
            <span class="text-2xl font-black text-[#673AB7] font-mono">
              {Math.min(...scores)} – {Math.max(...scores)}
            </span>
            <span class="text-[10px] text-slate-400 block mt-0.5">points</span>
          </div>
        </div>
      </div>
    {/if}

    <!-- Cards for each question -->
    <div class="space-y-4">
      {#each form.questions as question, qIdx}
        <div class="bg-white rounded-xl shadow-xs border border-slate-200/80 p-6 space-y-4">
          <div class="flex items-start justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 class="text-sm font-semibold text-slate-800 leading-snug">{question.title || `Question ${qIdx + 1}`}</h3>
              <span class="text-[11px] text-slate-400">{form.responses.length} responses</span>
            </div>
            <span class="text-[10px] font-semibold uppercase text-slate-400 bg-slate-100 px-2 py-0.5 rounded tracking-wider">
              {question.type.replace('_', ' ')}
            </span>
          </div>

          <!-- CHART CONTENT BY QUESTION TYPE -->
          <div>
            <!-- Multiple Choice & Dropdown: SVG Donut Chart -->
            {#if question.type === 'multiple_choice' || question.type === 'dropdown'}
              {@const data = getOptionCounts(question)}
              {@const totalCount = data.reduce((sum, item) => sum + item.count, 0) || 1}
              {@const r = 36}
              {@const circ = 2 * Math.PI * 36}
              <div class="flex flex-col md:flex-row items-center justify-around gap-6 py-2">
                <!-- SVG Donut Chart -->
                <div class="relative w-44 h-44 shrink-0">
                  <svg viewBox="0 0 100 100" class="w-full h-full transform -rotate-90">
                    <!-- Background Circle -->
                    <circle cx="50" cy="50" {r} fill="transparent" stroke="#f1f5f9" stroke-width="18" />

                    <!-- Arc Segments -->
                    {#each data as slice, sIdx}
                      {@const dash = (slice.count / totalCount) * circ}
                      {@const prevTotal = data.slice(0, sIdx).reduce((acc, curr) => acc + curr.count, 0)}
                      {@const offset = (prevTotal / totalCount) * circ}
                      {#if slice.count > 0}
                        <circle
                          cx="50"
                          cy="50"
                          {r}
                          fill="transparent"
                          stroke={CHART_COLORS[sIdx % CHART_COLORS.length]}
                          stroke-width="18"
                          stroke-dasharray={`${dash} ${circ - dash}`}
                          stroke-dashoffset={-offset}
                          class="transition-all duration-300 hover:opacity-85"
                        />
                      {/if}
                    {/each}
                  </svg>
                  <div class="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                    <span class="text-xl font-black text-slate-800 font-mono">{form.responses.length}</span>
                    <span class="text-[9px] uppercase font-bold text-slate-400">Total</span>
                  </div>
                </div>

                <!-- Legend & Percentages List -->
                <div class="flex-1 w-full space-y-2">
                  {#each data as item, iIdx}
                    <div class="flex items-center justify-between text-xs py-1 px-2 rounded-lg hover:bg-slate-50 transition-colors">
                      <div class="flex items-center space-x-2.5 truncate max-w-[240px]">
                        <span class="w-3 h-3 rounded-full shrink-0" style="background-color: {CHART_COLORS[iIdx % CHART_COLORS.length]}"></span>
                        <span class="text-slate-700 font-medium truncate">{item.label}</span>
                      </div>
                      <div class="flex items-center space-x-3 shrink-0 font-mono text-[11px]">
                        <span class="text-slate-400">{item.count}</span>
                        <span class="font-bold text-slate-800 w-10 text-right">{item.pct}%</span>
                      </div>
                    </div>
                  {/each}
                </div>
              </div>

            <!-- Checkboxes: Horizontal Bar Chart -->
            {:else if question.type === 'checkboxes'}
              {@const data = getOptionCounts(question)}
              <div class="space-y-3 py-2">
                {#each data as item, bIdx}
                  <div class="space-y-1">
                    <div class="flex items-center justify-between text-xs">
                      <span class="text-slate-700 font-medium truncate max-w-sm">{item.label}</span>
                      <span class="text-slate-500 font-mono text-[11px]">{item.count} ({item.pct}%)</span>
                    </div>
                    <!-- Bar Track -->
                    <div class="w-full h-4 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        class="h-full rounded-full transition-all duration-500"
                        style="width: {item.pct}%; background-color: {CHART_COLORS[bIdx % CHART_COLORS.length]};"
                      ></div>
                    </div>
                  </div>
                {/each}
              </div>

            <!-- Linear Scale: Column Chart -->
            {:else if question.type === 'linear_scale'}
              {@const scaleData = getLinearScaleDistribution(question)}
              <div class="py-4">
                <div class="flex items-end justify-between gap-3 h-36 border-b border-slate-200 px-4">
                  {#each scaleData as item}
                    <div class="flex-1 flex flex-col items-center justify-end h-full group">
                      <span class="text-[10px] text-slate-500 font-mono mb-1">{item.count}</span>
                      <div
                        class="w-full max-w-[42px] bg-[#673AB7] hover:bg-[#512DA8] rounded-t-md transition-all duration-300 min-h-[4px]"
                        style="height: {Math.max(4, (item.count / (form.responses.length || 1)) * 100)}%;"
                      ></div>
                    </div>
                  {/each}
                </div>

                <!-- Column Labels -->
                <div class="flex items-center justify-between gap-3 px-4 pt-2">
                  {#each scaleData as item}
                    <div class="flex-1 text-center font-mono text-xs font-bold text-slate-700">
                      {item.num}
                    </div>
                  {/each}
                </div>

                {#if question.scaleMinLabel || question.scaleMaxLabel}
                  <div class="flex items-center justify-between text-[11px] text-slate-400 px-4 pt-1">
                    <span>{question.scaleMinLabel || ''}</span>
                    <span>{question.scaleMaxLabel || ''}</span>
                  </div>
                {/if}
              </div>

            <!-- Short Answer, Paragraph, Date, Time: Text Answers List -->
            {:else}
              {@const textList = getTextAnswers(question.id)}
              {#if textList.length > 0}
                <div class="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {#each textList as answerText, aIdx}
                    <div class="p-3 rounded-lg bg-[#f8f9fa] border border-slate-200/60 text-xs text-slate-800 leading-relaxed flex items-start space-x-2">
                      <span class="text-slate-400 font-mono text-[10px] w-4 shrink-0">{aIdx + 1}.</span>
                      <span class="flex-1">{answerText}</span>
                    </div>
                  {/each}
                </div>
              {:else}
                <span class="text-xs text-slate-400 italic">No text answers provided yet.</span>
              {/if}
            {/if}
          </div>
        </div>
      {/each}
    </div>

  <!-- SUBTAB 2: QUESTION VIEW -->
  {:else if activeSubTab === 'question'}
    {@const currentQ = form.questions[selectedQuestionIndex]}
    <div class="bg-white rounded-xl shadow-xs border border-slate-200/80 p-6 space-y-4">
      <!-- Question Navigator -->
      <div class="flex items-center justify-between border-b border-slate-100 pb-4">
        <div class="flex items-center space-x-2">
          <button
            type="button"
            disabled={selectedQuestionIndex === 0}
            class="p-1 rounded hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent text-slate-600"
            on:click={() => selectedQuestionIndex--}
          >
            <ChevronLeft size={18} />
          </button>
          <span class="text-xs font-semibold text-slate-700 font-mono">
            Question {selectedQuestionIndex + 1} of {form.questions.length}
          </span>
          <button
            type="button"
            disabled={selectedQuestionIndex === form.questions.length - 1}
            class="p-1 rounded hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent text-slate-600"
            on:click={() => selectedQuestionIndex++}
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <select
          bind:value={selectedQuestionIndex}
          class="bg-slate-50 border border-slate-200 text-xs text-slate-700 rounded-lg px-2.5 py-1.5 focus:outline-none"
        >
          {#each form.questions as q, idx}
            <option value={idx}>{idx + 1}. {q.title || 'Untitled'}</option>
          {/each}
        </select>
      </div>

      <!-- Current Question Details -->
      {#if currentQ}
        <div class="space-y-3">
          <h3 class="text-base font-bold text-slate-800">{currentQ.title || 'Untitled'}</h3>

          <!-- Answers for this question -->
          <div class="space-y-2 pt-2">
            {#each form.responses as resp, rIdx}
              {@const ans = resp.answers[currentQ.id]}
              <div class="p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 flex items-center justify-between">
                <div class="space-y-0.5">
                  <span class="font-semibold block">
                    {Array.isArray(ans) ? ans.join(', ') : (ans ?? '<No answer>')}
                  </span>
                  {#if resp.respondentEmail}
                    <span class="text-[10px] text-slate-400">{resp.respondentEmail}</span>
                  {/if}
                </div>
                <span class="text-[10px] text-slate-400 font-mono">
                  {new Date(resp.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            {/each}
          </div>
        </div>
      {/if}
    </div>

  <!-- SUBTAB 3: INDIVIDUAL VIEW -->
  {:else if activeSubTab === 'individual'}
    {@const currentResp = form.responses[selectedResponseIndex]}
    <div class="bg-white rounded-xl shadow-xs border border-slate-200/80 p-6 space-y-5">
      <!-- Paginator Header -->
      <div class="flex items-center justify-between border-b border-slate-100 pb-4">
        <div class="flex items-center space-x-2">
          <button
            type="button"
            disabled={selectedResponseIndex === 0}
            class="p-1 rounded hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent text-slate-600"
            on:click={() => selectedResponseIndex--}
          >
            <ChevronLeft size={18} />
          </button>
          <span class="text-xs font-semibold text-slate-700 font-mono">
            {selectedResponseIndex + 1} of {form.responses.length}
          </span>
          <button
            type="button"
            disabled={selectedResponseIndex === form.responses.length - 1}
            class="p-1 rounded hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent text-slate-600"
            on:click={() => selectedResponseIndex++}
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <div class="flex items-center space-x-3 text-xs text-slate-500 font-mono">
          {#if currentResp?.respondentEmail}
            <span class="text-[#673AB7] font-semibold">{currentResp.respondentEmail}</span>
            <span>•</span>
          {/if}
          <span>{currentResp ? new Date(currentResp.submittedAt).toLocaleString() : ''}</span>
        </div>
      </div>

      <!-- Display all answers for this specific response -->
      {#if currentResp}
        <div class="space-y-4">
          {#each form.questions as q, idx}
            {@const ans = currentResp.answers[q.id]}
            <div class="p-4 rounded-xl bg-slate-50/70 border border-slate-200/80 space-y-1.5">
              <span class="text-xs font-semibold text-slate-700 block">{idx + 1}. {q.title || 'Untitled'}</span>
              <div class="text-xs text-slate-900 font-medium pl-3 border-l-2 border-[#673AB7]">
                {#if Array.isArray(ans)}
                  <ul class="list-disc list-inside space-y-0.5">
                    {#each ans as item}
                      <li>{item}</li>
                    {/each}
                  </ul>
                {:else if ans !== undefined && ans !== null && ans !== ''}
                  <span>{ans}</span>
                {:else}
                  <span class="text-slate-400 italic">No answer</span>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {/if}
</div>
