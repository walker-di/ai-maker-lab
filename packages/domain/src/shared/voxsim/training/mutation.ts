/**
 * Fixed-topology Gaussian mutation rates used by `EvolutionTrainer`.
 */

export interface MutationRates {
  /** Std of the Gaussian perturbation applied per mutated parameter. */
  weightMutationStd: number;
  /** Per-parameter probability of being mutated each generation. */
  weightMutationProb: number;
  /** Per-parameter probability of being copied from the second parent in two-parent crossover. */
  weightCrossoverProb: number;
  /**
   * Reserved. Body mutation lives in the application use cases (plan 07);
   * the rate stays here for record-keeping and for future inline body
   * mutation.
   */
  bodyMutationProb?: number;
}
