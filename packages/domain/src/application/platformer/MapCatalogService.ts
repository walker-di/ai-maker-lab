import type {
  IBuiltInWorldRepository,
  IMapCatalogService,
  IPlayerProgressRepository,
  IUserMapRepository,
  ListMapsOptions,
  PlayerProgressRecord,
  RecordRunResultInput,
  SaveUserMapInput,
  UserMapRecord,
} from './ports.js';
import {
  createDefaultPlayerProfile,
  validateMapDefinition,
  type MapMetadata,
  type PlayerProfile,
  type ResolvedMapEntry,
  type WorldDefinition,
} from '../../shared/platformer/index.js';

const HISTORY_LIMIT = 50;

/**
 * Aggregates built-in worlds, user-authored maps, and player progress into a
 * single `ResolvedMapEntry[]` view consumed by the runtime and editor.
 */
export class MapCatalogService implements IMapCatalogService {
  constructor(
    private readonly builtIns: IBuiltInWorldRepository,
    private readonly userMaps: IUserMapRepository,
    private readonly progress: IPlayerProgressRepository,
  ) {}

  async listBuiltInWorlds(): Promise<WorldDefinition[]> {
    return this.builtIns.listWorlds();
  }

  async listMaps(options: ListMapsOptions = {}): Promise<ResolvedMapEntry[]> {
    const source = options.source ?? 'all';
    const result: ResolvedMapEntry[] = [];
    if (source === 'all' || source === 'builtin') {
      const worlds = await this.builtIns.listWorlds();
      for (const world of worlds) {
        for (const level of world.levels) {
          result.push({
            id: `${world.id}/${level.id}`,
            metadata: {
              title: level.label,
              author: 'Built-in',
              createdAt: '1970-01-01T00:00:00Z',
              updatedAt: '1970-01-01T00:00:00Z',
              source: 'builtin',
            },
            definition: level.map,
            source: 'builtin',
            builtInId: `${world.id}/${level.id}`,
            isEditable: false,
          });
        }
      }
    }
    if (source === 'all' || source === 'user') {
      const records = await this.userMaps.list();
      for (const record of records) {
        result.push({
          id: record.id,
          metadata: record.metadata,
          definition: record.definition,
          source: 'user',
          inheritsFromBuiltInId: record.builtInId,
          isEditable: true,
        });
      }
    }
    return result;
  }

  async getMap(id: string): Promise<ResolvedMapEntry | null> {
    if (id.includes('/')) {
      const [worldId, levelId] = id.split('/', 2);
      const world = await this.builtIns.getWorld(worldId!);
      const level = world?.levels.find((l) => l.id === levelId);
      if (!world || !level) return null;
      return {
        id,
        metadata: {
          title: level.label,
          author: 'Built-in',
          createdAt: '1970-01-01T00:00:00Z',
          updatedAt: '1970-01-01T00:00:00Z',
          source: 'builtin',
        },
        definition: level.map,
        source: 'builtin',
        builtInId: id,
        isEditable: false,
      };
    }
    const user = await this.userMaps.get(id);
    if (!user) return null;
    return {
      id: user.id,
      metadata: user.metadata,
      definition: user.definition,
      source: 'user',
      inheritsFromBuiltInId: user.builtInId,
      isEditable: true,
    };
  }

  async saveUserMap(input: SaveUserMapInput): Promise<ResolvedMapEntry> {
    const validation = validateMapDefinition(input.definition);
    if (!validation.ok) {
      throw new Error(`Invalid map: ${validation.errors.map((e) => e.message).join('; ')}`);
    }
    const record: UserMapRecord = {
      id: input.id ?? `user-${Date.now()}`,
      metadata: input.metadata,
      definition: input.definition,
      builtInId: input.builtInId,
    };
    const saved = await this.userMaps.save(record);
    return {
      id: saved.id,
      metadata: saved.metadata,
      definition: saved.definition,
      source: 'user',
      inheritsFromBuiltInId: saved.builtInId,
      isEditable: true,
    };
  }

  async deleteUserMap(id: string): Promise<void> {
    await this.userMaps.remove(id);
  }

  async duplicateBuiltIn(builtInId: string, metadata: Partial<MapMetadata> & { author?: string } = {}): Promise<ResolvedMapEntry> {
    const source = await this.getMap(builtInId);
    if (!source || source.source !== 'builtin') {
      throw new Error(`Built-in map ${builtInId} not found`);
    }
    const now = new Date().toISOString();
    const meta: MapMetadata = {
      title: metadata.title ?? `${source.metadata.title} (copy)`,
      author: metadata.author ?? 'me',
      createdAt: now,
      updatedAt: now,
      source: 'user',
      inheritsFromBuiltInId: builtInId,
    };
    return this.saveUserMap({
      metadata: meta,
      definition: cloneMap(source.definition),
      builtInId,
    });
  }

  async recordRunResult(input: RecordRunResultInput): Promise<PlayerProgressRecord> {
    const existing = await this.progress.load(input.playerId);
    const profile: PlayerProfile = input.profile ?? existing?.profile ?? createDefaultPlayerProfile();
    const history = [...(existing?.history ?? []), input.result].slice(-HISTORY_LIMIT);
    const record: PlayerProgressRecord = {
      playerId: input.playerId,
      profile,
      history,
    };
    return this.progress.save(record);
  }

  async loadPlayerProfile(playerId: string): Promise<PlayerProgressRecord | null> {
    return this.progress.load(playerId);
  }
}

function cloneMap<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
