/**
 * `NeatTrainingConfig` parameterizes the run-level NEAT settings (population,
 * speciation, survival, crossover, optional LSTM/CPPN options).
 */

import type { NeatMutationRates } from './neat-mutation-rates.js';

export interface NeatSpeciationConfig {
  /** Stanley-Miikkulainen δ_t. */
  compatibilityThreshold: number;
  c1ExcessCoeff: number;
  c2DisjointCoeff: number;
  c3WeightCoeff: number;
  /** Optional auto-tuning target species count. */
  targetSpeciesCount?: number;
  /** Step size for the auto-adjust. Default 0.3. */
  thresholdAdjustStep?: number;
}

export interface NeatCrossoverConfig {
  /** Probability that an offspring's second parent comes from a different species. */
  interspeciesProb: number;
  /** Probability that a connection disabled in either parent stays disabled in the offspring. */
  disabledGeneInheritsDisabledProb: number;
}

export interface NeatSurvivalConfig {
  stagnationCutoffGenerations: number;
  minSpeciesSize: number;
}

export interface NeatLstmTrainingOptions {
  resetCellStateOnEpisodeStart: boolean;
  gateInitWeightStd: number;
}

export interface NeatCppnTrainingOptions {
  phenotypeRebuildEachGeneration: boolean;
}

export interface NeatTrainingConfig {
  populationSize: number;
  /** Per-species elite preservation rate. */
  eliteFraction: number;
  speciation: NeatSpeciationConfig;
  mutation: NeatMutationRates;
  crossover: NeatCrossoverConfig;
  survival: NeatSurvivalConfig;
  /** Required when `algorithm === 'hyperNeat'`. */
  cppn?: NeatCppnTrainingOptions;
  /** Required when `algorithm === 'neatLstm'`. */
  lstm?: NeatLstmTrainingOptions;
}
