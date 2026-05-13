<script lang="ts">
  import type { RacingHudInputState } from '../RacingHud.svelte.ts';

  let {
    input,
    ackermannDeltaDeg = 0,
  }: {
    input: RacingHudInputState;
    ackermannDeltaDeg?: number;
  } = $props();

  const throttlePct = $derived(Math.round(Math.max(0, Math.min(1, input.throttle)) * 100));
  const brakePct = $derived(Math.round(Math.max(0, Math.min(1, input.brake)) * 100));
  const handbrakePct = $derived(Math.round(Math.max(0, Math.min(1, input.handbrake)) * 100));
  const steerPct = $derived(50 + Math.max(-50, Math.min(50, input.steer * 50)));
  const ackPct = $derived(Math.min(100, Math.abs(ackermannDeltaDeg) * 10));
</script>

<div class="panel input-card" data-testid="hud-inputs">
  <div class="label">Driver Input</div>
  <div class="pedal-row"><span class="label2">Throttle</span><div class="pedal-bar thr"><span style="width: {throttlePct}%"></span></div><span class="v">{throttlePct}%</span></div>
  <div class="pedal-row"><span class="label2">Brake</span><div class="pedal-bar brk"><span style="width: {brakePct}%"></span></div><span class="v">{brakePct}%</span></div>
  <div class="pedal-row"><span class="label2">Steer</span><div class="pedal-bar steer"><span style="left: {Math.min(steerPct, 50)}%; width: {Math.abs(steerPct - 50)}%;"></span></div><span class="v">{(input.steer * 100).toFixed(0)}%</span></div>
  <div class="pedal-row compact"><span class="label2">Ack Δ</span><div class="pedal-bar ack"><span style="width: {ackPct}%"></span></div><span class="v">{ackermannDeltaDeg.toFixed(1)}°</span></div>
  <div class="pedal-row"><span class="label2">Handbrake</span><div class="pedal-bar brk"><span style="width: {handbrakePct}%"></span></div><span class="v">{handbrakePct > 0 ? `${handbrakePct}%` : 'off'}</span></div>
</div>

<style>
  .input-card {
    position: absolute;
    top: 110px;
    left: 14px;
    padding: 12px;
    display: grid;
    gap: 8px;
    width: 220px;
  }
  .label {
    font-size: 10px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: rgba(230, 236, 242, 0.6);
  }
  .pedal-row {
    display: grid;
    grid-template-columns: 60px 1fr 50px;
    align-items: center;
    gap: 10px;
    font-size: 11px;
    color: rgba(230, 236, 242, 0.6);
  }
  .pedal-row.compact {
    grid-template-columns: 60px 1fr 58px;
    font-size: 10px;
  }
  .pedal-row .label2 {
    letter-spacing: 0.06em;
  }
  .pedal-row .v {
    text-align: right;
    color: #e6ecf2;
    font-variant-numeric: tabular-nums;
  }
  .pedal-bar {
    height: 6px;
    background: rgba(255, 255, 255, 0.06);
    border-radius: 999px;
    overflow: hidden;
    position: relative;
  }
  .pedal-bar > span {
    position: absolute;
    top: 0;
    bottom: 0;
    border-radius: 999px;
    width: 0%;
  }
  .pedal-bar.thr > span { background: linear-gradient(90deg, #66f09f, #2eab59); }
  .pedal-bar.brk > span { background: linear-gradient(90deg, #f1c86b, #ff7070); }
  .pedal-bar.ack > span { background: linear-gradient(90deg, #7be4cd, #bfa3ff); }
  .pedal-bar.steer > span { background: linear-gradient(90deg, #7be4cd, #77cfff); }
  .pedal-bar.steer::before {
    content: "";
    position: absolute;
    left: 50%;
    top: -2px;
    bottom: -2px;
    width: 1px;
    background: rgba(255, 255, 255, 0.3);
  }
</style>
