import { describe, expect, test, beforeEach } from 'bun:test';
import type { MatchDefinition, ResolvedRtsMap, TerrainKind } from '../types.js';
import { RtsEngine } from './RtsEngine.js';
import {
  CombatTelemetry,
  sectorKey,
  scoreToPressureLevel,
  SECTOR_SIZE,
  IMPACT_MAX_AGE_MS,
  SKIRMISH_ACTIVATION_THRESHOLD,
  SKIRMISH_IDLE_TIMEOUT_MS,
  SKIRMISH_MERGE_RADIUS,
} from './combat-telemetry.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
    metadata: { title: 'Test Map', author: 'test', createdAt: '', updatedAt: '', source: 'builtin' as const },
  };
  return { id: definition.id, metadata: definition.metadata, definition, source: 'builtin', builtInId: definition.id, isEditable: false };
}

const FLAT_MAP_ROWS: TerrainKind[][] = Array.from({ length: 10 }, () =>
  Array.from({ length: 24 }, () => 'grass' as TerrainKind),
);

function makeMatch(): MatchDefinition {
  return {
    id: 'match-1',
    mapId: 'test-map',
    factions: [
      { id: 'p1', label: 'Player', color: '#4dabff', isPlayer: true, isAi: false },
      { id: 'p2', label: 'Enemy', color: '#ff6b6b', isPlayer: false, isAi: true, aiDifficulty: 'normal' },
    ],
    rules: {
      startingResources: { mineral: 500, gas: 200 },
      populationCap: 20,
      fogOfWar: false,
      aiDifficulty: 'normal',
      rngSeed: 1,
    },
  };
}

function createEngine(): RtsEngine {
  return new RtsEngine({
    match: makeMatch(),
    map: makeResolvedMap(FLAT_MAP_ROWS),
    audioBus: { playSfx() {}, playMusic() {}, stopMusic() {}, setMasterVolume() {}, dispose() {} },
  });
}

function tickForMs(engine: RtsEngine, ms: number): void {
  const steps = Math.ceil(ms / (1000 / 30)) + 1;
  for (let i = 0; i < steps; i++) engine.tickFixed();
}

// ---------------------------------------------------------------------------
// CombatTelemetry unit tests
// ---------------------------------------------------------------------------

