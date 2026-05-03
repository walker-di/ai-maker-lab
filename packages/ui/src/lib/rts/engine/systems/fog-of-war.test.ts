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

describe('FogOfWarSystem', () => {
  test('visible cells demote to explored when vision moves away', () => {
    const grid = new TileGrid(makeMap([
      ['grass', 'grass', 'grass'],
      ['grass', 'grass', 'grass'],
      ['grass', 'grass', 'grass'],
    ]));
    const world = new EngineWorld();
    const unit = world.createEntity();
    world.addComponent<PositionComponent>(unit, C.position, { col: 1, row: 1, altitude: 0 });
    world.addComponent<FactionComponent>(unit, C.faction, { factionId: 'p1' });
    world.addComponent<VisionComponent>(unit, C.vision, { sight: 1 });
    const fog = new FogOfWarSystem(grid, ['p1']);
    const ctx = { bus: new SystemEventBus(), stepIndex: 0, totalStepsMs: 0 };
    fog.update(world, 1 / 30, ctx);
    expect(fog.snapshots.get('p1')!.cells[1 * 3 + 1]).toBe(2);
    world.removeEntity(unit);
    fog.update(world, 1 / 30, ctx);
    expect(fog.snapshots.get('p1')!.cells[1 * 3 + 1]).toBe(1);
  });
});
