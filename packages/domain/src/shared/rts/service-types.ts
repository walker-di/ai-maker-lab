import type { Faction, AiDifficulty } from './factions.js';
import type { MapDefinition, MapMetadata } from './map-types.js';

export interface ResolvedRtsMap {
  id: string;
  metadata: MapMetadata;
  definition: MapDefinition;
  source: 'builtin' | 'user' | 'generated';
  builtInId?: string;
  isEditable: boolean;
}

export interface ListMatchResultsFilter {
  mapId?: string;
  winner?: string;
  /** ISO. */
  since?: string;
  /** ISO. */
  until?: string;
  limit?: number;
}

export interface MatchResultRecord {
  id: string;
  matchId: string;
  mapId: string;
  winner: string;
  durationMs: number;
  factions: {
    id: string;
    label: string;
    isPlayer: boolean;
    isAi: boolean;
    aiDifficulty?: AiDifficulty;
    color?: string;
  }[];
  finishedAt: string;
}

export interface UserMapRecord {
  id: string;
  ownerId?: string;
  definition: MapDefinition;
  /** Generation params if the map was generated; omitted for hand-authored. */
  params?: import('./generation/params.js').MapGenerationParams;
  metadata: MapMetadata;
}

/**
 * Helper used by both repositories and use cases that want to project a
 * `MatchResult` into a record-shape for persistence and listing without
 * importing the application layer.
 */
export function toMatchResultRecord(
  matchId: string,
  mapId: string,
  winner: string,
  durationMs: number,
  factions: Faction[],
  finishedAt: string,
  id: string = matchId,
): MatchResultRecord {
  return {
    id,
    matchId,
    mapId,
    winner,
    durationMs,
    factions: factions.map((f) => ({
      id: f.id,
      label: f.label,
      isPlayer: f.isPlayer,
      isAi: f.isAi,
      aiDifficulty: f.aiDifficulty,
      color: f.color,
    })),
    finishedAt,
  };
}
