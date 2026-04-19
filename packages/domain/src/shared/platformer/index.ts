export {
  TILE_KINDS,
  type TileKind,
  type TileMetadata,
  getTileMetadata,
  isSolidTile,
} from './tile-types.js';

export {
  ENTITY_KINDS,
  PLACEABLE_ENTITY_KINDS,
  type EntityKind,
  type EntityParamValue,
  type EntitySpawn,
} from './entity-types.js';

export type {
  GoalKind,
  LevelDefinition,
  MapDefinition,
  MapMetadata,
  MapSource,
  ScrollMode,
  WorldDefinition,
} from './map-types.js';

export {
  POWER_UP_KINDS,
  createDefaultPlayerProfile,
  type PlayerProfile,
  type PowerUpKind,
} from './player-types.js';

export type {
  ResolvedMapEntry,
  RunOutcome,
  RunResult,
} from './service-types.js';

export {
  validateMapDefinition,
  type MapValidationIssue,
  type MapValidationResult,
} from './validation.js';
