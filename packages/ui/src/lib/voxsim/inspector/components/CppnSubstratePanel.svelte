<script lang="ts">
  import type { SubstrateCell } from '../cppn-substrate-view.js';

  let { cells }: { cells: SubstrateCell[] } = $props();

  const bounds = $derived.by(() => {
    if (cells.length === 0) return null;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const cell of cells) {
      const xs = [cell.sourceCoord.x, cell.targetCoord.x];
      const ys = [cell.sourceCoord.y, cell.targetCoord.y];
      for (const x of xs) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
      }
      for (const y of ys) {
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
    return { minX, maxX, minY, maxY };
  });

  function project(x: number, y: number): { x: number; y: number } {
    if (!bounds) return { x: 0, y: 0 };
    const xSpan = Math.max(1e-6, bounds.maxX - bounds.minX);
    const ySpan = Math.max(1e-6, bounds.maxY - bounds.minY);
    return {
      x: ((x - bounds.minX) / xSpan) * 380 + 10,
      y: ((y - bounds.minY) / ySpan) * 220 + 10,
    };
  }

  function color(weight: number): string {
    if (weight >= 0) return `rgba(122, 200, 255, ${Math.min(1, Math.abs(weight))})`;
    return `rgba(255, 122, 138, ${Math.min(1, Math.abs(weight))})`;
  }
</script>

<div class="cppn-panel" data-testid="cppn-substrate-panel">
  <header>
    <span class="label">CPPN substrate</span>
    <span class="meta">{cells.length} connections</span>
  </header>
  {#if cells.length === 0}
    <div class="empty">No substrate data</div>
  {:else}
    <svg viewBox="0 0 400 240" role="img" aria-label="cppn substrate">
      {#each cells as cell, idx (idx)}
        {@const source = project(cell.sourceCoord.x, cell.sourceCoord.y)}
        {@const target = project(cell.targetCoord.x, cell.targetCoord.y)}
        {#if !cell.pruned}
          <line
            x1={source.x}
            y1={source.y}
            x2={target.x}
            y2={target.y}
            stroke={color(cell.weight)}
            stroke-width={Math.max(0.4, Math.min(2.5, Math.abs(cell.weight) * 2))}
          />
        {/if}
      {/each}
      {#each cells as cell, idx (idx)}
        {@const source = project(cell.sourceCoord.x, cell.sourceCoord.y)}
        <circle cx={source.x} cy={source.y} r="3" fill="#7aa6ff" />
      {/each}
    </svg>
  {/if}
</div>

<style>
  .cppn-panel {
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
  svg {
    width: 100%;
    height: 240px;
    background: rgba(8, 10, 18, 0.6);
    border-radius: 0.4rem;
  }
  .empty {
    text-align: center;
    color: #707184;
    padding: 2rem 0;
  }
</style>
