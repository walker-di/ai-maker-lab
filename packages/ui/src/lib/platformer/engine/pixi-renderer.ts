/**
 * Pixi.js v8 renderer adapter. Constructed via `createPixiRenderer()` and
 * passed to the engine through its `rendererFactory` config option.
 *
 * Dynamically imports `pixi.js` so headless tests don't pull in the renderer.
 * Dynamically imports `@pixi/tilemap` in `mount()` so the tile layer uses
 * `CompositeTilemap` with generated placeholder textures (shape bundle), and
 * so `svelte-check` does not depend on NodeNext resolving this package's types.
 */

import type { Texture } from 'pixi.js';
import type { AssetBundle, EntityPlaceholder } from './assets.js';
import type { EngineRenderer, RenderEntity, RenderSnapshot } from './PlatformerEngine.js';
import type { MapDefinition, TileKind } from '../types.js';
import { applyTileCellUpdates, cloneTileGrid } from './tile-layer-ops.js';

interface PixiModule {
  Application: any;
  Container: any;
  Graphics: any;
  Text: any;
  Rectangle: new (x?: number, y?: number, width?: number, height?: number) => any;
}

let pixiPromise: Promise<PixiModule> | null = null;
async function loadPixi(): Promise<PixiModule> {
  if (!pixiPromise) {
    pixiPromise = import(/* @vite-ignore */ 'pixi.js') as Promise<PixiModule>;
  }
  return pixiPromise;
}

export interface PixiRendererOptions {
  width?: number;
  height?: number;
  backgroundColor?: number;
}

/**
 * Build a renderer factory the engine can use. Each call constructs a fresh
 * Application bound to the mount target.
 */
export function createPixiRendererFactory(options: PixiRendererOptions = {}): () => Promise<EngineRenderer> {
  return async () => new PixiRenderer(options);
}

class PixiRenderer implements EngineRenderer {
  private app: any | null = null;
  private pixi: PixiModule | null = null;
  private background: any | null = null;
  /** `@pixi/tilemap` `CompositeTilemap` instance (typed loosely for `addChild`). */
  private tileLayer: any = null;
  private entityLayer: any | null = null;
  private hudLayer: any | null = null;
  private worldRoot: any | null = null;
  private entitySprites = new Map<number, any>();
  private bundle: AssetBundle | null = null;
  private map: MapDefinition | null = null;
  private tileKindGrid: TileKind[][] | null = null;
  private readonly tileTextures = new Map<string, Texture>();
  private viewportWidth: number;
  private viewportHeight: number;

  constructor(private readonly options: PixiRendererOptions) {
    this.viewportWidth = options.width ?? 320;
    this.viewportHeight = options.height ?? 200;
  }

  async mount(target: HTMLCanvasElement | HTMLDivElement): Promise<void> {
    this.pixi = await loadPixi();
    const { Application, Container } = this.pixi;
    const app = new Application();
    await app.init({
      width: this.viewportWidth,
      height: this.viewportHeight,
      backgroundColor: this.options.backgroundColor ?? 0x79b6ff,
      antialias: false,
    });
    if (target.tagName === 'CANVAS') {
      target.parentElement?.replaceChild(app.canvas, target);
    } else {
      target.appendChild(app.canvas);
    }
    this.app = app;

    const { Container: C } = this.pixi!;
    this.background = new C();
    this.worldRoot = new C();
    const { CompositeTilemap } = (await import('@pixi/tilemap')) as unknown as {
      CompositeTilemap: new () => any;
    };
    this.tileLayer = new CompositeTilemap();
    this.entityLayer = new C();
    this.hudLayer = new C();
    this.worldRoot.addChild(this.tileLayer);
    this.worldRoot.addChild(this.entityLayer);
    app.stage.addChild(this.background);
    app.stage.addChild(this.worldRoot);
    app.stage.addChild(this.hudLayer);
  }

  loadMap(map: MapDefinition, bundle: AssetBundle): void {
    if (!this.app) return;
    this.clearTileTextureCache();
    this.bundle = bundle;
    this.map = map;
    this.tileKindGrid = cloneTileGrid(map.tiles);
    this.entityLayer?.removeChildren();
    this.entitySprites.clear();

    const bg = bundle.backgrounds[map.background];
    if (bg) {
      this.background.removeChildren();
      const color = bg.gradient[0] ?? '#79b6ff';
      this.app.renderer.background.color = parseColor(color);
    }

    this.rebuildTileLayer();
  }

