<script lang="ts">
  import type { RacingHudFfbState } from '../RacingHud.svelte.ts';

  let { ffb }: { ffb: RacingHudFfbState } = $props();

  // Map rackForce [-1, 1] to a bar width and colour.
  const barPct = $derived(Math.abs(ffb.rackForce) * 100);
  const barDir = $derived(ffb.rackForce >= 0 ? 'right' : 'left');

  function fmtNm(nm: number): string {
    const sign = nm >= 0 ? '+' : '';
    return `${sign}${nm.toFixed(1)} Nm`;
  }

  function fmtPct(n: number): string {
    return `${Math.round(n * 100)}%`;
  }

  function rackColor(v: number): string {
    const a = Math.abs(v);
    if (a < 0.4) return '#66f09f';
    if (a < 0.75) return '#f1c86b';
    return '#ff7070';
  }
</script>

<div class="panel ffb-panel" data-testid="hud-ffb">
  <span class="label">FFB Rack Force</span>

  <div class="rack-bar-wrap" aria-label="Rack force indicator">
    <div class="rack-center"></div>
    <div
      class="rack-fill"
      class:rack-fill--right={barDir === 'right'}
      class:rack-fill--left={barDir === 'left'}
      style="width: {barPct / 2}%; background: {rackColor(ffb.rackForce)}"
    ></div>
  </div>
  <div class="rack-val" style="color: {rackColor(ffb.rackForce)}">
    {ffb.rackForce >= 0 ? '+' : ''}{ffb.rackForce.toFixed(3)}
  </div>

  <div class="debug-grid">
    <div class="debug-row"><span>KPI/SAI</span><span>{fmtNm(ffb.kpiTorqueNm)}</span></div>
    <div class="debug-row"><span>Mz align</span><span>{fmtNm(ffb.mzContributionNm)}</span></div>
    <div class="debug-row"><span>Fx couple</span><span>{fmtNm(ffb.fxCouplingNm)}</span></div>
    <div class="debug-row"><span>Raw total</span><span>{fmtNm(ffb.totalRawNm)}</span></div>
    <div class="debug-row"><span>Assist</span><span>{fmtPct(ffb.assistScale)}</span></div>
  </div>
</div>

<style>
  .ffb-panel {
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
  .rack-bar-wrap {
    position: relative;
    height: 8px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.07);
    overflow: hidden;
  }
  .rack-center {
    position: absolute;
    left: 50%;
    top: 0;
    bottom: 0;
    width: 1px;
    background: rgba(255, 255, 255, 0.25);
  }
  .rack-fill {
    position: absolute;
    top: 0;
    bottom: 0;
    border-radius: 4px;
    transition: width 60ms linear, background 120ms linear;
  }
  .rack-fill--right {
    left: 50%;
  }
  .rack-fill--left {
    right: 50%;
  }
  .rack-val {
    text-align: center;
    font-variant-numeric: tabular-nums;
    font-size: 18px;
    font-weight: 600;
    letter-spacing: 0.04em;
    transition: color 120ms linear;
  }
  .debug-grid {
    display: grid;
    gap: 4px;
  }
  .debug-row {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    font-size: 11px;
    color: rgba(230, 236, 242, 0.82);
  }
  .debug-row span:last-child {
    font-variant-numeric: tabular-nums;
    color: #77cfff;
  }
</style>
