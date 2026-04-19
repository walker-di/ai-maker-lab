import type { IDbClient } from '../../../core/interfaces/IDbClient.js';
import type {
  IPlayerProgressRepository,
  PlayerProgressRecord,
} from '../../../application/platformer/index.js';
import { createRecordId } from '../record-id.js';

const TABLE = 'platformer_player_progress';

interface ProgressRow {
  id: string;
  profile: PlayerProgressRecord['profile'];
  history: PlayerProgressRecord['history'];
}

export class SurrealPlayerProgressRepository implements IPlayerProgressRepository {
  constructor(private readonly db: IDbClient) {}

  async load(playerId: string): Promise<PlayerProgressRecord | null> {
    try {
      const rows = await this.db.select<ProgressRow>(createRecordId(TABLE, playerId));
      const row = rows[0];
      if (!row) return null;
      return { playerId: row.id, profile: row.profile, history: row.history ?? [] };
    } catch (error) {
      const message =
        typeof error === 'object' && error !== null && 'message' in error
          ? String((error as { message: unknown }).message)
          : '';
      if (/table .* does not exist/i.test(message)) return null;
      throw error;
    }
  }

  async save(record: PlayerProgressRecord): Promise<PlayerProgressRecord> {
    const [rows = []] = await this.db.query<ProgressRow[]>(
      `UPSERT type::record($recordId) CONTENT $content RETURN AFTER;`,
      {
        recordId: `${TABLE}:${record.playerId}`,
        content: { profile: record.profile, history: record.history },
      },
    );
    const row = rows[0] ?? { id: record.playerId, profile: record.profile, history: record.history };
    return { playerId: row.id, profile: row.profile, history: row.history ?? [] };
  }
}
