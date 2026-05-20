import type { IDbClient } from '../../../core/interfaces/IDbClient.js';
import type { ICustomerJourneyMapRepository } from '../../../application/marketing/ports.js';
import type {
  CustomerJourneyMap,
  CreateCustomerJourneyMapDto,
  UpdateCustomerJourneyMapDto,
  CustomerJourneyMapStatus,
  JourneyMapStage,
  JourneyMapLane,
  JourneyMapCell,
  JourneyMapTouchpoint,
  JourneyMapEmotionPoint,
  JourneyMapOpportunity,
} from '../../../shared/marketing/index.js';
import { isMissingTableError } from '../error-helpers.js';
import { createRecordId, normalizeRecordIdValue } from '../record-id.js';
import { ensureMarketingSchema } from './schema.js';

const TABLE = 'marketing_customer_journey_map';

type CustomerJourneyMapRecord = {
  id: unknown;
  productId: string;
  personaId?: string;
  campaignId?: string;
  creativeId?: string;
  name: string;
  description?: string;
  scenario?: string;
  goals: string[];
  status: CustomerJourneyMapStatus;
  tags: string[];
  stages: JourneyMapStage[];
  lanes: JourneyMapLane[];
  cells: JourneyMapCell[];
  touchpoints: JourneyMapTouchpoint[];
  emotionPoints: JourneyMapEmotionPoint[];
  opportunities: JourneyMapOpportunity[];
  createdAt: string;
  updatedAt: string;
};

function toCustomerJourneyMap(record: CustomerJourneyMapRecord): CustomerJourneyMap {
  return {
    id: normalizeRecordIdValue(String(record.id)),
    productId: record.productId,
    personaId: record.personaId,
    campaignId: record.campaignId,
    creativeId: record.creativeId,
    name: record.name,
    description: record.description,
    scenario: record.scenario,
    goals: record.goals ?? [],
    status: record.status ?? 'draft',
    tags: record.tags ?? [],
    stages: record.stages ?? [],
    lanes: record.lanes ?? [],
    cells: record.cells ?? [],
    touchpoints: record.touchpoints ?? [],
    emotionPoints: record.emotionPoints ?? [],
    opportunities: record.opportunities ?? [],
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export class SurrealCustomerJourneyMapRepository implements ICustomerJourneyMapRepository {
  constructor(private readonly db: IDbClient) {}

  private async ensureSchema(): Promise<void> {
    await ensureMarketingSchema(this.db);
  }

  async findAll(): Promise<CustomerJourneyMap[]> {
    await this.ensureSchema();
    try {
      const [records = []] = await this.db.query<CustomerJourneyMapRecord[]>(
        `SELECT * FROM ${TABLE} ORDER BY createdAt;`,
      );
      return records.map(toCustomerJourneyMap);
    } catch (error) {
      if (isMissingTableError(error)) return [];
      throw error;
    }
  }

  async findById(id: string): Promise<CustomerJourneyMap | null> {
    await this.ensureSchema();
    try {
      const records = await this.db.select<CustomerJourneyMapRecord>(createRecordId(TABLE, id));
      const record = records[0];
      return record ? toCustomerJourneyMap(record) : null;
    } catch (error) {
      if (isMissingTableError(error)) return null;
      throw error;
    }
  }

  async findByProductId(productId: string): Promise<CustomerJourneyMap[]> {
    await this.ensureSchema();
    try {
      const [records = []] = await this.db.query<CustomerJourneyMapRecord[]>(
        `SELECT * FROM ${TABLE} WHERE productId = $productId ORDER BY createdAt;`,
        { productId },
      );
      return records.map(toCustomerJourneyMap);
    } catch (error) {
      if (isMissingTableError(error)) return [];
      throw error;
    }
  }

  async create(data: CreateCustomerJourneyMapDto): Promise<CustomerJourneyMap> {
    await this.ensureSchema();
    const now = new Date().toISOString();
    const [records = []] = await this.db.query<CustomerJourneyMapRecord[]>(
      `CREATE ${TABLE} CONTENT $data;`,
      { data: { ...data, createdAt: now, updatedAt: now } },
    );
    const created = records[0];
    if (!created) throw new Error('Customer journey map create failed.');
    return toCustomerJourneyMap(created);
  }

  async update(id: string, data: UpdateCustomerJourneyMapDto): Promise<CustomerJourneyMap> {
    await this.ensureSchema();
    const existing = await this.findById(id);
    if (!existing) throw new Error(`Customer journey map not found: ${id}`);

    const now = new Date().toISOString();
    const records = await this.db.merge<CustomerJourneyMapRecord, Record<string, unknown>>(
      createRecordId(TABLE, id),
      { ...data, updatedAt: now },
    );
    const updated = records[0];
    if (!updated) throw new Error(`Customer journey map update failed for id: ${id}`);
    return toCustomerJourneyMap(updated);
  }

  async delete(id: string): Promise<void> {
    await this.ensureSchema();
    await this.db.delete<CustomerJourneyMapRecord>(createRecordId(TABLE, id));
  }
}
