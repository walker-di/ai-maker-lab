<script lang="ts">
  import type { RacingHudAeroState } from '../RacingHud.svelte.ts';

  let { aero }: { aero: RacingHudAeroState } = $props();

  const totalDfN = $derived(aero.frontDownforceN + aero.rearDownforceN);

  /**
   * Aero balance as percentage of total downforce on the front axle.
   * Falls back to computing from per-axle values when copFraction is absent
   * (scalar-preset path).
   */
  const frontBalancePct = $derived(
    aero.copFraction !== undefined
      ? (1 - aero.copFraction) * 100
      : totalDfN > 0
        ? (aero.frontDownforceN / totalDfN) * 100
        : 50,
  );

  const rearBalancePct = $derived(100 - frontBalancePct);

  /** Bar width for the balance visualisation: 0–100 where 50 = neutral. */
  const balanceBarPct = $derived(Math.min(100, Math.max(0, frontBalancePct)));

  const hasMapData = $derived(aero.hasAeroMap === true);

  function rideHeightColor(m: number | undefined): string {
    if (m === undefined) return '#77cfff';
    if (m < 0.02) return '#ff7070';
    if (m < 0.04) return '#f1c86b';
    return '#66f09f';
  }
</script>

<div class="panel aero-panel" data-testid="hud-aero">
  <span class="label">Aero{hasMapData ? ' (M5 map)' : ''}</span>
  <div class="debug-grid">
    <div class="debug-row">
      <span>DF Front</span>
      <span class:stalled={aero.frontStalled}>{aero.frontDownforceN.toFixed(0)} N</span>
    </div>
    <div class="debug-row">
      <span>DF Rear</span>
      <span class:stalled={aero.rearStalled}>{aero.rearDownforceN.toFixed(0)} N</span>
    </div>
    <div class="debug-row">
      <span>Total DF</span>
      <span>{totalDfN.toFixed(0)} N</span>
    </div>
    <div class="debug-row">
      <span>Drag</span>
      <span>{aero.dragN.toFixed(0)} N</span>
    </div>

    <!-- Balance bar: always shown, driven by copFraction when available -->
    <div class="balance-row">
      <span class="balance-label">F {frontBalancePct.toFixed(1)}%</span>
      <div class="balance-track">
        <span class="balance-fill" style="--pct: {balanceBarPct / 100}"></span>
        <span class="balance-mid"></span>
      </div>
      <span class="balance-label right">R {rearBalancePct.toFixed(1)}%</span>
    </div>

    {#if hasMapData}
      <!-- M5 map-specific telemetry -->
      {#if aero.frontRideHeightM !== undefined}
        <div class="debug-row">
          <span>Ride F</span>
          <span style="color: {rideHeightColor(aero.frontRideHeightM)}">{(aero.frontRideHeightM * 1000).toFixed(1)} mm</span>
        </div>
      {/if}
      {#if aero.rearRideHeightM !== undefined}
        <div class="debug-row">
          <span>Ride R</span>
          <span style="color: {rideHeightColor(aero.rearRideHeightM)}">{(aero.rearRideHeightM * 1000).toFixed(1)} mm</span>
        </div>
      {/if}
      {#if aero.effectiveClAreaFront !== undefined && aero.effectiveClAreaRear !== undefined}
        <div class="debug-row">
          <span>ClA F/R</span>
          <span>{aero.effectiveClAreaFront.toFixed(2)} / {aero.effectiveClAreaRear.toFixed(2)}</span>
        </div>
      {/if}
      {#if (aero.wakeReduction ?? 0) > 0}
        <div class="wake-row">
          <span>Wake</span>
          <span>{((aero.wakeReduction ?? 0) * 100).toFixed(0)}%</span>
        </div>
      {/if}
      {#if aero.frontStalled || aero.rearStalled}
        <div class="stall-banner">
          {aero.frontStalled && aero.rearStalled ? 'BOTH AXLES STALLED' : aero.frontStalled ? 'FRONT STALLED' : 'REAR STALLED'}
        </div>
      {/if}
    {/if}
  </div>
</div>

<style>
  .aero-panel {
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
  .stalled {
    color: #ff7070 !important;
    text-shadow: 0 0 6px rgba(255, 112, 112, 0.6);
  }
  .balance-row {
    display: grid;
    grid-template-columns: 52px 1fr 52px;
    gap: 6px;
    align-items: center;
    font-size: 11px;
    margin-top: 2px;
  }
  .balance-label {
    color: rgba(230, 236, 242, 0.7);
    font-variant-numeric: tabular-nums;
  }
  .balance-label.right {
    text-align: right;
  }
  .balance-track {
    height: 5px;
    border-radius: 999px;
    background: rgba(119, 207, 255, 0.1);
    overflow: hidden;
    position: relative;
  }
  .balance-fill {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: calc(var(--pct, 0.5) * 100%);
    background: linear-gradient(90deg, #66f09f 0%, #77cfff 50%, #f1c86b 100%);
    border-radius: 999px;
    transition: width 80ms linear;
  }
  .balance-mid {
    position: absolute;
    left: 50%;
    top: 0;
    bottom: 0;
    width: 1px;
    background: rgba(255, 255, 255, 0.35);
    transform: translateX(-50%);
  }
  .wake-row {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    font-size: 11px;
    color: rgba(230, 236, 242, 0.82);
  }
  .wake-row span:last-child {
    font-variant-numeric: tabular-nums;
    color: #66f09f;
  }
  .stall-banner {
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
