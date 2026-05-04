import { describe, expect, test } from 'bun:test';
import type { MatchDefinition, ResolvedRtsMap, TerrainKind } from '../types.js';
import { AiController } from './ai.js';
import { RtsEngine } from './RtsEngine.js';

function makeResolvedMap(rows: TerrainKind[][]): ResolvedRtsMap {
  const definition = {
    id: 'test-map',
    version: 1,
    size: { cols: rows[0]!.length, rows: rows.length },
    tileSize: { width: 64, height: 32 },
    maxAltitude: 0,
    terrain: rows,
    altitude: { levels: rows.map((row) => row.map(() => 0)) },
    resources: [],
    spawns: [
      { factionId: 'p1', tile: { col: 1, row: 2 } },
      { factionId: 'p2', tile: { col: rows[0]!.length - 3, row: 2 } },
    ],
    metadata: {
      title: 'Test Map',
      author: 'test',
      createdAt: '',
      updatedAt: '',
      source: 'builtin',
    },
  };

  return {
    id: definition.id,
    metadata: definition.metadata,
    definition,
    source: 'builtin',
    builtInId: definition.id,
    isEditable: false,
  };
}

function makeMatch(mapId: string): MatchDefinition {
  return {
    id: 'match-1',
    mapId,
    factions: [
      { id: 'p1', label: 'Player', color: '#4dabff', isPlayer: true, isAi: false },
      { id: 'p2', label: 'Enemy', color: '#ff6b6b', isPlayer: false, isAi: true, aiDifficulty: 'normal' },
    ],
    rules: {
      startingResources: { mineral: 500, gas: 200 },
      populationCap: 20,
      fogOfWar: true,
      aiDifficulty: 'normal',
      rngSeed: 1,
    },
  };
}

function createEngine(): RtsEngine {
  const map = makeResolvedMap([
    ['grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass'],
    ['grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass'],
    ['grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass'],
    ['grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass'],
    ['grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass'],
  ]);

  return new RtsEngine({
    match: makeMatch(map.id),
    map,
    audioBus: { playSfx() {}, playMusic() {}, stopMusic() {}, setMasterVolume() {}, dispose() {} },
  });
}

describe('AiController wave events', () => {
  test('emits squadLaunched with wave metadata when a ready attack force mobilizes', () => {
    const engine = createEngine();
    const ai = new AiController(engine, 'p2', 'normal', 7);
    const launched: Array<{ factionId: string; size: number; waveIndex: number }> = [];

    engine.spawnUnit('rifleman', 'p2', { col: 18, row: 2 });
    engine.spawnUnit('rifleman', 'p2', { col: 19, row: 2 });
    engine.emitter.on('squadLaunched', (payload) => launched.push(payload));

    (ai as unknown as { buildOrderIndex: number }).buildOrderIndex = 4;
    ai.tick(2_000);

    expect(launched).toEqual([
      {
        factionId: 'p2',
        size: 2,
        waveIndex: 1,
        launchedAtMs: 2_000,
        cadenceMs: 30_000,
        targetTile: { col: 2, row: 3 },
      },
    ]);
  });
});
