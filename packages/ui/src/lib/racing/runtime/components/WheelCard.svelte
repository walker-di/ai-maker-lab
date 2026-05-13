<script lang="ts">
  import type { RacingHudWheelState } from '../RacingHud.svelte.ts';

  let { wheel }: { wheel: RacingHudWheelState } = $props();

  const labels = ['FL', 'FR', 'RL', 'RR'];
  const label = $derived(labels[wheel.index] ?? `${wheel.index}`);
  const fzPct = $derived(Math.min(100, Math.max(0, (wheel.fz / 6000) * 100)));
  const slipAnglePct = $derived(Math.min(100, Math.abs(wheel.slipAngle * (180 / Math.PI)) * 5));
  const slipRatioPct = $derived(Math.min(100, Math.abs(wheel.slipRatio) * 100));
  const brakeTempPct = $derived(Math.min(100, Math.max(0, ((wheel.brakeTempC - 20) / 600) * 100)));
  const bumpPct = $derived(Math.min(100, Math.max(0, wheel.bumpStopPct * 100)));
  const tireWearPct = $derived(Math.min(100, Math.max(0, wheel.tireWear * 100)));
  const flatSpotPct = $derived(Math.min(100, Math.max(0, wheel.flatSpotSignal * 100)));
  // Tire utilization: 0..1 is the friction-circle window; the bar caps at
  // 120% so combined-slip transients that briefly poke past the simple
  // mu·Fz ceiling stay visible without breaking the layout.
  const utilizationPct = $derived(Math.min(120, Math.max(0, wheel.tireUtilization * 100)));

  // Three-zone temps: inner (chassis side), middle (crown), outer (shoulder).
  // Scale: ambient ~25°C → optimal ~80°C → warn >120°C, range 0–180°C.
  const zoneTempPct = (t: number) => Math.min(100, Math.max(0, ((t - 20) / 160) * 100));
  const innerPct = $derived(zoneTempPct(wheel.tempInner));
  const middlePct = $derived(zoneTempPct(wheel.tempMiddle));
  const outerPct = $derived(zoneTempPct(wheel.tempOuter));
  const slidingLossPct = $derived(Math.min(100, Math.max(0, (1 - (wheel.slidingGripScale ?? 1)) * 100)));
  const relaxLatMm = $derived((wheel.relaxationLengthLatM ?? 0) * 1000);
  const pressureBalance = $derived(((wheel.pressureOuter ?? 0.25) - (wheel.pressureInner ?? 0.25)) * 50 + 50);

  // M3: suspension travel bar — max travel ~0.12 m (full droop to bump).
  const travelPct = $derived(Math.min(100, Math.max(0, (wheel.suspensionTravel / 0.12) * 100)));
  // Damper velocity: ±0.5 m/s typical, center at 50%.
  const damperPct = $derived(Math.min(100, Math.max(0, (wheel.damperVelocity / 0.5) * 50 + 50)));
  // Camber sign: negative = leaning into corner (typical). Display absolute.
  const camberAbs = $derived(Math.abs(wheel.camberDeg));
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
  <div class="row"><span class="label2">T·In</span><div class="meter temp"><span style="width: {innerPct}%"></span></div><span class="v">{Math.round(wheel.tempInner)}°</span></div>
  <div class="row"><span class="label2">T·Mid</span><div class="meter temp"><span style="width: {middlePct}%"></span></div><span class="v">{Math.round(wheel.tempMiddle)}°</span></div>
  <div class="row"><span class="label2">T·Out</span><div class="meter temp"><span style="width: {outerPct}%"></span></div><span class="v">{Math.round(wheel.tempOuter)}°</span></div>
  <div class="row"><span class="label2">Patch</span><div class="meter patch"><span style="width: {pressureBalance}%"></span></div><span class="v">{Math.round(relaxLatMm)} mm</span></div>
  <div class="row"><span class="label2">Slide μ</span><div class="meter slip"><span style="width: {slidingLossPct}%"></span></div><span class="v">-{slidingLossPct.toFixed(0)}%</span></div>
  <div class="row"><span class="label2">Brake</span><div class="meter temp"><span style="width: {brakeTempPct}%"></span></div><span class="v">{Math.round(wheel.brakeTempC)}°</span></div>
  <div class="row"><span class="label2">Util</span><div class="meter slip"><span style="width: {Math.min(100, utilizationPct)}%"></span></div><span class="v">{Math.round(utilizationPct)}%</span></div>
  <div class="row"><span class="label2">Wear</span><div class="meter wear"><span style="width: {tireWearPct}%"></span></div><span class="v">{tireWearPct.toFixed(1)}%</span></div>
  <div class="row"><span class="label2">Flat</span><div class="meter flat"><span style="width: {flatSpotPct}%"></span></div><span class="v">{flatSpotPct.toFixed(1)}%</span></div>
  <div class="row"><span class="label2">Travel</span><div class="meter travel"><span style="width: {travelPct}%"></span></div><span class="v">{(wheel.suspensionTravel * 1000).toFixed(0)} mm</span></div>
  <div class="row"><span class="label2">Damp·V</span><div class="meter damper"><span class="damper-fill" style="--pct: {damperPct / 100}"></span></div><span class="v">{wheel.damperVelocity >= 0 ? '+' : ''}{wheel.damperVelocity.toFixed(2)}</span></div>
  <div class="row"><span class="label2">Camber</span><div class="meter camber"><span style="width: {Math.min(100, camberAbs * 20)}%"></span></div><span class="v">{wheel.camberDeg.toFixed(1)}°</span></div>
  <div class="row"><span class="label2">Toe</span><div class="meter slip"><span style="width: {Math.min(100, Math.abs(wheel.toeDeg) * 20)}%"></span></div><span class="v">{wheel.toeDeg >= 0 ? '+' : ''}{wheel.toeDeg.toFixed(2)}°</span></div>
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
  .meter.wear > span { background: linear-gradient(90deg, #66f09f, #f1c86b, #ff7070); }
  .meter.flat > span { background: linear-gradient(90deg, #77cfff, #f1c86b, #ff7070); }
  .meter.travel > span { background: linear-gradient(90deg, #66f09f, #f1c86b, #ff7070); }
  .meter.damper {
    position: relative;
  }
  .damper-fill {
    position: absolute;
    top: 0;
    bottom: 0;
    border-radius: 999px;
    background: #77cfff;
  }
  /* Compression (pct > 0.5): fill from center rightward */
  .damper-fill {
    left: calc(min(var(--pct, 0.5), 0.5) * 100%);
    right: calc((1 - max(var(--pct, 0.5), 0.5)) * 100%);
  }
  .meter.camber > span { background: linear-gradient(90deg, #c084fc, #77cfff); }
  .meter.patch > span { background: linear-gradient(90deg, #77cfff, #c084fc); }
  .airborne .head .surf {
    background: rgba(255, 112, 112, 0.15);
    border-color: rgba(255, 112, 112, 0.4);
    color: #ff7070;
  }
</style>
