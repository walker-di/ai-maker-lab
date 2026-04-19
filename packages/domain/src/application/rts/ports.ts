import type {
  ListMatchResultsFilter,
  MapDefinition,
  MatchResult,
  MatchResultRecord,
  ResolvedRtsMap,
  UserMapRecord,
  Generation,
} from '../../shared/rts/index.js';

export interface IRtsMapSource {
  listMaps(): Promise<MapDefinition[]>;
  findMap(id: string): Promise<MapDefinition | undefined>;
}

export interface IMatchResultRepository {
  record(result: MatchResult): Promise<MatchResultRecord>;
  list(filter?: ListMatchResultsFilter): Promise<MatchResultRecord[]>;
  findById(id: string): Promise<MatchResultRecord | undefined>;
}

export interface SaveUserMapInput {
  map: MapDefinition;
  params?: Generation.MapGenerationParams;
  title: string;
  author: string;
}

export interface IUserMapRepository {
  list(): Promise<UserMapRecord[]>;
  findById(id: string): Promise<UserMapRecord | undefined>;
  save(record: UserMapRecord): Promise<UserMapRecord>;
  remove(id: string): Promise<void>;
}

export interface IMapValidator {
  validate(map: MapDefinition): import('../../shared/rts/index.js').MapValidationResult;
}
