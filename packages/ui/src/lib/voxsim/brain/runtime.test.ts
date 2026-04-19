import { describe, expect, test } from 'bun:test';
import { runDecoder, runEncoder } from './runtime.js';
import type { InputEncoder, OutputDecoder } from './types.js';

describe('runEncoder', () => {
  test('applies scalar normalization correctly', () => {
    const encoder: InputEncoder = {
      inputs: [
        { sensorId: 's1', width: 3, normalization: { mean: 0.5, std: 0.5 } },
      ],
    };
    const obs = new Float32Array([0, 0.5, 1.0]);
    const out = new Float32Array(3);
    runEncoder(obs, encoder, out);
    expect(Array.from(out)).toEqual([-1, 0, 1]);
  });

  test('applies per-channel normalization', () => {
    const encoder: InputEncoder = {
      inputs: [
        {
          sensorId: 's',
          width: 2,
          normalization: { mean: [0, 1], std: [1, 2] },
        },
      ],
    };
    const obs = new Float32Array([2, 3]);
    const out = new Float32Array(2);
    runEncoder(obs, encoder, out);
    expect(out[0]).toBeCloseTo(2);
    expect(out[1]).toBeCloseTo(1);
  });

  test('clips values', () => {
    const encoder: InputEncoder = {
      inputs: [
        {
          sensorId: 's',
          width: 1,
          normalization: { mean: 0, std: 1 },
          clip: { min: -2, max: 2 },
        },
      ],
    };
    const obs = new Float32Array([10]);
    const out = new Float32Array(1);
    runEncoder(obs, encoder, out);
    expect(out[0]).toBe(2);
  });
});

describe('runDecoder', () => {
  test('tanh maps to range correctly', () => {
    const decoder: OutputDecoder = {
      outputs: [
        { actuatorId: 'a', range: { min: -2, max: 2 }, activation: 'tanh' },
      ],
    };
    const raw = new Float32Array([0]);
    const out = new Float32Array(1);
    runDecoder(raw, decoder, out);
    expect(out[0]).toBeCloseTo(0);
    raw[0] = 100;
    runDecoder(raw, decoder, out);
    expect(out[0]).toBeCloseTo(2, 3);
  });

  test('sigmoid maps to range correctly', () => {
    const decoder: OutputDecoder = {
      outputs: [
        { actuatorId: 'a', range: { min: 0, max: 10 }, activation: 'sigmoid' },
      ],
    };
    const raw = new Float32Array([0]);
    const out = new Float32Array(1);
    runDecoder(raw, decoder, out);
    expect(out[0]).toBeCloseTo(5);
  });

  test('linear passes through', () => {
    const decoder: OutputDecoder = {
      outputs: [
        { actuatorId: 'a', range: { min: -1, max: 1 }, activation: 'linear' },
      ],
    };
    const raw = new Float32Array([0.7]);
    const out = new Float32Array(1);
    runDecoder(raw, decoder, out);
    expect(out[0]).toBeCloseTo(0.7);
  });
});
