<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { PdfDocument, PdfFormField } from '../../types';
  import {
    ChevronLeft,
    ChevronRight,
    ZoomIn,
    ZoomOut,
    PenTool,
    Trash2,
    Download,
    Printer,
    RotateCw,
    Layers
  } from '@lucide/svelte';
  import { triggerPrintToPdf, downloadFile } from '../../lib/utils';

  export let doc: PdfDocument;

  const dispatch = createEventDispatcher<{
    change: void;
    updateStats: { page: number; totalPages: number };
  }>();

  let zoomLevel = 100;
  let rotation = 0;
  let activeFieldId: string | null = null;
  let showThumbnailSidebar = true;

  $: dispatch('updateStats', {
    page: doc.currentPage,
    totalPages: doc.pageCount,
  });

  function prevPage() {
    if (doc.currentPage > 1) {
      doc.currentPage--;
      dispatch('change');
    }
  }

  function nextPage() {
    if (doc.currentPage < doc.pageCount) {
      doc.currentPage++;
      dispatch('change');
    }
  }

  function zoomIn() {
    zoomLevel = Math.min(250, zoomLevel + 15);
  }

  function zoomOut() {
    zoomLevel = Math.max(50, zoomLevel - 15);
  }

  function resetZoom() {
    zoomLevel = 100;
  }

  function rotate() {
    rotation = (rotation + 90) % 360;
  }

  export function addFormField(type: PdfFormField['type']) {
    const newField: PdfFormField = {
      id: `field_${Date.now()}`,
      type,
      name: `${type.toUpperCase()} Field ${doc.formFields.length + 1}`,
      value: type === 'checkbox' ? false : '',
      x: 15,
      y: 20 + (doc.formFields.length * 10) % 60,
      width: type === 'checkbox' ? 5 : 40,
      height: type === 'checkbox' ? 4 : 6,
      page: doc.currentPage,
    };
    doc.formFields = [...doc.formFields, newField];
    doc.meta.isDirty = true;
    activeFieldId = newField.id;
    dispatch('change');
  }

  function deleteField(id: string) {
    doc.formFields = doc.formFields.filter((f) => f.id !== id);
    if (activeFieldId === id) activeFieldId = null;
    doc.meta.isDirty = true;
    dispatch('change');
  }

  function exportFormData() {
    const data: Record<string, any> = {};
    for (const f of doc.formFields) {
      data[f.name] = f.value;
    }
    const jsonStr = JSON.stringify(data, null, 2);
    downloadFile(`${doc.meta.title || 'document'}_form_data.json`, jsonStr, 'application/json');
  }

  function handlePrint() {
    triggerPrintToPdf(doc.meta.title || 'PDF Document');
  }
</script>

