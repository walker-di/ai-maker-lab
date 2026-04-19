import { describe, expect, it } from 'bun:test';
import { ArenaCatalogService } from './ArenaCatalogService.js';
import type {
  BuiltInArenaEntry,
  CreateUserArenaInput,
  IBuiltInArenaSource,
  IUserArenaRepository,
  UpdateUserArenaPatch,
  UserArenaRecord,
} from './ports.js';
import type { ArenaDefinition, ArenaMetadata } from '../../shared/voxsim/index.js';

function tinyDef(id: string): ArenaDefinition {
  return {
    id,
    version: 1,
    chunkSize: { sx: 4, sy: 4, sz: 4 },
    voxelSize: 1,
    bounds: { min: { cx: 0, cy: 0, cz: 0 }, max: { cx: 0, cy: 0, cz: 0 } },
    chunks: [],
    spawns: [
      {
        id: 'spawn',
        tag: 't',
        pose: { position: { x: 1, y: 1, z: 1 }, rotation: { x: 0, y: 0, z: 0, w: 1 } },
      },
    ],
    entities: [],
    gravity: { x: 0, y: -9.81, z: 0 },
    skybox: 'default',
  };
}

function meta(title: string, source: 'builtin' | 'user' = 'builtin', updatedAt = '2026-01-01T00:00:00.000Z'): ArenaMetadata {
  return { title, author: 'test', createdAt: updatedAt, updatedAt, source };
}

class FakeBuiltIns implements IBuiltInArenaSource {
  constructor(private readonly entries: BuiltInArenaEntry[]) {}
  async listArenas() {
    return this.entries.map((e) => ({ ...e }));
  }
  async findArena(id: string) {
    const hit = this.entries.find((e) => e.id === id);
    return hit ? { ...hit } : undefined;
  }
}

class FakeUserRepo implements IUserArenaRepository {
  private records = new Map<string, UserArenaRecord>();
  private nextId = 1;
  async list() {
    return Array.from(this.records.values());
  }
  async findById(id: string) {
    return this.records.get(id);
  }
  async create(input: CreateUserArenaInput) {
    const id = `user-${this.nextId++}`;
    const now = new Date(2026, 0, this.nextId).toISOString();
    const record: UserArenaRecord = {
      id,
      metadata: input.metadata,
      definition: input.definition,
      inheritsFromBuiltInId: input.inheritsFromBuiltInId,
      createdAt: now,
      updatedAt: now,
    };
    this.records.set(id, record);
    return record;
  }
  async update(id: string, patch: UpdateUserArenaPatch) {
    const existing = this.records.get(id);
    if (!existing) throw new Error('not found');
    const updated: UserArenaRecord = {
      ...existing,
      metadata: patch.metadata ?? existing.metadata,
      definition: patch.definition ?? existing.definition,
      updatedAt: new Date().toISOString(),
    };
    this.records.set(id, updated);
    return updated;
  }
  async delete(id: string) {
    this.records.delete(id);
  }
}

describe('ArenaCatalogService', () => {
  it('lists built-ins first then user arenas sorted by updatedAt desc', async () => {
    const builtIns = new FakeBuiltIns([
      { id: 'flat', metadata: meta('Flat'), definition: tinyDef('flat') },
      { id: 'slope', metadata: meta('Slope'), definition: tinyDef('slope') },
    ]);
    const users = new FakeUserRepo();
    await users.create({ metadata: meta('Alpha', 'user', '2026-02-01T00:00:00.000Z'), definition: tinyDef('alpha') });
    await users.create({ metadata: meta('Beta', 'user', '2026-03-01T00:00:00.000Z'), definition: tinyDef('beta') });
    // Force updatedAt explicitly:
    const all = await users.list();
    all[0]!.updatedAt = '2026-02-01T00:00:00.000Z';
    all[1]!.updatedAt = '2026-03-01T00:00:00.000Z';

    const service = new ArenaCatalogService({ builtIns, users });
    const result = await service.listResolved();

    expect(result.map((e) => e.id)).toEqual(['flat', 'slope', all[1]!.id, all[0]!.id]);
    expect(result[0]!.source).toBe('builtin');
    expect(result[0]!.isEditable).toBe(false);
    expect(result[0]!.builtInId).toBe('flat');
    expect(result[2]!.source).toBe('user');
    expect(result[2]!.isEditable).toBe(true);
  });

  it('loadResolved returns built-ins when matched', async () => {
    const builtIns = new FakeBuiltIns([
      { id: 'flat', metadata: meta('Flat'), definition: tinyDef('flat') },
    ]);
    const users = new FakeUserRepo();
    const service = new ArenaCatalogService({ builtIns, users });

    const entry = await service.loadResolved('flat');
    expect(entry).toBeDefined();
    expect(entry!.source).toBe('builtin');
    expect(entry!.builtInId).toBe('flat');
    expect(entry!.isEditable).toBe(false);
  });

  it('loadResolved returns user arenas when no built-in matches', async () => {
    const builtIns = new FakeBuiltIns([]);
    const users = new FakeUserRepo();
    const created = await users.create({
      metadata: meta('My Arena', 'user'),
      definition: tinyDef('mine'),
      inheritsFromBuiltInId: 'flat',
    });
    const service = new ArenaCatalogService({ builtIns, users });

    const entry = await service.loadResolved(created.id);
    expect(entry).toBeDefined();
    expect(entry!.source).toBe('user');
    expect(entry!.isEditable).toBe(true);
    expect(entry!.inheritsFromBuiltInId).toBe('flat');
  });

  it('loadResolved returns undefined for unknown ids', async () => {
    const builtIns = new FakeBuiltIns([]);
    const users = new FakeUserRepo();
    const service = new ArenaCatalogService({ builtIns, users });
    expect(await service.loadResolved('nope')).toBeUndefined();
  });
});
