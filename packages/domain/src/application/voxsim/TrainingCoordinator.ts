/**
 * Application-layer training coordinator. Owns the bridge between
 * `TrainerOrchestrator` (plan 05) and the persistence ports defined in
 * `ports.ts`. The coordinator is the single front door used by the REST/RPC
 * routes to start, pause, resume, stop, and observe training runs.
 */

import type {
  ArenaDefinition,
  CheckpointRef,
  EpisodeSummary,
  TrainingProgressEvent,
  TrainingRunStatus,
  TrainingRunSummary,
} from '../../shared/voxsim/index.js';
import type {
  IAgentRepository,
  IEpisodeRepository,
  INeatGenomeRepository,
  INeatInnovationLogRepository,
  INeatSpeciesRepository,
  IReplayRepository,
  ITrainingRunRepository,
  IWeightCheckpointRepository,
  TrainingRunRecord,
  UpdateTrainingRunFields,
} from './ports.js';
import type {
  CheckpointPayload,
  TrainerStartInput,
  TrainerOrchestrator,
  TrainingRunHandle,
  Unsubscribe,
} from './training/index.js';

export interface StartTrainingRunInput {
  agentId: string;
  arenaCurriculumIds?: string[];
  initialCheckpointRefId?: string;
}

export type ArenaResolver = (id: string) => Promise<ArenaDefinition>;

export interface TrainingCoordinatorOptions {
  orchestrator: TrainerOrchestrator;
  agents: IAgentRepository;
  runs: ITrainingRunRepository;
  episodes: IEpisodeRepository;
  replays: IReplayRepository;
  checkpoints: IWeightCheckpointRepository;
  neatGenomes: INeatGenomeRepository;
  neatSpecies: INeatSpeciesRepository;
  neatInnovations: INeatInnovationLogRepository;
  arenaResolver: ArenaResolver;
  now?: () => string;
  generateRunId?: () => string;
}

interface ActiveRun {
  runId: string;
  agentId: string;
  brainDnaId: string;
  totalEpisodes: number;
  totalGenerations: number;
  bestScore?: number;
  bestCheckpointRef?: CheckpointRef;
  speciesIdsSeen: Set<number>;
  currentSpeciesCount?: number;
  listeners: Set<(e: TrainingProgressEvent) => void>;
  unsubscribe?: Unsubscribe;
}

export class TrainingCoordinator {
  private readonly opts: TrainingCoordinatorOptions;
  private readonly active = new Map<string, ActiveRun>();
  private readonly now: () => string;
  private readonly generateRunId: () => string;

  constructor(options: TrainingCoordinatorOptions) {
    this.opts = options;
    this.now = options.now ?? (() => new Date().toISOString());
    this.generateRunId = options.generateRunId ?? defaultRunId;
  }

  async start(input: StartTrainingRunInput): Promise<TrainingRunSummary> {
    const agent = await this.opts.agents.findById(input.agentId);
    if (!agent) throw new Error(`Agent ${input.agentId} not found`);
    if (!agent.trainingDna) {
      throw new Error(`Agent ${input.agentId} has no trainingDna; cannot start training`);
    }
    const trainingDna = agent.trainingDna;
    const runId = this.generateRunId();
    const startedAt = this.now();

    const created = await this.opts.runs.create({
      agentId: agent.id,
      trainingDnaSnapshot: trainingDna,
      algorithm: trainingDna.algorithm,
      arenaCurriculumIds: input.arenaCurriculumIds ?? [],
      status: 'starting',
      startedAt,
    });

    const brainDnaId = brainDnaIdOf(agent.brainDna);
    const activeRun: ActiveRun = {
      runId: created.id,
      agentId: agent.id,
      brainDnaId,
      totalEpisodes: 0,
      totalGenerations: 0,
      speciesIdsSeen: new Set(),
      listeners: new Set(),
    };
    this.active.set(created.id, activeRun);

    const startInput: TrainerStartInput = {
      runId: created.id,
      bodyDna: agent.bodyDna,
      brainDna: agent.brainDna,
      trainingDna,
      arenaResolver: (arenaId: string) => this.opts.arenaResolver(arenaId),
      onCheckpoint: (ref, payload) => this.persistCheckpoint(activeRun, ref, payload),
      onEpisode: (summary, replay) => this.persistEpisode(activeRun, summary, replay),
      onSpeciesUpdate: (event) => this.persistSpecies(activeRun, event),
      onInnovations: (event) => this.persistInnovations(activeRun, event),
    };

    let handle: TrainingRunHandle;
    try {
      handle = await this.opts.orchestrator.start(startInput);
      activeRun.unsubscribe = this.opts.orchestrator.subscribe(handle, (event) =>
        this.onProgress(activeRun, event),
      );
    } catch (err) {
      await this.opts.runs.updateStatus(created.id, 'failed', { finishedAt: this.now() });
      this.active.delete(created.id);
      throw err;
    }

    const updated = await this.opts.runs.updateStatus(created.id, 'running');
    return toRunSummary(updated, activeRun);
  }