<div class="flex-1 flex h-full overflow-hidden bg-slate-900 select-none text-slate-200">
  <!-- Left: Thumbnail / Page Navigation Sidebar -->
  {#if showThumbnailSidebar}
    <aside class="w-52 bg-slate-950/80 border-r border-slate-800 flex flex-col p-3 overflow-y-auto shrink-0 select-none">
      <div class="flex items-center justify-between pb-2 mb-3 border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase tracking-wider">
        <span>Pages ({doc.pageCount})</span>
        <button
          class="text-slate-400 hover:text-white"
          on:click={() => (showThumbnailSidebar = false)}
          title="Collapse sidebar"
        >
          &times;
        </button>
      </div>

      <div class="space-y-3">
        {#each Array(doc.pageCount) as _, idx}
          {@const pNum = idx + 1}
          {@const isCur = pNum === doc.currentPage}
          <div
            role="button"
            tabindex="0"
            class="flex flex-col items-center p-2 rounded-lg cursor-pointer transition-all border
              {isCur ? 'border-rose-500 bg-rose-500/10 shadow-md ring-1 ring-rose-500' : 'border-slate-800 hover:border-slate-700 bg-slate-900/60'}"
            on:click={() => { doc.currentPage = pNum; dispatch('change'); }}
            on:keydown={(e) => { if (e.key === 'Enter') { doc.currentPage = pNum; dispatch('change'); } }}
          >
            <!-- Miniature Page Preview -->
            <div class="w-32 h-44 bg-white rounded shadow-xs p-2 text-[5px] text-slate-700 overflow-hidden font-mono leading-none pointer-events-none select-none">
              <div class="font-bold text-[6px] text-slate-900 mb-1 border-b border-slate-200 pb-0.5">
                {doc.title || 'PDF Document'} — Page {pNum}
              </div>
              <p class="text-slate-500 line-clamp-6">
                {doc.textContent ? doc.textContent.slice((pNum - 1) * 200, pNum * 200) : 'Standard document content, fillable fields, and embedded annotations.'}
              </p>
            </div>
            <span class="text-[11px] font-mono mt-1 text-slate-400 font-medium">Page {pNum}</span>
          </div>
        {/each}
      </div>
    </aside>
  {/if}

  <!-- Main Canvas Area -->
  <div class="flex-1 flex flex-col h-full overflow-hidden bg-slate-800/80">
    <!-- PDF Floating Sub-bar -->
    <div class="h-10 bg-slate-900/90 border-b border-slate-800 px-4 flex items-center justify-between text-xs text-slate-300">
      <div class="flex items-center space-x-2">
        {#if !showThumbnailSidebar}
          <button
            class="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            on:click={() => (showThumbnailSidebar = true)}
            title="Show Page Thumbnails"
          >
            <Layers size={14} />
          </button>
        {/if}

        <!-- Page Navigator -->
        <div class="flex items-center space-x-1 bg-slate-800 px-2 py-1 rounded-md border border-slate-700">
          <button
            class="p-0.5 rounded hover:bg-slate-700 text-slate-300 disabled:opacity-30"
            on:click={prevPage}
            disabled={doc.currentPage <= 1}
            title="Previous Page"
          >
            <ChevronLeft size={14} />
          </button>
          <span class="font-mono text-xs px-1">
            {doc.currentPage} / {doc.pageCount}
          </span>
          <button
            class="p-0.5 rounded hover:bg-slate-700 text-slate-300 disabled:opacity-30"
            on:click={nextPage}
            disabled={doc.currentPage >= doc.pageCount}
            title="Next Page"
          >
            <ChevronRight size={14} />
          </button>
        </div>

        <button class="p-1.5 rounded hover:bg-slate-800 text-slate-300" on:click={rotate} title="Rotate 90°">
          <RotateCw size={14} />
        </button>
      </div>

      <!-- Zoom Controls -->
      <div class="flex items-center space-x-1 bg-slate-800 px-2 py-0.5 rounded-md border border-slate-700">
        <button class="p-1 rounded hover:bg-slate-700 text-slate-300" on:click={zoomOut} title="Zoom Out">
          <ZoomOut size={13} />
        </button>
        <button class="font-mono text-[11px] px-1 hover:text-white" on:click={resetZoom} title="Reset Zoom">
          {zoomLevel}%
        </button>
        <button class="p-1 rounded hover:bg-slate-700 text-slate-300" on:click={zoomIn} title="Zoom In">
          <ZoomIn size={13} />
        </button>
      </div>

      <!-- Form Actions -->
      <div class="flex items-center space-x-2">
        <button
          class="flex items-center space-x-1 px-2.5 py-1 rounded bg-rose-600/80 hover:bg-rose-600 text-white font-medium text-xs shadow-sm transition-colors"
          on:click={exportFormData}
          title="Export filled form values to JSON"
        >
          <Download size={13} />
          <span>Export Data</span>
        </button>
        <button
          class="p-1.5 rounded hover:bg-slate-800 text-slate-300"
          on:click={handlePrint}
          title="Print / Save PDF"
        >
          <Printer size={14} />
        </button>
      </div>
    </div>

    <!-- PDF Viewer Scroll Area -->
    <div class="flex-1 overflow-auto p-8 flex items-center justify-center">
      <div
        class="bg-white text-slate-900 rounded-sm shadow-2xl transition-transform duration-150 origin-top relative"
        style="
          width: {620 * (zoomLevel / 100)}px;
          min-height: {870 * (zoomLevel / 100)}px;
          transform: rotate({rotation}deg);
        "
      >
        <!-- Page Content -->
        <div class="p-10 select-text font-serif">
          <div class="border-b border-slate-300 pb-3 mb-6 flex items-center justify-between">
            <h1 class="text-xl font-bold font-sans text-slate-900">
              {doc.title || 'Simple Office Suite PDF Document'}
            </h1>
            <span class="text-xs font-mono text-slate-500">Page {doc.currentPage} of {doc.pageCount}</span>
          </div>

          <div class="text-xs text-slate-700 leading-relaxed space-y-4">
            <p>
              This is the <strong>PDF &amp; form layout prototype</strong> in Simple Office Suite. It stores its own document state, adds text, checkbox, dropdown, and signature fields, and exports the field values as JSON.
            </p>
            <p>
              It does <strong>not</strong> parse or render arbitrary binary PDF files yet, and printing opens the host print dialog rather than generating a PDF directly. Use <strong>Forms</strong> in the ribbon to place fields on the page.
            </p>

            <div class="my-6 p-4 rounded-lg bg-slate-50 border border-slate-200">
              <h3 class="font-sans font-bold text-xs text-slate-900 uppercase tracking-wider mb-2">
                Document Form Summary
              </h3>
              <p class="text-[11px] text-slate-600">
                Total Form Fields: <span class="font-bold text-rose-600">{doc.formFields.length}</span>
              </p>
            </div>

            {#if doc.textContent}
              <div class="mt-4 whitespace-pre-wrap font-sans text-xs text-slate-600 bg-slate-50 p-4 rounded border border-slate-200">
                {doc.textContent}
              </div>
            {/if}
          </div>
        </div>

        <!-- Interactive Form Fields Overlay -->
        {#each doc.formFields as field (field.id)}
          {#if field.page === doc.currentPage}
            {@const isSelected = activeFieldId === field.id}
            <div
              class="absolute rounded border-2 transition-all p-1 group cursor-move
                {isSelected ? 'border-rose-500 bg-rose-50/50 shadow-md ring-2 ring-rose-200' : 'border-dashed border-rose-400/80 bg-rose-50/20 hover:border-rose-500'}"
              style="
                left: {field.x}%;
                top: {field.y}%;
                width: {field.width}%;
                min-height: {field.height}%;
              "
              on:click|stopPropagation={() => (activeFieldId = field.id)}
              role="presentation"
            >
              <div class="flex items-center justify-between mb-0.5">
                <span class="text-[9px] font-sans font-semibold text-rose-700 truncate">{field.name}</span>
                <button
                  class="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-600 p-0.5 transition-opacity"
                  on:click|stopPropagation={() => deleteField(field.id)}
                  title="Remove Field"
                >
                  <Trash2 size={10} />
                </button>
              </div>

              {#if field.type === 'text'}
                <input
                  type="text"
                  bind:value={field.value}
                  placeholder="Enter text..."
                  class="w-full px-1.5 py-0.5 bg-white border border-slate-300 rounded text-xs text-slate-900 outline-none focus:border-rose-500"
                />
              {:else if field.type === 'checkbox'}
                <label class="flex items-center space-x-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={field.value === true}
                    on:change={(e) => (field.value = (e.currentTarget as HTMLInputElement).checked)}
                    class="rounded text-rose-600 focus:ring-rose-500 w-3.5 h-3.5"
                  />
                  <span class="text-[11px] text-slate-700">Check to agree</span>
                </label>
              {:else if field.type === 'signature'}
                <div class="w-full h-8 bg-slate-50 border border-slate-300 rounded flex items-center justify-between px-2 text-slate-400 font-mono text-[10px]">
                  <span class="italic font-serif">{field.value || 'Click to sign...'}</span>
                  <PenTool size={12} class="text-rose-500" />
                </div>
              {:else}
                <input
                  type="text"
                  bind:value={field.value}
                  class="w-full px-1.5 py-0.5 bg-white border border-slate-300 rounded text-xs text-slate-900 outline-none"
                />
              {/if}
            </div>
          {/if}
        {/each}
      </div>
    </div>
  </div>
</div>
