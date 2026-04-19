import { describe, expect, test } from 'bun:test';
import { TfjsPolicyNetwork } from './TfjsPolicyNetwork.js';
import { NEAT_ONLY_METHODS_ERROR } from './policy.js';
import type { BrainDna } from './types.js';

function makeDna(): BrainDna {
  return {
    id: 'b',
    version: 1,
    topology: 'mlp',
    layers: [
      { kind: 'dense', units: 4, activation: 'tanh', useBias: true },
      { kind: 'dense', units: 2, activation: 'linear', useBias: true },
    ],
    inputEncoder: {
      inputs: [
        { sensorId: 's1', width: 3, normalization: { mean: 0, std: 1 } },
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

describe('TfjsPolicyNetwork', () => {
  test('init builds a layout matching dense parameters', async () => {
    const policy = new TfjsPolicyNetwork();
    await policy.init(makeDna());
    const layout = policy.__layoutForTest();
    // dense_0: kernel 3*4 + bias 4 = 16
    // dense_1: kernel 4*2 + bias 2 = 10
    expect(layout.entries.map((e) => e.length).reduce((a, b) => a + b, 0)).toBe(16 + 10);
    policy.dispose();
  });

  test('setWeights then getWeights returns the same buffer', async () => {
    const policy = new TfjsPolicyNetwork();
    await policy.init(makeDna());
    const layout = policy.__layoutForTest();
    const total = layout.entries.map((e) => e.length).reduce((a, b) => a + b, 0);
    const buf = new Float32Array(total);
    for (let i = 0; i < buf.length; i++) buf[i] = i * 0.01;
    policy.setWeights(buf);
    const back = policy.getWeights();
    for (let i = 0; i < buf.length; i++) {
      expect(back[i]).toBeCloseTo(buf[i], 5);
    }
    policy.dispose();
  });

  test('act is deterministic for the same DNA, weights, and observation across two fresh instances', async () => {
    const a = new TfjsPolicyNetwork();
    const b = new TfjsPolicyNetwork();
    await a.init(makeDna());
    await b.init(makeDna());
    const layout = a.__layoutForTest();
    const total = layout.entries.map((e) => e.length).reduce((a, b) => a + b, 0);
    const buf = new Float32Array(total);
    for (let i = 0; i < buf.length; i++) buf[i] = Math.sin(i + 1) * 0.1;
    a.setWeights(buf);
    b.setWeights(buf);
    const obs = new Float32Array([0.1, -0.2, 0.5]);
    const outA = new Float32Array(2);
    const outB = new Float32Array(2);
    a.act(obs, outA);
    b.act(obs, outB);
    expect(outA[0]).toBeCloseTo(outB[0], 5);
    expect(outA[1]).toBeCloseTo(outB[1], 5);
    a.dispose();
    b.dispose();
  });

  test('actBatch matches a per-row act loop', async () => {
    const policy = new TfjsPolicyNetwork();
    await policy.init(makeDna());
    const obs = new Float32Array([0.1, -0.2, 0.5, 1.0, 0.0, 0.5]);
    const single = new Float32Array(2 * 2);
    const batch = new Float32Array(2 * 2);
    policy.actBatch(obs, 2, batch);
    policy.act(obs.subarray(0, 3), single.subarray(0, 2));
    policy.act(obs.subarray(3, 6), single.subarray(2, 4));
    for (let i = 0; i < 4; i++) {
      expect(batch[i]).toBeCloseTo(single[i], 4);
    }
    policy.dispose();
  });

  test('setGenome and getGenome throw on fixed-topology brains', async () => {
    const policy = new TfjsPolicyNetwork();
    await policy.init(makeDna());
    expect(() => policy.setGenome({ id: 'g', nodes: [], connections: [], nextLocalNodeId: 1 })).toThrow(NEAT_ONLY_METHODS_ERROR);
    expect(() => policy.getGenome()).toThrow(NEAT_ONLY_METHODS_ERROR);
    policy.dispose();
  });
});
