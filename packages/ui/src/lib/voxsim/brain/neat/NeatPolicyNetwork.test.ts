import { describe, expect, test } from 'bun:test';
import { NeatPolicyNetwork } from './NeatPolicyNetwork.js';
import type { BrainDna, NeatGenome } from '../types.js';
import { FIXED_ONLY_METHODS_ERROR } from '../policy.js';

function makeDna(allowRecurrent = false): BrainDna {
  return {
    id: 'b',
    version: 1,
    topology: 'neat',
    layers: [],
    inputEncoder: {
      inputs: [{ sensorId: 's1', width: 1, normalization: { mean: 0, std: 1 } }],
    },
    outputDecoder: {
      outputs: [{ actuatorId: 'a1', range: { min: -1, max: 1 }, activation: 'tanh' }],
    },
    seed: 1,
    neat: { seed: 1, initialNodeBias: 0.1, allowRecurrent },
    metadata: { name: 't', createdAt: 'x', updatedAt: 'y', author: 'z' },
  };
}

function makeGenome(weight = 1): NeatGenome {
  return {
    id: 'g1',
    nodes: [
      { id: 1, kind: 'input', activation: 'linear', bias: 0, inputBindingId: 's1' },
      { id: 2, kind: 'hidden', activation: 'tanh', bias: 0 },
      { id: 3, kind: 'output', activation: 'linear', bias: 0, outputBindingId: 'a1' },
    ],
    connections: [
      { innovation: 1, sourceNodeId: 1, targetNodeId: 2, weight, enabled: true },
      { innovation: 2, sourceNodeId: 2, targetNodeId: 3, weight: 1, enabled: true },
    ],
    nextLocalNodeId: 4,
  };
}

describe('NeatPolicyNetwork', () => {
  test('init rejects non-neat topology', async () => {
    const policy = new NeatPolicyNetwork();
    await expect(
      policy.init({ ...makeDna(), topology: 'mlp', layers: [{ kind: 'dense', units: 1, activation: 'linear', useBias: true }] }),
    ).rejects.toThrow();
  });

  test('act is deterministic across two fresh instances', async () => {
    const dna = makeDna();
    const g = makeGenome();
    const a = new NeatPolicyNetwork();
    const b = new NeatPolicyNetwork();
    await a.init(dna);
    await b.init(dna);
    a.setGenome(g);
    b.setGenome(g);
    const obs = new Float32Array([0.5]);
    const outA = new Float32Array(1);
    const outB = new Float32Array(1);
    a.act(obs, outA);
    b.act(obs, outB);
    expect(outA[0]).toBeCloseTo(outB[0]);
    // tanh(0.5) -> ~0.462; through tanh hidden then output (linear after tanh, then decoder tanh on 0.462) = tanh(0.462) ~= 0.432
    expect(outA[0]).toBeCloseTo(Math.tanh(Math.tanh(0.5)));
  });

  test('setGenome rebuilds topo order; new graph yields new output', async () => {
    const dna = makeDna();
    const policy = new NeatPolicyNetwork();
    await policy.init(dna);
    policy.setGenome(makeGenome(1));
    const out = new Float32Array(1);
    const obs = new Float32Array([0.5]);
    policy.act(obs, out);
    const first = out[0];
    policy.setGenome(makeGenome(0)); // zero weight kills signal
    policy.act(obs, out);
    expect(out[0]).not.toBeCloseTo(first);
    expect(out[0]).toBeCloseTo(0);
  });

  test('setWeights throws with documented message', async () => {
    const policy = new NeatPolicyNetwork();
    await policy.init(makeDna());
    policy.setGenome(makeGenome());
    expect(() => policy.setWeights(new Float32Array([0]))).toThrow(FIXED_ONLY_METHODS_ERROR);
    expect(() => policy.getWeights()).toThrow(FIXED_ONLY_METHODS_ERROR);
  });

  test('recurrent mode runs without throwing and produces finite output', async () => {
    const dna = makeDna(true);
    const policy = new NeatPolicyNetwork();
    await policy.init(dna);
    const g: NeatGenome = {
      id: 'g',
      nodes: [
        { id: 1, kind: 'input', activation: 'linear', bias: 0, inputBindingId: 's1' },
        { id: 2, kind: 'hidden', activation: 'tanh', bias: 0 },
        { id: 3, kind: 'output', activation: 'linear', bias: 0, outputBindingId: 'a1' },
      ],
      connections: [
        { innovation: 1, sourceNodeId: 1, targetNodeId: 2, weight: 1, enabled: true },
        { innovation: 2, sourceNodeId: 2, targetNodeId: 3, weight: 1, enabled: true },
        // recurrent self-edge
        { innovation: 3, sourceNodeId: 2, targetNodeId: 2, weight: 0.5, enabled: true },
      ],
      nextLocalNodeId: 4,
    };
    policy.setGenome(g);
    const obs = new Float32Array([0.5]);
    const out = new Float32Array(1);
    policy.act(obs, out);
    expect(Number.isFinite(out[0])).toBe(true);
  });
});
