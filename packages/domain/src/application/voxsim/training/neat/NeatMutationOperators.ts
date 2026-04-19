/**
 * Pure-function NEAT mutation and crossover operators. All return cloned
 * genomes so the caller can keep the parent immutable for inspector diffs.
 */

import type {
  LstmGate,
  NeatConnectionGene,
  NeatCrossoverConfig,
  NeatGenome,
  NeatMutationRates,
  NeatNodeGene,
} from '../../../../shared/voxsim/index.js';
import type { SeededPrng } from '../prng.js';
import type { InnovationLedger } from './InnovationLedger.js';

let cloneCounter = 0;

function newGenomeId(prefix: string): string {
  cloneCounter += 1;
  return `${prefix}-${cloneCounter.toString(36)}`;
}

export function cloneGenome(genome: NeatGenome, idPrefix = 'g'): NeatGenome {
  return {
    id: newGenomeId(idPrefix),
    nextLocalNodeId: genome.nextLocalNodeId,
    nodes: genome.nodes.map((n) => ({ ...n })),
    connections: genome.connections.map((c) => ({ ...c })),
  };
}

function getNode(g: NeatGenome, id: number): NeatNodeGene | undefined {
  for (const n of g.nodes) if (n.id === id) return n;
  return undefined;
}

function hasConnection(g: NeatGenome, source: number, target: number): boolean {
  for (const c of g.connections) {
    if (c.sourceNodeId === source && c.targetNodeId === target) return true;
  }
  return false;
}

/**
 * Detect whether `(source -> target)` would create a cycle in the existing
 * graph (used when `allowRecurrent === false`).
 */
function wouldCreateCycle(g: NeatGenome, source: number, target: number): boolean {
  if (source === target) return true;
  const adjacency = new Map<number, number[]>();
  for (const c of g.connections) {
    if (!c.enabled) continue;
    const list = adjacency.get(c.sourceNodeId) ?? [];
    list.push(c.targetNodeId);
    adjacency.set(c.sourceNodeId, list);
  }
  const visited = new Set<number>();
  const stack: number[] = [target];
  while (stack.length) {
    const cur = stack.pop()!;
    if (cur === source) return true;
    if (visited.has(cur)) continue;
    visited.add(cur);
    for (const n of adjacency.get(cur) ?? []) stack.push(n);
  }
  return false;
}

export function mutateWeights(
  genome: NeatGenome,
  rates: NeatMutationRates,
  prng: SeededPrng,
): NeatGenome {
  const out = cloneGenome(genome, 'mw');
  for (const c of out.connections) {
    if (prng.next() < rates.weightReplaceProb) {
      c.weight = prng.nextRange(-rates.initialWeightRange, rates.initialWeightRange);
    } else if (prng.next() < rates.weightPerturbProb) {
      c.weight += prng.nextGaussian() * rates.weightPerturbStd;
    }
  }
  return out;
}

export function mutateToggleEnabled(
  genome: NeatGenome,
  rates: NeatMutationRates,
  prng: SeededPrng,
): NeatGenome {
  const out = cloneGenome(genome, 'mt');
  for (const c of out.connections) {
    if (prng.next() < rates.toggleEnabledProb) {
      c.enabled = !c.enabled;
    }
  }
  return out;
}

export function mutateAddConnection(
  genome: NeatGenome,
  ledger: InnovationLedger,
  rates: NeatMutationRates,
  allowRecurrent: boolean,
  prng: SeededPrng,
  generation: number,
  attempts = 16,
): NeatGenome {
  if (genome.nodes.length < 2) return genome;
  const out = cloneGenome(genome, 'mac');
  const candidatesSource = out.nodes.filter((n) => n.kind !== 'output');
  const candidatesTarget = out.nodes.filter((n) => n.kind !== 'input' && n.kind !== 'bias');
  if (candidatesSource.length === 0 || candidatesTarget.length === 0) return out;

  for (let i = 0; i < attempts; i++) {
    const source = candidatesSource[Math.floor(prng.next() * candidatesSource.length)]!;
    const target = candidatesTarget[Math.floor(prng.next() * candidatesTarget.length)]!;
    if (hasConnection(out, source.id, target.id)) continue;
    if (!allowRecurrent && wouldCreateCycle(out, source.id, target.id)) continue;
    const innovation = ledger.getOrAssignConnectionInnovation(source.id, target.id, generation);
    out.connections.push({
      innovation,
      sourceNodeId: source.id,
      targetNodeId: target.id,
      weight: prng.nextRange(-rates.initialWeightRange, rates.initialWeightRange),
      enabled: true,
    });
    return out;
  }
  return out;
}

export function mutateAddNode(
  genome: NeatGenome,
  ledger: InnovationLedger,
  rates: NeatMutationRates,
  prng: SeededPrng,
  generation: number,
): NeatGenome {
  const enabled = genome.connections.filter((c) => c.enabled);
  if (enabled.length === 0) return genome;
  const split = enabled[Math.floor(prng.next() * enabled.length)]!;
  const out = cloneGenome(genome, 'man');
  for (const c of out.connections) {
    if (c.innovation === split.innovation) c.enabled = false;
  }
  const newNodeId = ledger.getOrAssignNodeInnovation(split.innovation, generation);
  ledger.reserveNodeId(newNodeId);
  out.nextLocalNodeId = Math.max(out.nextLocalNodeId, newNodeId + 1);
  out.nodes.push({
    id: newNodeId,
    kind: 'hidden',
    activation: 'tanh',
    bias: 0,
  });
  const innoIn = ledger.getOrAssignConnectionInnovation(split.sourceNodeId, newNodeId, generation);
  const innoOut = ledger.getOrAssignConnectionInnovation(newNodeId, split.targetNodeId, generation);
  out.connections.push({
    innovation: innoIn,
    sourceNodeId: split.sourceNodeId,
    targetNodeId: newNodeId,
    weight: 1,
    enabled: true,
  });
  out.connections.push({
    innovation: innoOut,
    sourceNodeId: newNodeId,
    targetNodeId: split.targetNodeId,
    weight: split.weight,
    enabled: true,
  });
  // suppress unused warning; rates may be used by future strategies
  void rates;
  void prng;
  return out;
}

