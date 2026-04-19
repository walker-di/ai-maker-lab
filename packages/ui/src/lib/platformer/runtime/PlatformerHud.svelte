<script lang="ts">
  import type { PlatformerHudModel } from './PlatformerHud.svelte.ts';

  let { model }: { model: PlatformerHudModel } = $props();

  const powerLabel = $derived.by(() => {
    switch (model.state.power) {
      case 'grow': return 'BIG';
      case 'fire': return 'FIRE';
      case 'star': return 'STAR';
      default: return 'SMALL';
    }
  });
</script>

<div class="platformer-hud" data-testid="platformer-hud">
  <div class="cell" data-testid="hud-world">
    <span class="label">World</span>
    <span class="value">{model.state.worldLabel}</span>
  </div>
  <div class="cell" data-testid="hud-score">
    <span class="label">Score</span>
    <span class="value">{model.state.score.toString().padStart(6, '0')}</span>
  </div>
  <div class="cell" data-testid="hud-coins">
    <span class="label">Coins</span>
    <span class="value">x{model.state.coins.toString().padStart(2, '0')}</span>
  </div>
  <div class="cell" data-testid="hud-lives">
    <span class="label">Lives</span>
    <span class="value">{model.state.lives}</span>
  </div>
  <div class="cell" data-testid="hud-time">
    <span class="label">Time</span>
    <span class="value">{model.state.time.toString().padStart(3, '0')}</span>
  </div>
  <div class="cell" data-testid="hud-power">
    <span class="label">Power</span>
    <span class="value">{powerLabel}</span>
  </div>
</div>

<style>
  .platformer-hud {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 0.75rem;
    padding: 0.5rem 1rem;
    background: rgba(20, 20, 30, 0.85);
    color: #f0f0f0;
    font-family: ui-monospace, monospace;
    font-size: 0.85rem;
    letter-spacing: 0.04em;
    border-radius: 0 0 0.5rem 0.5rem;
  }
  .cell {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.1rem;
  }
  .label {
    color: #b0b0c0;
    text-transform: uppercase;
    font-size: 0.7rem;
  }
  .value {
    font-weight: 600;
    color: #fffdfa;
  }
</style>
