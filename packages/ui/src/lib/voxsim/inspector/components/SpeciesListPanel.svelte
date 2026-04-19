<script lang="ts">
  import type { SpeciesListRow } from '../species-list-view.js';

  let {
    rows,
    selectedId,
    onSelect,
  }: {
    rows: SpeciesListRow[];
    selectedId: number | null;
    onSelect: (id: number | null) => void;
  } = $props();

  function sparklinePath(points: { generation: number; bestScore: number }[]): string {
    if (points.length === 0) return '';
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of points) {
      if (p.generation < minX) minX = p.generation;
      if (p.generation > maxX) maxX = p.generation;
      if (p.bestScore < minY) minY = p.bestScore;
      if (p.bestScore > maxY) maxY = p.bestScore;
    }
    const xSpan = Math.max(1e-6, maxX - minX);
    const ySpan = Math.max(1e-6, maxY - minY);
    return points
      .map((p, idx) => {
        const x = ((p.generation - minX) / xSpan) * 60;
        const y = 20 - ((p.bestScore - minY) / ySpan) * 20;
        return `${idx === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }
</script>

<div class="species-panel" data-testid="species-list-panel">
  <header>
    <span class="label">Species</span>
    <span class="meta">{rows.length}</span>
  </header>
  {#if rows.length === 0}
    <div class="empty">No species data</div>
  {:else}
    <ul>
      {#each rows as row (row.id)}
        <li class:selected={row.id === selectedId}>
          <button type="button" onclick={() => onSelect(row.id === selectedId ? null : row.id)}>
            <span class="swatch" style:background={row.color}></span>
            <span class="row-label">#{row.id}</span>
            <span class="size">×{row.size}</span>
            <span class="score">{row.bestScore.toFixed(2)}</span>
            <svg class="sparkline" viewBox="0 0 60 20" preserveAspectRatio="none">
              <path d={sparklinePath(row.sparkline.points)} stroke={row.color} fill="none" stroke-width="1" />
            </svg>
            {#if row.stagnant}
              <span class="badge">stagnant</span>
            {/if}
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .species-panel {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    background: rgba(15, 20, 30, 0.85);
    border-radius: 0.5rem;
    padding: 0.75rem;
    color: #d6d6df;
    font-family: ui-sans-serif, system-ui, sans-serif;
    font-size: 0.8rem;
  }
  header {
    display: flex;
    justify-content: space-between;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    font-size: 0.7rem;
    color: #8b8fa0;
  }
  .label {
    color: #ffffff;
  }
  ul {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  li.selected button {
    background: rgba(122, 200, 255, 0.18);
  }
  button {
    display: grid;
    grid-template-columns: 16px 36px 32px 48px 1fr auto;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    text-align: left;
    background: rgba(8, 10, 18, 0.6);
    border: none;
    padding: 0.4rem 0.6rem;
    border-radius: 0.3rem;
    color: inherit;
    font: inherit;
    cursor: pointer;
  }
  button:hover {
    background: rgba(122, 200, 255, 0.1);
  }
  .swatch {
    width: 14px;
    height: 14px;
    border-radius: 50%;
  }
  .size {
    color: #8b8fa0;
  }
  .score {
    font-variant-numeric: tabular-nums;
    color: #ffffff;
  }
  .sparkline {
    width: 60px;
    height: 20px;
  }
  .badge {
    background: rgba(255, 184, 122, 0.25);
    color: #ffb87a;
    padding: 0.05rem 0.35rem;
    border-radius: 999px;
    font-size: 0.65rem;
    text-transform: uppercase;
  }
  .empty {
    text-align: center;
    color: #707184;
    padding: 2rem 0;
  }
</style>
