import type { IDbClient } from '../../../core/interfaces/IDbClient.js';
import type { ICampaignRepository } from '../../../application/marketing/ports.js';
import type { Campaign, CreateCampaignDto, UpdateCampaignDto } from '../../../shared/marketing/index.js';
import type { CampaignStatus } from '../../../shared/marketing/index.js';
import { isMissingTableError } from '../error-helpers.js';
import { createRecordId, normalizeRecordIdValue } from '../record-id.js';

const TABLE = 'marketing_campaign';

type CampaignRecord = {
  id: unknown;
  name: string;
  description?: string;
  productId?: string;
  status: CampaignStatus;
  startDate?: string;
  endDate?: string;
  goals?: string;
  budget?: number;
  targetRegions: string[];
  createdAt: string;
  updatedAt: string;
};

function toCampaign(record: CampaignRecord): Campaign {
  return {
    id: normalizeRecordIdValue(String(record.id)),
    name: record.name,
    description: record.description,
    productId: record.productId,
    status: record.status,
    startDate: record.startDate,
    endDate: record.endDate,
    goals: record.goals,
    budget: record.budget,
    targetRegions: record.targetRegions ?? [],
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export class SurrealCampaignRepository implements ICampaignRepository {
  constructor(private readonly db: IDbClient) {}

  async findAll(): Promise<Campaign[]> {
    try {
      const [records = []] = await this.db.query<CampaignRecord[]>(
        `SELECT * FROM ${TABLE} ORDER BY createdAt;`,
      );
      return records.map(toCampaign);
    } catch (error) {
      if (isMissingTableError(error)) return [];
      throw error;
    }
  }

  async findById(id: string): Promise<Campaign | null> {
    try {
      const records = await this.db.select<CampaignRecord>(createRecordId(TABLE, id));
      const record = records[0];
      return record ? toCampaign(record) : null;
    } catch (error) {
      if (isMissingTableError(error)) return null;
      throw error;
    }
  }

  async findByProductId(productId: string): Promise<Campaign[]> {
    try {
      const [records = []] = await this.db.query<CampaignRecord[]>(
        `SELECT * FROM ${TABLE} WHERE productId = $productId ORDER BY createdAt;`,
        { productId },
      );
      return records.map(toCampaign);
    } catch (error) {
      if (isMissingTableError(error)) return [];
      throw error;
    }
  }

  async create(data: CreateCampaignDto): Promise<Campaign> {
    const now = new Date().toISOString();
    const [records = []] = await this.db.query<CampaignRecord[]>(
      `CREATE ${TABLE} CONTENT $data;`,
      { data: { ...data, createdAt: now, updatedAt: now } },
    );
    const created = records[0];
    if (!created) throw new Error('Campaign create failed.');
    return toCampaign(created);
  }

  async update(id: string, data: UpdateCampaignDto): Promise<Campaign> {
    const now = new Date().toISOString();
    const records = await this.db.update<CampaignRecord, Record<string, unknown>>(
      createRecordId(TABLE, id),
      { ...data, updatedAt: now },
    );
    const updated = records[0];
    if (!updated) throw new Error(`Campaign update failed for id: ${id}`);
    return toCampaign(updated);
  }

  async delete(id: string): Promise<void> {
    await this.db.delete<CampaignRecord>(createRecordId(TABLE, id));
  }
}
