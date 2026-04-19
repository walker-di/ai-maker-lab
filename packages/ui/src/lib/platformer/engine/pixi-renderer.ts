/**
 * Pixi.js v8 renderer adapter. Constructed via `createPixiRenderer()` and
 * passed to the engine through its `rendererFactory` config option.
 *
 * Dynamically imports `pixi.js` so headless tests don't pull in the renderer.
 */

import type { AssetBundle, EntityPlaceholder, TilePlaceholder } from './assets.js';
import type { EngineRenderer, RenderEntity, RenderSnapshot } from './PlatformerEngine.js';
import type { MapDefinition, TileKind } from '../types.js';

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
  private tileLayer: any | null = null;
  private entityLayer: any | null = null;
  private hudLayer: any | null = null;
  private worldRoot: any | null = null;
  private tileGfx = new Map<string, any>();
  private entitySprites = new Map<number, any>();
  private bundle: AssetBundle | null = null;
  private map: MapDefinition | null = null;
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
      // Pixi creates its own canvas; if user passed a canvas element, replace.
      target.parentElement?.replaceChild(app.canvas, target);
    } else {
      target.appendChild(app.canvas);
    }
    this.app = app;

    const { Container: C } = this.pixi!;
    this.background = new C();
    this.worldRoot = new C();
    this.tileLayer = new C();
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
    this.bundle = bundle;
    this.map = map;
    this.tileLayer.removeChildren();
    this.entityLayer.removeChildren();
    this.entitySprites.clear();
    this.tileGfx.clear();

    // Background gradient as a flat fill (placeholder bundle).
    const bg = bundle.backgrounds[map.background];
    if (bg) {
      this.background.removeChildren();
      // The placeholder simply paints the first gradient color full screen.
      const color = bg.gradient[0] ?? '#79b6ff';
      this.app.renderer.background.color = parseColor(color);
    }

    for (let row = 0; row < map.size.rows; row++) {
      for (let col = 0; col < map.size.cols; col++) {
        const kind = map.tiles[row]![col]!;
        if (kind === 'empty') continue;
        const gfx = this.makeTileGraphic(kind, bundle.tiles[kind], map.tileSize);
        gfx.x = col * map.tileSize;
        gfx.y = row * map.tileSize;
        this.tileLayer.addChild(gfx);
        this.tileGfx.set(`${col},${row}`, gfx);
      }
    }
  }

  render(snapshot: RenderSnapshot): void {
    if (!this.app || !this.bundle || !this.map) return;

    // Apply tile updates from the engine.
    for (const update of snapshot.tileUpdates) {
      const key = `${update.col},${update.row}`;
      const existing = this.tileGfx.get(key);
      if (existing) {
        this.tileLayer.removeChild(existing);
        existing.destroy?.();
        this.tileGfx.delete(key);
      }
      if (update.kind !== 'empty') {
        const gfx = this.makeTileGraphic(update.kind, this.bundle.tiles[update.kind], this.map.tileSize);
        gfx.x = update.col * this.map.tileSize;
        gfx.y = update.row * this.map.tileSize;
        this.tileLayer.addChild(gfx);
        this.tileGfx.set(key, gfx);
      }
    }

    // Diff and apply entities.
    const liveIds = new Set<number>();
    for (const entity of snapshot.entities) {
      liveIds.add(entity.id);
      let sprite = this.entitySprites.get(entity.id);
      if (!sprite) {
        sprite = this.makeEntityGraphic(entity, this.bundle.entities[entity.kind as keyof typeof this.bundle.entities] ?? {
          tint: entity.tint, width: entity.width, height: entity.height, shape: entity.shape,
        });
        this.entityLayer.addChild(sprite);
        this.entitySprites.set(entity.id, sprite);
      }
      sprite.x = entity.x;
      sprite.y = entity.y;
    }
    for (const [id, sprite] of this.entitySprites) {
      if (!liveIds.has(id)) {
        this.entityLayer.removeChild(sprite);
        sprite.destroy?.();
        this.entitySprites.delete(id);
      }
    }

    this.worldRoot.x = -snapshot.cameraX;
  }

  dispose(): void {
    try {
      this.app?.destroy(true, { children: true });
    } catch (_err) {
      void _err;
    }
    this.app = null;
    this.tileGfx.clear();
    this.entitySprites.clear();
  }

  private makeTileGraphic(kind: TileKind, placeholder: TilePlaceholder, tileSize: number): any {
    if (!this.pixi) throw new Error('Pixi renderer not mounted');
    const g = new this.pixi.Graphics();
    paintShape(g, placeholder.shape, 0, 0, tileSize, tileSize, placeholder.tint);
    return g;
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
