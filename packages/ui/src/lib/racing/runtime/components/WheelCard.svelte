<script lang="ts">
  import type { RacingHudWheelState } from '../RacingHud.svelte.ts';

  let { wheel }: { wheel: RacingHudWheelState } = $props();

  const labels = ['FL', 'FR', 'RL', 'RR'];
  const label = $derived(labels[wheel.index] ?? `${wheel.index}`);
  const fzPct = $derived(Math.min(100, Math.max(0, (wheel.fz / 6000) * 100)));
  const slipAnglePct = $derived(Math.min(100, Math.abs(wheel.slipAngle * (180 / Math.PI)) * 5));
  const slipRatioPct = $derived(Math.min(100, Math.abs(wheel.slipRatio) * 100));
  const tempPct = $derived(Math.min(100, Math.max(0, ((wheel.tempC - 20) / 160) * 100)));
  const brakeTempPct = $derived(Math.min(100, Math.max(0, ((wheel.brakeTempC - 20) / 600) * 100)));
  const bumpPct = $derived(Math.min(100, Math.max(0, wheel.bumpStopPct * 100)));
</script>

<div class="panel wheel-card" data-testid="hud-wheel-{wheel.index}" class:airborne={wheel.airborne}>
  <div class="head">
    <span class="pos">{label}</span>
    <span class="surf">{wheel.airborne ? 'AIR' : (wheel.surface ?? 'ASPHALT')}</span>
  </div>
  <div class="row"><span class="label2">Slip α</span><div class="meter slip"><span style="width: {slipAnglePct}%"></span></div><span class="v">{(wheel.slipAngle * (180 / Math.PI)).toFixed(1)}°</span></div>
  <div class="row"><span class="label2">Slip k</span><div class="meter slip"><span style="width: {slipRatioPct}%"></span></div><span class="v">{wheel.slipRatio.toFixed(2)}</span></div>
  <div class="row"><span class="label2">Load</span><div class="meter fz"><span style="width: {fzPct}%"></span></div><span class="v">{Math.round(wheel.fz)} N</span></div>
  <div class="row"><span class="label2">Bump</span><div class="meter bs"><span style="width: {bumpPct}%"></span></div><span class="v">{wheel.airborne ? 'clear' : `${Math.round(bumpPct)}%`}</span></div>
  <div class="row"><span class="label2">Tire</span><div class="meter temp"><span style="width: {tempPct}%"></span></div><span class="v">{Math.round(wheel.tempC)}°</span></div>
  <div class="row"><span class="label2">Brake</span><div class="meter temp"><span style="width: {brakeTempPct}%"></span></div><span class="v">{Math.round(wheel.brakeTempC)}°</span></div>
</div>

<style>
  .wheel-card {
    padding: 10px;
    display: grid;
    gap: 4px;
  }
  .head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 10px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: rgba(230, 236, 242, 0.6);
  }
  .head .pos { color: #e6ecf2; font-weight: 600; }
  .head .surf {
    padding: 2px 6px;
    border-radius: 6px;
    font-size: 9px;
    background: rgba(118, 203, 255, 0.1);
    border: 1px solid rgba(118, 203, 255, 0.3);
    color: #77cfff;
  }
  .row {
    display: grid;
    grid-template-columns: 60px 1fr 42px;
    gap: 6px;
    align-items: center;
    font-size: 10px;
  }
  .row .label2 { color: rgba(230, 236, 242, 0.6); letter-spacing: 0.06em; }
  .row .v {
    text-align: right;
    color: #e6ecf2;
    font-variant-numeric: tabular-nums;
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
  }
  .meter.fz > span { background: linear-gradient(90deg, #7be4cd, #77cfff); }
  .meter.slip > span { background: linear-gradient(90deg, #66f09f, #f1c86b, #ff7070); }
  .meter.temp > span { background: linear-gradient(90deg, #7be4cd, #66f09f, #f1c86b, #ff7070); }
  .meter.bs > span { background: linear-gradient(90deg, #4a5563, #f1c86b, #ff7070); }
  .airborne .head .surf {
    background: rgba(255, 112, 112, 0.15);
    border-color: rgba(255, 112, 112, 0.4);
    color: #ff7070;
  }
</style>
