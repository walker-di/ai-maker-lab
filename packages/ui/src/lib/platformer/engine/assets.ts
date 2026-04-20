import type { EntityKind, TileKind } from '../types.js';

/**
 * Asset bundle definition. The placeholder bundle uses simple shapes and tints
 * so the engine can render without art. Real bundles would carry sprite sheet
 * URLs and the engine would resolve them through `Pixi.Assets`.
 */
export interface AssetBundle {
  id: string;
  tiles: Readonly<Record<TileKind, TilePlaceholder>>;
  entities: Readonly<Record<EntityKind | 'fireball' | 'bullet', EntityPlaceholder>>;
  audio: AssetAudio;
  backgrounds: Readonly<Record<string, BackgroundPlaceholder>>;
}

export interface TilePlaceholder {
  /** 0xRRGGBB tint. */
  tint: number;
  shape: 'rect' | 'roundRect' | 'circle' | 'triangle';
}

export interface EntityPlaceholder {
  tint: number;
  width: number;
  height: number;
  shape: 'rect' | 'roundRect' | 'circle' | 'triangle';
}

export interface BackgroundPlaceholder {
  /** Top-to-bottom gradient stops in CSS color form. */
  gradient: string[];
}

export interface AssetAudioTrack {
  id: string;
  url?: string;
  loop?: boolean;
}

export interface AssetAudio {
  music: Readonly<Record<string, AssetAudioTrack>>;
  sfx: Readonly<Record<string, AssetAudioTrack>>;
}

export const DEFAULT_BUNDLE: AssetBundle = {
  id: 'default',
  tiles: {
    empty:     { tint: 0x000000, shape: 'rect' },
    ground:    { tint: 0x8b5a2b, shape: 'rect' },
    brick:     { tint: 0xc97a4a, shape: 'rect' },
    question:  { tint: 0xf5b133, shape: 'rect' },
    hardBlock: { tint: 0x6e6e6e, shape: 'rect' },
    pipeTop:   { tint: 0x2a9d3a, shape: 'roundRect' },
    pipeBody:  { tint: 0x2a9d3a, shape: 'rect' },
    flagPole:  { tint: 0xefefef, shape: 'rect' },
    flagBase:  { tint: 0x4a4a4a, shape: 'rect' },
    coinTile:  { tint: 0xf5d033, shape: 'circle' },
    hazard:    { tint: 0xc23030, shape: 'triangle' },
  },
  entities: {
    player:        { tint: 0x3273dc, width: 14, height: 16, shape: 'roundRect' },
    walkerEnemy:   { tint: 0xa44a3f, width: 14, height: 14, shape: 'roundRect' },
    shellEnemy:    { tint: 0x2dbe60, width: 14, height: 12, shape: 'roundRect' },
    flyingEnemy:   { tint: 0xc73fb7, width: 14, height: 14, shape: 'triangle' },
    fireBar:       { tint: 0xff7a00, width: 12, height: 12, shape: 'circle' },
    bulletShooter: { tint: 0x444444, width: 14, height: 16, shape: 'rect' },
    coin:          { tint: 0xf5d033, width: 10, height: 12, shape: 'circle' },
    mushroom:      { tint: 0xff5a5a, width: 14, height: 14, shape: 'roundRect' },
    flower:        { tint: 0xff9a3f, width: 14, height: 14, shape: 'circle' },
    star:          { tint: 0xfff066, width: 14, height: 14, shape: 'triangle' },
    oneUp:         { tint: 0x33d27e, width: 14, height: 14, shape: 'roundRect' },
    platformMoving:{ tint: 0xc8c8c8, width: 32, height: 8,  shape: 'rect' },
    spring:        { tint: 0x9e9e9e, width: 14, height: 8,  shape: 'rect' },
    fireball:      { tint: 0xff5a00, width: 8,  height: 8,  shape: 'circle' },
    bullet:        { tint: 0x222222, width: 10, height: 6,  shape: 'rect' },
  },
  audio: {
    music: {
      overworld: { id: 'overworld', loop: true },
      underground: { id: 'underground', loop: true },
    },
    sfx: {
      jump: { id: 'jump' },
      bump: { id: 'bump' },
      coin: { id: 'coin' },
      powerUp: { id: 'powerUp' },
      stomp: { id: 'stomp' },
      death: { id: 'death' },
      oneUp: { id: 'oneUp' },
      pause: { id: 'pause' },
      levelComplete: { id: 'levelComplete' },
      gameOver: { id: 'gameOver' },
      fireball: { id: 'fireball' },
      pipe: { id: 'pipe' },
    },
  },
  backgrounds: {
    sky:        { gradient: ['#79b6ff', '#cfe6ff'] },
    underground:{ gradient: ['#0a0a14', '#1c1c33'] },
    night:      { gradient: ['#1a1f3b', '#3b2c66'] },
  },
};

const BUNDLES: Map<string, AssetBundle> = new Map([['default', DEFAULT_BUNDLE]]);

export function getAssetBundle(id: string): AssetBundle {
  const bundle = BUNDLES.get(id);
  if (!bundle) throw new Error(`Unknown asset bundle: ${id}`);
  return bundle;
}

export function registerAssetBundle(bundle: AssetBundle): void {
  BUNDLES.set(bundle.id, bundle);
}
