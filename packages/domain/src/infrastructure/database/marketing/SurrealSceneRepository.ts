import type { IDbClient } from '../../../core/interfaces/IDbClient.js';
import type { ISceneRepository } from '../../../application/marketing/ports.js';
import type { Scene, CreateSceneDto, UpdateSceneDto, StoryboardTransitionType } from '../../../shared/marketing/index.js';
import { isMissingTableError } from '../error-helpers.js';
import { createRecordId, normalizeRecordIdValue } from '../record-id.js';

const TABLE = 'marketing_scene';

type SceneRecord = {
  id: unknown;
  storyId: string;
  orderIndex: number;
  description?: string;
  durationMs?: number;
  canvasData?: string;
  bgmId?: string;
  transitionId?: string;
  backgroundImagePrompt?: string;
  backgroundImageUrl?: string;
  bgmPrompt?: string;
  bgmUrl?: string;
  transitionTypeAfter?: StoryboardTransitionType;
  transitionDurationMs?: number;
  createdAt: string;
  updatedAt: string;
};

function toScene(record: SceneRecord): Scene {
  return {
    id: normalizeRecordIdValue(String(record.id)),
    storyId: record.storyId,
    orderIndex: record.orderIndex,
    description: record.description,
    durationMs: record.durationMs,
    canvasData: record.canvasData,
    bgmId: record.bgmId,
    transitionId: record.transitionId,
    backgroundImagePrompt: record.backgroundImagePrompt,
    backgroundImageUrl: record.backgroundImageUrl,
    bgmPrompt: record.bgmPrompt,
    bgmUrl: record.bgmUrl,
    transitionTypeAfter: record.transitionTypeAfter,
    transitionDurationMs: record.transitionDurationMs,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export class SurrealSceneRepository implements ISceneRepository {
  constructor(private readonly db: IDbClient) {}

  async findAll(): Promise<Scene[]> {
    const [records = []] = await this.db.query<SceneRecord[]>(
      `SELECT * FROM ${TABLE} ORDER BY createdAt;`,
    );
    return records.map(toScene);
  }

  async findById(id: string): Promise<Scene | null> {
    const records = await this.db.select<SceneRecord>(createRecordId(TABLE, id));
    const record = records[0];
    return record ? toScene(record) : null;
  }

  async findByStoryId(storyId: string): Promise<Scene[]> {
    try {
      const [records = []] = await this.db.query<SceneRecord[]>(
        `SELECT * FROM ${TABLE} WHERE storyId = $storyId ORDER BY orderIndex;`,
        { storyId },
      );
      return records.map(toScene);
    } catch (error) {
      if (isMissingTableError(error)) return [];
      throw error;
    }
  }

  async create(data: CreateSceneDto): Promise<Scene> {
    const now = new Date().toISOString();
    const [records = []] = await this.db.query<SceneRecord[]>(
      `CREATE ${TABLE} CONTENT $data;`,
      { data: { ...data, createdAt: now, updatedAt: now } },
    );
    const created = records[0];
    if (!created) throw new Error('Scene create failed.');
    return toScene(created);
  }

  async update(id: string, data: UpdateSceneDto): Promise<Scene> {
    const now = new Date().toISOString();
    const records = await this.db.merge<SceneRecord, Record<string, unknown>>(
      createRecordId(TABLE, id),
      { ...data, updatedAt: now },
    );
    const updated = records[0];
    if (!updated) throw new Error(`Scene update failed for id: ${id}`);
    return toScene(updated);
  }

  async delete(id: string): Promise<void> {
    await this.db.delete<SceneRecord>(createRecordId(TABLE, id));
  }
}
