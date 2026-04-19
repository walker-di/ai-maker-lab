import { describe, expect, test } from 'bun:test';
import { validateBrainDna } from './validation.js';
import { buildWeightLayout, layoutTotalLength } from './weight-layout.js';
import type { BrainDna } from './brain-dna.js';

function makeMlp(units: number): BrainDna {
  return {
    id: 'b1',
    version: 1,
    topology: 'mlp',
    layers: [
      { kind: 'dense', units: 4, activation: 'tanh', useBias: true },
      { kind: 'dense', units, activation: 'linear', useBias: true },
    ],
    inputEncoder: {
      inputs: [
        {
          sensorId: 's1',
          width: 3,
          normalization: { mean: 0, std: 1 },
        },
      ],
    },
    outputDecoder: {
      outputs: [
        { actuatorId: 'a1', range: { min: -1, max: 1 }, activation: 'tanh' },
        { actuatorId: 'a2', range: { min: -1, max: 1 }, activation: 'tanh' },
      ],
    },
    seed: 42,
    metadata: { name: 't', createdAt: 'x', updatedAt: 'y', author: 'z' },
  };
}

describe('validateBrainDna', () => {
  test('accepts a sound MLP', () => {
    const result = validateBrainDna(makeMlp(2));
    expect(result.ok).toBe(true);
  });

  test('rejects mismatched final units', () => {
    const result = validateBrainDna(makeMlp(3));
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.code === 'mlp_final_units_mismatch')).toBe(true);
  });

  test('rejects gru in non-recurrent topology', () => {
    const dna = makeMlp(2);
    dna.layers.splice(1, 0, { kind: 'gru', units: 4 });
    const result = validateBrainDna(dna);
    expect(result.issues.some((i) => i.code === 'recurrent_layer_in_non_recurrent_topology')).toBe(true);
  });

  test('rejects duplicate sensor id', () => {
    const dna = makeMlp(2);
    dna.inputEncoder.inputs.push({
      sensorId: 's1',
      width: 1,
      normalization: { mean: 0, std: 1 },
    });
    const result = validateBrainDna(dna);
    expect(result.issues.some((i) => i.code === 'encoder_duplicate_sensor_id')).toBe(true);
  });

  test('rejects non-finite normalization', () => {
    const dna = makeMlp(2);
    dna.inputEncoder.inputs[0].normalization = { mean: Number.NaN, std: 1 };
    const result = validateBrainDna(dna);
    expect(result.issues.some((i) => i.code === 'encoder_norm_mean_invalid')).toBe(true);
  });

  test('NEAT topology with non-empty layers fails', () => {
    const dna = makeMlp(2);
    dna.topology = 'neat';
    dna.neat = { seed: 1, initialNodeBias: 0.1, allowRecurrent: false };
    const result = validateBrainDna(dna);
    expect(result.issues.some((i) => i.code === 'neat_layers_must_be_empty')).toBe(true);
  });

  test('hyperNeat without substrate fails', () => {
    const dna = makeMlp(2);
    dna.topology = 'hyperNeat';
    dna.layers = [];
    dna.neat = { seed: 1, initialNodeBias: 0.1, allowRecurrent: false };
    const result = validateBrainDna(dna);
    expect(result.issues.some((i) => i.code === 'hyperneat_substrate_required')).toBe(true);
  });
});

describe('buildWeightLayout', () => {
  test('layout for the same DNA is byte-identical across runs', () => {
    const dna = makeMlp(2);
    const inputWidth = 3;
    const outputWidth = 2;
    const a = buildWeightLayout(dna.layers, inputWidth, outputWidth);
    const b = buildWeightLayout(dna.layers, inputWidth, outputWidth);
    expect(a.entries).toEqual(b.entries);
  });

  test('totalLength matches the sum of dense parameters', () => {
    const dna = makeMlp(2);
    const inputWidth = 3;
    const outputWidth = 2;
    const layout = buildWeightLayout(dna.layers, inputWidth, outputWidth);
    // dense_0: kernel 3*4 + bias 4 = 16
    // dense_1: kernel 4*2 + bias 2 = 10
    expect(layoutTotalLength(layout)).toBe(16 + 10);
  });
});
