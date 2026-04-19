import { describe, expect, it } from 'bun:test';
import { TrainingCoordinator } from './TrainingCoordinator.js';
import type {
  AgentRecord,
  CreateAgentInput,
  CreateTrainingRunInput,
  EpisodeRecord,
  IAgentRepository,
  IEpisodeRepository,
  INeatGenomeRepository,
  INeatInnovationLogRepository,
  INeatSpeciesRepository,
  IReplayRepository,
  ITrainingRunRepository,
  IWeightCheckpointRepository,
  ListAgentsFilter,
  ListCheckpointsFilter,
  ListEpisodesFilter,
  ListNeatGenomesFilter,
  ListNeatInnovationsFilter,
  ListNeatSpeciesFilter,
  ListRunsFilter,
  NeatGenomeRecord,
  NeatInnovationLogRecord,
  NeatSpeciesRecord,
  RecordEpisodeInput,
  RecordNeatGenomeInput,
  RecordNeatInnovationLogInput,
  RecordNeatSpeciesSnapshotInput,
  RecordReplayInput,
  RecordWeightCheckpointInput,
  ReplayRecord,
  TrainingRunRecord,
  UpdateAgentPatch,
  UpdateTrainingRunFields,
  WeightCheckpointRecord,
} from './ports.js';
import type {
  ArenaDefinition,
  CheckpointRef,
  EpisodeSummary,
  NeatGenome,
  TrainingDna,
  TrainingProgressEvent,
  TrainingRunStatus,
} from '../../shared/voxsim/index.js';
import { emptyMetricBreakdown } from '../../shared/voxsim/index.js';
import type {
  CheckpointPayload,
  TrainerOrchestrator,
  TrainerStartInput,
  TrainingProgressListener,
  TrainingRunHandle,
  Unsubscribe,
} from './training/index.js';

// ----------------------------- fakes -----------------------------

class FakeAgentRepo implements IAgentRepository {
  records = new Map<string, AgentRecord>();
  async list(_f?: ListAgentsFilter) {
    return Array.from(this.records.values());
  }
  async findById(id: string) {
    return this.records.get(id);
  }
  async create(input: CreateAgentInput) {
    const r: AgentRecord = {
      id: `agent-${this.records.size + 1}`,
      name: input.name,
      kind: input.kind,
      bodyDna: input.bodyDna,
      brainDna: input.brainDna,
      trainingDna: input.trainingDna,
      generation: input.generation ?? 0,
      lineageParentAgentId: input.lineageParentAgentId,
      mutationSummary: input.mutationSummary,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    };
    this.records.set(r.id, r);
    return r;
  }
  async update(id: string, patch: UpdateAgentPatch) {
    const r = this.records.get(id)!;
    Object.assign(r, patch);
    return r;
  }
  async delete(id: string) {
    this.records.delete(id);
  }
  async listLineage() {
    return [];
  }
}

class FakeRunRepo implements ITrainingRunRepository {
  records = new Map<string, TrainingRunRecord>();
  statusUpdates: { id: string; status: TrainingRunStatus; fields?: UpdateTrainingRunFields }[] = [];
  async list(_f?: ListRunsFilter) {
    return Array.from(this.records.values());
  }
  async findById(id: string) {
    return this.records.get(id);
  }
  async create(input: CreateTrainingRunInput) {
    const r: TrainingRunRecord = {
      id: `run-${this.records.size + 1}`,
      ...input,
      totalEpisodes: 0,
      totalGenerations: 0,
    };
    this.records.set(r.id, r);
    return r;
  }
  async updateStatus(id: string, status: TrainingRunStatus, fields?: UpdateTrainingRunFields) {
    this.statusUpdates.push({ id, status, fields });
    const r = this.records.get(id)!;
    r.status = status;
    if (fields) Object.assign(r, fields);
    return r;
  }
}

