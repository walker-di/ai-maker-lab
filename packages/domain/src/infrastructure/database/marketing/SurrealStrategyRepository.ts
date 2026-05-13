import type { IDbClient } from '../../../core/interfaces/IDbClient.js';
import type { IStrategyRepository } from '../../../application/marketing/ports.js';
import type { Strategy, CreateStrategyDto, UpdateStrategyDto } from '../../../shared/marketing/index.js';
import { isMissingTableError } from '../error-helpers.js';
import { createRecordId, normalizeRecordIdValue } from '../record-id.js';

const TABLE = 'marketing_strategy';

type StrategyRecord = {
  id: unknown;
  productId: string;
  campaignId?: string;
  content: string;
  generatedBy?: string;
  createdAt: string;
  updatedAt: string;
};

function toStrategy(record: StrategyRecord): Strategy {
  return {
    id: normalizeRecordIdValue(String(record.id)),
    productId: record.productId,
    campaignId: record.campaignId,
    content: record.content,
    generatedBy: record.generatedBy,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export class SurrealStrategyRepository implements IStrategyRepository {
  constructor(private readonly db: IDbClient) {}

  async findAll(): Promise<Strategy[]> {
    try {
      const [records = []] = await this.db.query<StrategyRecord[]>(
        `SELECT * FROM ${TABLE} ORDER BY createdAt;`,
      );
      return records.map(toStrategy);
    } catch (error) {
      if (isMissingTableError(error)) return [];
      throw error;
    }
  }

  async findById(id: string): Promise<Strategy | null> {
    try {
      const records = await this.db.select<StrategyRecord>(createRecordId(TABLE, id));
      const record = records[0];
      return record ? toStrategy(record) : null;
    } catch (error) {
      if (isMissingTableError(error)) return null;
      throw error;
    }
  }

  async findByProductId(productId: string): Promise<Strategy[]> {
    try {
      const [records = []] = await this.db.query<StrategyRecord[]>(
        `SELECT * FROM ${TABLE} WHERE productId = $productId ORDER BY createdAt;`,
        { productId },
      );
      return records.map(toStrategy);
    } catch (error) {
      if (isMissingTableError(error)) return [];
      throw error;
    }
  }

  async create(data: CreateStrategyDto): Promise<Strategy> {
    const now = new Date().toISOString();
    const [records = []] = await this.db.query<StrategyRecord[]>(
      `CREATE ${TABLE} CONTENT $data;`,
      { data: { ...data, createdAt: now, updatedAt: now } },
    );
    const created = records[0];
    if (!created) throw new Error('Strategy create failed.');
    return toStrategy(created);
  }

  async update(id: string, data: UpdateStrategyDto): Promise<Strategy> {
    const now = new Date().toISOString();
    const records = await this.db.update<StrategyRecord, Record<string, unknown>>(
      createRecordId(TABLE, id),
      { ...data, updatedAt: now },
    );
    const updated = records[0];
    if (!updated) throw new Error(`Strategy update failed for id: ${id}`);
    return toStrategy(updated);
  }

  async delete(id: string): Promise<void> {
    await this.db.delete<StrategyRecord>(createRecordId(TABLE, id));
  }
}
