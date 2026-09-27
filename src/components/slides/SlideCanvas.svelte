<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { Slide, SlideElement } from '../../types';
  import { Code, Image as ImageIcon, TrendingUp } from 'lucide-svelte';

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

  function handleSelect(id: string, e: MouseEvent) {
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

  function handleTableCellInput(elemId: string, rowIdx: number, colIdx: number, val: string) {
    const elem = slide.elements.find((el) => el.id === elemId);
    if (elem && elem.tableData) {
      if (!elem.tableData.cells[rowIdx]) elem.tableData.cells[rowIdx] = [];
      elem.tableData.cells[rowIdx][colIdx] = val;
      slide.elements = [...slide.elements];
      dispatch('elementChange', { id: elemId, content: JSON.stringify(elem.tableData) });
    }
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
  class="flex-1 bg-slate-200 overflow-auto p-8 flex items-center justify-center select-none"
  on:click={handleCanvasClick}
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
          z-index: {elem.zIndex || 1};
        "
        on:mousedown={(e) => handleMouseDown(elem, e)}
        on:click={(e) => handleSelect(elem.id, e)}
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
          {#if elem.shapeVariant === 'circle'}
            <div class="w-full aspect-square bg-slate-500/10 border-2 border-slate-400/30 rounded-full p-4 flex flex-col items-center justify-center shadow-xs">
              <input
                type="text"
                value={elem.content}
                on:input={(e) => handleContentInput(elem.id, e.currentTarget.value)}
                style="font-size: {elem.fontSize || 18}px;"
                class="w-full bg-transparent font-semibold text-center outline-none"
                placeholder="Circle Label"
              />
            </div>
          {:else if elem.shapeVariant === 'pill'}
            <div class="w-full h-full bg-slate-500/10 border-2 border-slate-400/30 rounded-full px-6 py-2 flex flex-col items-center justify-center shadow-xs">
              <input
                type="text"
                value={elem.content}
                on:input={(e) => handleContentInput(elem.id, e.currentTarget.value)}
                style="font-size: {elem.fontSize || 16}px;"
                class="w-full bg-transparent font-semibold text-center outline-none"
                placeholder="Pill Badge"
              />
            </div>
          {:else if elem.shapeVariant === 'star'}
            <div class="w-full h-full bg-amber-500/15 border-2 border-amber-500/40 rounded-2xl p-4 flex flex-col items-center justify-center shadow-xs">
              <span class="text-amber-500 text-lg mb-1">★</span>
              <input
                type="text"
                value={elem.content}
                on:input={(e) => handleContentInput(elem.id, e.currentTarget.value)}
                style="font-size: {elem.fontSize || 18}px;"
                class="w-full bg-transparent font-bold text-center outline-none text-amber-900"
                placeholder="Milestone ★"
              />
            </div>
          {:else if elem.shapeVariant === 'arrow-right'}
            <div class="w-full h-full bg-blue-500/15 border-2 border-blue-500/40 rounded-xl p-3 flex items-center justify-between shadow-xs">
              <input
                type="text"
                value={elem.content}
                on:input={(e) => handleContentInput(elem.id, e.currentTarget.value)}
                style="font-size: {elem.fontSize || 16}px;"
                class="flex-1 bg-transparent font-bold text-center outline-none text-blue-900"
                placeholder="Process Step →"
              />
              <span class="text-blue-600 font-extrabold text-xl pr-2">➔</span>
            </div>
          {:else if elem.shapeVariant === 'callout'}
            <div class="w-full h-full bg-emerald-500/15 border-2 border-emerald-500/40 rounded-2xl p-4 flex flex-col justify-center relative shadow-xs">
              <div class="text-emerald-700 text-[10px] font-bold uppercase tracking-wider mb-1">💬 Callout</div>
              <textarea
                value={elem.content}
                on:input={(e) => handleContentInput(elem.id, e.currentTarget.value)}
                rows={2}
                style="font-size: {elem.fontSize || 15}px;"
                class="w-full bg-transparent resize-none outline-none text-emerald-950 font-medium"
                placeholder="Important quote or callout message..."
              ></textarea>
            </div>
          {:else if elem.shapeVariant === 'diamond'}
            <div class="w-full h-full bg-purple-500/15 border-2 border-purple-500/40 rounded-xl p-4 flex flex-col items-center justify-center shadow-xs rotate-45">
              <div class="-rotate-45 w-full text-center">
                <input
                  type="text"
                  value={elem.content}
                  on:input={(e) => handleContentInput(elem.id, e.currentTarget.value)}
                  style="font-size: {elem.fontSize || 16}px;"
                  class="w-full bg-transparent font-bold text-center outline-none text-purple-900"
                  placeholder="Decision ◊"
                />
              </div>
            </div>
          {:else if elem.shapeVariant === 'triangle'}
            <div class="w-full h-full bg-amber-500/15 border-2 border-amber-500/40 rounded-xl p-4 flex flex-col items-center justify-center shadow-xs">
              <span class="text-amber-600 text-xl font-bold">▲</span>
              <input
                type="text"
                value={elem.content}
                on:input={(e) => handleContentInput(elem.id, e.currentTarget.value)}
                style="font-size: {elem.fontSize || 16}px;"
                class="w-full bg-transparent font-bold text-center outline-none text-amber-900"
                placeholder="Priority ▲"
              />
            </div>
          {:else if elem.shapeVariant === 'arrow-left'}
            <div class="w-full h-full bg-blue-500/15 border-2 border-blue-500/40 rounded-xl p-3 flex items-center justify-between shadow-xs">
              <span class="text-blue-600 font-extrabold text-xl pl-2">⬅</span>
              <input
                type="text"
                value={elem.content}
                on:input={(e) => handleContentInput(elem.id, e.currentTarget.value)}
                style="font-size: {elem.fontSize || 16}px;"
                class="flex-1 bg-transparent font-bold text-center outline-none text-blue-900"
                placeholder="← Return"
              />
            </div>
          {:else if elem.shapeVariant === 'banner'}
            <div class="w-full h-full bg-rose-500/15 border-2 border-rose-500/40 rounded-xl px-4 py-2 flex items-center justify-center shadow-xs">
              <span class="text-rose-600 mr-1 font-bold">🏷</span>
              <input
                type="text"
                value={elem.content}
                on:input={(e) => handleContentInput(elem.id, e.currentTarget.value)}
                style="font-size: {elem.fontSize || 16}px;"
                class="w-full bg-transparent font-bold text-center outline-none text-rose-900 uppercase tracking-wide"
                placeholder="ANNOUNCEMENT"
              />
            </div>
          {:else}
            <!-- Default Card / Box -->
            <div class="w-full h-full bg-slate-500/10 border-2 border-slate-400/30 rounded-xl p-4 flex flex-col justify-center shadow-xs">
              <input
                type="text"
                value={elem.content}
                on:input={(e) => handleContentInput(elem.id, e.currentTarget.value)}
                style="font-size: {elem.fontSize || 20}px;"
                class="w-full bg-transparent font-semibold text-center outline-none"
                placeholder="Card Title / Callout"
              />
            </div>
          {/if}
        {:else if elem.type === 'table'}
          <!-- Google Slides Style Table -->
          <div class="w-full h-full bg-white/95 rounded-xl border border-slate-300 shadow-sm overflow-hidden p-2 text-slate-800">
            <table class="w-full h-full border-collapse text-xs">
              <thead>
                <tr class="bg-slate-100 border-b border-slate-300">
                  {#each (elem.tableData?.cells[0] || ['Feature', 'Description', 'Status']) as header, cIdx}
                    <th class="p-1.5 font-bold text-left border-r border-slate-200">
                      <input
                        type="text"
                        value={header}
                        on:input={(e) => handleTableCellInput(elem.id, 0, cIdx, e.currentTarget.value)}
                        class="w-full bg-transparent font-bold outline-none"
                      />
                    </th>
                  {/each}
                </tr>
              </thead>
              <tbody>
                {#each (elem.tableData?.cells.slice(1) || [['Docs', 'Rich editor', 'Ready'], ['Sheets', 'Formulas', 'Ready']]) as row, rIdx}
                  <tr class="border-b border-slate-200 hover:bg-slate-50">
                    {#each row as cell, cIdx}
                      <td class="p-1.5 border-r border-slate-200">
                        <input
                          type="text"
                          value={cell}
                          on:input={(e) => handleTableCellInput(elem.id, rIdx + 1, cIdx, e.currentTarget.value)}
                          class="w-full bg-transparent outline-none"
                        />
                      </td>
                    {/each}
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {:else if elem.type === 'chart'}
          <!-- Google Slides Style Embedded Chart -->
          <div class="w-full h-full bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col justify-between text-slate-800">
            <div class="font-bold text-xs text-slate-700 pb-1 mb-2 border-b border-slate-100 flex items-center justify-between">
              <span>{elem.chartData?.title || 'Quarterly Performance'}</span>
              <span class="text-[10px] text-orange-600 font-semibold uppercase">{elem.chartData?.chartType || 'Bar'}</span>
            </div>
            <div class="flex-1 flex items-end justify-around gap-2 pt-2 pb-1">
              {#each (elem.chartData?.labels || ['Q1', 'Q2', 'Q3', 'Q4']) as label, idx}
                {@const val = (elem.chartData?.values || [45, 80, 65, 95])[idx] || 50}
                {@const max = Math.max(...(elem.chartData?.values || [100]))}
                {@const heightPercent = Math.max(15, Math.min(100, Math.round((val / max) * 100)))}
                <div class="flex-1 flex flex-col items-center h-full justify-end group/bar">
                  <div class="text-[9px] font-bold text-slate-600 mb-0.5 opacity-0 group-hover/bar:opacity-100 transition-opacity">{val}</div>
                  <div
                    class="w-full rounded-t-md transition-all duration-300 shadow-xs"
                    style="height: {heightPercent}%; background: {(elem.chartData?.colors || ['#f97316', '#3b82f6', '#10b981', '#8b5cf6'])[idx % 4]};"
                  ></div>
                  <div class="text-[10px] text-slate-500 font-medium mt-1 truncate">{label}</div>
                </div>
              {/each}
            </div>
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
            <div
              class="w-full h-36 bg-slate-100/10 border-2 border-dashed border-slate-400/50 rounded-lg flex flex-col items-center justify-center p-4 cursor-pointer hover:bg-slate-100/20 transition-colors"
              on:click={() => handleImageUpload(elem.id)}
            >
              <ImageIcon size={32} class="opacity-40 mb-1" />
              <span class="text-xs opacity-75 font-medium">Click to Upload Local Image</span>
            </div>
          {/if}
        {/if}
      </div>
    {/each}
  </div>
</div>
