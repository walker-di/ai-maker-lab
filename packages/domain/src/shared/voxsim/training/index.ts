export type { Curriculum, CurriculumMetric, CurriculumStage, CurriculumSuccessCriterion } from './curriculum.js';

export type { MutationRates } from './mutation.js';

export type { OptimizerKind, OptimizerSpec } from './optimizer.js';

export type { RewardSpec, RewardWeights } from './reward-spec.js';
export { DEFAULT_REWARD_WEIGHTS } from './reward-spec.js';

export type {
  EpisodeDeathCause,
  EpisodeKind,
  EpisodeMetricBreakdown,
  EpisodeOutcome,
  EpisodeSummary,
} from './episode.js';
export { emptyMetricBreakdown } from './episode.js';

export type {
  ReplayChunkRef,
  ReplayFrame,
  ReplayHeader,
} from './replay.js';
export {
  REPLAY_FLOATS_PER_SEGMENT,
  REPLAY_MAGIC,
  REPLAY_VERSION,
  replayBytesPerFrame,
  replayFloatsPerFrame,
} from './replay.js';

export type { DecodedReplay, ReplayBufferOptions } from './replay-codec.js';
export { ReplayBuffer, decodeReplay } from './replay-codec.js';

export type {
  NeatInnovationConnectionEntry,
  NeatInnovationNodeEntry,
  NeatSpeciesSnapshotEntry,
  TrainingProgressEvent,
  TrainingRunStatus,
} from './progress.js';

export type {
  NeatAlgorithm,
  TrainingAlgorithm,
  TrainingDna,
  TrainingDnaMetadata,
} from './training-dna.js';
export {
  NEAT_ALGORITHMS,
  TRAINING_ALGORITHMS,
  isGradientAlgorithm,
  isNeatAlgorithm,
} from './training-dna.js';

export type {
  NeatCppnTrainingOptions,
  NeatCrossoverConfig,
  NeatLstmTrainingOptions,
  NeatMutationRates,
  NeatSpeciationConfig,
  NeatStructuralMutationSpec,
  NeatSurvivalConfig,
  NeatTrainingConfig,
} from './neat/index.js';

export type {
  TrainingDnaValidationIssue,
  TrainingDnaValidationResult,
} from './validation.js';
export { validateTrainingDna } from './validation.js';
