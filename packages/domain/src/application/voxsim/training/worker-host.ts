/**
 * Worker host abstraction. The orchestrator never imports `worker_threads`
 * directly; it always goes through a `WorkerHostFactory` so tests can inject
 * an in-process fake.
 */

import type {
  ArenaDefinition,
  BodyDna,
  BrainDna,
  EpisodeSummary,
  RewardSpec,
} from '../../../shared/voxsim/index.js';
import type { NeatGenome } from '../../../shared/voxsim/brain/index.js';

export interface TrainingWorkerInit {
  bodyDna: BodyDna;
  brainDna: BrainDna;
  arena: ArenaDefinition;
  reward: RewardSpec;
  /** Default `2`. `0` disables replay capture. */
  replaySampleStride: number;
  /** Master worker seed; per-episode seeds are derived from this. */
  seed: number;
}

export type WorkerPolicyPayload =
  | { kind: 'flat'; weights: Float32Array }
  | { kind: 'neatGenome'; genome: NeatGenome };

export interface TrainingWorkerEvaluate {
  runId: string;
  generation: number;
  candidateIndex: number;
  policy: WorkerPolicyPayload;
  episodesPerCandidate: number;
  episodeSteps: number;
}

export interface TrainingWorkerEpisodeResult {
  summary: EpisodeSummary;
  replay?: Uint8Array;
}

export interface TrainingWorkerEvaluateResult {
  episodes: TrainingWorkerEpisodeResult[];
}

export interface WorkerHost {
  init(input: TrainingWorkerInit): Promise<void>;
  evaluate(input: TrainingWorkerEvaluate): Promise<TrainingWorkerEvaluateResult>;
  dispose(): Promise<void>;
}

export interface WorkerHostFactory {
  create(): WorkerHost;
}
