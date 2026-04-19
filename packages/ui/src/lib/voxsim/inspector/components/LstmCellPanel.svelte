<script lang="ts">
  import type { LstmCellSample } from '../lstm-cell-view.js';

  let {
    nodeIds,
    windowFor,
  }: {
    nodeIds: readonly number[];
    windowFor: (nodeId: number) => readonly LstmCellSample[];
  } = $props();

  function gateValue(samples: readonly LstmCellSample[], gate: 'input' | 'forget' | 'output' | 'candidate'): number {
    const last = samples[samples.length - 1];
    return last ? last.gates[gate] : 0;
  }

  function stateValue(samples: readonly LstmCellSample[], key: 'cellState' | 'hiddenState'): number {
    const last = samples[samples.length - 1];
    return last ? last.gates[key] : 0;
  }

  function barColor(value: number): string {
    if (value >= 0) return `rgba(122, 200, 255, ${Math.min(1, Math.abs(value))})`;
    return `rgba(255, 122, 138, ${Math.min(1, Math.abs(value))})`;
  }

  function clampPercent(value: number): string {
    return `${Math.max(2, Math.min(100, Math.abs(value) * 100)).toFixed(0)}%`;
  }
</script>

<div class="lstm-panel" data-testid="lstm-cell-panel">
  <header>
    <span class="label">LSTM cells</span>
    <span class="meta">{nodeIds.length} nodes</span>
  </header>
  {#if nodeIds.length === 0}
    <div class="empty">No LSTM nodes</div>
  {:else}
    <ul>
      {#each nodeIds as id (id)}
        {@const samples = windowFor(id)}
        <li>
          <span class="node-id">#{id}</span>
          <div class="bars">
            {#each ['input', 'forget', 'output', 'candidate'] as gate (gate)}
              <span class="bar" title={gate}>
                <span class="fill" style:width={clampPercent(gateValue(samples, gate as 'input' | 'forget' | 'output' | 'candidate'))} style:background={barColor(gateValue(samples, gate as 'input' | 'forget' | 'output' | 'candidate'))}></span>
              </span>
            {/each}
          </div>
          <span class="state">cell {stateValue(samples, 'cellState').toFixed(2)} / hid {stateValue(samples, 'hiddenState').toFixed(2)}</span>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .lstm-panel {
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
    gap: 0.4rem;
  }
  li {
    display: grid;
    grid-template-columns: 32px 1fr 160px;
    align-items: center;
    gap: 0.5rem;
  }
  .node-id {
    color: #8b8fa0;
  }
  .bars {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 2px;
  }
  .bar {
    height: 8px;
    background: rgba(8, 10, 18, 0.6);
    border-radius: 1px;
    position: relative;
    overflow: hidden;
  }
  .fill {
    display: block;
    height: 100%;
  }
  .state {
    text-align: right;
    font-variant-numeric: tabular-nums;
    color: #8b8fa0;
  }
  .empty {
    text-align: center;
    color: #707184;
    padding: 2rem 0;
  }
</style>
