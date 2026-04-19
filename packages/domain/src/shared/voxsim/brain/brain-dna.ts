/**
 * `BrainDna` is the persisted, browser-safe contract describing a brain's
 * topology, encoder, decoder, and seed. Weights and NEAT genomes are stored
 * separately (see `checkpoint-ref.ts`).
 */

import type { LineageRef } from '../morphology/lineage.js';
import type { InputEncoder } from './encoder.js';
import type { OutputDecoder } from './decoder.js';
import type { LayerSpec } from './layer-spec.js';
import type { NeatBrainConfig } from './neat/neat-brain-config.js';

export type BrainTopology =
  | 'mlp'
  | 'recurrentMlp'
  | 'neat'
  | 'hyperNeat'
  | 'neatLstm';

export const NEAT_TOPOLOGIES: ReadonlySet<BrainTopology> = new Set<BrainTopology>([
  'neat',
  'hyperNeat',
  'neatLstm',
]);

export function isNeatTopology(topology: BrainTopology): boolean {
  return NEAT_TOPOLOGIES.has(topology);
}

export interface BrainDnaMetadata {
  name: string;
  createdAt: string;
  updatedAt: string;
  author: string;
}

export interface BrainDna {
  id: string;
  version: number;
  topology: BrainTopology;
  /** Empty for NEAT variants. */
  layers: LayerSpec[];
  inputEncoder: InputEncoder;
  outputDecoder: OutputDecoder;
  /** Seed for weight init (fixed-topology) or population sampling (NEAT). */
  seed: number;
  /** Required when `topology` is one of the NEAT variants; forbidden otherwise. */
  neat?: NeatBrainConfig;
  lineage?: LineageRef;
  metadata: BrainDnaMetadata;
}
