import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import type { Surreal } from 'surrealdb';
import { createDbConnection } from '../client.js';
import { SurrealDbAdapter } from '../SurrealDbAdapter.js';
import { SurrealUserArenaRepository } from './SurrealUserArenaRepository.js';
import { SurrealAgentRepository } from './SurrealAgentRepository.js';
import { SurrealTrainingRunRepository } from './SurrealTrainingRunRepository.js';
import { SurrealEpisodeRepository } from './SurrealEpisodeRepository.js';
import { SurrealReplayRepository } from './SurrealReplayRepository.js';
import { SurrealWeightCheckpointRepository } from './SurrealWeightCheckpointRepository.js';
import { SurrealNeatGenomeRepository } from './SurrealNeatGenomeRepository.js';
import { SurrealNeatSpeciesRepository } from './SurrealNeatSpeciesRepository.js';
import { SurrealNeatInnovationLogRepository } from './SurrealNeatInnovationLogRepository.js';
import type {
  ArenaDefinition,
  ArenaMetadata,
  BodyDna,
  BrainDna,
  EpisodeSummary,
  NeatGenome,
  TrainingDna,
} from '../../../shared/voxsim/index.js';
import { emptyMetricBreakdown } from '../../../shared/voxsim/index.js';

const ISO = '2026-01-01T00:00:00.000Z';

function arenaMeta(): ArenaMetadata {
  return { title: 'Flat', author: 'me', createdAt: ISO, updatedAt: ISO, source: 'user' };
}

function arenaDef(): ArenaDefinition {
  return {
    id: 'flat-arena',
    version: 1,
    chunkSize: { sx: 4, sy: 2, sz: 4 },
    voxelSize: 1,
    bounds: { min: { x: 0, y: 0, z: 0 }, max: { x: 4, y: 2, z: 4 } },
    chunks: [],
    spawns: [],
    entities: [],
    gravity: { x: 0, y: -9.81, z: 0 },
    skybox: 'default',
  } as unknown as ArenaDefinition;
}

function bodyOf(id: string): BodyDna {
  return {
    metadata: { id, organism: 'biped', createdAt: ISO, updatedAt: ISO },
    rootSegment: 'root',
    segments: [],
    joints: [],
    sensors: [],
    actuators: { actuators: [] },
    deathRule: { kind: 'tilt', maxTiltDegrees: 60 },
  } as unknown as BodyDna;
}

function brainOf(id: string): BrainDna {
  return {
    metadata: { id, createdAt: ISO, updatedAt: ISO },
    topology: 'mlp',
    layers: [],
    inputEncoders: [],
    outputDecoders: [],
  } as unknown as BrainDna;
}

function trainingOf(id: string): TrainingDna {
  return { metadata: { id, createdAt: ISO, updatedAt: ISO } } as unknown as TrainingDna;
}

function episodeOf(overrides: Partial<EpisodeSummary> = {}): EpisodeSummary {
  return {
    id: overrides.id ?? `ep-${Math.random().toString(36).slice(2, 8)}`,
    runId: overrides.runId ?? 'run-1',
    agentId: overrides.agentId ?? 'agent-1',
    bodyDnaId: 'body-1',
    brainDnaId: 'brain-1',
    arenaId: overrides.arenaId ?? 'flat-arena',
    generation: overrides.generation ?? 0,
    candidateIndex: 0,
    seed: 42,
    outcome: { kind: 'completed' },
    totalReward: overrides.totalReward ?? 1,
    meanReward: 0.5,
    steps: 100,
    metricBreakdown: emptyMetricBreakdown(),
    ...overrides,
  } as EpisodeSummary;
}

function neatGenomeOf(id: string): NeatGenome {
  return {
    id,
    nodes: [
      { id: 1, kind: 'input', activation: 'identity', bias: 0 },
      { id: 2, kind: 'output', activation: 'tanh', bias: 0 },
      { id: 3, kind: 'lstm', activation: 'tanh', bias: 0 },
    ],
    connections: [
      { innovation: 1, sourceNodeId: 1, targetNodeId: 2, weight: 0.5, enabled: true },
      { innovation: 2, sourceNodeId: 1, targetNodeId: 3, weight: 0.2, enabled: false },
    ],
    nextLocalNodeId: 4,
  } as unknown as NeatGenome;
}

