/**
 * Sliding-window of activation frames with optional 2D PCA projection over
 * a snapshot of the last hidden layer (fixed-topology) or a configurable
 * subset of NEAT hidden node ids.
 *
 * Rendering happens in the panel component (Canvas); this view-model only
 * accumulates and projects, so it tests cleanly without the DOM.
 */

import type {
  InspectorActivationFrame,
  MlpActivationFrame,
  NeatActivationFrame,
} from './types.js';

export interface ActivityWindowEntry {
  stepIndex: number;
  inputs: Float32Array;
  outputsRaw: Float32Array;
  outputsDecoded: Float32Array;
  /** Per-row activation values sorted by display order. */
  rows: Float32Array;
  /** Display kind per row, used by the panel to color the left margin. */
  rowKinds: ('input' | 'hidden' | 'lstm' | 'output')[];
}

export interface NeuronActivityOptions {
  windowSize?: number;
  /** NEAT-only configurable subset of node ids to feed to the PCA. */
  pcaNodeIds?: number[];
}

const DEFAULT_WINDOW = 256;

export class NeuronActivityView {
  private readonly windowSize: number;
  private readonly pcaNodeIds: number[] | null;
  private readonly buffer: ActivityWindowEntry[] = [];
  private pcaBasis: { mean: Float32Array; v0: Float32Array; v1: Float32Array } | null = null;
  private pcaSourceFrames = 0;

  constructor(options: NeuronActivityOptions = {}) {
    this.windowSize = options.windowSize ?? DEFAULT_WINDOW;
    this.pcaNodeIds = options.pcaNodeIds ?? null;
  }

  ingest(frame: InspectorActivationFrame): void {
    const entry =
      frame.kind === 'mlp' ? this.fromMlp(frame) : this.fromNeat(frame);
    this.buffer.push(entry);
    while (this.buffer.length > this.windowSize) this.buffer.shift();
  }

  reset(): void {
    this.buffer.length = 0;
    this.pcaBasis = null;
    this.pcaSourceFrames = 0;
  }

  get window(): readonly ActivityWindowEntry[] {
    return this.buffer;
  }

  get size(): number {
    return this.buffer.length;
  }

  /**
   * Compute (and cache) a 2D PCA basis over the first `windowSize` frames of
   * either the last hidden layer (fixed-topology) or the provided NEAT node
   * subset (NEAT). Returns `null` if not enough samples have been ingested.
   */
  ensurePcaBasis(minSamples = 16): {
    mean: Float32Array;
    v0: Float32Array;
    v1: Float32Array;
  } | null {
    if (this.buffer.length < minSamples) return null;
    if (this.pcaBasis && this.pcaSourceFrames >= this.buffer.length) {
      return this.pcaBasis;
    }
    const matrix = this.buffer.map((e) => e.rows);
    const dim = matrix[0]?.length ?? 0;
    if (dim < 2) return null;
    const mean = new Float32Array(dim);
    for (const row of matrix) {
      for (let i = 0; i < dim; i++) mean[i]! += row[i] ?? 0;
    }
    for (let i = 0; i < dim; i++) mean[i]! /= matrix.length;

    // Power iteration for top-2 eigenvectors of the covariance matrix.
    // The covariance matrix is implicit; we operate as M^T M / N.
    const v0 = new Float32Array(dim);
    for (let i = 0; i < dim; i++) v0[i] = Math.sin(i + 1);
    normalize(v0);
    for (let iter = 0; iter < 32; iter++) {
      const next = applyCovariance(matrix, mean, v0);
      normalize(next);
      v0.set(next);
    }
    const v1 = new Float32Array(dim);
    for (let i = 0; i < dim; i++) v1[i] = Math.cos(i + 1);
    orthogonalize(v1, v0);
    normalize(v1);
    for (let iter = 0; iter < 32; iter++) {
      const next = applyCovariance(matrix, mean, v1);
      orthogonalize(next, v0);
      normalize(next);
      v1.set(next);
    }
    this.pcaBasis = { mean, v0, v1 };
    this.pcaSourceFrames = this.buffer.length;
    return this.pcaBasis;
  }

