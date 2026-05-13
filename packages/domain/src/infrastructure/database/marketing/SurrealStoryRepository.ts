import type { IDbClient } from '../../../core/interfaces/IDbClient.js';
import type { IStoryRepository } from '../../../application/marketing/ports.js';
import type { Story, CreateStoryDto, UpdateStoryDto, AudioSettings } from '../../../shared/marketing/index.js';
import { isMissingTableError } from '../error-helpers.js';
import { createRecordId, normalizeRecordIdValue } from '../record-id.js';

const TABLE = 'marketing_story';

type StoryRecord = {
  id: unknown;
  creativeId: string;
  title: string;
  description?: string;
  audioSettings: AudioSettings;
  totalDuration?: number;
  createdAt: string;
  updatedAt: string;
};

function toStory(record: StoryRecord): Story {
  return {
    id: normalizeRecordIdValue(String(record.id)),
    creativeId: record.creativeId,
    title: record.title,
    description: record.description,
    audioSettings: record.audioSettings ?? {},
    totalDuration: record.totalDuration,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export class SurrealStoryRepository implements IStoryRepository {
  constructor(private readonly db: IDbClient) {}

  async findAll(): Promise<Story[]> {
    const [records = []] = await this.db.query<StoryRecord[]>(
      `SELECT * FROM ${TABLE} ORDER BY createdAt;`,
    );
    return records.map(toStory);
  }

  async findById(id: string): Promise<Story | null> {
    const records = await this.db.select<StoryRecord>(createRecordId(TABLE, id));
    const record = records[0];
    return record ? toStory(record) : null;
  }

  async findByCreativeId(creativeId: string): Promise<Story[]> {
    try {
      const [records = []] = await this.db.query<StoryRecord[]>(
        `SELECT * FROM ${TABLE} WHERE creativeId = $creativeId ORDER BY createdAt;`,
        { creativeId },
      );
      return records.map(toStory);
    } catch (error) {
      if (isMissingTableError(error)) return [];
      throw error;
    }
  }

  async create(data: CreateStoryDto): Promise<Story> {
    const now = new Date().toISOString();
    const [records = []] = await this.db.query<StoryRecord[]>(
      `CREATE ${TABLE} CONTENT $data;`,
      { data: { ...data, createdAt: now, updatedAt: now } },
    );
    const created = records[0];
    if (!created) throw new Error('Story create failed.');
    return toStory(created);
  }

  async update(id: string, data: UpdateStoryDto): Promise<Story> {
    const now = new Date().toISOString();
    const records = await this.db.merge<StoryRecord, Record<string, unknown>>(
      createRecordId(TABLE, id),
      { ...data, updatedAt: now },
    );
    const updated = records[0];
    if (!updated) throw new Error(`Story update failed for id: ${id}`);
    return toStory(updated);
  }

  async delete(id: string): Promise<void> {
    await this.db.delete<StoryRecord>(createRecordId(TABLE, id));
  }
}
