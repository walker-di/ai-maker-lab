import type { EnemyAiComponent, ItemComponent, RenderableComponent } from '../components.js';
import { COMPONENT_KINDS } from '../components.js';
import type { EngineWorld, Entity } from '../world.js';
import type { EntityKind, EntitySpawn, TileKind } from '../../types.js';
import type { TileGrid } from '../tile-grid.js';
import type { AssetBundle } from '../assets.js';

export interface SpawnContext {
  world: EngineWorld;
  bundle: AssetBundle;
  grid: TileGrid;
}

export function spawnPlayer(ctx: SpawnContext, col: number, row: number): Entity {
  const e = ctx.world.createEntity();
  const placeholder = ctx.bundle.entities.player;
  const tileSize = ctx.grid.tileSize;
  ctx.world.addComponent(e, COMPONENT_KINDS.position, {
    x: col * tileSize + (tileSize - placeholder.width) / 2,
    y: row * tileSize + tileSize - placeholder.height,
  });
  ctx.world.addComponent(e, COMPONENT_KINDS.velocity, { vx: 0, vy: 0 });
  ctx.world.addComponent(e, COMPONENT_KINDS.body, {
    aabb: {
      x: col * tileSize + (tileSize - placeholder.width) / 2,
      y: row * tileSize + tileSize - placeholder.height,
      width: placeholder.width,
      height: placeholder.height,
    },
    grounded: false,
    ceilinged: false,
    lastBottom: row * tileSize + tileSize,
    tag: 'player',
  });
  ctx.world.addComponent(e, COMPONENT_KINDS.playerControl, {
    wantsJump: false,
    jumpHeld: false,
    wantsRun: false,
    coyoteMs: 0,
    bufferMs: 0,
    ducking: false,
    attackQueued: false,
  });
  ctx.world.addComponent(e, COMPONENT_KINDS.playerState, {
    power: 'none',
    iframesMs: 0,
    starMs: 0,
    faceDir: 1,
  });
  ctx.world.addComponent(e, COMPONENT_KINDS.renderable, {
    kind: 'player',
    width: placeholder.width,
    height: placeholder.height,
    tint: placeholder.tint,
    shape: placeholder.shape,
  } satisfies RenderableComponent);
  return e;
}

export function spawnFromDefinition(ctx: SpawnContext, spawn: EntitySpawn): Entity | null {
  if (spawn.kind === 'player') return null;
  const placeholder = ctx.bundle.entities[spawn.kind];
  if (!placeholder) return null;
  const tileSize = ctx.grid.tileSize;
  const x = spawn.tile.col * tileSize + (tileSize - placeholder.width) / 2;
  const y = spawn.tile.row * tileSize + tileSize - placeholder.height;
  const e = ctx.world.createEntity();
  ctx.world.addComponent(e, COMPONENT_KINDS.position, { x, y });
  ctx.world.addComponent(e, COMPONENT_KINDS.velocity, { vx: 0, vy: 0 });
  ctx.world.addComponent(e, COMPONENT_KINDS.body, {
    aabb: { x, y, width: placeholder.width, height: placeholder.height },
    grounded: false,
    ceilinged: false,
    lastBottom: y + placeholder.height,
    tag: isItem(spawn.kind) ? 'item' : 'enemy',
  });
  ctx.world.addComponent(e, COMPONENT_KINDS.renderable, {
    kind: spawn.kind,
    width: placeholder.width,
    height: placeholder.height,
    tint: placeholder.tint,
    shape: placeholder.shape,
  } satisfies RenderableComponent);

  if (isEnemyKind(spawn.kind)) {
    const initialDir = (spawn.params?.dir as number) === 1 ? 1 : -1;
    const speed = (spawn.params?.speed as number) ?? 50;
    const edgeAware = spawn.params?.edgeAware !== false;
    ctx.world.addComponent(e, COMPONENT_KINDS.enemyAi, {
      kind: spawn.kind,
      patrol: { speed, edgeAware, initialDir },
      dir: initialDir,
      deathState: 'alive',
    } satisfies EnemyAiComponent);
  }

  if (isItem(spawn.kind)) {
    ctx.world.addComponent(e, COMPONENT_KINDS.item, {
      kind: spawn.kind,
      spawnedFromTile: { col: spawn.tile.col, row: spawn.tile.row },
    } satisfies ItemComponent);
  }

  if (spawn.kind === 'fireBar') {
    ctx.world.addComponent(e, COMPONENT_KINDS.fireBar, {
      anchorCol: spawn.tile.col,
      anchorRow: spawn.tile.row,
      segments: (spawn.params?.segments as number) ?? 4,
      radiusPerSegment: (spawn.params?.radius as number) ?? 12,
      angularSpeed: (spawn.params?.speed as number) ?? 1.5,
      angle: 0,
    });
  }

  if (spawn.kind === 'bulletShooter') {
    ctx.world.addComponent(e, COMPONENT_KINDS.bulletShooter, {
      cadenceMs: (spawn.params?.cadenceMs as number) ?? 2200,
      elapsedMs: 0,
      bulletSpeed: (spawn.params?.bulletSpeed as number) ?? 180,
      facing: ((spawn.params?.facing as number) === 1 ? 1 : -1),
    });
  }

  return e;
}

