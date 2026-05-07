<script lang="ts">
  import type { RacingHudTrackConditionState } from '../RacingHud.svelte.ts';

  let { trackCondition }: { trackCondition: RacingHudTrackConditionState } = $props();

  // Temperature colour scale: cold <15°C blue, optimal 25-45°C green,
  // hot >55°C amber, extreme >70°C red.
  function tempColor(c: number): string {
    if (c < 15) return '#77cfff';
    if (c < 45) return '#66f09f';
    if (c < 60) return '#f1c86b';
    return '#ff7070';
  }

  // Rubber-line grip bar: 1.0 = no rubber, typical max ~1.10.
  const rubberBarPct = $derived(Math.min(100, Math.max(0, ((trackCondition.rubberLineGrip - 0.9) / 0.2) * 100)));

  // Bump amplitude bar: 0 – 0.10 m range.
  const bumpBarPct = $derived(Math.min(100, Math.max(0, (trackCondition.bumpAmplitudeM / 0.1) * 100)));
  const wetnessBarPct = $derived(Math.min(100, Math.max(0, trackCondition.wetness * 100)));

  const tempPct = $derived(Math.min(100, Math.max(0, ((trackCondition.trackTempC - 0) / 80) * 100)));
</script>

<div class="panel track-surface-panel" data-testid="hud-track-surface">
  <span class="label">Track Surface (M4)</span>
  <div class="debug-grid">
    <div class="debug-row">
      <span>Temp</span>
      <div class="meter temp-meter">
        <span class="temp-fill" style="width: {tempPct}%; background: {tempColor(trackCondition.trackTempC)}"></span>
      </div>
      <span style="color: {tempColor(trackCondition.trackTempC)}">{Math.round(trackCondition.trackTempC)} °C</span>
    </div>
    <div class="debug-row">
      <span>Rubber</span>
      <div class="meter rubber-meter">
        <span style="width: {rubberBarPct}%"></span>
      </div>
      <span>{trackCondition.rubberLineGrip.toFixed(3)}×</span>
    </div>
    <div class="debug-row">
      <span>Bumps</span>
      <div class="meter bump-meter">
        <span style="width: {bumpBarPct}%"></span>
      </div>
      <span>{(trackCondition.bumpAmplitudeM * 1000).toFixed(1)} mm</span>
    </div>
    <div class="debug-row">
      <span>Wet</span>
      <div class="meter wetness-meter">
        <span style="width: {wetnessBarPct}%"></span>
      </div>
      <span>{wetnessBarPct.toFixed(0)}%</span>
    </div>
    <div class="debug-row terrain-row">
      <span>Cond.</span>
      <span class="terrain-badge condition-badge">{trackCondition.condition}</span>
    </div>
    <div class="debug-row terrain-row">
      <span>Terrain</span>
      <span
        class="terrain-badge"
        class:terrain-active={trackCondition.terrainActive}
      >{trackCondition.terrainActive ? 'ELEVATION' : 'FLAT'}</span>
    </div>
  </div>
</div>

<style>
  .track-surface-panel {
    padding: 12px;
    display: grid;
    gap: 8px;
    width: 240px;
  }
  .label {
    font-size: 10px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: rgba(230, 236, 242, 0.6);
  }
  .debug-grid {
    display: grid;
    gap: 6px;
  }
  .debug-row {
    display: grid;
    grid-template-columns: 52px 1fr 52px;
    gap: 6px;
    align-items: center;
    font-size: 11px;
    color: rgba(230, 236, 242, 0.82);
  }
  .debug-row span:last-child {
    text-align: right;
    font-variant-numeric: tabular-nums;
    color: #77cfff;
  }
  .terrain-row {
    grid-template-columns: 52px 1fr;
  }
  .meter {
    height: 4px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.06);
    overflow: hidden;
    position: relative;
  }
  .meter > span {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    border-radius: 999px;
    transition: width 80ms linear;
  }
  .temp-fill {
    transition: width 80ms linear, background 200ms linear;
  }
  .rubber-meter > span {
    background: linear-gradient(90deg, #7be4cd, #66f09f, #f1c86b);
  }
  .bump-meter > span {
    background: linear-gradient(90deg, #66f09f, #f1c86b, #ff7070);
  }
  .wetness-meter > span {
    background: linear-gradient(90deg, #77cfff, #3478f6);
  }
  .terrain-badge {
    padding: 2px 8px;
    border-radius: 6px;
    font-size: 9px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    background: rgba(119, 207, 255, 0.08);
    border: 1px solid rgba(119, 207, 255, 0.25);
    color: rgba(119, 207, 255, 0.6);
    text-align: center;
    justify-self: start;
  }
  .terrain-badge.terrain-active {
    background: rgba(102, 240, 159, 0.12);
    border-color: rgba(102, 240, 159, 0.4);
    color: #66f09f;
  }
  .condition-badge {
    max-width: 150px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
