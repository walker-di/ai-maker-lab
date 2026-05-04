<script lang="ts">
  let { gearLabel = 'N' }: { gearLabel?: string } = $props();
</script>

<div class="panel gear-card" data-testid="hud-gear">
  <span class="label">Gear</span>
  <span class="g">{gearLabel}</span>
</div>

<style>
  .gear-card {
    display: grid;
    gap: 4px;
    place-items: center;
    padding: 10px 16px;
    min-width: 64px;
  }
  .label {
    font-size: 10px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: rgba(230, 236, 242, 0.6);
  }
  .g {
    font-size: 32px;
    font-weight: 700;
    line-height: 1;
  }
</style>
