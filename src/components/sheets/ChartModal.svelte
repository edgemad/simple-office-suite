<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { BarChart3, LineChart, PieChart, X, Download,  Check } from '@lucide/svelte';
  import type { SheetGrid, SheetChart } from '../../types';
  import { parseCoord, colToLetter } from './formulaEngine';

  export let isOpen: boolean = false;
  export let grid: SheetGrid;
  export let defaultRange: string = 'A1:B6';

  const dispatch = createEventDispatcher<{
    close: void;
    insertChart: SheetChart;
  }>();

  let chartType: 'bar' | 'line' | 'pie' | 'doughnut' = 'bar';
  let chartTitle: string = 'Data Visualization';
  let dataRange: string = defaultRange;

  $: if (defaultRange && !dataRange) {
    dataRange = defaultRange;
  }

  interface ChartDataPoint {
    label: string;
    value: number;
    color: string;
  }

  const palette = [
    '#3b82f6',
    '#10b981',
    '#f59e0b',
    '#ef4444',
    '#8b5cf6',
    '#ec4899',
    '#06b6d4',
    '#84cc16',
  ];

  // Parse data points from range
  $: chartData = parseRangeData(dataRange, grid);

  function parseRangeData(rangeStr: string, currentGrid: SheetGrid): ChartDataPoint[] {
    const parts = rangeStr.split(':');
    if (parts.length !== 2) return [];

    const start = parseCoord(parts[0].trim());
    const end = parseCoord(parts[1].trim());
    if (!start || !end) return [];

    const minCol = Math.min(start.col, end.col);
    const maxCol = Math.max(start.col, end.col);
    const minRow = Math.min(start.row, end.row);
    const maxRow = Math.max(start.row, end.row);

    const points: ChartDataPoint[] = [];

    // If 2 columns: Col 1 is label, Col 2 is numeric value
    if (maxCol > minCol) {
      for (let r = minRow; r <= maxRow; r++) {
        const labelKey = `${colToLetter(minCol)}${r + 1}`;
        const valKey = `${colToLetter(minCol + 1)}${r + 1}`;
        const label = String(currentGrid[labelKey]?.computed || `Row ${r + 1}`);
        const rawVal = currentGrid[valKey]?.computed;
        const num = typeof rawVal === 'number' ? rawVal : parseFloat(String(rawVal || 0).replace(/[$,%]/g, ''));
        if (!isNaN(num)) {
          points.push({
            label,
            value: num,
            color: palette[points.length % palette.length],
          });
        }
      }
    } else {
      // 1 column: Row number is label, column is value
      for (let r = minRow; r <= maxRow; r++) {
        const valKey = `${colToLetter(minCol)}${r + 1}`;
        const rawVal = currentGrid[valKey]?.computed;
        const num = typeof rawVal === 'number' ? rawVal : parseFloat(String(rawVal || 0).replace(/[$,%]/g, ''));
        if (!isNaN(num)) {
          points.push({
            label: `Item ${r - minRow + 1}`,
            value: num,
            color: palette[points.length % palette.length],
          });
        }
      }
    }

    return points;
  }

  $: maxValue = Math.max(1, ...chartData.map((d) => d.value));
  $: totalValue = chartData.reduce((acc, d) => acc + Math.max(0, d.value), 0);

  function handleInsert() {
    const newChart: SheetChart = {
      id: `chart_${Date.now()}`,
      type: chartType,
      title: chartTitle,
      range: dataRange,
      valueCol: 1,
      x: 20,
      y: 20,
    };
    dispatch('insertChart', newChart);
    dispatch('close');
  }

  function exportChartSvg() {
    const svgEl = document.getElementById('sheet-chart-svg');
    if (!svgEl) return;
    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(svgEl);
    const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${chartTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }
</script>

{#if isOpen}
  <div class="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
    <div
      role="presentation"
      class="bg-white rounded-xl shadow-2xl border border-slate-200 p-6 w-[540px] text-xs text-slate-700 animate-in fade-in zoom-in-95 duration-100 flex flex-col max-h-[90vh]"
      on:click|stopPropagation
    >
      <!-- Modal Header -->
      <div class="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
        <div class="flex items-center space-x-2 font-bold text-slate-800 text-sm">
          <BarChart3 size={16} class="text-emerald-600" />
          <span>Insert Chart (Google Sheets)</span>
        </div>
        <button
          class="p-1 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600"
          aria-label="Close dialog"
          on:click={() => dispatch('close')}
        >
          <X size={15} />
        </button>
      </div>

      <!-- Controls Row -->
      <div class="grid grid-cols-3 gap-3 mb-4">
        <!-- Chart Type -->
        <div>
          <span class="block font-semibold text-slate-700 mb-1" id="chart-modal-type-label">Chart Type</span>
          <div class="grid grid-cols-3 gap-1" role="group" aria-labelledby="chart-modal-type-label">
            <button
              class="p-1.5 rounded border flex flex-col items-center justify-center transition-all
                {chartType === 'bar' ? 'border-emerald-600 bg-emerald-50 text-emerald-800 font-bold' : 'border-slate-200 hover:bg-slate-50 text-slate-600'}"
              on:click={() => (chartType = 'bar')}
              title="Bar Chart"
            >
              <BarChart3 size={15} />
              <span class="text-[10px] mt-0.5">Bar</span>
            </button>
            <button
              class="p-1.5 rounded border flex flex-col items-center justify-center transition-all
                {chartType === 'line' ? 'border-emerald-600 bg-emerald-50 text-emerald-800 font-bold' : 'border-slate-200 hover:bg-slate-50 text-slate-600'}"
              on:click={() => (chartType = 'line')}
              title="Line Chart"
            >
              <LineChart size={15} />
              <span class="text-[10px] mt-0.5">Line</span>
            </button>
            <button
              class="p-1.5 rounded border flex flex-col items-center justify-center transition-all
                {chartType === 'pie' ? 'border-emerald-600 bg-emerald-50 text-emerald-800 font-bold' : 'border-slate-200 hover:bg-slate-50 text-slate-600'}"
              on:click={() => (chartType = 'pie')}
              title="Pie Chart"
            >
              <PieChart size={15} />
              <span class="text-[10px] mt-0.5">Pie</span>
            </button>
          </div>
        </div>

        <!-- Range -->
        <div>
          <label for="chart-modal-data-range" class="block font-semibold text-slate-700 mb-1">Data Range</label>
          <input
            id="chart-modal-data-range"
            type="text"
            bind:value={dataRange}
            placeholder="e.g. A1:B6"
            class="w-full h-8 px-2 bg-slate-50 border border-slate-300 rounded font-mono text-xs uppercase text-slate-800 focus:border-emerald-500 outline-none"
          />
        </div>

        <!-- Title -->
        <div>
          <label for="chart-modal-title" class="block font-semibold text-slate-700 mb-1">Title</label>
          <input
            id="chart-modal-title"
            type="text"
            bind:value={chartTitle}
            placeholder="Chart Title"
            class="w-full h-8 px-2 bg-slate-50 border border-slate-300 rounded text-xs text-slate-800 focus:border-emerald-500 outline-none"
          />
        </div>
      </div>

      <!-- Chart Live Preview Area (Crisp SVG) -->
      <div class="flex-1 bg-slate-50 border border-slate-200 rounded-lg p-4 flex flex-col items-center justify-center min-h-[220px]">
        {#if chartData.length === 0}
          <div class="text-center text-slate-400">
            <p class="font-semibold mb-1">No data in range {dataRange}</p>
            <p class="text-[11px]">Select a valid cell range with numeric values to render chart.</p>
          </div>
        {:else}
          <svg
            id="sheet-chart-svg"
            viewBox="0 0 460 200"
            class="w-full h-48 overflow-visible select-none"
          >
            <!-- Title -->
            <text x="230" y="16" text-anchor="middle" font-size="12" font-weight="bold" fill="#1e293b">
              {chartTitle}
            </text>

            {#if chartType === 'bar'}
              <!-- Bar Chart SVG -->
              {@const barWidth = Math.min(45, (380 / chartData.length) - 10)}
              <line x1="40" y1="160" x2="430" y2="160" stroke="#cbd5e1" stroke-width="1" />
              {#each chartData as pt, i}
                {@const barH = (pt.value / maxValue) * 125}
                {@const x = 55 + i * (360 / chartData.length)}
                {@const y = 160 - barH}
                <!-- Bar Rect -->
                <rect
                  {x}
                  {y}
                  width={barWidth}
                  height={barH}
                  rx="3"
                  fill={pt.color}
                  class="transition-all hover:opacity-80"
                />
                <!-- Value on top of bar -->
                <text
                  x={x + barWidth / 2}
                  y={y - 4}
                  text-anchor="middle"
                  font-size="9"
                  font-weight="bold"
                  fill="#475569"
                >
                  {pt.value}
                </text>
                <!-- Label below bar -->
                <text
                  x={x + barWidth / 2}
                  y="174"
                  text-anchor="middle"
                  font-size="9"
                  fill="#64748b"
                >
                  {pt.label.length > 8 ? pt.label.slice(0, 7) + '…' : pt.label}
                </text>
              {/each}
            {:else if chartType === 'line'}
              <!-- Line Chart SVG -->
              <line x1="40" y1="160" x2="430" y2="160" stroke="#cbd5e1" stroke-width="1" />
              {@const pts = chartData.map((pt, i) => {
                const x = 55 + i * (360 / Math.max(1, chartData.length - 1));
                const y = 160 - (pt.value / maxValue) * 125;
                return `${x},${y}`;
              }).join(' ')}
              <!-- Polyline -->
              <polyline
                points={pts}
                fill="none"
                stroke="#10b981"
                stroke-width="3"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
              <!-- Points -->
              {#each chartData as pt, i}
                {@const x = 55 + i * (360 / Math.max(1, chartData.length - 1))}
                {@const y = 160 - (pt.value / maxValue) * 125}
                <circle cx={x} cy={y} r="4.5" fill="#10b981" stroke="#ffffff" stroke-width="1.5" />
                <text x={x} y={y - 8} text-anchor="middle" font-size="9" font-weight="bold" fill="#1e293b">
                  {pt.value}
                </text>
                <text x={x} y="174" text-anchor="middle" font-size="9" fill="#64748b">
                  {pt.label}
                </text>
              {/each}
            {:else if chartType === 'pie'}
              <!-- Pie Chart SVG -->
              {@const cx = 170}
              {@const cy = 105}
              {@const r = 65}
              {@const slices = (() => {
                let currentAngle = 0;
                return chartData.map((pt) => {
                  const sliceAngle = totalValue > 0 ? (pt.value / totalValue) * 360 : 0;
                  const startAngle = currentAngle;
                  const endAngle = currentAngle + sliceAngle;
                  currentAngle += sliceAngle;

                  const x1 = cx + r * Math.cos((Math.PI * startAngle) / 180);
                  const y1 = cy + r * Math.sin((Math.PI * startAngle) / 180);
                  const x2 = cx + r * Math.cos((Math.PI * endAngle) / 180);
                  const y2 = cy + r * Math.sin((Math.PI * endAngle) / 180);
                  const largeArc = sliceAngle > 180 ? 1 : 0;

                  return {
                    d: `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`,
                    color: pt.color,
                    label: pt.label,
                    value: pt.value,
                    percent: Math.round((pt.value / totalValue) * 100) || 0,
                  };
                });
              })()}
              {#each slices as slice}
                <path d={slice.d} fill={slice.color} stroke="#ffffff" stroke-width="1.5" />
              {/each}
              <!-- Legend on the right -->
              {#each slices as slice, idx}
                <rect x="270" y={50 + idx * 16} width="10" height="10" rx="2" fill={slice.color} />
                <text x="286" y={59 + idx * 16} font-size="9" fill="#334155">
                  {slice.label}: {slice.value} ({slice.percent}%)
                </text>
              {/each}
            {/if}
          </svg>
        {/if}
      </div>

      <!-- Action Footer -->
      <div class="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
        <button
          type="button"
          class="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 font-medium transition-colors flex items-center space-x-1"
          on:click={exportChartSvg}
          title="Download vector SVG"
        >
          <Download size={13} />
          <span>Export SVG</span>
        </button>

        <div class="flex items-center space-x-2">
          <button
            type="button"
            class="px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-600 font-medium transition-colors"
            on:click={() => dispatch('close')}
          >
            Cancel
          </button>
          <button
            type="button"
            class="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-sm transition-colors flex items-center space-x-1.5"
            on:click={handleInsert}
          >
            <Check size={14} />
            <span>Insert Chart</span>
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}