class FakeEpisodeRepo implements IEpisodeRepository {
  records: EpisodeRecord[] = [];
  async list(_f?: ListEpisodesFilter) {
    return this.records;
  }
  async record(input: RecordEpisodeInput) {
    const r: EpisodeRecord = { ...input, createdAt: '2026-01-01T00:00:00Z' };
    this.records.push(r);
    return r;
  }
}

class FakeReplayRepo implements IReplayRepository {
  records: ReplayRecord[] = [];
  async findById(id: string) {
    return this.records.find((r) => r.id === id);
  }
  async record(input: RecordReplayInput) {
    const r: ReplayRecord = {
      id: input.id ?? `replay-${this.records.length + 1}`,
      episodeId: input.episodeId,
      bytes: input.bytes,
      frames: input.frames,
      createdAt: '2026-01-01T00:00:00Z',
    };
    this.records.push(r);
    return r;
  }
}

class FakeCheckpointRepo implements IWeightCheckpointRepository {
  records: WeightCheckpointRecord[] = [];
  async list(_f?: ListCheckpointsFilter) {
    return this.records;
  }
  async findById(id: string) {
    return this.records.find((r) => r.id === id);
  }
  async record(input: RecordWeightCheckpointInput) {
    const r: WeightCheckpointRecord = {
      id: input.id ?? `cp-${this.records.length + 1}`,
      agentId: input.agentId,
      runId: input.runId,
      brainDnaId: input.brainDnaId,
      generation: input.generation,
      score: input.score,
      weights: input.weights,
      createdAt: '2026-01-01T00:00:00Z',
    };
    this.records.push(r);
    return r;
  }
}

class FakeNeatGenomeRepo implements INeatGenomeRepository {
  records: NeatGenomeRecord[] = [];
  async record(input: RecordNeatGenomeInput) {
    const json = JSON.stringify(input.genome);
    const r: NeatGenomeRecord = {
      id: input.id ?? `genome-${this.records.length + 1}`,
      agentId: input.agentId,
      runId: input.runId,
      brainDnaId: input.brainDnaId,
      generation: input.generation,
      speciesId: input.speciesId,
      score: input.score,
      scoreHistory: input.scoreHistory,
      nodeCount: input.genome.nodes.length,
      connectionCount: input.genome.connections.length,
      enabledConnectionCount: input.genome.connections.filter((c) => c.enabled).length,
      lstmNodeCount: input.genome.nodes.filter((n) => n.kind === 'lstm').length,
      genome: input.genome,
      bytes: json.length,
      createdAt: '2026-01-01T00:00:00Z',
    };
    this.records.push(r);
    return r;
  }
  async findById(id: string) {
    return this.records.find((r) => r.id === id);
  }
  async list(_f?: ListNeatGenomesFilter) {
    return this.records;
  }
}

class FakeNeatSpeciesRepo implements INeatSpeciesRepository {
  records = new Map<string, NeatSpeciesRecord>();
  snapshots: RecordNeatSpeciesSnapshotInput[] = [];
  async recordSnapshot(input: RecordNeatSpeciesSnapshotInput) {
    this.snapshots.push(input);
    const key = `${input.runId}:${input.speciesId}`;
    const existing = this.records.get(key);
    if (existing) {
      existing.latestGeneration = input.generation;
      existing.latestSize = input.size;
      existing.latestBestScore = input.bestScore;
      existing.latestMeanScore = input.meanScore;
      existing.latestStagnationGenerations = input.stagnationGenerations;
      existing.representativeGenomeId = input.representativeGenomeId;
      existing.generationHistory.push({
        generation: input.generation,
        size: input.size,
        bestScore: input.bestScore,
        meanScore: input.meanScore,
        stagnation: input.stagnationGenerations,
        representativeGenomeId: input.representativeGenomeId,
      });
      existing.updatedAt = '2026-01-01T00:00:00Z';
      return existing;
    }
    const r: NeatSpeciesRecord = {
      id: key,
      runId: input.runId,
      speciesId: input.speciesId,
      latestGeneration: input.generation,
      latestSize: input.size,
      latestBestScore: input.bestScore,
      latestMeanScore: input.meanScore,
      latestStagnationGenerations: input.stagnationGenerations,
      representativeGenomeId: input.representativeGenomeId,
      generationHistory: [
        {
          generation: input.generation,
          size: input.size,
          bestScore: input.bestScore,
          meanScore: input.meanScore,
          stagnation: input.stagnationGenerations,
          representativeGenomeId: input.representativeGenomeId,
        },
      ],
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    };
    this.records.set(key, r);
    return r;
  }
  async list(_f: ListNeatSpeciesFilter) {
    return Array.from(this.records.values());
  }
}

