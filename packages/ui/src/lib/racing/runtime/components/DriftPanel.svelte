<script lang="ts">
  let {
    driftState = 'IDLE',
    sideslipDeg = 0,
    yawRateRad = 0,
    rearLockPct = 0,
    frontLoadPct = 50,
    leftLoadPct = 50,
  }: {
    driftState?: string;
    sideslipDeg?: number;
    yawRateRad?: number;
    rearLockPct?: number;
    frontLoadPct?: number;
    leftLoadPct?: number;
  } = $props();

  const stateClass = $derived.by(() => {
    switch (driftState) {
      case 'DRIFT': return 'state s-drift';
      case 'POWER SLIDE': return 'state s-drift';
      case 'OVERSTEER': return 'state s-over';
      case 'UNDERSTEER': return 'state s-under';
      case 'BRAKE LOCK':
      case 'HANDBRAKE LOCK': return 'state s-lock';
      case 'GRIP': return 'state s-grip';
      default: return 'state s-idle';
    }
  });

  const sideslipPct = $derived(50 + Math.max(-50, Math.min(50, (sideslipDeg / 30) * 50)));
  const yawPct = $derived(50 + Math.max(-50, Math.min(50, (yawRateRad / 1.5) * 50)));
  const lockPct = $derived(Math.max(0, Math.min(100, rearLockPct * 100)));
  const frontPctClamped = $derived(Math.max(0, Math.min(100, frontLoadPct)));
  const leftPctClamped = $derived(Math.max(0, Math.min(100, leftLoadPct)));
</script>

<div class="panel drift-card" data-testid="hud-drift">
  <span class="label">Chassis</span>
  <div class={stateClass} data-testid="hud-drift-state">{driftState}</div>
  <div class="row">
    <span class="label2">Sideslip</span>
    <div class="meter-bipolar"><span style="left: {Math.min(sideslipPct, 50)}%; width: {Math.abs(sideslipPct - 50)}%;"></span></div>
    <span class="v">{sideslipDeg.toFixed(1)}°</span>
  </div>
  <div class="row">
    <span class="label2">Yaw</span>
    <div class="meter-bipolar"><span style="left: {Math.min(yawPct, 50)}%; width: {Math.abs(yawPct - 50)}%;"></span></div>
    <span class="v">{(yawRateRad * (180 / Math.PI)).toFixed(0)}°/s</span>
  </div>
  <div class="row">
    <span class="label2">Rear lock</span>
    <div class="meter lock"><span style="width: {lockPct}%"></span></div>
    <span class="v">{Math.round(lockPct)}%</span>
  </div>
  <div class="row">
    <span class="label2">F / R</span>
    <div class="meter-split">
      <span style="background: linear-gradient(90deg, #77cfff, #77cfff); width: {frontPctClamped}%;"></span>
    </div>
    <span class="v">{Math.round(frontPctClamped)}/{Math.round(100 - frontPctClamped)}</span>
  </div>
  <div class="row">
    <span class="label2">L / R</span>
    <div class="meter-split">
      <span style="background: linear-gradient(90deg, #f1c86b, #f1c86b); width: {leftPctClamped}%;"></span>
    </div>
    <span class="v">{Math.round(leftPctClamped)}/{Math.round(100 - leftPctClamped)}</span>
  </div>
</div>

<style>
  .drift-card {
    position: absolute;
    top: 280px;
    left: 14px;
    padding: 12px;
    display: grid;
    gap: 6px;
    width: 220px;
  }
  .label {
    font-size: 10px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: rgba(230, 236, 242, 0.6);
  }
  .row {
    display: grid;
    grid-template-columns: 70px 1fr 58px;
    gap: 8px;
    font-size: 11px;
    align-items: center;
  }
  .row .label2 { color: rgba(230, 236, 242, 0.6); letter-spacing: 0.06em; font-size: 10px; }
  .row .v {
    text-align: right;
    color: #e6ecf2;
    font-variant-numeric: tabular-nums;
  }
  .state {
    text-align: center;
    padding: 4px 8px;
    border-radius: 6px;
    font-size: 11px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    background: rgba(118, 203, 255, 0.1);
    border: 1px solid rgba(118, 203, 255, 0.3);
    color: #77cfff;
    font-weight: 600;
  }
  .s-drift { background: rgba(241, 200, 107, 0.15); border-color: rgba(241, 200, 107, 0.45); color: #f1c86b; }
  .s-lock { background: rgba(255, 112, 112, 0.15); border-color: rgba(255, 112, 112, 0.45); color: #ff7070; }
  .s-under { background: rgba(255, 173, 102, 0.15); border-color: rgba(255, 173, 102, 0.45); color: #ffad66; }
  .s-over { background: rgba(241, 200, 107, 0.18); border-color: rgba(241, 200, 107, 0.5); color: #f1c86b; }
  .s-grip { background: rgba(102, 240, 159, 0.12); border-color: rgba(102, 240, 159, 0.35); color: #66f09f; }
  .s-idle { color: rgba(230, 236, 242, 0.6); }

  .meter-bipolar {
    position: relative;
    height: 4px;
    background: rgba(255, 255, 255, 0.06);
    border-radius: 999px;
  }
  .meter-bipolar::before {
    content: "";
    position: absolute;
    left: 50%;
    top: -2px;
    bottom: -2px;
    width: 1px;
    background: rgba(255, 255, 255, 0.3);
  }
  .meter-bipolar > span {
    position: absolute;
    top: 0;
    bottom: 0;
    border-radius: 999px;
    background: linear-gradient(90deg, #7be4cd, #f1c86b);
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
  .meter.lock > span { background: linear-gradient(90deg, #66f09f, #f1c86b, #ff7070); }
  .meter-split {
    position: relative;
    height: 4px;
    background: rgba(255, 255, 255, 0.06);
    border-radius: 999px;
    overflow: hidden;
  }
  .meter-split::before {
    content: "";
    position: absolute;
    left: 50%;
    top: -2px;
    bottom: -2px;
    width: 1px;
    background: rgba(255, 255, 255, 0.3);
    z-index: 2;
  }
  .meter-split > span {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    border-radius: 999px;
  }
</style>