function makeDb(): Promise<Surreal> {
  return createDbConnection({
    host: 'mem://',
    namespace: `test_ns_${crypto.randomUUID()}`,
    database: `test_db_${crypto.randomUUID()}`,
  });
}

describe('Surreal voxsim repositories (mem://)', () => {
  let db: Surreal;
  let adapter: SurrealDbAdapter;

  beforeEach(async () => {
    db = await makeDb();
    adapter = new SurrealDbAdapter(db);
  });

  afterEach(async () => {
    await db.close();
  });

  test('SurrealUserArenaRepository round-trips create/list/update/delete', async () => {
    const repo = new SurrealUserArenaRepository(adapter, () => ISO);
    expect(await repo.list()).toEqual([]);
    const created = await repo.create({ metadata: arenaMeta(), definition: arenaDef() });
    expect(created.metadata.title).toBe('Flat');
    expect((await repo.list()).map((r) => r.id)).toEqual([created.id]);
    const updated = await repo.update(created.id, {
      metadata: { ...arenaMeta(), title: 'Renamed' },
    });
    expect(updated.metadata.title).toBe('Renamed');
    await repo.delete(created.id);
    expect(await repo.list()).toEqual([]);
    expect(await repo.findById(created.id)).toBeUndefined();
  });

  test('SurrealAgentRepository persists agents and reports lineage', async () => {
    const repo = new SurrealAgentRepository(adapter, () => ISO);
    const root = await repo.create({
      name: 'root',
      kind: 'biped',
      bodyDna: bodyOf('body-1'),
      brainDna: brainOf('brain-1'),
      generation: 0,
    });
    const child = await repo.create({
      name: 'child',
      kind: 'biped',
      bodyDna: bodyOf('body-1'),
      brainDna: brainOf('brain-1'),
      generation: 1,
      lineageParentAgentId: root.id,
    });
    expect((await repo.list()).length).toBe(2);
    const lineage = await repo.listLineage(root.id);
    expect(lineage.map((n) => n.agentId).sort()).toEqual([root.id, child.id].sort());
    const updated = await repo.update(root.id, { name: 'renamed', bestScore: 7 });
    expect(updated.name).toBe('renamed');
    expect(updated.bestScore).toBe(7);
    await repo.delete(child.id);
    expect((await repo.list()).map((r) => r.id)).toEqual([root.id]);
  });

  test('SurrealTrainingRunRepository creates and updates status fields', async () => {
    const repo = new SurrealTrainingRunRepository(adapter, () => ISO);
    const run = await repo.create({
      agentId: 'agent-1',
      trainingDnaSnapshot: trainingOf('train-1'),
      algorithm: 'reinforce',
      arenaCurriculumIds: ['flat-arena'],
      status: 'starting',
      startedAt: ISO,
    });
    expect(run.status).toBe('starting');
    expect(run.totalEpisodes).toBe(0);
    const running = await repo.updateStatus(run.id, 'running', { totalEpisodes: 3, bestScore: 5 });
    expect(running.status).toBe('running');
    expect(running.totalEpisodes).toBe(3);
    expect(running.bestScore).toBe(5);
    const done = await repo.updateStatus(run.id, 'completed', { finishedAt: ISO });
    expect(done.status).toBe('completed');
    expect(done.finishedAt).toBe(ISO);
    expect((await repo.list({ status: 'completed' })).map((r) => r.id)).toEqual([run.id]);
  });

  test('SurrealEpisodeRepository records episodes with filters', async () => {
    const repo = new SurrealEpisodeRepository(adapter, () => ISO);
    await repo.record(episodeOf({ runId: 'run-A', generation: 0 }));
    await repo.record(episodeOf({ runId: 'run-B', generation: 1 }));
    const all = await repo.list();
    expect(all.length).toBe(2);
    const onlyA = await repo.list({ runId: 'run-A' });
    expect(onlyA.map((e) => e.runId)).toEqual(['run-A']);
  });

  test('SurrealReplayRepository round-trips binary blobs', async () => {
    const repo = new SurrealReplayRepository(adapter, () => ISO);
    const bytes = new Uint8Array([1, 2, 3, 4, 5, 250, 251, 252]);
    const created = await repo.record({ episodeId: 'ep-1', bytes, frames: 10 });
    expect(created.frames).toBe(10);
    const fetched = await repo.findById(created.id);
    expect(fetched).toBeDefined();
    expect(Array.from(fetched!.bytes)).toEqual(Array.from(bytes));
  });

  test('SurrealWeightCheckpointRepository persists weights and filters by agent', async () => {
    const repo = new SurrealWeightCheckpointRepository(adapter, () => ISO);
    const weights = new Uint8Array([10, 20, 30, 40]);
    const cp = await repo.record({
      agentId: 'agent-1',
      runId: 'run-1',
      brainDnaId: 'brain-1',
      generation: 0,
      score: 1.5,
      weights,
    });
    const fetched = await repo.findById(cp.id);
    expect(Array.from(fetched!.weights)).toEqual(Array.from(weights));
    expect((await repo.list({ agentId: 'agent-1' })).length).toBe(1);
    expect((await repo.list({ agentId: 'agent-2' })).length).toBe(0);
  });

  test('SurrealNeatGenomeRepository computes summary fields and filters', async () => {
    const repo = new SurrealNeatGenomeRepository(adapter, () => ISO);
    const created = await repo.record({
      agentId: 'agent-1',
      runId: 'run-1',
      brainDnaId: 'brain-1',
      generation: 0,
      speciesId: 7,
      score: 2.5,
      genome: neatGenomeOf('g-1'),
    });
    expect(created.nodeCount).toBe(3);
    expect(created.connectionCount).toBe(2);
    expect(created.enabledConnectionCount).toBe(1);
    expect(created.lstmNodeCount).toBe(1);
    expect(created.bytes).toBeGreaterThan(0);
    expect((await repo.list({ runId: 'run-1' })).length).toBe(1);
    expect((await repo.list({ minScore: 100 })).length).toBe(0);
  });

  test('SurrealNeatSpeciesRepository merges generation history per species', async () => {
    const repo = new SurrealNeatSpeciesRepository(adapter, () => ISO);
    const first = await repo.recordSnapshot({
      runId: 'run-1',
      speciesId: 1,
      generation: 0,
      size: 5,
      bestScore: 1,
      meanScore: 0.5,
      stagnationGenerations: 0,
      representativeGenomeId: 'g-1',
    });
    expect(first.generationHistory.length).toBe(1);
    const updated = await repo.recordSnapshot({
      runId: 'run-1',
      speciesId: 1,
      generation: 1,
      size: 7,
      bestScore: 3,
      meanScore: 1.5,
      stagnationGenerations: 0,
      representativeGenomeId: 'g-2',
    });
    expect(updated.generationHistory.length).toBe(2);
    expect(updated.latestBestScore).toBe(3);
    const list = await repo.list({ runId: 'run-1' });
    expect(list.length).toBe(1);
    expect(list[0]!.speciesId).toBe(1);
  });

  test('SurrealNeatInnovationLogRepository appends and filters by generation', async () => {
    const repo = new SurrealNeatInnovationLogRepository(adapter, () => ISO);
    await repo.record({
      runId: 'run-1',
      generation: 0,
      addedConnections: [{ innovation: 1, sourceNodeId: 1, targetNodeId: 2 }],
      addedNodes: [],
    });
    await repo.record({
      runId: 'run-1',
      generation: 5,
      addedConnections: [],
      addedNodes: [{ innovation: 2, splitConnectionInnovation: 1 }],
    });
    const all = await repo.list({ runId: 'run-1' });
    expect(all.length).toBe(2);
    const recent = await repo.list({ runId: 'run-1', sinceGeneration: 3 });
    expect(recent.length).toBe(1);
    expect(recent[0]!.generation).toBe(5);
  });
});
