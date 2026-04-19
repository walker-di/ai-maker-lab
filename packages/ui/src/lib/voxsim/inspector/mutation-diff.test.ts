import { describe, expect, it } from 'bun:test';

import { diffMlpWeights, diffNeatGenomes } from './mutation-diff.js';
import { makeNeatGenome } from './__test-helpers__/fixtures.js';
import type { NeatGenome } from '../brain/types.js';

describe('diffMlpWeights', () => {
  it('returns deltas only for edges that changed beyond tolerance', () => {
    const prev = new Float32Array([0.1, 0.2, 0.3, 0.4]);
    const curr = new Float32Array([0.1, 0.2, 0.5, 0.4]);
    const ids = ['e0', 'e1', 'e2', 'e3'];
    const diff = diffMlpWeights(prev, curr, ids);
    expect(diff.kind).toBe('mlp');
    if (diff.kind !== 'mlp') return;
    expect(diff.edgeWeightDeltas).toHaveLength(1);
    expect(diff.edgeWeightDeltas[0]).toEqual({ edgeId: 'e2', delta: expect.any(Number) });
    expect(diff.edgeWeightDeltas[0]!.delta).toBeCloseTo(0.2);
  });

  it('throws when buffer lengths differ', () => {
    const prev = new Float32Array(2);
    const curr = new Float32Array(3);
    expect(() => diffMlpWeights(prev, curr, ['a', 'b'])).toThrow();
  });
});

describe('diffNeatGenomes', () => {
  it('flags added nodes, added edges, toggled edges and weight deltas', () => {
    const prev = makeNeatGenome();
    const next: NeatGenome = {
      ...prev,
      nodes: [
        ...prev.nodes,
        { id: 7, kind: 'hidden', activation: 'relu', bias: 0 },
      ],
      connections: [
        { ...prev.connections[0]!, weight: 0.5 + 0.1 },
        { ...prev.connections[1]! },
        { ...prev.connections[2]!, enabled: true },
        {
          innovation: 99,
          sourceNodeId: 7,
          targetNodeId: 2,
          weight: 0.3,
          enabled: true,
        },
      ],
      nextLocalNodeId: 8,
    };
    const diff = diffNeatGenomes(prev, next);
    expect(diff.kind).toBe('neat');
    if (diff.kind !== 'neat') return;
    expect(diff.addedNodes.map((n) => n.nodeId)).toEqual([7]);
    expect(diff.addedEdges.map((e) => e.innovation)).toEqual([99]);
    expect(diff.toggledEdges).toEqual([{ edgeId: 'neat_conn_3', nowEnabled: true }]);
    expect(diff.weightDeltas).toHaveLength(1);
    expect(diff.weightDeltas[0]!.edgeId).toBe('neat_conn_1');
  });

  it('returns empty diff when genomes are identical', () => {
    const a = makeNeatGenome();
    const b = makeNeatGenome();
    const diff = diffNeatGenomes(a, b);
    if (diff.kind !== 'neat') throw new Error('unreachable');
    expect(diff.addedNodes).toEqual([]);
    expect(diff.addedEdges).toEqual([]);
    expect(diff.toggledEdges).toEqual([]);
    expect(diff.weightDeltas).toEqual([]);
  });
});
