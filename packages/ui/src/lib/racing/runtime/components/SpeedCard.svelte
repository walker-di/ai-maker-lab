<script lang="ts">
  let { speedKmh = 0 }: { speedKmh?: number } = $props();
  const formatted = $derived(Math.round(Math.abs(speedKmh)).toString().padStart(3, '0'));
</script>

<div class="panel speed-card" data-testid="hud-speed">
  <span class="num">{formatted}</span>
  <span class="unit">km/h</span>
</div>

<style>
  .speed-card {
    display: grid;
    gap: 0;
    align-items: center;
    justify-items: center;
    padding: 8px 18px;
    min-width: 220px;
  }
  .num {
    font-size: 56px;
    font-weight: 700;
    letter-spacing: -0.04em;
    line-height: 0.95;
    font-variant-numeric: tabular-nums;
  }
  .unit {
    font-size: 11px;
    color: rgba(230, 236, 242, 0.6);
    letter-spacing: 0.2em;
  }
</style>
