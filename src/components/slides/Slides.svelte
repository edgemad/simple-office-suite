<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import SlideToolbar from './SlideToolbar.svelte';
  import SlideDeckSidebar from './SlideDeckSidebar.svelte';
  import SlideCanvas from './SlideCanvas.svelte';
  import PresenterModal from './PresenterModal.svelte';
  import { FileText } from 'lucide-svelte';
  import type { SlideDeck, Slide, SlideElementType, SlideElement } from '../../types';

  export let deck: SlideDeck;

  const dispatch = createEventDispatcher<{
    updateStats: { slideIndex: number; totalSlides: number };
    change: void;
  }>();

  let activeSlideIndex = 0;
  let selectedElementId: string | null = null;
  let isPresenting = false;
  let showNotes = false;

  let currentFont = 'Inter, sans-serif';
  let currentFontSize = 24;
  let currentColor = '#0f172a';

  // Undo / Redo History Stack for Slides
  let undoStack: string[] = [];
  let redoStack: string[] = [];

  $: currentSlide = deck.slides[activeSlideIndex] || deck.slides[0];

  $: selectedElement = currentSlide.elements.find((el) => el.id === selectedElementId);

  $: if (selectedElement) {
    if (selectedElement.fontFamily) currentFont = selectedElement.fontFamily;
    if (selectedElement.fontSize) currentFontSize = selectedElement.fontSize;
    if (selectedElement.fontColor) currentColor = selectedElement.fontColor;
  }

  $: {
    dispatch('updateStats', {
      slideIndex: activeSlideIndex,
      totalSlides: deck.slides.length,
    });
  }

  function pushUndo() {
    undoStack.push(JSON.stringify(deck.slides));
    if (undoStack.length > 30) undoStack.shift();
    redoStack = [];
  }

  export function triggerUndo() {
    if (undoStack.length === 0) return;
    const prev = undoStack.pop()!;
    redoStack.push(JSON.stringify(deck.slides));
    deck.slides = JSON.parse(prev);
    if (activeSlideIndex >= deck.slides.length) {
      activeSlideIndex = deck.slides.length - 1;
    }
    deck.meta.isDirty = true;
    dispatch('change');
  }

  export function triggerRedo() {
    if (redoStack.length === 0) return;
    const next = redoStack.pop()!;
    undoStack.push(JSON.stringify(deck.slides));
    deck.slides = JSON.parse(next);
    if (activeSlideIndex >= deck.slides.length) {
      activeSlideIndex = deck.slides.length - 1;
    }
    deck.meta.isDirty = true;
    dispatch('change');
  }

  export function addNewSlide() {
    handleAddSlide();
  }

  export function startPresenting() {
    isPresenting = true;
  }

  export function setTheme(themeName: string) {
    if (themeName === 'dark') {
      handleChangeBg({ detail: '#0f172a' } as any);
    } else if (themeName === 'light') {
      handleChangeBg({ detail: '#ffffff' } as any);
    } else if (themeName === 'navy') {
      handleChangeBg({ detail: '#1e3a8a' } as any);
    }
  }

  function handleSelectSlide(e: CustomEvent<number>) {
    activeSlideIndex = e.detail;
    selectedElementId = null;
  }

  function handleAddSlide() {
    pushUndo();

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
          content: 'New Presentation Topic',
          fontFamily: 'Inter, sans-serif',
          fontSize: 32,
        },
        {
          id: `elem_${Date.now()}_2`,
          type: 'text',
          x: 10,
          y: 35,
          width: 80,
          height: 45,
          content: '• Add key discussion point here\n• Provide clear, concise supporting data\n• Summarize next steps and milestones',
          fontFamily: 'Inter, sans-serif',
          fontSize: 16,
        },
      ],
      notes: 'Slide discussion notes.',
    };

    deck.slides = [...deck.slides, newSlide];
    activeSlideIndex = deck.slides.length - 1;
    deck.meta.isDirty = true;
    dispatch('change');
  }

  function handleApplyLayout(e: CustomEvent<string>) {
    const layout = e.detail;
    if (!layout) return;

    pushUndo();

    const t = Date.now();
    if (layout === 'title') {
      currentSlide.elements = [
        { id: `el_${t}_1`, type: 'title', x: 10, y: 30, width: 80, height: 20, content: 'Presentation Title', fontSize: 44 },
        { id: `el_${t}_2`, type: 'text', x: 10, y: 55, width: 80, height: 20, content: 'Subtitle or Author Name', fontSize: 20, fontColor: '#64748b' },
      ];
    } else if (layout === 'content') {
      currentSlide.elements = [
        { id: `el_${t}_1`, type: 'title', x: 8, y: 12, width: 84, height: 15, content: 'Topic Overview', fontSize: 32 },
        { id: `el_${t}_2`, type: 'text', x: 8, y: 30, width: 84, height: 55, content: '• First key takeaway\n• Second supporting point\n• Quantitative performance metrics\n• Summary conclusion', fontSize: 18 },
      ];
    } else if (layout === 'two-column') {
      currentSlide.elements = [
        { id: `el_${t}_1`, type: 'title', x: 8, y: 12, width: 84, height: 15, content: 'Comparison & Analysis', fontSize: 32 },
        { id: `el_${t}_2`, type: 'text', x: 8, y: 30, width: 40, height: 55, content: 'Option A (Current)\n\n• Point 1\n• Point 2\n• Tradeoffs', fontSize: 16 },
        { id: `el_${t}_3`, type: 'text', x: 52, y: 30, width: 40, height: 55, content: 'Option B (Proposed)\n\n• Benefit 1\n• Benefit 2\n• Deliverables', fontSize: 16 },
      ];
    } else if (layout === 'stat') {
      currentSlide.elements = [
        { id: `el_${t}_1`, type: 'title', x: 8, y: 12, width: 84, height: 15, content: 'Annual Growth & Results', fontSize: 32 },
        { id: `el_${t}_2`, type: 'stat', x: 25, y: 35, width: 50, height: 40, content: '+284%', fontSize: 56, fontColor: '#ea580c' },
      ];
    } else if (layout === 'blank') {
      currentSlide.elements = [];
    }

    deck.slides = [...deck.slides];
    deck.meta.isDirty = true;
    dispatch('change');
  }

  function handleDuplicateSlide(e: CustomEvent<number>) {
    pushUndo();

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
    pushUndo();

    deck.slides.splice(e.detail, 1);
    deck.slides = [...deck.slides];
    if (activeSlideIndex >= deck.slides.length) {
      activeSlideIndex = deck.slides.length - 1;
    }
    deck.meta.isDirty = true;
    dispatch('change');
  }

  function handleMoveSlide(e: CustomEvent<{ from: number; to: number }>) {
    pushUndo();

    const item = deck.slides.splice(e.detail.from, 1)[0];
    deck.slides.splice(e.detail.to, 0, item);
    deck.slides = [...deck.slides];
    activeSlideIndex = e.detail.to;
    deck.meta.isDirty = true;
    dispatch('change');
  }

  function handleAddElement(e: CustomEvent<{ type: SlideElementType }>) {
    pushUndo();

    const type = e.detail.type;
    const id = `elem_${Date.now()}`;

    let newElem;
    if (type === 'title') {
      newElem = { id, type, x: 10, y: 10, width: 80, height: 15, content: 'Topic Title', fontSize: 32, fontFamily: currentFont };
    } else if (type === 'text') {
      newElem = { id, type, x: 10, y: 30, width: 75, height: 40, content: '• Key point 1\n• Key point 2\n• Key point 3', fontSize: 16, fontFamily: currentFont };
    } else if (type === 'stat') {
      newElem = { id, type, x: 25, y: 35, width: 50, height: 35, content: '+100%', fontSize: 48, fontColor: '#ea580c' };
    } else if (type === 'shape') {
      newElem = { id, type, x: 25, y: 40, width: 50, height: 25, content: 'Highlight Card', fontSize: 18 };
    } else if (type === 'code') {
      newElem = { id, type, x: 15, y: 35, width: 70, height: 40, content: 'fn main() {\n    println!("Simple Office Suite");\n}', fontSize: 13 };
    } else {
      newElem = { id, type: 'image' as const, x: 20, y: 25, width: 60, height: 45, content: '' };
    }

    currentSlide.elements = [...currentSlide.elements, newElem];
    deck.slides = [...deck.slides];
    selectedElementId = id;
    deck.meta.isDirty = true;
    dispatch('change');
  }

  function handleAddShape(e: CustomEvent<string>) {
    pushUndo();
    const shapeVariant = e.detail as any;
    const id = `elem_${Date.now()}`;
    const newElem: SlideElement = {
      id,
      type: 'shape',
      x: 25,
      y: 35,
      width: shapeVariant === 'circle' ? 30 : 45,
      height: shapeVariant === 'circle' ? 30 : 25,
      content:
        shapeVariant === 'star'
          ? 'Milestone ★'
          : shapeVariant === 'callout'
          ? 'Executive takeaway...'
          : shapeVariant === 'arrow-right'
          ? 'Process Step →'
          : 'Card / Shape',
      fontSize: 18,
      shapeVariant,
      zIndex: (currentSlide.elements.length || 0) + 1,
    };
    currentSlide.elements = [...currentSlide.elements, newElem];
    deck.slides = [...deck.slides];
    selectedElementId = id;
    deck.meta.isDirty = true;
    dispatch('change');
  }

  function handleBringToFront() {
    if (!selectedElement) return;
    pushUndo();
    const maxZ = Math.max(1, ...currentSlide.elements.map((e) => e.zIndex || 1));
    selectedElement.zIndex = maxZ + 1;
    deck.slides = [...deck.slides];
    deck.meta.isDirty = true;
    dispatch('change');
  }

  function handleSendToBack() {
    if (!selectedElement) return;
    pushUndo();
    const minZ = Math.min(1, ...currentSlide.elements.map((e) => e.zIndex || 1));
    selectedElement.zIndex = Math.max(0, minZ - 1);
    deck.slides = [...deck.slides];
    deck.meta.isDirty = true;
    dispatch('change');
  }

  function handleDeleteElement() {
    if (!selectedElementId) return;
    pushUndo();

    currentSlide.elements = currentSlide.elements.filter((el) => el.id !== selectedElementId);
    deck.slides = [...deck.slides];
    selectedElementId = null;
    deck.meta.isDirty = true;
    dispatch('change');
  }

  function handleChangeBg(e: CustomEvent<string>) {
    pushUndo();
    currentSlide.bgColor = e.detail;
    deck.slides = [...deck.slides];
    deck.meta.isDirty = true;
    dispatch('change');
  }

  function handleChangeFont(e: CustomEvent<string>) {
    currentFont = e.detail;
    if (selectedElement) {
      pushUndo();
      selectedElement.fontFamily = e.detail;
      deck.slides = [...deck.slides];
      deck.meta.isDirty = true;
      dispatch('change');
    }
  }

  function handleChangeFontSize(e: CustomEvent<number>) {
    currentFontSize = e.detail;
    if (selectedElement) {
      pushUndo();
      selectedElement.fontSize = e.detail;
      deck.slides = [...deck.slides];
      deck.meta.isDirty = true;
      dispatch('change');
    }
  }

  function handleChangeColor(e: CustomEvent<string>) {
    currentColor = e.detail;
    if (selectedElement) {
      pushUndo();
      selectedElement.fontColor = e.detail;
      deck.slides = [...deck.slides];
      deck.meta.isDirty = true;
      dispatch('change');
    }
  }

  // Google Slides Shortcuts (Cmd+M, Cmd+D, Delete, F5, Cmd+Enter, Arrows)
  function handleKeydown(e: KeyboardEvent) {
    const mod = e.ctrlKey || e.metaKey;
    const targetTag = (e.target as HTMLElement)?.tagName?.toLowerCase();

    // If currently typing in an input or contenteditable element, don't intercept standard keys
    if (targetTag === 'input' || targetTag === 'textarea' || (e.target as HTMLElement)?.isContentEditable) {
      if (e.key === 'Escape') {
        (e.target as HTMLElement).blur();
      }
      return;
    }

    if (mod && !e.shiftKey && !e.altKey) {
      if (e.key.toLowerCase() === 'm') {
        // Google Slides: New slide (Cmd+M)
        e.preventDefault();
        handleAddSlide();
      } else if (e.key.toLowerCase() === 'd') {
        // Google Slides: Duplicate slide (Cmd+D)
        e.preventDefault();
        handleDuplicateSlide({ detail: activeSlideIndex } as any);
      } else if (e.key === 'Enter') {
        // Google Slides: Present (Cmd+Enter)
        e.preventDefault();
        isPresenting = true;
      } else if (e.key.toLowerCase() === 'z') {
        e.preventDefault();
        triggerUndo();
      } else if (e.key.toLowerCase() === 'y') {
        e.preventDefault();
        triggerRedo();
      }
    } else if (mod && e.shiftKey && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      triggerRedo();
    } else if (!mod && !e.shiftKey && !e.altKey) {
      if (e.key === 'F5') {
        e.preventDefault();
        isPresenting = true;
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        if (selectedElementId) {
          handleDeleteElement();
        } else if (deck.slides.length > 1) {
          handleDeleteSlide({ detail: activeSlideIndex } as any);
        }
      } else if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        if (activeSlideIndex < deck.slides.length - 1) {
          activeSlideIndex++;
          selectedElementId = null;
        }
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        if (activeSlideIndex > 0) {
          activeSlideIndex--;
          selectedElementId = null;
        }
      } else if (e.key === 'Escape') {
        selectedElementId = null;
      }
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="flex-1 flex flex-col h-full overflow-hidden bg-slate-100">
  <SlideToolbar
    {selectedElementId}
    slideBgColor={currentSlide.bgColor}
    selectedFont={currentFont}
    selectedFontSize={currentFontSize}
    selectedColor={currentColor}
    on:addElement={handleAddElement}
    on:addShape={handleAddShape}
    on:bringToFront={handleBringToFront}
    on:sendToBack={handleSendToBack}
    on:deleteElement={handleDeleteElement}
    on:changeBg={handleChangeBg}
    on:changeFont={handleChangeFont}
    on:changeFontSize={handleChangeFontSize}
    on:changeColor={handleChangeColor}
    on:applyLayout={handleApplyLayout}
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

    <!-- Main Slide Workspace: Canvas + Google Slides Speaker Notes Drawer -->
    <div class="flex-1 flex flex-col overflow-hidden">
      <!-- Slide Canvas -->
      <SlideCanvas
        slide={currentSlide}
        bind:selectedElementId
        on:elementChange={() => {
          deck.meta.isDirty = true;
          dispatch('change');
        }}
      />

      <!-- Google Slides Style Speaker Notes Drawer -->
      <div class="no-print bg-white border-t border-slate-300 flex flex-col transition-all {showNotes ? 'h-36' : 'h-7'} shrink-0">
        <div class="h-7 px-3 bg-slate-100/90 border-b border-slate-200 flex items-center justify-between text-xs select-none">
          <button
            class="flex items-center space-x-1.5 font-semibold text-slate-700 hover:text-orange-600 transition-colors"
            on:click={() => (showNotes = !showNotes)}
          >
            <FileText size={13} class="text-orange-600" />
            <span>Speaker notes</span>
            <span class="text-[10px] text-slate-400 font-normal">({currentSlide.notes ? 'Has notes' : 'Click to add notes'})</span>
          </button>
          <button
            class="text-slate-400 hover:text-slate-700 text-[11px] font-medium"
            on:click={() => (showNotes = !showNotes)}
          >
            {showNotes ? 'Collapse ▲' : 'Expand ▼'}
          </button>
        </div>
        {#if showNotes}
          <textarea
            bind:value={currentSlide.notes}
            on:input={() => { deck.meta.isDirty = true; dispatch('change'); }}
            placeholder="Type speaker notes here. These will appear in presentation mode to guide your talk..."
            class="flex-1 w-full p-2.5 text-xs text-slate-800 bg-white outline-none resize-none font-sans leading-relaxed"
          ></textarea>
        {/if}
      </div>
    </div>
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
