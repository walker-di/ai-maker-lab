/**
 * Pixi.js v8 renderer adapter for the RTS engine. Renders a 2:1 isometric
 * grid with altitude lift, Kenney sprite tiles/buildings, iconic fallback
 * shapes, and grid-aligned fog. Uses dynamic import so headless tests stay
 * framework-free.
 */
import type { MapDefinition, TerrainKind, TilePos } from '../types.js';
import { OrthoProjection } from './iso.js';
import type { RtsRenderer, RtsRendererSnapshot } from './RtsEngine.js';
import {
  getSpriteFrame,
  loadRtsAtlases,
  type RtsAtlasSheet,
} from './sprites/atlas.js';

interface PixiModule {
  Application: any;
  Assets: any;
  Container: any;
  Graphics: any;
  Rectangle: any;
  Sprite: any;
  Text: any;
  Texture: any;
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

const BUILDING_SPRITES: Partial<Record<string, { sheet: RtsAtlasSheet; frame: string; width: number }>> = {
  'building-hq': { sheet: 'towersGrey', frame: 'tower_15.png', width: 116 },
  'building-refinery': { sheet: 'towersGrey', frame: 'tower_00.png', width: 78 },
  'building-depot': { sheet: 'towersBrown', frame: 'tower_15.png', width: 60 },
  'building-turret': { sheet: 'towersGrey', frame: 'tower_07.png', width: 38 },
  'building-enemy-camp': { sheet: 'towersRed', frame: 'tower_15.png', width: 134 },
};

const TREE_FRAMES = [
  'trees_1.png',
  'trees_2.png',
  'trees_3.png',
  'trees_4.png',
  'trees_5.png',
  'trees_6.png',
  'trees_7.png',
  'trees_8.png',
  'trees_9.png',
  'trees_10.png',
  'trees_11.png',
  'trees_12.png',
] as const;
const ROCK_FRAMES = [
  'rocks_1.png',
  'rocks_2.png',
  'rocks_3.png',
  'rocks_4.png',
  'rocks_5.png',
  'rocks_6.png',
  'rocks_7.png',
  'rocks_8.png',
] as const;
const CRYSTAL_FRAMES = ['crystals_1.png', 'crystals_2.png', 'crystals_3.png', 'crystals_4.png'] as const;

export function createPixiRtsRendererFactory(options: PixiRtsRendererOptions = {}): () => Promise<RtsRenderer> {
  return async () => new PixiRtsRenderer(options);
}

class PixiRtsRenderer implements RtsRenderer {
  private app: any | null = null;
  private pixi: PixiModule | null = null;
  private worldRoot: any | null = null;
  private terrainLayer: any | null = null;
  private entityLayer: any | null = null;
  private feedbackLayer: any | null = null;
  private fogLayer: any | null = null;
  private hudLayer: any | null = null;
  private projection: OrthoProjection | null = null;
  private map: MapDefinition | null = null;
  private viewportWidth: number;
  private viewportHeight: number;
  private altitudeStep: number;
  private entitySprites = new Map<number, any>();
  private atlasTextures: Partial<Record<RtsAtlasSheet, any>> | null = null;
  private atlasFailed = false;
  private atlasLoadStarted = false;
  private spriteModePreferred = true;
  private frameTextureCache = new Map<string, any>();
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
    this.feedbackLayer = new Container();
    this.fogLayer = new Container();
    this.hudLayer = new Container();
    this.terrainLayer.sortableChildren = true;
    this.entityLayer.sortableChildren = true;
    this.worldRoot.addChild(this.terrainLayer);
    this.worldRoot.addChild(this.entityLayer);
    this.worldRoot.addChild(this.feedbackLayer);
    this.worldRoot.addChild(this.fogLayer);
    app.stage.addChild(this.worldRoot);
    app.stage.addChild(this.hudLayer);
    void this.loadAtlases();
  }

  loadMap(map: MapDefinition): void {
    if (!this.app || !this.pixi) return;
    this.map = map;
    this.projection = new OrthoProjection({
      tileSize: map.tileSize,
      altitudeStep: this.altitudeStep,
      originX: (map.size.rows * map.tileSize.width) / 2 + map.tileSize.width,
      originY: map.tileSize.height,
    });
    this.terrainLayer.removeChildren();
    this.entityLayer.removeChildren();
    this.feedbackLayer.removeChildren();
    this.fogLayer.removeChildren();
    this.entitySprites.clear();

    this.renderTerrain();
  }

