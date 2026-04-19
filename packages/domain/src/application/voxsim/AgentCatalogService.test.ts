import { describe, expect, it } from 'bun:test';
import { AgentCatalogService } from './AgentCatalogService.js';
import type {
  AgentRecord,
  CreateAgentInput,
  IAgentRepository,
  UpdateAgentPatch,
} from './ports.js';
import type {
  BodyDna,
  BrainDna,
  ListAgentsFilter,
  TrainingDna,
} from '../../shared/voxsim/index.js';

function bodyOf(id: string): BodyDna {
  return {
    metadata: {
      id,
      organism: 'biped',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    rootSegment: 'root',
    segments: [],
    joints: [],
    sensors: [],
    actuators: { actuators: [] },
    deathRule: { kind: 'tilt', maxTiltDegrees: 60 },
  } as unknown as BodyDna;
}

function brainOf(id: string): BrainDna {
  return {
    metadata: {
      id,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    topology: 'mlp',
    layers: [],
    inputEncoders: [],
    outputDecoders: [],
  } as unknown as BrainDna;
}

class FakeAgentRepo implements IAgentRepository {
  private records = new Map<string, AgentRecord>();
  private nextId = 1;
  async list(filter?: ListAgentsFilter) {
    let items = Array.from(this.records.values());
    if (filter?.kind) items = items.filter((r) => r.kind === filter.kind);
    if (filter?.lineageRootId) {
      items = items.filter((r) =>
        r.id === filter.lineageRootId || r.lineageParentAgentId === filter.lineageRootId,
      );
    }
    return items;
  }
  async findById(id: string) {
    return this.records.get(id);
  }
  async create(input: CreateAgentInput) {
    const id = `agent-${this.nextId++}`;
    const now = new Date(2026, 0, this.nextId).toISOString();
    const record: AgentRecord = {
      id,
      name: input.name,
      kind: input.kind,
      bodyDna: input.bodyDna,
      brainDna: input.brainDna,
      trainingDna: input.trainingDna,
      lineageParentAgentId: input.lineageParentAgentId,
      generation: input.generation ?? 0,
      mutationSummary: input.mutationSummary,
      createdAt: now,
      updatedAt: now,
    };
    this.records.set(id, record);
    return record;
  }
  async update(id: string, patch: UpdateAgentPatch) {
    const existing = this.records.get(id);
    if (!existing) throw new Error('not found');
    const updated: AgentRecord = {
      ...existing,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    this.records.set(id, updated);
    return updated;
  }
  async delete(id: string) {
    this.records.delete(id);
  }
  async listLineage(rootAgentId: string) {
    const out: { agentId: string; parentAgentId?: string; generation: number; bestScore?: number }[] = [];
    const stack = [rootAgentId];
    while (stack.length) {
      const id = stack.pop()!;
      const record = this.records.get(id);
      if (!record) continue;
      out.push({
        agentId: record.id,
        parentAgentId: record.lineageParentAgentId,
        generation: record.generation,
        bestScore: record.bestScore,
      });
      for (const r of this.records.values()) {
        if (r.lineageParentAgentId === id) stack.push(r.id);
      }
    }
    return out;
  }
}

describe('AgentCatalogService', () => {
  it('listSummaries maps records into summary DTOs', async () => {
    const repo = new FakeAgentRepo();
    await repo.create({
      name: 'Walker',
      kind: 'biped',
      bodyDna: bodyOf('body-1'),
      brainDna: brainOf('brain-1'),
    });
    const service = new AgentCatalogService({ agents: repo });
    const summaries = await service.listSummaries();
    expect(summaries).toHaveLength(1);
    expect(summaries[0]!.name).toBe('Walker');
    expect(summaries[0]!.bodyDnaId).toBe('body-1');
    expect(summaries[0]!.brainDnaId).toBe('brain-1');
    expect(summaries[0]!.generation).toBe(0);
  });

  it('loadAgent returns the full DNA triple', async () => {
    const repo = new FakeAgentRepo();
    const agent = await repo.create({
      name: 'Walker',
      kind: 'biped',
      bodyDna: bodyOf('body-1'),
      brainDna: brainOf('brain-1'),
      trainingDna: { metadata: { id: 'train-1' } } as unknown as TrainingDna,
    });
    const service = new AgentCatalogService({ agents: repo });
    const loaded = await service.loadAgent(agent.id);
    expect(loaded).toBeDefined();
    expect(loaded!.summary.id).toBe(agent.id);
    expect(loaded!.bodyDna).toBeDefined();
    expect(loaded!.brainDna).toBeDefined();
    expect(loaded!.trainingDna).toBeDefined();
    expect(loaded!.summary.trainingDnaId).toBe('train-1');
  });

  it('loadAgent returns undefined for unknown id', async () => {
    const repo = new FakeAgentRepo();
    const service = new AgentCatalogService({ agents: repo });
    expect(await service.loadAgent('missing')).toBeUndefined();
  });

  it('mutate creates a child agent with lineage and incremented generation', async () => {
    const repo = new FakeAgentRepo();
    const parent = await repo.create({
      name: 'Walker',
      kind: 'biped',
      bodyDna: bodyOf('body-1'),
      brainDna: brainOf('brain-1'),
    });
    const service = new AgentCatalogService({ agents: repo });
    const child = await service.mutate({
      id: parent.id,
      mutation: { kind: 'body', spec: { kind: 'addSegment' } },
    });

    expect(child.lineageParentAgentId).toBe(parent.id);
    expect(child.generation).toBe(1);
    expect(child.name).toContain('Walker');

    const list = await repo.list();
    expect(list).toHaveLength(2);
    const childRecord = list.find((r) => r.id === child.id)!;
    expect(childRecord.mutationSummary).toBe('body:addSegment');
  });

  it('mutate handles neat structural mutation', async () => {
    const repo = new FakeAgentRepo();
    const parent = await repo.create({
      name: 'Walker',
      kind: 'biped',
      bodyDna: bodyOf('body-1'),
      brainDna: brainOf('brain-1'),
    });
    const service = new AgentCatalogService({ agents: repo });
    const child = await service.mutate({
      id: parent.id,
      mutation: { kind: 'neatStructural', spec: { kind: 'addNode', connectionInnovation: 5 } },
    });

    const list = await repo.list();
    const childRecord = list.find((r) => r.id === child.id)!;
    expect(childRecord.mutationSummary).toBe('neat:addNode');
  });

  it('mutate throws when the parent agent does not exist', async () => {
    const repo = new FakeAgentRepo();
    const service = new AgentCatalogService({ agents: repo });
    await expect(
      service.mutate({ id: 'missing', mutation: { kind: 'body', spec: { kind: 'addSegment' } } }),
    ).rejects.toThrow();
  });
});
