import type { IDbClient } from '../../../core/interfaces/IDbClient.js';
import type {
  IWeightCheckpointRepository,
  RecordWeightCheckpointInput,
  WeightCheckpointRecord,
} from '../../../application/voxsim/index.js';
import type { ListCheckpointsFilter } from '../../../shared/voxsim/index.js';
import { createRecordId } from '../record-id.js';
import { decodeBytes, encodeBytes, isTableMissing, nowIso, stripIdField } from './mappers.js';

const TABLE = 'voxsim_weight_checkpoint';

interface CheckpointRow {
  id: unknown;
  agentId: string;
  runId?: string;
  brainDnaId: string;
  generation: number;
  score?: number;
  weights: unknown;
  createdAt: string;
}

function toRecord(row: CheckpointRow): WeightCheckpointRecord {
  return {
    id: stripIdField(row.id),
    agentId: row.agentId,
    runId: row.runId,
    brainDnaId: row.brainDnaId,
    generation: row.generation,
    score: row.score,
    weights: decodeBytes(row.weights),
    createdAt: row.createdAt,
  };
}

function applyFilter(
  rows: WeightCheckpointRecord[],
  filter?: ListCheckpointsFilter,
): WeightCheckpointRecord[] {
  let out = rows;
  if (filter?.agentId) out = out.filter((r) => r.agentId === filter.agentId);
  if (filter?.runId) out = out.filter((r) => r.runId === filter.runId);
  if (filter?.minScore !== undefined) {
    const min = filter.minScore;
    out = out.filter((r) => (r.score ?? -Infinity) >= min);
  }
  if (filter?.limit) out = out.slice(0, filter.limit);
  return out;
}

export class SurrealWeightCheckpointRepository implements IWeightCheckpointRepository {
  constructor(private readonly db: IDbClient, private readonly now: () => string = nowIso) {}

  async list(filter?: ListCheckpointsFilter): Promise<WeightCheckpointRecord[]> {
    try {
      const [rows = []] = await this.db.query<CheckpointRow[]>(`SELECT * FROM ${TABLE};`);
      return applyFilter(rows.map(toRecord), filter);
    } catch (error) {
      if (isTableMissing(error)) return [];
      throw error;
    }
  }

  async findById(id: string): Promise<WeightCheckpointRecord | undefined> {
    try {
      const rows = await this.db.select<CheckpointRow>(createRecordId(TABLE, id));
      return rows[0] ? toRecord(rows[0]) : undefined;
    } catch (error) {
      if (isTableMissing(error)) return undefined;
      throw error;
    }
  }

  async record(input: RecordWeightCheckpointInput): Promise<WeightCheckpointRecord> {
    const createdAt = this.now();
    const content: Record<string, unknown> = {
      agentId: input.agentId,
      runId: input.runId,
      brainDnaId: input.brainDnaId,
      generation: input.generation,
      score: input.score,
      weights: encodeBytes(input.weights),
      createdAt,
    };
    const surql = input.id
      ? `CREATE type::record($recordId) CONTENT $content RETURN AFTER;`
      : `CREATE ${TABLE} CONTENT $content RETURN AFTER;`;
    const vars: Record<string, unknown> = { content };
    if (input.id) vars.recordId = `${TABLE}:${input.id}`;
    const [rows = []] = await this.db.query<CheckpointRow[]>(surql, vars);
    const row = rows[0];
    if (!row) throw new Error('voxsim_weight_checkpoint create failed');
    return toRecord(row);
  }
}
