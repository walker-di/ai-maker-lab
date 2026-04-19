/**
 * Pure helpers for computing mutation diffs between two checkpoints. Both
 * the live tap and the replay-driven inspector consume these helpers when the
 * "show diff" overlay is enabled.
 */

import type { NeatConnectionGene, NeatGenome } from '../brain/types.js';
import type {
  InspectorMutationDiff,
  MlpEdgeWeightDelta,
  NeatAddedEdgeEntry,
  NeatAddedNodeEntry,
  NeatToggledEdgeEntry,
  NeatWeightDeltaEntry,
} from './types.js';

export function diffMlpWeights(
  previousWeights: Float32Array,
  currentWeights: Float32Array,
  edgeIds: readonly string[],
  tolerance = 1e-6,
): InspectorMutationDiff {
  if (currentWeights.length !== previousWeights.length) {
    throw new Error(
      `weight buffer length mismatch (prev=${previousWeights.length} curr=${currentWeights.length})`,
    );
  }
  const deltas: MlpEdgeWeightDelta[] = [];
  for (let i = 0; i < edgeIds.length; i++) {
    const prev = previousWeights[i] ?? 0;
    const curr = currentWeights[i] ?? 0;
    const delta = curr - prev;
    if (Math.abs(delta) > tolerance) {
      deltas.push({ edgeId: edgeIds[i]!, delta });
    }
  }
  return { kind: 'mlp', edgeWeightDeltas: deltas };
}

function neatEdgeId(c: NeatConnectionGene): string {
  return `neat_conn_${c.innovation}`;
}

export function diffNeatGenomes(
  previous: NeatGenome,
  current: NeatGenome,
  tolerance = 1e-6,
): InspectorMutationDiff {
  const prevNodeIds = new Set<number>(previous.nodes.map((n) => n.id));
  const addedNodes: NeatAddedNodeEntry[] = [];
  for (const n of current.nodes) {
    if (!prevNodeIds.has(n.id)) {
      addedNodes.push({ nodeId: n.id, kind: n.kind, bias: n.bias });
    }
  }

  const prevConns = new Map<number, NeatConnectionGene>();
  for (const c of previous.connections) prevConns.set(c.innovation, c);

  const addedEdges: NeatAddedEdgeEntry[] = [];
  const toggledEdges: NeatToggledEdgeEntry[] = [];
  const weightDeltas: NeatWeightDeltaEntry[] = [];

  for (const c of current.connections) {
    const prev = prevConns.get(c.innovation);
    if (!prev) {
      addedEdges.push({
        edgeId: neatEdgeId(c),
        sourceNodeId: c.sourceNodeId,
        targetNodeId: c.targetNodeId,
        weight: c.weight,
        innovation: c.innovation,
        lstmGate: c.lstmGate,
      });
      continue;
    }
    if (prev.enabled !== c.enabled) {
      toggledEdges.push({
        edgeId: neatEdgeId(c),
        nowEnabled: c.enabled,
      });
    }
    const delta = c.weight - prev.weight;
    if (Math.abs(delta) > tolerance) {
      weightDeltas.push({ edgeId: neatEdgeId(c), delta });
    }
  }

  return {
    kind: 'neat',
    addedNodes,
    addedEdges,
    toggledEdges,
    weightDeltas,
  };
}
