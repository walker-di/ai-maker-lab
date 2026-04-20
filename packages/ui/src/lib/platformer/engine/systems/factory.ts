import type { EnemyAiComponent, ItemComponent, RenderableComponent } from '../components.js';
import { COMPONENT_KINDS } from '../components.js';
import type { EngineWorld, Entity } from '../world.js';
import type { EntityKind, EntitySpawn, MapDefinition } from '../../types.js';
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

/** Power-ups hidden inside a `question` tile are spawned when the block is hit, not at load time. */
export function isQuestionBlockReserveSpawn(map: MapDefinition, spawn: EntitySpawn): boolean {
  const { col, row } = spawn.tile;
  if (row < 0 || row >= map.size.rows || col < 0 || col >= map.size.cols) return false;
  if (map.tiles[row]![col] !== 'question') return false;
  return spawn.kind === 'mushroom' || spawn.kind === 'flower' || spawn.kind === 'star' || spawn.kind === 'oneUp';
}
