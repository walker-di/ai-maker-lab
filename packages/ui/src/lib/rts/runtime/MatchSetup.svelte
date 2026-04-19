<script lang="ts" module>
  import type { AiDifficulty as _AiDifficulty } from '../types.js';
  export interface MatchSetupResult {
    mapId: string;
    aiDifficulty: _AiDifficulty;
    fogOfWar: boolean;
    seed: number;
  }
</script>
<script lang="ts">
  import type { AiDifficulty, ResolvedRtsMap } from '../types.js';

  let {
    maps,
    onStart,
    onGenerateMap,
    busy = false,
  }: {
    maps: ResolvedRtsMap[];
    onStart: (result: MatchSetupResult) => void;
    onGenerateMap?: () => void;
    busy?: boolean;
  } = $props();

  let mapId = $state(maps[0]?.id ?? '');
  let aiDifficulty = $state<AiDifficulty>('normal');
  let fogOfWar = $state(true);
  let seed = $state(Date.now() & 0x7fffffff);

  $effect(() => {
    if (!mapId && maps.length > 0) mapId = maps[0]!.id;
  });
</script>

<form
  class="match-setup"
  data-testid="match-setup"
  onsubmit={(event) => {
    event.preventDefault();
    onStart({ mapId, aiDifficulty, fogOfWar, seed });
  }}
>
  <h2>Skirmish setup</h2>
  <label>
    <span>Map</span>
    <select bind:value={mapId} data-testid="match-setup-map">
      {#each maps as map (map.id)}
        <option value={map.id}>{map.metadata.title} ({map.source})</option>
      {/each}
    </select>
  </label>
  <label>
    <span>AI difficulty</span>
    <select bind:value={aiDifficulty} data-testid="match-setup-difficulty">
      <option value="easy">Easy</option>
      <option value="normal">Normal</option>
      <option value="hard">Hard</option>
    </select>
  </label>
  <label class="row">
    <input type="checkbox" bind:checked={fogOfWar} data-testid="match-setup-fog" />
    <span>Fog of war</span>
  </label>
  <label>
    <span>Seed</span>
    <input type="number" bind:value={seed} data-testid="match-setup-seed" />
  </label>
  <div class="actions">
    <button type="submit" data-testid="match-setup-start" disabled={busy || !mapId}>Start match</button>
    {#if onGenerateMap}
      <button type="button" data-testid="match-setup-generate" onclick={() => onGenerateMap?.()} disabled={busy}>
        Generate map
      </button>
    {/if}
  </div>
</form>

<style>
  .match-setup {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1rem;
    border-radius: 0.5rem;
    background: rgba(20, 20, 30, 0.85);
    color: #f0f0f0;
    max-width: 24rem;
  }
  h2 { margin: 0; font-size: 1.1rem; }
  label { display: flex; flex-direction: column; gap: 0.25rem; }
  label.row { flex-direction: row; align-items: center; gap: 0.5rem; }
  select, input { background: #181822; color: #fff; border: 1px solid #444; border-radius: 0.25rem; padding: 0.25rem 0.5rem; font: inherit; }
  .actions { display: flex; gap: 0.5rem; }
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
</style>
