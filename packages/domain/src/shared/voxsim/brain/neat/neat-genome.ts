/**
 * NEAT genome data records. Plan 04 owns the schema; plan 05 owns the
 * trainer that mutates and crosses these.
 */

import type { CppnActivationKind, NeatActivationKind } from './neat-activations.js';

export type NeatNodeKind = 'input' | 'bias' | 'output' | 'hidden' | 'lstm';

export type LstmGate = 'input' | 'output' | 'forget' | 'candidate';

export interface NeatNodeGene {
  /** Per-genome stable id; allocated through the run's `InnovationLedger`. */
  id: number;
  kind: NeatNodeKind;
  /** Ignored when `kind === 'lstm'`. CPPN nodes may use the wider activation set. */
  activation: NeatActivationKind | CppnActivationKind;
  bias: number;
  /** Only set on inputs; matches `InputEncoder.inputs[].sensorId` (or a synthetic CPPN substrate-coordinate id). */
  inputBindingId?: string;
  /** Only set on outputs; matches `OutputDecoder.outputs[].actuatorId` (or the CPPN weight-output id). */
  outputBindingId?: string;
}

export interface NeatConnectionGene {
  innovation: number;
  sourceNodeId: number;
  targetNodeId: number;
  weight: number;
  enabled: boolean;
  /** Only valid in NEAT-LSTM and only when target node is `kind === 'lstm'`. */
  lstmGate?: LstmGate;
}

export interface NeatGenome {
  id: string;
  nodes: NeatNodeGene[];
  connections: NeatConnectionGene[];
  /**
   * Monotonically increasing local id allocator used during structural
   * mutation when the run-wide `InnovationLedger` has not yet been consulted.
   */
  nextLocalNodeId: number;
}

export function countLstmNodes(genome: NeatGenome): number {
  let n = 0;
  for (const node of genome.nodes) {
    if (node.kind === 'lstm') n++;
  }
  return n;
}
