/**
 * Pixi.js v8 renderer adapter for the RTS engine. Renders a flat top-down
 * orthogonal grid: square terrain tiles with altitude shading + cliff edges
 * + a small vertical lift, iconic shapes for buildings/units, and a
 * grid-aligned fog overlay. Uses dynamic import so headless tests stay
 * framework-free.
 */
import type { MapDefinition, TerrainKind, TilePos } from '../types.js';
import { OrthoProjection } from './iso.js';
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
  /** Pixels lifted per altitude level. Defaults to 6. */
  altitudeStep?: number;
}

const TERRAIN_COLORS: Record<TerrainKind, number> = {
  grass: 0x6db15a,
  dirt: 0x8c6b3f,
  rock: 0x7a7a7a,
  water: 0x3b7fbf,
  shallow: 0x76b9d6,
  cliff: 0x303030,
};

const CLIFF_EDGE_COLOR = 0x1a1a22;
const CLIFF_EDGE_ALPHA = 0.75;
const ALTITUDE_TINT_STEP = 0.08;

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
  private projection: OrthoProjection | null = null;
  private map: MapDefinition | null = null;
  private viewportWidth: number;
  private viewportHeight: number;
  private altitudeStep: number;
  private entitySprites = new Map<number, any>();
  private cameraOffset = { x: 0, y: 0 };
  private cameraScale = 1;

  constructor(private readonly options: PixiRtsRendererOptions) {
    this.viewportWidth = options.width ?? 960;
    this.viewportHeight = options.height ?? 540;
    this.altitudeStep = options.altitudeStep ?? 6;
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
    this.projection = new OrthoProjection({
      tileSize: map.tileSize,
      altitudeStep: this.altitudeStep,
      originX: 0,
      originY: 0,
    });
    this.terrainLayer.removeChildren();
    this.entityLayer.removeChildren();
    this.fogLayer.removeChildren();
    this.entitySprites.clear();

    const { Graphics } = this.pixi;
    const { width, height } = map.tileSize;
    const altitude = map.altitude.levels;

    for (let row = 0; row < map.size.rows; row++) {
      for (let col = 0; col < map.size.cols; col++) {
        const kind = map.terrain[row]![col]!;
        const a = altitude[row]![col]!;
        const screen = this.projection.tileToScreen({ col, row }, a);
        const g = new Graphics();
        const baseColor = TERRAIN_COLORS[kind] ?? 0x6db15a;
        const shaded = lerpColor(baseColor, 0xffffff, ALTITUDE_TINT_STEP * a);
        g.rect(0, 0, width, height);
        g.fill({ color: shaded, alpha: 1 });

        const rightAltitude = col + 1 < map.size.cols ? altitude[row]![col + 1]! : a;
        const downAltitude = row + 1 < map.size.rows ? altitude[row + 1]![col]! : a;
        const leftAltitude = col - 1 >= 0 ? altitude[row]![col - 1]! : a;
        const upAltitude = row - 1 >= 0 ? altitude[row - 1]![col]! : a;

        if (rightAltitude < a) {
          g.rect(width - 2, 0, 2, height);
          g.fill({ color: CLIFF_EDGE_COLOR, alpha: CLIFF_EDGE_ALPHA });
        }
        if (downAltitude < a) {
          g.rect(0, height - 2, width, 2);
          g.fill({ color: CLIFF_EDGE_COLOR, alpha: CLIFF_EDGE_ALPHA });
        }
        if (leftAltitude < a) {
          g.rect(0, 0, 2, height);
          g.fill({ color: CLIFF_EDGE_COLOR, alpha: CLIFF_EDGE_ALPHA });
        }
        if (upAltitude < a) {
          g.rect(0, 0, width, 2);
          g.fill({ color: CLIFF_EDGE_COLOR, alpha: CLIFF_EDGE_ALPHA });
        }

        g.x = screen.x;
        g.y = screen.y;
        this.terrainLayer.addChild(g);
      }
    }
  }

  render(snapshot: RtsRendererSnapshot): void {
    if (!this.app || !this.pixi || !this.projection || !this.map) return;
    const { Graphics } = this.pixi;
    const { width: tileW, height: tileH } = this.map.tileSize;
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

      const tint = entity.tint;
      if (entity.kind.startsWith('building-')) {
        this.drawBuildingIcon(sprite, entity, tileW, tileH, tint);
      } else if (entity.kind.startsWith('unit-')) {
        this.drawUnitIcon(sprite, tileW, tileH, tint);
      } else if (entity.kind === 'mineral-node' || entity.kind === 'gas-node') {
        this.drawResourceIcon(sprite, tileW, tileH, tint);
      } else if (entity.kind.startsWith('projectile-')) {
        sprite.circle(0, 0, 2);
        sprite.fill({ color: tint });
      } else {
        sprite.rect(-tileW / 4, -tileH / 4, tileW / 2, tileH / 2);
        sprite.fill({ color: tint });
      }

      if (entity.selected) {
        const r = Math.max(tileW, tileH) * 0.45;
        sprite.circle(0, 0, r);
        sprite.stroke({ color: 0xffffff, width: 2 });
      }
      if (entity.hpRatio !== undefined && entity.hpRatio < 1) {
        const w = tileW * 0.7;
        const y = -tileH * 0.55;
        sprite.rect(-w / 2, y, w, 3);
        sprite.fill({ color: 0x222222 });
        sprite.rect(-w / 2, y, w * entity.hpRatio, 3);
        sprite.fill({ color: 0x66ff66 });
      }

      // Position entity at the centre of its tile.
      const screen = this.projection.tileToScreen(
        { col: entity.col - 0.5, row: entity.row - 0.5 },
        entity.altitude,
      );
      sprite.x = screen.x + tileW / 2;
      sprite.y = screen.y + tileH / 2;
    }
    for (const [id, sprite] of this.entitySprites) {
      if (!liveIds.has(id)) {
        this.entityLayer.removeChild(sprite);
        sprite.destroy?.();
        this.entitySprites.delete(id);
      }
    }

    // Camera centering: place the camera tile at viewport center.
    const cameraScreen = this.projection.tileToScreen(snapshot.cameraTile, 0);
    this.cameraOffset.x = this.viewportWidth / 2 - cameraScreen.x * snapshot.cameraZoom;
    this.cameraOffset.y = this.viewportHeight / 2 - cameraScreen.y * snapshot.cameraZoom;
    this.cameraScale = snapshot.cameraZoom;
    this.worldRoot.x = this.cameraOffset.x;
    this.worldRoot.y = this.cameraOffset.y;
    this.worldRoot.scale.set(snapshot.cameraZoom);

    if (snapshot.fog) {
      this.fogLayer.removeChildren();
      const overlay = new Graphics();
      const cells = snapshot.fog.cells;
      const altitude = this.map.altitude.levels;
      for (let row = 0; row < snapshot.fog.rows; row++) {
        for (let col = 0; col < snapshot.fog.cols; col++) {
          const v = cells[row * snapshot.fog.cols + col]!;
          if (v === 2) continue;
          const a = altitude[row]?.[col] ?? 0;
          const screen = this.projection.tileToScreen({ col, row }, a);
          overlay.rect(screen.x, screen.y, tileW, tileH);
          overlay.fill({ color: 0x000000, alpha: v === 0 ? 0.85 : 0.45 });
        }
      }
      this.fogLayer.addChild(overlay);
    }
  }

  private drawBuildingIcon(
    sprite: any,
    entity: RtsRendererSnapshot['entities'][number],
    tileW: number,
    tileH: number,
    tint: number,
  ): void {
    // entity.width/height are passed in pixel units that already encode the
    // building footprint (`footprint.cols * 32`). Convert back to tiles so we
    // size to the actual map's tile dimensions.
    const cols = Math.max(1, Math.round(entity.width / 32));
    const rows = Math.max(1, Math.round(entity.height / 32));
    const w = cols * tileW * 0.85;
    const h = rows * tileH * 0.7;
    const x = -w / 2;
    const y = -h / 2;
    sprite.rect(x, y, w, h);
    sprite.fill({ color: tint });
    sprite.stroke({ color: darken(tint, 0.45), width: 1 });
    // Roof: dark triangle on top.
    sprite.poly([
      x, y,
      x + w, y,
      x + w / 2, y - h * 0.45,
    ]);
    sprite.fill({ color: darken(tint, 0.45) });
    // Door/window hint.
    sprite.rect(x + w * 0.4, y + h * 0.55, w * 0.2, h * 0.4);
    sprite.fill({ color: darken(tint, 0.55) });
  }

  private drawUnitIcon(sprite: any, tileW: number, tileH: number, tint: number): void {
    const r = Math.min(tileW, tileH) * 0.32;
    sprite.circle(0, 0, r);
    sprite.fill({ color: tint });
    sprite.stroke({ color: darken(tint, 0.55), width: 1 });
    // Forward-facing notch (facing 'up').
    sprite.poly([
      0, -r * 1.05,
      r * 0.45, -r * 0.4,
      -r * 0.45, -r * 0.4,
    ]);
    sprite.fill({ color: lerpColor(tint, 0xffffff, 0.35) });
  }

  private drawResourceIcon(sprite: any, tileW: number, tileH: number, tint: number): void {
    const w = tileW * 0.55;
    const h = tileH * 0.55;
    sprite.rect(-w / 2, -h / 2, w, h);
    sprite.fill({ color: tint });
    sprite.stroke({ color: darken(tint, 0.5), width: 1 });
  }

  getCanvas(): HTMLCanvasElement | null {
    return (this.app?.canvas as HTMLCanvasElement | undefined) ?? null;
  }

  screenToTile(clientX: number, clientY: number): TilePos | null {
    if (!this.app || !this.projection) return null;
    const canvas = this.app.canvas as HTMLCanvasElement | undefined;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    const internalX = ((clientX - rect.left) / rect.width) * this.viewportWidth;
    const internalY = ((clientY - rect.top) / rect.height) * this.viewportHeight;
    const worldX = (internalX - this.cameraOffset.x) / this.cameraScale;
    const worldY = (internalY - this.cameraOffset.y) / this.cameraScale;
    return this.projection.screenToTile({ x: worldX, y: worldY });
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

function lerpColor(a: number, b: number, t: number): number {
  const clamped = Math.max(0, Math.min(1, t));
  const ar = (a >> 16) & 0xff;
  const ag = (a >> 8) & 0xff;
  const ab = a & 0xff;
  const br = (b >> 16) & 0xff;
  const bg = (b >> 8) & 0xff;
  const bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * clamped);
  const g = Math.round(ag + (bg - ag) * clamped);
  const blue = Math.round(ab + (bb - ab) * clamped);
  return (r << 16) | (g << 8) | blue;
}

function darken(color: number, amount: number): number {
  return lerpColor(color, 0x000000, amount);
}
