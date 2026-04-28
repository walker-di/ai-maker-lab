import type { IDbClient } from '../../../core/interfaces/IDbClient.js';
import type { IClipRepository } from '../../../application/marketing/ports.js';
import type { Clip, ClipMediaType, CreateClipDto, UpdateClipDto } from '../../../shared/marketing/index.js';
import { createRecordId, normalizeRecordIdValue } from '../record-id.js';

const TABLE = 'marketing_clip';

type ClipRecord = {
  id: unknown;
  sceneId: string;
  orderIndex: number;
  type: ClipMediaType;
  content?: string;
  imageUrl?: string;
  videoUrl?: string;
  narrationText?: string;
  narrationAudioUrl?: string;
  durationMs?: number;
  mainImagePrompt?: string;
  createdAt: string;
  updatedAt: string;
};

function toClip(record: ClipRecord): Clip {
  return {
    id: normalizeRecordIdValue(String(record.id)),
    sceneId: record.sceneId,
    orderIndex: record.orderIndex,
    type: record.type,
    content: record.content,
    imageUrl: record.imageUrl,
    videoUrl: record.videoUrl,
    narrationText: record.narrationText,
    narrationAudioUrl: record.narrationAudioUrl,
    durationMs: record.durationMs,
    mainImagePrompt: record.mainImagePrompt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function isMissingTableError(error: unknown): boolean {
  return error instanceof Error && error.message.toLowerCase().includes("table 'marketing_clip' does not exist");
}

export class SurrealClipRepository implements IClipRepository {
  constructor(private readonly db: IDbClient) {}

  async findAll(): Promise<Clip[]> {
    const [records = []] = await this.db.query<ClipRecord[]>(
      `SELECT * FROM ${TABLE} ORDER BY createdAt;`,
    );
    return records.map(toClip);
  }

  async findById(id: string): Promise<Clip | null> {
    const records = await this.db.select<ClipRecord>(createRecordId(TABLE, id));
    const record = records[0];
    return record ? toClip(record) : null;
  }

  async findBySceneId(sceneId: string): Promise<Clip[]> {
    try {
      const [records = []] = await this.db.query<ClipRecord[]>(
        `SELECT * FROM ${TABLE} WHERE sceneId = $sceneId ORDER BY orderIndex;`,
        { sceneId },
      );
      return records.map(toClip);
    } catch (error) {
      if (isMissingTableError(error)) return [];
      throw error;
    }
  }

  async create(data: CreateClipDto): Promise<Clip> {
    const now = new Date().toISOString();
    const [records = []] = await this.db.query<ClipRecord[]>(
      `CREATE ${TABLE} CONTENT $data;`,
      { data: { ...data, createdAt: now, updatedAt: now } },
    );
    const created = records[0];
    if (!created) throw new Error('Clip create failed.');
    return toClip(created);
  }

  async update(id: string, data: UpdateClipDto): Promise<Clip> {
    const now = new Date().toISOString();
    const records = await this.db.merge<ClipRecord, Record<string, unknown>>(
      createRecordId(TABLE, id),
      { ...data, updatedAt: now },
    );
    const updated = records[0];
    if (!updated) throw new Error(`Clip update failed for id: ${id}`);
    return toClip(updated);
  }

  async delete(id: string): Promise<void> {
    await this.db.delete<ClipRecord>(createRecordId(TABLE, id));
  }
}
