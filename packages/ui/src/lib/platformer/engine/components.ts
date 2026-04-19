import type { AABB } from './aabb.js';
import type { EntityKind, PowerUpKind } from '../types.js';

export const COMPONENT_KINDS = {
  position: 'position',
  velocity: 'velocity',
  body: 'body',
  playerControl: 'playerControl',
  playerState: 'playerState',
  enemyAi: 'enemyAi',
  item: 'item',
  hazard: 'hazard',
  camera: 'camera',
  animation: 'animation',
  audio: 'audio',
  renderable: 'renderable',
  spawnSource: 'spawnSource',
  projectile: 'projectile',
  fireBar: 'fireBar',
  bulletShooter: 'bulletShooter',
} as const;

export type ComponentName = (typeof COMPONENT_KINDS)[keyof typeof COMPONENT_KINDS];

export interface PositionComponent { x: number; y: number; }
export interface VelocityComponent { vx: number; vy: number; }
export interface BodyComponent {
  aabb: AABB;
  grounded: boolean;
  ceilinged: boolean;
  lastBottom: number;
  /** Tag passed to collision handlers; entities can ignore one another by tag. */
  tag?: 'player' | 'enemy' | 'item' | 'projectile' | 'platform';
}

export interface PlayerControlComponent {
  wantsJump: boolean;
  jumpHeld: boolean;
  wantsRun: boolean;
  coyoteMs: number;
  bufferMs: number;
  ducking: boolean;
  attackQueued: boolean;
}

export interface PlayerStateComponent {
  power: PowerUpKind;
  iframesMs: number;
  starMs: number;
  faceDir: -1 | 1;
}

export interface PatrolConfig {
  speed: number;
  edgeAware: boolean;
  initialDir: -1 | 1;
}

export interface EnemyAiComponent {
  kind: EntityKind;
  patrol: PatrolConfig;
  dir: -1 | 1;
  deathState: 'alive' | 'stomped' | 'kicked' | 'gone';
  kickedSpeed?: number;
}

export interface ItemComponent {
  kind: EntityKind;
  bobOffset?: number;
  spawnedFromTile?: { col: number; row: number };
}

export interface HazardComponent { lethal: boolean; }

export interface CameraComponent {
  x: number;
  deadzoneHalfWidth: number;
  locked: boolean;
  minX: number;
}

export interface AnimationComponent {
  sheetId: string;
  clip: string;
  frame: number;
  t: number;
}

export interface AudioComponent {
  onSpawn?: string;
  onDeath?: string;
}

/**
 * Renderable hint for the engine's render layer. The engine is responsible for
 * mapping kind+frame to a Pixi sprite using the active asset bundle.
 */
export interface RenderableComponent {
  kind: EntityKind | 'fireball' | 'bullet';
  width: number;
  height: number;
  /** Rendering tint in 0xRRGGBB; placeholder bundle uses tint instead of art. */
  tint: number;
  shape: 'rect' | 'roundRect' | 'circle' | 'triangle';
}

export interface FireBarComponent {
  anchorCol: number;
  anchorRow: number;
  segments: number;
  radiusPerSegment: number;
  angularSpeed: number;
  angle: number;
}

export interface BulletShooterComponent {
  cadenceMs: number;
  elapsedMs: number;
  bulletSpeed: number;
  facing: -1 | 1;
}

export interface ProjectileComponent {
  kind: 'fireball' | 'bullet';
  source: 'player' | 'enemy';
  bouncesLeft: number;
}
