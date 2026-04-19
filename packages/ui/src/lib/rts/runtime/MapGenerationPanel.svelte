<script lang="ts">
  import type { MapGenerationParams } from '../types.js';

  let {
    initialParams,
    onGenerate,
    onSave,
    busy = false,
    lastError = null,
  }: {
    initialParams: MapGenerationParams;
    onGenerate: (params: MapGenerationParams) => void;
    onSave?: (title: string, author: string) => void;
    busy?: boolean;
    lastError?: string | null;
  } = $props();

  let params = $state<MapGenerationParams>({ ...initialParams });
  let title = $state('Generated map');
  let author = $state('me');

  function reseed(): void {
    params = { ...params, seed: Math.floor(Math.random() * 0x7fffffff) };
  }

  function nextResourceDensity(): void {
    const order: MapGenerationParams['resourceDensity'][] = ['sparse', 'normal', 'rich'];
    const idx = order.indexOf(params.resourceDensity);
    params = { ...params, resourceDensity: order[(idx + 1) % order.length]! };
  }

  function flipSymmetry(): void {
    const order: MapGenerationParams['symmetry'][] = ['mirrorH', 'mirrorV', 'rotational180', 'none'];
    const idx = order.indexOf(params.symmetry);
    params = { ...params, symmetry: order[(idx + 1) % order.length]! };
  }
</script>

<form
  class="mapgen"
  data-testid="mapgen-panel"
  onsubmit={(event) => {
    event.preventDefault();
    onGenerate({ ...params });
  }}
>
  <h2>Map generator</h2>
  <label>
    <span>Archetype</span>
    <select bind:value={params.archetype} data-testid="mapgen-archetype">
      <option value="open-field">Open field</option>
      <option value="cliffs-and-ramps">Cliffs &amp; ramps</option>
      <option value="island-shores">Island shores</option>
    </select>
  </label>
  <label class="grid">
    <span>Cols</span>
    <input type="number" min="16" max="128" bind:value={params.size.cols} />
    <span>Rows</span>
    <input type="number" min="16" max="128" bind:value={params.size.rows} />
  </label>
  <label class="grid">
    <span>Factions</span>
    <input type="number" min="2" max="4" bind:value={params.factionCount} />
    <span>Max altitude</span>
    <input type="number" min="0" max="3" bind:value={params.maxAltitude} />
  </label>
  <label class="grid">
    <span>Water</span>
    <input type="number" step="0.1" min="0" max="1" bind:value={params.waterAmount} />
    <span>Ramps</span>
    <input type="number" min="0" max="6" bind:value={params.ramps} />
  </label>
  <label>
    <span>Roughness</span>
    <select bind:value={params.altitudeRoughness}>
      <option value="flat">Flat</option>
      <option value="rolling">Rolling</option>
      <option value="rugged">Rugged</option>
    </select>
  </label>
  <div class="row">
    <button type="button" data-testid="mapgen-reseed" onclick={reseed}>Reseed ({params.seed})</button>
    <button type="button" data-testid="mapgen-density" onclick={nextResourceDensity}>{params.resourceDensity}</button>
    <button type="button" data-testid="mapgen-symmetry" onclick={flipSymmetry}>{params.symmetry}</button>
  </div>
  <div class="actions">
    <button type="submit" data-testid="mapgen-generate" disabled={busy}>Generate</button>
    {#if onSave}
      <input type="text" bind:value={title} placeholder="title" />
      <input type="text" bind:value={author} placeholder="author" />
      <button type="button" data-testid="mapgen-save" onclick={() => onSave?.(title, author)} disabled={busy}>Save</button>
    {/if}
  </div>
  {#if lastError}
    <p class="error" data-testid="mapgen-error">{lastError}</p>
  {/if}
</form>

<style>
  .mapgen {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 1rem;
    border-radius: 0.5rem;
    background: rgba(20, 20, 30, 0.85);
    color: #f0f0f0;
    max-width: 24rem;
  }
  h2 { margin: 0; font-size: 1.1rem; }
  label { display: flex; flex-direction: column; gap: 0.25rem; }
  label.grid { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; align-items: center; gap: 0.5rem; }
  .row { display: flex; gap: 0.5rem; }
  .actions { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }
  select, input {
    background: #181822;
    color: #fff;
    border: 1px solid #444;
    border-radius: 0.25rem;
    padding: 0.25rem 0.5rem;
    font: inherit;
  }
  button {
    border-radius: 0.25rem;
    background: #2c3a4d;
    color: #fff;
    border: 1px solid rgba(255, 255, 255, 0.18);
    padding: 0.4rem 0.8rem;
    font: inherit;
    cursor: pointer;
  }
  button:hover { background: #3b4d66; }
  button:disabled { opacity: 0.5; cursor: not-allowed; }
  .error { color: #ffaaaa; margin: 0; font-size: 0.85rem; }
</style>
