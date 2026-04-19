/**
 * `PolicyNetwork` is the single inference contract for every brain
 * implementation: TFJS MLPs (browser and node), and the three NEAT variants
 * (browser and node). All buffers are caller-owned and the inference path
 * (`act` / `actBatch`) must not allocate.
 */

import type { BrainDna, NeatGenome } from './types.js';

export interface MlpActivationFrame {
  kind: 'mlp';
  layerActivations: Float32Array[];
}

export interface NeatActivationFrame {
  kind: 'neat';
  /** Per-node activation keyed by node id. */
  nodeActivations: Map<number, number>;
  /** Per LSTM node: the four gate activations after their final activation function. */
  lstmGateActivations?: Map<number, { input: number; forget: number; output: number; candidate: number }>;
  /** Per LSTM node: cell state and hidden state. */
  lstmCellSnapshot?: Map<number, { cell: number; hidden: number }>;
}

export type ActivationFrame = MlpActivationFrame | NeatActivationFrame;

export interface PolicyTapHandle {
  dispose(): void;
}

export interface PolicyNetwork {
  init(dna: BrainDna): Promise<void>;
  /** Fixed-topology only. Throws on NEAT brains. */
  setWeights(weights: Float32Array): void;
  /** Fixed-topology only. Throws on NEAT brains. */
  getWeights(): Float32Array;
  /** NEAT-variant only. Throws on fixed-topology brains. */
  setGenome(genome: NeatGenome): void;
  /** NEAT-variant only. Throws on fixed-topology brains. */
  getGenome(): NeatGenome;
  /** Single-agent inference. Writes into `scratchAction` in place. */
  act(observation: Float32Array, scratchAction: Float32Array): void;
  /** Batched inference. Caller-owned interleaved buffers. */
  actBatch(
    observations: Float32Array,
    batchSize: number,
    scratchActions: Float32Array,
  ): void;
  resetEpisodeState(): void;
  tap(cb: (frame: ActivationFrame) => void): PolicyTapHandle;
  dispose(): void;
}

export const NEAT_ONLY_METHODS_ERROR = 'setGenome/getGenome are only valid for NEAT-variant brains';
export const FIXED_ONLY_METHODS_ERROR = 'setWeights/getWeights are only valid for fixed-topology brains';
