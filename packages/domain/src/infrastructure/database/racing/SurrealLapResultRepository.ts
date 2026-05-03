import type { IDbClient } from '../../../core/interfaces/IDbClient.js';
import type { ILapResultRepository } from '../../../application/racing/index.js';
import type { BestLapKey, LapResult, SectorTime } from '../../../shared/racing/index.js';
import { isMissingTableError } from '../error-helpers.js';
import { createRecordId } from '../record-id.js';

const TABLE = 'racing_lap_result';

interface LapRow {
  id: string;
  session_id: string;
  track_id: string;
  vehicle_id: string;
  lap_ms: number;
  sectors: ReadonlyArray<SectorTime>;
  finished_at: string;
}

function toRow(result: LapResult): Omit<LapRow, 'id'> {
  return {
    session_id: result.sessionId,
    track_id: result.trackId,
    vehicle_id: result.vehicleId,
    lap_ms: result.lapMs,
    sectors: result.sectors,
    finished_at: result.finishedAt,
  };
}

function fromRow(row: LapRow): LapResult {
  return {
    id: row.id,
    sessionId: row.session_id,
    trackId: row.track_id,
    vehicleId: row.vehicle_id,
    lapMs: row.lap_ms,
    sectors: row.sectors ?? [],
    finishedAt: row.finished_at,
  };
}

export class SurrealLapResultRepository implements ILapResultRepository {
  constructor(private readonly db: IDbClient) {}

  async record(result: LapResult): Promise<LapResult> {
    const recordId = createRecordId(TABLE, result.id);
    const [rows = []] = await this.db.query<LapRow[]>(
      `UPSERT $recordId CONTENT $content RETURN AFTER;`,
      { recordId, content: toRow(result) },
    );
    const row = rows[0];
    if (!row) return { ...result };
    return { ...fromRow(row), id: result.id };
  }

  async bestFor(key: BestLapKey): Promise<LapResult | null> {
    try {
      const sql = `SELECT * FROM ${TABLE} WHERE track_id = $trackId AND vehicle_id = $vehicleId ORDER BY lap_ms ASC LIMIT 1;`;
      const [rows = []] = await this.db.query<LapRow[]>(sql, {
        trackId: key.trackId,
        vehicleId: key.vehicleId,
      });
      const row = rows[0];
      return row ? fromRow(row) : null;
    } catch (error) {
      if (isMissingTableError(error)) return null;
      throw error;
    }
  }

  async list(filter: Partial<BestLapKey> = {}): Promise<LapResult[]> {
    try {
      const conditions: string[] = [];
      const vars: Record<string, unknown> = {};
      if (filter.trackId) {
        conditions.push('track_id = $trackId');
        vars.trackId = filter.trackId;
      }
      if (filter.vehicleId) {
        conditions.push('vehicle_id = $vehicleId');
        vars.vehicleId = filter.vehicleId;
      }
      const where = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '';
      const sql = `SELECT * FROM ${TABLE}${where} ORDER BY finished_at DESC;`;
      const [rows = []] = await this.db.query<LapRow[]>(sql, vars);
      return rows.map(fromRow);
    } catch (error) {
      if (isMissingTableError(error)) return [];
      throw error;
    }
  }
}
