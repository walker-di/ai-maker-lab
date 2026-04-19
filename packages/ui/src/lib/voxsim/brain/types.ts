/**
 * Local UI mirror of the brain shared types from
 * `packages/domain/src/shared/voxsim/brain/`.
 *
 * `packages/ui` cannot depend on `packages/domain`. Domain types satisfy these
 * shapes structurally when passed in from the app layer. Keep both files in
 * sync when fields change.
 */

import type { Vec3 } from '../types.js';

interface LineageRef {
  parentBodyDnaId?: string;
  mutationSummary?: string;
  generation?: number;
}

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

export type Normalization =
  | { mean: number; std: number }
  | { mean: number[]; std: number[] };

export interface InputBinding {
  sensorId: string;
  width: number;
  normalization: Normalization;
  clip?: { min: number; max: number };
}

export interface InputEncoder {
  inputs: InputBinding[];
}

export type OutputActivation = 'tanh' | 'sigmoid' | 'linear';

export interface OutputBinding {
  actuatorId: string;
  range: { min: number; max: number };
  activation: OutputActivation;
}

export interface OutputDecoder {
  outputs: OutputBinding[];
}

export interface WeightEntry {
  name: string;
  shape: number[];
  offset: number;
  length: number;
}

export interface WeightLayout {
  entries: WeightEntry[];
}

export interface WeightCheckpointRef {
  id: string;
  brainDnaId: string;
  bytes: number;
  score?: number;
  generation?: number;
  createdAt: string;
}

export type CheckpointRef =
  | { kind: 'flat'; ref: WeightCheckpointRef }
  | {
      kind: 'neatGenome';
      genomeId: string;
      brainDnaId: string;
      generation: number;
      bytes: number;
      score?: number;
      createdAt: string;
    };

export type BrainTopology =
  | 'mlp'
  | 'recurrentMlp'
  | 'neat'
  | 'hyperNeat'
  | 'neatLstm';

export interface BrainDnaMetadata {
  name: string;
  createdAt: string;
  updatedAt: string;
  author: string;
}

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

export type NeatNodeKind = 'input' | 'bias' | 'output' | 'hidden' | 'lstm';
export type LstmGate = 'input' | 'output' | 'forget' | 'candidate';

export interface NeatNodeGene {
  id: number;
  kind: NeatNodeKind;
  activation: NeatActivationKind | CppnActivationKind;
  bias: number;
  inputBindingId?: string;
  outputBindingId?: string;
}

export interface NeatConnectionGene {
  innovation: number;
  sourceNodeId: number;
  targetNodeId: number;
  weight: number;
  enabled: boolean;
  lstmGate?: LstmGate;
}

export interface NeatGenome {
  id: string;
  nodes: NeatNodeGene[];
  connections: NeatConnectionGene[];
  nextLocalNodeId: number;
}

export interface CppnSubstrateLayer {
  coords: Vec3[];
  layerLabel: string;
}

export interface CppnSubstrate {
  kind: 'grid2d' | 'grid3d';
  inputCoords: Vec3[];
  hiddenLayers: CppnSubstrateLayer[];
  outputCoords: Vec3[];
  weightThreshold: number;
  bias:
    | { fromCppnOutputIndex: number }
    | { constant: number };
}

export interface NeatBrainConfig {
  seed: number;
  initialNodeBias: number;
  allowRecurrent: boolean;
  cppnSubstrate?: CppnSubstrate;
  relaxationIterations?: number;
}

export interface BrainDna {
  id: string;
  version: number;
  topology: BrainTopology;
  layers: LayerSpec[];
  inputEncoder: InputEncoder;
  outputDecoder: OutputDecoder;
  seed: number;
  neat?: NeatBrainConfig;
  lineage?: LineageRef;
  metadata: BrainDnaMetadata;
}

export interface LstmCellState {
  cellState: Float32Array;
  hiddenState: Float32Array;
}

export const NEAT_TOPOLOGIES: ReadonlySet<BrainTopology> = new Set<BrainTopology>([
  'neat',
  'hyperNeat',
  'neatLstm',
]);

export function isNeatTopology(topology: BrainTopology): boolean {
  return NEAT_TOPOLOGIES.has(topology);
}

export function encoderTotalWidth(encoder: InputEncoder): number {
  let n = 0;
  for (const b of encoder.inputs) n += b.width;
  return n;
}

export function decoderTotalWidth(decoder: OutputDecoder): number {
  return decoder.outputs.length;
}

export function layoutTotalLength(layout: WeightLayout): number {
  let n = 0;
  for (const e of layout.entries) n += e.length;
  return n;
}

export function buildWeightLayout(
  layers: readonly LayerSpec[],
  inputWidth: number,
  outputWidth: number,
): WeightLayout {
  const entries: WeightEntry[] = [];
  let offset = 0;
  let prevWidth = inputWidth;
  let denseIndex = 0;
  for (const layer of layers) {
    if (layer.kind !== 'dense') continue;
    const kernelLen = prevWidth * layer.units;
    entries.push({
      name: `dense_${denseIndex}/kernel`,
      shape: [prevWidth, layer.units],
      offset,
      length: kernelLen,
    });
    offset += kernelLen;
    if (layer.useBias) {
      entries.push({
        name: `dense_${denseIndex}/bias`,
        shape: [layer.units],
        offset,
        length: layer.units,
      });
      offset += layer.units;
    }
    prevWidth = layer.units;
    denseIndex++;
  }
  void outputWidth;
  return { entries };
}

export function countLstmNodes(genome: NeatGenome): number {
  let n = 0;
  for (const node of genome.nodes) {
    if (node.kind === 'lstm') n++;
  }
  return n;
}

export function createLstmCellState(lstmNodeCount: number): LstmCellState {
  return {
    cellState: new Float32Array(lstmNodeCount),
    hiddenState: new Float32Array(lstmNodeCount),
  };
}

export function resetLstmCellState(state: LstmCellState): void {
  state.cellState.fill(0);
  state.hiddenState.fill(0);
}
