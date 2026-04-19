<script lang="ts">
  import type { RtsHudModel } from './RtsHud.svelte.ts';
  import type { BuildingKind, UnitKind } from '../types.js';

  let {
    model,
    onProduceUnit,
    onPlaceBuilding,
    onCancelBuilding,
  }: {
    model: RtsHudModel;
    onProduceUnit?: (kind: UnitKind) => void;
    onPlaceBuilding?: (kind: BuildingKind) => void;
    onCancelBuilding?: () => void;
  } = $props();

  const elapsedLabel = $derived.by(() => {
    const total = Math.floor(model.state.elapsedMs / 1000);
    const minutes = Math.floor(total / 60).toString().padStart(2, '0');
    const seconds = (total % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
  });
</script>

<div class="rts-hud" data-testid="rts-hud">
  <div class="row top">
    <div class="cell" data-testid="hud-mineral">
      <span class="label">Mineral</span>
      <span class="value">{model.state.mineral}</span>
    </div>
    <div class="cell" data-testid="hud-gas">
      <span class="label">Gas</span>
      <span class="value">{model.state.gas}</span>
    </div>
    <div class="cell" data-testid="hud-supply">
      <span class="label">Supply</span>
      <span class="value">{model.state.supplyUsed} / {model.state.supplyCap}</span>
    </div>
    <div class="cell" data-testid="hud-time">
      <span class="label">Time</span>
      <span class="value">{elapsedLabel}</span>
    </div>
    <div class="cell" data-testid="hud-selection">
      <span class="label">Selection</span>
      <span class="value">{model.state.selectionCount} {model.state.selectionLabel}</span>
    </div>
    <div class="cell" data-testid="hud-faction">
      <span class="label">Faction</span>
      <span class="value">{model.state.factionId}</span>
    </div>
  </div>

  <div class="row bottom">
    <div class="group">
      <span class="label">Train</span>
      <button type="button" data-testid="train-worker" onclick={() => onProduceUnit?.('worker')}>Worker</button>
      <button type="button" data-testid="train-rifleman" onclick={() => onProduceUnit?.('rifleman')}>Rifleman</button>
      <button type="button" data-testid="train-rocket" onclick={() => onProduceUnit?.('rocket')}>Rocket</button>
      <button type="button" data-testid="train-scout" onclick={() => onProduceUnit?.('scout')}>Scout</button>
    </div>
    <div class="group">
      <span class="label">Build</span>
      <button type="button" data-testid="build-depot" onclick={() => onPlaceBuilding?.('depot')}>Depot</button>
      <button type="button" data-testid="build-barracks" onclick={() => onPlaceBuilding?.('barracks')}>Barracks</button>
      <button type="button" data-testid="build-factory" onclick={() => onPlaceBuilding?.('factory')}>Factory</button>
      <button type="button" data-testid="build-turret" onclick={() => onPlaceBuilding?.('turret')}>Turret</button>
      {#if model.state.buildingMode}
        <button type="button" class="danger" onclick={() => onCancelBuilding?.()}>Cancel ({model.state.buildingMode})</button>
      {/if}
    </div>
  </div>
</div>

<style>
  .rts-hud {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: rgba(20, 20, 30, 0.85);
    color: #f0f0f0;
    font-family: ui-monospace, monospace;
    font-size: 0.85rem;
    letter-spacing: 0.04em;
    border-radius: 0.5rem;
  }
  .row.top { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 0.5rem; }
  .row.bottom { display: flex; flex-wrap: wrap; gap: 1rem; }
  .cell { display: flex; flex-direction: column; align-items: flex-start; }
  .group { display: flex; flex-wrap: wrap; align-items: center; gap: 0.35rem; }
  .label { color: #b0b0c0; text-transform: uppercase; font-size: 0.7rem; }
  .value { font-weight: 600; color: #fffdfa; }
  button {
    border-radius: 0.25rem;
    background: #2c3a4d;
    color: #fff;
    border: 1px solid rgba(255, 255, 255, 0.18);
    padding: 0.25rem 0.5rem;
    font: inherit;
    cursor: pointer;
  }
  button:hover { background: #3b4d66; }
  button.danger { background: #6e2d2d; }
</style>
