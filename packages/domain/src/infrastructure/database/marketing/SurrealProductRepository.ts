import type { IDbClient } from '../../../core/interfaces/IDbClient.js';
import type { IProductRepository } from '../../../application/marketing/ports.js';
import type { Product, CreateProductDto, UpdateProductDto } from '../../../shared/marketing/index.js';
import { isMissingTableError } from '../error-helpers.js';
import { createRecordId, normalizeRecordIdValue } from '../record-id.js';

const TABLE = 'marketing_product';

type ProductRecord = {
  id: unknown;
  name: string;
  description?: string;
  targetAudience?: string;
  features: string[];
  benefits: string[];
  imageUrl?: string;
  createdAt: string;
  updatedAt: string;
};

function toProduct(record: ProductRecord): Product {
  return {
    id: normalizeRecordIdValue(String(record.id)),
    name: record.name,
    description: record.description,
    targetAudience: record.targetAudience,
    features: record.features ?? [],
    benefits: record.benefits ?? [],
    imageUrl: record.imageUrl,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export class SurrealProductRepository implements IProductRepository {
  constructor(private readonly db: IDbClient) {}

  async findAll(): Promise<Product[]> {
    try {
      const [records = []] = await this.db.query<ProductRecord[]>(
        `SELECT * FROM ${TABLE} ORDER BY createdAt;`,
      );
      return records.map(toProduct);
    } catch (error) {
      if (isMissingTableError(error)) return [];
      throw error;
    }
  }

  async findById(id: string): Promise<Product | null> {
    try {
      const records = await this.db.select<ProductRecord>(createRecordId(TABLE, id));
      const record = records[0];
      return record ? toProduct(record) : null;
    } catch (error) {
      if (isMissingTableError(error)) return null;
      throw error;
    }
  }

  async create(data: CreateProductDto): Promise<Product> {
    const now = new Date().toISOString();
    const [records = []] = await this.db.query<ProductRecord[]>(
      `CREATE ${TABLE} CONTENT $data;`,
      { data: { ...data, createdAt: now, updatedAt: now } },
    );
    const created = records[0];
    if (!created) throw new Error('Product create failed.');
    return toProduct(created);
  }

  async update(id: string, data: UpdateProductDto): Promise<Product> {
    const existing = await this.findById(id);
    if (!existing) throw new Error(`Product not found: ${id}`);

    const now = new Date().toISOString();
    const records = await this.db.merge<ProductRecord, Record<string, unknown>>(
      createRecordId(TABLE, id),
      { ...data, updatedAt: now },
    );
    const updated = records[0];
    if (!updated) throw new Error(`Product update failed for id: ${id}`);
    return toProduct(updated);
  }

  async delete(id: string): Promise<void> {
    await this.db.delete<ProductRecord>(createRecordId(TABLE, id));
  }
}
