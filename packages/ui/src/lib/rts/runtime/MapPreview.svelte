<script lang="ts">
  import type { MapDefinition } from '../types.js';

  let {
    map,
    pixelsPerTile = 6,
  }: {
    map: MapDefinition;
    pixelsPerTile?: number;
  } = $props();

  let canvas = $state<HTMLCanvasElement | null>(null);

  $effect(() => {
    if (!canvas) return;
    canvas.width = map.size.cols * pixelsPerTile;
    canvas.height = map.size.rows * pixelsPerTile;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    for (let row = 0; row < map.size.rows; row++) {
      for (let col = 0; col < map.size.cols; col++) {
        const t = map.terrain[row]![col]!;
        ctx.fillStyle = colorFor(t);
        ctx.fillRect(col * pixelsPerTile, row * pixelsPerTile, pixelsPerTile, pixelsPerTile);
      }
    }
    for (const r of map.resources) {
      ctx.fillStyle = r.kind === 'mineral' ? '#66bbff' : '#55ff77';
      ctx.fillRect(r.tile.col * pixelsPerTile, r.tile.row * pixelsPerTile, pixelsPerTile, pixelsPerTile);
    }
    for (const s of map.spawns) {
      ctx.fillStyle = '#ffeb3b';
      ctx.fillRect(
        (s.tile.col - 1) * pixelsPerTile,
        (s.tile.row - 1) * pixelsPerTile,
        pixelsPerTile * 3,
        pixelsPerTile * 3,
      );
    }
  });

  function colorFor(kind: string): string {
    switch (kind) {
      case 'water': return '#3b7fbf';
      case 'shallow': return '#76b9d6';
      case 'cliff': return '#1d1d1d';
      case 'rock': return '#7a7a7a';
      case 'dirt': return '#8c6b3f';
      default: return '#6db15a';
    }
  }
</script>

<canvas bind:this={canvas} class="preview" data-testid="rts-map-preview"></canvas>

<style>
  .preview {
    image-rendering: pixelated;
    border-radius: 0.25rem;
    background: #000;
  }
</style>
