<script lang="ts">
  let {
    driftState = 'IDLE',
    sideslipDeg = 0,
    yawRateRad = 0,
    rearLockPct = 0,
    rearSlipRatio = 0,
    frontSlipDeg = 0,
    rearSlipDeg = 0,
    frontLoadPct = 50,
    leftLoadPct = 50,
    frontToeDeg = 0,
    rearToeDeg = 0,
    casterDeg = 0,
    pitchDeg = 0,
    rollDeg = 0,
  }: {
    driftState?: string;
    sideslipDeg?: number;
    yawRateRad?: number;
    rearLockPct?: number;
    rearSlipRatio?: number;
    frontSlipDeg?: number;
    rearSlipDeg?: number;
    frontLoadPct?: number;
    leftLoadPct?: number;
    frontToeDeg?: number;
    rearToeDeg?: number;
    casterDeg?: number;
    pitchDeg?: number;
    rollDeg?: number;
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

  const clampBipolar = (value: number, max = 30) => 50 + Math.max(-50, Math.min(50, (value / max) * 50));
  const sideslipPct = $derived(clampBipolar(sideslipDeg, 30));
  const yawPct = $derived(clampBipolar(yawRateRad * (180 / Math.PI), 90));
  const pitchPct = $derived(clampBipolar(pitchDeg, 10));
  const rollPct = $derived(clampBipolar(rollDeg, 10));
  const lockPct = $derived(Math.max(0, Math.min(100, rearLockPct * 100)));
  const rearSlipPct = $derived(Math.max(0, Math.min(100, rearSlipRatio * 100)));
  const frontAlphaPct = $derived(Math.max(0, Math.min(100, frontSlipDeg * 5)));
  const rearAlphaPct = $derived(Math.max(0, Math.min(100, rearSlipDeg * 5)));
  const toeFrontPct = $derived(Math.max(0, Math.min(100, Math.abs(frontToeDeg) * 20)));
  const toeRearPct = $derived(Math.max(0, Math.min(100, Math.abs(rearToeDeg) * 20)));
  const casterPct = $derived(Math.max(0, Math.min(100, casterDeg * (100 / 12))));
</script>

<div class="panel drift-card" data-testid="hud-drift">
  <div class="label">Chassis</div>
  <div class="row"><span class="label2">Pitch</span><div class="meter-bipolar"><span style="left: {Math.min(pitchPct, 50)}%; width: {Math.abs(pitchPct - 50)}%;"></span></div><span class="v">{pitchDeg.toFixed(1)}°</span></div>
  <div class="row"><span class="label2">Roll</span><div class="meter-bipolar"><span style="left: {Math.min(rollPct, 50)}%; width: {Math.abs(rollPct - 50)}%;"></span></div><span class="v">{rollDeg.toFixed(1)}°</span></div>
  <div class="row"><span class="label2">Load F/R</span><div class="meter-split"><span style="width: {frontLoadPct}%"></span></div><span class="v">{Math.round(frontLoadPct)}/{Math.round(100 - frontLoadPct)}</span></div>
  <div class="row"><span class="label2">Load L/R</span><div class="meter-split amber"><span style="width: {leftLoadPct}%"></span></div><span class="v">{Math.round(leftLoadPct)}/{Math.round(100 - leftLoadPct)}</span></div>
  <div class="label sub">Drift / Yaw</div>
  <div class="row"><span class="label2">Sideslip β</span><div class="meter-bipolar"><span style="left: {Math.min(sideslipPct, 50)}%; width: {Math.abs(sideslipPct - 50)}%;"></span></div><span class="v">{sideslipDeg.toFixed(1)}°</span></div>
  <div class="row"><span class="label2">Yaw rate</span><div class="meter-bipolar"><span style="left: {Math.min(yawPct, 50)}%; width: {Math.abs(yawPct - 50)}%;"></span></div><span class="v">{(yawRateRad * (180 / Math.PI)).toFixed(0)}°/s</span></div>
  <div class="row"><span class="label2">Rear lock</span><div class="meter lock"><span style="width: {lockPct}%"></span></div><span class="v">{Math.round(lockPct)}%</span></div>
  <div class="row"><span class="label2">Rear k</span><div class="meter slip"><span style="width: {rearSlipPct}%"></span></div><span class="v">{rearSlipRatio.toFixed(2)}</span></div>
  <div class="row"><span class="label2">Front α</span><div class="meter slip"><span style="width: {frontAlphaPct}%"></span></div><span class="v">{frontSlipDeg.toFixed(1)}°</span></div>
  <div class="row"><span class="label2">Rear α</span><div class="meter slip"><span style="width: {rearAlphaPct}%"></span></div><span class="v">{rearSlipDeg.toFixed(1)}°</span></div>
  <div class="row"><span class="label2">Toe F</span><div class="meter slip"><span style="width: {toeFrontPct}%"></span></div><span class="v">{frontToeDeg.toFixed(1)}°</span></div>
  <div class="row"><span class="label2">Toe R</span><div class="meter slip"><span style="width: {toeRearPct}%"></span></div><span class="v">{rearToeDeg.toFixed(1)}°</span></div>
  <div class="row"><span class="label2">Caster</span><div class="meter slip"><span style="width: {casterPct}%"></span></div><span class="v">{casterDeg.toFixed(1)}°</span></div>
  <div class="state-row"><div class={stateClass} data-testid="hud-drift-state">{driftState}</div></div>
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
  .label.sub {
    margin-top: 6px;
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
  .state-row { margin-top: 4px; }
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
  .meter,
  .meter-split {
    height: 4px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.06);
    overflow: hidden;
    position: relative;
  }
  .meter > span,
  .meter-split > span {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    border-radius: 999px;
  }
  .meter.lock > span { background: linear-gradient(90deg, #66f09f, #f1c86b, #ff7070); }
  .meter.slip > span { background: linear-gradient(90deg, #66f09f, #f1c86b, #ffad66); }
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
  .meter-split > span { background: linear-gradient(90deg, #77cfff, #77cfff); }
  .meter-split.amber > span { background: linear-gradient(90deg, #f1c86b, #f1c86b); }
</style>
