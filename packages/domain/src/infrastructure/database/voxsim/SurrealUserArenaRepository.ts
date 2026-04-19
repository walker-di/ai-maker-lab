import type { IDbClient } from '../../../core/interfaces/IDbClient.js';
import type {
  CreateUserArenaInput,
  IUserArenaRepository,
  UpdateUserArenaPatch,
  UserArenaRecord,
} from '../../../application/voxsim/index.js';
import { createRecordId } from '../record-id.js';
import { isTableMissing, nowIso, stripIdField } from './mappers.js';

const TABLE = 'voxsim_arena';

interface UserArenaRow {
  id: unknown;
  metadata: UserArenaRecord['metadata'];
  definition: UserArenaRecord['definition'];
  inheritsFromBuiltInId?: string;
  createdAt: string;
  updatedAt: string;
}

function toRecord(row: UserArenaRow): UserArenaRecord {
  return {
    id: stripIdField(row.id),
    metadata: row.metadata,
    definition: row.definition,
    inheritsFromBuiltInId: row.inheritsFromBuiltInId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class SurrealUserArenaRepository implements IUserArenaRepository {
  constructor(private readonly db: IDbClient, private readonly now: () => string = nowIso) {}

  async list(): Promise<UserArenaRecord[]> {
    try {
      const [rows = []] = await this.db.query<UserArenaRow[]>(`SELECT * FROM ${TABLE};`);
      return rows.map(toRecord);
    } catch (error) {
      if (isTableMissing(error)) return [];
      throw error;
    }
  }

  async findById(id: string): Promise<UserArenaRecord | undefined> {
    try {
      const rows = await this.db.select<UserArenaRow>(createRecordId(TABLE, id));
      const row = rows[0];
      return row ? toRecord(row) : undefined;
    } catch (error) {
      if (isTableMissing(error)) return undefined;
      throw error;
    }
  }

  async create(input: CreateUserArenaInput): Promise<UserArenaRecord> {
    const now = this.now();
    const [rows = []] = await this.db.query<UserArenaRow[]>(
      `CREATE ${TABLE} CONTENT $content RETURN AFTER;`,
      {
        content: {
          metadata: input.metadata,
          definition: input.definition,
          inheritsFromBuiltInId: input.inheritsFromBuiltInId,
          createdAt: now,
          updatedAt: now,
        },
      },
    );
    const row = rows[0];
    if (!row) throw new Error('voxsim_arena create failed');
    return toRecord(row);
  }

  async update(id: string, patch: UpdateUserArenaPatch): Promise<UserArenaRecord> {
    const existing = await this.findById(id);
    if (!existing) throw new Error(`voxsim_arena ${id} not found`);
    const merged: UserArenaRecord = {
      ...existing,
      metadata: patch.metadata ?? existing.metadata,
      definition: patch.definition ?? existing.definition,
      updatedAt: this.now(),
    };
    const rows = await this.db.update<UserArenaRow, Omit<UserArenaRow, 'id'>>(
      createRecordId(TABLE, id),
      {
        metadata: merged.metadata,
        definition: merged.definition,
        inheritsFromBuiltInId: merged.inheritsFromBuiltInId,
        createdAt: merged.createdAt,
        updatedAt: merged.updatedAt,
      },
    );
    return toRecord(rows[0] ?? ({ ...merged, id } as UserArenaRow));
  }

  async delete(id: string): Promise<void> {
    try {
      await this.db.delete(createRecordId(TABLE, id));
    } catch (error) {
      if (!isTableMissing(error)) throw error;
    }
  }
}
