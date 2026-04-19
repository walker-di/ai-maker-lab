/**
 * HyperNEAT substrate definition. The CPPN is queried over substrate
 * coordinate pairs to produce phenotype edge weights and node biases.
 */

import type { Vec3 } from '../../vec.js';

export type SubstrateKind = 'grid2d' | 'grid3d';

export interface CppnSubstrateLayer {
  /** Substrate positions for each phenotype neuron in this hidden layer. */
  coords: Vec3[];
  layerLabel: string;
}

export interface CppnSubstrate {
  kind: SubstrateKind;
  /** One per `InputEncoder` channel, in encoder order. */
  inputCoords: Vec3[];
  hiddenLayers: CppnSubstrateLayer[];
  /** One per `OutputDecoder` channel, in decoder order. */
  outputCoords: Vec3[];
  /** Connections whose CPPN-queried |weight| < threshold are pruned. */
  weightThreshold: number;
  /** How phenotype-node bias is derived from the CPPN output. */
  bias:
    | { fromCppnOutputIndex: number }
    | { constant: number };
}
