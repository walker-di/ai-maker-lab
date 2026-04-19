import { describe, expect, it } from 'bun:test';

import type { TrainingDna } from './training-dna.js';
import { validateTrainingDna } from './validation.js';

function makeBaseDna(overrides: Partial<TrainingDna> = {}): TrainingDna {
  const base: TrainingDna = {
    id: 'training-1',
    version: 1,
    algorithm: 'evolution',
    populationSize: 16,
    eliteFraction: 0.2,
    generations: 10,
    episodesPerCandidate: 2,
    episodeSteps: 200,
    mutation: {
      weightMutationStd: 0.05,
      weightMutationProb: 0.1,
      weightCrossoverProb: 0.3,
    },
    reward: {
      weights: { forwardVelocity: 1, uprightness: 0.5 },
      forwardAxis: { x: 0, y: 0, z: 1 },
      uprightAxis: { x: 0, y: 1, z: 0 },
      uprightSegmentTag: 'torso',
    },
    curriculum: {
      stages: [
        {
          arenaId: 'flat-arena',
          successCriterion: { metric: 'meanReward', threshold: 1, window: 5 },
        },
      ],
    },
    seed: 42,
    maxConcurrentWorkers: 2,
    metadata: {
      name: 'demo',
      author: 'tester',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
  };
  return { ...base, ...overrides };
}

describe('validateTrainingDna', () => {
  it('accepts a well-formed evolution DNA', () => {
    const result = validateTrainingDna(makeBaseDna());
    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it('rejects non-positive populationSize for evolution', () => {
    const result = validateTrainingDna(makeBaseDna({ populationSize: 0 }));
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.path === 'populationSize')).toBe(true);
  });

  it('rejects eliteFraction outside (0, 1] for evolution', () => {
    const tooHigh = validateTrainingDna(makeBaseDna({ eliteFraction: 1.5 }));
    const tooLow = validateTrainingDna(makeBaseDna({ eliteFraction: 0 }));
    expect(tooHigh.valid).toBe(false);
    expect(tooLow.valid).toBe(false);
  });

  it('requires optimizer for reinforce and ppoLite', () => {
    const r = validateTrainingDna(makeBaseDna({ algorithm: 'reinforce' }));
    expect(r.issues.some((i) => i.path === 'optimizer')).toBe(true);
    const p = validateTrainingDna(makeBaseDna({ algorithm: 'ppoLite' }));
    expect(p.issues.some((i) => i.path === 'optimizer')).toBe(true);
  });

  it('forbids optimizer on NEAT-family algorithms', () => {
    const result = validateTrainingDna(
      makeBaseDna({
        algorithm: 'neat',
        optimizer: { kind: 'sgd', lr: 0.01 },
        neat: {
          populationSize: 32,
          eliteFraction: 0.2,
          speciation: {
            compatibilityThreshold: 3,
            c1ExcessCoeff: 1,
            c2DisjointCoeff: 1,
            c3WeightCoeff: 0.4,
          },
          mutation: {
            weightPerturbProb: 0.8,
            weightPerturbStd: 0.1,
            weightReplaceProb: 0.05,
            addConnectionProb: 0.05,
            addNodeProb: 0.03,
            toggleEnabledProb: 0.01,
            initialWeightRange: 1,
          },
          crossover: { interspeciesProb: 0.05, disabledGeneInheritsDisabledProb: 0.75 },
          survival: { stagnationCutoffGenerations: 15, minSpeciesSize: 5 },
        },
      }),
    );
    expect(result.issues.some((i) => i.path === 'optimizer')).toBe(true);
  });

  it('requires neat config for NEAT-family algorithms', () => {
    const result = validateTrainingDna(
      makeBaseDna({ algorithm: 'neat' }),
    );
    expect(result.issues.some((i) => i.path === 'neat')).toBe(true);
  });

  it('requires addLstmNodeProb and lstm options for neatLstm', () => {
    const result = validateTrainingDna(
      makeBaseDna({
        algorithm: 'neatLstm',
        neat: {
          populationSize: 16,
          eliteFraction: 0.2,
          speciation: {
            compatibilityThreshold: 3,
            c1ExcessCoeff: 1,
            c2DisjointCoeff: 1,
            c3WeightCoeff: 0.4,
          },
          mutation: {
            weightPerturbProb: 0.8,
            weightPerturbStd: 0.1,
            weightReplaceProb: 0.05,
            addConnectionProb: 0.05,
            addNodeProb: 0.03,
            toggleEnabledProb: 0.01,
            initialWeightRange: 1,
          },
          crossover: { interspeciesProb: 0.05, disabledGeneInheritsDisabledProb: 0.75 },
          survival: { stagnationCutoffGenerations: 15, minSpeciesSize: 5 },
        },
      }),
    );
    expect(result.issues.some((i) => i.path === 'neat.mutation.addLstmNodeProb')).toBe(true);
    expect(result.issues.some((i) => i.path === 'neat.lstm')).toBe(true);
  });

  it('reports unknown arena ids when a resolver is supplied', () => {
    const result = validateTrainingDna(makeBaseDna(), {
      arenaIdResolver: (id) => id === 'other-arena',
    });
    expect(
      result.issues.some((i) => i.path === 'curriculum.stages[0].arenaId'),
    ).toBe(true);
  });

  it('rejects empty curriculum', () => {
    const result = validateTrainingDna(
      makeBaseDna({ curriculum: { stages: [] } }),
    );
    expect(result.issues.some((i) => i.path === 'curriculum.stages')).toBe(true);
  });

  it('rejects negative replaySampleStride', () => {
    const result = validateTrainingDna(
      makeBaseDna({ replaySampleStride: -1 }),
    );
    expect(result.issues.some((i) => i.path === 'replaySampleStride')).toBe(true);
  });
});
