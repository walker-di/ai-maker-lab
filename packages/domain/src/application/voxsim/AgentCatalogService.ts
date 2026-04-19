/**
 * Application service that wraps `IAgentRepository` with summary mapping into
 * `AgentSummary` for the catalog list views, and provides a `loadAgent` helper
 * that returns the full DNA triple plus a `mutate` helper that clones an agent
 * and records lineage. v1 mutation only records the requested change in
 * `mutationSummary`; structural NEAT mutations are persisted by the training
 * coordinator's NEAT genome repository (plan 07 step 8).
 */

import type {
  AgentSummary,
  ListAgentsFilter,
} from '../../shared/voxsim/index.js';
import type { NeatStructuralMutationSpec } from '../../shared/voxsim/training/neat/index.js';
import type {
  AgentRecord,
  IAgentCatalogService,
  IAgentRepository,
  IWeightCheckpointRepository,
  LoadedAgent,
} from './ports.js';

export type BodyMutationSpec =
  | { kind: 'tweakSegment'; segmentIndex: number; field: 'mass' | 'length'; delta: number }
  | { kind: 'addSegment' }
  | { kind: 'removeSegment'; segmentIndex: number };

export type BrainMutationSpec =
  | { kind: 'resizeLayer'; layerIndex: number; units: number }
  | { kind: 'changeActivation'; layerIndex: number; activation: string };

export type AgentMutationSpec =
  | ({ kind: 'body'; spec: BodyMutationSpec })
  | ({ kind: 'brain'; spec: BrainMutationSpec })
  | ({ kind: 'neatStructural'; spec: NeatStructuralMutationSpec });

export interface MutateAgentInput {
  id: string;
  name?: string;
  mutation: AgentMutationSpec;
}

export interface AgentCatalogServiceOptions {
  agents: IAgentRepository;
  /** Optional checkpoint repository for joining best-checkpoint info into summaries. */
  checkpoints?: IWeightCheckpointRepository;
}

export class AgentCatalogService implements IAgentCatalogService {
  private readonly agents: IAgentRepository;
  private readonly checkpoints?: IWeightCheckpointRepository;

  constructor(options: AgentCatalogServiceOptions) {
    this.agents = options.agents;
    this.checkpoints = options.checkpoints;
  }

  async listSummaries(filter?: ListAgentsFilter): Promise<AgentSummary[]> {
    const records = await this.agents.list(filter);
    return records.map(toSummary);
  }

  async loadAgent(id: string): Promise<LoadedAgent | undefined> {
    const record = await this.agents.findById(id);
    if (!record) return undefined;
    return {
      summary: toSummary(record),
      bodyDna: record.bodyDna,
      brainDna: record.brainDna,
      trainingDna: record.trainingDna,
    };
  }

  async mutate(input: MutateAgentInput): Promise<AgentSummary> {
    const parent = await this.agents.findById(input.id);
    if (!parent) throw new Error(`Agent ${input.id} not found`);

    const child = await this.agents.create({
      name: input.name ?? `${parent.name} (mutated)`,
      kind: parent.kind,
      bodyDna: cloneJson(parent.bodyDna),
      brainDna: cloneJson(parent.brainDna),
      trainingDna: parent.trainingDna ? cloneJson(parent.trainingDna) : undefined,
      lineageParentAgentId: parent.id,
      generation: parent.generation + 1,
      mutationSummary: summarizeMutation(input.mutation),
    });
    return toSummary(child);
  }
}

function toSummary(record: AgentRecord): AgentSummary {
  return {
    id: record.id,
    name: record.name,
    bodyDnaId: dnaIdOf(record.bodyDna, 'body'),
    brainDnaId: dnaIdOf(record.brainDna, 'brain'),
    trainingDnaId: record.trainingDna ? dnaIdOf(record.trainingDna, 'training') : undefined,
    bestCheckpointRefId: record.bestCheckpointRefId,
    bestScore: record.bestScore,
    generation: record.generation,
    lineageParentAgentId: record.lineageParentAgentId,
    kind: record.kind,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function dnaIdOf(dna: unknown, fallbackPrefix: string): string {
  if (dna && typeof dna === 'object') {
    const meta = (dna as { metadata?: { id?: string } }).metadata;
    if (meta?.id) return meta.id;
    const id = (dna as { id?: string }).id;
    if (id) return id;
  }
  return `${fallbackPrefix}:unknown`;
}

function summarizeMutation(mutation: AgentMutationSpec): string {
  switch (mutation.kind) {
    case 'body':
      return `body:${mutation.spec.kind}`;
    case 'brain':
      return `brain:${mutation.spec.kind}`;
    case 'neatStructural':
      return `neat:${mutation.spec.kind}`;
  }
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