  async pause(runId: string): Promise<TrainingRunSummary> {
    const run = this.requireActive(runId);
    await this.opts.orchestrator.pause({ runId });
    const updated = await this.opts.runs.updateStatus(runId, 'paused');
    return toRunSummary(updated, run);
  }

  async resume(runId: string): Promise<TrainingRunSummary> {
    const run = this.requireActive(runId);
    await this.opts.orchestrator.resume({ runId });
    const updated = await this.opts.runs.updateStatus(runId, 'running');
    return toRunSummary(updated, run);
  }

  async stop(runId: string): Promise<TrainingRunSummary> {
    const run = this.requireActive(runId);
    await this.opts.orchestrator.stop({ runId });
    run.unsubscribe?.();
    const updated = await this.opts.runs.updateStatus(runId, 'stopping', {
      finishedAt: this.now(),
    });
    this.active.delete(runId);
    return toRunSummary(updated, run);
  }

  subscribe(runId: string, listener: (e: TrainingProgressEvent) => void): Unsubscribe {
    const run = this.requireActive(runId);
    run.listeners.add(listener);
    return () => run.listeners.delete(listener);
  }

  // ---------------------------------------------------------------------------
  // internals
  // ---------------------------------------------------------------------------

  private async persistCheckpoint(
    run: ActiveRun,
    ref: CheckpointRef,
    payload: CheckpointPayload,
  ): Promise<void> {
    let newScore: number | undefined;
    if (payload.kind === 'flat' && ref.kind === 'flat') {
      await this.opts.checkpoints.record({
        id: ref.ref.id,
        agentId: run.agentId,
        runId: run.runId,
        brainDnaId: ref.ref.brainDnaId,
        generation: ref.ref.generation ?? 0,
        score: ref.ref.score,
        weights: floatsToBytes(payload.weights),
      });
      newScore = ref.ref.score;
    } else if (payload.kind === 'neatGenome' && ref.kind === 'neatGenome') {
      const genome = payload.genome;
      await this.opts.neatGenomes.record({
        id: ref.genomeId,
        agentId: run.agentId,
        runId: run.runId,
        brainDnaId: ref.brainDnaId,
        generation: ref.generation,
        speciesId: speciesIdFromGenome(genome) ?? 0,
        score: ref.score,
        genome,
      });
      newScore = ref.score;
    } else {
      throw new Error(
        `CheckpointRef.kind '${ref.kind}' does not match payload.kind '${payload.kind}'`,
      );
    }

    if (newScore !== undefined && (run.bestScore === undefined || newScore > run.bestScore)) {
      run.bestScore = newScore;
      run.bestCheckpointRef = ref;
      await this.opts.runs.updateStatus(run.runId, 'running', {
        bestCheckpointRef: ref,
        bestScore: newScore,
      });
    }
  }

  private async persistEpisode(
    run: ActiveRun,
    summary: EpisodeSummary,
    replay?: Uint8Array,
  ): Promise<void> {
    await this.opts.episodes.record(summary);
    if (replay && summary.replayRef) {
      await this.opts.replays.record({
        id: summary.replayRef.id,
        episodeId: summary.id,
        bytes: replay,
        frames: summary.replayRef.frames,
      });
    }
    run.totalEpisodes += 1;
    await this.opts.runs.updateStatus(run.runId, 'running', {
      totalEpisodes: run.totalEpisodes,
    });
  }