class FakeNeatInnovationRepo implements INeatInnovationLogRepository {
  records: NeatInnovationLogRecord[] = [];
  async record(input: RecordNeatInnovationLogInput) {
    const id = `${input.runId}:gen:${input.generation}`;
    if (this.records.some((r) => r.id === id)) {
      throw new Error(`Duplicate innovation log for ${id}`);
    }
    const r: NeatInnovationLogRecord = {
      id,
      ...input,
      createdAt: '2026-01-01T00:00:00Z',
    };
    this.records.push(r);
    return r;
  }
  async list(_f: ListNeatInnovationsFilter) {
    return this.records;
  }
}

interface FakeOrchestratorEvents {
  starts: TrainerStartInput[];
}

function createFakeOrchestrator(): {
  orchestrator: TrainerOrchestrator;
  events: FakeOrchestratorEvents;
  emit: (runId: string, event: TrainingProgressEvent) => void;
  invokeOnEpisode: (
    runId: string,
    summary: EpisodeSummary,
    replay?: Uint8Array,
  ) => Promise<void>;
  invokeOnCheckpoint: (
    runId: string,
    ref: CheckpointRef,
    payload: CheckpointPayload,
  ) => Promise<void>;
  invokeOnSpecies: (
    runId: string,
    event: Extract<TrainingProgressEvent, { kind: 'speciesUpdated' }>,
  ) => Promise<void>;
  invokeOnInnovations: (
    runId: string,
    event: Extract<TrainingProgressEvent, { kind: 'innovationsAssigned' }>,
  ) => Promise<void>;
} {
  const events: FakeOrchestratorEvents = { starts: [] };
  const listeners = new Map<string, Set<TrainingProgressListener>>();
  const startInputs = new Map<string, TrainerStartInput>();

  const orchestrator: TrainerOrchestrator = {
    async start(input: TrainerStartInput): Promise<TrainingRunHandle> {
      events.starts.push(input);
      startInputs.set(input.runId, input);
      return { runId: input.runId };
    },
    async pause(_h: TrainingRunHandle) {},
    async resume(_h: TrainingRunHandle) {},
    async stop(h: TrainingRunHandle) {
      listeners.delete(h.runId);
      startInputs.delete(h.runId);
    },
    subscribe(h: TrainingRunHandle, listener: TrainingProgressListener): Unsubscribe {
      let set = listeners.get(h.runId);
      if (!set) {
        set = new Set();
        listeners.set(h.runId, set);
      }
      set.add(listener);
      return () => set!.delete(listener);
    },
  } as unknown as TrainerOrchestrator;

  return {
    orchestrator,
    events,
    emit(runId, event) {
      const set = listeners.get(runId);
      if (!set) return;
      for (const l of set) l(event);
    },
    async invokeOnEpisode(runId, summary, replay) {
      const input = startInputs.get(runId);
      if (!input) throw new Error('no start input');
      await input.onEpisode(summary, replay);
    },
    async invokeOnCheckpoint(runId, ref, payload) {
      const input = startInputs.get(runId);
      if (!input) throw new Error('no start input');
      await input.onCheckpoint(ref, payload);
    },
    async invokeOnSpecies(runId, event) {
      const input = startInputs.get(runId);
      if (!input?.onSpeciesUpdate) throw new Error('no species handler');
      await input.onSpeciesUpdate(event);
    },
    async invokeOnInnovations(runId, event) {
      const input = startInputs.get(runId);
      if (!input?.onInnovations) throw new Error('no innovations handler');
      await input.onInnovations(event);
    },
  };
}

