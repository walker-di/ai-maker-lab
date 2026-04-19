/**
 * Local UI mirror of the training shared types from
 * `packages/domain/src/shared/voxsim/training/`.
 *
 * `packages/ui` cannot depend on `packages/domain`. Domain types satisfy these
 * shapes structurally when passed in from the app layer. Keep both files in
 * sync when fields change.
 */

export type TrainingAlgorithm =
  | 'evolution'
  | 'reinforce'
  | 'ppoLite'
  | 'neat'
  | 'hyperNeat'
  | 'neatLstm';

export type TrainingRunStatus =
  | 'idle'
  | 'starting'
  | 'running'
  | 'paused'
  | 'stopping'
  | 'completed'
  | 'failed';

export type EpisodeKind = 'survived' | 'died' | 'goalReached' | 'timedOut';
export type EpisodeDeathCause = 'tilt' | 'hazard' | 'timeout' | 'manual';

export type EpisodeOutcome =
  | { kind: 'survived' }
  | { kind: 'died'; cause: EpisodeDeathCause }
  | { kind: 'goalReached' }
  | { kind: 'timedOut' };

export interface EpisodeMetricBreakdown {
  forwardVelocity: number;
  uprightness: number;
  energyPenalty: number;
  goalProgress: number;
  survivalTime: number;
  foodEaten: number;
  fallPenalty: number;
}

export interface ReplayChunkRef {
  id: string;
  episodeId: string;
  bytes: Uint8Array;
  frameCount: number;
  sampleStride: number;
}

export interface CheckpointRef {
  id: string;
  brainDnaId: string;
  generation: number;
  score: number;
  createdAt: string;
}

export interface EpisodeSummary {
  id: string;
  runId: string;
  agentId: string;
  bodyDnaId: string;
  brainDnaId: string;
  checkpointRef?: CheckpointRef;
  arenaId: string;
  generation: number;
  candidateIndex: number;
  speciesId?: number;
  seed: number;
  outcome: EpisodeOutcome;
  totalReward: number;
  meanReward: number;
  steps: number;
  replayRef?: ReplayChunkRef;
  metricBreakdown: EpisodeMetricBreakdown;
}

export interface NeatSpeciesSnapshotEntry {
  speciesId: number;
  size: number;
  representativeGenomeId: string;
  bestFitness: number;
  meanFitness: number;
  staleness: number;
}

export interface NeatInnovationConnectionEntry {
  innovation: number;
  sourceNodeId: number;
  targetNodeId: number;
}

export interface NeatInnovationNodeEntry {
  nodeId: number;
  splitConnectionInnovation: number;
}

export type TrainingProgressEvent =
  | {
      kind: 'runStarted';
      runId: string;
      status: TrainingRunStatus;
      startedAt: string;
    }
  | {
      kind: 'generationStarted';
      runId: string;
      generation: number;
      arenaId: string;
    }
  | { kind: 'episodeFinished'; runId: string; episode: EpisodeSummary }
  | {
      kind: 'generationFinished';
      runId: string;
      generation: number;
      aggregateScore: number;
      eliteCheckpointRefs: CheckpointRef[];
    }
  | {
      kind: 'curriculumAdvanced';
      runId: string;
      fromStageIndex: number;
      toStageIndex: number;
    }
  | {
      kind: 'runFinished';
      runId: string;
      status: TrainingRunStatus;
      finishedAt: string;
      bestCheckpointRef: CheckpointRef;
    }
  | {
      kind: 'runFailed';
      runId: string;
      status: TrainingRunStatus;
      reason: string;
    }
  | {
      kind: 'speciesUpdated';
      runId: string;
      generation: number;
      species: NeatSpeciesSnapshotEntry[];
    }
  | {
      kind: 'innovationsAssigned';
      runId: string;
      generation: number;
      addedConnections: NeatInnovationConnectionEntry[];
      addedNodes: NeatInnovationNodeEntry[];
    };

export type TrainingProgressListener = (event: TrainingProgressEvent) => void;
export type Unsubscribe = () => void;

export interface TrainingRunHandle {
  readonly runId: string;
}

export interface TrainerHandle {
  pause(handle: TrainingRunHandle): Promise<void>;
  resume(handle: TrainingRunHandle): Promise<void>;
  stop(handle: TrainingRunHandle): Promise<void>;
  subscribe(
    handle: TrainingRunHandle,
    listener: TrainingProgressListener,
  ): Unsubscribe;
}
