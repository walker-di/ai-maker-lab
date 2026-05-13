import type { IDbClient } from '../../../core/interfaces/IDbClient.js';
import type { IBgmRepository } from '../../../application/marketing/ports.js';
import type { BgmFile, CreateBgmFileDto, UpdateBgmFileDto } from '../../../shared/marketing/index.js';
import { isMissingTableError } from '../error-helpers.js';
import { createRecordId, normalizeRecordIdValue } from '../record-id.js';

const TABLE = 'marketing_bgm_file';

type BgmRecord = {
  id: unknown;
  name: string;
  fileUrl: string;
  duration?: number;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

function toBgm(record: BgmRecord): BgmFile {
  return {
    id: normalizeRecordIdValue(String(record.id)),
    name: record.name,
    fileUrl: record.fileUrl,
    duration: record.duration,
    tags: record.tags ?? [],
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export class SurrealBgmRepository implements IBgmRepository {
  constructor(private readonly db: IDbClient) {}

  async findAll(): Promise<BgmFile[]> {
    try {
      const [records = []] = await this.db.query<BgmRecord[]>(
        `SELECT * FROM ${TABLE} ORDER BY createdAt;`,
      );
      return records.map(toBgm);
    } catch (error) {
      if (isMissingTableError(error)) return [];
      throw error;
    }
  }

  async findById(id: string): Promise<BgmFile | null> {
    try {
      const records = await this.db.select<BgmRecord>(createRecordId(TABLE, id));
      const record = records[0];
      return record ? toBgm(record) : null;
    } catch (error) {
      if (isMissingTableError(error)) return null;
      throw error;
    }
  }

  async create(data: CreateBgmFileDto): Promise<BgmFile> {
    const now = new Date().toISOString();
    const [records = []] = await this.db.query<BgmRecord[]>(
      `CREATE ${TABLE} CONTENT $data;`,
      { data: { ...data, createdAt: now, updatedAt: now } },
    );
    const created = records[0];
    if (!created) throw new Error('BgmFile create failed.');
    return toBgm(created);
  }

  async update(id: string, data: UpdateBgmFileDto): Promise<BgmFile> {
    const now = new Date().toISOString();
    const records = await this.db.update<BgmRecord, Record<string, unknown>>(
      createRecordId(TABLE, id),
      { ...data, updatedAt: now },
    );
    const updated = records[0];
    if (!updated) throw new Error(`BgmFile update failed for id: ${id}`);
    return toBgm(updated);
  }

  async delete(id: string): Promise<void> {
    await this.db.delete<BgmRecord>(createRecordId(TABLE, id));
  }
}
