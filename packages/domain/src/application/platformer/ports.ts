import type {
  MapDefinition,
  MapMetadata,
  PlayerProfile,
  ResolvedMapEntry,
  RunResult,
  WorldDefinition,
} from '../../shared/platformer/index.js';

export interface IBuiltInWorldRepository {
  listWorlds(): Promise<WorldDefinition[]>;
  getWorld(id: string): Promise<WorldDefinition | null>;
}

export interface UserMapRecord {
  id: string;
  metadata: MapMetadata;
  definition: MapDefinition;
  builtInId?: string;
}

export interface IUserMapRepository {
  list(): Promise<UserMapRecord[]>;
  get(id: string): Promise<UserMapRecord | null>;
  save(record: UserMapRecord): Promise<UserMapRecord>;
  remove(id: string): Promise<void>;
}

export interface PlayerProgressRecord {
  playerId: string;
  profile: PlayerProfile;
  history: RunResult[];
}

export interface IPlayerProgressRepository {
  load(playerId: string): Promise<PlayerProgressRecord | null>;
  save(record: PlayerProgressRecord): Promise<PlayerProgressRecord>;
}

export interface ListMapsOptions {
  playerId?: string;
  source?: 'builtin' | 'user' | 'all';
}

export interface RecordRunResultInput {
  playerId: string;
  result: RunResult;
  profile: PlayerProfile;
}

export interface SaveUserMapInput {
  id?: string;
  metadata: MapMetadata;
  definition: MapDefinition;
  builtInId?: string;
}

export interface IMapCatalogService {
  listMaps(options?: ListMapsOptions): Promise<ResolvedMapEntry[]>;
  getMap(id: string): Promise<ResolvedMapEntry | null>;
  saveUserMap(input: SaveUserMapInput): Promise<ResolvedMapEntry>;
  deleteUserMap(id: string): Promise<void>;
  duplicateBuiltIn(builtInId: string, metadata: Partial<MapMetadata> & { author?: string }): Promise<ResolvedMapEntry>;
  recordRunResult(input: RecordRunResultInput): Promise<PlayerProgressRecord>;
  loadPlayerProfile(playerId: string): Promise<PlayerProgressRecord | null>;
}
