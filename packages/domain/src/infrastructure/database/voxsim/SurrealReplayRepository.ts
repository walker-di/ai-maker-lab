import type { IDbClient } from '../../../core/interfaces/IDbClient.js';
import type {
  IReplayRepository,
  RecordReplayInput,
  ReplayRecord,
} from '../../../application/voxsim/index.js';
import { createRecordId } from '../record-id.js';
import { decodeBytes, encodeBytes, isTableMissing, nowIso, stripIdField } from './mappers.js';

const TABLE = 'voxsim_replay';

interface ReplayRow {
  id: unknown;
  episodeId: string;
  bytes: unknown;
  frames: number;
  createdAt: string;
}

function toRecord(row: ReplayRow): ReplayRecord {
  return {
    id: stripIdField(row.id),
    episodeId: row.episodeId,
    bytes: decodeBytes(row.bytes),
    frames: row.frames,
    createdAt: row.createdAt,
  };
}

export class SurrealReplayRepository implements IReplayRepository {
  constructor(private readonly db: IDbClient, private readonly now: () => string = nowIso) {}

  async findById(id: string): Promise<ReplayRecord | undefined> {
    try {
      const rows = await this.db.select<ReplayRow>(createRecordId(TABLE, id));
      return rows[0] ? toRecord(rows[0]) : undefined;
    } catch (error) {
      if (isTableMissing(error)) return undefined;
      throw error;
    }
  }

  async record(input: RecordReplayInput): Promise<ReplayRecord> {
    const createdAt = this.now();
    const content: Record<string, unknown> = {
      episodeId: input.episodeId,
      bytes: encodeBytes(input.bytes),
      frames: input.frames,
      createdAt,
    };
    const surql = input.id
      ? `CREATE type::record($recordId) CONTENT $content RETURN AFTER;`
      : `CREATE ${TABLE} CONTENT $content RETURN AFTER;`;
    const vars: Record<string, unknown> = { content };
    if (input.id) vars.recordId = `${TABLE}:${input.id}`;
    const [rows = []] = await this.db.query<ReplayRow[]>(surql, vars);
    const row = rows[0];
    if (!row) throw new Error('voxsim_replay create failed');
    return toRecord(row);
  }
}
