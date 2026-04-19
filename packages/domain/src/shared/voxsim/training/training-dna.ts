/**
 * `TrainingDna` is the run-level genome. The application layer combines a
 * `BodyDna`, `BrainDna`, and `TrainingDna` to launch a `TrainerOrchestrator`.
 */

import type { LineageRef } from '../morphology/index.js';
import type { Curriculum } from './curriculum.js';
import type { MutationRates } from './mutation.js';
import type { NeatTrainingConfig } from './neat/index.js';
import type { OptimizerSpec } from './optimizer.js';
import type { RewardSpec } from './reward-spec.js';

export type TrainingAlgorithm =
  | 'evolution'
  | 'reinforce'
  | 'ppoLite'
  | 'neat'
  | 'hyperNeat'
  | 'neatLstm';

export const TRAINING_ALGORITHMS = [
  'evolution',
  'reinforce',
  'ppoLite',
  'neat',
  'hyperNeat',
  'neatLstm',
] as const;

export const NEAT_ALGORITHMS = ['neat', 'hyperNeat', 'neatLstm'] as const;
export type NeatAlgorithm = (typeof NEAT_ALGORITHMS)[number];

export function isNeatAlgorithm(algorithm: TrainingAlgorithm): algorithm is NeatAlgorithm {
  return (NEAT_ALGORITHMS as readonly string[]).includes(algorithm);
}

export function isGradientAlgorithm(
  algorithm: TrainingAlgorithm,
): algorithm is 'reinforce' | 'ppoLite' {
  return algorithm === 'reinforce' || algorithm === 'ppoLite';
}

export interface TrainingDnaMetadata {
  name: string;
  createdAt: string;
  updatedAt: string;
  author: string;
}

export interface TrainingDna {
  id: string;
  version: number;
  algorithm: TrainingAlgorithm;
  /** Only meaningful for `evolution`. NEAT variants use `neat.populationSize`. */
  populationSize: number;
  /** Only meaningful for `evolution`. NEAT variants use `neat.eliteFraction`. */
  eliteFraction: number;
  generations: number;
  episodesPerCandidate: number;
  episodeSteps: number;
  mutation: MutationRates;
  optimizer?: OptimizerSpec;
  neat?: NeatTrainingConfig;
  reward: RewardSpec;
  curriculum: Curriculum;
  seed: number;
  maxConcurrentWorkers: number;
  /** Default `2`; `0` disables replay capture. */
  replaySampleStride?: number;
  lineage?: LineageRef;
  metadata: TrainingDnaMetadata;
}
