<script lang="ts">
  import type { MapDefinition, TilePos } from '../types.js';
  import { getTerrainMetadata } from '../types.js';
  import type { FogOfWarSnapshot, RtsMinimapBlip, RtsViewportBounds } from '../engine/index.js';

  export interface MinimapPing {
    id: string;
    tile: TilePos;
    severity: 'warning' | 'danger';
    ageMs: number;
    durationMs: number;
  }

  let {
    map,
    fog,
    cameraTile,
    viewport,
    blips = [],
    onJump,
    pings = [],
    pixelsPerTile = 4,
  }: {
    map: MapDefinition;
    fog?: FogOfWarSnapshot;
    cameraTile: TilePos;
    viewport?: RtsViewportBounds;
    blips?: RtsMinimapBlip[];
    onJump?: (tile: TilePos) => void;
    pings?: MinimapPing[];
    pixelsPerTile?: number;
  } = $props();

  let canvas = $state<HTMLCanvasElement | null>(null);

  function tileColor(col: number, row: number): string {
    const t = map.terrain[row]?.[col];
    if (!t) return '#000';
    if (t === 'water') return '#3b7fbf';
    if (t === 'cliff') return '#1d1d1d';
    if (t === 'rock') return '#7a7a7a';
    if (t === 'dirt') return '#8c6b3f';
    if (t === 'shallow') return '#76b9d6';
    return '#6db15a';
  }

  $effect(() => {
    if (!canvas) return;
    canvas.width = map.size.cols * pixelsPerTile;
    canvas.height = map.size.rows * pixelsPerTile;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    for (let row = 0; row < map.size.rows; row++) {
      for (let col = 0; col < map.size.cols; col++) {
        const v = fog ? fog.cells[row * fog.cols + col] : 2;
        let color = tileColor(col, row);
        if (v === 0) color = '#000';
        else if (v === 1) color = darken(color);
        ctx.fillStyle = color;
        ctx.fillRect(col * pixelsPerTile, row * pixelsPerTile, pixelsPerTile, pixelsPerTile);
        const meta = getTerrainMetadata(map.terrain[row]![col]!);
        if (meta.blocksVision) {
          // small accent
        }
      }
    }

    for (const blip of blips) {
      const visibility = fog ? fog.cells[blip.row * fog.cols + blip.col] : 2;
      if (visibility === 0) continue;
      const x = (blip.col + 0.5) * pixelsPerTile;
      const y = (blip.row + 0.5) * pixelsPerTile;
      const size = blip.category === 'building' ? pixelsPerTile * 1.25 : blip.category === 'resource' ? pixelsPerTile * 0.9 : pixelsPerTile * 0.75;
      ctx.fillStyle = blip.relation === 'friendly'
        ? '#7dd3fc'
        : blip.relation === 'enemy'
          ? '#f87171'
          : '#fbbf24';
      if (blip.category === 'building') {
        ctx.fillRect(x - size / 2, y - size / 2, size, size);
      } else {
        ctx.beginPath();
        ctx.arc(x, y, size / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      if (blip.selected) {
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,255,0.85)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    for (const ping of pings) {
      const visibility = fog ? fog.cells[ping.tile.row * fog.cols + ping.tile.col] : 2;
      if (visibility === 0) continue;
      const t = Math.min(1, ping.ageMs / ping.durationMs);
      const radius = pixelsPerTile * (1.1 + t * 3.2);
      ctx.beginPath();
      ctx.arc(
        (ping.tile.col + 0.5) * pixelsPerTile,
        (ping.tile.row + 0.5) * pixelsPerTile,
        radius,
        0,
        Math.PI * 2,
      );
      ctx.strokeStyle = ping.severity === 'danger'
        ? `rgba(248, 113, 113, ${0.95 - t * 0.7})`
        : `rgba(250, 204, 21, ${0.85 - t * 0.65})`;
      ctx.lineWidth = Math.max(1, pixelsPerTile * 0.45 * (1 - t * 0.45));
      ctx.stroke();
    }

    if (viewport) {
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 1;
      ctx.strokeRect(
        viewport.minCol * pixelsPerTile,
        viewport.minRow * pixelsPerTile,
        Math.max(1, (viewport.maxCol - viewport.minCol + 1) * pixelsPerTile),
        Math.max(1, (viewport.maxRow - viewport.minRow + 1) * pixelsPerTile),
      );
    }

    // Camera reticle.
    ctx.strokeStyle = 'yellow';
    ctx.lineWidth = 1;
    const camX = cameraTile.col * pixelsPerTile;
    const camY = cameraTile.row * pixelsPerTile;
    ctx.strokeRect(camX - 12, camY - 8, 24, 16);
  });

  function darken(input: string): string {
    if (!input.startsWith('#')) return input;
    const r = Math.max(0, parseInt(input.slice(1, 3), 16) - 60);
    const g = Math.max(0, parseInt(input.slice(3, 5), 16) - 60);
    const b = Math.max(0, parseInt(input.slice(5, 7), 16) - 60);
    return `rgb(${r}, ${g}, ${b})`;
  }

  function handleClick(event: MouseEvent): void {
    if (!canvas || !onJump) return;
    const rect = canvas.getBoundingClientRect();
    const col = Math.floor((event.clientX - rect.left) / pixelsPerTile);
    const row = Math.floor((event.clientY - rect.top) / pixelsPerTile);
    onJump({ col: Math.max(0, Math.min(map.size.cols - 1, col)), row: Math.max(0, Math.min(map.size.rows - 1, row)) });
  }
</script>

<canvas
  bind:this={canvas}
  onclick={handleClick}
  data-testid="rts-minimap"
  class="minimap"
></canvas>

<style>
  .minimap {
    background: #000;
    image-rendering: pixelated;
    border: 1px solid rgba(255, 255, 255, 0.4);
    cursor: crosshair;
  }
</style>
