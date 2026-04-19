/**
 * Service-facing DTOs and list filters consumed by the application use cases
 * defined in plan 07. The HTTP and Electrobun transport layers serialize
 * these shapes; UI page models consume them directly.
 */

import type { ArenaDefinition, ArenaMetadata } from '../arena-types.js';
import type { OrganismKind } from '../morphology/index.js';
import type { CheckpointRef } from '../brain/index.js';
import type {
  EpisodeOutcome,
  TrainingAlgorithm,
  TrainingRunStatus,
} from '../training/index.js';

export interface ResolvedArenaEntry {
  id: string;
  metadata: ArenaMetadata;
  definition: ArenaDefinition;
  source: 'builtin' | 'user';
  builtInId?: string;
  inheritsFromBuiltInId?: string;
  isEditable: boolean;
}

export interface AgentSummary {
  id: string;
  name: string;
  bodyDnaId: string;
  brainDnaId: string;
  trainingDnaId?: string;
  bestCheckpointRefId?: string;
  bestScore?: number;
  generation: number;
  lineageParentAgentId?: string;
  kind: OrganismKind;
  createdAt: string;
  updatedAt: string;
}

export interface LineageNode {
  agentId: string;
  parentAgentId?: string;
  generation: number;
  bestScore?: number;
  mutationSummary?: string;
}

export interface TrainingRunSummary {
  id: string;
  agentId: string;
  trainingDnaId: string;
  algorithm: TrainingAlgorithm;
  arenaCurriculumIds: string[];
  status: TrainingRunStatus;
  startedAt: string;
  finishedAt?: string;
  bestCheckpointRef?: CheckpointRef;
  bestScore?: number;
  totalEpisodes: number;
  totalGenerations: number;
  totalSpeciesEverSeen?: number;
  currentSpeciesCount?: number;
}

export interface NeatGenomeSummary {
  id: string;
  agentId: string;
  runId: string;
  generation: number;
  speciesId: number;
  score?: number;
  nodeCount: number;
  connectionCount: number;
  enabledConnectionCount: number;
  lstmNodeCount: number;
  bytes: number;
  createdAt: string;
}

export interface NeatSpeciesSummary {
  id: number;
  runId: string;
  generation: number;
  size: number;
  bestScore: number;
  meanScore: number;
  representativeGenomeId: string;
  stagnationGenerations: number;
  createdAt: string;
  updatedAt: string;
}

export interface NeatInnovationLogEntry {
  runId: string;
  generation: number;
  addedConnections: { innovation: number; sourceNodeId: number; targetNodeId: number }[];
  addedNodes: { innovation: number; splitConnectionInnovation: number }[];
  createdAt: string;
}

export interface ListAgentsFilter {
  kind?: OrganismKind;
  bodyDnaId?: string;
  lineageRootId?: string;
  since?: string;
  limit?: number;
}

export interface ListEpisodesFilter {
  runId?: string;
  agentId?: string;
  arenaId?: string;
  outcome?: EpisodeOutcome['kind'];
  since?: string;
  limit?: number;
}

export interface ListRunsFilter {
  agentId?: string;
  status?: TrainingRunStatus;
  since?: string;
  limit?: number;
}

export interface ListCheckpointsFilter {
  agentId?: string;
  runId?: string;
  minScore?: number;
  limit?: number;
}

export interface ListNeatGenomesFilter {
  agentId?: string;
  runId?: string;
  speciesId?: number;
  generation?: number;
  minScore?: number;
  limit?: number;
}

export interface ListNeatSpeciesFilter {
  runId: string;
  generation?: number;
  limit?: number;
}

export interface ListNeatInnovationsFilter {
  runId: string;
  sinceGeneration?: number;
  limit?: number;
}
