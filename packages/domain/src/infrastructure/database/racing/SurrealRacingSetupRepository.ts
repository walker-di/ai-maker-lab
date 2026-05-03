import type { IDbClient } from '../../../core/interfaces/IDbClient.js';
import type { IRacingSetupRepository } from '../../../application/racing/index.js';
import type { SetupValues } from '../../../shared/racing/index.js';
import { isMissingTableError } from '../error-helpers.js';
import { createRecordId } from '../record-id.js';

const TABLE = 'racing_setup';

interface SetupRow extends SetupValues {
  id?: unknown;
  user_id: string;
  updated_at: string;
}

function fromRow(row: SetupRow): SetupValues {
  return {
    frontToeDeg: row.frontToeDeg,
    rearToeDeg: row.rearToeDeg,
    casterDeg: row.casterDeg,
    ackermannPct: row.ackermannPct,
    motionRatioFront: row.motionRatioFront,
    motionRatioRear: row.motionRatioRear,
    bumpStopGapFrontMm: row.bumpStopGapFrontMm,
    bumpStopGapRearMm: row.bumpStopGapRearMm,
    bumpStopRateFrontNmm: row.bumpStopRateFrontNmm,
    bumpStopRateRearNmm: row.bumpStopRateRearNmm,
  };
}

export class SurrealRacingSetupRepository implements IRacingSetupRepository {
  constructor(private readonly db: IDbClient) {}

  async get(userId: string): Promise<SetupValues | null> {
    try {
      const sql = `SELECT * FROM ${TABLE} WHERE user_id = $userId LIMIT 1;`;
      const [rows = []] = await this.db.query<SetupRow[]>(sql, { userId });
      const row = rows[0];
      return row ? fromRow(row) : null;
    } catch (error) {
      if (isMissingTableError(error)) return null;
      throw error;
    }
  }

  async set(userId: string, setup: SetupValues): Promise<void> {
    const content: Omit<SetupRow, 'id'> = {
      user_id: userId,
      updated_at: new Date().toISOString(),
      ...setup,
    };
    const recordId = createRecordId(TABLE, userId);
    await this.db.query(
      `UPSERT $recordId CONTENT $content RETURN AFTER;`,
      { recordId, content },
    );
  }
}
