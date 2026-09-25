<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import SlideToolbar from './SlideToolbar.svelte';
  import SlideDeckSidebar from './SlideDeckSidebar.svelte';
  import SlideCanvas from './SlideCanvas.svelte';
  import PresenterModal from './PresenterModal.svelte';
  import type { SlideDeck, Slide, SlideElementType } from '../../types';

  export let deck: SlideDeck;

  const dispatch = createEventDispatcher<{
    updateStats: { slideIndex: number; totalSlides: number };
    change: void;
  }>();

  let activeSlideIndex = 0;
  let selectedElementId: string | null = null;
  let isPresenting = false;

  $: currentSlide = deck.slides[activeSlideIndex] || deck.slides[0];

  $: {
    dispatch('updateStats', {
      slideIndex: activeSlideIndex,
      totalSlides: deck.slides.length,
    });
  }

  function handleSelectSlide(e: CustomEvent<number>) {
    activeSlideIndex = e.detail;
    selectedElementId = null;
  }

  function handleAddSlide() {
    const newSlide: Slide = {
      id: `slide_${Date.now()}`,
      title: `Slide ${deck.slides.length + 1}`,
      bgColor: '#ffffff',
      elements: [
        {
          id: `elem_${Date.now()}_1`,
          type: 'title',
          x: 10,
          y: 15,
          width: 80,
          height: 15,
          content: 'New Slide Topic',
        },
        {
          id: `elem_${Date.now()}_2`,
          type: 'text',
          x: 10,
          y: 35,
          width: 80,
          height: 45,
          content: '• Add key discussion point here\n• Provide clear, concise supporting data\n• Summarize next steps and milestones',
        },
      ],
      notes: 'Remember to emphasize simplicity and speed.',
    };

    deck.slides = [...deck.slides, newSlide];
    activeSlideIndex = deck.slides.length - 1;
    deck.meta.isDirty = true;
    dispatch('change');
  }

  function handleDuplicateSlide(e: CustomEvent<number>) {
    const src = deck.slides[e.detail];
    const copy: Slide = JSON.parse(JSON.stringify(src));
    copy.id = `slide_${Date.now()}`;
    copy.title = `${copy.title} (Copy)`;
    deck.slides.splice(e.detail + 1, 0, copy);
    deck.slides = [...deck.slides];
    activeSlideIndex = e.detail + 1;
    deck.meta.isDirty = true;
    dispatch('change');
  }

  function handleDeleteSlide(e: CustomEvent<number>) {
    if (deck.slides.length <= 1) return;
    deck.slides.splice(e.detail, 1);
    deck.slides = [...deck.slides];
    if (activeSlideIndex >= deck.slides.length) {
      activeSlideIndex = deck.slides.length - 1;
    }
    deck.meta.isDirty = true;
    dispatch('change');
  }

  function handleMoveSlide(e: CustomEvent<{ from: number; to: number }>) {
    const item = deck.slides.splice(e.detail.from, 1)[0];
    deck.slides.splice(e.detail.to, 0, item);
    deck.slides = [...deck.slides];
    activeSlideIndex = e.detail.to;
    deck.meta.isDirty = true;
    dispatch('change');
  }

  function handleAddElement(e: CustomEvent<{ type: SlideElementType }>) {
    const type = e.detail.type;
    const id = `elem_${Date.now()}`;

    let newElem;
    if (type === 'title') {
      newElem = { id, type, x: 10, y: 10, width: 80, height: 15, content: 'Topic Title' };
    } else if (type === 'text') {
      newElem = { id, type, x: 10, y: 30, width: 75, height: 40, content: '• Key point 1\n• Key point 2\n• Key point 3' };
    } else if (type === 'shape') {
      newElem = { id, type, x: 25, y: 40, width: 50, height: 25, content: 'Highlight Card' };
    } else if (type === 'code') {
      newElem = { id, type, x: 15, y: 35, width: 70, height: 40, content: 'fn main() {\n    println!("Simple Office Suite");\n}' };
    } else {
      newElem = { id, type: 'image' as const, x: 20, y: 25, width: 60, height: 45, content: 'Infographic / Diagram' };
    }

    currentSlide.elements = [...currentSlide.elements, newElem];
    deck.slides = [...deck.slides];
    selectedElementId = id;
    deck.meta.isDirty = true;
    dispatch('change');
  }

  function handleDeleteElement() {
    if (!selectedElementId) return;
    currentSlide.elements = currentSlide.elements.filter((el) => el.id !== selectedElementId);
    deck.slides = [...deck.slides];
    selectedElementId = null;
    deck.meta.isDirty = true;
    dispatch('change');
  }

  function handleChangeBg(e: CustomEvent<string>) {
    currentSlide.bgColor = e.detail;
    deck.slides = [...deck.slides];
    deck.meta.isDirty = true;
    dispatch('change');
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'F5') {
      e.preventDefault();
      isPresenting = true;
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="flex-1 flex flex-col h-full overflow-hidden bg-slate-100">
  <SlideToolbar
    {selectedElementId}
    slideBgColor={currentSlide.bgColor}
    on:addElement={handleAddElement}
    on:deleteElement={handleDeleteElement}
    on:changeBg={handleChangeBg}
    on:present={() => (isPresenting = true)}
    on:addSlide={handleAddSlide}
  />

  <div class="flex-1 flex overflow-hidden">
    <!-- Slide Thumbnails Deck Organizer -->
    <SlideDeckSidebar
      slides={deck.slides}
      {activeSlideIndex}
      on:selectSlide={handleSelectSlide}
      on:addSlide={handleAddSlide}
      on:duplicateSlide={handleDuplicateSlide}
      on:deleteSlide={handleDeleteSlide}
      on:moveSlide={handleMoveSlide}
    />

    <!-- Slide Canvas -->
    <SlideCanvas
      slide={currentSlide}
      bind:selectedElementId
      on:elementChange={() => {
        deck.meta.isDirty = true;
        dispatch('change');
      }}
    />
  </div>

  <!-- Presenter Mode Overlay -->
  {#if isPresenting}
    <PresenterModal
      slides={deck.slides}
      currentIndex={activeSlideIndex}
      on:close={() => (isPresenting = false)}
      on:changeSlide={(e) => (activeSlideIndex = e.detail)}
    />
  {/if}
</div>
