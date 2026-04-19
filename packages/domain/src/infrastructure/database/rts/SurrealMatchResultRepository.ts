import type { IDbClient } from '../../../core/interfaces/IDbClient.js';
import type { IMatchResultRepository } from '../../../application/rts/index.js';
import type {
  ListMatchResultsFilter,
  MatchResult,
  MatchResultRecord,
} from '../../../shared/rts/index.js';
import { toMatchResultRecord } from '../../../shared/rts/index.js';
import { createRecordId } from '../record-id.js';

const TABLE = 'rts_match_result';

function isTableMissing(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as { message: unknown }).message === 'string' &&
    /table .* does not exist/i.test((error as { message: string }).message)
  );
}

interface MatchResultRow {
  id: string;
  match_id: string;
  map_id: string;
  winner: string;
  duration_ms: number;
  factions: MatchResultRecord['factions'];
  finished_at: string;
}

function toRow(record: MatchResultRecord): Omit<MatchResultRow, 'id'> {
  return {
    match_id: record.matchId,
    map_id: record.mapId,
    winner: record.winner,
    duration_ms: record.durationMs,
    factions: record.factions,
    finished_at: record.finishedAt,
  };
}

function toRecord(row: MatchResultRow): MatchResultRecord {
  return {
    id: row.id,
    matchId: row.match_id,
    mapId: row.map_id,
    winner: row.winner,
    durationMs: row.duration_ms,
    factions: row.factions,
    finishedAt: row.finished_at,
  };
}

export class SurrealRtsMatchResultRepository implements IMatchResultRepository {
  constructor(private readonly db: IDbClient) {}

  async record(result: MatchResult): Promise<MatchResultRecord> {
    const record = toMatchResultRecord(
      result.matchId,
      result.mapId,
      result.winner,
      result.durationMs,
      result.factions,
      result.finishedAt,
      result.matchId,
    );
    const [rows = []] = await this.db.query<MatchResultRow[]>(
      `UPSERT type::record($recordId) CONTENT $content RETURN AFTER;`,
      { recordId: `${TABLE}:${record.id}`, content: toRow(record) },
    );
    return toRecord(rows[0] ?? { id: record.id, ...toRow(record) });
  }

  async list(filter: ListMatchResultsFilter = {}): Promise<MatchResultRecord[]> {
    try {
      const conditions: string[] = [];
      const vars: Record<string, unknown> = {};
      if (filter.mapId) {
        conditions.push('map_id = $mapId');
        vars.mapId = filter.mapId;
      }
      if (filter.winner) {
        conditions.push('winner = $winner');
        vars.winner = filter.winner;
      }
      if (filter.since) {
        conditions.push('finished_at >= $since');
        vars.since = filter.since;
      }
      if (filter.until) {
        conditions.push('finished_at <= $until');
        vars.until = filter.until;
      }
      const where = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '';
      const limit = filter.limit ? ` LIMIT ${Math.max(1, Math.floor(filter.limit))}` : '';
      const sql = `SELECT * FROM ${TABLE}${where} ORDER BY finished_at DESC${limit};`;
      const [rows = []] = await this.db.query<MatchResultRow[]>(sql, vars);
      return rows.map(toRecord);
    } catch (error) {
      if (isTableMissing(error)) return [];
      throw error;
    }
  }

  async findById(id: string): Promise<MatchResultRecord | undefined> {
    try {
      const rows = await this.db.select<MatchResultRow>(createRecordId(TABLE, id));
      const row = rows[0];
      return row ? toRecord(row) : undefined;
    } catch (error) {
      if (isTableMissing(error)) return undefined;
      throw error;
    }
  }
}
