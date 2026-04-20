import { describe, expect, test } from 'bun:test';
import { PlatformerEngine } from './PlatformerEngine.js';
import { ScriptedInputSource } from './input.js';
import { COMPONENT_KINDS } from './components.js';
import type {
  BodyComponent,
  PlayerStateComponent,
  PositionComponent,
  VelocityComponent,
  CameraComponent,
} from './components.js';
import type { MapDefinition, TileKind } from '../types.js';
import type { TileGrid } from './tile-grid.js';
import type { ItemComponent } from './components.js';

function engineGrid(engine: PlatformerEngine): TileGrid {
  return (engine as unknown as { grid: TileGrid | null }).grid!;
}

type BumpableHarness = Pick<PlatformerEngine, never> & {
  handleBumpableHit(col: number, row: number, kind: TileKind): void;
};

function emptyTiles(cols: number, rows: number, fill: TileKind = 'empty'): TileKind[][] {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => fill),
  );
}

function makeFlatLevel(extra: Partial<MapDefinition> = {}): MapDefinition {
  const cols = extra.size?.cols ?? 24;
  const rows = extra.size?.rows ?? 12;
  const tiles = emptyTiles(cols, rows);
  for (let c = 0; c < cols; c++) tiles[rows - 1]![c] = 'ground';
  return {
    id: 'flat', version: 1,
    size: { cols, rows },
    tileSize: 16,
    scrollMode: 'horizontal',
    spawn: { col: 1, row: rows - 2 },
    goal: { col: cols - 2, row: rows - 2, kind: 'flag' },
    tiles,
    entities: [],
    background: 'sky',
    music: 'overworld',
    ...extra,
  } as MapDefinition;
}

function tickFor(engine: PlatformerEngine, steps: number) {
  for (let i = 0; i < steps; i++) engine.tickFixed();
}

