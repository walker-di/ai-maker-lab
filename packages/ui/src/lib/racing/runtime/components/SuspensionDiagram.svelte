<script lang="ts">
  import type { RacingHudWheelState } from '../RacingHud.svelte.ts';

  let { wheels }: { wheels: RacingHudWheelState[] } = $props();

  const CORNERS = ['FL', 'FR', 'RL', 'RR'] as const;
  const MAX_TRAVEL_M = 0.12;
  const MAX_DAMP_VEL = 0.5;
  // Diagram column height in px (SVG viewport units).
  const COL_H = 80;
  const COL_W = 32;

  function travelFrac(w: RacingHudWheelState): number {
    return Math.min(1, Math.max(0, w.suspensionTravel / MAX_TRAVEL_M));
  }

  function dampFrac(w: RacingHudWheelState): number {
    // 0 = full rebound, 0.5 = static, 1 = full bump
    return Math.min(1, Math.max(0, w.damperVelocity / MAX_DAMP_VEL * 0.5 + 0.5));
  }

  function travelColor(f: number): string {
    if (f < 0.5) return '#66f09f';
    if (f < 0.8) return '#f1c86b';
    return '#ff7070';
  }

  function dampColor(f: number): string {
    // compression (f > 0.5) = warm, rebound (f < 0.5) = cool
    if (f >= 0.5) return '#f1c86b';
    return '#77cfff';
  }

  function rcColor(h: number): string {
    // low RC (< 0.1m) = cool, high (> 0.25m) = warm
    if (h < 0.1) return '#77cfff';
    if (h < 0.2) return '#66f09f';
    return '#f1c86b';
  }

  // Format ± value with sign
  function fmt(v: number, digits = 2): string {
    return `${v >= 0 ? '+' : ''}${v.toFixed(digits)}`;
  }
</script>

<div class="panel suspension-diagram" data-testid="hud-suspension-diagram">
  <span class="label">Suspension Kinematics</span>

  <!-- Four-corner travel + damper SVG diagram -->
  <div class="diagram-grid">
    {#each wheels as w, i (w.index)}
      {@const tf = travelFrac(w)}
      {@const df = dampFrac(w)}
      {@const tC = travelColor(tf)}
      {@const dC = dampColor(df)}
      <div class="corner-col">
        <span class="corner-label">{CORNERS[i] ?? `W${i}`}</span>
        <svg
          width={COL_W}
          height={COL_H}
          viewBox="0 0 {COL_W} {COL_H}"
          aria-label="{CORNERS[i]} suspension travel"
          role="img"
        >
          <!-- Background track -->
          <rect x="6" y="0" width="8" height={COL_H} rx="4" fill="rgba(255,255,255,0.05)" />
          <!-- Travel fill (top = full compression) -->
          <rect
            x="6"
            y={COL_H * (1 - tf)}
            width="8"
            height={COL_H * tf}
            rx="4"
            fill={tC}
            opacity="0.85"
          />
          <!-- Damper velocity indicator — bidirectional from center -->
          <rect x="18" y="0" width="8" height={COL_H} rx="4" fill="rgba(255,255,255,0.05)" />
          {#if df >= 0.5}
            <!-- compression: center→top -->
            <rect
              x="18"
              y={COL_H * (0.5 - (df - 0.5))}
              width="8"
              height={COL_H * (df - 0.5)}
              rx="4"
              fill={dC}
              opacity="0.85"
            />
          {:else}
            <!-- rebound: center→bottom -->
            <rect
              x="18"
              y={COL_H * 0.5}
              width="8"
              height={COL_H * (0.5 - df)}
              rx="4"
              fill={dC}
              opacity="0.85"
            />
          {/if}
          <!-- Center line for damper column -->
          <line x1="18" y1={COL_H * 0.5} x2="26" y2={COL_H * 0.5} stroke="rgba(255,255,255,0.18)" stroke-width="1" />
        </svg>
        <span class="corner-val" style="color:{tC}">{(w.suspensionTravel * 1000).toFixed(0)}<span class="unit">mm</span></span>
      </div>
    {/each}
  </div>

  <div class="legend">
    <span class="legend-item"><span class="swatch" style="background:#77cfff"></span>Travel</span>
    <span class="legend-item"><span class="swatch" style="background:#f1c86b"></span>Damp·V</span>
  </div>

  <!-- Per-corner numeric table: roll center, jacking, camber, toe -->
  <div class="metrics-grid">
    <div class="metrics-head">
      <span></span>
      <span>RC (m)</span>
      <span>Jack (N)</span>
      <span>Camb °</span>
      <span>Toe °</span>
    </div>
    {#each wheels as w, i (w.index)}
      <div class="metrics-row">
        <span class="mc">{CORNERS[i] ?? `W${i}`}</span>
        <span style="color:{rcColor(w.rollCenterHeightM)}">{w.rollCenterHeightM.toFixed(3)}</span>
        <span class:pos={w.jackingForceN > 5} class:neg={w.jackingForceN < -5}>{fmt(w.jackingForceN, 0)}</span>
        <span>{w.camberDeg.toFixed(2)}</span>
        <span>{fmt(w.toeDeg, 3)}</span>
      </div>
    {/each}
  </div>
</div>

<style>
  .suspension-diagram {
    padding: 12px;
    display: grid;
    gap: 10px;
    width: 280px;
  }
  .label {
    font-size: 10px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: rgba(230, 236, 242, 0.6);
  }
  .diagram-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 4px;
    align-items: end;
  }
  .corner-col {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }
  .corner-label {
    font-size: 9px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: rgba(230, 236, 242, 0.55);
  }
  .corner-val {
    font-size: 10px;
    font-variant-numeric: tabular-nums;
    font-weight: 600;
  }
  .unit {
    font-size: 8px;
    font-weight: 400;
    margin-left: 1px;
    color: rgba(230, 236, 242, 0.5);
  }
  .legend {
    display: flex;
    gap: 10px;
    font-size: 9px;
    color: rgba(230, 236, 242, 0.55);
  }
  .legend-item {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .swatch {
    width: 8px;
    height: 8px;
    border-radius: 2px;
    display: inline-block;
    opacity: 0.75;
  }
  .metrics-grid {
    display: grid;
    gap: 4px;
  }
  .metrics-head, .metrics-row {
    display: grid;
    grid-template-columns: 28px 1fr 1fr 1fr 1fr;
    gap: 4px;
    font-size: 10px;
  }
  .metrics-head {
    color: rgba(230, 236, 242, 0.45);
    font-size: 9px;
    letter-spacing: 0.06em;
    border-bottom: 1px solid rgba(255, 255, 255, 0.07);
    padding-bottom: 4px;
  }
  .metrics-head span, .metrics-row span {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  .metrics-head span:first-child, .metrics-row span:first-child {
    text-align: left;
  }
  .metrics-row {
    color: #77cfff;
  }
  .mc {
    color: rgba(230, 236, 242, 0.7);
    font-weight: 600;
  }
  .pos { color: #f1c86b; }
  .neg { color: #ff7070; }
</style>
