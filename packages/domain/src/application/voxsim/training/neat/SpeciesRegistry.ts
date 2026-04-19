/**
 * Tracks species across NEAT generations: representatives, sizes, fitness
 * history, and the optional auto-tuning of the compatibility threshold.
 */

import type {
  NeatGenome,
  NeatSpeciationConfig,
  NeatSpeciesSnapshotEntry,
} from '../../../../shared/voxsim/index.js';
import type { SeededPrng } from '../prng.js';
import { compatibilityDistance } from './compatibility.js';

interface SpeciesRecord {
  id: number;
  representative: NeatGenome;
  members: { genome: NeatGenome; fitness: number }[];
  bestScoreHistory: number[];
  stagnation: number;
}

export interface SpeciesRegistryOptions {
  config: NeatSpeciationConfig;
  prng: SeededPrng;
}

export class SpeciesRegistry {
  private species = new Map<number, SpeciesRecord>();
  private nextSpeciesId = 1;
  private currentThreshold: number;
  private readonly config: NeatSpeciationConfig;
  private readonly prng: SeededPrng;

  constructor(options: SpeciesRegistryOptions) {
    this.config = options.config;
    this.prng = options.prng;
    this.currentThreshold = options.config.compatibilityThreshold;
  }

  /** Reset member lists and rotate representatives at the start of a new generation. */
  beginGeneration(): void {
    for (const sp of this.species.values()) {
      if (sp.members.length > 0) {
        const idx = Math.floor(this.prng.next() * sp.members.length);
        sp.representative = sp.members[idx]!.genome;
      }
      sp.members = [];
    }
  }

  assign(genome: NeatGenome, fitness: number, _generation: number): number {
    let bestId = -1;
    let bestDist = Infinity;
    for (const sp of this.species.values()) {
      const dist = compatibilityDistance(genome, sp.representative, this.config);
      if (dist < bestDist) {
        bestDist = dist;
        bestId = sp.id;
      }
    }
    if (bestId !== -1 && bestDist <= this.currentThreshold) {
      const sp = this.species.get(bestId)!;
      sp.members.push({ genome, fitness });
      return sp.id;
    }
    const id = this.nextSpeciesId++;
    this.species.set(id, {
      id,
      representative: genome,
      members: [{ genome, fitness }],
      bestScoreHistory: [],
      stagnation: 0,
    });
    return id;
  }

  endGeneration(): void {
    for (const sp of this.species.values()) {
      const best = sp.members.reduce(
        (m, e) => (e.fitness > m ? e.fitness : m),
        Number.NEGATIVE_INFINITY,
      );
      const lastBest = sp.bestScoreHistory.length
        ? Math.max(...sp.bestScoreHistory)
        : Number.NEGATIVE_INFINITY;
      if (best > lastBest) {
        sp.stagnation = 0;
      } else {
        sp.stagnation += 1;
      }
      sp.bestScoreHistory.push(best);
    }
  }

  representativeFor(speciesId: number): NeatGenome | undefined {
    return this.species.get(speciesId)?.representative;
  }

  membersOf(speciesId: number): { genome: NeatGenome; fitness: number }[] {
    return this.species.get(speciesId)?.members ?? [];
  }

  speciesIds(): number[] {
    return Array.from(this.species.keys());
  }

  speciesCount(): number {
    return this.species.size;
  }

  threshold(): number {
    return this.currentThreshold;
  }

  adjustThreshold(currentSpeciesCount: number): void {
    if (this.config.targetSpeciesCount === undefined) return;
    const step = this.config.thresholdAdjustStep ?? 0.3;
    if (currentSpeciesCount > this.config.targetSpeciesCount) {
      this.currentThreshold += step;
    } else if (currentSpeciesCount < this.config.targetSpeciesCount) {
      this.currentThreshold = Math.max(0.0001, this.currentThreshold - step);
    }
  }

  pruneStagnant(stagnationCutoffGenerations: number): number[] {
    const removed: number[] = [];
    for (const [id, sp] of this.species) {
      if (sp.stagnation >= stagnationCutoffGenerations) {
        removed.push(id);
        this.species.delete(id);
      }
    }
    return removed;
  }

  mergeSmallSpecies(minSpeciesSize: number): void {
    const small: SpeciesRecord[] = [];
    const large: SpeciesRecord[] = [];
    for (const sp of this.species.values()) {
      if (sp.members.length < minSpeciesSize) small.push(sp);
      else large.push(sp);
    }
    if (large.length === 0) return;
    for (const small_sp of small) {
      let bestId = -1;
      let bestDist = Infinity;
      for (const big of large) {
        const dist = compatibilityDistance(small_sp.representative, big.representative, this.config);
        if (dist < bestDist) {
          bestDist = dist;
          bestId = big.id;
        }
      }
      if (bestId !== -1) {
        const target = this.species.get(bestId)!;
        for (const m of small_sp.members) target.members.push(m);
        this.species.delete(small_sp.id);
      }
    }
  }

  snapshot(): NeatSpeciesSnapshotEntry[] {
    const out: NeatSpeciesSnapshotEntry[] = [];
    for (const sp of this.species.values()) {
      const size = sp.members.length;
      const scores = sp.members.map((m) => m.fitness);
      const bestScore = scores.length ? Math.max(...scores) : 0;
      const meanScore = scores.length ? scores.reduce((s, v) => s + v, 0) / scores.length : 0;
      out.push({
        id: sp.id,
        size,
        bestScore,
        meanScore,
        stagnation: sp.stagnation,
        representativeGenomeId: sp.representative.id,
      });
    }
    return out;
  }
}
