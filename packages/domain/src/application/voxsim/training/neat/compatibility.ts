/**
 * Stanley-Miikkulainen compatibility distance: δ = c1*E/N + c2*D/N + c3*W̄.
 * Pure helper used by `SpeciesRegistry` and the inspector.
 */

import type { NeatGenome } from '../../../../shared/voxsim/index.js';

export interface CompatibilityCoeffs {
  c1ExcessCoeff: number;
  c2DisjointCoeff: number;
  c3WeightCoeff: number;
}

export function compatibilityDistance(
  a: NeatGenome,
  b: NeatGenome,
  coeffs: CompatibilityCoeffs,
): number {
  if (a.connections.length === 0 && b.connections.length === 0) return 0;
  const aMap = new Map<number, number>();
  for (const c of a.connections) aMap.set(c.innovation, c.weight);
  const bMap = new Map<number, number>();
  for (const c of b.connections) bMap.set(c.innovation, c.weight);
  const maxA = a.connections.reduce((m, c) => (c.innovation > m ? c.innovation : m), 0);
  const maxB = b.connections.reduce((m, c) => (c.innovation > m ? c.innovation : m), 0);
  const cutoff = Math.min(maxA, maxB);

  let excess = 0;
  let disjoint = 0;
  let matchingCount = 0;
  let weightDiffSum = 0;

  const allInnovations = new Set<number>();
  for (const k of aMap.keys()) allInnovations.add(k);
  for (const k of bMap.keys()) allInnovations.add(k);

  for (const innovation of allInnovations) {
    const inA = aMap.has(innovation);
    const inB = bMap.has(innovation);
    if (inA && inB) {
      matchingCount++;
      weightDiffSum += Math.abs((aMap.get(innovation) ?? 0) - (bMap.get(innovation) ?? 0));
    } else if (innovation > cutoff) {
      excess++;
    } else {
      disjoint++;
    }
  }

  // Stanley uses N = max gene count; small genomes use N = 1.
  const longer = Math.max(a.connections.length, b.connections.length);
  const n = longer < 20 ? 1 : longer;
  const wBar = matchingCount > 0 ? weightDiffSum / matchingCount : 0;
  return (
    (coeffs.c1ExcessCoeff * excess) / n +
    (coeffs.c2DisjointCoeff * disjoint) / n +
    coeffs.c3WeightCoeff * wBar
  );
}
