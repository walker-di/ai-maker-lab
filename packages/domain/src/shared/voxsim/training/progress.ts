/**
 * Progress events emitted by `TrainerOrchestrator` to the application layer.
 */

import type { CheckpointRef } from '../brain/index.js';
import type { EpisodeSummary } from './episode.js';

export type TrainingRunStatus =
  | 'idle'
  | 'starting'
  | 'running'
  | 'paused'
  | 'stopping'
  | 'completed'
  | 'failed';

export interface NeatSpeciesSnapshotEntry {
  id: number;
  size: number;
  bestScore: number;
  meanScore: number;
  stagnation: number;
  representativeGenomeId: string;
}

export interface NeatInnovationConnectionEntry {
  innovation: number;
  sourceNodeId: number;
  targetNodeId: number;
}

export interface NeatInnovationNodeEntry {
  innovation: number;
  splitConnectionInnovation: number;
}

export type TrainingProgressEvent =
  | { kind: 'runStarted'; runId: string; status: TrainingRunStatus; startedAt: string }
  | { kind: 'generationStarted'; runId: string; generation: number; arenaId: string }
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
  | { kind: 'runFailed'; runId: string; status: TrainingRunStatus; reason: string }
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
