import { describe, expect, it } from 'bun:test';

import type { NeatGenome } from '../../../../shared/voxsim/index.js';
import { createMulberry32 } from '../prng.js';
import { SpeciesRegistry } from './SpeciesRegistry.js';

function makeGenome(id: string, weights: number[]): NeatGenome {
  return {
    id,
    nodes: [
      { id: 1, kind: 'input', activation: 'linear', bias: 0, inputBindingId: 'in' },
      { id: 2, kind: 'output', activation: 'tanh', bias: 0, outputBindingId: 'out' },
    ],
    connections: weights.map((w, i) => ({
      innovation: i + 1,
      sourceNodeId: 1,
      targetNodeId: 2,
      weight: w,
      enabled: true,
    })),
    nextLocalNodeId: 3,
  };
}

describe('SpeciesRegistry', () => {
  it('groups close genomes into the same species and splits distant ones', () => {
    const registry = new SpeciesRegistry({
      config: {
        compatibilityThreshold: 0.5,
        c1ExcessCoeff: 1,
        c2DisjointCoeff: 1,
        c3WeightCoeff: 1,
      },
      prng: createMulberry32(1),
    });
    const a = makeGenome('a', [0.1, 0.2]);
    const b = makeGenome('b', [0.15, 0.25]);
    const c = makeGenome('c', [10, 10]);
    const idA = registry.assign(a, 1, 0);
    const idB = registry.assign(b, 1, 0);
    const idC = registry.assign(c, 1, 0);
    expect(idA).toBe(idB);
    expect(idA).not.toBe(idC);
  });

  it('adjustThreshold nudges toward the target species count', () => {
    const registry = new SpeciesRegistry({
      config: {
        compatibilityThreshold: 3,
        c1ExcessCoeff: 1,
        c2DisjointCoeff: 1,
        c3WeightCoeff: 1,
        targetSpeciesCount: 4,
        thresholdAdjustStep: 0.5,
      },
      prng: createMulberry32(1),
    });
    registry.adjustThreshold(2);
    expect(registry.threshold()).toBeCloseTo(2.5, 5);
    registry.adjustThreshold(8);
    expect(registry.threshold()).toBeCloseTo(3.0, 5);
  });

  it('pruneStagnant removes species whose best score has not improved', () => {
    const registry = new SpeciesRegistry({
      config: {
        compatibilityThreshold: 0.5,
        c1ExcessCoeff: 1,
        c2DisjointCoeff: 1,
        c3WeightCoeff: 1,
      },
      prng: createMulberry32(1),
    });
    const g = makeGenome('a', [0.1]);
    const id = registry.assign(g, 1, 0);
    registry.endGeneration();
    registry.beginGeneration();
    registry.assign(makeGenome('a2', [0.1]), 0.5, 1);
    registry.endGeneration();
    registry.beginGeneration();
    registry.assign(makeGenome('a3', [0.1]), 0.5, 2);
    registry.endGeneration();
    const removed = registry.pruneStagnant(2);
    expect(removed).toContain(id);
  });

  it('mergeSmallSpecies merges below-threshold species into the closest neighbor', () => {
    const registry = new SpeciesRegistry({
      config: {
        compatibilityThreshold: 0.05,
        c1ExcessCoeff: 1,
        c2DisjointCoeff: 1,
        c3WeightCoeff: 1,
      },
      prng: createMulberry32(1),
    });
    registry.assign(makeGenome('big1', [0]), 1, 0);
    registry.assign(makeGenome('big2', [0]), 1, 0);
    registry.assign(makeGenome('big3', [0]), 1, 0);
    registry.assign(makeGenome('orphan', [10, 10]), 1, 0);
    registry.mergeSmallSpecies(2);
    expect(registry.speciesCount()).toBe(1);
  });
});
