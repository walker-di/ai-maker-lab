/**
 * Application-layer ports for the voxsim subdomain. These interfaces define
 * the boundary between the use cases / services in `packages/domain/src/application/voxsim`
 * and the concrete repositories, validators, and worker hosts.
 */

import type {
  AgentSummary,
  ArenaDefinition,
  ArenaMetadata,
  ArenaValidationResult,
  BodyDna,
  BodyDnaValidationResult,
  BrainDna,
  BrainDnaValidationResult,
  CheckpointRef,
  EpisodeSummary,
  LineageNode,
  ListAgentsFilter,
  ListCheckpointsFilter,
  ListEpisodesFilter,
  ListNeatGenomesFilter,
  ListNeatInnovationsFilter,
  ListNeatSpeciesFilter,
  ListRunsFilter,
  NeatGenome,
  NeatGenomeSummary,
  NeatGenomeValidationResult,
  NeatInnovationLogEntry,
  NeatSpeciesSummary,
  OrganismKind,
  TrainingDna,
  TrainingDnaValidationResult,
  TrainingRunStatus,
  TrainingRunSummary,
} from '../../shared/voxsim/index.js';

// -----------------------------------------------------------------------------
// Built-in arena source
// -----------------------------------------------------------------------------

export interface BuiltInArenaEntry {
  id: string;
  metadata: ArenaMetadata;
  definition: ArenaDefinition;
}

export interface IBuiltInArenaSource {
  listArenas(): Promise<BuiltInArenaEntry[]>;
  findArena(id: string): Promise<BuiltInArenaEntry | undefined>;
}

// -----------------------------------------------------------------------------
// User arenas
// -----------------------------------------------------------------------------

