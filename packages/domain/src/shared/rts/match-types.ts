import type { AiDifficulty, Faction } from './factions.js';

export interface MatchRules {
  startingResources: { mineral: number; gas: number };
  populationCap: number;
  fogOfWar: boolean;
  aiDifficulty: AiDifficulty;
  rngSeed: number;
}

export interface MatchDefinition {
  id: string;
  mapId: string;
  factions: Faction[];
  rules: MatchRules;
}

export interface MatchResult {
  matchId: string;
  mapId: string;
  /** Faction id of the winner, or `'draw'`. */
  winner: string;
  durationMs: number;
  factions: Faction[];
  /** ISO timestamp. */
  finishedAt: string;
}
