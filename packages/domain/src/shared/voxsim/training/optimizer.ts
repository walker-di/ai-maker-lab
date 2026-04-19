/**
 * Gradient-method optimizer specs. Used by `ReinforceTrainer` and
 * `PpoLiteTrainer` (both reserved for a follow-up cut).
 */

export type OptimizerSpec =
  | { kind: 'sgd'; lr: number; momentum?: number }
  | { kind: 'adam'; lr: number; beta1?: number; beta2?: number; epsilon?: number };

export type OptimizerKind = OptimizerSpec['kind'];