describe('PlatformerEngine', () => {
  test('player falls under gravity until landing on ground', () => {
    const engine = new PlatformerEngine({ mode: 'play' });
    const input = new ScriptedInputSource();
    engine.setInput(input);
    engine.loadMap(makeFlatLevel());
    tickFor(engine, 90);
    const player = [...engine.world.query([COMPONENT_KINDS.playerState])][0]!;
    const pos = engine.world.getComponent<PositionComponent>(player, COMPONENT_KINDS.position)!;
    expect(pos.y).toBeGreaterThan(0);
  });

  test('jump impulse is applied on jump press while grounded', () => {
    const engine = new PlatformerEngine({ mode: 'play' });
    const input = new ScriptedInputSource();
    engine.setInput(input);
    engine.loadMap(makeFlatLevel());
    tickFor(engine, 60); // settle on the ground
    input.set({ jump: true });
    engine.tickFixed();
    const player = [...engine.world.query([COMPONENT_KINDS.playerState])][0]!;
    const vel = engine.world.getComponent<VelocityComponent>(player, COMPONENT_KINDS.velocity)!;
    expect(vel.vy).toBeLessThan(0);
  });

  test('coyote time still allows a jump shortly after walking off a ledge', () => {
    const engine = new PlatformerEngine({ mode: 'play', tunables: { coyoteMs: 200 } });
    const input = new ScriptedInputSource();
    engine.setInput(input);
    // Build a 2-tile ledge so the player walks off.
    const cols = 8, rows = 12;
    const tiles = emptyTiles(cols, rows);
    tiles[rows - 1]![0] = 'ground';
    tiles[rows - 1]![1] = 'ground';
    engine.loadMap({ ...makeFlatLevel(), size: { cols, rows }, tiles, spawn: { col: 1, row: rows - 2 } });
    tickFor(engine, 60); // grounded
    input.set({ right: true });
    tickFor(engine, 30); // walk off the ledge
    input.set({ right: false, jump: true });
    engine.tickFixed();
    const player = [...engine.world.query([COMPONENT_KINDS.playerState])][0]!;
    const vel = engine.world.getComponent<VelocityComponent>(player, COMPONENT_KINDS.velocity)!;
    expect(vel.vy).toBeLessThan(0);
  });

  test('mushroom power-up promotes the player to grow', () => {
    const engine = new PlatformerEngine({ mode: 'play' });
    const input = new ScriptedInputSource();
    engine.setInput(input);
    const map = makeFlatLevel();
    map.entities = [{ kind: 'mushroom', tile: { col: 2, row: map.size.rows - 2 } }];
    engine.loadMap(map);
    tickFor(engine, 60);
    input.set({ right: true });
    tickFor(engine, 240);
    const player = [...engine.world.query([COMPONENT_KINDS.playerState])][0]!;
    const state = engine.world.getComponent<PlayerStateComponent>(player, COMPONENT_KINDS.playerState)!;
    expect(state.power).toBe('grow');
  });

  test('coin pickup increments coins and emits coin event', () => {
    const engine = new PlatformerEngine({ mode: 'play' });
    const input = new ScriptedInputSource();
    engine.setInput(input);
    const map = makeFlatLevel();
    map.entities = [{ kind: 'coin', tile: { col: 2, row: map.size.rows - 2 } }];
    engine.loadMap(map);
    let coinTotal = -1;
    engine.on('coin', (p) => { coinTotal = p.total; });
    tickFor(engine, 30);
    input.set({ right: true });
    tickFor(engine, 240);
    expect(engine.getCoins()).toBe(1);
    expect(coinTotal).toBe(1);
  });

  test('reaching the goal cell emits goalReached and runFinished completed', () => {
    const engine = new PlatformerEngine({ mode: 'play' });
    const input = new ScriptedInputSource();
    engine.setInput(input);
    const map = makeFlatLevel({ size: { cols: 8, rows: 6 } });
    engine.loadMap(map);
    tickFor(engine, 30);
    input.set({ right: true, run: true });
    let outcome: string | null = null;
    engine.on('runFinished', (p) => { outcome = p.outcome; });
    for (let i = 0; i < 600 && outcome === null; i++) engine.tickFixed();
    expect(outcome === 'completed').toBe(true);
  });

  test('time reaching zero triggers lifeLost (timer drain)', () => {
    const engine = new PlatformerEngine({ mode: 'play', timeLimitMs: 45 });
    const input = new ScriptedInputSource();
    engine.setInput(input);
    engine.loadMap(makeFlatLevel());
    let lost = 0;
    let firstLives = -1;
    engine.on('lifeLost', (p) => {
      lost++;
      if (firstLives < 0) firstLives = p.lives;
    });
    for (let i = 0; i < 8; i++) engine.tickFixed();
    expect(lost).toBeGreaterThanOrEqual(1);
    expect(firstLives).toBe(2);
    expect(engine.getLives()).toBeLessThan(3);
  });

  test('small Mario bump does not break brick; super Mario breaks it', () => {
    const cols = 16;
    const rows = 12;
    const brickCol = 8;
    const brickRow = rows - 5;
    const tiles = emptyTiles(cols, rows);
    for (let c = 0; c < cols; c++) tiles[rows - 1]![c] = 'ground';
    tiles[brickRow]![brickCol] = 'brick';

    const base = {
      ...makeFlatLevel({ size: { cols, rows }, tiles, spawn: { col: 2, row: rows - 2 } }),
    } as MapDefinition;

    const small = new PlatformerEngine({ mode: 'play' });
    const inSmall = new ScriptedInputSource();
    small.setInput(inSmall);
    small.loadMap(base);
    const smallPlayer = [...small.world.query([COMPONENT_KINDS.playerState])][0]!;
    small.world.getComponent<PlayerStateComponent>(smallPlayer, COMPONENT_KINDS.playerState)!.power = 'none';
    (small as unknown as BumpableHarness).handleBumpableHit(brickCol, brickRow, 'brick');
    expect(engineGrid(small).tileAt(brickCol, brickRow)).toBe('brick');

    const big = new PlatformerEngine({ mode: 'play' });
    const inBig = new ScriptedInputSource();
    big.setInput(inBig);
    big.loadMap(base);
    const bigPlayer = [...big.world.query([COMPONENT_KINDS.playerState])][0]!;
    big.world.getComponent<PlayerStateComponent>(bigPlayer, COMPONENT_KINDS.playerState)!.power = 'grow';
    (big as unknown as BumpableHarness).handleBumpableHit(brickCol, brickRow, 'brick');
    expect(engineGrid(big).tileAt(brickCol, brickRow)).toBe('empty');
  });

  test('question block spawns reserved flower above; pickup grants fire', () => {
    const cols = 20;
    const rows = 12;
    const qCol = 10;
    const qRow = rows - 5;
    const tiles = emptyTiles(cols, rows);
    for (let c = 0; c < cols; c++) tiles[rows - 1]![c] = 'ground';
    tiles[qRow]![qCol] = 'question';

    const map = {
      id: 'qb-flower',
      version: 1,
      size: { cols, rows },
      tileSize: 16,
      scrollMode: 'horizontal' as const,
      spawn: { col: qCol, row: rows - 2 },
      goal: { col: cols - 2, row: rows - 2, kind: 'flag' as const },
      tiles,
      entities: [{ kind: 'flower' as const, tile: { col: qCol, row: qRow } }],
      background: 'sky',
      music: 'overworld',
    } satisfies MapDefinition;

    const engine = new PlatformerEngine({ mode: 'play' });
    const input = new ScriptedInputSource();
    engine.setInput(input);
    engine.loadMap(map);

    (engine as unknown as BumpableHarness).handleBumpableHit(qCol, qRow, 'question');
    expect(engineGrid(engine).tileAt(qCol, qRow)).toBe('hardBlock');

    const flowers = [...engine.world.query([COMPONENT_KINDS.item])].filter((e) => {
      const it = engine.world.getComponent<ItemComponent>(e, COMPONENT_KINDS.item);
      return it?.kind === 'flower';
    });
    expect(flowers.length).toBe(1);

    const flowerId = flowers[0]!;
    const fpos = engine.world.getComponent<PositionComponent>(flowerId, COMPONENT_KINDS.position)!;
    const player = [...engine.world.query([COMPONENT_KINDS.playerState])][0]!;
    const ppos = engine.world.getComponent<PositionComponent>(player, COMPONENT_KINDS.position)!;
    const body = engine.world.getComponent<BodyComponent>(player, COMPONENT_KINDS.body)!;
    ppos.x = fpos.x;
    ppos.y = fpos.y;
    body.aabb.x = fpos.x;
    body.aabb.y = fpos.y;
    tickFor(engine, 4);
    expect(engine.getPlayerPower()).toBe('fire');
  });

  test('camera never scrolls back as the player moves right', () => {
    const engine = new PlatformerEngine({ mode: 'play' });
    const input = new ScriptedInputSource();
    engine.setInput(input);
    engine.loadMap(makeFlatLevel({ size: { cols: 60, rows: 10 } }));
    tickFor(engine, 60);
    input.set({ right: true, run: true });
    tickFor(engine, 240);
    const cameras = [...engine.world.query([COMPONENT_KINDS.camera])];
    const cam = engine.world.getComponent<CameraComponent>(cameras[0]!, COMPONENT_KINDS.camera)!;
    const xAfterRight = cam.x;
    input.set({ right: false, left: true, run: true });
    tickFor(engine, 240);
    const cam2 = engine.world.getComponent<CameraComponent>(cameras[0]!, COMPONENT_KINDS.camera)!;
    expect(cam2.x).toBeGreaterThanOrEqual(xAfterRight);
  });
});
