import { describe, expect, test } from 'bun:test';
import { validateBrainDna } from '../validation.js';
import type { BrainDna } from '../brain-dna.js';
import type { NeatGenome } from './neat-genome.js';

function makeNeatDna(): BrainDna {
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
    neat: { seed: 1, initialNodeBias: 0.1, allowRecurrent: false },
    metadata: { name: 't', createdAt: 'x', updatedAt: 'y', author: 'z' },
  };
}

function makeGenome(): NeatGenome {
  return {
    id: 'g1',
    nodes: [
      { id: 1, kind: 'input', activation: 'linear', bias: 0, inputBindingId: 's1' },
      { id: 2, kind: 'output', activation: 'tanh', bias: 0, outputBindingId: 'a1' },
    ],
    connections: [{ innovation: 1, sourceNodeId: 1, targetNodeId: 2, weight: 0.5, enabled: true }],
    nextLocalNodeId: 3,
  };
}

describe('NeatGenomeValidator (via validateBrainDna)', () => {
  test('accepts a sound minimal genome', () => {
    const result = validateBrainDna(makeNeatDna(), makeGenome());
    expect(result.ok).toBe(true);
  });

  test('rejects unknown source/target node ids', () => {
    const g = makeGenome();
    g.connections.push({ innovation: 2, sourceNodeId: 99, targetNodeId: 2, weight: 1, enabled: true });
    const result = validateBrainDna(makeNeatDna(), g);
    expect(result.issues.some((i) => i.code === 'neat_genome_unknown_source_node')).toBe(true);
  });

  test('rejects connection targeting an input node', () => {
    const g = makeGenome();
    g.connections.push({ innovation: 2, sourceNodeId: 2, targetNodeId: 1, weight: 1, enabled: true });
    const result = validateBrainDna(makeNeatDna(), g);
    expect(result.issues.some((i) => i.code === 'neat_genome_connection_targets_input')).toBe(true);
  });

  test('rejects connection sourced from an output node', () => {
    const g = makeGenome();
    // add a hidden node and connect output -> hidden
    g.nodes.push({ id: 3, kind: 'hidden', activation: 'tanh', bias: 0 });
    g.connections.push({ innovation: 2, sourceNodeId: 2, targetNodeId: 3, weight: 1, enabled: true });
    const result = validateBrainDna(makeNeatDna(), g);
    expect(result.issues.some((i) => i.code === 'neat_genome_connection_sourced_from_output')).toBe(true);
  });

  test('rejects cyclic graph when allowRecurrent=false but accepts when true', () => {
    const dna = makeNeatDna();
    const g: NeatGenome = {
      id: 'g',
      nodes: [
        { id: 1, kind: 'input', activation: 'linear', bias: 0, inputBindingId: 's1' },
        { id: 2, kind: 'hidden', activation: 'tanh', bias: 0 },
        { id: 3, kind: 'hidden', activation: 'tanh', bias: 0 },
        { id: 4, kind: 'output', activation: 'tanh', bias: 0, outputBindingId: 'a1' },
      ],
      connections: [
        { innovation: 1, sourceNodeId: 1, targetNodeId: 2, weight: 1, enabled: true },
        { innovation: 2, sourceNodeId: 2, targetNodeId: 3, weight: 1, enabled: true },
        { innovation: 3, sourceNodeId: 3, targetNodeId: 2, weight: 1, enabled: true },
        { innovation: 4, sourceNodeId: 3, targetNodeId: 4, weight: 1, enabled: true },
      ],
      nextLocalNodeId: 5,
    };
    const failed = validateBrainDna(dna, g);
    expect(failed.issues.some((i) => i.code === 'neat_genome_cyclic_graph_with_recurrence_disabled')).toBe(true);

    dna.neat!.allowRecurrent = true;
    const ok = validateBrainDna(dna, g);
    expect(ok.issues.some((i) => i.code === 'neat_genome_cyclic_graph_with_recurrence_disabled')).toBe(false);
  });

  test('rejects unknown inputBindingId', () => {
    const g = makeGenome();
    g.nodes[0].inputBindingId = 'unknown_sensor';
    const result = validateBrainDna(makeNeatDna(), g);
    expect(result.issues.some((i) => i.code === 'neat_genome_input_binding_unknown_sensor_id')).toBe(true);
  });

  test('rejects unknown outputBindingId', () => {
    const g = makeGenome();
    g.nodes[1].outputBindingId = 'unknown_actuator';
    const result = validateBrainDna(makeNeatDna(), g);
    expect(result.issues.some((i) => i.code === 'neat_genome_output_binding_unknown_actuator_id')).toBe(true);
  });

  test('rejects lstm node when topology is not neatLstm', () => {
    const g = makeGenome();
    g.nodes.push({ id: 3, kind: 'lstm', activation: 'tanh', bias: 0 });
    const result = validateBrainDna(makeNeatDna(), g);
    expect(result.issues.some((i) => i.code === 'neat_genome_lstm_node_in_non_lstm_topology')).toBe(true);
  });

  test('rejects CPPN-only activation outside hyperNeat', () => {
    const g = makeGenome();
    g.nodes[1].activation = 'abs';
    const result = validateBrainDna(makeNeatDna(), g);
    expect(result.issues.some((i) => i.code === 'neat_genome_cppn_only_activation_in_non_hyperneat')).toBe(true);
  });

  test('rejects non-finite weight', () => {
    const g = makeGenome();
    g.connections[0].weight = Number.NaN;
    const result = validateBrainDna(makeNeatDna(), g);
    expect(result.issues.some((i) => i.code === 'neat_genome_weight_not_finite')).toBe(true);
  });
});
