<script lang="ts">
  let {
    rpm = 0,
    redlineRpm = 8400,
  }: { rpm?: number; redlineRpm?: number } = $props();

  const fillPct = $derived(Math.min(100, Math.max(0, (rpm / Math.max(1, redlineRpm * 1.1)) * 100)));
  const redlinePct = $derived(Math.min(100, Math.max(0, (redlineRpm / Math.max(1, redlineRpm * 1.1)) * 100)));
</script>

<div class="panel rpm-card" data-testid="hud-rpm">
  <div class="rpm-row">
    <span>RPM</span>
    <span class="v">{Math.round(rpm)}</span>
  </div>
  <div class="rpm-bar">
    <span class="fill" style="width: {fillPct}%"></span>
    <span class="redline" style="left: {redlinePct}%"></span>
  </div>
</div>

<style>
  .rpm-card {
    width: 320px;
    padding: 10px 14px;
    display: grid;
    gap: 6px;
  }
  .rpm-bar {
    position: relative;
    height: 8px;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.06);
    overflow: hidden;
  }
  .fill {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    background: linear-gradient(90deg, #7be4cd, #77cfff 40%, #f1c86b 70%, #ff7070);
    border-radius: 6px;
  }
  .redline {
    position: absolute;
    top: -2px;
    bottom: -2px;
    width: 2px;
    background: #ff7070;
  }
  .rpm-row {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    color: rgba(230, 236, 242, 0.6);
  }
  .rpm-row .v { color: #e6ecf2; font-variant-numeric: tabular-nums; }
</style>
