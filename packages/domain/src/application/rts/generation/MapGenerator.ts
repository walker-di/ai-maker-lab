import {
  Generation,
  SeededRng,
  validateMapDefinition,
  type MapDefinition,
} from '../../../shared/rts/index.js';
import { generateHeightmap } from './pipeline/heightmap.js';
import { buildBiomeTerrain } from './pipeline/biome.js';
import { applyHydrology } from './pipeline/hydrology.js';
import { applyCliffsAndRamps } from './pipeline/cliffs.js';
import { placeSpawns } from './pipeline/spawns.js';
import { placeResources } from './pipeline/resources.js';

export interface GenerateResult {
  map: MapDefinition;
  params: Generation.MapGenerationParams;
}

export class MapGenerationFailed extends Error {
  constructor(
    public readonly params: Generation.MapGenerationParams,
    public readonly lastIssues: import('../../../shared/rts/index.js').MapValidationIssue[],
  ) {
    super(`Map generation failed after retries: ${lastIssues.map((i) => i.code).join(', ')}`);
    this.name = 'MapGenerationFailed';
  }
}

export const RETRY_LIMIT = 8;

export class MapGenerator {
  generate(input: Generation.MapGenerationParams): GenerateResult {
    const guards = Generation.ARCHETYPE_GUARDS[input.archetype];
    const params: Generation.MapGenerationParams = {
      ...input,
      size: {
        cols: Math.max(guards.minSize.cols, input.size.cols),
        rows: Math.max(guards.minSize.rows, input.size.rows),
      },
      version: input.version || Generation.MAP_GENERATION_PARAMS_VERSION,
    };

    let workingSeed = params.seed | 0;
    let lastIssues: import('../../../shared/rts/index.js').MapValidationIssue[] = [];

    for (let attempt = 0; attempt < RETRY_LIMIT; attempt++) {
      const result = this.tryGenerate({ ...params, seed: workingSeed });
      if (result) {
        const validation = validateMapDefinition(result);
        if (validation.ok) {
          return { map: result, params: { ...params, seed: workingSeed } };
        }
        lastIssues = validation.errors;
      } else {
        lastIssues = [{ code: 'spawn.placement-failed', message: 'Could not place valid spawns.' }];
      }
      const wrap = SeededRng.fromString(`retry-${attempt}`, workingSeed);
      workingSeed = wrap.nextU32() | 0;
    }

    throw new MapGenerationFailed(params, lastIssues);
  }

  private tryGenerate(params: Generation.MapGenerationParams): MapDefinition | null {
    const guards = Generation.ARCHETYPE_GUARDS[params.archetype];
    const rngRoot = new SeededRng(params.seed | 0);
    const altitude = generateHeightmap(
      rngRoot.fork('altitude'),
      params.size,
      params.maxAltitude,
      params.altitudeRoughness,
      guards.altitudeAmplitude,
    );

    const terrain = buildBiomeTerrain(altitude, params.size, params.maxAltitude);
    applyHydrology(terrain, altitude, Math.max(guards.waterBias * 0.5, params.waterAmount));
    applyCliffsAndRamps(terrain, altitude, rngRoot.fork('cliffs'), params.ramps, params.maxAltitude);

    const spawns = placeSpawns({
      terrain,
      altitude,
      size: params.size,
      factionCount: Math.max(1, params.factionCount),
      symmetry: params.symmetry,
      rng: rngRoot.fork('spawns'),
      spawnOrderSalt: params.spawnOrderSalt,
    });
    if (!spawns) return null;

    const resources = placeResources({
      terrain,
      size: params.size,
      spawns,
      symmetry: params.symmetry,
      density: params.resourceDensity,
      amountMultiplier: params.resourceAmountMultiplier ?? 1,
      rng: rngRoot.fork('resources'),
    });

    return {
      id: `gen-${params.seed}-${params.archetype}`,
      version: 1,
      size: params.size,
      tileSize: { width: 64, height: 32 },
      maxAltitude: params.maxAltitude,
      terrain,
      altitude,
      resources,
      spawns,
      metadata: {
        title: `${params.archetype}-${params.size.cols}x${params.size.rows}-${params.seed}`,
        author: 'generator',
        createdAt: '1970-01-01T00:00:00Z',
        updatedAt: '1970-01-01T00:00:00Z',
        source: 'generated',
      },
    };
  }
}
