import type { IDbClient } from '../../../core/interfaces/IDbClient.js';
import type {
  INeatInnovationLogRepository,
  NeatInnovationLogRecord,
  RecordNeatInnovationLogInput,
} from '../../../application/voxsim/index.js';
import type { ListNeatInnovationsFilter } from '../../../shared/voxsim/index.js';
import { isTableMissing, nowIso, stripIdField } from './mappers.js';

const TABLE = 'voxsim_neat_innovation_log';

interface InnovationRow extends Omit<NeatInnovationLogRecord, 'id'> {
  id: unknown;
}

function toRecord(row: InnovationRow): NeatInnovationLogRecord {
  return {
    id: stripIdField(row.id),
    runId: row.runId,
    generation: row.generation,
    addedConnections: row.addedConnections,
    addedNodes: row.addedNodes,
    createdAt: row.createdAt,
  };
}

export class SurrealNeatInnovationLogRepository implements INeatInnovationLogRepository {
  constructor(private readonly db: IDbClient, private readonly now: () => string = nowIso) {}

  async record(input: RecordNeatInnovationLogInput): Promise<NeatInnovationLogRecord> {
    const createdAt = this.now();
    const [rows = []] = await this.db.query<InnovationRow[]>(
      `CREATE ${TABLE} CONTENT $content RETURN AFTER;`,
      {
        content: {
          runId: input.runId,
          generation: input.generation,
          addedConnections: input.addedConnections,
          addedNodes: input.addedNodes,
          createdAt,
        },
      },
    );
    const row = rows[0];
    if (!row) throw new Error('voxsim_neat_innovation_log create failed');
    return toRecord(row);
  }

  async list(filter: ListNeatInnovationsFilter): Promise<NeatInnovationLogRecord[]> {
    try {
      const [rows = []] = await this.db.query<InnovationRow[]>(`SELECT * FROM ${TABLE};`);
      let out = rows.map(toRecord).filter((r) => r.runId === filter.runId);
      if (filter.sinceGeneration !== undefined) {
        out = out.filter((r) => r.generation >= (filter.sinceGeneration ?? 0));
      }
      if (filter.limit) out = out.slice(0, filter.limit);
      return out;
    } catch (error) {
      if (isTableMissing(error)) return [];
      throw error;
    }
  }
}
