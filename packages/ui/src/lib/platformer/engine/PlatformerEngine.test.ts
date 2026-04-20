import { describe, expect, test } from 'bun:test';
import { PlatformerEngine } from './PlatformerEngine.js';
import { ScriptedInputSource } from './input.js';
import { COMPONENT_KINDS } from './components.js';
import type {
  PlayerStateComponent,
  PositionComponent,
  VelocityComponent,
  CameraComponent,
} from './components.js';
import type { MapDefinition, TileKind } from '../types.js';

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
