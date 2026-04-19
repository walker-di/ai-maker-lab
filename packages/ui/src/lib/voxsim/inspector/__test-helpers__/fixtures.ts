import type { BrainDna, NeatGenome } from '../../brain/types.js';

export function makeMlpBrainDna(overrides: Partial<BrainDna> = {}): BrainDna {
  return {
    id: overrides.id ?? 'brain-mlp-1',
    version: 1,
    topology: 'mlp',
    layers: [
      { kind: 'dense', units: 4, activation: 'relu', useBias: true },
      { kind: 'dense', units: 2, activation: 'tanh', useBias: false },
    ],
    inputEncoder: {
      inputs: [
        {
          sensorId: 'imu',
          width: 3,
          normalization: { mean: 0, std: 1 },
        },
      ],
    },
    outputDecoder: {
      outputs: [
        { actuatorId: 'hipL', range: { min: -1, max: 1 }, activation: 'tanh' },
        { actuatorId: 'hipR', range: { min: -1, max: 1 }, activation: 'tanh' },
      ],
    },
    seed: 42,
    metadata: {
      name: 'mlp-test',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      author: 'test',
    },
    ...overrides,
  };
}

export function makeNeatBrainDna(overrides: Partial<BrainDna> = {}): BrainDna {
  return {
    id: overrides.id ?? 'brain-neat-1',
    version: 1,
    topology: 'neat',
    layers: [],
    inputEncoder: {
      inputs: [
        {
          sensorId: 'imu',
          width: 2,
          normalization: { mean: 0, std: 1 },
        },
      ],
    },
    outputDecoder: {
      outputs: [
        { actuatorId: 'motor', range: { min: -1, max: 1 }, activation: 'tanh' },
      ],
    },
    seed: 1,
    neat: { seed: 1, initialNodeBias: 0, allowRecurrent: false },
    metadata: {
      name: 'neat-test',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      author: 'test',
    },
    ...overrides,
  };
}

export function makeNeatGenome(): NeatGenome {
  return {
    id: 'g1',
    nodes: [
      { id: 0, kind: 'input', activation: 'linear', bias: 0, inputBindingId: 'imu[0]' },
      { id: 1, kind: 'input', activation: 'linear', bias: 0, inputBindingId: 'imu[1]' },
      { id: 2, kind: 'output', activation: 'tanh', bias: 0.1, outputBindingId: 'motor' },
      { id: 3, kind: 'hidden', activation: 'relu', bias: -0.2 },
    ],
    connections: [
      { innovation: 1, sourceNodeId: 0, targetNodeId: 3, weight: 0.5, enabled: true },
      { innovation: 2, sourceNodeId: 1, targetNodeId: 3, weight: -0.25, enabled: true },
      { innovation: 3, sourceNodeId: 3, targetNodeId: 2, weight: 1.0, enabled: false },
    ],
    nextLocalNodeId: 4,
  };
}
