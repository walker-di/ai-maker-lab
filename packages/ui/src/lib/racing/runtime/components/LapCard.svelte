<script lang="ts">
  let {
    bestLabel = '—',
    lastLabel = '—',
  }: { bestLabel?: string; lastLabel?: string } = $props();
</script>

<div class="panel lap-card" data-testid="hud-lap">
  <div class="lap-row">
    <span>Best</span>
    <span class="v">{bestLabel}</span>
  </div>
  <div class="lap-row">
    <span>Last</span>
    <span class="v">{lastLabel}</span>
  </div>
</div>

<style>
  .lap-card {
    padding: 10px 14px;
    display: grid;
    gap: 4px;
    min-width: 200px;
  }
  .lap-row {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
    gap: 12px;
    color: rgba(230, 236, 242, 0.6);
  }
  .lap-row .v {
    color: #77cfff;
    font-variant-numeric: tabular-nums;
  }
</style>
