import { describe, expect, it } from 'bun:test';

import { deriveBrainGraph } from './brain-topology-derive.js';
import {
  makeMlpBrainDna,
  makeNeatBrainDna,
  makeNeatGenome,
} from './__test-helpers__/fixtures.js';
import { buildSpeciesPalette } from './species-palette.js';

describe('deriveBrainGraph (MLP)', () => {
  it('produces deterministic node ids for the same fixed-topology BrainDna', () => {
    const dna = makeMlpBrainDna();
    const weights = new Float32Array(3 * 4 + 4 + 4 * 2).fill(0.1);
    const a = deriveBrainGraph(dna, { kind: 'flat', weights });
    const b = deriveBrainGraph(dna, { kind: 'flat', weights });
    expect(a.nodes.map((n) => n.id)).toEqual(b.nodes.map((n) => n.id));
    expect(a.nodes.find((n) => n.id === 'input_0')?.label).toBe('imu[0]');
    expect(a.nodes.find((n) => n.id === 'output_0')?.label).toBe('hipL');
    expect(a.topology).toBe('mlp');
    expect(a.bounds.minWeight).toBeCloseTo(0.1);
    expect(a.bounds.maxWeight).toBeCloseTo(0.1);
  });

  it('honors weightThreshold by skipping near-zero edges', () => {
    const dna = makeMlpBrainDna();
    const weights = new Float32Array(3 * 4 + 4 + 4 * 2);
    weights[0] = 0.0001; // below threshold
    weights[1] = 0.5;
    const graph = deriveBrainGraph(
      dna,
      { kind: 'flat', weights },
      { weightThreshold: 0.001 },
    );
    expect(graph.edges.some((e) => e.weight === 0.5)).toBe(true);
    expect(graph.edges.some((e) => e.weight === 0.0001)).toBe(false);
  });

  it('applies an MLP mutation diff to edge weightDelta', () => {
    const dna = makeMlpBrainDna();
    const weights = new Float32Array(3 * 4 + 4 + 4 * 2).fill(0.1);
    const graph = deriveBrainGraph(
      dna,
      { kind: 'flat', weights },
      {
        diff: {
          kind: 'mlp',
          edgeWeightDeltas: [{ edgeId: 'input_0__dense_0_unit_0', delta: 0.7 }],
        },
      },
    );
    const edge = graph.edges.find((e) => e.id === 'input_0__dense_0_unit_0');
    expect(edge?.weightDelta).toBe(0.7);
  });
});

describe('deriveBrainGraph (NEAT)', () => {
  it('preserves enabled flag and innovation per edge', () => {
    const dna = makeNeatBrainDna();
    const genome = makeNeatGenome();
    const graph = deriveBrainGraph(dna, { kind: 'neatGenome', genome });
    expect(graph.topology).toBe('neat');
    expect(graph.nodes).toHaveLength(4);
    const disabled = graph.edges.find((e) => e.id === 'neat_conn_3');
    expect(disabled?.enabled).toBe(false);
    expect(disabled?.innovation).toBe(3);
  });

  it('attaches speciesPalette and speciesId when supplied', () => {
    const dna = makeNeatBrainDna();
    const genome = makeNeatGenome();
    const palette = buildSpeciesPalette('run-1', [1, 2]);
    const graph = deriveBrainGraph(
      dna,
      { kind: 'neatGenome', genome },
      { speciesId: 1, speciesPalette: palette },
    );
    expect(graph.speciesPalette).toBe(palette);
    expect(graph.nodes.every((n) => n.speciesId === 1)).toBe(true);
  });

  it('applies a NEAT mutation diff (added node, added edge, toggled, weight delta)', () => {
    const dna = makeNeatBrainDna();
    const genome = makeNeatGenome();
    const graph = deriveBrainGraph(
      dna,
      { kind: 'neatGenome', genome },
      {
        diff: {
          kind: 'neat',
          addedNodes: [{ nodeId: 99, kind: 'hidden', bias: 0 }],
          addedEdges: [
            {
              edgeId: 'neat_conn_2',
              sourceNodeId: 1,
              targetNodeId: 3,
              weight: -0.25,
              innovation: 2,
            },
          ],
          toggledEdges: [{ edgeId: 'neat_conn_3', nowEnabled: true }],
          weightDeltas: [{ edgeId: 'neat_conn_1', delta: 0.123 }],
        },
      },
    );
    const newEdge = graph.edges.find((e) => e.id === 'neat_conn_2');
    const toggled = graph.edges.find((e) => e.id === 'neat_conn_3');
    const weightChanged = graph.edges.find((e) => e.id === 'neat_conn_1');
    expect(newEdge?.isNew).toBe(true);
    expect(toggled?.enabled).toBe(true);
    expect(weightChanged?.weightDelta).toBeCloseTo(0.123);
  });
});

describe('species palette', () => {
  it('produces stable colors across calls', () => {
    const a = buildSpeciesPalette('run-1', [1, 2, 3]);
    const b = buildSpeciesPalette('run-1', [1, 2, 3]);
    expect(a).toEqual(b);
    expect(a[1]).not.toBe(a[2]);
  });
});