  private async persistSpecies(
    run: ActiveRun,
    event: Extract<TrainingProgressEvent, { kind: 'speciesUpdated' }>,
  ): Promise<void> {
    for (const species of event.species) {
      await this.opts.neatSpecies.recordSnapshot({
        runId: run.runId,
        speciesId: species.id,
        generation: event.generation,
        size: species.size,
        bestScore: species.bestScore,
        meanScore: species.meanScore,
        stagnationGenerations: species.stagnation,
        representativeGenomeId: species.representativeGenomeId,
      });
      run.speciesIdsSeen.add(species.id);
    }
    run.currentSpeciesCount = event.species.length;
    await this.opts.runs.updateStatus(run.runId, 'running', {
      currentSpeciesCount: run.currentSpeciesCount,
      totalSpeciesEverSeen: run.speciesIdsSeen.size,
    });
  }

  private async persistInnovations(
    run: ActiveRun,
    event: Extract<TrainingProgressEvent, { kind: 'innovationsAssigned' }>,
  ): Promise<void> {
    await this.opts.neatInnovations.record({
      runId: run.runId,
      generation: event.generation,
      addedConnections: event.addedConnections,
      addedNodes: event.addedNodes,
    });
  }

  private async onProgress(run: ActiveRun, event: TrainingProgressEvent): Promise<void> {
    for (const listener of run.listeners) {
      try {
        listener(event);
      } catch {
        /* ignore listener errors */
      }
    }
    if (event.kind === 'generationFinished') {
      run.totalGenerations = event.generation + 1;
      const fields: UpdateTrainingRunFields = { totalGenerations: run.totalGenerations };
      await this.opts.runs.updateStatus(run.runId, 'running', fields);
    } else if (event.kind === 'runFinished') {
      run.unsubscribe?.();
      await this.opts.runs.updateStatus(run.runId, 'completed', {
        finishedAt: event.finishedAt,
        bestCheckpointRef: event.bestCheckpointRef,
      });
      this.active.delete(run.runId);
    } else if (event.kind === 'runFailed') {
      run.unsubscribe?.();
      await this.opts.runs.updateStatus(run.runId, 'failed', { finishedAt: this.now() });
      this.active.delete(run.runId);
    }
  }

  private requireActive(runId: string): ActiveRun {
    const run = this.active.get(runId);
    if (!run) throw new Error(`No active run for ${runId}`);
    return run;
  }
}

function toRunSummary(record: TrainingRunRecord, active?: ActiveRun): TrainingRunSummary {
  return {
    id: record.id,
    agentId: record.agentId,
    trainingDnaId: dnaIdOf(record.trainingDnaSnapshot),
    algorithm: record.algorithm,
    arenaCurriculumIds: record.arenaCurriculumIds,
    status: record.status,
    startedAt: record.startedAt,
    finishedAt: record.finishedAt,
    bestCheckpointRef: record.bestCheckpointRef,
    bestScore: record.bestScore,
    totalEpisodes: record.totalEpisodes,
    totalGenerations: record.totalGenerations,
    currentSpeciesCount: record.currentSpeciesCount ?? active?.currentSpeciesCount,
    totalSpeciesEverSeen: record.totalSpeciesEverSeen ?? active?.speciesIdsSeen.size,
  };
}

function dnaIdOf(dna: unknown): string {
  if (dna && typeof dna === 'object') {
    const meta = (dna as { metadata?: { id?: string } }).metadata;
    if (meta?.id) return meta.id;
    const id = (dna as { id?: string }).id;
    if (id) return id;
  }
  return 'training:unknown';
}

function speciesIdFromGenome(genome: unknown): number | undefined {
  if (genome && typeof genome === 'object') {
    const v = (genome as { speciesId?: number }).speciesId;
    if (typeof v === 'number') return v;
  }
  return undefined;
}

function brainDnaIdOf(brainDna: unknown): string {
  if (brainDna && typeof brainDna === 'object') {
    const meta = (brainDna as { metadata?: { id?: string } }).metadata;
    if (meta?.id) return meta.id;
  }
  return 'brain:unknown';
}

function floatsToBytes(weights: Float32Array): Uint8Array {
  return new Uint8Array(weights.buffer, weights.byteOffset, weights.byteLength);
}

let runIdCounter = 0;
function defaultRunId(): string {
  runIdCounter += 1;
  return `run-${Date.now()}-${runIdCounter}`;
}
