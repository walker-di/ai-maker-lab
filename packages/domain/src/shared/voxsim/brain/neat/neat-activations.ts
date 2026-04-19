/**
 * NEAT-family activation kinds. The CPPN superset adds a few extras only
 * valid on HyperNEAT CPPN nodes.
 */

export type NeatActivationKind =
  | 'relu'
  | 'tanh'
  | 'sigmoid'
  | 'linear'
  | 'sin'
  | 'gaussian'
  | 'step';

export type CppnActivationKind =
  | NeatActivationKind
  | 'abs'
  | 'cos'
  | 'gauss2d';

export const CPPN_ONLY_ACTIVATIONS: ReadonlySet<CppnActivationKind> =
  new Set<CppnActivationKind>(['abs', 'cos', 'gauss2d']);
