<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import type { Slide } from '../../types';
  import {
    ChevronLeft,
    ChevronRight,
    X,
    Clock,
    Play,
    Pause,
    RotateCcw,
    FileText,
    Target,
    PenTool,
    Eraser
  } from 'lucide-svelte';

  export let slides: Slide[];
  export let currentIndex: number = 0;

  const dispatch = createEventDispatcher<{
    close: void;
    changeSlide: number;
  }>();

  let timerSeconds = 0;
  let isTimerRunning = true;
  let timerInterval: number;
  let showNotes = false;

  // Presenter Tools (Google Slides style)
  let isLaserActive = false;
  let isPenActive = false;
  let mousePos = { x: 0, y: 0 };
  let annotationCanvas: HTMLCanvasElement | null = null;
  let isDrawing = false;

  $: currentSlide = slides[currentIndex] || slides[0];

  function formatTime(totalSec: number): string {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  function prevSlide() {
    if (currentIndex > 0) {
      clearAnnotations();
      currentIndex--;
      dispatch('changeSlide', currentIndex);
    }
  }

  function nextSlide() {
    if (currentIndex < slides.length - 1) {
      clearAnnotations();
      currentIndex++;
      dispatch('changeSlide', currentIndex);
    }
  }

  function clearAnnotations() {
    if (!annotationCanvas) return;
    const ctx = annotationCanvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, annotationCanvas.width, annotationCanvas.height);
  }

  function handleMouseMove(e: MouseEvent) {
    mousePos = { x: e.clientX, y: e.clientY };

    if (isPenActive && isDrawing && annotationCanvas) {
      const rect = annotationCanvas.getBoundingClientRect();
      const ctx = annotationCanvas.getContext('2d');
      if (ctx) {
        ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
        ctx.stroke();
      }
    }
  }

  function handleMouseDown(e: MouseEvent) {
    if (!isPenActive || !annotationCanvas) return;
    const rect = annotationCanvas.getBoundingClientRect();
    const ctx = annotationCanvas.getContext('2d');
    if (ctx) {
      isDrawing = true;
      ctx.beginPath();
      ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
    }
  }

  function handleMouseUp() {
    isDrawing = false;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
      e.preventDefault();
      nextSlide();
    } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
      e.preventDefault();
      prevSlide();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      dispatch('close');
    } else if (e.key.toLowerCase() === 'l') {
      isLaserActive = !isLaserActive;
      if (isLaserActive) isPenActive = false;
    } else if (e.key.toLowerCase() === 'p') {
      isPenActive = !isPenActive;
      if (isPenActive) isLaserActive = false;
    }
  }

  onMount(() => {
    timerInterval = window.setInterval(() => {
      if (isTimerRunning) timerSeconds++;
    }, 1000);
  });

  onDestroy(() => {
    window.clearInterval(timerInterval);
  });
</script>

<svelte:window
  on:keydown={handleKeydown}
  on:mousemove={handleMouseMove}
  on:mouseup={handleMouseUp}
/>

