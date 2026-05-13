import { describe, expect, test } from 'bun:test';
import type { MapDefinition, TerrainKind } from '../../types.js';
import { COMPONENT_KINDS as C } from '../components.js';
import type { FactionComponent, PositionComponent, VisionComponent } from '../components.js';
import { TileGrid } from '../tile-grid.js';
import { EngineWorld, SystemEventBus } from '../world.js';
import { FogOfWarSystem } from './fog-of-war.js';

function makeMap(rows: TerrainKind[][]): MapDefinition {
  return {
    id: 'fog-test',
    version: 1,
    size: { cols: rows[0]!.length, rows: rows.length },
    tileSize: { width: 64, height: 32 },
    maxAltitude: 1,
    terrain: rows,
    altitude: { levels: rows.map((row) => row.map(() => 0)) },
    resources: [],
    spawns: [],
    metadata: { title: 'Fog Test', author: 'test', createdAt: '', updatedAt: '', source: 'builtin' },
  };
}

function createFogHarness() {
  const grid = new TileGrid(makeMap([
    ['grass', 'grass', 'grass', 'grass', 'grass'],
    ['grass', 'grass', 'grass', 'grass', 'grass'],
    ['grass', 'grass', 'grass', 'grass', 'grass'],
    ['grass', 'grass', 'grass', 'grass', 'grass'],
    ['grass', 'grass', 'grass', 'grass', 'grass'],
  ]));
  const world = new EngineWorld();
  const ctx = { bus: new SystemEventBus(), stepIndex: 0, totalStepsMs: 0 };
  const fog = new FogOfWarSystem(grid, ['p1', 'p2']);
  return { world, ctx, fog };
}

describe('FogOfWarSystem', () => {
  test('starts with all cells unexplored', () => {
    const { fog } = createFogHarness();
    expect([...fog.snapshots.get('p1')!.cells]).toEqual(new Array(25).fill(0));
    expect([...fog.snapshots.get('p2')!.cells]).toEqual(new Array(25).fill(0));
  });

  test('visible cells demote to explored when vision moves away', () => {
    const { world, ctx, fog } = createFogHarness();
    const unit = world.createEntity();
    world.addComponent<PositionComponent>(unit, C.position, { col: 1, row: 1, altitude: 0 });
    world.addComponent<FactionComponent>(unit, C.faction, { factionId: 'p1' });
    world.addComponent<VisionComponent>(unit, C.vision, { sight: 1 });

    fog.update(world, 1 / 30, ctx);
    expect(fog.snapshots.get('p1')!.cells[1 * 5 + 1]).toBe(2);

    world.removeEntity(unit);
    fog.update(world, 1 / 30, ctx);
    expect(fog.snapshots.get('p1')!.cells[1 * 5 + 1]).toBe(1);
  });

  test('tracks fog independently per faction and keeps distant tiles unexplored', () => {
    const { world, ctx, fog } = createFogHarness();
    const p1Unit = world.createEntity();
    world.addComponent<PositionComponent>(p1Unit, C.position, { col: 1, row: 1, altitude: 0 });
    world.addComponent<FactionComponent>(p1Unit, C.faction, { factionId: 'p1' });
    world.addComponent<VisionComponent>(p1Unit, C.vision, { sight: 1 });

    const p2Unit = world.createEntity();
    world.addComponent<PositionComponent>(p2Unit, C.position, { col: 3, row: 3, altitude: 0 });
    world.addComponent<FactionComponent>(p2Unit, C.faction, { factionId: 'p2' });
    world.addComponent<VisionComponent>(p2Unit, C.vision, { sight: 1 });

    fog.update(world, 1 / 30, ctx);

    expect(fog.snapshots.get('p1')!.cells[1 * 5 + 1]).toBe(2);
    expect(fog.snapshots.get('p1')!.cells[3 * 5 + 3]).toBe(0);
    expect(fog.snapshots.get('p2')!.cells[3 * 5 + 3]).toBe(2);
    expect(fog.snapshots.get('p2')!.cells[0]).toBe(0);
  });
});
