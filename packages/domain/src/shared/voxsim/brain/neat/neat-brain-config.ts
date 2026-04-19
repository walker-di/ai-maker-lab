/**
 * Per-`BrainDna` NEAT configuration. The trainer in plan 05 reads the rest
 * (mutation rates, speciation thresholds, etc.) from `TrainingDna`.
 */

import type { CppnSubstrate } from './cppn-substrate.js';

export interface NeatBrainConfig {
  /** Overrides `BrainDna.seed` for NEAT-scope PRNG (initial population, innovation ids). */
  seed: number;
  initialNodeBias: number;
  allowRecurrent: boolean;
  /** Required when `BrainDna.topology === 'hyperNeat'`. */
  cppnSubstrate?: CppnSubstrate;
  /** Number of relaxation iterations per `act` in recurrent mode. Defaults to 1. */
  relaxationIterations?: number;
}
