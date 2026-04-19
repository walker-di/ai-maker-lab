/**
 * Brain layer + activation primitives. Browser-safe data only.
 */

export type ActivationKind =
  | 'relu'
  | 'leakyRelu'
  | 'tanh'
  | 'sigmoid'
  | 'linear'
  | 'softplus';

export type LayerSpec =
  | { kind: 'dense'; units: number; activation: ActivationKind; useBias: boolean }
  | { kind: 'layerNorm'; epsilon: number }
  | { kind: 'dropout'; rate: number }
  | { kind: 'gru'; units: number };

export type LayerKind = LayerSpec['kind'];
