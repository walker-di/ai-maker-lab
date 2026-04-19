/**
 * Mutation diff overlay shapes shared between the inspector view models and
 * any callers (test fixtures, future persistence integration, etc.).
 */

import type { LstmGate, NeatNodeKind } from '../brain/index.js';

export interface MlpEdgeWeightDelta {
  edgeId: string;
  delta: number;
}

export interface NeatAddedNodeEntry {
  nodeId: number;
  kind: NeatNodeKind;
  bias: number;
}

export interface NeatAddedEdgeEntry {
  edgeId: string;
  sourceNodeId: number;
  targetNodeId: number;
  weight: number;
  innovation: number;
  lstmGate?: LstmGate;
}

export interface NeatToggledEdgeEntry {
  edgeId: string;
  nowEnabled: boolean;
}

export interface NeatWeightDeltaEntry {
  edgeId: string;
  delta: number;
}

export type InspectorMutationDiff =
  | { kind: 'mlp'; edgeWeightDeltas: MlpEdgeWeightDelta[] }
  | {
      kind: 'neat';
      addedNodes: NeatAddedNodeEntry[];
      addedEdges: NeatAddedEdgeEntry[];
      toggledEdges: NeatToggledEdgeEntry[];
      weightDeltas: NeatWeightDeltaEntry[];
    };
