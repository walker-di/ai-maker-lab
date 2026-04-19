/**
 * Structural mutations the application layer (plan 07) can inject between
 * runs. The runtime trainer applies these alongside its stochastic
 * mutations.
 */

export type NeatStructuralMutationSpec =
  | { kind: 'addNode'; connectionInnovation: number }
  | { kind: 'addConnection'; sourceNodeId: number; targetNodeId: number }
  | { kind: 'toggleEnabled'; connectionInnovation: number }
  | { kind: 'addLstmNode' };
