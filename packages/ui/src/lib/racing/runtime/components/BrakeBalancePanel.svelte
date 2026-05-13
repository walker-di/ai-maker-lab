<script lang="ts">
  import type { RacingHudWheelState } from '../RacingHud.svelte.ts';

  let { wheels }: { wheels: RacingHudWheelState[] } = $props();

  const labels = ['FL', 'FR', 'RL', 'RR'];

  function fmtTorque(nm: number): string {
    return `${Math.round(nm).toString().padStart(4, ' ')} N·m`;
  }

  function fmtScale(s: number): string {
    return `${Math.round(s * 100)}%`;
  }

  function fmtYaw(nm: number): string {
    const sign = nm > 1 ? '←' : nm < -1 ? '→' : '·';
    const mag = Math.round(Math.abs(nm)).toString().padStart(4, ' ');
    return `${sign} ${mag}`;
  }

  function yawClass(nm: number): string {
    if (Math.abs(nm) < 1) return 'neutral';
    return nm > 0 ? 'left' : 'right';
  }
</script>

<div class="panel brake-balance" data-testid="hud-brake-balance">
  <div class="head">
    <span class="title">Brake Balance</span>
    <span class="hint">CBC + ABS · yaw N·m</span>
  </div>
  <div class="grid">
    <div class="col-head"></div>
    <div class="col-head">Brake</div>
    <div class="col-head">ABS</div>
    <div class="col-head">Yaw</div>
    {#each wheels as w (w.index)}
      <div class="row-label">{labels[w.index] ?? w.index}</div>
      <div class="cell num" data-testid="hud-brake-{labels[w.index]}-torque">{fmtTorque(w.brakeTorqueApplied)}</div>
      <div class="cell num" class:active={w.absActive}>{fmtScale(w.absScale)}</div>
      <div class="cell num {yawClass(w.yawContribution)}" data-testid="hud-brake-{labels[w.index]}-yaw">{fmtYaw(w.yawContribution)}</div>
    {/each}
  </div>
</div>

<style>
  .brake-balance {
    position: absolute;
    bottom: 14px;
    left: 14px;
    padding: 12px;
    width: 280px;
    display: grid;
    gap: 8px;
    pointer-events: auto;
  }
  .head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 8px;
  }
  .title {
    font-size: 10px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: rgba(230, 236, 242, 0.6);
  }
  .hint {
    font-size: 9px;
    color: rgba(230, 236, 242, 0.4);
  }
  .grid {
    display: grid;
    grid-template-columns: 36px 1fr 56px 1fr;
    gap: 6px 10px;
    align-items: center;
    font-size: 11px;
  }
  .col-head {
    font-size: 9px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: rgba(230, 236, 242, 0.45);
  }
  .row-label {
    font-weight: 600;
    color: #e6ecf2;
  }
  .cell {
    color: rgba(230, 236, 242, 0.82);
  }
  .cell.num {
    font-variant-numeric: tabular-nums;
    font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
    text-align: right;
  }
  .cell.active {
    color: #ff7070;
    font-weight: 600;
  }
  .cell.left { color: #66f09f; }
  .cell.right { color: #ff7070; }
  .cell.neutral { color: rgba(230, 236, 242, 0.45); }
</style>
