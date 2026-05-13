import type { IDbClient } from '../../../core/interfaces/IDbClient.js';
import type { IRacingSessionRepository } from '../../../application/racing/index.js';
import type { RacingSession } from '../../../shared/racing/index.js';
import { isMissingTableError } from '../error-helpers.js';
import { createRecordId } from '../record-id.js';

const TABLE = 'racing_session';

interface SessionRow {
  id: string;
  track_id: string;
  vehicle_id: string;
  started_at: string;
  ended_at?: string;
}

function toRow(record: RacingSession): Omit<SessionRow, 'id'> {
  return {
    track_id: record.trackId,
    vehicle_id: record.vehicleId,
    started_at: record.startedAt,
    ended_at: record.endedAt,
  };
}

function fromRow(row: SessionRow): RacingSession {
  return {
    id: row.id,
    trackId: row.track_id,
    vehicleId: row.vehicle_id,
    startedAt: row.started_at,
    endedAt: row.ended_at,
  };
}

export class SurrealRacingSessionRepository implements IRacingSessionRepository {
  constructor(private readonly db: IDbClient) {}

  async create(session: RacingSession): Promise<RacingSession> {
    const recordId = createRecordId(TABLE, session.id);
    const [rows = []] = await this.db.query<SessionRow[]>(
      `UPSERT $recordId CONTENT $content RETURN AFTER;`,
      { recordId, content: toRow(session) },
    );
    const row = rows[0];
    if (!row) return { ...session };
    return { ...fromRow(row), id: session.id };
  }

  async findById(id: string): Promise<RacingSession | null> {
    try {
      const rows = await this.db.select<SessionRow>(createRecordId(TABLE, id));
      const row = rows[0];
      if (!row) return null;
      return { ...fromRow(row), id };
    } catch (error) {
      if (isMissingTableError(error)) return null;
      throw error;
    }
  }
}
