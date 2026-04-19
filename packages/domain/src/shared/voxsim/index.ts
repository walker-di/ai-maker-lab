export type {
  Quat,
  Transform,
  Vec3,
} from './vec.js';
export {
  addVec3,
  applyQuatToVec3,
  crossVec3,
  dotVec3,
  identityQuat,
  identityTransform,
  lengthVec3,
  normalizeVec3,
  quatFromAxisAngle,
  scaleVec3,
  subVec3,
  vec3,
} from './vec.js';

export type {
  VoxelKind,
  VoxelMetadata,
} from './voxel-metadata.js';
export {
  VOXEL_KINDS,
  getVoxelMetadata,
  isSolidVoxel,
  isValidVoxelOrdinal,
  ordinalForVoxelKind,
  voxelKindFromOrdinal,
} from './voxel-metadata.js';

export type {
  Chunk,
  ChunkOrigin,
  ChunkSize,
} from './chunk-types.js';
export {
  chunkIdFor,
  chunkVoxelCount,
  voxelIndex,
} from './chunk-types.js';

export type {
  AgentSpawn,
  EntityKind,
  EntityParamValue,
  EntitySpawn,
} from './entity-types.js';
export { ENTITY_KINDS } from './entity-types.js';

export type {
  ArenaDefinition,
  ArenaMetadata,
  ArenaSource,
  ChunkBounds,
} from './arena-types.js';
export {
  DEFAULT_CHUNK_SIZE,
  DEFAULT_GRAVITY,
  DEFAULT_VOXEL_SIZE,
} from './arena-types.js';

export type {
  ArenaValidationIssue,
  ArenaValidationResult,
} from './validation.js';
export { validateArenaDefinition } from './validation.js';

export type {
  ActuatorEntry,
  ActuatorMap,
  ActuatorMode,
  ActuatorRange,
  BodyDna,
  BodyDnaMetadata,
  BodyDnaValidationIssue,
  BodyDnaValidationResult,
  DeathRule,
  JointSpec,
  LineageRef,
  MotorMode,
  MotorSpec,
  OrganismKind,
  SegmentRotationLimits,
  SegmentShapeSpec,
  SegmentSpec,
  SegmentTranslationLimits,
  SensorKind,
  SensorSpec,
  SixDofMotorAxis,
  SixDofMotorSpecs,
} from './morphology/index.js';
export {
  motorsOf,
  outputWidth,
  validateBodyDna,
} from './morphology/index.js';

export type {
  ActivationKind,
  BrainDna,
  BrainDnaMetadata,
  BrainDnaValidationIssue,
  BrainDnaValidationResult,
  BrainTopology,
  CheckpointKind,
  CheckpointRef,
  CppnActivationKind,
  CppnSubstrate,
  CppnSubstrateLayer,
  InputBinding,
  InputEncoder,
  LayerKind,
  LayerSpec,
  LstmCellState,
  LstmGate,
  NeatActivationKind,
  NeatBrainConfig,
  NeatConnectionGene,
  NeatGenome,
  NeatGenomeValidationIssue,
  NeatGenomeValidationResult,
  NeatNodeGene,
  NeatNodeKind,
  Normalization,
  OutputActivation,
  OutputBinding,
  OutputDecoder,
  SubstrateKind,
  WeightCheckpointRef,
  WeightEntry,
  WeightLayout,
} from './brain/index.js';
export {
  CPPN_ONLY_ACTIVATIONS,
  NEAT_TOPOLOGIES,
  buildWeightLayout,
  countLstmNodes,
  createLstmCellState,
  decoderTotalWidth,
  encoderTotalWidth,
  isNeatTopology,
  layoutTotalLength,
  resetLstmCellState,
  validateBrainDna,
  validateNeatGenome,
} from './brain/index.js';

export type {
  Curriculum,
  CurriculumMetric,
  CurriculumStage,
  CurriculumSuccessCriterion,
  EpisodeDeathCause,
  EpisodeKind,
  EpisodeMetricBreakdown,
  EpisodeOutcome,
  EpisodeSummary,
  MutationRates,
  NeatAlgorithm,
  NeatCppnTrainingOptions,
  NeatCrossoverConfig,
  NeatInnovationConnectionEntry,
  NeatInnovationNodeEntry,
  NeatLstmTrainingOptions,
  NeatMutationRates,
  NeatSpeciationConfig,
  NeatSpeciesSnapshotEntry,
  NeatStructuralMutationSpec,
  NeatSurvivalConfig,
  NeatTrainingConfig,
  OptimizerKind,
  OptimizerSpec,
  ReplayChunkRef,
  ReplayFrame,
  ReplayHeader,
  RewardSpec,
  RewardWeights,
  TrainingAlgorithm,
  TrainingDna,
  TrainingDnaMetadata,
  TrainingDnaValidationIssue,
  TrainingDnaValidationResult,
  TrainingProgressEvent,
  TrainingRunStatus,
} from './training/index.js';
export {
  DEFAULT_REWARD_WEIGHTS,
  NEAT_ALGORITHMS,
  REPLAY_FLOATS_PER_SEGMENT,
  REPLAY_MAGIC,
  REPLAY_VERSION,
  TRAINING_ALGORITHMS,
  emptyMetricBreakdown,
  isGradientAlgorithm,
  isNeatAlgorithm,
  replayBytesPerFrame,
  replayFloatsPerFrame,
  validateTrainingDna,
} from './training/index.js';

export type {
  InspectorActivationFrame,
  InspectorActivationFrameKind,
  InspectorBrainEdge,
  InspectorBrainGraph,
  InspectorBrainNode,
  InspectorChartPoint,
  InspectorChartSeries,
  InspectorMutationDiff,
  InspectorNodeKind,
  InspectorReplayCursor,
  InspectorSpeciesEntry,
  InspectorSpeciesSnapshot,
  MlpActivationFrame,
  MlpEdgeWeightDelta,
  NeatActivationFrame,
  NeatAddedEdgeEntry,
  NeatAddedNodeEntry,
  NeatLstmGateSnapshot,
  NeatToggledEdgeEntry,
  NeatWeightDeltaEntry,
} from './inspector/index.js';
export {
  activationFrameTopology,
  clampFrameIndex,
} from './inspector/index.js';

export type {
  AgentSummary,
  LineageNode,
  ListAgentsFilter,
  ListCheckpointsFilter,
  ListEpisodesFilter,
  ListNeatGenomesFilter,
  ListNeatInnovationsFilter,
  ListNeatSpeciesFilter,
  ListRunsFilter,
  NeatGenomeSummary,
  NeatInnovationLogEntry,
  NeatSpeciesSummary,
  ResolvedArenaEntry,
  TrainingRunSummary,
} from './persistence/index.js';
