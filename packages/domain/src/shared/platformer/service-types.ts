import type { MapDefinition, MapMetadata } from './map-types.js';

export interface ResolvedMapEntry {
  id: string;
  metadata: MapMetadata;
  definition: MapDefinition;
  source: 'builtin' | 'user';
  builtInId?: string;
  inheritsFromBuiltInId?: string;
  isEditable: boolean;
}

export type RunOutcome = 'completed' | 'gameOver';

export interface RunResult {
  worldId: string;
  levelId: string;
  outcome: RunOutcome;
  score: number;
  coins: number;
  timeMs: number;
  /** ISO 8601 */
  completedAt: string;
}
