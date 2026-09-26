<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { Slide, SlideElement } from '../../types';
  import { Code, Image as ImageIcon } from '@lucide/svelte';

  export let slide: Slide;
  export let selectedElementId: string | null = null;

  const dispatch = createEventDispatcher<{
    selectElement: string | null;
    elementChange: { id: string; content: string };
  }>();

  let isDragging = false;
  let dragElementId: string | null = null;
  let dragOffset = { x: 0, y: 0 };
  let canvasContainer: HTMLDivElement;

  function handleSelect(id: string, e: Event) {
    e.stopPropagation();
    selectedElementId = id;
    dispatch('selectElement', id);
  }

  function handleCanvasClick() {
    selectedElementId = null;
    dispatch('selectElement', null);
  }

  function handleMouseDown(elem: SlideElement, e: MouseEvent) {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    dragElementId = elem.id;
    isDragging = true;
    selectedElementId = elem.id;
    dispatch('selectElement', elem.id);

    const rect = canvasContainer.getBoundingClientRect();
    const elemX = (elem.x / 100) * rect.width;
    const elemY = (elem.y / 100) * rect.height;
    dragOffset = {
      x: e.clientX - rect.left - elemX,
      y: e.clientY - rect.top - elemY,
    };
  }

  function handleMouseMove(e: MouseEvent) {
    if (!isDragging || !dragElementId || !canvasContainer) return;
    const rect = canvasContainer.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const newX = Math.max(0, Math.min(85, ((mouseX - dragOffset.x) / rect.width) * 100));
    const newY = Math.max(0, Math.min(85, ((mouseY - dragOffset.y) / rect.height) * 100));

    const elem = slide.elements.find((el) => el.id === dragElementId);
    if (elem) {
      elem.x = Math.round(newX);
      elem.y = Math.round(newY);
      slide.elements = [...slide.elements];
    }
  }

  function handleMouseUp() {
    isDragging = false;
    dragElementId = null;
  }

  function handleContentInput(id: string, val: string) {
    const elem = slide.elements.find((el) => el.id === id);
    if (elem) {
      elem.content = val;
      if (elem.type === 'title') {
        slide.title = val;
      }
    }
    dispatch('elementChange', { id, content: val });
  }

  function handleImageUpload(elemId: string) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = () => {
          handleContentInput(elemId, reader.result as string);
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  }
</script>

<svelte:window on:mousemove={handleMouseMove} on:mouseup={handleMouseUp} />

<div
  role="button"
  tabindex="0"
  aria-label="Slide canvas"
  class="flex-1 bg-slate-200 overflow-auto p-8 flex items-center justify-center select-none"
  on:click={handleCanvasClick}
  on:keydown={(event) => {
    if (event.key === 'Escape') handleCanvasClick();
  }}
