/**
 * Agent use cases (v1). Wrap `AgentCatalogService` and `IAgentRepository` for
 * controllers and tests. DNA validation is delegated to optional validators
 * provided via DI; the runtime composition wires the shared validators.
 */

import type {
  AgentSummary,
  BodyDna,
  BrainDna,
  LineageNode,
  ListAgentsFilter,
  OrganismKind,
  TrainingDna,
} from '../../../shared/voxsim/index.js';
import type {
  AgentCatalogService,
  AgentMutationSpec,
} from '../AgentCatalogService.js';
import type {
  IAgentRepository,
  IBodyDnaValidator,
  IBrainDnaValidator,
  ITrainingDnaValidator,
  LoadedAgent,
} from '../ports.js';

export interface CreateAgentRequest {
  name: string;
  kind: OrganismKind;
  bodyDna: BodyDna;
  brainDna: BrainDna;
  trainingDna?: TrainingDna;
}

export class CreateAgent {
  constructor(
    private readonly agents: IAgentRepository,
    private readonly bodyValidator?: IBodyDnaValidator,
    private readonly brainValidator?: IBrainDnaValidator,
    private readonly trainingValidator?: ITrainingDnaValidator,
  ) {}

  async execute(input: CreateAgentRequest): Promise<AgentSummary> {
    if (this.bodyValidator) {
      const r = this.bodyValidator.validate(input.bodyDna);
      if (!r.ok) throw new Error(`bodyDna invalid: ${JSON.stringify(r.errors)}`);
    }
    if (this.brainValidator) {
      const r = this.brainValidator.validate(input.brainDna, input.bodyDna);
      if (!r.ok) throw new Error(`brainDna invalid: ${JSON.stringify(r.issues)}`);
    }
    if (this.trainingValidator && input.trainingDna) {
      const r = this.trainingValidator.validate(input.trainingDna);
      if (!r.valid) throw new Error(`trainingDna invalid: ${JSON.stringify(r.issues)}`);
    }
    const record = await this.agents.create({
      name: input.name,
      kind: input.kind,
      bodyDna: input.bodyDna,
      brainDna: input.brainDna,
      trainingDna: input.trainingDna,
      generation: 0,
    });
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
}

export interface UpdateAgentDnaRequest {
  id: string;
  name?: string;
  bodyDna?: BodyDna;
  brainDna?: BrainDna;
  trainingDna?: TrainingDna;
}

export class UpdateAgentDna {
  constructor(private readonly agents: IAgentRepository) {}
  async execute(input: UpdateAgentDnaRequest): Promise<void> {
    await this.agents.update(input.id, {
      name: input.name,
      bodyDna: input.bodyDna,
      brainDna: input.brainDna,
      trainingDna: input.trainingDna,
    });
  }
}

export class MutateAgent {
  constructor(private readonly catalog: AgentCatalogService) {}
  async execute(input: { id: string; mutation: AgentMutationSpec; name?: string }): Promise<AgentSummary> {
    return this.catalog.mutate(input);
  }
}

export class ListAgents {
  constructor(private readonly catalog: AgentCatalogService) {}
  async execute(filter?: ListAgentsFilter): Promise<AgentSummary[]> {
    return this.catalog.listSummaries(filter);
  }
}

export class LoadAgent {
  constructor(private readonly catalog: AgentCatalogService) {}
  async execute(id: string): Promise<LoadedAgent | undefined> {
    return this.catalog.loadAgent(id);
  }
}

export class DeleteAgent {
  constructor(private readonly agents: IAgentRepository) {}
  async execute(id: string): Promise<void> {
    await this.agents.delete(id);
  }
}

export class ListLineage {
  constructor(private readonly agents: IAgentRepository) {}
  async execute(rootAgentId: string): Promise<LineageNode[]> {
    return this.agents.listLineage(rootAgentId);
  }
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
