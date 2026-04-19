<script lang="ts">
  import type { ActivityWindowEntry } from '../neuron-activity-view.js';

  let { window: activityWindow }: { window: readonly ActivityWindowEntry[] } = $props();

  const dimensions = $derived.by(() => {
    if (activityWindow.length === 0) return { rows: 0, columns: 0 };
    return {
      rows: activityWindow[0]!.rows.length,
      columns: activityWindow.length,
    };
  });

  function colorFor(value: number): string {
    const clamped = Math.max(-1, Math.min(1, value));
    if (clamped >= 0) return `rgba(122, 200, 255, ${clamped.toFixed(3)})`;
    return `rgba(255, 122, 138, ${(-clamped).toFixed(3)})`;
  }

  function rowKindColor(kind: string): string {
    switch (kind) {
      case 'input': return '#7aa6ff';
      case 'output': return '#ffb87a';
      case 'lstm': return '#a37aff';
      default: return '#7affb8';
    }
  }
</script>

<div class="activity-panel" data-testid="neuron-activity-panel">
  <header>
    <span class="label">Neuron activity</span>
    <span class="meta">{dimensions.rows} rows / {dimensions.columns} steps</span>
  </header>
  {#if activityWindow.length === 0}
    <div class="empty">Waiting for activations…</div>
  {:else}
    <div class="grid" style:grid-template-columns={`auto repeat(${dimensions.columns}, 4px)`}>
      {#each Array.from({ length: dimensions.rows }, (_, rowIdx) => rowIdx) as rowIdx (rowIdx)}
        <span class="kind-cell" style:background={rowKindColor(activityWindow[0]!.rowKinds[rowIdx]!)}></span>
        {#each activityWindow as entry (entry.stepIndex)}
          <span class="cell" style:background={colorFor(entry.rows[rowIdx] ?? 0)}></span>
        {/each}
      {/each}
    </div>
  {/if}
</div>

<style>
  .activity-panel {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    background: rgba(15, 20, 30, 0.85);
    border-radius: 0.5rem;
    padding: 0.75rem;
    color: #d6d6df;
    font-family: ui-sans-serif, system-ui, sans-serif;
    font-size: 0.8rem;
    overflow: auto;
    max-height: 360px;
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
  .grid {
    display: grid;
    gap: 1px;
    background: rgba(8, 10, 18, 0.6);
    padding: 4px;
    border-radius: 0.4rem;
  }
  .cell {
    width: 4px;
    height: 8px;
    background: rgba(255, 255, 255, 0.05);
  }
  .kind-cell {
    width: 6px;
    height: 8px;
    border-radius: 1px;
    margin-right: 2px;
  }
  .empty {
    text-align: center;
    color: #707184;
    padding: 2rem 0;
  }
</style>