  render(snapshot: RenderSnapshot): void {
    if (!this.app || !this.bundle || !this.map || !this.tileKindGrid) return;

    if (snapshot.tileUpdates.length > 0) {
      applyTileCellUpdates(this.tileKindGrid, snapshot.tileUpdates);
      this.rebuildTileLayer();
    }

    const liveIds = new Set<number>();
    for (const entity of snapshot.entities) {
      liveIds.add(entity.id);
      let sprite = this.entitySprites.get(entity.id);
      if (!sprite) {
        sprite = this.makeEntityGraphic(entity, this.bundle.entities[entity.kind as keyof typeof this.bundle.entities] ?? {
          tint: entity.tint, width: entity.width, height: entity.height, shape: entity.shape,
        });
        this.entityLayer!.addChild(sprite);
        this.entitySprites.set(entity.id, sprite);
      }
      sprite.x = entity.x;
      sprite.y = entity.y;
    }
    for (const [id, sprite] of this.entitySprites) {
      if (!liveIds.has(id)) {
        this.entityLayer!.removeChild(sprite);
        sprite.destroy?.();
        this.entitySprites.delete(id);
      }
    }

    this.worldRoot!.x = -snapshot.cameraX;
  }

  dispose(): void {
    this.clearTileTextureCache();
    try {
      this.app?.destroy(true, { children: true });
    } catch (_err) {
      void _err;
    }
    this.app = null;
    this.tileLayer = null;
    this.entitySprites.clear();
  }

  private clearTileTextureCache(): void {
    for (const tex of this.tileTextures.values()) {
      tex.destroy(true);
    }
    this.tileTextures.clear();
  }

  private textureCacheKey(kind: TileKind, tileSize: number): string {
    return `${kind}:${tileSize}`;
  }

  private getOrCreateTileTexture(kind: TileKind, tileSize: number): Texture | null {
    if (!this.app || !this.pixi || !this.bundle || kind === 'empty') return null;
    const key = this.textureCacheKey(kind, tileSize);
    const cached = this.tileTextures.get(key);
    if (cached) return cached;
    const ph = this.bundle.tiles[kind];
    const g = new this.pixi.Graphics();
    paintShape(g, ph.shape, 0, 0, tileSize, tileSize, ph.tint);
    const frame = new this.pixi.Rectangle(0, 0, tileSize, tileSize);
    const tex = this.app.renderer.generateTexture({ target: g, frame }) as Texture;
    this.tileTextures.set(key, tex);
    return tex;
  }

  private rebuildTileLayer(): void {
    if (!this.tileLayer || !this.tileKindGrid || !this.map || !this.bundle) return;
    this.tileLayer.clear();
    const ts = this.map.tileSize;
    for (let row = 0; row < this.tileKindGrid.length; row++) {
      const line = this.tileKindGrid[row]!;
      for (let col = 0; col < line.length; col++) {
        const kind = line[col]!;
        if (kind === 'empty') continue;
        const tex = this.getOrCreateTileTexture(kind, ts);
        if (!tex) continue;
        this.tileLayer.tile(tex, col * ts, row * ts, { tileWidth: ts, tileHeight: ts });
      }
    }
  }

  private makeEntityGraphic(entity: RenderEntity, placeholder: EntityPlaceholder | { tint: number; width: number; height: number; shape: 'rect' | 'roundRect' | 'circle' | 'triangle' }): any {
    if (!this.pixi) throw new Error('Pixi renderer not mounted');
    const g = new this.pixi.Graphics();
    paintShape(g, placeholder.shape, 0, 0, entity.width, entity.height, placeholder.tint);
    return g;
  }
}

function paintShape(g: any, shape: 'rect' | 'roundRect' | 'circle' | 'triangle', x: number, y: number, w: number, h: number, color: number): void {
  if (shape === 'rect') {
    g.rect(x, y, w, h);
  } else if (shape === 'roundRect') {
    g.roundRect(x, y, w, h, Math.min(w, h) * 0.25);
  } else if (shape === 'circle') {
    g.circle(x + w / 2, y + h / 2, Math.min(w, h) / 2);
  } else if (shape === 'triangle') {
    g.poly([x + w / 2, y, x + w, y + h, x, y + h]);
  }
  g.fill({ color, alpha: 1 });
}

function parseColor(input: string): number {
  if (input.startsWith('#')) {
    return parseInt(input.slice(1), 16);
  }
  return 0x79b6ff;
}
