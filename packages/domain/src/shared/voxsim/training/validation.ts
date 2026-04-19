/**
 * `validateTrainingDna` enforces the rules described in plan 05.
 */

import type { BrainDna } from '../brain/index.js';
import type { Curriculum } from './curriculum.js';
import type { NeatMutationRates, NeatTrainingConfig } from './neat/index.js';
import type { OptimizerSpec } from './optimizer.js';
import type { RewardSpec } from './reward-spec.js';
import { isNeatAlgorithm, type TrainingDna } from './training-dna.js';

export interface TrainingDnaValidationIssue {
  path: string;
  message: string;
}

export interface TrainingDnaValidationResult {
  valid: boolean;
  issues: TrainingDnaValidationIssue[];
}

function isPositiveInt(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function pushIssue(
  issues: TrainingDnaValidationIssue[],
  path: string,
  message: string,
): void {
  issues.push({ path, message });
}

function validateRewardSpec(
  reward: RewardSpec,
  issues: TrainingDnaValidationIssue[],
): void {
  for (const [key, value] of Object.entries(reward.weights)) {
    if (value !== undefined && !isFiniteNumber(value)) {
      pushIssue(issues, `reward.weights.${key}`, 'must be a finite number');
    }
  }
  if (!reward.uprightSegmentTag) {
    pushIssue(issues, 'reward.uprightSegmentTag', 'is required');
  }
  for (const axis of ['forwardAxis', 'uprightAxis'] as const) {
    const v = reward[axis];
    if (
      !v ||
      !isFiniteNumber(v.x) ||
      !isFiniteNumber(v.y) ||
      !isFiniteNumber(v.z)
    ) {
      pushIssue(issues, `reward.${axis}`, 'must be a finite Vec3');
    }
  }
}

function validateCurriculum(
  curriculum: Curriculum,
  arenaIdResolver: ((arenaId: string) => boolean) | undefined,
  issues: TrainingDnaValidationIssue[],
): void {
  if (!curriculum.stages || curriculum.stages.length === 0) {
    pushIssue(issues, 'curriculum.stages', 'must contain at least one stage');
    return;
  }
  curriculum.stages.forEach((stage, index) => {
    const base = `curriculum.stages[${index}]`;
    if (!stage.arenaId) {
      pushIssue(issues, `${base}.arenaId`, 'is required');
    } else if (arenaIdResolver && !arenaIdResolver(stage.arenaId)) {
      pushIssue(issues, `${base}.arenaId`, `unknown arena '${stage.arenaId}'`);
    }
    const sc = stage.successCriterion;
    if (!sc) {
      pushIssue(issues, `${base}.successCriterion`, 'is required');
    } else {
      if (!isFiniteNumber(sc.threshold)) {
        pushIssue(issues, `${base}.successCriterion.threshold`, 'must be finite');
      }
      if (!isPositiveInt(sc.window)) {
        pushIssue(issues, `${base}.successCriterion.window`, 'must be a positive integer');
      }
    }
    if (stage.maxGenerations !== undefined && !isPositiveInt(stage.maxGenerations)) {
      pushIssue(issues, `${base}.maxGenerations`, 'must be a positive integer');
    }
    if (stage.rewardOverride) {
      validateRewardSpec(stage.rewardOverride, issues);
    }
  });
}

function validateOptimizer(
  optimizer: OptimizerSpec | undefined,
  issues: TrainingDnaValidationIssue[],
): void {
  if (!optimizer) return;
  if (!isFiniteNumber(optimizer.lr) || optimizer.lr <= 0) {
    pushIssue(issues, 'optimizer.lr', 'must be a positive finite number');
  }
  if (optimizer.kind === 'sgd') {
    if (optimizer.momentum !== undefined && !isFiniteNumber(optimizer.momentum)) {
      pushIssue(issues, 'optimizer.momentum', 'must be a finite number');
    }
  } else if (optimizer.kind === 'adam') {
    for (const k of ['beta1', 'beta2', 'epsilon'] as const) {
      const v = optimizer[k];
      if (v !== undefined && !isFiniteNumber(v)) {
        pushIssue(issues, `optimizer.${k}`, 'must be a finite number');
      }
    }
  }
}

function validateNeatMutationRates(
  rates: NeatMutationRates,
  algorithm: TrainingDna['algorithm'],
  issues: TrainingDnaValidationIssue[],
): void {
  const path = 'neat.mutation';
  const probabilityFields: Array<keyof NeatMutationRates> = [
    'weightPerturbProb',
    'weightReplaceProb',
    'addConnectionProb',
    'addNodeProb',
    'toggleEnabledProb',
  ];
  for (const f of probabilityFields) {
    const v = rates[f] as number | undefined;
    if (v === undefined || !isFiniteNumber(v) || v < 0 || v > 1) {
      pushIssue(issues, `${path}.${f}`, 'must be a finite number in [0, 1]');
    }
  }
  if (!isFiniteNumber(rates.weightPerturbStd) || rates.weightPerturbStd < 0) {
    pushIssue(issues, `${path}.weightPerturbStd`, 'must be a non-negative finite number');
  }
  if (!isFiniteNumber(rates.initialWeightRange) || rates.initialWeightRange <= 0) {
    pushIssue(issues, `${path}.initialWeightRange`, 'must be a positive finite number');
  }
  if (algorithm === 'neatLstm') {
    if (
      rates.addLstmNodeProb === undefined ||
      !isFiniteNumber(rates.addLstmNodeProb) ||
      rates.addLstmNodeProb < 0 ||
      rates.addLstmNodeProb > 1
    ) {
      pushIssue(
        issues,
        `${path}.addLstmNodeProb`,
        'is required for neatLstm and must be a finite number in [0, 1]',
      );
    }
  }
}

function validateNeatConfig(
  neat: NeatTrainingConfig | undefined,
  algorithm: TrainingDna['algorithm'],
  brain: BrainDna | undefined,
  issues: TrainingDnaValidationIssue[],
): void {
  if (!neat) {
    pushIssue(issues, 'neat', `is required when algorithm is '${algorithm}'`);
    return;
  }
  if (!isPositiveInt(neat.populationSize)) {
    pushIssue(issues, 'neat.populationSize', 'must be a positive integer');
  }
  if (!isFiniteNumber(neat.eliteFraction) || neat.eliteFraction <= 0 || neat.eliteFraction > 1) {
    pushIssue(issues, 'neat.eliteFraction', 'must be in (0, 1]');
  }
  if (!neat.speciation) {
    pushIssue(issues, 'neat.speciation', 'is required');
  } else {
    if (!isFiniteNumber(neat.speciation.compatibilityThreshold) || neat.speciation.compatibilityThreshold <= 0) {
      pushIssue(issues, 'neat.speciation.compatibilityThreshold', 'must be a positive finite number');
    }
    for (const k of ['c1ExcessCoeff', 'c2DisjointCoeff', 'c3WeightCoeff'] as const) {
      if (!isFiniteNumber(neat.speciation[k])) {
        pushIssue(issues, `neat.speciation.${k}`, 'must be a finite number');
      }
    }
    if (
      neat.speciation.targetSpeciesCount !== undefined &&
      !isPositiveInt(neat.speciation.targetSpeciesCount)
    ) {
      pushIssue(issues, 'neat.speciation.targetSpeciesCount', 'must be a positive integer');
    }
    if (
      neat.speciation.thresholdAdjustStep !== undefined &&
      (!isFiniteNumber(neat.speciation.thresholdAdjustStep) || neat.speciation.thresholdAdjustStep <= 0)
    ) {
      pushIssue(issues, 'neat.speciation.thresholdAdjustStep', 'must be a positive finite number');
    }
  }
  if (!neat.crossover) {
    pushIssue(issues, 'neat.crossover', 'is required');
  } else {
    for (const k of ['interspeciesProb', 'disabledGeneInheritsDisabledProb'] as const) {
      const v = neat.crossover[k];
      if (!isFiniteNumber(v) || v < 0 || v > 1) {
        pushIssue(issues, `neat.crossover.${k}`, 'must be in [0, 1]');
      }
    }
  }
  if (!neat.survival) {
    pushIssue(issues, 'neat.survival', 'is required');
  } else {
    if (!isPositiveInt(neat.survival.stagnationCutoffGenerations)) {
      pushIssue(issues, 'neat.survival.stagnationCutoffGenerations', 'must be a positive integer');
    }
    if (!isPositiveInt(neat.survival.minSpeciesSize)) {
      pushIssue(issues, 'neat.survival.minSpeciesSize', 'must be a positive integer');
    }
  }
  if (neat.mutation) {
    validateNeatMutationRates(neat.mutation, algorithm, issues);
  } else {
    pushIssue(issues, 'neat.mutation', 'is required');
  }
  if (algorithm === 'hyperNeat') {
    if (brain && !brain.neat?.cppnSubstrate) {
      pushIssue(
        issues,
        'brain.neat.cppnSubstrate',
        'is required when training algorithm is hyperNeat',
      );
    }
  }
  if (algorithm === 'neatLstm') {
    if (!neat.lstm) {
      pushIssue(issues, 'neat.lstm', 'is required when algorithm is neatLstm');
    }
  }
}

export function validateTrainingDna(
  dna: TrainingDna,
  options?: {
    brain?: BrainDna;
    arenaIdResolver?: (arenaId: string) => boolean;
  },
): TrainingDnaValidationResult {
  const issues: TrainingDnaValidationIssue[] = [];
  const brain = options?.brain;
  const arenaIdResolver = options?.arenaIdResolver;

  if (!dna.id) pushIssue(issues, 'id', 'is required');
  if (!isPositiveInt(dna.version)) pushIssue(issues, 'version', 'must be a positive integer');

  if (dna.algorithm === 'evolution') {
    if (!isPositiveInt(dna.populationSize)) {
      pushIssue(issues, 'populationSize', 'must be a positive integer for evolution');
    }
    if (!isFiniteNumber(dna.eliteFraction) || dna.eliteFraction <= 0 || dna.eliteFraction > 1) {
      pushIssue(issues, 'eliteFraction', 'must be in (0, 1] for evolution');
    }
  }

  for (const f of ['generations', 'episodesPerCandidate', 'episodeSteps', 'maxConcurrentWorkers'] as const) {
    if (!isPositiveInt(dna[f])) {
      pushIssue(issues, f, 'must be a positive integer');
    }
  }

  if (dna.replaySampleStride !== undefined) {
    if (!Number.isInteger(dna.replaySampleStride) || dna.replaySampleStride < 0) {
      pushIssue(issues, 'replaySampleStride', 'must be a non-negative integer');
    }
  }

  if (!isFiniteNumber(dna.seed)) {
    pushIssue(issues, 'seed', 'must be a finite number');
  }

  if (dna.algorithm === 'reinforce' || dna.algorithm === 'ppoLite') {
    if (!dna.optimizer) {
      pushIssue(issues, 'optimizer', `is required when algorithm is '${dna.algorithm}'`);
    }
  }
  if (isNeatAlgorithm(dna.algorithm) && dna.optimizer) {
    pushIssue(issues, 'optimizer', `is forbidden for NEAT-family algorithms`);
  }
  validateOptimizer(dna.optimizer, issues);

  if (isNeatAlgorithm(dna.algorithm)) {
    validateNeatConfig(dna.neat, dna.algorithm, brain, issues);
  } else if (dna.neat) {
    pushIssue(issues, 'neat', 'is forbidden for non-NEAT algorithms');
  }

  if (!dna.mutation) {
    pushIssue(issues, 'mutation', 'is required');
  } else {
    for (const f of ['weightMutationStd', 'weightMutationProb', 'weightCrossoverProb'] as const) {
      const v = dna.mutation[f];
      if (!isFiniteNumber(v)) {
        pushIssue(issues, `mutation.${f}`, 'must be a finite number');
      }
    }
  }

  if (!dna.reward) {
    pushIssue(issues, 'reward', 'is required');
  } else {
    validateRewardSpec(dna.reward, issues);
  }

  if (!dna.curriculum) {
    pushIssue(issues, 'curriculum', 'is required');
  } else {
    validateCurriculum(dna.curriculum, arenaIdResolver, issues);
  }

  if (!dna.metadata) {
    pushIssue(issues, 'metadata', 'is required');
  }

  return { valid: issues.length === 0, issues };
}
