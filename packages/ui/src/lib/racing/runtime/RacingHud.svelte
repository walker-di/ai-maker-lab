<script lang="ts">
  import type { RacingHudModel } from './RacingHud.svelte.ts';
  import SpeedCard from './components/SpeedCard.svelte';
  import RpmCard from './components/RpmCard.svelte';
  import GearCard from './components/GearCard.svelte';
  import LapCard from './components/LapCard.svelte';
  import InputCard from './components/InputCard.svelte';
  import WheelCard from './components/WheelCard.svelte';
  import DriftPanel from './components/DriftPanel.svelte';

  let { model }: { model: RacingHudModel } = $props();

  function formatLap(ms: number | null): string {
    if (ms == null) return '—';
    const total = Math.max(0, ms);
    const minutes = Math.floor(total / 60000);
    const seconds = Math.floor((total % 60000) / 1000);
    const millis = Math.floor(total % 1000);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${millis.toString().padStart(3, '0')}`;
  }
</script>

<div class="racing-hud" data-testid="racing-hud">
  <div class="hud-top" data-testid="hud-top">
    <SpeedCard speedKmh={model.state.speedKmh} />
    <RpmCard rpm={model.state.rpm} redlineRpm={model.state.redlineRpm} />
    <GearCard gearLabel={model.state.gearLabel} />
    <LapCard
      bestLabel={formatLap(model.state.lap.bestMs)}
      lastLabel={formatLap(model.state.lap.lastMs)}
    />
  </div>

  <InputCard input={model.state.input} />

  <div class="wheels" data-testid="hud-wheels">
    {#each model.state.wheels as wheel (wheel.index)}
      <WheelCard {wheel} />
    {/each}
  </div>

  <DriftPanel
    driftState={model.state.driftState}
    sideslipDeg={model.state.sideslipDeg}
    yawRateRad={model.state.yawRateRad}
    rearLockPct={model.state.rearLockPct}
    frontLoadPct={model.state.frontLoadPct}
    leftLoadPct={model.state.leftLoadPct}
  />

  <div class="hud-bottom" data-testid="hud-bottom">
    <span class="badge">Track: {model.state.trackLabel || model.state.trackId || '—'}</span>
    <span class="badge">Car: {model.state.vehicleLabel || model.state.vehicleId || '—'}</span>
    <span class="badge">Cam: {model.state.cameraMode}</span>
    {#if model.state.paused}<span class="badge danger">PAUSED</span>{/if}
    {#if model.state.muted}<span class="badge muted">MUTED</span>{/if}
  </div>
</div>

<style>
  .racing-hud {
    --text: #e6ecf2;
    --muted: rgba(230, 236, 242, 0.6);
    --line: rgba(255, 255, 255, 0.12);
    --line-strong: rgba(255, 255, 255, 0.22);
    --green: #66f09f;
    --gold: #f1c86b;
    --red: #ff7070;
    --blue: #77cfff;
    --cyan: #7be4cd;
    --orange: #ffad66;
    --purple: #bfa3ff;
    --muted-2: #4a5563;
    position: absolute;
    inset: 0;
    pointer-events: none;
    color: var(--text);
    font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  }
  .racing-hud :global(.panel) {
    background: rgba(16, 20, 25, 0.78);
    border: 1px solid var(--line);
    border-radius: 12px;
    backdrop-filter: blur(6px);
    color: var(--text);
  }
  .hud-top {
    position: absolute;
    top: 14px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: 10px;
    align-items: stretch;
  }
  .wheels {
    position: absolute;
    top: 110px;
    right: 14px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    width: 320px;
  }
  .hud-bottom {
    position: absolute;
    bottom: 14px;
    right: 14px;
    display: flex;
    gap: 8px;
    pointer-events: auto;
  }
  .badge {
    padding: 4px 8px;
    border-radius: 999px;
    font-size: 10px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid var(--line);
    color: var(--muted);
  }
  .badge.danger { color: var(--red); border-color: rgba(255, 112, 112, 0.5); }
  .badge.muted { color: var(--gold); border-color: rgba(241, 200, 107, 0.45); }
</style>