export interface UserArenaRecord {
  id: string;
  metadata: ArenaMetadata;
  definition: ArenaDefinition;
  inheritsFromBuiltInId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserArenaInput {
  metadata: ArenaMetadata;
  definition: ArenaDefinition;
  inheritsFromBuiltInId?: string;
}

export interface UpdateUserArenaPatch {
  metadata?: ArenaMetadata;
  definition?: ArenaDefinition;
}

export interface IUserArenaRepository {
  list(): Promise<UserArenaRecord[]>;
  findById(id: string): Promise<UserArenaRecord | undefined>;
  create(input: CreateUserArenaInput): Promise<UserArenaRecord>;
  update(id: string, patch: UpdateUserArenaPatch): Promise<UserArenaRecord>;
  delete(id: string): Promise<void>;
}

// -----------------------------------------------------------------------------
// Agents
// -----------------------------------------------------------------------------

export interface AgentRecord {
  id: string;
  name: string;
  kind: OrganismKind;
  bodyDna: BodyDna;
  brainDna: BrainDna;
  trainingDna?: TrainingDna;
  lineageParentAgentId?: string;
  generation: number;
  mutationSummary?: string;
  bestCheckpointRefId?: string;
  bestScore?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAgentInput {
  name: string;
  kind: OrganismKind;
  bodyDna: BodyDna;
  brainDna: BrainDna;
  trainingDna?: TrainingDna;
  lineageParentAgentId?: string;
  generation?: number;
  mutationSummary?: string;
}

export interface UpdateAgentPatch {
  name?: string;
  bodyDna?: BodyDna;
  brainDna?: BrainDna;
  trainingDna?: TrainingDna;
  bestCheckpointRefId?: string;
  bestScore?: number;
}

export interface IAgentRepository {
  list(filter?: ListAgentsFilter): Promise<AgentRecord[]>;
  findById(id: string): Promise<AgentRecord | undefined>;
  create(input: CreateAgentInput): Promise<AgentRecord>;
  update(id: string, patch: UpdateAgentPatch): Promise<AgentRecord>;
  delete(id: string): Promise<void>;
  listLineage(rootAgentId: string): Promise<LineageNode[]>;
}

// -----------------------------------------------------------------------------
// Training runs
// -----------------------------------------------------------------------------

export interface InnovationLedgerSnapshot {
  nextNodeId: number;
  nextInnovation: number;
  connectionInnovations: { sourceNodeId: number; targetNodeId: number; innovation: number }[];
  nodeInnovations: { splitConnectionInnovation: number; innovation: number }[];
}

export interface TrainingRunRecord {
  id: string;
  agentId: string;
  trainingDnaSnapshot: TrainingDna;
  algorithm: TrainingRunSummary['algorithm'];
  arenaCurriculumIds: string[];
  status: TrainingRunStatus;
  startedAt: string;
  finishedAt?: string;
  bestCheckpointRef?: CheckpointRef;
  bestScore?: number;
  totalEpisodes: number;
  totalGenerations: number;
  currentSpeciesCount?: number;
  totalSpeciesEverSeen?: number;
  innovationLedgerSnapshot?: InnovationLedgerSnapshot;
}

export interface CreateTrainingRunInput {
  agentId: string;
  trainingDnaSnapshot: TrainingDna;
  algorithm: TrainingRunSummary['algorithm'];
  arenaCurriculumIds: string[];
  status: TrainingRunStatus;
  startedAt: string;
}

export interface UpdateTrainingRunFields {
  bestCheckpointRef?: CheckpointRef;
  bestScore?: number;
  totalEpisodes?: number;
  totalGenerations?: number;
  currentSpeciesCount?: number;
  totalSpeciesEverSeen?: number;
  finishedAt?: string;
  innovationLedgerSnapshot?: InnovationLedgerSnapshot;
}

export interface ITrainingRunRepository {
  list(filter?: ListRunsFilter): Promise<TrainingRunRecord[]>;
  findById(id: string): Promise<TrainingRunRecord | undefined>;
  create(input: CreateTrainingRunInput): Promise<TrainingRunRecord>;
  updateStatus(
    id: string,
    status: TrainingRunStatus,
    fields?: UpdateTrainingRunFields,
  ): Promise<TrainingRunRecord>;
}

// -----------------------------------------------------------------------------
// Episodes
// -----------------------------------------------------------------------------

export interface EpisodeRecord extends EpisodeSummary {
  createdAt: string;
}

export interface RecordEpisodeInput extends EpisodeSummary {}

export interface IEpisodeRepository {
  list(filter?: ListEpisodesFilter): Promise<EpisodeRecord[]>;
  record(input: RecordEpisodeInput): Promise<EpisodeRecord>;
}

// -----------------------------------------------------------------------------
// Replays
// -----------------------------------------------------------------------------

export interface ReplayRecord {
  id: string;
  episodeId: string;
  bytes: Uint8Array;
  frames: number;
  createdAt: string;
}

export interface RecordReplayInput {
  id?: string;
  episodeId: string;
  bytes: Uint8Array;
  frames: number;
}

export interface IReplayRepository {
  findById(id: string): Promise<ReplayRecord | undefined>;
  record(input: RecordReplayInput): Promise<ReplayRecord>;
}

// -----------------------------------------------------------------------------
// Weight checkpoints (fixed-topology)
// -----------------------------------------------------------------------------

export interface WeightCheckpointRecord {
  id: string;
  agentId: string;
  runId?: string;
  brainDnaId: string;
  generation: number;
  score?: number;
  weights: Uint8Array;
  createdAt: string;
}

export interface RecordWeightCheckpointInput {
  id?: string;
  agentId: string;
  runId?: string;
  brainDnaId: string;
  generation: number;
  score?: number;
  weights: Uint8Array;
}

export interface IWeightCheckpointRepository {
  list(filter?: ListCheckpointsFilter): Promise<WeightCheckpointRecord[]>;
  findById(id: string): Promise<WeightCheckpointRecord | undefined>;
  record(input: RecordWeightCheckpointInput): Promise<WeightCheckpointRecord>;
}

// -----------------------------------------------------------------------------
// NEAT genomes
// -----------------------------------------------------------------------------

export interface NeatGenomeRecord {
  id: string;
  agentId: string;
  runId: string;
  brainDnaId: string;
  generation: number;
  speciesId: number;
  score?: number;
  scoreHistory?: { generation: number; score: number }[];
  nodeCount: number;
  connectionCount: number;
  enabledConnectionCount: number;
  lstmNodeCount: number;
  genome: NeatGenome;
  bytes: number;
  createdAt: string;
}

export interface RecordNeatGenomeInput {
  id?: string;
  agentId: string;
  runId: string;
  brainDnaId: string;
  generation: number;
  speciesId: number;
  score?: number;
  scoreHistory?: { generation: number; score: number }[];
  genome: NeatGenome;
}

export interface INeatGenomeRepository {
  record(input: RecordNeatGenomeInput): Promise<NeatGenomeRecord>;
  findById(id: string): Promise<NeatGenomeRecord | undefined>;
  list(filter?: ListNeatGenomesFilter): Promise<NeatGenomeRecord[]>;
}

// -----------------------------------------------------------------------------
// NEAT species
// -----------------------------------------------------------------------------

export interface NeatSpeciesGenerationEntry {
  generation: number;
  size: number;
  bestScore: number;
  meanScore: number;
  stagnation: number;
  representativeGenomeId: string;
}

export interface NeatSpeciesRecord {
  id: string;
  runId: string;
  speciesId: number;
  latestGeneration: number;
  latestSize: number;
  latestBestScore: number;
  latestMeanScore: number;
  latestStagnationGenerations: number;
  representativeGenomeId: string;
  generationHistory: NeatSpeciesGenerationEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface RecordNeatSpeciesSnapshotInput {
  runId: string;
  speciesId: number;
  generation: number;
  size: number;
  bestScore: number;
  meanScore: number;
  stagnationGenerations: number;
  representativeGenomeId: string;
}

export interface INeatSpeciesRepository {
  recordSnapshot(input: RecordNeatSpeciesSnapshotInput): Promise<NeatSpeciesRecord>;
  list(filter: ListNeatSpeciesFilter): Promise<NeatSpeciesRecord[]>;
}

// -----------------------------------------------------------------------------
// NEAT innovation log
// -----------------------------------------------------------------------------

export interface NeatInnovationLogRecord extends NeatInnovationLogEntry {
  id: string;
}

export interface RecordNeatInnovationLogInput {
  runId: string;
  generation: number;
  addedConnections: NeatInnovationLogEntry['addedConnections'];
  addedNodes: NeatInnovationLogEntry['addedNodes'];
}

export interface INeatInnovationLogRepository {
  record(input: RecordNeatInnovationLogInput): Promise<NeatInnovationLogRecord>;
  list(filter: ListNeatInnovationsFilter): Promise<NeatInnovationLogRecord[]>;
}

// -----------------------------------------------------------------------------
// Validators
// -----------------------------------------------------------------------------

export interface IArenaValidator {
  validate(arena: ArenaDefinition): ArenaValidationResult;
}

export interface IBodyDnaValidator {
  validate(dna: BodyDna): BodyDnaValidationResult;
}

export interface IBrainDnaValidator {
  validate(dna: BrainDna, body: BodyDna): BrainDnaValidationResult;
}

export interface ITrainingDnaValidator {
  validate(dna: TrainingDna): TrainingDnaValidationResult;
}

export interface INeatGenomeValidator {
  validate(genome: NeatGenome, brain: BrainDna): NeatGenomeValidationResult;
}

// -----------------------------------------------------------------------------
// Catalog services (interfaces)
// -----------------------------------------------------------------------------

export interface IArenaCatalogService {
  listResolved(): Promise<import('../../shared/voxsim/index.js').ResolvedArenaEntry[]>;
  loadResolved(
    id: string,
  ): Promise<import('../../shared/voxsim/index.js').ResolvedArenaEntry | undefined>;
}

export interface LoadedAgent {
  summary: AgentSummary;
  bodyDna: BodyDna;
  brainDna: BrainDna;
  trainingDna?: TrainingDna;
}

export interface IAgentCatalogService {
  listSummaries(filter?: ListAgentsFilter): Promise<AgentSummary[]>;
  loadAgent(id: string): Promise<LoadedAgent | undefined>;
}

// -----------------------------------------------------------------------------
// NEAT and helper re-exports for downstream summaries
// -----------------------------------------------------------------------------

export type {
  AgentSummary,
  LineageNode,
  NeatGenomeSummary,
  NeatSpeciesSummary,
  TrainingRunSummary,
};
