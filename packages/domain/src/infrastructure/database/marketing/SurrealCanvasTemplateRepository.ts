import type { IDbClient } from '../../../core/interfaces/IDbClient.js';
import type { ICanvasTemplateRepository } from '../../../application/marketing/ports.js';
import type { CanvasTemplate, CanvasAspectRatio, CreateCanvasTemplateDto, UpdateCanvasTemplateDto } from '../../../shared/marketing/index.js';
import { createRecordId, normalizeRecordIdValue } from '../record-id.js';

const TABLE = 'marketing_canvas_template';

type CanvasTemplateRecord = {
  id: unknown;
  name: string;
  description?: string;
  aspectRatio: CanvasAspectRatio;
  canvasData: string;
  previewUrl?: string;
  tags: string[];
  isDefault?: boolean;
  createdAt: string;
  updatedAt: string;
};

function toCanvasTemplate(record: CanvasTemplateRecord): CanvasTemplate {
  return {
    id: normalizeRecordIdValue(String(record.id)),
    name: record.name,
    description: record.description,
    aspectRatio: record.aspectRatio,
    canvasData: record.canvasData,
    previewUrl: record.previewUrl,
    tags: record.tags ?? [],
    isDefault: record.isDefault,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export class SurrealCanvasTemplateRepository implements ICanvasTemplateRepository {
  constructor(private readonly db: IDbClient) {}

  async findAll(): Promise<CanvasTemplate[]> {
    const [records = []] = await this.db.query<CanvasTemplateRecord[]>(
      `SELECT * FROM ${TABLE} ORDER BY createdAt;`,
    );
    return records.map(toCanvasTemplate);
  }

  async findById(id: string): Promise<CanvasTemplate | null> {
    const records = await this.db.select<CanvasTemplateRecord>(createRecordId(TABLE, id));
    const record = records[0];
    return record ? toCanvasTemplate(record) : null;
  }

  async findDefaults(): Promise<CanvasTemplate[]> {
    const [records = []] = await this.db.query<CanvasTemplateRecord[]>(
      `SELECT * FROM ${TABLE} WHERE isDefault = true ORDER BY createdAt;`,
    );
    return records.map(toCanvasTemplate);
  }

  async create(data: CreateCanvasTemplateDto): Promise<CanvasTemplate> {
    const now = new Date().toISOString();
    const [records = []] = await this.db.query<CanvasTemplateRecord[]>(
      `CREATE ${TABLE} CONTENT $data;`,
      { data: { ...data, createdAt: now, updatedAt: now } },
    );
    const created = records[0];
    if (!created) throw new Error('CanvasTemplate create failed.');
    return toCanvasTemplate(created);
  }

  async update(id: string, data: UpdateCanvasTemplateDto): Promise<CanvasTemplate> {
    const now = new Date().toISOString();
    const records = await this.db.update<CanvasTemplateRecord, Record<string, unknown>>(
      createRecordId(TABLE, id),
      { ...data, updatedAt: now },
    );
    const updated = records[0];
    if (!updated) throw new Error(`CanvasTemplate update failed for id: ${id}`);
    return toCanvasTemplate(updated);
  }

  async delete(id: string): Promise<void> {
    await this.db.delete<CanvasTemplateRecord>(createRecordId(TABLE, id));
  }
}
