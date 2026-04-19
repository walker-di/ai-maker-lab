<script lang="ts">
  import type { InspectorChartSeries } from '../types.js';

  let { series }: { series: InspectorChartSeries[] } = $props();

  function buildPath(points: { x: number; y: number }[], width: number, height: number): string {
    if (points.length === 0) return '';
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of points) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    const xSpan = Math.max(1e-6, maxX - minX);
    const ySpan = Math.max(1e-6, maxY - minY);
    return points
      .map((p, idx) => {
        const x = ((p.x - minX) / xSpan) * (width - 8) + 4;
        const y = height - 4 - ((p.y - minY) / ySpan) * (height - 8);
        return `${idx === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }
</script>

<div class="charts-panel" data-testid="training-charts-panel">
  {#each series as s (s.id)}
    <div class="chart" data-series-id={s.id}>
      <header>
        <span class="label">{s.label}</span>
        <span class="value">{s.points.length > 0 ? s.points[s.points.length - 1]!.y.toFixed(3) : '—'}</span>
      </header>
      <svg viewBox="0 0 200 60" preserveAspectRatio="none">
        <path d={buildPath(s.points, 200, 60)} stroke="#7aa6ff" fill="none" stroke-width="1.5" />
      </svg>
    </div>
  {/each}
</div>

<style>
  .charts-panel {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 0.5rem;
    color: #d6d6df;
    font-family: ui-sans-serif, system-ui, sans-serif;
    font-size: 0.8rem;
  }
  .chart {
    background: rgba(15, 20, 30, 0.85);
    border-radius: 0.5rem;
    padding: 0.5rem 0.75rem;
  }
  header {
    display: flex;
    justify-content: space-between;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    font-size: 0.65rem;
    color: #8b8fa0;
  }
  .value {
    color: #ffffff;
  }
  svg {
    width: 100%;
    height: 50px;
    margin-top: 0.25rem;
  }
</style>
