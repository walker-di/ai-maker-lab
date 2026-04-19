/**
 * Trainer interface and supporting types. Every trainer (`EvolutionTrainer`,
 * `ReinforceTrainer`, `PpoLiteTrainer`, `NeatTrainer`) implements this so the
 * orchestrator can drive any algorithm uniformly.
 */

import type {
  ArenaDefinition,
  BodyDna,
  BrainDna,
  CheckpointRef,
  EpisodeSummary,
  TrainingAlgorithm,
  TrainingDna,
  TrainingProgressEvent,
} from '../../../shared/voxsim/index.js';
import type { NeatGenome } from '../../../shared/voxsim/brain/index.js';

export type TrainingRunHandle = {
  readonly runId: string;
};

export type CheckpointPayload =
  | { kind: 'flat'; weights: Float32Array }
  | { kind: 'neatGenome'; genome: NeatGenome };

export type CheckpointPersistFn = (
  ref: CheckpointRef,
  payload: CheckpointPayload,
) => Promise<void>;

export type EpisodePersistFn = (
  summary: EpisodeSummary,
  replay?: Uint8Array,
) => Promise<void>;

export type SpeciesPersistFn = (
  event: Extract<TrainingProgressEvent, { kind: 'speciesUpdated' }>,
) => Promise<void>;

export type InnovationPersistFn = (
  event: Extract<TrainingProgressEvent, { kind: 'innovationsAssigned' }>,
) => Promise<void>;

export type ArenaResolver = (arenaId: string) => Promise<ArenaDefinition>;

export interface TrainerStartInput {
  runId: string;
  bodyDna: BodyDna;
  brainDna: BrainDna;
  trainingDna: TrainingDna;
  initialWeights?: Float32Array;
  initialGenomes?: NeatGenome[];
  arenaResolver: ArenaResolver;
  onCheckpoint: CheckpointPersistFn;
  onEpisode: EpisodePersistFn;
  onSpeciesUpdate?: SpeciesPersistFn;
  onInnovations?: InnovationPersistFn;
}

export type TrainingProgressListener = (event: TrainingProgressEvent) => void;
export type Unsubscribe = () => void;

export interface ITrainer {
  readonly id: string;
  readonly kind: TrainingAlgorithm;
  start(input: TrainerStartInput): Promise<TrainingRunHandle>;
  pause(handle: TrainingRunHandle): Promise<void>;
  resume(handle: TrainingRunHandle): Promise<void>;
  stop(handle: TrainingRunHandle): Promise<void>;
  subscribe(handle: TrainingRunHandle, listener: TrainingProgressListener): Unsubscribe;
}
