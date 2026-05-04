<script lang="ts">
  import type { RacingTelemetryMode, RacingTraceSample } from '../RacingHud.svelte.ts';

  let {
    samples = [],
    mode = 'load',
    onToggle = () => {},
  }: {
    samples?: RacingTraceSample[];
    mode?: RacingTelemetryMode;
    onToggle?: () => void;
  } = $props();

  const modeLabel = $derived(mode === 'load' ? 'Vertical Load · 6s' : 'Slip Ratio · 6s');
  const buttonLabel = $derived(mode === 'load' ? 'Mode: Load' : 'Mode: Slip');
  const latest = $derived(samples.at(-1) ?? { fl: 0, fr: 0, rl: 0, rr: 0 });

  const seriesPath = $derived.by(() => {
    const width = 380;
    const height = 110;
    const safe = samples.length > 1 ? samples : [latest, latest];
    const values = safe.flatMap((sample) => [sample.fl, sample.fr, sample.rl, sample.rr]);
    const maxValue = mode === 'load'
      ? Math.max(4000, ...values, 1)
      : Math.max(0.4, ...values.map((value) => Math.abs(value)), 0.01);

    const build = (pick: (sample: RacingTraceSample) => number) =>
      safe
        .map((sample, index) => {
          const x = (index / Math.max(1, safe.length - 1)) * width;
          const raw = pick(sample);
          const normalized = mode === 'load'
            ? raw / maxValue
            : (raw + maxValue) / (2 * maxValue);
          const y = height - normalized * height;
          return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(' ');

    return {
      fl: build((sample) => sample.fl),
      fr: build((sample) => sample.fr),
      rl: build((sample) => sample.rl),
      rr: build((sample) => sample.rr),
    };
  });
</script>

<div class="panel telem" data-testid="hud-trace">
  <div class="t-head">
    <span>{modeLabel}</span>
    <span class="legend">
      <span><i class="fl"></i>FL</span>
      <span><i class="fr"></i>FR</span>
      <span><i class="rl"></i>RL</span>
      <span><i class="rr"></i>RR</span>
    </span>
    <button class="telem-toggle" type="button" onclick={onToggle}>{buttonLabel}</button>
  </div>
  <svg class="chart" viewBox="0 0 380 110" preserveAspectRatio="none" aria-label="Telemetry trace chart">
    <path class="trace fl" d={seriesPath.fl}></path>
    <path class="trace fr" d={seriesPath.fr}></path>
    <path class="trace rl" d={seriesPath.rl}></path>
    <path class="trace rr" d={seriesPath.rr}></path>
  </svg>
</div>

<style>
  .telem {
    position: absolute;
    bottom: 14px;
    left: 14px;
    width: 380px;
    padding: 12px;
    display: grid;
    gap: 8px;
    pointer-events: auto;
  }
  .t-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    font-size: 10px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: rgba(230, 236, 242, 0.6);
  }
  .legend {
    display: flex;
    gap: 10px;
    align-items: center;
    font-size: 10px;
    letter-spacing: 0.12em;
  }
  .legend span {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .legend i {
    display: inline-block;
    width: 8px;
    height: 2px;
    border-radius: 999px;
  }
  .legend i.fl { background: #7be4cd; }
  .legend i.fr { background: #77cfff; }
  .legend i.rl { background: #f1c86b; }
  .legend i.rr { background: #ffad66; }
  .telem-toggle {
    pointer-events: auto;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(255, 255, 255, 0.04);
    color: rgba(230, 236, 242, 0.7);
    border-radius: 999px;
    padding: 5px 8px;
    font-size: 9px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    cursor: pointer;
  }
  .telem-toggle:hover {
    color: #e6ecf2;
    border-color: rgba(119, 207, 255, 0.4);
  }
  .chart {
    width: 100%;
    height: 110px;
    display: block;
    border-radius: 10px;
    background:
      repeating-linear-gradient(0deg, rgba(255,255,255,0.04) 0 1px, transparent 1px 22px),
      repeating-linear-gradient(90deg, rgba(255,255,255,0.04) 0 1px, transparent 1px 38px),
      linear-gradient(180deg, #0a1118, #060a10);
  }
  .trace {
    fill: none;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .trace.fl { stroke: #7be4cd; }
  .trace.fr { stroke: #77cfff; }
  .trace.rl { stroke: #f1c86b; }
  .trace.rr { stroke: #ffad66; }
</style>