<!-- Fullscreen Presenter Mode Modal -->
<div class="fixed inset-0 z-50 bg-slate-950 text-white flex flex-col select-none cursor-default">
  <!-- Top Presenter Bar -->
  <div class="h-12 bg-slate-900/80 backdrop-blur border-b border-slate-800 px-6 flex items-center justify-between text-xs z-30">
    <!-- Timer Controls -->
    <div class="flex items-center space-x-3">
      <div class="flex items-center space-x-1.5 font-mono text-sm bg-slate-800 px-3 py-1 rounded border border-slate-700 text-orange-400 font-bold">
        <Clock size={15} />
        <span>{formatTime(timerSeconds)}</span>
      </div>
      <button
        class="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
        on:click={() => (isTimerRunning = !isTimerRunning)}
        title={isTimerRunning ? 'Pause timer' : 'Resume timer'}
      >
        {#if isTimerRunning}
          <Pause size={14} />
        {:else}
          <Play size={14} />
        {/if}
      </button>
      <button
        class="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
        on:click={() => (timerSeconds = 0)}
        title="Reset timer"
      >
        <RotateCcw size={14} />
      </button>
    </div>

    <!-- Presentation Tools: Laser Pointer & Pen Annotations -->
    <div class="flex items-center space-x-2">
      <button
        class="flex items-center space-x-1 px-2.5 py-1 rounded transition-colors {isLaserActive ? 'bg-rose-600 text-white font-bold' : 'hover:bg-slate-800 text-slate-400'}"
        on:click={() => {
          isLaserActive = !isLaserActive;
          if (isLaserActive) isPenActive = false;
        }}
        title="Laser Pointer (L)"
      >
        <Target size={14} />
        <span>Laser Pointer</span>
      </button>

      <button
        class="flex items-center space-x-1 px-2.5 py-1 rounded transition-colors {isPenActive ? 'bg-orange-600 text-white font-bold' : 'hover:bg-slate-800 text-slate-400'}"
        on:click={() => {
          isPenActive = !isPenActive;
          if (isPenActive) isLaserActive = false;
        }}
        title="Slide Pen Annotation (P)"
      >
        <PenTool size={14} />
        <span>Pen Draw</span>
      </button>

      {#if isPenActive}
        <button
          class="flex items-center space-x-1 px-2 py-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
          on:click={clearAnnotations}
          title="Clear Ink Annotations"
        >
          <Eraser size={14} />
          <span>Clear</span>
        </button>
      {/if}
    </div>

    <!-- Slide Index -->
    <div class="font-medium text-slate-300">
      Slide <span class="text-orange-400 font-bold">{currentIndex + 1}</span> of {slides.length}
    </div>

    <!-- Actions & Exit -->
    <div class="flex items-center space-x-2">
      <button
        class="flex items-center space-x-1 px-2.5 py-1 rounded hover:bg-slate-800 text-slate-300 transition-colors {showNotes ? 'bg-slate-800 text-orange-400' : ''}"
        on:click={() => (showNotes = !showNotes)}
      >
        <FileText size={14} />
        <span>Notes</span>
      </button>
      <button
        class="p-1.5 rounded-full hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors"
        on:click={() => dispatch('close')}
        title="Exit Presenter View (Esc)"
      >
        <X size={18} />
      </button>
    </div>
  </div>

  <!-- Center Presentation Stage -->
  <div class="flex-1 flex items-center justify-center p-8 relative overflow-hidden">
    <!-- Left Navigation Arrow -->
    <button
      class="absolute left-6 z-20 w-12 h-12 rounded-full bg-slate-900/60 hover:bg-slate-800 border border-slate-700 flex items-center justify-center text-white transition-all disabled:opacity-20"
      disabled={currentIndex === 0}
      on:click={prevSlide}
    >
      <ChevronLeft size={24} />
    </button>

    <!-- Right Navigation Arrow -->
    <button
      class="absolute right-6 z-20 w-12 h-12 rounded-full bg-slate-900/60 hover:bg-slate-800 border border-slate-700 flex items-center justify-center text-white transition-all disabled:opacity-20"
      disabled={currentIndex === slides.length - 1}
      on:click={nextSlide}
    >
      <ChevronRight size={24} />
    </button>

    <!-- Slide Canvas Render Container with Transitions -->
    <div
      class="w-[1020px] aspect-video rounded-2xl shadow-2xl relative overflow-hidden transition-all border border-slate-800 p-8 {currentSlide.transition?.type === 'zoom' ? 'animate-in zoom-in-90' : currentSlide.transition?.type === 'slide-left' ? 'animate-in slide-in-from-right' : currentSlide.transition?.type === 'slide-right' ? 'animate-in slide-in-from-left' : 'animate-in fade-in'} duration-300"
      style="background-color: {currentSlide.bgColor}; color: {currentSlide.bgColor === '#ffffff' || currentSlide.bgColor === '#f8fafc' ? '#0f172a' : '#ffffff'};"
      on:mousedown={handleMouseDown}
    >
      <!-- Pen Annotation Canvas Layer -->
      <canvas
        bind:this={annotationCanvas}
        width="1020"
        height="574"
        class="absolute inset-0 z-20 {isPenActive ? 'cursor-crosshair pointer-events-auto' : 'pointer-events-none'}"
      ></canvas>

      <!-- Elements -->
      {#each currentSlide.elements as elem}
        <div
          class="absolute p-4 z-10"
          style="
            left: {elem.x}%;
            top: {elem.y}%;
            width: {elem.width}%;
            min-height: {elem.height}%;
            background-color: {elem.bgColor || 'transparent'};
            color: {elem.fontColor || 'inherit'};
          "
        >
          {#if elem.type === 'title'}
            <h1 class="text-4xl font-extrabold tracking-tight">{elem.content}</h1>
          {:else if elem.type === 'text'}
            <p class="text-xl leading-relaxed whitespace-pre-wrap">{elem.content}</p>
          {:else if elem.type === 'stat'}
            <div class="w-full h-full bg-slate-500/10 border-2 border-slate-400/30 rounded-xl p-4 flex flex-col items-center justify-center text-center">
              <div class="text-4xl font-black text-orange-500">{elem.content}</div>
              <div class="text-xs uppercase tracking-wider font-semibold opacity-75 mt-1">Metric Callout</div>
            </div>
          {:else if elem.type === 'shape'}
            <div class="w-full h-full bg-slate-500/10 border-2 border-slate-400/30 rounded-xl p-4 flex items-center justify-center font-bold text-2xl">
              {elem.content}
            </div>
          {:else if elem.type === 'code'}
            <pre class="bg-slate-900 text-emerald-400 rounded-xl p-4 font-mono text-sm leading-relaxed overflow-x-auto shadow-inner">{elem.content}</pre>
          {:else if elem.type === 'table'}
            <div class="w-full bg-white rounded-xl shadow p-2 text-slate-800">
              <table class="w-full border-collapse text-xs">
                <thead>
                  <tr class="bg-slate-100 border-b border-slate-300">
                    {#each (elem.tableData?.cells[0] || ['Feature', 'Description', 'Status']) as header}
                      <th class="p-2 text-left font-bold border-r border-slate-200">{header}</th>
                    {/each}
                  </tr>
                </thead>
                <tbody>
                  {#each (elem.tableData?.cells.slice(1) || [['Docs', 'Word processor', 'Ready'], ['Sheets', 'Spreadsheets', 'Ready']]) as row}
                    <tr class="border-b border-slate-200">
                      {#each row as cell}
                        <td class="p-2 border-r border-slate-200">{cell}</td>
                      {/each}
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {:else if elem.type === 'chart'}
            <div class="w-full h-full bg-white rounded-xl p-4 shadow text-slate-800 flex flex-col justify-between">
              <div class="font-bold text-sm text-slate-800">{elem.chartData?.title || 'Performance Metric'}</div>
              <div class="flex items-end justify-around h-32 pt-4">
                {#each (elem.chartData?.labels || ['Q1', 'Q2', 'Q3', 'Q4']) as label, idx}
                  {@const val = (elem.chartData?.values || [45, 80, 65, 95])[idx] || 50}
                  {@const max = Math.max(...(elem.chartData?.values || [100]))}
                  {@const heightPercent = Math.max(15, Math.min(100, Math.round((val / max) * 100)))}
                  <div class="flex flex-col items-center flex-1 h-full justify-end">
                    <div class="text-[10px] font-bold text-slate-600 mb-0.5">{val}</div>
                    <div
                      class="w-10 rounded-t-md shadow-xs"
                      style="height: {heightPercent}%; background: {(elem.chartData?.colors || ['#f97316', '#3b82f6', '#10b981', '#8b5cf6'])[idx % 4]};"
                    ></div>
                    <div class="text-[11px] text-slate-500 font-semibold mt-1">{label}</div>
                  </div>
                {/each}
              </div>
            </div>
          {:else if elem.type === 'image'}
            {#if elem.content && elem.content.startsWith('data:image')}
              <img src={elem.content} alt="Slide media" class="w-full h-auto object-cover rounded-xl" />
            {:else}
              <div class="w-full h-44 bg-slate-500/10 border-2 border-dashed border-slate-400/40 rounded-xl flex items-center justify-center text-sm font-semibold opacity-70">
                {elem.content || 'Image Placeholder'}
              </div>
            {/if}
          {/if}
        </div>
      {/each}
    </div>

    <!-- Laser Pointer Floating Dot Layer -->
    {#if isLaserActive}
      <div
        class="pointer-events-none fixed w-4 h-4 rounded-full bg-rose-500 shadow-[0_0_12px_4px_rgba(244,63,94,0.9)] z-50 -translate-x-1/2 -translate-y-1/2 transition-transform duration-75"
        style="left: {mousePos.x}px; top: {mousePos.y}px;"
      ></div>
    {/if}
  </div>

  <!-- Optional Speaker Notes Bar -->
  {#if showNotes}
    <div class="h-32 bg-slate-900 border-t border-slate-800 px-8 py-3 text-xs text-slate-300">
      <div class="font-bold text-orange-400 mb-1">Speaker Notes:</div>
      <p class="leading-relaxed">{currentSlide.notes || 'No notes for this slide.'}</p>
    </div>
  {/if}
</div>
