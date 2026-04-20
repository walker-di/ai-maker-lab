<script lang="ts">
  import { onMount } from 'svelte';
  import type { MapEditorModel } from './map-editor.svelte.ts';
  import type { ToolPointerPayload } from './tools/index.js';
  import { DEFAULT_BUNDLE } from '../engine/assets.js';

  let { model }: { model: MapEditorModel } = $props();

  let canvasEl: HTMLCanvasElement | undefined = $state();
  let dragging = $state(false);

  function tileSizePx(): number {
    return model.map.tileSize * model.viewport.zoom;
  }

  function pointToCell(clientX: number, clientY: number): { col: number; row: number } | null {
    if (!canvasEl) return null;
    const rect = canvasEl.getBoundingClientRect();
    const tile = tileSizePx();
    const col = Math.floor((clientX - rect.left - model.viewport.offsetX) / tile);
    const row = Math.floor((clientY - rect.top - model.viewport.offsetY) / tile);
    if (col < 0 || row < 0 || col >= model.map.size.cols || row >= model.map.size.rows) return null;
    return { col, row };
  }

  function buildPayload(event: PointerEvent, cell: { col: number; row: number }): ToolPointerPayload {
    return {
      col: cell.col,
      row: cell.row,
      modifier: event.ctrlKey || event.metaKey,
      clientX: event.clientX,
      clientY: event.clientY,
    };
  }

  function dummyPayload(event: PointerEvent): ToolPointerPayload {
    return {
      col: 0,
      row: 0,
      modifier: false,
      clientX: event.clientX,
      clientY: event.clientY,
    };
  }

  function resolveCellForUp(event: PointerEvent): { col: number; row: number } | null {
    return pointToCell(event.clientX, event.clientY) ?? model.cursor;
  }

  function handlePointerDown(event: PointerEvent) {
    const cell = pointToCell(event.clientX, event.clientY);
    if (!cell) return;
    dragging = true;
    model.handlePointerDown(buildPayload(event, cell));
  }

  function handlePointerMove(event: PointerEvent) {
    const cell = pointToCell(event.clientX, event.clientY);
    if (cell) model.cursor = cell;
    else model.cursor = null;
    if (!dragging) return;
    if (model.selectedTool === 'pan') {
      model.handlePointerDrag(dummyPayload(event));
      return;
    }
    if (!cell) return;
    model.handlePointerDrag(buildPayload(event, cell));
  }

  function handlePointerUp(event: PointerEvent) {
    if (!dragging) return;
    if (model.selectedTool === 'pan') {
      model.handlePointerUp(dummyPayload(event));
    } else {
      let cell = resolveCellForUp(event);
      if (!cell && model.rectangleAnchor && model.selectedTool === 'rectangle') {
        cell = model.rectangleAnchor;
      }
      if (cell) model.handlePointerUp(buildPayload(event, cell));
      else if (model.rectangleAnchor && model.selectedTool === 'rectangle') {
        model.clearRectangleAnchor();
      }
    }
    dragging = false;
  }

  function handleWheel(event: WheelEvent) {
    event.preventDefault();
    const delta = event.deltaY > 0 ? -0.25 : 0.25;
    const zoom = Math.max(1, Math.min(6, model.viewport.zoom + delta));
    model.viewport = { ...model.viewport, zoom };
  }

  function draw() {
    if (!canvasEl) return;
    const ctx = canvasEl.getContext('2d');
    if (!ctx) return;
    const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio ?? 1) : 1;
    const cssW = canvasEl.clientWidth;
    const cssH = canvasEl.clientHeight;
    if (canvasEl.width !== cssW * dpr || canvasEl.height !== cssH * dpr) {
      canvasEl.width = cssW * dpr;
      canvasEl.height = cssH * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#1a1d2e';
    ctx.fillRect(0, 0, cssW, cssH);
    const ts = tileSizePx();
    const offX = model.viewport.offsetX;
    const offY = model.viewport.offsetY;
    for (let row = 0; row < model.map.size.rows; row++) {
      for (let col = 0; col < model.map.size.cols; col++) {
        const kind = model.map.tiles[row]![col]!;
        const x = offX + col * ts;
        const y = offY + row * ts;
        if (kind !== 'empty') {
          const tp = DEFAULT_BUNDLE.tiles[kind];
          ctx.fillStyle = `#${tp.tint.toString(16).padStart(6, '0')}`;
          paintShape(ctx, tp.shape, x, y, ts, ts);
        }
        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.strokeRect(x + 0.5, y + 0.5, ts, ts);
      }
    }
    for (const entity of model.map.entities) {
      const place = DEFAULT_BUNDLE.entities[entity.kind];
      if (!place) continue;
      ctx.fillStyle = `#${place.tint.toString(16).padStart(6, '0')}`;
      const x = offX + entity.tile.col * ts + (ts - place.width * model.viewport.zoom) / 2;
      const y = offY + entity.tile.row * ts + ts - place.height * model.viewport.zoom;
      paintShape(ctx, place.shape, x, y, place.width * model.viewport.zoom, place.height * model.viewport.zoom);
    }
    // Spawn marker
    {
      const x = offX + model.map.spawn.col * ts;
      const y = offY + model.map.spawn.row * ts;
      ctx.strokeStyle = '#3df0ff';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, ts - 2, ts - 2);
      ctx.fillStyle = '#3df0ff';
      ctx.font = `${Math.max(10, ts / 2)}px ui-monospace, monospace`;
      ctx.fillText('S', x + 4, y + ts - 4);
    }
    // Goal marker
    {
      const x = offX + model.map.goal.col * ts;
      const y = offY + model.map.goal.row * ts;
      ctx.strokeStyle = '#ffd23d';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, ts - 2, ts - 2);
      ctx.fillStyle = '#ffd23d';
      ctx.font = `${Math.max(10, ts / 2)}px ui-monospace, monospace`;
      ctx.fillText('G', x + 4, y + ts - 4);
    }
    if (model.cursor) {
      const x = offX + model.cursor.col * ts;
      const y = offY + model.cursor.row * ts;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, ts - 1, ts - 1);
    }
  }

  function paintShape(
    ctx: CanvasRenderingContext2D,
    shape: 'rect' | 'roundRect' | 'circle' | 'triangle',
    x: number,
    y: number,
    w: number,
    h: number,
  ): void {
    if (shape === 'rect') {
      ctx.fillRect(x, y, w, h);
    } else if (shape === 'roundRect') {
      const r = Math.min(w, h) * 0.25;
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.fill();
    } else if (shape === 'circle') {
      ctx.beginPath();
      ctx.arc(x + w / 2, y + h / 2, Math.min(w, h) / 2, 0, Math.PI * 2);
      ctx.fill();
    } else if (shape === 'triangle') {
      ctx.beginPath();
      ctx.moveTo(x + w / 2, y);
      ctx.lineTo(x + w, y + h);
      ctx.lineTo(x, y + h);
      ctx.closePath();
      ctx.fill();
    }
  }

  $effect(() => {
    // Touch reactive sources, then redraw.
    void model.map;
    void model.cursor;
    void model.viewport;
    void model.rectangleAnchor;
    draw();
  });

  onMount(() => {
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => draw()) : null;
    if (ro && canvasEl) ro.observe(canvasEl);
    draw();
    return () => ro?.disconnect();
  });
</script>

<canvas
  bind:this={canvasEl}
  class="map-editor-canvas"
  data-testid="map-editor-canvas"
  onpointerdown={handlePointerDown}
  onpointermove={handlePointerMove}
  onpointerup={handlePointerUp}
  onpointerleave={() => (model.cursor = null)}
  onwheel={handleWheel}
></canvas>

<style>
  .map-editor-canvas {
    display: block;
    width: 100%;
    height: 100%;
    background: #11131e;
    border-radius: 0.25rem;
    cursor: crosshair;
    touch-action: none;
  }
</style>
