import type { IDbClient } from '../../../core/interfaces/IDbClient.js';
import type { ISceneTransitionRepository } from '../../../application/marketing/ports.js';
import type { SceneTransition } from '../../../shared/marketing/index.js';
import { createRecordId, normalizeRecordIdValue } from '../record-id.js';

const TABLE = 'marketing_scene_transition';

type SceneTransitionRecord = {
  id: unknown;
  name: string;
  description?: string;
  css?: string;
  settings?: Record<string, unknown>;
  previewUrl?: string;
  createdAt: string;
  updatedAt: string;
};

function toSceneTransition(record: SceneTransitionRecord): SceneTransition {
  return {
    id: normalizeRecordIdValue(String(record.id)),
    name: record.name,
    description: record.description,
    css: record.css,
    settings: record.settings,
    previewUrl: record.previewUrl,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export class SurrealSceneTransitionRepository implements ISceneTransitionRepository {
  constructor(private readonly db: IDbClient) {}

  async findAll(): Promise<SceneTransition[]> {
    const [records = []] = await this.db.query<SceneTransitionRecord[]>(
      `SELECT * FROM ${TABLE} ORDER BY createdAt;`,
    );
    return records.map(toSceneTransition);
  }

  async findById(id: string): Promise<SceneTransition | null> {
    const records = await this.db.select<SceneTransitionRecord>(createRecordId(TABLE, id));
    const record = records[0];
    return record ? toSceneTransition(record) : null;
  }

  async create(data: Omit<SceneTransition, 'id' | 'createdAt' | 'updatedAt'>): Promise<SceneTransition> {
    const now = new Date().toISOString();
    const [records = []] = await this.db.query<SceneTransitionRecord[]>(
      `CREATE ${TABLE} CONTENT $data;`,
      { data: { ...data, createdAt: now, updatedAt: now } },
    );
    const created = records[0];
    if (!created) throw new Error('SceneTransition create failed.');
    return toSceneTransition(created);
  }

  async update(id: string, data: Partial<Omit<SceneTransition, 'id' | 'createdAt' | 'updatedAt'>>): Promise<SceneTransition> {
    const now = new Date().toISOString();
    const records = await this.db.update<SceneTransitionRecord, Record<string, unknown>>(
      createRecordId(TABLE, id),
      { ...data, updatedAt: now },
    );
    const updated = records[0];
    if (!updated) throw new Error(`SceneTransition update failed for id: ${id}`);
    return toSceneTransition(updated);
  }

  async delete(id: string): Promise<void> {
    await this.db.delete<SceneTransitionRecord>(createRecordId(TABLE, id));
  }
}