  /** Project the latest entry into the cached PCA basis. */
  projectLatest(): { x: number; y: number } | null {
    const basis = this.ensurePcaBasis();
    if (!basis) return null;
    const last = this.buffer[this.buffer.length - 1];
    if (!last) return null;
    return projectPoint(last.rows, basis);
  }

  private fromMlp(frame: MlpActivationFrame): ActivityWindowEntry {
    const totalRows =
      frame.inputs.length +
      frame.hidden.reduce((sum, h) => sum + h.length, 0) +
      frame.outputsRaw.length;
    const rows = new Float32Array(totalRows);
    const rowKinds: ActivityWindowEntry['rowKinds'] = new Array(totalRows);
    let cursor = 0;
    for (let i = 0; i < frame.inputs.length; i++) {
      rows[cursor] = frame.inputs[i] ?? 0;
      rowKinds[cursor] = 'input';
      cursor++;
    }
    for (const layer of frame.hidden) {
      for (let i = 0; i < layer.length; i++) {
        rows[cursor] = layer[i] ?? 0;
        rowKinds[cursor] = 'hidden';
        cursor++;
      }
    }
    for (let i = 0; i < frame.outputsRaw.length; i++) {
      rows[cursor] = frame.outputsRaw[i] ?? 0;
      rowKinds[cursor] = 'output';
      cursor++;
    }
    return {
      stepIndex: frame.stepIndex,
      inputs: frame.inputs,
      outputsRaw: frame.outputsRaw,
      outputsDecoded: frame.outputsDecoded,
      rows,
      rowKinds,
    };
  }

  private fromNeat(frame: NeatActivationFrame): ActivityWindowEntry {
    const sortedIds = Array.from(frame.nodeActivations.keys()).sort(
      (a, b) => a - b,
    );
    const rows = new Float32Array(sortedIds.length);
    const rowKinds: ActivityWindowEntry['rowKinds'] = new Array(
      sortedIds.length,
    );
    for (let i = 0; i < sortedIds.length; i++) {
      const id = sortedIds[i]!;
      rows[i] = frame.nodeActivations.get(id) ?? 0;
      rowKinds[i] = frame.lstmGates?.has(id) ? 'lstm' : 'hidden';
    }
    return {
      stepIndex: frame.stepIndex,
      inputs: frame.inputs,
      outputsRaw: frame.outputsRaw,
      outputsDecoded: frame.outputsDecoded,
      rows,
      rowKinds,
    };
  }
}

function applyCovariance(
  matrix: readonly Float32Array[],
  mean: Float32Array,
  v: Float32Array,
): Float32Array {
  const dim = v.length;
  const result = new Float32Array(dim);
  for (const row of matrix) {
    let dot = 0;
    for (let i = 0; i < dim; i++) dot += (row[i]! - mean[i]!) * v[i]!;
    for (let i = 0; i < dim; i++) {
      result[i]! += (row[i]! - mean[i]!) * dot;
    }
  }
  for (let i = 0; i < dim; i++) result[i]! /= Math.max(1, matrix.length);
  return result;
}

function normalize(v: Float32Array): void {
  let n = 0;
  for (let i = 0; i < v.length; i++) n += v[i]! * v[i]!;
  n = Math.sqrt(n);
  if (n < 1e-12) return;
  for (let i = 0; i < v.length; i++) v[i]! /= n;
}

function orthogonalize(v: Float32Array, against: Float32Array): void {
  let dot = 0;
  for (let i = 0; i < v.length; i++) dot += v[i]! * against[i]!;
  for (let i = 0; i < v.length; i++) v[i]! -= dot * against[i]!;
}

function projectPoint(
  row: Float32Array,
  basis: { mean: Float32Array; v0: Float32Array; v1: Float32Array },
): { x: number; y: number } {
  let x = 0;
  let y = 0;
  for (let i = 0; i < row.length; i++) {
    const centered = row[i]! - basis.mean[i]!;
    x += centered * basis.v0[i]!;
    y += centered * basis.v1[i]!;
  }
  return { x, y };
}
