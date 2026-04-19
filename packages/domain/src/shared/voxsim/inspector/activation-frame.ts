/**
 * `InspectorActivationFrame` is a discriminated union over fixed-topology and
 * NEAT-family taps. Both kinds carry the inputs and outputs at a given
 * `stepIndex`; only the per-node breakdown differs.
 */

import type { BrainTopology } from '../brain/index.js';

export interface MlpActivationFrame {
  kind: 'mlp';
  stepIndex: number;
  inputs: Float32Array;
  /** Per-layer hidden activations. `hidden[i]` is layer `i`'s output. */
  hidden: Float32Array[];
  outputsRaw: Float32Array;
  outputsDecoded: Float32Array;
}

export interface NeatLstmGateSnapshot {
  input: number;
  forget: number;
  output: number;
  candidate: number;
  cellState: number;
  hiddenState: number;
}

export interface NeatActivationFrame {
  kind: 'neat' | 'hyperNeat' | 'neatLstm';
  stepIndex: number;
  inputs: Float32Array;
  /** Per-node activation keyed by NEAT `nodeId`. */
  nodeActivations: Map<number, number>;
  /** HyperNEAT-only CPPN-side activations (sampled, not exhaustive). */
  cppnNodeActivations?: Map<number, number>;
  /** NEAT-LSTM-only per-LSTM-node gate snapshot keyed by `nodeId`. */
  lstmGates?: Map<number, NeatLstmGateSnapshot>;
  outputsRaw: Float32Array;
  outputsDecoded: Float32Array;
}

export type InspectorActivationFrame = MlpActivationFrame | NeatActivationFrame;

export type InspectorActivationFrameKind = InspectorActivationFrame['kind'];

export function activationFrameTopology(
  frame: InspectorActivationFrame,
): BrainTopology {
  if (frame.kind === 'mlp') return 'mlp';
  return frame.kind;
}
