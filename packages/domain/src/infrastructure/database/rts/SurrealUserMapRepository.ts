import type { IDbClient } from '../../../core/interfaces/IDbClient.js';
import type { IUserMapRepository } from '../../../application/rts/index.js';
import type { UserMapRecord } from '../../../shared/rts/index.js';
import { createRecordId } from '../record-id.js';

const TABLE = 'rts_user_map';

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
  owner_id?: string;
  definition: UserMapRecord['definition'];
  params?: UserMapRecord['params'];
  metadata: UserMapRecord['metadata'];
}

function toRow(record: UserMapRecord): Omit<UserMapRow, 'id'> {
  return {
    owner_id: record.ownerId,
    definition: record.definition,
    params: record.params,
    metadata: record.metadata,
  };
}

function toRecord(row: UserMapRow): UserMapRecord {
  return {
    id: row.id,
    ownerId: row.owner_id,
    definition: row.definition,
    params: row.params,
    metadata: row.metadata,
  };
}

export class SurrealRtsUserMapRepository implements IUserMapRepository {
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

  async findById(id: string): Promise<UserMapRecord | undefined> {
    try {
      const rows = await this.db.select<UserMapRow>(createRecordId(TABLE, id));
      const row = rows[0];
      return row ? toRecord(row) : undefined;
    } catch (error) {
      if (isTableMissing(error)) return undefined;
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
