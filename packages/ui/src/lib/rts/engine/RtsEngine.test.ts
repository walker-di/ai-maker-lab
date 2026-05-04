import { describe, expect, test } from 'bun:test';
import type { MatchDefinition, ResolvedRtsMap, ResourceNode, TerrainKind } from '../types.js';
import { BUILDING_STATS, TECH_STATS, UNIT_STATS } from '../types.js';
import { COMPONENT_KINDS as C } from './components.js';
import type {
  BuildingComponent,
  CombatComponent,
  FactionComponent,
  HealthComponent,
  MovementComponent,
  PositionComponent,
  WorkerComponent,
} from './components.js';
import { AiController } from './ai.js';
import { RtsEngine } from './RtsEngine.js';

function makeResolvedMap(rows: TerrainKind[][], resources: ResourceNode[] = []): ResolvedRtsMap {
  const definition = {
    id: 'test-map',
    version: 1,
    size: { cols: rows[0]!.length, rows: rows.length },
    tileSize: { width: 64, height: 32 },
    maxAltitude: 0,
    terrain: rows,
    altitude: { levels: rows.map((row) => row.map(() => 0)) },
    resources,
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

function makeMatch(mapId: string, startingResources = { mineral: 500, gas: 200 }): MatchDefinition {
  return {
    id: 'match-1',
    mapId,
    factions: [
      { id: 'p1', label: 'Player', color: '#4dabff', isPlayer: true, isAi: false },
      { id: 'p2', label: 'Enemy', color: '#ff6b6b', isPlayer: false, isAi: true, aiDifficulty: 'normal' },
    ],
    rules: {
      startingResources,
      populationCap: 20,
      fogOfWar: true,
      aiDifficulty: 'normal',
      rngSeed: 1,
    },
  };
}

function createEngine(options: { resources?: ResourceNode[]; startingResources?: { mineral: number; gas: number } } = {}): RtsEngine {
  const map = makeResolvedMap([
    ['grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass'],
    ['grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass'],
    ['grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass'],
    ['grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass'],
    ['grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass'],
  ], options.resources ?? []);
  return new RtsEngine({
    match: makeMatch(map.id, options.startingResources),
    map,
    audioBus: { playSfx() {}, playMusic() {}, stopMusic() {}, setMasterVolume() {}, dispose() {} },
  });
}

function findFactionBuilding(engine: RtsEngine, factionId: string, kind: BuildingComponent['kind']): number {
  for (const id of engine.world.query([C.building, C.faction])) {
    const building = engine.world.getComponent<BuildingComponent>(id, C.building)!;
    const faction = engine.world.getComponent<FactionComponent>(id, C.faction)!;
    if (building.kind === kind && faction.factionId === factionId) return id;
  }
  throw new Error(`Missing ${factionId} ${kind}`);
}

function findFactionWorker(engine: RtsEngine, factionId: string): number {
  for (const id of engine.world.query([C.worker, C.faction])) {
    const faction = engine.world.getComponent<FactionComponent>(id, C.faction)!;
    if (faction.factionId === factionId) return id;
  }
  throw new Error(`Missing ${factionId} worker`);
}

function removeFactionEntities(engine: RtsEngine, factionId: string): void {
  const ids = [...engine.world.query([C.faction])].filter((id) => {
    const faction = engine.world.getComponent<FactionComponent>(id, C.faction);
    return faction?.factionId === factionId;
  });
  for (const id of ids) engine.world.removeEntity(id);
}

function tickForMs(engine: RtsEngine, ms: number): void {
  const steps = Math.ceil(ms / (1000 / 30)) + 1;
  for (let i = 0; i < steps; i++) engine.tickFixed();
}

describe('RtsEngine order modes', () => {
  test('hold selection does not chase enemies outside firing range', () => {
    const engine = createEngine();
    const player = engine.spawnUnit('rifleman', 'p1', { col: 2, row: 2 });
    const enemy = engine.spawnUnit('rifleman', 'p2', { col: 10, row: 2 });
    engine.selectByIds([player]);
    engine.holdSelection();

    for (let i = 0; i < 60; i++) engine.tickFixed();

    const move = engine.world.getComponent<MovementComponent>(player, C.movement)!;
    const pos = engine.world.getComponent<PositionComponent>(player, C.position)!;
    const enemyHealth = engine.world.getComponent<HealthComponent>(enemy, C.health)!;

    expect(move.orderMode).toBe('hold');
    expect(move.path.length).toBe(0);
    expect(Math.floor(pos.col)).toBe(2);
    expect(enemyHealth.hp).toBe(enemyHealth.maxHp);
  });

  test('attack-move transitions into hold after reaching its destination', () => {
    const engine = createEngine();
    const player = engine.spawnUnit('rifleman', 'p1', { col: 2, row: 2 });
    engine.selectByIds([player]);
    engine.orderAttackMoveSelectionTo({ col: 5, row: 2 });

    for (let i = 0; i < 160; i++) engine.tickFixed();

    const move = engine.world.getComponent<MovementComponent>(player, C.movement)!;
    const pos = engine.world.getComponent<PositionComponent>(player, C.position)!;

    expect(move.orderMode).toBe('hold');
    expect(Math.floor(pos.col)).toBe(5);
    expect(Math.floor(pos.row)).toBe(2);
  });

  test('workers stopped by the player do not immediately resume auto-harvesting', () => {
    const engine = createEngine();
    const worker = engine.spawnUnit('worker', 'p1', { col: 2, row: 2 });
    engine.selectByIds([worker]);
    engine.stopSelection();

    for (let i = 0; i < 120; i++) engine.tickFixed();

    const workerState = engine.world.getComponent<WorkerComponent>(worker, C.worker)!;
    const move = engine.world.getComponent<MovementComponent>(worker, C.movement)!;

    expect(workerState.autoGatherEnabled).toBe(false);
    expect(workerState.state).toBe('idle');
    expect(move.path.length).toBe(0);
  });

  test('patrol orders cycle a unit between both endpoints', () => {
    const engine = createEngine();
    const player = engine.spawnUnit('rifleman', 'p1', { col: 2, row: 2 });
    engine.selectByIds([player]);
    engine.orderPatrolSelectionTo({ col: 5, row: 2 });

    const visitedCols = new Set<number>();
    for (let i = 0; i < 220; i++) {
      engine.tickFixed();
      const pos = engine.world.getComponent<PositionComponent>(player, C.position)!;
      visitedCols.add(Math.floor(pos.col));
    }

    const move = engine.world.getComponent<MovementComponent>(player, C.movement)!;
    expect(move.orderMode).toBe('patrol');
    expect(visitedCols.has(2)).toBe(true);
    expect(visitedCols.has(5)).toBe(true);
  });

  test('workers can repair damaged friendly structures', () => {
    const engine = createEngine();
    const worker = findFactionWorker(engine, 'p1');
    const hq = findFactionBuilding(engine, 'p1', 'hq');
    const hp = engine.world.getComponent<HealthComponent>(hq, C.health)!;
    hp.hp -= 80;
    const initialHp = hp.hp;

    engine.selectByIds([worker]);
    engine.orderRepairTarget(hq);
    for (let i = 0; i < 200; i++) engine.tickFixed();

    expect(engine.world.getComponent<HealthComponent>(hq, C.health)!.hp).toBeGreaterThan(initialHp);
  });

  test('completed refineries unlock gas income for auto-gathering workers', () => {
    const engine = createEngine({
      resources: [{ id: 'gas-1', kind: 'gas', tile: { col: 6, row: 2 }, amount: 500 }],
      startingResources: { mineral: 500, gas: 0 },
    });

    const refinery = engine.placeBuilding('p1', 'refinery', { col: 4, row: 1 });
    expect(refinery).not.toBeNull();
    engine.world.getComponent<BuildingComponent>(refinery!, C.building)!.buildProgress = 1;

    for (let i = 0; i < 400; i++) engine.tickFixed();

    expect(engine.getResources('p1').gas).toBeGreaterThan(0);
  });

  test('unit production deducts the expected scout and rocket costs', () => {
    const engine = createEngine();
    const hq = findFactionBuilding(engine, 'p1', 'hq');

    const beforeScout = engine.getResources('p1');
    expect(engine.enqueueProduction(hq, 'scout')).toBe(true);
    const afterScout = engine.getResources('p1');
    expect(afterScout.mineral).toBe(beforeScout.mineral - UNIT_STATS.scout.cost.mineral);
    expect(afterScout.gas).toBe(beforeScout.gas - UNIT_STATS.scout.cost.gas);

    expect(engine.enqueueProduction(hq, 'rocket')).toBe(true);
    const afterRocket = engine.getResources('p1');
    expect(afterRocket.mineral).toBe(afterScout.mineral - UNIT_STATS.rocket.cost.mineral);
    expect(afterRocket.gas).toBe(afterScout.gas - UNIT_STATS.rocket.cost.gas);
  });

  test('production group selection targets matching local structures', () => {
    const engine = createEngine();
    const barracksA = engine.spawnBuilding('barracks', 'p1', { col: 4, row: 1 }, true);
    const barracksB = engine.spawnBuilding('barracks', 'p1', { col: 7, row: 1 }, true);

    expect(engine.selectProductionBuildings('barracks')).toBe(2);
    expect(engine.getSelection().sort((a, b) => a - b)).toEqual([barracksA, barracksB].sort((a, b) => a - b));

    const groups = engine.getProductionStructureGroups('p1');
    expect(groups.find((group) => group.kind === 'barracks')?.selectedCount).toBe(2);
  });

  test('canceling the last queued production refunds its cost', () => {
    const engine = createEngine();
    const hq = findFactionBuilding(engine, 'p1', 'hq');
    const before = engine.getResources('p1');

    expect(engine.enqueueProduction(hq, 'scout')).toBe(true);
    const afterQueue = engine.getResources('p1');
    expect(afterQueue.mineral).toBe(before.mineral - UNIT_STATS.scout.cost.mineral);

    const canceled = engine.cancelLastProduction(hq);
    expect(canceled?.kind).toBe('scout');
    expect(engine.getResources('p1').mineral).toBe(before.mineral);
    expect(engine.getProductionQueue('p1')).toHaveLength(0);
  });

  test('placing a depot spends resources and reserves the build footprint', () => {
    const engine = createEngine();
    const before = engine.getResources('p1');
    const depot = engine.placeBuilding('p1', 'depot', { col: 5, row: 1 });

    expect(depot).not.toBeNull();
    expect(engine.getResources('p1').mineral).toBe(before.mineral - BUILDING_STATS.depot.cost.mineral);
    expect(engine.placeBuilding('p1', 'depot', { col: 5, row: 1 })).toBeNull();
  });

  test('research queue tracks prerequisites, occupancy, and refunds on cancel', () => {
    const engine = createEngine();
    const hq = findFactionBuilding(engine, 'p1', 'hq');
    const started: string[] = [];
    const canceled: string[] = [];
    engine.emitter.on('researchStarted', ({ kind }) => {
      started.push(kind);
    });
    engine.emitter.on('researchCanceled', ({ kind }) => {
      canceled.push(kind);
    });

    const before = engine.getResources('p1');
    expect(engine.canResearch('armorT1')).toBe(true);
    expect(engine.canResearch('armorT2')).toBe(false);
    expect(engine.getResearchOptions('p1').find((option) => option.kind === 'armorT1')).toMatchObject({
      available: true,
      queueReady: true,
      totalResearcherCount: 1,
      busyResearcherCount: 0,
      prerequisitesMet: true,
      researched: false,
      queued: false,
      blockedBy: [],
    });
    expect(engine.getResearchOptions('p1').find((option) => option.kind === 'armorT2')).toMatchObject({
      available: true,
      queueReady: false,
      prerequisitesMet: false,
      researched: false,
      queued: false,
      blockedBy: ['armorT1'],
    });

    engine.selectByIds([hq]);
    expect(engine.enqueueResearchFromSelection('armorT1')).toBe(1);
    expect(started).toEqual(['armorT1']);
    expect(engine.getResources('p1').mineral).toBe(before.mineral - TECH_STATS.armorT1.cost.mineral);
    expect(engine.getResources('p1').gas).toBe(before.gas - TECH_STATS.armorT1.cost.gas);
    expect(engine.getResearchQueue('p1')).toEqual([
      expect.objectContaining({ researcherId: hq, researcherKind: 'hq', kind: 'armorT1' }),
    ]);
    expect(engine.getResearchOptions('p1').find((option) => option.kind === 'armorT1')?.queued).toBe(true);
    expect(engine.canResearch('armorT1')).toBe(false);
    expect(engine.canResearch('weaponT1')).toBe(false);

    expect(engine.cancelResearch(hq)).toBe('armorT1');
    expect(canceled).toEqual(['armorT1']);
    expect(engine.getResearchQueue('p1')).toHaveLength(0);
    expect(engine.getResources('p1')).toMatchObject(before);
    expect(engine.canResearch('weaponT1')).toBe(true);
  });

  test('completed research unlocks follow-up tech and upgrades future reinforcements', () => {
    const engine = createEngine();
    const hq = findFactionBuilding(engine, 'p1', 'hq');
    const veteran = engine.spawnUnit('rifleman', 'p1', { col: 4, row: 2 });
    const veteranHealth = engine.world.getComponent<HealthComponent>(veteran, C.health)!;
    const veteranCombat = engine.world.getComponent<CombatComponent>(veteran, C.combat)!;
    const completed: string[] = [];
    engine.emitter.on('researchCompleted', ({ kind }) => {
      completed.push(kind);
    });

    expect(engine.enqueueResearch(hq, 'armorT1')).toBe(true);
    tickForMs(engine, TECH_STATS.armorT1.researchTimeMs);

    expect(completed).toEqual(['armorT1']);
    expect(veteranHealth.armor).toBe(UNIT_STATS.rifleman.armor + (TECH_STATS.armorT1.effects.armorBonus ?? 0));
    expect(engine.getResearchState('p1')).toMatchObject({
      researched: ['armorT1'],
      totalArmorBonus: TECH_STATS.armorT1.effects.armorBonus ?? 0,
    });
    expect(engine.canResearch('armorT2')).toBe(true);

    expect(engine.enqueueResearch(hq, 'weaponT1')).toBe(true);
    tickForMs(engine, TECH_STATS.weaponT1.researchTimeMs);

    expect(completed).toEqual(['armorT1', 'weaponT1']);
    expect(veteranCombat.damage).toBe(UNIT_STATS.rifleman.damage + (TECH_STATS.weaponT1.effects.damageBonus ?? 0));
    expect(engine.getResearchState('p1')).toMatchObject({
      researched: ['armorT1', 'weaponT1'],
      totalArmorBonus: TECH_STATS.armorT1.effects.armorBonus ?? 0,
      totalDamageBonus: TECH_STATS.weaponT1.effects.damageBonus ?? 0,
    });
    expect(engine.canResearch('weaponT2')).toBe(true);

    const reinforcement = engine.spawnUnit('rifleman', 'p1', { col: 5, row: 2 });
    expect(engine.world.getComponent<HealthComponent>(reinforcement, C.health)!.armor).toBe(
      UNIT_STATS.rifleman.armor + (TECH_STATS.armorT1.effects.armorBonus ?? 0),
    );
    expect(engine.world.getComponent<CombatComponent>(reinforcement, C.combat)!.damage).toBe(
      UNIT_STATS.rifleman.damage + (TECH_STATS.weaponT1.effects.damageBonus ?? 0),
    );
  });

  test('mission state exposes wave status labels before and after enemy launches', () => {
    const engine = createEngine();
    const events: Array<ReturnType<RtsEngine['getMissionState']>> = [];
    engine.emitter.on('missionUpdated', ({ state }) => {
      events.push(state);
    });

    const opening = engine.getMissionState();
    expect(opening.objectiveTitle).toBe('Hold the line');
    expect(opening.objectiveDetail).toContain('Protect your HQ');
    expect(opening.phase).toBe('opening');
    expect(opening.pressure).toBe('stable');
    expect(opening.pressureLabel).toBe('Perimeter stable');
    expect(opening.enemyActivity.status).toBe('forming');
    expect(opening.enemyActivity.statusLabel).toBe('Enemy wave building');
    expect(opening.enemyActivity.cadenceMs).toBe(30_000);
    expect(opening.enemyActivity.countdownMs).toBeNull();

    engine.reportSquadLaunched({
      factionId: 'p2',
      size: 3,
      waveIndex: 1,
      launchedAtMs: 0,
      cadenceMs: 30_000,
      targetTile: { col: 1, row: 2 },
    });

    const afterLaunch = engine.getMissionState();
    expect(afterLaunch.phase).toBe('defense');
    expect(afterLaunch.enemyActivity.wavesLaunched).toBe(1);
    expect(afterLaunch.enemyActivity.lastWaveSize).toBe(3);
    expect(afterLaunch.enemyActivity.status).toBe('inbound');
    expect(afterLaunch.enemyActivity.statusLabel).toBe('Wave 1 is in contact');
    expect(afterLaunch.enemyActivity.countdownMs).toBe(30_000);
    expect(events.at(-1)?.enemyActivity.wavesLaunched).toBe(1);

    for (let i = 0; i < 390; i++) engine.tickFixed();

    const cooldown = engine.getMissionState();
    expect(cooldown.enemyActivity.status).toBe('cooldown');
    expect(cooldown.enemyActivity.statusLabel).toBe('Next wave in 00:17');
    expect(cooldown.enemyActivity.countdownMs).toBeLessThan(17_100);
    expect(cooldown.enemyActivity.countdownMs).toBeGreaterThan(16_900);

    for (let i = 0; i < 240; i++) engine.tickFixed();

    const imminent = engine.getMissionState();
    expect(imminent.enemyActivity.status).toBe('imminent');
    expect(imminent.enemyActivity.statusLabel).toBe('Next wave in 00:10');
    expect(imminent.enemyActivity.countdownMs).toBeLessThan(9_100);
    expect(imminent.enemyActivity.countdownMs).toBeGreaterThan(8_900);
    expect(events.some((state) => state.enemyActivity.status === 'cooldown')).toBe(true);
    expect(events.some((state) => state.enemyActivity.status === 'imminent')).toBe(true);
  });

  test('mission state resolves when the local side wins or loses', () => {
    const victoryEngine = createEngine();
    const victoryEvents: Array<ReturnType<RtsEngine['getMissionState']>> = [];
    victoryEngine.emitter.on('missionUpdated', ({ state }) => {
      victoryEvents.push(state);
    });

    removeFactionEntities(victoryEngine, 'p2');
    victoryEngine.tickFixed();

    const victory = victoryEngine.getMissionState();
    expect(victoryEngine.isFinished()).toBe(true);
    expect(victory.phase).toBe('victory');
    expect(victory.enemyActivity.status).toBe('resolved');
    expect(victory.enemyActivity.statusLabel).toBe('Threat neutralized');
    expect(victory.objectiveDetail).toContain('Enemy command destroyed');
    expect(victoryEvents.at(-1)?.phase).toBe('victory');

    const defeatEngine = createEngine();
    const defeatEvents: Array<ReturnType<RtsEngine['getMissionState']>> = [];
    defeatEngine.emitter.on('missionUpdated', ({ state }) => {
      defeatEvents.push(state);
    });

    removeFactionEntities(defeatEngine, 'p1');
    defeatEngine.tickFixed();

    const defeat = defeatEngine.getMissionState();
    expect(defeatEngine.isFinished()).toBe(true);
    expect(defeat.phase).toBe('defeat');
    expect(defeat.enemyActivity.status).toBe('resolved');
    expect(defeat.enemyActivity.statusLabel).toBe('Defense broken');
    expect(defeat.objectiveDetail).toContain('defenses collapsed');
    expect(defeatEvents.at(-1)?.phase).toBe('defeat');
  });

  test('ai launches attack waves on cadence instead of every director tick', () => {
    const engine = createEngine();
    const ai = new AiController(engine, 'p2', 'normal', 7);
    const waves: number[] = [];
    engine.emitter.on('squadLaunched', ({ waveIndex }) => {
      waves.push(waveIndex);
    });

    (ai as unknown as { buildOrderIndex: number }).buildOrderIndex = 4;
    engine.spawnUnit('rifleman', 'p2', { col: 18, row: 1 });
    engine.spawnUnit('rifleman', 'p2', { col: 18, row: 2 });

    ai.tick(2_000);
    ai.tick(4_000);
    ai.tick(32_000);

    expect(waves).toEqual([1, 2]);
    expect(engine.getMissionState().enemyActivity.wavesLaunched).toBe(2);
  });
});
