import {
  Generation,
  SeededRng,
} from '../../../shared/rts/index.js';

const NEXT_DENSITY: Record<Generation.ResourceDensity, Generation.ResourceDensity> = {
  sparse: 'normal',
  normal: 'rich',
  rich: 'sparse',
};

export function reseed(params: Generation.MapGenerationParams): Generation.MapGenerationParams {
  const rng = new SeededRng(params.seed | 0);
  return { ...params, seed: rng.nextU32() | 0 };
}

export function swapSpawnPair(params: Generation.MapGenerationParams): Generation.MapGenerationParams {
  return { ...params, spawnOrderSalt: ((params.spawnOrderSalt ?? 0) + 1) & 1 };
}

export function scaleResources(
  params: Generation.MapGenerationParams,
  factor: number,
): Generation.MapGenerationParams {
  const safe = Math.max(0.25, Math.min(4, factor));
  return {
    ...params,
    resourceDensity: factor >= 1.5 ? 'rich' : factor <= 0.66 ? 'sparse' : 'normal',
    resourceAmountMultiplier: (params.resourceAmountMultiplier ?? 1) * safe,
  };
}

export function cycleArchetype(
  params: Generation.MapGenerationParams,
): Generation.MapGenerationParams {
  const idx = Generation.MAP_ARCHETYPES.indexOf(params.archetype);
  const next = Generation.MAP_ARCHETYPES[(idx + 1) % Generation.MAP_ARCHETYPES.length]!;
  return { ...params, archetype: next };
}

export function flipSymmetry(
  params: Generation.MapGenerationParams,
): Generation.MapGenerationParams {
  if (params.factionCount === 1) {
    return { ...params, symmetry: params.symmetry === 'none' ? 'mirrorH' : 'none' };
  }
  if (params.symmetry === 'mirrorH') return { ...params, symmetry: 'mirrorV' };
  if (params.symmetry === 'mirrorV') return { ...params, symmetry: 'rotational180' };
  return { ...params, symmetry: 'mirrorH' };
}

export function setSize(
  params: Generation.MapGenerationParams,
  cols: number,
  rows: number,
): Generation.MapGenerationParams {
  const guards = Generation.ARCHETYPE_GUARDS[params.archetype];
  return {
    ...params,
    size: {
      cols: Math.max(guards.minSize.cols, cols),
      rows: Math.max(guards.minSize.rows, rows),
    },
  };
}

export function nextResourceDensity(
  params: Generation.MapGenerationParams,
): Generation.MapGenerationParams {
  return { ...params, resourceDensity: NEXT_DENSITY[params.resourceDensity] };
}
