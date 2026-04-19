/**
 * Training run use cases (v1). Wrap `TrainingCoordinator` and the training
 * repositories so HTTP/RPC controllers don't depend on internals.
 */

import type {
  EpisodeSummary,
  ListEpisodesFilter,
  ListRunsFilter,
  TrainingRunSummary,
} from '../../../shared/voxsim/index.js';
import type { TrainingCoordinator, StartTrainingRunInput } from '../TrainingCoordinator.js';
import type {
  EpisodeRecord,
  IEpisodeRepository,
  ITrainingRunRepository,
  TrainingRunRecord,
} from '../ports.js';

export class StartTrainingRun {
  constructor(private readonly coordinator: TrainingCoordinator) {}
  async execute(input: StartTrainingRunInput): Promise<TrainingRunSummary> {
    return this.coordinator.start(input);
  }
}

export class PauseTrainingRun {
  constructor(private readonly coordinator: TrainingCoordinator) {}
  async execute(runId: string): Promise<TrainingRunSummary> {
    return this.coordinator.pause(runId);
  }
}

export class ResumeTrainingRun {
  constructor(private readonly coordinator: TrainingCoordinator) {}
  async execute(runId: string): Promise<TrainingRunSummary> {
    return this.coordinator.resume(runId);
  }
}

export class StopTrainingRun {
  constructor(private readonly coordinator: TrainingCoordinator) {}
  async execute(runId: string): Promise<TrainingRunSummary> {
    return this.coordinator.stop(runId);
  }
}

export class ListTrainingRuns {
  constructor(private readonly runs: ITrainingRunRepository) {}
  async execute(filter?: ListRunsFilter): Promise<TrainingRunSummary[]> {
    const records = await this.runs.list(filter);
    return records.map(toRunSummary);
  }
}

export class RecordEpisode {
  constructor(private readonly episodes: IEpisodeRepository) {}
  async execute(summary: EpisodeSummary): Promise<EpisodeRecord> {
    return this.episodes.record(summary);
  }
}

export class ListEpisodes {
  constructor(private readonly episodes: IEpisodeRepository) {}
  async execute(filter?: ListEpisodesFilter): Promise<EpisodeRecord[]> {
    return this.episodes.list(filter);
  }
}

function toRunSummary(record: TrainingRunRecord): TrainingRunSummary {
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
    currentSpeciesCount: record.currentSpeciesCount,
    totalSpeciesEverSeen: record.totalSpeciesEverSeen,
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
