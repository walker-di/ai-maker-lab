import { describe, expect, it } from 'bun:test';

import type {
  NeatGenome,
  NeatMutationRates,
} from '../../../../shared/voxsim/index.js';
import { createMulberry32 } from '../prng.js';
import { InnovationLedger } from './InnovationLedger.js';
import {
  cloneGenome,
  crossover,
  mutateAddConnection,
  mutateAddLstmNode,
  mutateAddNode,
  mutateToggleEnabled,
  mutateWeights,
} from './NeatMutationOperators.js';

function baseRates(overrides: Partial<NeatMutationRates> = {}): NeatMutationRates {
  return {
    weightPerturbProb: 1,
    weightPerturbStd: 0.1,
    weightReplaceProb: 0,
    addConnectionProb: 1,
    addNodeProb: 1,
    toggleEnabledProb: 0,
    initialWeightRange: 1,
    ...overrides,
  };
}

function minimalGenome(): NeatGenome {
  return {
    id: 'm',
    nodes: [
      { id: 1, kind: 'input', activation: 'linear', bias: 0, inputBindingId: 'in0' },
      { id: 2, kind: 'bias', activation: 'linear', bias: 1 },
      { id: 3, kind: 'output', activation: 'tanh', bias: 0, outputBindingId: 'out0' },
    ],
    connections: [
      { innovation: 1, sourceNodeId: 1, targetNodeId: 3, weight: 0.5, enabled: true },
      { innovation: 2, sourceNodeId: 2, targetNodeId: 3, weight: 0.0, enabled: true },
    ],
    nextLocalNodeId: 4,
  };
}

describe('NeatMutationOperators', () => {
  it('mutateWeights perturbs weights deterministically with the same seed', () => {
    const g1 = mutateWeights(minimalGenome(), baseRates(), createMulberry32(1));
    const g2 = mutateWeights(minimalGenome(), baseRates(), createMulberry32(1));
    expect(g1.connections.map((c) => c.weight)).toEqual(g2.connections.map((c) => c.weight));
    expect(g1.connections[0]!.weight).not.toBe(0.5);
  });

  it('mutateToggleEnabled flips enabled flags with prob 1', () => {
    const g = mutateToggleEnabled(minimalGenome(), baseRates({ toggleEnabledProb: 1 }), createMulberry32(2));
    expect(g.connections.every((c) => !c.enabled)).toBe(true);
  });

  it('mutateAddNode disables the split connection and adds two new connections through a new hidden node', () => {
    const ledger = new InnovationLedger(3, 4);
    const before = minimalGenome();
    const out = mutateAddNode(before, ledger, baseRates(), createMulberry32(3), 0);
    const beforeIds = new Set(before.connections.map((c) => c.innovation));
    const disabled = out.connections.filter(
      (c) => beforeIds.has(c.innovation) && !c.enabled,
    );
    expect(disabled.length).toBe(1);
    expect(out.connections.length).toBe(4);
    const newNode = out.nodes.find((n) => n.kind === 'hidden');
    expect(newNode).toBeDefined();
    const newIn = out.connections.find((c) => c.targetNodeId === newNode!.id);
    const newOut = out.connections.find((c) => c.sourceNodeId === newNode!.id);
    expect(newIn).toBeDefined();
    expect(newOut).toBeDefined();
  });

  it('mutateAddConnection respects DAG when allowRecurrent is false', () => {
    const ledger = new InnovationLedger(3, 4);
    let g = minimalGenome();
    g = mutateAddNode(g, ledger, baseRates(), createMulberry32(3), 0);
    const out = mutateAddConnection(g, ledger, baseRates(), false, createMulberry32(4), 1, 64);
    for (const c of out.connections) {
      expect(c.sourceNodeId).not.toBe(c.targetNodeId);
    }
  });

  it('mutateAddLstmNode inserts an LSTM node with four gate connections', () => {
    const ledger = new InnovationLedger(3, 4);
    const out = mutateAddLstmNode(
      minimalGenome(),
      ledger,
      baseRates(),
      0.1,
      createMulberry32(5),
      0,
    );
    const lstmNode = out.nodes.find((n) => n.kind === 'lstm');
    expect(lstmNode).toBeDefined();
    const gateConns = out.connections.filter((c) => c.targetNodeId === lstmNode!.id && c.lstmGate);
    expect(gateConns.length).toBe(4);
    const gates = new Set(gateConns.map((c) => c.lstmGate));
    expect(gates.size).toBe(4);
  });

  it('crossover prefers the more fit parent for disjoint/excess genes', () => {
    const a = minimalGenome();
    const b = cloneGenome(a, 'b');
    b.connections.push({
      innovation: 99,
      sourceNodeId: 1,
      targetNodeId: 3,
      weight: 12,
      enabled: true,
    });
    const childB = crossover(
      a,
      b,
      0.1,
      0.9,
      { interspeciesProb: 0, disabledGeneInheritsDisabledProb: 0 },
      createMulberry32(7),
    );
    expect(childB.connections.find((c) => c.innovation === 99)).toBeDefined();
    const childA = crossover(
      a,
      b,
      0.9,
      0.1,
      { interspeciesProb: 0, disabledGeneInheritsDisabledProb: 0 },
      createMulberry32(7),
    );
    expect(childA.connections.find((c) => c.innovation === 99)).toBeUndefined();
  });
});
