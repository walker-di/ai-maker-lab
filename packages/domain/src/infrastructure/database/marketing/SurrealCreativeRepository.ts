import type { IDbClient } from '../../../core/interfaces/IDbClient.js';
import type { ICreativeRepository } from '../../../application/marketing/ports.js';
import type {
  Creative,
  TextCreative,
  ImageCreative,
  VideoCreative,
  LandingPageCreative,
  CreateCreativeDto,
  UpdateCreativeDto,
} from '../../../shared/marketing/index.js';
import { createRecordId, normalizeRecordIdValue } from '../record-id.js';

const TABLE = 'marketing_creative';

type CreativeRecord = {
  id: unknown;
  productId: string;
  personaId?: string;
  campaignId?: string;
  type: string;
  name: string;
  status: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  // text fields
  content?: string;
  tone?: string;
  callToAction?: string;
  // image fields
  imageUrl?: string;
  prompt?: string;
  style?: string;
  imageWidth?: number;
  imageHeight?: number;
  isSvg?: boolean;
  // video fields
  platform?: string;
  format?: string;
  duration?: number;
  storyId?: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  // landing page fields
  htmlContent?: string;
  metaTitle?: string;
  metaDescription?: string;
};

function toCreative(record: CreativeRecord): Creative {
  const base = {
    id: normalizeRecordIdValue(String(record.id)),
    productId: record.productId,
    personaId: record.personaId,
    campaignId: record.campaignId,
    name: record.name,
    status: record.status,
    tags: record.tags ?? [],
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };

  switch (record.type) {
    case 'text':
      return {
        ...base,
        type: 'text',
        content: record.content ?? '',
        tone: record.tone,
        callToAction: record.callToAction,
      } satisfies TextCreative;
    case 'image':
      return {
        ...base,
        type: 'image',
        imageUrl: record.imageUrl,
        prompt: record.prompt,
        style: record.style,
        imageWidth: record.imageWidth,
        imageHeight: record.imageHeight,
        isSvg: record.isSvg,
      } satisfies ImageCreative;
    case 'video':
      return {
        ...base,
        type: 'video',
        platform: (record.platform ?? 'youtube') as VideoCreative['platform'],
        format: (record.format ?? '16:9') as VideoCreative['format'],
        duration: record.duration,
        storyId: record.storyId,
        videoUrl: record.videoUrl,
        thumbnailUrl: record.thumbnailUrl,
      } satisfies VideoCreative;
    case 'landing_page':
    default:
      return {
        ...base,
        type: 'landing_page',
        htmlContent: record.htmlContent,
        metaTitle: record.metaTitle,
        metaDescription: record.metaDescription,
      } satisfies LandingPageCreative;
  }
}

export class SurrealCreativeRepository implements ICreativeRepository {
  constructor(private readonly db: IDbClient) {}

  async findAll(): Promise<Creative[]> {
    const [records = []] = await this.db.query<CreativeRecord[]>(
      `SELECT * FROM ${TABLE} ORDER BY createdAt;`,
    );
    return records.map(toCreative);
  }

  async findById(id: string): Promise<Creative | null> {
    const records = await this.db.select<CreativeRecord>(createRecordId(TABLE, id));
    const record = records[0];
    return record ? toCreative(record) : null;
  }

  async findByProductId(productId: string): Promise<Creative[]> {
    const [records = []] = await this.db.query<CreativeRecord[]>(
      `SELECT * FROM ${TABLE} WHERE productId = $productId ORDER BY createdAt;`,
      { productId },
    );
    return records.map(toCreative);
  }

  async create(data: CreateCreativeDto): Promise<Creative> {
    const now = new Date().toISOString();
    const [records = []] = await this.db.query<CreativeRecord[]>(
      `CREATE ${TABLE} CONTENT $data;`,
      { data: { ...data, createdAt: now, updatedAt: now } },
    );
    const created = records[0];
    if (!created) throw new Error('Creative create failed.');
    return toCreative(created);
  }

  async update(id: string, data: UpdateCreativeDto): Promise<Creative> {
    const now = new Date().toISOString();
    const records = await this.db.update<CreativeRecord, Record<string, unknown>>(
      createRecordId(TABLE, id),
      { ...data, updatedAt: now },
    );
    const updated = records[0];
    if (!updated) throw new Error(`Creative update failed for id: ${id}`);
    return toCreative(updated);
  }

  async delete(id: string): Promise<void> {
    await this.db.delete<CreativeRecord>(createRecordId(TABLE, id));
  }
}
