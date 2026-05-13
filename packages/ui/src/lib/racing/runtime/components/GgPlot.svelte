<script lang="ts">
  import type { RacingGgPoint } from '../RacingHud.svelte.ts';

  let {
    latG = 0,
    longG = 0,
    trail = [],
  }: {
    latG?: number;
    longG?: number;
    trail?: RacingGgPoint[];
  } = $props();

  const dots = $derived.by(() => {
    const clamp = (value: number) => Math.max(-1.8, Math.min(1.8, value));
    return trail.map((point, index) => ({
      key: `${index}-${point.latG.toFixed(3)}-${point.longG.toFixed(3)}`,
      x: 50 + (clamp(point.latG) / 1.8) * 42,
      y: 50 - (clamp(point.longG) / 1.8) * 42,
      opacity: (index + 1) / Math.max(1, trail.length),
    }));
  });

  const marker = $derived({
    x: 50 + (Math.max(-1.8, Math.min(1.8, latG)) / 1.8) * 42,
    y: 50 - (Math.max(-1.8, Math.min(1.8, longG)) / 1.8) * 42,
  });
</script>

<div class="panel gg" data-testid="hud-gg">
  <div class="gg-row"><span class="label">G-G</span><span class="v">{longG.toFixed(2)} / {latG.toFixed(2)} g</span></div>
  <svg class="gg-canvas" viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Lateral and longitudinal g plot">
    <circle cx="50" cy="50" r="42" class="ring"></circle>
    <circle cx="50" cy="50" r="28" class="ring faint"></circle>
    <line x1="50" y1="6" x2="50" y2="94" class="axis"></line>
    <line x1="6" y1="50" x2="94" y2="50" class="axis"></line>
    {#each dots as dot (dot.key)}
      <circle cx={dot.x} cy={dot.y} r="1.1" fill="#77cfff" opacity={dot.opacity * 0.65}></circle>
    {/each}
    <circle cx={marker.x} cy={marker.y} r="2.2" class="marker"></circle>
  </svg>
</div>

<style>
  .gg {
    position: absolute;
    bottom: 14px;
    right: 14px;
    width: 200px;
    padding: 12px;
    display: grid;
    gap: 6px;
  }
  .gg-canvas {
    width: 100%;
    aspect-ratio: 1 / 1;
    display: block;
    border-radius: 10px;
    background:
      radial-gradient(circle at 50% 50%, rgba(118,203,255,0.10), transparent 70%),
      linear-gradient(180deg, #0a1118, #060a10);
  }
  .gg-row {
    display: flex;
    justify-content: space-between;
    font-size: 10px;
    color: rgba(230, 236, 242, 0.6);
  }
  .gg-row .v {
    color: #e6ecf2;
    font-variant-numeric: tabular-nums;
  }
  .label {
    font-size: 10px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: rgba(230, 236, 242, 0.6);
  }
  .ring {
    fill: none;
    stroke: rgba(255, 255, 255, 0.12);
    stroke-width: 0.8;
  }
  .ring.faint {
    stroke: rgba(255, 255, 255, 0.08);
  }
  .axis {
    stroke: rgba(255, 255, 255, 0.18);
    stroke-width: 0.8;
  }
  .marker {
    fill: #f1c86b;
    stroke: rgba(255,255,255,0.5);
    stroke-width: 0.6;
  }
</style>
