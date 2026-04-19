export * as Training from './training/index.js';

export { ArenaCatalogService } from './ArenaCatalogService.js';
export type { ArenaCatalogServiceOptions } from './ArenaCatalogService.js';

export { AgentCatalogService } from './AgentCatalogService.js';
export type {
  AgentCatalogServiceOptions,
  AgentMutationSpec,
  BodyMutationSpec,
  BrainMutationSpec,
  MutateAgentInput,
} from './AgentCatalogService.js';

export * as UseCases from './use-cases/index.js';

export { TrainingCoordinator } from './TrainingCoordinator.js';
export type {
  ArenaResolver,
  StartTrainingRunInput,
  TrainingCoordinatorOptions,
} from './TrainingCoordinator.js';

export type {
  AgentRecord,
  AgentSummary,
  BuiltInArenaEntry,
  CreateAgentInput,
  CreateTrainingRunInput,
  CreateUserArenaInput,
  EpisodeRecord,
  IAgentCatalogService,
  IAgentRepository,
  IArenaCatalogService,
  IArenaValidator,
  IBodyDnaValidator,
  IBrainDnaValidator,
  IBuiltInArenaSource,
  IEpisodeRepository,
  INeatGenomeRepository,
  INeatGenomeValidator,
  INeatInnovationLogRepository,
  INeatSpeciesRepository,
  IReplayRepository,
  ITrainingDnaValidator,
  ITrainingRunRepository,
  IUserArenaRepository,
  IWeightCheckpointRepository,
  InnovationLedgerSnapshot,
  LineageNode,
  LoadedAgent,
  NeatGenomeRecord,
  NeatGenomeSummary,
  NeatInnovationLogRecord,
  NeatSpeciesGenerationEntry,
  NeatSpeciesRecord,
  NeatSpeciesSummary,
  RecordEpisodeInput,
  RecordNeatGenomeInput,
  RecordNeatInnovationLogInput,
  RecordNeatSpeciesSnapshotInput,
  RecordReplayInput,
  RecordWeightCheckpointInput,
  ReplayRecord,
  TrainingRunRecord,
  TrainingRunSummary,
  UpdateAgentPatch,
  UpdateTrainingRunFields,
  UpdateUserArenaPatch,
  UserArenaRecord,
  WeightCheckpointRecord,
} from './ports.js';
