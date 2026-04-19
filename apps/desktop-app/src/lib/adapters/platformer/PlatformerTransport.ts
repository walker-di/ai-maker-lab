import type { Platformer } from 'domain/shared';

type MapDefinition = Platformer.MapDefinition;
type MapMetadata = Platformer.MapMetadata;
type PlayerProfile = Platformer.PlayerProfile;
type ResolvedMapEntry = Platformer.ResolvedMapEntry;
type RunResult = Platformer.RunResult;

export type PlatformerRuntimeMode = 'desktop' | 'web';

export interface SaveUserMapInput {
  id?: string;
  metadata: MapMetadata;
  definition: MapDefinition;
  builtInId?: string;
}

export interface RecordRunResultInput {
  playerId: string;
  result: RunResult;
  profile: PlayerProfile;
}

export interface PlayerProgressRecord {
  playerId: string;
  profile: PlayerProfile;
  history: RunResult[];
}

export interface PlatformerTransport {
  listMaps(options?: { source?: 'builtin' | 'user' | 'all'; playerId?: string }): Promise<ResolvedMapEntry[]>;
  getMap(id: string): Promise<ResolvedMapEntry | null>;
  saveUserMap(input: SaveUserMapInput): Promise<ResolvedMapEntry>;
  deleteUserMap(id: string): Promise<void>;
  duplicateBuiltIn(builtInId: string, metadata?: Partial<MapMetadata>): Promise<ResolvedMapEntry>;
  recordRunResult(input: RecordRunResultInput): Promise<PlayerProgressRecord>;
  loadPlayerProfile(playerId: string): Promise<PlayerProgressRecord | null>;
}
