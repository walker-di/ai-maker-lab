/**
 * Pixi.js v8 renderer adapter for the RTS engine. Renders the iso terrain,
 * entities, and a fog overlay over layered containers. Uses dynamic import
 * so headless tests stay framework-free.
 */
import type { MapDefinition, TerrainKind } from '../types.js';
import { IsoProjection } from './iso.js';
import type { RtsRenderer, RtsRendererSnapshot } from './RtsEngine.js';

interface PixiModule {
  Application: any;
  Container: any;
  Graphics: any;
  Text: any;
}

let pixiPromise: Promise<PixiModule> | null = null;
async function loadPixi(): Promise<PixiModule> {
  if (!pixiPromise) {
    pixiPromise = import(/* @vite-ignore */ 'pixi.js') as Promise<PixiModule>;
  }
  return pixiPromise;
}

export interface PixiRtsRendererOptions {
  width?: number;
  height?: number;
  backgroundColor?: number;
}

const TERRAIN_COLORS: Record<TerrainKind, number> = {
  grass: 0x6db15a,
  dirt: 0x8c6b3f,
  rock: 0x7a7a7a,
  water: 0x3b7fbf,
  shallow: 0x76b9d6,
  cliff: 0x303030,
};

export function createPixiRtsRendererFactory(options: PixiRtsRendererOptions = {}): () => Promise<RtsRenderer> {
  return async () => new PixiRtsRenderer(options);
}

class PixiRtsRenderer implements RtsRenderer {
  private app: any | null = null;
  private pixi: PixiModule | null = null;
  private worldRoot: any | null = null;
  private terrainLayer: any | null = null;
  private entityLayer: any | null = null;
  private fogLayer: any | null = null;
  private hudLayer: any | null = null;
  private projection: IsoProjection | null = null;
  private map: MapDefinition | null = null;
  private viewportWidth: number;
  private viewportHeight: number;
  private entitySprites = new Map<number, any>();

  constructor(private readonly options: PixiRtsRendererOptions) {
    this.viewportWidth = options.width ?? 960;
    this.viewportHeight = options.height ?? 540;
  }

  async mount(target: HTMLDivElement | HTMLCanvasElement): Promise<void> {
    this.pixi = await loadPixi();
    const { Application, Container } = this.pixi;
    const app = new Application();
    await app.init({
      width: this.viewportWidth,
      height: this.viewportHeight,
      backgroundColor: this.options.backgroundColor ?? 0x101820,
      antialias: false,
    });
    if (target.tagName === 'CANVAS') {
      target.parentElement?.replaceChild(app.canvas, target);
    } else {
      target.appendChild(app.canvas);
    }
    this.app = app;
    this.worldRoot = new Container();
    this.terrainLayer = new Container();
    this.entityLayer = new Container();
    this.fogLayer = new Container();
    this.hudLayer = new Container();
    this.worldRoot.addChild(this.terrainLayer);
    this.worldRoot.addChild(this.entityLayer);
    this.worldRoot.addChild(this.fogLayer);
    app.stage.addChild(this.worldRoot);
    app.stage.addChild(this.hudLayer);
  }

  loadMap(map: MapDefinition): void {
    if (!this.app || !this.pixi) return;
    this.map = map;
    this.projection = new IsoProjection({
      tileSize: map.tileSize,
      altitudeStep: 12,
      originX: this.viewportWidth / 2,
      originY: 80,
    });
    this.terrainLayer.removeChildren();
    this.entityLayer.removeChildren();
    this.fogLayer.removeChildren();
    this.entitySprites.clear();
    const { Graphics } = this.pixi;
    for (let row = 0; row < map.size.rows; row++) {
      for (let col = 0; col < map.size.cols; col++) {
        const kind = map.terrain[row]![col]!;
        const altitude = map.altitude.levels[row]![col]!;
        const iso = this.projection.tileToIso({ col, row }, altitude);
        const g = new Graphics();
        const { width, height } = map.tileSize;
        g.poly([0, -height / 2, width / 2, 0, 0, height / 2, -width / 2, 0]);
        g.fill({ color: TERRAIN_COLORS[kind] ?? 0x6db15a, alpha: 1 });
        g.x = iso.x;
        g.y = iso.y;
        this.terrainLayer.addChild(g);
      }
    }
  }

  render(snapshot: RtsRendererSnapshot): void {
    if (!this.app || !this.pixi || !this.projection || !this.map) return;
    const { Graphics } = this.pixi;
    const liveIds = new Set<number>();
    for (const entity of snapshot.entities) {
      liveIds.add(entity.id);
      let sprite = this.entitySprites.get(entity.id);
      if (!sprite) {
        sprite = new Graphics();
        sprite.eventMode = 'static';
        this.entityLayer.addChild(sprite);
        this.entitySprites.set(entity.id, sprite);
      }
      sprite.clear();
      sprite.rect(-entity.width / 2, -entity.height, entity.width, entity.height);
      sprite.fill({ color: entity.tint, alpha: 1 });
      if (entity.selected) {
        sprite.circle(0, 0, Math.max(entity.width, entity.height) * 0.6);
        sprite.stroke({ color: 0xffffff, width: 2 });
      }
      if (entity.hpRatio !== undefined && entity.hpRatio < 1) {
        const w = entity.width;
        sprite.rect(-w / 2, -entity.height - 6, w, 3);
        sprite.fill({ color: 0x222222 });
        sprite.rect(-w / 2, -entity.height - 6, w * entity.hpRatio, 3);
        sprite.fill({ color: 0x66ff66 });
      }
      const iso = this.projection.tileToIso({ col: entity.col - 0.5, row: entity.row - 0.5 }, entity.altitude);
      sprite.x = iso.x;
      sprite.y = iso.y;
    }
    for (const [id, sprite] of this.entitySprites) {
      if (!liveIds.has(id)) {
        this.entityLayer.removeChild(sprite);
        sprite.destroy?.();
        this.entitySprites.delete(id);
      }
    }
    // Camera centering.
    const cameraIso = this.projection.tileToIso(snapshot.cameraTile, 0);
    this.worldRoot.x = this.viewportWidth / 2 - cameraIso.x;
    this.worldRoot.y = this.viewportHeight / 2 - cameraIso.y;
    this.worldRoot.scale.set(snapshot.cameraZoom);

    // Fog overlay (cheap solid fill from snapshot, redrawn per frame).
    if (snapshot.fog) {
      this.fogLayer.removeChildren();
      const { Graphics } = this.pixi;
      const overlay = new Graphics();
      const cells = snapshot.fog.cells;
      for (let row = 0; row < snapshot.fog.rows; row++) {
        for (let col = 0; col < snapshot.fog.cols; col++) {
          const v = cells[row * snapshot.fog.cols + col]!;
          if (v === 2) continue;
          const iso = this.projection.tileToIso({ col, row }, this.map.altitude.levels[row]![col]!);
          const { width, height } = this.map.tileSize;
          overlay.poly([0, -height / 2, width / 2, 0, 0, height / 2, -width / 2, 0]);
          overlay.fill({ color: 0x000000, alpha: v === 0 ? 0.85 : 0.45 });
          overlay.x = iso.x;
          overlay.y = iso.y;
        }
      }
      this.fogLayer.addChild(overlay);
    }
  }

  dispose(): void {
    try {
      this.app?.destroy(true, { children: true });
    } catch (_err) {
      void _err;
    }
    this.app = null;
    this.entitySprites.clear();
  }
}
