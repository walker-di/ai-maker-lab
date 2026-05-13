<script lang="ts">
  import type { RacingHudDrivetrainState } from '../RacingHud.svelte.ts';

  let { drivetrain }: { drivetrain: RacingHudDrivetrainState } = $props();

  const hasTurbo = $derived(drivetrain.turboSpoolRatio > 0 || drivetrain.boostBar > 0);

  const spoolPct = $derived(Math.min(1, Math.max(0, drivetrain.turboSpoolRatio)));

  /** Boost bar fill: maps boostBar (bar) to 0–1, cap at 2.5 bar for display. */
  const boostFillPct = $derived(Math.min(1, Math.max(0, drivetrain.boostBar / 2.5)));

  const shiftProgressPct = $derived(
    drivetrain.shiftInProgress && drivetrain.shiftRemainingS > 0
      ? Math.min(1, drivetrain.shiftRemainingS / 0.25)
      : 0,
  );

  const hasCompliance = $derived(
    drivetrain.drivelineComplianceTwistRad !== 0 || drivetrain.drivelineComplianceSpringNm !== 0,
  );

  function boostColor(bar: number, overboost: boolean): string {
    if (overboost) return '#ff7070';
    if (bar > 1.8) return '#f1c86b';
    if (bar > 0.5) return '#77cfff';
    return '#66f09f';
  }
</script>

<div class="panel boost-shift-panel" data-testid="hud-boost-shift">
  <span class="label">Boost / Shift{hasTurbo ? '' : ' (NA)'}</span>

  <!-- Turbo spool bar -->
  <div class="bar-row">
    <span class="bar-label">Spool</span>
    <div class="bar-track">
      <span class="bar-fill spool-fill" style="--pct: {spoolPct}"></span>
    </div>
    <span class="bar-value">{(spoolPct * 100).toFixed(0)}%</span>
  </div>

  <!-- Boost pressure bar -->
  <div class="bar-row">
    <span class="bar-label">Boost</span>
    <div class="bar-track">
      <span
        class="bar-fill boost-fill"
        class:overboost={drivetrain.isOverboost}
        style="--pct: {boostFillPct}; --clr: {boostColor(drivetrain.boostBar, drivetrain.isOverboost)}"
      ></span>
    </div>
    <span class="bar-value" class:overboost-text={drivetrain.isOverboost}>
      {drivetrain.boostBar.toFixed(2)} bar
    </span>
  </div>

  <!-- Torque multiplier row -->
  <div class="debug-row">
    <span>Boost ×</span>
    <span>{drivetrain.boostTorqueMultiplier.toFixed(3)}</span>
  </div>

  {#if drivetrain.isOverboost}
    <div class="alert-banner">OVERBOOST</div>
  {/if}

  <!-- Shift state -->
  <div class="section-divider"></div>

  {#if drivetrain.shiftInProgress}
    <!-- Shift delay progress: fills as shift completes (inverted — drains to 0) -->
    <div class="bar-row">
      <span class="bar-label">Shift</span>
      <div class="bar-track">
        <span class="bar-fill shift-fill" style="--pct: {shiftProgressPct}"></span>
      </div>
      <span class="bar-value shift-active">{(drivetrain.shiftRemainingS * 1000).toFixed(0)} ms</span>
    </div>
  {:else}
    <div class="debug-row">
      <span>Shift</span>
      <span class="ready">Ready</span>
    </div>
  {/if}

  {#if drivetrain.shiftRefused}
    <div class="debug-row">
      <span>Refused</span>
      <span class="refused">{drivetrain.shiftRefusalReason || 'rpm window'}</span>
    </div>
  {/if}

  <!-- Driveline compliance (only shown when authored) -->
  {#if hasCompliance}
    <div class="section-divider"></div>
    <div class="debug-row">
      <span>Shaft twist</span>
      <span>{(drivetrain.drivelineComplianceTwistRad * (180 / Math.PI)).toFixed(2)}°</span>
    </div>
    <div class="debug-row">
      <span>Spring T</span>
      <span>{drivetrain.drivelineComplianceSpringNm.toFixed(0)} Nm</span>
    </div>
  {/if}
</div>

<style>
  .boost-shift-panel {
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

  .bar-row {
    display: grid;
    grid-template-columns: 38px 1fr 52px;
    gap: 6px;
    align-items: center;
  }

  .bar-label {
    font-size: 10px;
    color: rgba(230, 236, 242, 0.7);
  }

  .bar-track {
    height: 5px;
    border-radius: 3px;
    background: rgba(119, 207, 255, 0.1);
    overflow: hidden;
    position: relative;
  }

  .bar-fill {
    display: block;
    height: 100%;
    width: calc(var(--pct, 0) * 100%);
    border-radius: 3px;
    transition: width 80ms linear;
  }

  .spool-fill {
    background: linear-gradient(90deg, #66f09f 0%, #77cfff 100%);
  }

  .boost-fill {
    background: var(--clr, #77cfff);
    transition: width 80ms linear, background 200ms ease;
  }

  .boost-fill.overboost {
    box-shadow: 0 0 6px rgba(255, 112, 112, 0.7);
  }

  .shift-fill {
    background: linear-gradient(90deg, #f1c86b 0%, #ffaa33 100%);
  }

  .bar-value {
    font-size: 10px;
    font-variant-numeric: tabular-nums;
    text-align: right;
    color: #77cfff;
  }

  .overboost-text {
    color: #ff7070 !important;
  }

  .shift-active {
    color: #f1c86b !important;
  }

  .ready {
    color: #66f09f;
  }

  .refused {
    color: #ff7070 !important;
    font-size: 10px;
    text-align: right;
  }

  .section-divider {
    height: 1px;
    background: rgba(221, 238, 255, 0.08);
    margin: 2px 0;
  }

  .alert-banner {
    font-size: 9px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #ff7070;
    background: rgba(255, 112, 112, 0.1);
    border: 1px solid rgba(255, 112, 112, 0.4);
    border-radius: 6px;
    padding: 3px 8px;
    text-align: center;
  }
</style>