export function isEnemyKind(kind: EntityKind): boolean {
  return (
    kind === 'walkerEnemy' ||
    kind === 'shellEnemy' ||
    kind === 'flyingEnemy' ||
    kind === 'fireBar' ||
    kind === 'bulletShooter'
  );
}

export function isItem(kind: EntityKind): boolean {
  return (
    kind === 'coin' ||
    kind === 'mushroom' ||
    kind === 'flower' ||
    kind === 'star' ||
    kind === 'oneUp' ||
    kind === 'spring'
  );
}

const QUESTION_LOOT_KINDS = new Set<EntityKind>(['coin', 'mushroom', 'flower', 'star', 'oneUp']);

/**
 * Loot kind held inside a `question` tile until the player bumps it from below.
 * Supports `params.contains` (per experiment spec) or an item `kind` on the same cell.
 */
export function extractQuestionLootKind(spawn: EntitySpawn): EntityKind | null {
  const c = spawn.params?.contains;
  if (typeof c === 'string' && QUESTION_LOOT_KINDS.has(c as EntityKind)) {
    return c as EntityKind;
  }
  if (QUESTION_LOOT_KINDS.has(spawn.kind)) return spawn.kind;
  return null;
}

/** Whether this spawn is authored on a `question` tile and should not spawn until revealed. */
export function shouldDeferQuestionLoot(spawn: EntitySpawn, tileAtSpawn: TileKind): boolean {
  return tileAtSpawn === 'question' && extractQuestionLootKind(spawn) != null;
}

/**
 * Spawns a pickup item emerging from a bumped question block (one row above the block).
 */
export function spawnRevealedItemPickup(ctx: SpawnContext, kind: EntityKind, col: number, questionRow: number): Entity | null {
  if (!isItem(kind) || kind === 'spring') return null;
  const placeholder = ctx.bundle.entities[kind];
  if (!placeholder) return null;
  const tileSize = ctx.grid.tileSize;
  const emergeRow = Math.max(0, questionRow - 1);
  const x = col * tileSize + (tileSize - placeholder.width) / 2;
  const y = emergeRow * tileSize + tileSize - placeholder.height;
  const e = ctx.world.createEntity();
  ctx.world.addComponent(e, COMPONENT_KINDS.position, { x, y });
  ctx.world.addComponent(e, COMPONENT_KINDS.velocity, { vx: 40, vy: -140 });
  ctx.world.addComponent(e, COMPONENT_KINDS.body, {
    aabb: { x, y, width: placeholder.width, height: placeholder.height },
    grounded: false,
    ceilinged: false,
    lastBottom: y + placeholder.height,
    tag: 'item',
  });
  ctx.world.addComponent(e, COMPONENT_KINDS.renderable, {
    kind,
    width: placeholder.width,
    height: placeholder.height,
    tint: placeholder.tint,
    shape: placeholder.shape,
  } satisfies RenderableComponent);
  ctx.world.addComponent(e, COMPONENT_KINDS.item, {
    kind,
    spawnedFromTile: { col, row: questionRow },
  } satisfies ItemComponent);
  return e;
}
