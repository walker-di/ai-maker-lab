import type {
  Faction,
  MatchDefinition,
  MatchRules,
  ResolvedRtsMap,
} from '../../../shared/rts/index.js';
import type { MapCatalogService } from '../MapCatalogService.js';

export interface StartMatchInput {
  mapId: string;
  factions: Faction[];
  rules: Partial<MatchRules> & { aiDifficulty?: MatchRules['aiDifficulty'] };
  /** Optional explicit match id; otherwise generated from a hash. */
  matchId?: string;
}

export interface StartMatchUseCase {
  execute(input: StartMatchInput): Promise<{
    match: MatchDefinition;
    map: ResolvedRtsMap;
  }>;
}

export function createStartMatch(catalog: MapCatalogService): StartMatchUseCase {
  return {
    async execute(input) {
      const map = await catalog.loadResolved(input.mapId);
      if (!map) {
        throw new Error(`Map not found: ${input.mapId}`);
      }
      const spawnCount = map.definition.spawns.length;
      if (input.factions.length > spawnCount) {
        throw new Error(
          `Map ${input.mapId} only has ${spawnCount} spawns; received ${input.factions.length} factions.`,
        );
      }
      const seed = input.rules.rngSeed ?? hashSeed(`${input.mapId}:${Date.now()}`);
      const rules: MatchRules = {
        startingResources: input.rules.startingResources ?? { mineral: 100, gas: 0 },
        populationCap: input.rules.populationCap ?? 12,
        fogOfWar: input.rules.fogOfWar ?? true,
        aiDifficulty: input.rules.aiDifficulty ?? 'normal',
        rngSeed: seed,
      };
      const match: MatchDefinition = {
        id: input.matchId ?? `match-${seed}-${Date.now()}`,
        mapId: input.mapId,
        factions: input.factions,
        rules,
      };
      return { match, map };
    },
  };
}

function hashSeed(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h | 0) || 1;
}
