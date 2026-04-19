/**
 * Mutation rates for NEAT-family algorithms.
 */

export interface NeatMutationRates {
  weightPerturbProb: number;
  weightPerturbStd: number;
  weightReplaceProb: number;
  addConnectionProb: number;
  addNodeProb: number;
  toggleEnabledProb: number;
  /** Only valid for `neatLstm`. */
  addLstmNodeProb?: number;
  /** Symmetric uniform range used when sampling new weights. */
  initialWeightRange: number;
}