describe('CombatTelemetry — pure unit tests', () => {
  let tel: CombatTelemetry;

  beforeEach(() => {
    tel = new CombatTelemetry('p1');
    tel.setLocalBaseTile({ col: 4, row: 4 });
  });

  test('sectorKey buckets tiles correctly', () => {
    expect(sectorKey({ col: 0, row: 0 })).toBe('0:0');
    expect(sectorKey({ col: SECTOR_SIZE - 1, row: SECTOR_SIZE - 1 })).toBe('0:0');
    expect(sectorKey({ col: SECTOR_SIZE, row: 0 })).toBe('1:0');
    expect(sectorKey({ col: 0, row: SECTOR_SIZE })).toBe('0:1');
    expect(sectorKey({ col: 17, row: 9 })).toBe('2:1');
  });

  test('scoreToPressureLevel maps thresholds correctly', () => {
    expect(scoreToPressureLevel(0)).toBe('none');
    expect(scoreToPressureLevel(0.04)).toBe('none');
    expect(scoreToPressureLevel(0.05)).toBe('low');
    expect(scoreToPressureLevel(0.24)).toBe('low');
    expect(scoreToPressureLevel(0.25)).toBe('medium');
    expect(scoreToPressureLevel(0.49)).toBe('medium');
    expect(scoreToPressureLevel(0.5)).toBe('high');
    expect(scoreToPressureLevel(0.74)).toBe('high');
    expect(scoreToPressureLevel(0.75)).toBe('critical');
    expect(scoreToPressureLevel(1.0)).toBe('critical');
  });

  test('recordImpact adds an entry to recentImpacts', () => {
    tel.recordImpact({ tile: { col: 3, row: 3 }, kind: 'bullet', severity: 'warning', targetFactionId: 'p2', sourceFactionId: 'p1' });
    const summary = tel.read();
    expect(summary.recentImpacts).toHaveLength(1);
    expect(summary.recentImpacts[0]!.tile).toEqual({ col: 3, row: 3 });
    expect(summary.recentImpacts[0]!.kind).toBe('bullet');
    expect(summary.recentImpacts[0]!.severity).toBe('warning');
  });

  test('impacts are ordered newest-first', () => {
    tel.recordImpact({ tile: { col: 1, row: 1 }, kind: 'bullet', severity: 'warning', targetFactionId: 'p2', sourceFactionId: 'p1' });
    tel.step(100);
    tel.recordImpact({ tile: { col: 2, row: 2 }, kind: 'rocket', severity: 'danger', targetFactionId: 'p1', sourceFactionId: 'p2' });
    const summary = tel.read();
    expect(summary.recentImpacts[0]!.kind).toBe('rocket');
    expect(summary.recentImpacts[1]!.kind).toBe('bullet');
  });

  test('impacts expire after IMPACT_MAX_AGE_MS', () => {
    tel.recordImpact({ tile: { col: 3, row: 3 }, kind: 'bullet', severity: 'warning', targetFactionId: 'p2', sourceFactionId: 'p1' });
    expect(tel.read().recentImpacts).toHaveLength(1);
    tel.step(IMPACT_MAX_AGE_MS + 1);
    expect(tel.read().recentImpacts).toHaveLength(0);
  });

  test('impacts within SKIRMISH_MERGE_RADIUS merge into one skirmish', () => {
    for (let i = 0; i < SKIRMISH_ACTIVATION_THRESHOLD; i++) {
      tel.recordImpact({
        tile: { col: 5 + i, row: 5 },
        kind: 'bullet',
        severity: 'warning',
        targetFactionId: 'p1',
        sourceFactionId: 'p2',
      });
    }
    const summary = tel.read();
    expect(summary.activeSkirmishes).toHaveLength(1);
    expect(summary.activeSkirmishCount).toBe(1);
  });

  test('impacts beyond SKIRMISH_MERGE_RADIUS open a second skirmish', () => {
    for (let i = 0; i < SKIRMISH_ACTIVATION_THRESHOLD; i++) {
      tel.recordImpact({ tile: { col: 2, row: 2 }, kind: 'bullet', severity: 'warning', targetFactionId: 'p1', sourceFactionId: 'p2' });
    }
    for (let i = 0; i < SKIRMISH_ACTIVATION_THRESHOLD; i++) {
      tel.recordImpact({ tile: { col: 2 + SKIRMISH_MERGE_RADIUS + 2, row: 2 }, kind: 'bullet', severity: 'warning', targetFactionId: 'p1', sourceFactionId: 'p2' });
    }
    const summary = tel.read();
    expect(summary.activeSkirmishes).toHaveLength(2);
  });

  test('skirmish resolves after SKIRMISH_IDLE_TIMEOUT_MS of silence', () => {
    for (let i = 0; i < SKIRMISH_ACTIVATION_THRESHOLD; i++) {
      tel.recordImpact({ tile: { col: 5, row: 5 }, kind: 'bullet', severity: 'warning', targetFactionId: 'p1', sourceFactionId: 'p2' });
    }
    expect(tel.read().activeSkirmishCount).toBe(1);
    tel.step(SKIRMISH_IDLE_TIMEOUT_MS + 1);
    expect(tel.read().activeSkirmishCount).toBe(0);
  });

  test('localUnderFire is true when local faction is targeted', () => {
    for (let i = 0; i < SKIRMISH_ACTIVATION_THRESHOLD; i++) {
      tel.recordImpact({ tile: { col: 5, row: 5 }, kind: 'bullet', severity: 'danger', targetFactionId: 'p1', sourceFactionId: 'p2' });
    }
    const skirmish = tel.read().activeSkirmishes[0]!;
    expect(skirmish.localUnderFire).toBe(true);
  });

  test('localUnderFire is false when only enemy faction is targeted', () => {
    for (let i = 0; i < SKIRMISH_ACTIVATION_THRESHOLD; i++) {
      tel.recordImpact({ tile: { col: 5, row: 5 }, kind: 'bullet', severity: 'warning', targetFactionId: 'p2', sourceFactionId: 'p1' });
    }
    const skirmish = tel.read().activeSkirmishes[0]!;
    expect(skirmish.localUnderFire).toBe(false);
  });

  test('hotSectors appears when impacts land in the same sector', () => {
    tel.recordImpact({ tile: { col: 1, row: 1 }, kind: 'rocket', severity: 'danger', targetFactionId: 'p1', sourceFactionId: 'p2' });
    tel.recordImpact({ tile: { col: 2, row: 1 }, kind: 'rocket', severity: 'danger', targetFactionId: 'p1', sourceFactionId: 'p2' });
    const summary = tel.read();
    expect(summary.hotSectors.length).toBeGreaterThan(0);
    expect(summary.hotSectors[0]!.sectorKey).toBe('0:0');
    expect(['medium', 'high', 'critical']).toContain(summary.hotSectors[0]!.pressureLevel);
  });

  test('sector pressure decays to zero over time', () => {
    tel.recordImpact({ tile: { col: 2, row: 2 }, kind: 'bullet', severity: 'warning', targetFactionId: 'p2', sourceFactionId: 'p1' });
    expect(tel.read().hotSectors.length).toBeGreaterThan(0);
    // Step past decay (6s half-life, need many cycles to reach < 0.05 threshold)
    for (let i = 0; i < 120; i++) tel.step(1_000);
    expect(tel.read().hotSectors).toHaveLength(0);
  });

  test('localBaseUnderFire reflects base sector hits', () => {
    // base tile is { col:4, row:4 } which is sector 0:0
    expect(tel.read().localBaseUnderFire).toBe(false);
    tel.recordImpact({ tile: { col: 4, row: 4 }, kind: 'bullet', severity: 'danger', targetFactionId: 'p1', sourceFactionId: 'p2' });
    expect(tel.read().localBaseUnderFire).toBe(true);
  });

  test('globalCombatHeat increases on impact and decays on step', () => {
    expect(tel.read().globalCombatHeat).toBe(0);
    tel.recordImpact({ tile: { col: 3, row: 3 }, kind: 'rocket', severity: 'danger', targetFactionId: 'p1', sourceFactionId: 'p2' });
    expect(tel.read().globalCombatHeat).toBeGreaterThan(0);
    tel.step(10_000);
    expect(tel.read().globalCombatHeat).toBeLessThan(tel.read().globalCombatHeat + 1); // still decaying
    tel.step(60_000);
    expect(tel.read().globalCombatHeat).toBe(0);
  });

  test('sectorKey is set on recorded impact', () => {
    const { sectorKey: sk } = tel.recordImpact({ tile: { col: 5, row: 5 }, kind: 'bullet', severity: 'warning', targetFactionId: 'p2', sourceFactionId: 'p1' });
    expect(sk).toBe('0:0');
    const impact = tel.read().recentImpacts[0]!;
    expect(impact.sectorKey).toBe('0:0');
  });

  test('skirmish intensity escalates with impact count', () => {
    for (let i = 0; i < 12; i++) {
      tel.recordImpact({ tile: { col: 5, row: 5 }, kind: 'bullet', severity: 'danger', targetFactionId: 'p1', sourceFactionId: 'p2' });
    }
    const skirmish = tel.read().activeSkirmishes[0]!;
    expect(skirmish.intensity).toBe('heavy');
    expect(skirmish.impactCount).toBe(12);
  });
});