  render(snapshot: RtsRendererSnapshot): void {
    if (!this.app || !this.pixi || !this.projection || !this.map) return;
    const { Container, Graphics } = this.pixi;
    const { width: tileW, height: tileH } = this.map.tileSize;
    const liveIds = new Set<number>();

    for (const entity of snapshot.entities) {
      liveIds.add(entity.id);
      let container = this.entitySprites.get(entity.id);
      if (!container) {
        container = new Container();
        container.eventMode = 'static';
        this.entityLayer.addChild(container);
        this.entitySprites.set(entity.id, container);
      }
      container.removeChildren();
      const overlay = new Graphics();

      const tint = entity.tint;
      if (entity.kind.startsWith('building-')) {
        this.drawBuildingIcon(container, overlay, entity, tileW, tileH, tint);
      } else if (entity.kind.startsWith('unit-')) {
        this.drawUnitIcon(overlay, tileW, tileH, tint);
      } else if (entity.kind === 'mineral-node' || entity.kind === 'gas-node') {
        this.drawResourceIcon(overlay, tileW, tileH, tint);
      } else if (entity.kind.startsWith('projectile-')) {
        overlay.circle(0, 0, entity.kind.includes('rocket') ? 4 : 2);
        overlay.fill({ color: tint });
      } else {
        overlay.rect(-tileW / 4, -tileH / 4, tileW / 2, tileH / 2);
        overlay.fill({ color: tint });
      }

      if (entity.selected) {
        const r = Math.max(tileW, tileH) * 0.45;
        overlay.circle(0, 0, r);
        overlay.stroke({ color: 0xffffff, width: 2 });
      }
      if (entity.hpRatio !== undefined && entity.hpRatio < 1) {
        const w = tileW * 0.7;
        const y = -tileH * 0.55;
        overlay.rect(-w / 2, y, w, 3);
        overlay.fill({ color: 0x222222 });
        overlay.rect(-w / 2, y, w * entity.hpRatio, 3);
        overlay.fill({ color: 0x66ff66 });
      }
      container.addChild(overlay);

      const screen = this.projection.tileToScreen({ col: entity.col, row: entity.row }, entity.altitude);
      container.x = screen.x;
      container.y = screen.y;
      container.zIndex = (entity.col + entity.row) * 1000 + entity.altitude * 10;
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
    this.worldRoot.x = this.cameraOffset.x + (snapshot.feedback?.cameraShake.x ?? 0);
    this.worldRoot.y = this.cameraOffset.y + (snapshot.feedback?.cameraShake.y ?? 0);
    this.worldRoot.scale.set(snapshot.cameraZoom);

    this.drawFeedback(snapshot);

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
          drawIsoDiamond(overlay, screen.x, screen.y, tileW, tileH);
          overlay.fill({ color: 0x000000, alpha: v === 0 ? 0.85 : 0.45 });
        }
      }
      this.fogLayer.addChild(overlay);
    }
  }

  private drawFeedback(snapshot: RtsRendererSnapshot): void {
    if (!this.pixi || !this.map || !this.projection || !this.feedbackLayer) return;
    const feedback = snapshot.feedback;
    this.feedbackLayer.removeChildren();
    if (!feedback) return;
    const { Graphics } = this.pixi;
    const { width: tileW, height: tileH } = this.map.tileSize;
    for (const ripple of feedback.ripples) {
      const altitude = this.map.altitude.levels[ripple.tile.row]?.[ripple.tile.col] ?? 0;
      const screen = this.projection.tileToScreen(ripple.tile, altitude);
      const t = Math.min(1, ripple.ageMs / ripple.durationMs);
      const color = orderColor(ripple.kind);
      const g = new Graphics();
      const pad = 3 + t * 12;
      drawIsoDiamond(g, screen.x, screen.y, tileW + pad * 2, tileH + pad);
      g.stroke({ color, alpha: 1 - t, width: 2 });
      this.feedbackLayer.addChild(g);
    }
    if (feedback.combatHeat > 0.05) {
      const vignette = new Graphics();
      const mapW = (this.map.size.cols + this.map.size.rows) * (tileW / 2);
      const mapH = (this.map.size.cols + this.map.size.rows) * (tileH / 2);
      vignette.rect(0, 0, mapW, mapH);
      vignette.stroke({ color: 0xff4433, alpha: feedback.combatHeat * 0.25, width: 8 });
      this.feedbackLayer.addChild(vignette);
    }
  }

  toggleSpriteMode(): void {
    this.spriteModePreferred = !this.spriteModePreferred;
    this.renderTerrain();
  }

  getSpriteMode(): 'sprite' | 'vector' {
    return this.canUseSpriteMode() ? 'sprite' : 'vector';
  }

  private async loadAtlases(): Promise<void> {
    if (this.atlasLoadStarted) return;
    this.atlasLoadStarted = true;
    const result = await loadRtsAtlases();
    if (result.failed) {
      this.atlasFailed = true;
      console.warn('[rts] Kenney TD atlas load failed; using vector renderer');
      return;
    }
    this.atlasTextures = result.textures as Partial<Record<RtsAtlasSheet, any>>;
    this.renderTerrain();
  }

  private canUseSpriteMode(): boolean {
    return this.spriteModePreferred && !this.atlasFailed && this.atlasTextures != null;
  }

  private renderTerrain(): void {
    if (!this.pixi || !this.map || !this.projection || !this.terrainLayer) return;
    this.terrainLayer.removeChildren();
    if (this.canUseSpriteMode()) this.renderSpriteTerrain();
    else this.renderVectorTerrain();
  }

  private renderVectorTerrain(): void {
    if (!this.pixi || !this.map || !this.projection || !this.terrainLayer) return;
    const { Graphics } = this.pixi;
    const { width, height } = this.map.tileSize;
    const altitude = this.map.altitude.levels;

    for (let row = 0; row < this.map.size.rows; row++) {
      for (let col = 0; col < this.map.size.cols; col++) {
        const kind = this.map.terrain[row]![col]!;
        const a = altitude[row]![col]!;
        const screen = this.projection.tileToScreen({ col, row }, a);
        const g = new Graphics();
        const baseColor = TERRAIN_COLORS[kind] ?? 0x6db15a;
        const shaded = lerpColor(baseColor, 0xffffff, ALTITUDE_TINT_STEP * a);
        drawIsoDiamond(g, 0, 0, width, height);
        g.fill({ color: shaded, alpha: 1 });

        const rightAltitude = col + 1 < this.map.size.cols ? altitude[row]![col + 1]! : a;
        const downAltitude = row + 1 < this.map.size.rows ? altitude[row + 1]![col]! : a;
        const leftAltitude = col - 1 >= 0 ? altitude[row]![col - 1]! : a;
        const upAltitude = row - 1 >= 0 ? altitude[row - 1]![col]! : a;

        if (rightAltitude < a) {
          g.moveTo(0, -height / 2);
          g.lineTo(width / 2, 0);
          g.stroke({ color: CLIFF_EDGE_COLOR, alpha: CLIFF_EDGE_ALPHA, width: 2 });
        }
        if (downAltitude < a) {
          g.moveTo(width / 2, 0);
          g.lineTo(0, height / 2);
          g.stroke({ color: CLIFF_EDGE_COLOR, alpha: CLIFF_EDGE_ALPHA, width: 2 });
        }
        if (leftAltitude < a) {
          g.moveTo(0, height / 2);
          g.lineTo(-width / 2, 0);
          g.stroke({ color: CLIFF_EDGE_COLOR, alpha: CLIFF_EDGE_ALPHA, width: 2 });
        }
        if (upAltitude < a) {
          g.moveTo(-width / 2, 0);
          g.lineTo(0, -height / 2);
          g.stroke({ color: CLIFF_EDGE_COLOR, alpha: CLIFF_EDGE_ALPHA, width: 2 });
        }

        g.x = screen.x;
        g.y = screen.y;
        g.zIndex = (col + row) * 1000 + a * 10;
        this.terrainLayer.addChild(g);
      }
    }
  }

  private renderSpriteTerrain(): void {
    if (!this.pixi || !this.map || !this.projection || !this.terrainLayer) return;
    const { Sprite } = this.pixi;
    const { width: tileW, height: tileH } = this.map.tileSize;
    const altitude = this.map.altitude.levels;

    for (let row = 0; row < this.map.size.rows; row++) {
      for (let col = 0; col < this.map.size.cols; col++) {
        const kind = this.map.terrain[row]![col]!;
        const a = altitude[row]![col]!;
        const screen = this.projection.tileToScreen({ col, row }, a);
        if (kind === 'water' || kind === 'shallow') {
          const water = this.drawWaterDiamond(kind, tileW, tileH);
          water.x = screen.x;
          water.y = screen.y;
          water.zIndex = (col + row) * 1000 + a * 10;
          this.terrainLayer.addChild(water);
          continue;
        }

        const frameName = pickTileFrame(kind, a);
        const texture = this.createFrameTexture('landscape', frameName);
        const frame = getSpriteFrame('landscape', frameName);
        if (!texture || !frame) continue;
        const tileSprite = new Sprite(texture);
        const targetW = tileW * 1.35;
        const targetH = targetW * frame.h / frame.w;
        tileSprite.width = targetW;
        tileSprite.height = targetH;
        tileSprite.x = screen.x - targetW / 2;
        tileSprite.y = screen.y - (targetH * 33 / frame.h);
        tileSprite.zIndex = (col + row) * 1000 + a * 10;
        this.terrainLayer.addChild(tileSprite);

        const decor = this.createDecorSprite(kind, col, row, tileW);
        if (decor) {
          decor.x = screen.x;
          decor.y = screen.y + tileH * 0.35;
          decor.zIndex = (col + row) * 1000 + a * 10 + 5;
          this.terrainLayer.addChild(decor);
        }
      }
    }
  }

  private drawWaterDiamond(kind: TerrainKind, tileW: number, tileH: number): any {
    const { Graphics } = this.pixi!;
    const g = new Graphics();
    const color = kind === 'shallow' ? 0x62bdd1 : 0x276eaa;
    drawIsoDiamond(g, 0, 0, tileW, tileH);
    g.fill({ color, alpha: 1 });
    g.stroke({ color: 0xa8f2ff, alpha: 0.45, width: 1 });
    g.moveTo(-tileW * 0.22, -tileH * 0.05);
    g.lineTo(-tileW * 0.04, -tileH * 0.12);
    g.moveTo(tileW * 0.08, tileH * 0.12);
    g.lineTo(tileW * 0.28, tileH * 0.05);
    g.stroke({ color: 0xe7fbff, alpha: 0.5, width: 1 });
    return g;
  }

  private createDecorSprite(kind: TerrainKind, col: number, row: number, tileW: number): any | null {
    if (kind === 'water' || kind === 'shallow' || kind === 'cliff') return null;
    const hash = hashTile(col, row);
    if (hash % 7 !== 0) return null;
    const frames = kind === 'rock' ? ROCK_FRAMES : hash % 5 === 0 ? CRYSTAL_FRAMES : TREE_FRAMES;
    const frameName = frames[hash % frames.length]!;
    const texture = this.createFrameTexture('landscape', frameName);
    const frame = getSpriteFrame('landscape', frameName);
    if (!texture || !frame || !this.pixi) return null;
    const sprite = new this.pixi.Sprite(texture);
    const width = tileW * (kind === 'rock' ? 0.45 : 0.58);
    sprite.width = width;
    sprite.height = width * frame.h / frame.w;
    sprite.anchor.set(0.5, 1);
    sprite.alpha = 0.9;
    return sprite;
  }

  private createFrameTexture(sheet: RtsAtlasSheet, frameName: string): any | null {
    if (!this.pixi || !this.atlasTextures) return null;
    const cacheKey = `${sheet}:${frameName}`;
    const cached = this.frameTextureCache.get(cacheKey);
    if (cached) return cached;
    const baseTexture = this.atlasTextures[sheet];
    const frame = getSpriteFrame(sheet, frameName);
    if (!baseTexture || !frame) return null;
    const texture = new this.pixi.Texture({
      source: baseTexture.source,
      frame: new this.pixi.Rectangle(frame.x, frame.y, frame.w, frame.h),
    });
    this.frameTextureCache.set(cacheKey, texture);
    return texture;
  }

  private drawBuildingIcon(
    container: any,
    overlay: any,
    entity: RtsRendererSnapshot['entities'][number],
    tileW: number,
    tileH: number,
    tint: number,
  ): void {
    if (this.canUseSpriteMode()) {
      const spriteConfig = entity.kind === 'building-hq' && entity.factionId && entity.factionId !== 'p1'
        ? BUILDING_SPRITES['building-enemy-camp']
        : BUILDING_SPRITES[entity.kind];
      if (spriteConfig) {
        const texture = this.createFrameTexture(spriteConfig.sheet, spriteConfig.frame);
        const frame = getSpriteFrame(spriteConfig.sheet, spriteConfig.frame);
        if (texture && frame && this.pixi) {
          const sprite = new this.pixi.Sprite(texture);
          sprite.width = spriteConfig.width;
          sprite.height = spriteConfig.width * frame.h / frame.w;
          sprite.anchor.set(0.5, 1);
          sprite.y = tileH * 0.35;
          container.addChild(sprite);
          if (entity.hpRatio !== undefined && entity.hpRatio < 0.35) {
            overlay.circle(tileW * 0.2, -sprite.height * 0.45, 4);
            overlay.fill({ color: 0x3a3a3a, alpha: 0.45 });
          }
          if (entity.buildProgress !== undefined && entity.buildProgress < 1) {
            sprite.alpha = 0.58;
            overlay.circle(0, tileH * 0.45, Math.max(tileW, tileH) * 0.38);
            overlay.stroke({ color: 0xffd166, alpha: 0.85, width: 2 });
            const label = new this.pixi.Text({
              text: `${Math.round(entity.buildProgress * 100)}%`,
              style: {
                fill: 0xfff4c2,
                fontFamily: 'ui-monospace, monospace',
                fontSize: 10,
              },
            });
            label.anchor.set(0.5, 0.5);
            label.x = 0;
            label.y = tileH * 0.35;
            container.addChild(label);
          }
          return;
        }
      }
    }
    // entity.width/height are passed in pixel units that already encode the
    // building footprint (`footprint.cols * 32`). Convert back to tiles so we
    // size to the actual map's tile dimensions.
    const cols = Math.max(1, Math.round(entity.width / 32));
    const rows = Math.max(1, Math.round(entity.height / 32));
    const w = cols * tileW * 0.85;
    const h = rows * tileH * 0.7;
    const x = -w / 2;
    const y = -h / 2;
    overlay.rect(x, y, w, h);
    overlay.fill({ color: tint });
    overlay.stroke({ color: darken(tint, 0.45), width: 1 });
    // Roof: dark triangle on top.
    overlay.poly([
      x, y,
      x + w, y,
      x + w / 2, y - h * 0.45,
    ]);
    overlay.fill({ color: darken(tint, 0.45) });
    // Door/window hint.
    overlay.rect(x + w * 0.4, y + h * 0.55, w * 0.2, h * 0.4);
    overlay.fill({ color: darken(tint, 0.55) });
    if (entity.buildProgress !== undefined && entity.buildProgress < 1) {
      overlay.circle(0, h * 0.45, Math.max(tileW, tileH) * 0.38);
      overlay.stroke({ color: 0xffd166, alpha: 0.85, width: 2 });
    }
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

function drawIsoDiamond(graphics: any, centerX: number, centerY: number, width: number, height: number): void {
  graphics.poly([
    centerX, centerY - height / 2,
    centerX + width / 2, centerY,
    centerX, centerY + height / 2,
    centerX - width / 2, centerY,
  ]);
}

// Kenney landscape dimensions used by sprite terrain:
// flat grass/dirt and alt-1 raised tiles are 132x99; alt-2 plateau is 132x115.
export function pickTileFrame(terrain: TerrainKind, altitude: number): string {
  if (altitude >= 2) return 'landscape_22.png';
  if (altitude >= 1) return 'landscape_25.png';
  if (terrain === 'dirt' || terrain === 'rock' || terrain === 'cliff') return 'landscape_30.png';
  return 'landscape_13.png';
}

function hashTile(col: number, row: number): number {
  let h = Math.imul(col + 0x9e3779b9, 0x85ebca6b) ^ Math.imul(row + 0xc2b2ae35, 0x27d4eb2f);
  h ^= h >>> 16;
  return h >>> 0;
}

function orderColor(kind: string): number {
  switch (kind) {
    case 'attack': return 0xff4444;
    case 'attack-move': return 0xff9f1c;
    case 'patrol': return 0x33d7ff;
    case 'repair': return 0x9cff57;
    case 'build-place': return 0xffd166;
    case 'move':
    default:
      return 0x62ff7a;
  }
}
