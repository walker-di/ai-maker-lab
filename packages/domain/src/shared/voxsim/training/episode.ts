/**
 * Episode-level outcome and summary records produced by `TrainingWorker` and
 * persisted by the application layer.
 */

import type { CheckpointRef } from '../brain/index.js';
import type { ReplayChunkRef } from './replay.js';

export type EpisodeKind = 'survived' | 'died' | 'goalReached' | 'timedOut';

export type EpisodeDeathCause = 'tilt' | 'hazard' | 'timeout' | 'manual';

export interface EpisodeOutcome {
  kind: EpisodeKind;
  deathCause?: EpisodeDeathCause;
}

export interface EpisodeMetricBreakdown {
  forwardVelocity: number;
  uprightness: number;
  energyPenalty: number;
  goalProgress: number;
  survivalTime: number;
  foodEaten: number;
  fallPenalty: number;
}

export function emptyMetricBreakdown(): EpisodeMetricBreakdown {
  return {
    forwardVelocity: 0,
    uprightness: 0,
    energyPenalty: 0,
    goalProgress: 0,
    survivalTime: 0,
    foodEaten: 0,
    fallPenalty: 0,
  };
}

export interface EpisodeSummary {
  id: string;
  runId: string;
  agentId: string;
  bodyDnaId: string;
  brainDnaId: string;
  /** Discriminated pointer; both `flat` and `neatGenome` kinds are supported. */
  checkpointRef?: CheckpointRef;
  arenaId: string;
  generation: number;
  candidateIndex: number;
  /** Only set on NEAT runs. */
  speciesId?: number;
  seed: number;
  outcome: EpisodeOutcome;
  totalReward: number;
  meanReward: number;
  steps: number;
  replayRef?: ReplayChunkRef;
  metricBreakdown: EpisodeMetricBreakdown;
}
