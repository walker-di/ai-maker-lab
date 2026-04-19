import type { IDbClient } from '../../../core/interfaces/IDbClient.js';
import type {
  IUserMapRepository,
  UserMapRecord,
} from '../../../application/platformer/index.js';
import { createRecordId } from '../record-id.js';

const TABLE = 'platformer_user_map';

function isTableMissing(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as { message: unknown }).message === 'string' &&
    /table .* does not exist/i.test((error as { message: string }).message)
  );
}

interface UserMapRow {
  id: string;
  metadata: UserMapRecord['metadata'];
  definition: UserMapRecord['definition'];
  built_in_id?: string;
}

function toRow(record: UserMapRecord): Omit<UserMapRow, 'id'> {
  return {
    metadata: record.metadata,
    definition: record.definition,
    built_in_id: record.builtInId,
  };
}

function toRecord(row: UserMapRow): UserMapRecord {
  return {
    id: row.id,
    metadata: row.metadata,
    definition: row.definition,
    builtInId: row.built_in_id,
  };
}

export class SurrealUserMapRepository implements IUserMapRepository {
  constructor(private readonly db: IDbClient) {}

  async list(): Promise<UserMapRecord[]> {
    try {
      const [rows = []] = await this.db.query<UserMapRow[]>(`SELECT * FROM ${TABLE};`);
      return rows.map(toRecord);
    } catch (error) {
      if (isTableMissing(error)) return [];
      throw error;
    }
  }

  async get(id: string): Promise<UserMapRecord | null> {
    try {
      const rows = await this.db.select<UserMapRow>(createRecordId(TABLE, id));
      const row = rows[0];
      return row ? toRecord(row) : null;
    } catch (error) {
      if (isTableMissing(error)) return null;
      throw error;
    }
  }

  async save(record: UserMapRecord): Promise<UserMapRecord> {
    const [rows = []] = await this.db.query<UserMapRow[]>(
      `UPSERT type::record($recordId) CONTENT $content RETURN AFTER;`,
      { recordId: `${TABLE}:${record.id}`, content: toRow(record) },
    );
    return toRecord(rows[0] ?? { id: record.id, ...toRow(record) });
  }

  async remove(id: string): Promise<void> {
    try {
      await this.db.delete(createRecordId(TABLE, id));
    } catch (error) {
      if (!isTableMissing(error)) throw error;
    }
  }
}
