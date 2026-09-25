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
    FileText
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

  $: currentSlide = slides[currentIndex] || slides[0];

  function formatTime(totalSec: number): string {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  function prevSlide() {
    if (currentIndex > 0) {
      currentIndex--;
      dispatch('changeSlide', currentIndex);
    }
  }

  function nextSlide() {
    if (currentIndex < slides.length - 1) {
      currentIndex++;
      dispatch('changeSlide', currentIndex);
    }
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

<svelte:window on:keydown={handleKeydown} />

<!-- Fullscreen Presenter Mode Modal -->
<div class="fixed inset-0 z-50 bg-slate-950 text-white flex flex-col select-none">
  <!-- Top Presenter Bar -->
  <div class="h-12 bg-slate-900/80 backdrop-blur border-b border-slate-800 px-6 flex items-center justify-between text-xs">
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
      class="absolute left-6 z-10 w-12 h-12 rounded-full bg-slate-900/60 hover:bg-slate-800 border border-slate-700 flex items-center justify-center text-white transition-all disabled:opacity-20"
      disabled={currentIndex === 0}
      on:click={prevSlide}
    >
      <ChevronLeft size={24} />
    </button>

    <!-- Right Navigation Arrow -->
    <button
      class="absolute right-6 z-10 w-12 h-12 rounded-full bg-slate-900/60 hover:bg-slate-800 border border-slate-700 flex items-center justify-center text-white transition-all disabled:opacity-20"
      disabled={currentIndex === slides.length - 1}
      on:click={nextSlide}
    >
      <ChevronRight size={24} />
    </button>

    <!-- Slide Canvas Render -->
    <div
      class="w-[1020px] aspect-video rounded-2xl shadow-2xl relative overflow-hidden transition-all border border-slate-800 p-8"
      style="background-color: {currentSlide.bgColor}; color: {currentSlide.bgColor === '#ffffff' || currentSlide.bgColor === '#f8fafc' ? '#0f172a' : '#ffffff'};"
    >
      {#each currentSlide.elements as elem}
        <div
          class="absolute p-4"
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
          {:else if elem.type === 'shape'}
            <div class="w-full h-full bg-slate-500/10 border-2 border-slate-400/30 rounded-xl p-4 flex items-center justify-center font-bold text-2xl">
              {elem.content}
            </div>
          {:else if elem.type === 'code'}
            <pre class="bg-slate-900 text-emerald-400 rounded-xl p-4 font-mono text-sm leading-relaxed overflow-x-auto shadow-inner">{elem.content}</pre>
          {:else if elem.type === 'image'}
            <div class="w-full h-44 bg-slate-500/10 border-2 border-dashed border-slate-400/40 rounded-xl flex items-center justify-center text-sm font-semibold opacity-70">
              {elem.content || 'Image Placeholder'}
            </div>
          {/if}
        </div>
      {/each}
    </div>
  </div>

  <!-- Optional Speaker Notes Bar -->
  {#if showNotes}
    <div class="h-32 bg-slate-900 border-t border-slate-800 px-8 py-3 text-xs text-slate-300">
      <div class="font-bold text-orange-400 mb-1">Speaker Notes:</div>
      <p class="leading-relaxed">{currentSlide.notes || 'No notes for this slide.'}</p>
    </div>
  {/if}
</div>
