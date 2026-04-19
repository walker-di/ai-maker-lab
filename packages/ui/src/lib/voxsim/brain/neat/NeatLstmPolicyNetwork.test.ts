import { describe, expect, test } from 'bun:test';
import { NeatLstmPolicyNetwork } from './NeatLstmPolicyNetwork.js';
import type { BrainDna, NeatGenome } from '../types.js';

function makeDna(): BrainDna {
  return {
    id: 'b',
    version: 1,
    topology: 'neatLstm',
    layers: [],
    inputEncoder: {
      inputs: [{ sensorId: 's1', width: 1, normalization: { mean: 0, std: 1 } }],
    },
    outputDecoder: {
      outputs: [{ actuatorId: 'a1', range: { min: -1, max: 1 }, activation: 'linear' }],
    },
    seed: 1,
    neat: { seed: 1, initialNodeBias: 0, allowRecurrent: true },
    metadata: { name: 't', createdAt: 'x', updatedAt: 'y', author: 'z' },
  };
}

/**
 * Single-LSTM-node genome: input -> lstm node (4 gates) -> output.
 */
function makeLstmGenome(): NeatGenome {
  return {
    id: 'g',
    nodes: [
      { id: 1, kind: 'input', activation: 'linear', bias: 0, inputBindingId: 's1' },
      { id: 2, kind: 'lstm', activation: 'tanh', bias: 0 },
      { id: 3, kind: 'output', activation: 'linear', bias: 0, outputBindingId: 'a1' },
    ],
    connections: [
      { innovation: 1, sourceNodeId: 1, targetNodeId: 2, weight: 1, enabled: true, lstmGate: 'input' },
      { innovation: 2, sourceNodeId: 1, targetNodeId: 2, weight: 1, enabled: true, lstmGate: 'forget' },
      { innovation: 3, sourceNodeId: 1, targetNodeId: 2, weight: 1, enabled: true, lstmGate: 'output' },
      { innovation: 4, sourceNodeId: 1, targetNodeId: 2, weight: 1, enabled: true, lstmGate: 'candidate' },
      { innovation: 5, sourceNodeId: 2, targetNodeId: 3, weight: 1, enabled: true },
    ],
    nextLocalNodeId: 4,
  };
}

describe('NeatLstmPolicyNetwork', () => {
  test('setGenome allocates LstmCellState matching the LSTM node count', async () => {
    const policy = new NeatLstmPolicyNetwork();
    await policy.init(makeDna());
    policy.setGenome(makeLstmGenome());
    const state = policy.__getLstmState();
    expect(state).not.toBeNull();
    expect(state!.cellState.length).toBe(1);
    expect(state!.hiddenState.length).toBe(1);
  });

  test('LSTM gate math matches a reference scalar implementation across 4 steps', async () => {
    const policy = new NeatLstmPolicyNetwork();
    await policy.init(makeDna());
    policy.setGenome(makeLstmGenome());

    // Reference: same gates with weight=1 and bias=0.
    const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));
    let refCell = 0;
    let refHidden = 0;

    const obs = new Float32Array(1);
    const out = new Float32Array(1);
    const inputs = [0.1, -0.2, 0.5, 1.0];
    for (const x of inputs) {
      obs[0] = x;
      policy.act(obs, out);
      const i = sigmoid(x);
      const f = sigmoid(x);
      const o = sigmoid(x);
      const cand = Math.tanh(x);
      refCell = f * refCell + i * cand;
      refHidden = o * Math.tanh(refCell);
      const state = policy.__getLstmState()!;
      expect(state.cellState[0]).toBeCloseTo(refCell, 5);
      expect(state.hiddenState[0]).toBeCloseTo(refHidden, 5);
    }
  });

  test('resetEpisodeState zeroes cell and hidden state', async () => {
    const policy = new NeatLstmPolicyNetwork();
    await policy.init(makeDna());
    policy.setGenome(makeLstmGenome());
    const obs = new Float32Array([0.5]);
    const out = new Float32Array(1);
    policy.act(obs, out);
    expect(policy.__getLstmState()!.cellState[0]).not.toBe(0);
    policy.resetEpisodeState();
    expect(policy.__getLstmState()!.cellState[0]).toBe(0);
    expect(policy.__getLstmState()!.hiddenState[0]).toBe(0);
  });

  test('connections without lstmGate fall through as candidate contributions (permissive runtime)', async () => {
    const policy = new NeatLstmPolicyNetwork();
    await policy.init(makeDna());
    const g = makeLstmGenome();
    // Strip the gate from one connection and keep the rest.
    g.connections[3].lstmGate = undefined;
    policy.setGenome(g);
    const obs = new Float32Array([0.5]);
    const out = new Float32Array(1);
    policy.act(obs, out);
    expect(Number.isFinite(out[0])).toBe(true);
  });
});
