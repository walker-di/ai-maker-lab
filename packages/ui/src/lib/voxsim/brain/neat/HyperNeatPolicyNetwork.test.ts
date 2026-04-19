import { describe, expect, test } from 'bun:test';
import { HyperNeatPolicyNetwork } from './HyperNeatPolicyNetwork.js';
import type { BrainDna, NeatGenome } from '../types.js';

function makeDna(weightThreshold = 0): BrainDna {
  return {
    id: 'b',
    version: 1,
    topology: 'hyperNeat',
    layers: [],
    inputEncoder: {
      inputs: [
        { sensorId: 's1', width: 1, normalization: { mean: 0, std: 1 } },
        { sensorId: 's2', width: 1, normalization: { mean: 0, std: 1 } },
      ],
    },
    outputDecoder: {
      outputs: [{ actuatorId: 'a1', range: { min: -1, max: 1 }, activation: 'linear' }],
    },
    seed: 1,
    neat: {
      seed: 1,
      initialNodeBias: 0,
      allowRecurrent: false,
      cppnSubstrate: {
        kind: 'grid2d',
        inputCoords: [
          { x: -1, y: 0, z: 0 },
          { x: 1, y: 0, z: 0 },
        ],
        hiddenLayers: [],
        outputCoords: [{ x: 0, y: 1, z: 0 }],
        weightThreshold,
        bias: { constant: 0 },
      },
    },
    metadata: { name: 't', createdAt: 'x', updatedAt: 'y', author: 'z' },
  };
}

/** Minimal CPPN: src_x -> output(weight) with weight=1, all activations linear. */
function makeCppnGenome(): NeatGenome {
  return {
    id: 'cppn',
    nodes: [
      { id: 1, kind: 'input', activation: 'linear', bias: 0, inputBindingId: '__src_x' },
      { id: 2, kind: 'input', activation: 'linear', bias: 0, inputBindingId: '__src_y' },
      { id: 3, kind: 'input', activation: 'linear', bias: 0, inputBindingId: '__src_z' },
      { id: 4, kind: 'input', activation: 'linear', bias: 0, inputBindingId: '__tgt_x' },
      { id: 5, kind: 'input', activation: 'linear', bias: 0, inputBindingId: '__tgt_y' },
      { id: 6, kind: 'input', activation: 'linear', bias: 0, inputBindingId: '__tgt_z' },
      { id: 7, kind: 'input', activation: 'linear', bias: 0, inputBindingId: '__bias' },
      { id: 8, kind: 'output', activation: 'linear', bias: 0, outputBindingId: '__cppn_weight' },
    ],
    connections: [
      { innovation: 1, sourceNodeId: 7, targetNodeId: 8, weight: 1, enabled: true },
    ],
    nextLocalNodeId: 9,
  };
}

describe('HyperNeatPolicyNetwork', () => {
  test('phenotype rebuild keeps edges with |w| >= threshold and prunes the rest', async () => {
    const policy = new HyperNeatPolicyNetwork();
    const dna = makeDna(0);
    await policy.init(dna);
    policy.setGenome(makeCppnGenome());
    // Two inputs * one output = 2 candidate edges, all with weight=1 (from bias).
    expect(policy.__getPhenotypeEdges().length).toBe(2);

    // With threshold > 1, all edges should be pruned.
    const dnaTight = makeDna(1.5);
    const policy2 = new HyperNeatPolicyNetwork();
    await policy2.init(dnaTight);
    policy2.setGenome(makeCppnGenome());
    expect(policy2.__getPhenotypeEdges().length).toBe(0);
  });

  test('act produces a finite output', async () => {
    const policy = new HyperNeatPolicyNetwork();
    await policy.init(makeDna(0));
    policy.setGenome(makeCppnGenome());
    const obs = new Float32Array([0.3, -0.7]);
    const out = new Float32Array(1);
    policy.act(obs, out);
    expect(Number.isFinite(out[0])).toBe(true);
  });

  test('changing the substrate triggers a different phenotype', async () => {
    const policy = new HyperNeatPolicyNetwork();
    await policy.init(makeDna(0));
    policy.setGenome(makeCppnGenome());
    const initialEdgeCount = policy.__getPhenotypeEdges().length;

    const policy2 = new HyperNeatPolicyNetwork();
    const tightDna = makeDna(1.5);
    await policy2.init(tightDna);
    policy2.setGenome(makeCppnGenome());
    expect(policy2.__getPhenotypeEdges().length).not.toBe(initialEdgeCount);
  });
});
