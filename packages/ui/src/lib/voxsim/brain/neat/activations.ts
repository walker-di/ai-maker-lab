/**
 * Pure activation functions for the NEAT-family runtime.
 */

import type { CppnActivationKind, NeatActivationKind } from '../types.js';

export function applyNeatActivation(
  kind: NeatActivationKind | CppnActivationKind,
  x: number,
): number {
  switch (kind) {
    case 'relu':
      return x > 0 ? x : 0;
    case 'tanh':
      return Math.tanh(x);
    case 'sigmoid':
      return 1 / (1 + Math.exp(-x));
    case 'linear':
      return x;
    case 'sin':
      return Math.sin(x);
    case 'gaussian':
      return Math.exp(-x * x);
    case 'step':
      return x >= 0 ? 1 : 0;
    case 'abs':
      return Math.abs(x);
    case 'cos':
      return Math.cos(x);
    case 'gauss2d':
      // Single-arg approximation; HyperNEAT historically uses radial bumps.
      return Math.exp(-(x * x) * 0.5);
    default:
      return x;
  }
}
