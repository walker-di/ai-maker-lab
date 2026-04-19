import type { IDbClient } from '../../../core/interfaces/IDbClient.js';
import type {
  AgentRecord,
  CreateAgentInput,
  IAgentRepository,
  UpdateAgentPatch,
} from '../../../application/voxsim/index.js';
import type { LineageNode, ListAgentsFilter } from '../../../shared/voxsim/index.js';
import { createRecordId } from '../record-id.js';
import { isTableMissing, nowIso, stripIdField } from './mappers.js';

const TABLE = 'voxsim_agent';

interface AgentRow extends Omit<AgentRecord, 'id'> {
  id: unknown;
}

function toRecord(row: AgentRow): AgentRecord {
  return {
    id: stripIdField(row.id),
    name: row.name,
    kind: row.kind,
    bodyDna: row.bodyDna,
    brainDna: row.brainDna,
    trainingDna: row.trainingDna,
    lineageParentAgentId: row.lineageParentAgentId,
    generation: row.generation,
    mutationSummary: row.mutationSummary,
    bestCheckpointRefId: row.bestCheckpointRefId,
    bestScore: row.bestScore,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function applyFilter(records: AgentRecord[], filter?: ListAgentsFilter): AgentRecord[] {
  let out = records;
  if (filter?.kind) out = out.filter((r) => r.kind === filter.kind);
  if (filter?.bodyDnaId) {
    out = out.filter((r) => extractDnaId(r.bodyDna) === filter.bodyDnaId);
  }
  if (filter?.lineageRootId) {
    out = out.filter(
      (r) => r.id === filter.lineageRootId || r.lineageParentAgentId === filter.lineageRootId,
    );
  }
  if (filter?.since) {
    out = out.filter((r) => r.createdAt >= filter.since!);
  }
  if (filter?.limit) out = out.slice(0, filter.limit);
  return out;
}

function extractDnaId(dna: unknown): string | undefined {
  if (dna && typeof dna === 'object') {
    const meta = (dna as { metadata?: { id?: string } }).metadata;
    if (meta?.id) return meta.id;
  }
  return undefined;
}

export class SurrealAgentRepository implements IAgentRepository {
  constructor(private readonly db: IDbClient, private readonly now: () => string = nowIso) {}

  async list(filter?: ListAgentsFilter): Promise<AgentRecord[]> {
    try {
      const [rows = []] = await this.db.query<AgentRow[]>(`SELECT * FROM ${TABLE};`);
      return applyFilter(rows.map(toRecord), filter);
    } catch (error) {
      if (isTableMissing(error)) return [];
      throw error;
    }
  }

  async findById(id: string): Promise<AgentRecord | undefined> {
    try {
      const rows = await this.db.select<AgentRow>(createRecordId(TABLE, id));
      const row = rows[0];
      return row ? toRecord(row) : undefined;
    } catch (error) {
      if (isTableMissing(error)) return undefined;
      throw error;
    }
  }

  async create(input: CreateAgentInput): Promise<AgentRecord> {
    const now = this.now();
    const [rows = []] = await this.db.query<AgentRow[]>(
      `CREATE ${TABLE} CONTENT $content RETURN AFTER;`,
      {
        content: {
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
        },
      },
    );
    const row = rows[0];
    if (!row) throw new Error('voxsim_agent create failed');
    return toRecord(row);
  }

  async update(id: string, patch: UpdateAgentPatch): Promise<AgentRecord> {
    const existing = await this.findById(id);
    if (!existing) throw new Error(`voxsim_agent ${id} not found`);
    const merged: AgentRecord = {
      ...existing,
      ...patch,
      updatedAt: this.now(),
    };
    const rows = await this.db.update<AgentRow, Omit<AgentRow, 'id'>>(
      createRecordId(TABLE, id),
      {
        name: merged.name,
        kind: merged.kind,
        bodyDna: merged.bodyDna,
        brainDna: merged.brainDna,
        trainingDna: merged.trainingDna,
        lineageParentAgentId: merged.lineageParentAgentId,
        generation: merged.generation,
        mutationSummary: merged.mutationSummary,
        bestCheckpointRefId: merged.bestCheckpointRefId,
        bestScore: merged.bestScore,
        createdAt: merged.createdAt,
        updatedAt: merged.updatedAt,
      },
    );
    return toRecord(rows[0] ?? ({ ...merged, id } as AgentRow));
  }

  async delete(id: string): Promise<void> {
    try {
      await this.db.delete(createRecordId(TABLE, id));
    } catch (error) {
      if (!isTableMissing(error)) throw error;
    }
  }

  async listLineage(rootAgentId: string): Promise<LineageNode[]> {
    const all = await this.list();
    const out: LineageNode[] = [];
    const visited = new Set<string>();
    const stack = [rootAgentId];
    while (stack.length) {
      const id = stack.pop()!;
      if (visited.has(id)) continue;
      visited.add(id);
      const record = all.find((r) => r.id === id);
      if (!record) continue;
      out.push({
        agentId: record.id,
        parentAgentId: record.lineageParentAgentId,
        generation: record.generation,
        bestScore: record.bestScore,
        mutationSummary: record.mutationSummary,
      });
      for (const r of all) {
        if (r.lineageParentAgentId === id) stack.push(r.id);
      }
    }
    return out;
  }
}
