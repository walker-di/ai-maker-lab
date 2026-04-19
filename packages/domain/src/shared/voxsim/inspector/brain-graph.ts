/**
 * Topology graph the inspector renders. Computed from `BrainDna` plus either
 * a flat `Float32Array` (fixed-topology) or a `NeatGenome` (NEAT variants).
 *
 * `BrainTopologyView` consumes this shape and hands it to Cytoscape.
 */

import type {
  ActivationKind,
  BrainTopology,
  CppnActivationKind,
  LstmGate,
  NeatActivationKind,
} from '../brain/index.js';

export type InspectorNodeKind =
  | 'input'
  | 'hidden'
  | 'output'
  | 'bias'
  | 'lstm'
  | 'cppn';

export interface InspectorBrainNode {
  id: string;
  kind: InspectorNodeKind;
  /** Fixed-topology only. `0` for input column, `layers.length + 1` for outputs. */
  layerIndex: number;
  /** Fixed-topology unit index. `0` for NEAT graphs. */
  unitIndex: number;
  /** Sensor channel id for inputs, actuator id for outputs, short id for NEAT. */
  label?: string;
  activation?: ActivationKind | NeatActivationKind | CppnActivationKind;
  /** Live activation value, populated by the policy tap when available. */
  currentValue?: number;
  /** NEAT-only species coloring key. */
  speciesId?: number;
  /** NEAT-only per-node bias from `NeatNodeGene.bias`. */
  bias?: number;
}

export interface InspectorBrainEdge {
  id: string;
  sourceId: string;
  targetId: string;
  weight: number;
  /** Set by the diff overlay when comparing two checkpoints. */
  weightDelta?: number;
  /** NEAT-only enabled flag. Defaults to true for fixed-topology edges. */
  enabled?: boolean;
  /** NEAT-LSTM-only gate label. */
  lstmGate?: LstmGate;
  /** NEAT-only innovation number (for tooltips and diff overlay). */
  innovation?: number;
  /** Set by the diff overlay when the edge is newly added in this generation. */
  isNew?: boolean;
}

export interface InspectorBrainGraph {
  nodes: InspectorBrainNode[];
  edges: InspectorBrainEdge[];
  bounds: { minWeight: number; maxWeight: number };
  topology: BrainTopology;
  /**
   * NEAT-only deterministic palette mapping `speciesId` to a stable CSS color.
   * Hashes `(runId, speciesId)` so colors are stable across re-renders.
   */
  speciesPalette?: Record<number, string>;
}
