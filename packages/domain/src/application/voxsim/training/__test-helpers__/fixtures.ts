/**
 * Test fixtures shared by trainer and orchestrator tests. Browser-safe.
 */

import type {
  ArenaDefinition,
  BodyDna,
  BrainDna,
  EpisodeMetricBreakdown,
  EpisodeSummary,
  RewardSpec,
  TrainingDna,
} from '../../../../shared/voxsim/index.js';
import { DEFAULT_CHUNK_SIZE, DEFAULT_GRAVITY } from '../../../../shared/voxsim/index.js';

export function makeArena(id = 'flat-arena'): ArenaDefinition {
  return {
    id,
    version: 1,
    chunkSize: DEFAULT_CHUNK_SIZE,
    voxelSize: 1,
    bounds: { min: { cx: 0, cy: 0, cz: 0 }, max: { cx: 0, cy: 0, cz: 0 } },
    chunks: [],
    spawns: [],
    entities: [],
    gravity: DEFAULT_GRAVITY,
    skybox: 'default',
  };
}

export function makeBodyDna(): BodyDna {
  return {
    id: 'body-1',
    version: 1,
    kind: 'robot',
    rootSegmentId: 'torso',
    segments: [
      {
        id: 'torso',
        tag: 'torso',
        shape: { kind: 'box', halfExtents: { x: 0.2, y: 0.4, z: 0.2 } },
        mass: 5,
        restPose: {
          translation: { x: 0, y: 1, z: 0 },
          rotation: { x: 0, y: 0, z: 0, w: 1 },
        },
      },
    ],
    joints: [],
    sensors: [],
    actuators: { actuators: [] },
    metadata: {
      name: 'tester',
      author: 'tests',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
  };
}

export function makeBrainDna(): BrainDna {
  return {
    id: 'brain-1',
    version: 1,
    topology: 'mlp',
    layers: [
      { kind: 'dense', units: 4, activation: 'tanh', useBias: true },
      { kind: 'dense', units: 2, activation: 'linear', useBias: true },
    ],
    inputEncoder: {
      inputs: [{ sensorId: 'sin', width: 4, normalization: { mean: 0, std: 1 } }],
    },
    outputDecoder: {
      outputs: [
        { actuatorId: 'a', range: { min: -1, max: 1 }, activation: 'linear' },
        { actuatorId: 'b', range: { min: -1, max: 1 }, activation: 'linear' },
      ],
    },
    seed: 1,
    metadata: {
      name: 'b',
      author: 'tests',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
  };
}

export function makeReward(): RewardSpec {
  return {
    weights: { forwardVelocity: 1 },
    forwardAxis: { x: 0, y: 0, z: 1 },
    uprightAxis: { x: 0, y: 1, z: 0 },
    uprightSegmentTag: 'torso',
  };
}

export function makeEvolutionTrainingDna(overrides: Partial<TrainingDna> = {}): TrainingDna {
  return {
    id: 'tr-1',
    version: 1,
    algorithm: 'evolution',
    populationSize: 4,
    eliteFraction: 0.5,
    generations: 2,
    episodesPerCandidate: 1,
    episodeSteps: 10,
    mutation: { weightMutationStd: 0.05, weightMutationProb: 0.1, weightCrossoverProb: 0.3 },
    reward: makeReward(),
    curriculum: {
      stages: [
        {
          arenaId: 'flat-arena',
          successCriterion: { metric: 'meanReward', threshold: 1e9, window: 1 },
        },
      ],
    },
    seed: 42,
    maxConcurrentWorkers: 2,
    metadata: {
      name: 'evo',
      author: 'tests',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
    ...overrides,
  };
}

export function makeEpisodeSummary(
  overrides: Partial<EpisodeSummary> & { breakdown?: Partial<EpisodeMetricBreakdown> } = {},
): EpisodeSummary {
  const breakdown: EpisodeMetricBreakdown = {
    forwardVelocity: 0,
    uprightness: 0,
    energyPenalty: 0,
    goalProgress: 0,
    survivalTime: 0,
    foodEaten: 0,
    fallPenalty: 0,
    ...overrides.breakdown,
  };
  return {
    id: 'ep-1',
    runId: 'run-1',
    agentId: 'agent-1',
    bodyDnaId: 'body-1',
    brainDnaId: 'brain-1',
    arenaId: 'flat-arena',
    generation: 0,
    candidateIndex: 0,
    seed: 0,
    outcome: { kind: 'survived' },
    totalReward: 0,
    meanReward: 0,
    steps: 0,
    metricBreakdown: breakdown,
    ...overrides,
  };
}
