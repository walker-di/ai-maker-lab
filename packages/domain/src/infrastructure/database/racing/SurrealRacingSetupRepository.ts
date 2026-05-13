import type { IDbClient } from '../../../core/interfaces/IDbClient.js';
import type { IRacingSetupRepository } from '../../../application/racing/index.js';
import type { SetupValues } from '../../../shared/racing/index.js';
import { clampSetup } from '../../../shared/racing/index.js';
import { isMissingTableError } from '../error-helpers.js';
import { createRecordId } from '../record-id.js';

const TABLE = 'racing_setup';

interface SetupRow extends Partial<SetupValues> {
  id?: unknown;
  user_id: string;
  updated_at: string;
}

/**
 * Deserialise a database row using clampSetup() so old pre-M7 rows (missing
 * the new fields) receive safe defaults and are never returned with undefined
 * values. New rows pass through unchanged after clamping.
 */
function fromRow(row: SetupRow): SetupValues {
  return clampSetup(row);
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
