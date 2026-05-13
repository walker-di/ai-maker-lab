import type { Rts } from 'domain/shared';

type MapDefinition = Rts.MapDefinition;
type MatchDefinition = Rts.MatchDefinition;
type MatchResult = Rts.MatchResult;
type MatchResultRecord = Rts.MatchResultRecord;
type ResolvedRtsMap = Rts.ResolvedRtsMap;
type UserMapRecord = Rts.UserMapRecord;
type MapGenerationParams = Rts.Generation.MapGenerationParams;

export type RtsRuntimeMode = 'desktop' | 'web';

export interface StartMatchInput {
  mapId: string;
  factions: Rts.Faction[];
  rules: Partial<Rts.MatchRules>;
  matchId?: string;
}

export interface SaveUserMapInput {
  map: MapDefinition;
  params?: MapGenerationParams;
  title: string;
  author: string;
}

export interface RtsTransport {
  listMaps(): Promise<ResolvedRtsMap[]>;
  getMap(id: string): Promise<ResolvedRtsMap | null>;
  generateMap(params: MapGenerationParams): Promise<{ map: MapDefinition; params: MapGenerationParams }>;
  saveUserMap(input: SaveUserMapInput): Promise<UserMapRecord>;
  listUserMaps(): Promise<UserMapRecord[]>;
  getUserMap(id: string): Promise<UserMapRecord | null>;
  deleteUserMap(id: string): Promise<void>;
  startMatch(input: StartMatchInput): Promise<{ match: MatchDefinition; map: ResolvedRtsMap }>;
  recordMatchResult(result: MatchResult): Promise<MatchResultRecord>;
  listMatchResults(filter?: { mapId?: string; winner?: string; since?: string; until?: string; limit?: number }): Promise<MatchResultRecord[]>;
}