// ----------------------------- helpers -----------------------------

function makeAgent(repo: FakeAgentRepo, algorithm: TrainingDna['algorithm']): Promise<AgentRecord> {
  return repo.create({
    name: 'walker',
    kind: 'biped' as never,
    bodyDna: { metadata: { id: 'body-1' } } as never,
    brainDna: { metadata: { id: 'brain-1' } } as never,
    trainingDna: {
      metadata: { id: 'train-1', createdAt: '', updatedAt: '' },
      algorithm,
      reward: { weights: {} },
      curriculum: { stages: [], advanceCriterion: { metric: 'meanReward', threshold: 0 } },
    } as unknown as TrainingDna,
  });
}

function makeArena(): ArenaDefinition {
  return {
    id: 'flat',
    version: 1,
    chunkSize: { sx: 4, sy: 4, sz: 4 },
    voxelSize: 1,
    bounds: { min: { cx: 0, cy: 0, cz: 0 }, max: { cx: 0, cy: 0, cz: 0 } },
    chunks: [],
    spawns: [
      {
        id: 'spawn',
        tag: 't',
        pose: { position: { x: 1, y: 1, z: 1 }, rotation: { x: 0, y: 0, z: 0, w: 1 } },
      },
    ],
    entities: [],
    gravity: { x: 0, y: -9.81, z: 0 },
    skybox: 'default',
  };
}

function makeEpisode(runId: string, agentId: string, score: number, replay = false): EpisodeSummary {
  const summary: EpisodeSummary = {
    id: `${runId}-ep-${score}`,
    runId,
    agentId,
    bodyDnaId: 'body-1',
    brainDnaId: 'brain-1',
    arenaId: 'flat',
    generation: 0,
    candidateIndex: 0,
    seed: 1,
    outcome: { kind: 'survived' },
    totalReward: score,
    meanReward: score,
    steps: 100,
    metricBreakdown: emptyMetricBreakdown(),
  };
  if (replay) {
    summary.replayRef = { id: `replay-${score}`, frames: 100, bytes: 4 };
  }
  return summary;
}

function makeNeatGenome(): NeatGenome {
  return {
    id: 'g1',
    nodes: [
      { id: 1, kind: 'input', activation: 'identity', bias: 0 },
      { id: 2, kind: 'output', activation: 'tanh', bias: 0 },
    ],
    connections: [{ innovation: 1, sourceNodeId: 1, targetNodeId: 2, weight: 0.5, enabled: true }],
    nextLocalNodeId: 3,
  } as unknown as NeatGenome;
}

function buildCoordinator(setup?: {
  generateRunId?: () => string;
}): {
  coord: TrainingCoordinator;
  agents: FakeAgentRepo;
  runs: FakeRunRepo;
  episodes: FakeEpisodeRepo;
  replays: FakeReplayRepo;
  checkpoints: FakeCheckpointRepo;
  neatGenomes: FakeNeatGenomeRepo;
  neatSpecies: FakeNeatSpeciesRepo;
  neatInnovations: FakeNeatInnovationRepo;
  fake: ReturnType<typeof createFakeOrchestrator>;
} {
  const agents = new FakeAgentRepo();
  const runs = new FakeRunRepo();
  const episodes = new FakeEpisodeRepo();
  const replays = new FakeReplayRepo();
  const checkpoints = new FakeCheckpointRepo();
  const neatGenomes = new FakeNeatGenomeRepo();
  const neatSpecies = new FakeNeatSpeciesRepo();
  const neatInnovations = new FakeNeatInnovationRepo();
  const fake = createFakeOrchestrator();
  const coord = new TrainingCoordinator({
    orchestrator: fake.orchestrator,
    agents,
    runs,
    episodes,
    replays,
    checkpoints,
    neatGenomes,
    neatSpecies,
    neatInnovations,
    arenaResolver: async (_id) => makeArena(),
    now: () => '2026-01-01T00:00:00Z',
    generateRunId: setup?.generateRunId,
  });
  return { coord, agents, runs, episodes, replays, checkpoints, neatGenomes, neatSpecies, neatInnovations, fake };
}

