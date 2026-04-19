/**
 * Pure derivation of `InspectorBrainGraph` from a `BrainDna` plus either a
 * `Float32Array` of weights (fixed-topology) or a `NeatGenome` (NEAT
 * variants). Two graphs computed for the same inputs are deep-equal so the
 * derivation is safe to memoize and to use in tests.
 */

import type {
  BrainDna,
  LayerSpec,
  NeatConnectionGene,
  NeatGenome,
} from '../brain/types.js';
import { buildWeightLayout } from '../brain/types.js';
import type {
  InspectorBrainEdge,
  InspectorBrainGraph,
  InspectorBrainNode,
  InspectorMutationDiff,
} from './types.js';

export interface DeriveOptions {
  /** When true, omit edges whose `|weight|` is below this threshold. */
  weightThreshold?: number;
  /**
   * Map from speciesId (NEAT only) to color, paired with `speciesId` to label
   * each node in the graph. The selected agent's `speciesId` should be set on
   * the graph nodes when known.
   */
  speciesPalette?: Record<number, string>;
  /** NEAT-only species id for every node in this graph. */
  speciesId?: number;
  /** NEAT-only mutation diff to overlay on edges/nodes. */
  diff?: InspectorMutationDiff;
  /** Precomputed live activations to attach to `currentValue`. */
  nodeActivations?: Map<number, number>;
  /** Precomputed live activations for fixed-topology layers. */
  mlpActivations?: { hidden: Float32Array[]; outputs: Float32Array };
}

function neatNodeDomId(nodeId: number, kind: 'phenotype' | 'cppn'): string {
  return kind === 'cppn' ? `cppn_node_${nodeId}` : `neat_node_${nodeId}`;
}

interface DenseLayerInfo {
  units: number;
  activation: import('../brain/types.js').ActivationKind;
}

function denseLayers(layers: readonly LayerSpec[]): DenseLayerInfo[] {
  const out: DenseLayerInfo[] = [];
  for (const l of layers) {
    if (l.kind === 'dense') {
      out.push({ units: l.units, activation: l.activation });
    }
  }
  return out;
}

function resolveBounds(weights: ArrayLike<number>): {
  minWeight: number;
  maxWeight: number;
} {
  let lo = Number.POSITIVE_INFINITY;
  let hi = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < weights.length; i++) {
    const w = (weights as Float32Array)[i] ?? 0;
    if (w < lo) lo = w;
    if (w > hi) hi = w;
  }
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) {
    return { minWeight: 0, maxWeight: 0 };
  }
  return { minWeight: lo, maxWeight: hi };
}

function deriveMlp(
  brainDna: BrainDna,
  weights: Float32Array,
  options: DeriveOptions,
): InspectorBrainGraph {
  const inputWidth = brainDna.inputEncoder.inputs.reduce(
    (sum, b) => sum + b.width,
    0,
  );
  const outputWidth = brainDna.outputDecoder.outputs.length;
  const denses = denseLayers(brainDna.layers);
  const layout = buildWeightLayout(brainDna.layers, inputWidth, outputWidth);

  const nodes: InspectorBrainNode[] = [];
  const edges: InspectorBrainEdge[] = [];

  let inputCursor = 0;
  for (const binding of brainDna.inputEncoder.inputs) {
    for (let c = 0; c < binding.width; c++) {
      nodes.push({
        id: `input_${inputCursor}`,
        kind: 'input',
        layerIndex: 0,
        unitIndex: inputCursor,
        label: `${binding.sensorId}[${c}]`,
        currentValue: undefined,
      });
      inputCursor++;
    }
  }

  for (let li = 0; li < denses.length; li++) {
    const layer = denses[li];
    if (!layer) continue;
    const liveValues = options.mlpActivations?.hidden[li];
    for (let u = 0; u < layer.units; u++) {
      nodes.push({
        id: `dense_${li}_unit_${u}`,
        kind: 'hidden',
        layerIndex: li + 1,
        unitIndex: u,
        activation: layer.activation,
        currentValue: liveValues ? liveValues[u] : undefined,
      });
    }
  }

  for (let o = 0; o < brainDna.outputDecoder.outputs.length; o++) {
    const out = brainDna.outputDecoder.outputs[o]!;
    nodes.push({
      id: `output_${o}`,
      kind: 'output',
      layerIndex: denses.length + 1,
      unitIndex: o,
      label: out.actuatorId,
      activation: out.activation,
      currentValue: options.mlpActivations?.outputs[o],
    });
  }

  let prevColumnIds: string[] = nodes
    .filter((n) => n.kind === 'input')
    .map((n) => n.id);
  let prevWidth = inputWidth;
  let denseIndex = 0;
  for (const layer of brainDna.layers) {
    if (layer.kind !== 'dense') continue;
    const kernelEntry = layout.entries.find(
      (e) => e.name === `dense_${denseIndex}/kernel`,
    );
    if (!kernelEntry) {
      denseIndex++;
      continue;
    }
    const denseColumnIds: string[] = [];
    for (let u = 0; u < layer.units; u++) {
      const targetId =
        denseIndex === denses.length - 1 && layer.units === outputWidth
          ? // we still create dense_{i}_unit_{u} nodes; output column is separate
            `dense_${denseIndex}_unit_${u}`
          : `dense_${denseIndex}_unit_${u}`;
      denseColumnIds.push(targetId);
    }
    for (let p = 0; p < prevWidth; p++) {
      for (let u = 0; u < layer.units; u++) {
        const w = weights[kernelEntry.offset + p * layer.units + u] ?? 0;
        if (
          options.weightThreshold !== undefined &&
          Math.abs(w) < options.weightThreshold
        ) {
          continue;
        }
        edges.push({
          id: `${prevColumnIds[p]}__${denseColumnIds[u]}`,
          sourceId: prevColumnIds[p]!,
          targetId: denseColumnIds[u]!,
          weight: w,
        });
      }
    }
    prevColumnIds = denseColumnIds;
    prevWidth = layer.units;
    denseIndex++;
  }

  for (let o = 0; o < outputWidth; o++) {
    const sourceId = prevColumnIds[o] ?? prevColumnIds[prevColumnIds.length - 1];
    if (!sourceId) continue;
    edges.push({
      id: `${sourceId}__output_${o}`,
      sourceId,
      targetId: `output_${o}`,
      weight: 1,
    });
  }

  if (options.diff?.kind === 'mlp') {
    const map = new Map<string, number>();
    for (const d of options.diff.edgeWeightDeltas) map.set(d.edgeId, d.delta);
    for (const e of edges) {
      const d = map.get(e.id);
      if (d !== undefined) e.weightDelta = d;
    }
  }

  return {
    nodes,
    edges,
    bounds: resolveBounds(weights),
    topology: brainDna.topology,
  };
}

