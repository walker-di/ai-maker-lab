<script lang="ts">
  import type { RacingHudWheelState } from '../RacingHud.svelte.ts';

  let { wheels }: { wheels: RacingHudWheelState[] } = $props();

  const labels = ['FL', 'FR', 'RL', 'RR'];

  // Typical road-car range: 180–350 kPa. Colour scale: cold <200 = blue,
  // optimal 210–230 = green, high >260 = amber, very high >300 = red.
  function pressureColor(kpa: number): string {
    if (kpa < 200) return '#77cfff';
    if (kpa < 240) return '#66f09f';
    if (kpa < 280) return '#f1c86b';
    return '#ff7070';
  }

  // Scale bar: 180 kPa → 0 %, 320 kPa → 100 %
  const BAR_MIN = 180;
  const BAR_RANGE = 140;
  function pressurePct(kpa: number): number {
    return Math.min(100, Math.max(0, ((kpa - BAR_MIN) / BAR_RANGE) * 100));
  }

  // Deflection in mm, capped for display at 10 mm
  function deflMm(m: number): string {
    return (m * 1000).toFixed(1);
  }
</script>

<div class="panel tire-pressure-panel" data-testid="hud-tire-pressure">
  <span class="label">Tire Pressure / Deflection</span>
  <div class="grid">
    {#each wheels as wheel (wheel.index)}
      {@const color = pressureColor(wheel.pressureKpa)}
      {@const pct = pressurePct(wheel.pressureKpa)}
      {@const corner = labels[wheel.index] ?? `W${wheel.index}`}
      <div class="row">
        <span class="corner">{corner}</span>
        <span class="bar-wrap"><span class="bar-fill" style="width: {pct}%; background: {color}"></span></span>
        <span class="val" style="color: {color}">{Math.round(wheel.pressureKpa)} kPa</span>
        <span class="defl">{deflMm(wheel.tireDeflection)} mm</span>
      </div>
    {/each}
  </div>
</div>

<style>
  .tire-pressure-panel {
    padding: 12px;
    display: grid;
    gap: 8px;
  }
  .label {
    font-size: 10px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: rgba(230, 236, 242, 0.6);
  }
  .grid {
    display: grid;
    gap: 6px;
  }
  .row {
    display: grid;
    grid-template-columns: 28px 1fr 70px 44px;
    gap: 6px;
    align-items: center;
    font-size: 11px;
  }
  .corner {
    color: rgba(230, 236, 242, 0.82);
    font-weight: 600;
  }
  .bar-wrap {
    height: 5px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.07);
    overflow: hidden;
    display: block;
  }
  .bar-fill {
    display: block;
    height: 100%;
    border-radius: 999px;
    transition: width 80ms linear, background 200ms linear;
  }
  .val {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  .defl {
    text-align: right;
    font-variant-numeric: tabular-nums;
    color: rgba(230, 236, 242, 0.55);
    font-size: 10px;
  }
</style>