const LSTM_GATES: LstmGate[] = ['input', 'output', 'forget', 'candidate'];

export function mutateAddLstmNode(
  genome: NeatGenome,
  ledger: InnovationLedger,
  rates: NeatMutationRates,
  gateInitWeightStd: number,
  prng: SeededPrng,
  generation: number,
): NeatGenome {
  const enabled = genome.connections.filter((c) => c.enabled);
  if (enabled.length === 0) return genome;
  const split = enabled[Math.floor(prng.next() * enabled.length)]!;
  const out = cloneGenome(genome, 'mln');
  for (const c of out.connections) {
    if (c.innovation === split.innovation) c.enabled = false;
  }
  const newNodeId = ledger.getOrAssignNodeInnovation(split.innovation, generation);
  ledger.reserveNodeId(newNodeId);
  out.nextLocalNodeId = Math.max(out.nextLocalNodeId, newNodeId + 1);
  out.nodes.push({
    id: newNodeId,
    kind: 'lstm',
    activation: 'tanh',
    bias: 0,
  });
  for (const gate of LSTM_GATES) {
    const innovation = ledger.getOrAssignConnectionInnovation(
      split.sourceNodeId,
      newNodeId,
      generation,
    );
    const conn: NeatConnectionGene = {
      innovation,
      sourceNodeId: split.sourceNodeId,
      targetNodeId: newNodeId,
      weight: prng.nextGaussian() * gateInitWeightStd,
      enabled: true,
      lstmGate: gate,
    };
    out.connections.push(conn);
  }
  const outInnovation = ledger.getOrAssignConnectionInnovation(newNodeId, split.targetNodeId, generation);
  out.connections.push({
    innovation: outInnovation,
    sourceNodeId: newNodeId,
    targetNodeId: split.targetNodeId,
    weight: split.weight,
    enabled: true,
  });
  void rates;
  return out;
}

export function crossover(
  parentA: NeatGenome,
  parentB: NeatGenome,
  fitnessA: number,
  fitnessB: number,
  config: NeatCrossoverConfig,
  prng: SeededPrng,
): NeatGenome {
  const moreFit = fitnessA >= fitnessB ? parentA : parentB;
  const lessFit = moreFit === parentA ? parentB : parentA;
  const tied = fitnessA === fitnessB;

  const aMap = new Map<number, NeatConnectionGene>();
  for (const c of parentA.connections) aMap.set(c.innovation, c);
  const bMap = new Map<number, NeatConnectionGene>();
  for (const c of parentB.connections) bMap.set(c.innovation, c);

  const allInnovations = new Set<number>();
  for (const k of aMap.keys()) allInnovations.add(k);
  for (const k of bMap.keys()) allInnovations.add(k);

  const childConnections: NeatConnectionGene[] = [];
  const usedNodeIds = new Set<number>();

  for (const innovation of Array.from(allInnovations).sort((a, b) => a - b)) {
    const inA = aMap.get(innovation);
    const inB = bMap.get(innovation);
    let chosen: NeatConnectionGene | undefined;
    if (inA && inB) {
      chosen = prng.next() < 0.5 ? inA : inB;
    } else if (inA && (moreFit === parentA || tied)) {
      chosen = inA;
    } else if (inB && (moreFit === parentB || tied)) {
      chosen = inB;
    }
    if (!chosen) continue;
    const cloned: NeatConnectionGene = { ...chosen };
    const aDisabled = inA && !inA.enabled;
    const bDisabled = inB && !inB.enabled;
    if ((aDisabled || bDisabled) && prng.next() < config.disabledGeneInheritsDisabledProb) {
      cloned.enabled = false;
    }
    childConnections.push(cloned);
    usedNodeIds.add(cloned.sourceNodeId);
    usedNodeIds.add(cloned.targetNodeId);
  }

  // Build node set: required nodes plus all input/bias/output nodes from the
  // more-fit parent so the resulting genome stays evaluable even with no
  // matching input connections.
  const nodes: NeatNodeGene[] = [];
  const seen = new Set<number>();
  function pushNode(node: NeatNodeGene) {
    if (seen.has(node.id)) return;
    seen.add(node.id);
    nodes.push({ ...node });
  }
  for (const n of moreFit.nodes) {
    if (n.kind === 'input' || n.kind === 'bias' || n.kind === 'output') pushNode(n);
  }
  for (const id of usedNodeIds) {
    const fromMore = getNode(moreFit, id);
    const fromLess = fromMore ? undefined : getNode(lessFit, id);
    if (fromMore) pushNode(fromMore);
    else if (fromLess) pushNode(fromLess);
  }

  const nextLocalNodeId = Math.max(
    parentA.nextLocalNodeId,
    parentB.nextLocalNodeId,
    nodes.reduce((m, n) => (n.id > m ? n.id : m), 0) + 1,
  );

  return {
    id: newGenomeId('cx'),
    nodes,
    connections: childConnections,
    nextLocalNodeId,
  };
}