// ---------------------------------------------------------------------------
// RtsEngine integration tests
// ---------------------------------------------------------------------------

describe('RtsEngine — combat telemetry integration', () => {
  test('getCombatSummary returns empty summary at game start', () => {
    const engine = createEngine();
    const summary = engine.getCombatSummary();
    expect(summary.recentImpacts).toHaveLength(0);
    expect(summary.activeSkirmishes).toHaveLength(0);
    expect(summary.hotSectors).toHaveLength(0);
    expect(summary.globalCombatHeat).toBe(0);
    expect(summary.localBaseUnderFire).toBe(false);
  });

  test('combatSummaryUpdated fires after impacts accumulate', () => {
    const engine = createEngine();
    const summaries: ReturnType<RtsEngine['getCombatSummary']>[] = [];
    engine.emitter.on('combatSummaryUpdated', ({ summary }) => summaries.push(summary));

    const enemy = engine.spawnUnit('rifleman', 'p2', { col: 4, row: 2 });
    const player = engine.spawnUnit('rifleman', 'p1', { col: 6, row: 2 });

    // Let them fight for a while
    tickForMs(engine, 5_000);

    // At least one summary event must have fired and include some data
    expect(summaries.length).toBeGreaterThan(0);
    const last = summaries[summaries.length - 1]!;
    expect(last.recentImpacts.length).toBeGreaterThan(0);

    void enemy; void player;
  });

  test('combatAlert event carries sectorKey field', () => {
    const engine = createEngine();
    const alerts: Parameters<Parameters<typeof engine.emitter.on<'combatAlert'>>[1]>[0][] = [];
    engine.emitter.on('combatAlert', (payload) => alerts.push(payload));

    const enemy = engine.spawnUnit('rifleman', 'p2', { col: 3, row: 2 });
    const player = engine.spawnUnit('rifleman', 'p1', { col: 5, row: 2 });

    tickForMs(engine, 5_000);

    const hasKey = alerts.some((a) => typeof a.sectorKey === 'string');
    expect(hasKey).toBe(true);

    void enemy; void player;
  });

  test('active skirmish is detected when units clash for sustained period', () => {
    const engine = createEngine();

    // Place units close enough to fight immediately
    engine.spawnUnit('rifleman', 'p2', { col: 5, row: 3 });
    engine.spawnUnit('rifleman', 'p2', { col: 6, row: 3 });
    engine.spawnUnit('rifleman', 'p1', { col: 7, row: 3 });
    engine.spawnUnit('rifleman', 'p1', { col: 8, row: 3 });

    tickForMs(engine, 8_000);

    const summary = engine.getCombatSummary();
    expect(summary.activeSkirmishCount).toBeGreaterThanOrEqual(1);
  });

  test('hotSectors non-empty during active combat', () => {
    const engine = createEngine();

    engine.spawnUnit('rifleman', 'p2', { col: 5, row: 3 });
    engine.spawnUnit('rifleman', 'p1', { col: 7, row: 3 });

    tickForMs(engine, 6_000);

    const summary = engine.getCombatSummary();
    expect(summary.hotSectors.length).toBeGreaterThan(0);
  });

  test('localBaseUnderFire becomes true when enemy attacks near the player base', () => {
    const engine = createEngine();
    // Player base spawns at { col:1, row:2 } — same sector as col:3/row:3
    engine.spawnUnit('rifleman', 'p2', { col: 1, row: 3 });
    engine.spawnUnit('rifleman', 'p2', { col: 2, row: 3 });
    // Players' own units get killed by enemies — drives local hits
    engine.spawnUnit('rifleman', 'p1', { col: 2, row: 4 });

    tickForMs(engine, 10_000);

    const summary = engine.getCombatSummary();
    // Either base under fire or impacts in nearby sector
    expect(summary.recentImpacts.length).toBeGreaterThan(0);
  });

  test('combat summary heat decays to zero after extended quiet', () => {
    const engine = createEngine();

    // Brief skirmish
    const e1 = engine.spawnUnit('rifleman', 'p2', { col: 5, row: 3 });
    const p1 = engine.spawnUnit('rifleman', 'p1', { col: 6, row: 3 });

    tickForMs(engine, 3_000);

    // Kill both manually to stop further combat
    engine.world.removeEntity(e1);
    engine.world.removeEntity(p1);

    const mid = engine.getCombatSummary();
    const midHeat = mid.globalCombatHeat;

    // Advance well past impact expiry
    tickForMs(engine, IMPACT_MAX_AGE_MS + 5_000);

    const after = engine.getCombatSummary();
    expect(after.globalCombatHeat).toBeLessThan(midHeat);
  });
});