>
  <!-- 16:9 Presentation Stage -->
  <div
    bind:this={canvasContainer}
    class="w-[880px] aspect-video rounded-xl shadow-2xl relative overflow-hidden transition-colors border border-slate-300"
    style="background-color: {slide.bgColor}; color: {slide.bgColor === '#ffffff' || slide.bgColor === '#f8fafc' ? '#0f172a' : '#ffffff'};"
  >
    {#each slide.elements as elem (elem.id)}
      {@const isSelected = selectedElementId === elem.id}
      <div
        role="button"
        tabindex="0"
        aria-label={`Slide ${elem.type} element`}
        class="absolute cursor-move transition-shadow rounded-lg p-2 group
          {isSelected ? 'ring-2 ring-orange-500 shadow-lg' : 'hover:ring-1 hover:ring-slate-300'}"
        style="
          left: {elem.x}%;
          top: {elem.y}%;
          width: {elem.width}%;
          min-height: {elem.height}%;
          background-color: {elem.bgColor || 'transparent'};
          color: {elem.fontColor || 'inherit'};
          font-family: {elem.fontFamily || 'inherit'};
        "
        on:mousedown={(e) => handleMouseDown(elem, e)}
        on:click={(e) => handleSelect(elem.id, e)}
        on:keydown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            handleSelect(elem.id, event);
          }
        }}
      >
        {#if elem.type === 'title'}
          <input
            type="text"
            value={elem.content}
            on:input={(e) => handleContentInput(elem.id, e.currentTarget.value)}
            style="font-size: {elem.fontSize || 32}px; font-family: {elem.fontFamily || 'inherit'}; color: {elem.fontColor || 'inherit'};"
            class="w-full bg-transparent font-extrabold outline-none tracking-tight border-b border-transparent focus:border-orange-400"
            placeholder="Slide Title..."
          />
        {:else if elem.type === 'text'}
          <textarea
            value={elem.content}
            on:input={(e) => handleContentInput(elem.id, e.currentTarget.value)}
            rows={4}
            style="font-size: {elem.fontSize || 16}px; font-family: {elem.fontFamily || 'inherit'}; color: {elem.fontColor || 'inherit'};"
            class="w-full bg-transparent resize-none outline-none leading-relaxed border border-transparent focus:border-orange-400 rounded p-1"
            placeholder="Slide content and bullet points..."
          ></textarea>
        {:else if elem.type === 'stat'}
          <div class="w-full h-full bg-slate-500/10 border-2 border-slate-400/30 rounded-xl p-4 flex flex-col items-center justify-center text-center">
            <input
              type="text"
              value={elem.content}
              on:input={(e) => handleContentInput(elem.id, e.currentTarget.value)}
              style="font-size: {elem.fontSize || 42}px; color: {elem.fontColor || '#ea580c'};"
              class="w-full bg-transparent font-black text-center outline-none"
              placeholder="+98.5%"
            />
            <span class="text-xs opacity-75 font-semibold uppercase tracking-wider">Metric Callout</span>
          </div>
        {:else if elem.type === 'shape'}
          <div class="w-full h-full bg-slate-500/10 border-2 border-slate-400/30 rounded-xl p-4 flex flex-col justify-center">
            <input
              type="text"
              value={elem.content}
              on:input={(e) => handleContentInput(elem.id, e.currentTarget.value)}
              style="font-size: {elem.fontSize || 20}px;"
              class="w-full bg-transparent font-semibold text-center outline-none"
              placeholder="Card Title / Callout"
            />
          </div>
        {:else if elem.type === 'code'}
          <div class="w-full bg-slate-900 text-emerald-400 rounded-lg p-3 font-mono text-xs shadow-inner">
            <div class="flex items-center space-x-1.5 pb-2 mb-2 border-b border-slate-800 text-slate-500 text-[10px]">
              <Code size={12} />
              <span>Code Snippet</span>
            </div>
            <textarea
              value={elem.content}
              on:input={(e) => handleContentInput(elem.id, e.currentTarget.value)}
              rows={4}
              class="w-full bg-transparent text-emerald-300 font-mono resize-none outline-none text-xs"
            ></textarea>
          </div>
        {:else if elem.type === 'image'}
          {#if elem.content && elem.content.startsWith('data:image')}
            <div class="w-full h-full rounded-lg overflow-hidden relative group">
              <img src={elem.content} alt="Slide media" class="w-full h-auto object-cover rounded-lg" />
              <button
                class="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                on:click={() => handleImageUpload(elem.id)}
              >
                Change Image
              </button>
            </div>
          {:else}
            <button
              type="button"
              class="w-full h-36 bg-slate-100/10 border-2 border-dashed border-slate-400/50 rounded-lg flex flex-col items-center justify-center p-4 cursor-pointer hover:bg-slate-100/20 transition-colors"
              on:click={() => handleImageUpload(elem.id)}
            >
              <ImageIcon size={32} class="opacity-40 mb-1" />
              <span class="text-xs opacity-75 font-medium">Click to Upload Local Image</span>
            </button>
          {/if}
        {/if}
      </div>
    {/each}
  </div>
</div>
