/**
 * Helpers for building NEAT genome runtime indexes.
 */

import type { NeatConnectionGene, NeatGenome, NeatNodeGene } from '../types.js';

export interface IncomingEdge {
  sourceNodeId: number;
  weight: number;
  enabled: boolean;
  lstmGate?: NeatConnectionGene['lstmGate'];
}

export interface NodeIndex {
  /** Map node id -> node. */
  byId: Map<number, NeatNodeGene>;
  /** Per node: contiguous index into the activation buffer. */
  slot: Map<number, number>;
  /** Reverse: slot -> node id. */
  slotToNodeId: number[];
  /** Per node: incoming enabled edges (precomputed for `act`). */
  incoming: Map<number, IncomingEdge[]>;
  inputs: NeatNodeGene[];
  outputs: NeatNodeGene[];
  hidden: NeatNodeGene[];
  bias: NeatNodeGene[];
  lstm: NeatNodeGene[];
}

export function indexGenome(genome: NeatGenome): NodeIndex {
  const byId = new Map<number, NeatNodeGene>();
  const slot = new Map<number, number>();
  const slotToNodeId: number[] = [];
  for (let i = 0; i < genome.nodes.length; i++) {
    const node = genome.nodes[i];
    byId.set(node.id, node);
    slot.set(node.id, i);
    slotToNodeId.push(node.id);
  }
  const incoming = new Map<number, IncomingEdge[]>();
  for (const node of genome.nodes) incoming.set(node.id, []);
  for (const conn of genome.connections) {
    if (!conn.enabled) continue;
    const list = incoming.get(conn.targetNodeId);
    if (!list) continue;
    list.push({
      sourceNodeId: conn.sourceNodeId,
      weight: conn.weight,
      enabled: conn.enabled,
      lstmGate: conn.lstmGate,
    });
  }
  const inputs: NeatNodeGene[] = [];
  const outputs: NeatNodeGene[] = [];
  const hidden: NeatNodeGene[] = [];
  const bias: NeatNodeGene[] = [];
  const lstm: NeatNodeGene[] = [];
  for (const node of genome.nodes) {
    switch (node.kind) {
      case 'input':
        inputs.push(node);
        break;
      case 'output':
        outputs.push(node);
        break;
      case 'hidden':
        hidden.push(node);
        break;
      case 'bias':
        bias.push(node);
        break;
      case 'lstm':
        lstm.push(node);
        break;
    }
  }
  return { byId, slot, slotToNodeId, incoming, inputs, outputs, hidden, bias, lstm };
}

/**
 * Kahn's algorithm over enabled edges. Throws if a cycle is detected.
 */
export function topologicalOrder(index: NodeIndex): number[] {
  const inDegree = new Map<number, number>();
  for (const id of index.byId.keys()) inDegree.set(id, 0);
  for (const [target, edges] of index.incoming) {
    inDegree.set(target, edges.length);
  }
  const queue: number[] = [];
  // Inputs and bias nodes always come first.
  for (const node of index.inputs) {
    if ((inDegree.get(node.id) ?? 0) === 0) queue.push(node.id);
  }
  for (const node of index.bias) {
    if ((inDegree.get(node.id) ?? 0) === 0) queue.push(node.id);
  }
  for (const id of inDegree.keys()) {
    const node = index.byId.get(id);
    if (!node) continue;
    if (node.kind === 'input' || node.kind === 'bias') continue;
    if ((inDegree.get(id) ?? 0) === 0) queue.push(id);
  }
  // Adjacency: source -> targets.
  const fanout = new Map<number, number[]>();
  for (const id of index.byId.keys()) fanout.set(id, []);
  for (const [target, edges] of index.incoming) {
    for (const e of edges) {
      const list = fanout.get(e.sourceNodeId);
      if (list) list.push(target);
    }
  }
  const order: number[] = [];
  while (queue.length > 0) {
    const id = queue.shift() as number;
    order.push(id);
    const next = fanout.get(id) ?? [];
    for (const t of next) {
      const d = (inDegree.get(t) ?? 0) - 1;
      inDegree.set(t, d);
      if (d === 0) queue.push(t);
    }
  }
  if (order.length !== index.byId.size) {
    throw new Error('NEAT genome graph is cyclic but topological order was requested');
  }
  return order;
}
