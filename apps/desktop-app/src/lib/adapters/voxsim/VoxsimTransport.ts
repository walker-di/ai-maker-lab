import type { Voxsim } from 'domain/shared';

type ResolvedArenaEntry = Voxsim.ResolvedArenaEntry;
type ArenaMetadata = Voxsim.ArenaMetadata;
type ArenaDefinition = Voxsim.ArenaDefinition;
type AgentSummary = Voxsim.AgentSummary;
type LineageNode = Voxsim.LineageNode;
type BodyDna = Voxsim.BodyDna;
type BrainDna = Voxsim.BrainDna;
type TrainingDna = Voxsim.TrainingDna;
type EpisodeSummary = Voxsim.EpisodeSummary;
type TrainingRunSummary = Voxsim.TrainingRunSummary;
type ListAgentsFilter = Voxsim.ListAgentsFilter;
type ListEpisodesFilter = Voxsim.ListEpisodesFilter;
type ListRunsFilter = Voxsim.ListRunsFilter;
type ListCheckpointsFilter = Voxsim.ListCheckpointsFilter;
type ListNeatGenomesFilter = Voxsim.ListNeatGenomesFilter;
type ListNeatSpeciesFilter = Voxsim.ListNeatSpeciesFilter;
type ListNeatInnovationsFilter = Voxsim.ListNeatInnovationsFilter;
type NeatGenome = Voxsim.NeatGenome;
type NeatGenomeSummary = Voxsim.NeatGenomeSummary;
type NeatSpeciesSummary = Voxsim.NeatSpeciesSummary;
type NeatInnovationLogEntry = Voxsim.NeatInnovationLogEntry;
type CheckpointRef = Voxsim.CheckpointRef;
type OrganismKind = Voxsim.OrganismKind;
type TrainingAlgorithm = Voxsim.TrainingAlgorithm;

export type VoxsimRuntimeMode = 'desktop' | 'web';

export interface SaveUserArenaInput {
  metadata: ArenaMetadata;
  definition: ArenaDefinition;
  inheritsFromBuiltInId?: string;
}

export interface UpdateUserArenaInput {
  id: string;
  metadata?: ArenaMetadata;
  definition?: ArenaDefinition;
}

export interface DuplicateBuiltInArenaInput {
  builtInId: string;
  metadata: Partial<ArenaMetadata> & { author?: string };
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

export interface UpdateAgentDnaInput {
  id: string;
  bodyDna?: BodyDna;
  brainDna?: BrainDna;
  trainingDna?: TrainingDna;
  name?: string;
}

export interface MutateAgentInput {
  id: string;
  mutation:
    | { kind: 'body'; spec: { kind: string } }
    | { kind: 'brain'; spec: { kind: string } }
    | { kind: 'neatStructural'; spec: { kind: string; connectionInnovation?: number } };
}

export interface AgentDetail {
  summary: AgentSummary;
  bodyDna: BodyDna;
  brainDna: BrainDna;
  trainingDna?: TrainingDna;
}

export interface StartTrainingRunInput {
  agentId: string;
  algorithm: TrainingAlgorithm;
  arenaCurriculumIds: string[];
  trainingDnaSnapshot: TrainingDna;
}

export interface RecordEpisodeInput extends EpisodeSummary {}

export interface RecordReplayInput {
  id?: string;
  episodeId: string;
  bytes: Uint8Array;
  frames: number;
}

export interface ReplayDetail {
  id: string;
  episodeId: string;
  frames: number;
  bytes: Uint8Array;
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

export interface WeightCheckpointDetail {
  id: string;
  agentId: string;
  runId?: string;
  brainDnaId: string;
  generation: number;
  score?: number;
  weights: Uint8Array;
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

export interface NeatGenomeDetail {
  summary: NeatGenomeSummary;
  genome: NeatGenome;
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

export interface RecordNeatInnovationLogInput {
  runId: string;
  generation: number;
  addedConnections: NeatInnovationLogEntry['addedConnections'];
  addedNodes: NeatInnovationLogEntry['addedNodes'];
}

export interface VoxsimTransport {
  // Arenas
  listArenas(): Promise<ResolvedArenaEntry[]>;
  getArena(id: string): Promise<ResolvedArenaEntry | null>;
  saveUserArena(input: SaveUserArenaInput): Promise<ResolvedArenaEntry>;
  updateUserArena(input: UpdateUserArenaInput): Promise<ResolvedArenaEntry>;
  deleteUserArena(id: string): Promise<void>;
  duplicateBuiltInArena(input: DuplicateBuiltInArenaInput): Promise<ResolvedArenaEntry>;

  // Agents
  listAgents(filter?: ListAgentsFilter): Promise<AgentSummary[]>;
  getAgent(id: string): Promise<AgentDetail | null>;
  createAgent(input: CreateAgentInput): Promise<AgentSummary>;
  updateAgentDna(input: UpdateAgentDnaInput): Promise<AgentSummary>;
  mutateAgent(input: MutateAgentInput): Promise<AgentSummary>;
  deleteAgent(id: string): Promise<void>;
  listLineage(rootAgentId: string): Promise<LineageNode[]>;

  // Training runs
  listTrainingRuns(filter?: ListRunsFilter): Promise<TrainingRunSummary[]>;
  startTrainingRun(input: StartTrainingRunInput): Promise<TrainingRunSummary>;
  pauseTrainingRun(runId: string): Promise<TrainingRunSummary>;
  resumeTrainingRun(runId: string): Promise<TrainingRunSummary>;
  stopTrainingRun(runId: string): Promise<TrainingRunSummary>;

  // Episodes
  listEpisodes(filter?: ListEpisodesFilter): Promise<EpisodeSummary[]>;
  recordEpisode(input: RecordEpisodeInput): Promise<EpisodeSummary>;

  // Replays
  loadReplay(id: string): Promise<ReplayDetail | null>;
  recordReplay(input: RecordReplayInput): Promise<ReplayDetail>;

  // Checkpoints
  listCheckpoints(filter?: ListCheckpointsFilter): Promise<WeightCheckpointDetail[]>;
  loadCheckpoint(id: string): Promise<WeightCheckpointDetail | null>;
  saveCheckpoint(input: RecordWeightCheckpointInput): Promise<WeightCheckpointDetail>;

  // NEAT
  listNeatGenomes(filter?: ListNeatGenomesFilter): Promise<NeatGenomeSummary[]>;
  loadNeatGenome(id: string): Promise<NeatGenomeDetail | null>;
  recordNeatGenome(input: RecordNeatGenomeInput): Promise<NeatGenomeSummary>;
  listNeatSpecies(filter: ListNeatSpeciesFilter): Promise<NeatSpeciesSummary[]>;
  recordNeatSpeciesSnapshot(input: RecordNeatSpeciesSnapshotInput): Promise<NeatSpeciesSummary>;
  listNeatInnovations(filter: ListNeatInnovationsFilter): Promise<NeatInnovationLogEntry[]>;
  recordNeatInnovations(input: RecordNeatInnovationLogInput): Promise<NeatInnovationLogEntry>;
}

export type {
  CheckpointRef,
  TrainingAlgorithm,
  OrganismKind,
};
