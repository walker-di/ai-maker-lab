/**
 * Local UI mirror of the inspector shared types from
 * `packages/domain/src/shared/voxsim/inspector/`.
 *
 * `packages/ui` cannot depend on `packages/domain`. Domain types satisfy these
 * shapes structurally when passed in from the app layer. Keep both files in
 * sync when fields change.
 */

import type {
  ActivationKind,
  BrainTopology,
  CppnActivationKind,
  LstmGate,
  NeatActivationKind,
  NeatNodeKind,
} from '../brain/types.js';

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
  layerIndex: number;
  unitIndex: number;
  label?: string;
  activation?: ActivationKind | NeatActivationKind | CppnActivationKind;
  currentValue?: number;
  speciesId?: number;
  bias?: number;
}

export interface InspectorBrainEdge {
  id: string;
  sourceId: string;
  targetId: string;
  weight: number;
  weightDelta?: number;
  enabled?: boolean;
  lstmGate?: LstmGate;
  innovation?: number;
  isNew?: boolean;
}

export interface InspectorBrainGraph {
  nodes: InspectorBrainNode[];
  edges: InspectorBrainEdge[];
  bounds: { minWeight: number; maxWeight: number };
  topology: BrainTopology;
  speciesPalette?: Record<number, string>;
}

export interface InspectorChartPoint {
  x: number;
  y: number;
}

export interface InspectorChartSeries {
  id: string;
  label: string;
  unit?: string;
  points: InspectorChartPoint[];
}

export interface MlpActivationFrame {
  kind: 'mlp';
  stepIndex: number;
  inputs: Float32Array;
  hidden: Float32Array[];
  outputsRaw: Float32Array;
  outputsDecoded: Float32Array;
}

export interface NeatLstmGateSnapshot {
  input: number;
  forget: number;
  output: number;
  candidate: number;
  cellState: number;
  hiddenState: number;
}

export interface NeatActivationFrame {
  kind: 'neat' | 'hyperNeat' | 'neatLstm';
  stepIndex: number;
  inputs: Float32Array;
  nodeActivations: Map<number, number>;
  cppnNodeActivations?: Map<number, number>;
  lstmGates?: Map<number, NeatLstmGateSnapshot>;
  outputsRaw: Float32Array;
  outputsDecoded: Float32Array;
}

export type InspectorActivationFrame = MlpActivationFrame | NeatActivationFrame;

export interface InspectorReplayCursor {
  replayRefId: string;
  frameIndex: number;
  frameCount: number;
  playing: boolean;
  playbackRate: number;
  policyKind: BrainTopology;
}

export interface InspectorSpeciesEntry {
  id: number;
  size: number;
  bestScore: number;
  meanScore: number;
  stagnation: number;
  representativeGenomeId: string;
  color: string;
}

export interface InspectorSpeciesSnapshot {
  runId: string;
  generation: number;
  species: InspectorSpeciesEntry[];
}

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

export function clampFrameIndex(desired: number, frameCount: number): number {
  if (frameCount <= 0) return 0;
  if (desired < 0) return 0;
  if (desired >= frameCount) return frameCount - 1;
  return Math.floor(desired);
}