// ----------------------------- tests -----------------------------

describe('TrainingCoordinator', () => {
  it('start persists run as starting then running with mirrored algorithm', async () => {
    const { coord, agents, runs, fake } = buildCoordinator();
    const agent = await makeAgent(agents, 'evolution');
    const summary = await coord.start({ agentId: agent.id });

    expect(fake.events.starts).toHaveLength(1);
    expect(summary.algorithm).toBe('evolution');
    expect(summary.status).toBe('running');

    const r = await runs.findById(summary.id);
    expect(r?.algorithm).toBe('evolution');

    const statuses = runs.statusUpdates.map((u) => u.status);
    expect(statuses).toContain('running');
  });

  it('throws when starting on an agent without trainingDna', async () => {
    const { coord, agents } = buildCoordinator();
    const agent = await agents.create({
      name: 'walker',
      kind: 'biped' as never,
      bodyDna: {} as never,
      brainDna: {} as never,
    });
    await expect(coord.start({ agentId: agent.id })).rejects.toThrow();
  });

  it('persists episodes and replays', async () => {
    const { coord, agents, episodes, replays, fake } = buildCoordinator();
    const agent = await makeAgent(agents, 'evolution');
    const run = await coord.start({ agentId: agent.id });
    await fake.invokeOnEpisode(run.id, makeEpisode(run.id, agent.id, 1, true), new Uint8Array([1, 2, 3, 4]));

    expect(episodes.records).toHaveLength(1);
    expect(replays.records).toHaveLength(1);
    expect(replays.records[0]!.bytes.byteLength).toBe(4);
  });

  it('persists flat checkpoints and updates best score', async () => {
    const { coord, agents, checkpoints, neatGenomes, runs, fake } = buildCoordinator();
    const agent = await makeAgent(agents, 'evolution');
    const run = await coord.start({ agentId: agent.id });

    const ref: CheckpointRef = {
      kind: 'flat',
      ref: {
        id: 'cp-1',
        brainDnaId: 'brain-1',
        bytes: 16,
        score: 5,
        generation: 0,
        createdAt: '2026-01-01T00:00:00Z',
      },
    };
    await fake.invokeOnCheckpoint(run.id, ref, {
      kind: 'flat',
      weights: new Float32Array([0.1, 0.2, 0.3, 0.4]),
    });

    expect(checkpoints.records).toHaveLength(1);
    expect(neatGenomes.records).toHaveLength(0);

    const updated = await runs.findById(run.id);
    expect(updated?.bestScore).toBe(5);
    expect(updated?.bestCheckpointRef?.kind).toBe('flat');
  });

  it('persists NEAT genomes and routes by ref kind', async () => {
    const { coord, agents, checkpoints, neatGenomes, runs, fake } = buildCoordinator();
    const agent = await makeAgent(agents, 'neat');
    const run = await coord.start({ agentId: agent.id });

    const ref: CheckpointRef = {
      kind: 'neatGenome',
      genomeId: 'g-1',
      brainDnaId: 'brain-1',
      generation: 0,
      bytes: 32,
      score: 10,
      createdAt: '2026-01-01T00:00:00Z',
    };
    await fake.invokeOnCheckpoint(run.id, ref, { kind: 'neatGenome', genome: makeNeatGenome() });

    expect(neatGenomes.records).toHaveLength(1);
    expect(checkpoints.records).toHaveLength(0);

    const updated = await runs.findById(run.id);
    expect(updated?.bestScore).toBe(10);
    expect(updated?.bestCheckpointRef?.kind).toBe('neatGenome');
  });

  it('persists NEAT species snapshots and updates run species counts', async () => {
    const { coord, agents, neatSpecies, runs, fake } = buildCoordinator();
    const agent = await makeAgent(agents, 'neat');
    const run = await coord.start({ agentId: agent.id });

    await fake.invokeOnSpecies(run.id, {
      kind: 'speciesUpdated',
      runId: run.id,
      generation: 0,
      species: [
        { id: 1, size: 4, bestScore: 1, meanScore: 0.5, stagnation: 0, representativeGenomeId: 'g1' },
        { id: 2, size: 6, bestScore: 2, meanScore: 1.0, stagnation: 0, representativeGenomeId: 'g2' },
      ],
    });

    expect(neatSpecies.snapshots).toHaveLength(2);

    const updated = await runs.findById(run.id);
    expect(updated?.currentSpeciesCount).toBe(2);
    expect(updated?.totalSpeciesEverSeen).toBe(2);

    await fake.invokeOnSpecies(run.id, {
      kind: 'speciesUpdated',
      runId: run.id,
      generation: 1,
      species: [
        { id: 1, size: 4, bestScore: 3, meanScore: 1.5, stagnation: 0, representativeGenomeId: 'g1' },
        { id: 3, size: 5, bestScore: 4, meanScore: 2.0, stagnation: 0, representativeGenomeId: 'g3' },
      ],
    });

    const updated2 = await runs.findById(run.id);
    expect(updated2?.currentSpeciesCount).toBe(2);
    expect(updated2?.totalSpeciesEverSeen).toBe(3);
  });

  it('persists innovation logs and rejects duplicates', async () => {
    const { coord, agents, neatInnovations, fake } = buildCoordinator();
    const agent = await makeAgent(agents, 'neat');
    const run = await coord.start({ agentId: agent.id });

    await fake.invokeOnInnovations(run.id, {
      kind: 'innovationsAssigned',
      runId: run.id,
      generation: 0,
      addedConnections: [{ innovation: 1, sourceNodeId: 1, targetNodeId: 2 }],
      addedNodes: [],
    });

    expect(neatInnovations.records).toHaveLength(1);

    await expect(
      fake.invokeOnInnovations(run.id, {
        kind: 'innovationsAssigned',
        runId: run.id,
        generation: 0,
        addedConnections: [],
        addedNodes: [],
      }),
    ).rejects.toThrow();
  });

  it('forwards progress events to subscribers', async () => {
    const { coord, agents, fake } = buildCoordinator();
    const agent = await makeAgent(agents, 'evolution');
    const run = await coord.start({ agentId: agent.id });

    const events: TrainingProgressEvent[] = [];
    coord.subscribe(run.id, (e) => events.push(e));

    fake.emit(run.id, {
      kind: 'episodeFinished',
      runId: run.id,
      episode: makeEpisode(run.id, agent.id, 1),
    });
    expect(events).toHaveLength(1);
  });

  it('marks run completed on runFinished event', async () => {
    const { coord, agents, runs, fake } = buildCoordinator();
    const agent = await makeAgent(agents, 'evolution');
    const run = await coord.start({ agentId: agent.id });

    const ref: CheckpointRef = {
      kind: 'flat',
      ref: { id: 'cp-1', brainDnaId: 'brain-1', bytes: 0, generation: 0, createdAt: '' },
    };
    fake.emit(run.id, {
      kind: 'runFinished',
      runId: run.id,
      status: 'completed',
      finishedAt: '2026-01-02T00:00:00Z',
      bestCheckpointRef: ref,
    });

    await Promise.resolve();
    const r = await runs.findById(run.id);
    expect(r?.status).toBe('completed');
    expect(r?.bestCheckpointRef?.kind).toBe('flat');
  });
});
