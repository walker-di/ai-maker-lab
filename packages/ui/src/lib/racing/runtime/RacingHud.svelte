<script lang="ts">
  import type { RacingHudModel } from './RacingHud.svelte.ts';
  import GearCard from './components/GearCard.svelte';
  import SpeedCard from './components/SpeedCard.svelte';
  import RpmCard from './components/RpmCard.svelte';
  import LapCard from './components/LapCard.svelte';
  import InputCard from './components/InputCard.svelte';
  import WheelCard from './components/WheelCard.svelte';
  import DriftPanel from './components/DriftPanel.svelte';
  import DebugTrace from './components/DebugTrace.svelte';
  import GgPlot from './components/GgPlot.svelte';
  import BrakeBalancePanel from './components/BrakeBalancePanel.svelte';
  import TirePressurePanel from './components/TirePressurePanel.svelte';
  import FfbPanel from './components/FfbPanel.svelte';
  import SuspensionDiagram from './components/SuspensionDiagram.svelte';
  import TrackSurfacePanel from './components/TrackSurfacePanel.svelte';
  import AeroPanel from './components/AeroPanel.svelte';
  import BoostBar from './components/BoostBar.svelte';

  let { model }: { model: RacingHudModel } = $props();

  function trackTempColor(c: number): string {
    if (c < 15) return '#77cfff';
    if (c < 45) return '#66f09f';
    if (c < 60) return '#f1c86b';
    return '#ff7070';
  }

  function formatLap(ms: number | null): string {
    if (ms == null) return '--:--.---';
    const total = Math.max(0, ms);
    const minutes = Math.floor(total / 60000);
    const seconds = Math.floor((total % 60000) / 1000);
    const millis = Math.floor(total % 1000);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${millis.toString().padStart(3, '0')}`;
  }
</script>

<div class="racing-hud" data-testid="racing-hud">
  <div class="panel corner-link" data-testid="hud-corner">
    <span class="brand">AML Racing</span>
    <span>·</span>
    <span class:warn={model.state.fps < 50} class:bad={model.state.fps < 30} class="fps">{model.state.fps > 0 ? `${Math.round(model.state.fps)} fps` : '— fps'}</span>
  </div>

  <div class="hud-top" data-testid="hud-top">
    <GearCard gearLabel={model.state.gearLabel} />
    <SpeedCard speedKmh={model.state.speedKmh} />
    <RpmCard rpm={model.state.rpm} redlineRpm={model.state.redlineRpm} />
    <LapCard
      currentLabel={formatLap(model.state.lap.currentMs)}
      bestLabel={formatLap(model.state.lap.bestMs)}
      lastLabel={formatLap(model.state.lap.lastMs)}
    />
  </div>

  <InputCard input={model.state.input} ackermannDeltaDeg={model.state.ackermannDeltaDeg} />

  <DriftPanel
    driftState={model.state.driftState}
    sideslipDeg={model.state.sideslipDeg}
    yawRateRad={model.state.yawRateRad}
    rearLockPct={model.state.rearLockPct}
    rearSlipRatio={model.state.rearSlipRatio}
    frontSlipDeg={model.state.frontSlipDeg}
    rearSlipDeg={model.state.rearSlipDeg}
    frontLoadPct={model.state.frontLoadPct}
    leftLoadPct={model.state.leftLoadPct}
    frontToeDeg={model.state.frontToeDeg}
    rearToeDeg={model.state.rearToeDeg}
    casterDeg={model.state.casterDeg}
    pitchDeg={model.state.pitchDeg}
    rollDeg={model.state.rollDeg}
  />

  <div class="wheels" data-testid="hud-wheels">
    {#each model.state.wheels as wheel (wheel.index)}
      <WheelCard {wheel} />
    {/each}
  </div>

  <DebugTrace
    samples={model.state.traceSamples}
    mode={model.state.telemetryMode}
    onToggle={() => model.toggleTelemetryMode()}
  />

  <GgPlot
    latG={model.state.accelLatG}
    longG={model.state.accelLongG}
    trail={model.state.ggTrail}
  />

  {#if model.state.showDebug}
    <div class="panel debug-card" data-testid="hud-debug">
      <span class="label">Debug</span>
      <div class="debug-grid">
        <div class="debug-row"><span>ABS</span><span>{model.state.absEnabled ? (model.state.absActive ? 'ACTIVE' : 'ON') : 'OFF'}</span></div>
        <div class="debug-row"><span>TC</span><span>{model.state.tcEnabled ? `${Math.round(model.state.tcCutPct)}% cut` : 'OFF'}</span></div>
        <div class="debug-row"><span>ESC</span><span>{model.state.escEnabled ? (model.state.escActive ? 'ACTIVE' : 'ON') : 'OFF'}</span></div>
        <div class="debug-row"><span>Cam</span><span>{model.state.cameraMode}</span></div>
      </div>
    </div>
    <div class="panel drivetrain-card" data-testid="hud-drivetrain">
      <span class="label">Drivetrain</span>
      <div class="debug-grid">
        <div class="debug-row"><span>Engine</span><span>{Math.round(model.state.drivetrain.engineOmega * (60 / (2 * Math.PI)))} rpm</span></div>
        <div class="debug-row"><span>Trans</span><span>{(model.state.drivetrain.transmissionOmega * (60 / (2 * Math.PI))).toFixed(0)} rpm</span></div>
        <div class="debug-row"><span>Clutch</span><span>{model.state.drivetrain.clutchMode} · {model.state.drivetrain.clutchTorqueNm.toFixed(0)} Nm</span></div>
        <div class="debug-row"><span>Drive T</span><span>{model.state.drivetrain.engineDriveTorqueNm.toFixed(0)} Nm</span></div>
        <div class="debug-row"><span>Drag T</span><span>{model.state.drivetrain.engineDragTorqueNm.toFixed(0)} Nm</span></div>
        <div class="debug-row"><span>FL/FR drv</span><span>{model.state.wheels[0].driveTorqueNm.toFixed(0)} / {model.state.wheels[1].driveTorqueNm.toFixed(0)}</span></div>
        <div class="debug-row"><span>RL/RR drv</span><span>{model.state.wheels[2].driveTorqueNm.toFixed(0)} / {model.state.wheels[3].driveTorqueNm.toFixed(0)}</span></div>
      </div>
    </div>
    <AeroPanel aero={model.state.aero} />
    <BoostBar drivetrain={model.state.drivetrain} />
    <div class="panel tire-card" data-testid="hud-tire-utilization">
      <span class="label">Tire utilization</span>
      <div class="debug-grid">
        {#each model.state.wheels as wheel (wheel.index)}
          {@const pct = Math.max(0, Math.min(1.2, wheel.tireUtilization))}
          {@const corner = ['FL', 'FR', 'RL', 'RR'][wheel.index] ?? `W${wheel.index}`}
          <div class="debug-row tire-row">
            <span>{corner}</span>
            <span class="tire-bar"><span class="tire-fill" class:hot={pct > 0.95} style="--pct: {Math.min(pct, 1.2) / 1.2}"></span></span>
            <span class="tire-num">{(pct * 100).toFixed(0)}%</span>
          </div>
        {/each}
      </div>
    </div>
    <BrakeBalancePanel wheels={model.state.wheels} />
    <TirePressurePanel wheels={model.state.wheels} />
    <FfbPanel ffb={model.state.ffb} />
    <SuspensionDiagram wheels={model.state.wheels} />
    <TrackSurfacePanel trackCondition={model.state.trackCondition} />
  {/if}

  <div class="hud-bottom" data-testid="hud-bottom">
    <span class="badge meta">Track: {model.state.trackLabel || model.state.trackId || '—'}</span>
    <span class="badge meta">Car: {model.state.vehicleLabel || model.state.vehicleId || '—'}</span>
    <span class="badge meta">Cam: {model.state.cameraMode}</span>
    <span class="badge temp" style="--tc: {trackTempColor(model.state.trackCondition.trackTempC)}">{Math.round(model.state.trackCondition.trackTempC)} °C</span>
    {#if model.state.trackCondition.rubberLineGrip > 1.005}<span class="badge rubber">Rubber {model.state.trackCondition.rubberLineGrip.toFixed(2)}×</span>{/if}
    {#if model.state.trackCondition.terrainActive}<span class="badge terrain">Elevation</span>{/if}
    {#if model.state.paused}<span class="badge danger">Paused</span>{/if}
    {#if model.state.muted}<span class="badge muted">Muted</span>{/if}
    {#if model.state.showDebug}<span class="badge info">Debug</span>{/if}
  </div>
</div>

<style>
  .racing-hud {
    --text: #f5f8fc;
    --muted: #96a8bb;
    --line: rgba(221, 238, 255, 0.10);
    --line-strong: rgba(118, 203, 255, 0.40);
    position: absolute;
    inset: 0;
    pointer-events: none;
    color: var(--text);
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }
  .racing-hud :global(.panel) {
    background: rgba(10, 14, 21, 0.78);
    border: 1px solid var(--line);
    border-radius: 14px;
    backdrop-filter: blur(14px);
    box-shadow: 0 18px 44px rgba(0,0,0,0.45);
    color: var(--text);
  }
  .corner-link {
    position: absolute;
    top: 14px;
    left: 14px;
    padding: 8px 12px;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: var(--muted);
    pointer-events: auto;
  }
  .brand {
    color: var(--text);
    font-weight: 600;
  }
  .fps {
    color: #66f09f;
  }
  .fps.warn {
    color: #f1c86b;
  }
  .fps.bad {
    color: #ff7070;
  }
  .hud-top {
    position: absolute;
    top: 14px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: 10px;
    align-items: center;
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
  .debug-card {
    position: absolute;
    bottom: 230px;
    right: 14px;
    padding: 12px;
    width: 220px;
    display: grid;
    gap: 8px;
  }
  .drivetrain-card {
    position: absolute;
    bottom: 230px;
    left: 14px;
    padding: 12px;
    width: 240px;
    display: grid;
    gap: 8px;
  }
  :global(.aero-panel) {
    position: absolute;
    bottom: 100px;
    left: 14px;
  }
  :global(.boost-shift-panel) {
    position: absolute;
    bottom: 100px;
    left: 250px;
  }
  :global(.tire-pressure-panel) {
    position: absolute;
    bottom: 14px;
    left: 312px;
    width: 260px;
  }
  :global(.ffb-panel) {
    position: absolute;
    bottom: 230px;
    left: 590px;
    width: 220px;
  }
  :global(.suspension-diagram) {
    position: absolute;
    bottom: 230px;
    left: 820px;
    width: 280px;
  }
  :global(.track-surface-panel) {
    position: absolute;
    bottom: 230px;
    left: 1110px;
    width: 240px;
  }
  .tire-card {
    position: absolute;
    bottom: 100px;
    left: 230px;
    padding: 12px;
    width: 240px;
    display: grid;
    gap: 8px;
  }
  .tire-row {
    align-items: center;
    grid-template-columns: 32px 1fr 44px;
    display: grid !important;
    gap: 8px;
  }
  .tire-bar {
    height: 6px;
    border-radius: 3px;
    background: rgba(119, 207, 255, 0.12);
    overflow: hidden;
    display: block;
  }
  .tire-fill {
    display: block;
    height: 100%;
    width: calc(var(--pct, 0) * 100%);
    background: linear-gradient(90deg, #66f09f 0%, #f1c86b 70%, #ff7070 100%);
    transition: width 80ms linear;
  }
  .tire-fill.hot {
    box-shadow: 0 0 6px rgba(255, 112, 112, 0.8);
  }
  .tire-num {
    text-align: right;
    font-variant-numeric: tabular-nums;
    color: #77cfff;
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
    display: flex;
    justify-content: space-between;
    gap: 12px;
    font-size: 11px;
    color: rgba(230, 236, 242, 0.82);
  }
  .debug-row span:last-child {
    font-variant-numeric: tabular-nums;
    color: #77cfff;
  }
  .hud-bottom {
    position: absolute;
    top: 56px;
    left: 14px;
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    align-items: center;
    pointer-events: auto;
    max-width: min(42rem, 55vw);
  }
  .badge {
    padding: 4px 8px;
    border-radius: 999px;
    font-size: 10px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid var(--line);
    color: var(--muted);
  }
  .badge.meta {
    background: rgba(255, 255, 255, 0.035);
  }
  .badge.danger { color: #ff7070; border-color: rgba(255, 112, 112, 0.5); }
  .badge.muted { color: #f1c86b; border-color: rgba(241, 200, 107, 0.45); }
  .badge.info { color: #77cfff; border-color: rgba(119, 207, 255, 0.45); }
  .badge.temp {
    color: var(--tc, #66f09f);
    border-color: color-mix(in srgb, var(--tc, #66f09f) 45%, transparent);
  }
  .badge.rubber { color: #7be4cd; border-color: rgba(123, 228, 205, 0.4); }
  .badge.terrain { color: #66f09f; border-color: rgba(102, 240, 159, 0.4); }

  @media (max-width: 1200px) {
    :global(.wheel-card .row .v) {
      font-size: 9px;
    }
  }

  @media (max-width: 900px) {
    .wheels {
      width: 220px;
      grid-template-columns: 1fr;
    }
    .hud-bottom {
      max-width: 16rem;
    }
    :global(.telem) {
      width: 280px;
    }
    :global(.gg) {
      width: 140px;
    }
    :global(.input-card) {
      width: 180px;
    }
    :global(.speed-card) {
      min-width: 160px;
    }
    :global(.speed-card .num) {
      font-size: 36px;
    }
    :global(.rpm-card) {
      width: 220px;
    }
  }
</style>