function deriveNeat(
  brainDna: BrainDna,
  genome: NeatGenome,
  options: DeriveOptions,
): InspectorBrainGraph {
  const isCppnGraph = brainDna.topology === 'hyperNeat';
  const nodes: InspectorBrainNode[] = [];
  const inputs = brainDna.inputEncoder.inputs;
  const inputBindingCounts = new Map<string, number>();
  for (const b of inputs) inputBindingCounts.set(b.sensorId, b.width);

  for (const node of genome.nodes) {
    const id = neatNodeDomId(node.id, isCppnGraph ? 'cppn' : 'phenotype');
    const kind: InspectorBrainNode['kind'] =
      node.kind === 'lstm'
        ? 'lstm'
        : node.kind === 'bias'
          ? 'bias'
          : node.kind === 'input'
            ? 'input'
            : node.kind === 'output'
              ? 'output'
              : isCppnGraph
                ? 'cppn'
                : 'hidden';
    let label: string | undefined;
    if (node.kind === 'input' && node.inputBindingId) {
      label = node.inputBindingId;
    } else if (node.kind === 'output' && node.outputBindingId) {
      label = node.outputBindingId;
    } else {
      label = `#${node.id}`;
    }
    nodes.push({
      id,
      kind,
      layerIndex: 0,
      unitIndex: 0,
      label,
      activation: node.activation,
      bias: node.bias,
      speciesId: options.speciesId,
      currentValue: options.nodeActivations?.get(node.id),
    });
  }

  const edges: InspectorBrainEdge[] = [];
  const seen = new Set<string>();
  for (const c of genome.connections) {
    if (
      options.weightThreshold !== undefined &&
      Math.abs(c.weight) < options.weightThreshold
    ) {
      continue;
    }
    const sourceId = neatNodeDomId(c.sourceNodeId, isCppnGraph ? 'cppn' : 'phenotype');
    const targetId = neatNodeDomId(c.targetNodeId, isCppnGraph ? 'cppn' : 'phenotype');
    const id = `neat_conn_${c.innovation}`;
    if (seen.has(id)) continue;
    seen.add(id);
    edges.push({
      id,
      sourceId,
      targetId,
      weight: c.weight,
      enabled: c.enabled,
      lstmGate: c.lstmGate,
      innovation: c.innovation,
    });
  }

  if (options.diff?.kind === 'neat') {
    const addedEdgeIds = new Set(
      options.diff.addedEdges.map((e) => e.edgeId),
    );
    const toggledMap = new Map<string, boolean>();
    for (const t of options.diff.toggledEdges) {
      toggledMap.set(t.edgeId, t.nowEnabled);
    }
    const weightDeltaMap = new Map<string, number>();
    for (const w of options.diff.weightDeltas) {
      weightDeltaMap.set(w.edgeId, w.delta);
    }
    for (const e of edges) {
      if (addedEdgeIds.has(e.id)) e.isNew = true;
      if (toggledMap.has(e.id)) e.enabled = toggledMap.get(e.id);
      const d = weightDeltaMap.get(e.id);
      if (d !== undefined) e.weightDelta = d;
    }
  }

  let lo = Number.POSITIVE_INFINITY;
  let hi = Number.NEGATIVE_INFINITY;
  for (const c of genome.connections) {
    if (c.weight < lo) lo = c.weight;
    if (c.weight > hi) hi = c.weight;
  }
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) {
    lo = 0;
    hi = 0;
  }

  return {
    nodes,
    edges,
    bounds: { minWeight: lo, maxWeight: hi },
    topology: brainDna.topology,
    speciesPalette: options.speciesPalette,
  };
}

/** Derive an `InspectorBrainGraph` from a brain plus its weights or genome. */
export function deriveBrainGraph(
  brainDna: BrainDna,
  payload: { kind: 'flat'; weights: Float32Array } | { kind: 'neatGenome'; genome: NeatGenome },
  options: DeriveOptions = {},
): InspectorBrainGraph {
  if (payload.kind === 'flat') {
    return deriveMlp(brainDna, payload.weights, options);
  }
  return deriveNeat(brainDna, payload.genome, options);
}

export type { NeatConnectionGene };
