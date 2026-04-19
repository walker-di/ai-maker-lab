/**
 * Deterministic weight layout for fixed-topology brains.
 *
 * The layout is a function of `LayerSpec[]`, the input width, and the output
 * width. Two brains with the same triple produce identical layouts byte for
 * byte; this is the contract that lets the trainer in plan 05 transfer
 * weights, mutate them, and crossover.
 */

import type { LayerSpec } from './layer-spec.js';

export interface WeightEntry {
  /** Deterministic name like `dense_0/kernel`, `dense_0/bias`. */
  name: string;
  /** Row-major shape. */
  shape: number[];
  offset: number;
  length: number;
}

export interface WeightLayout {
  entries: WeightEntry[];
}

export function layoutTotalLength(layout: WeightLayout): number {
  let n = 0;
  for (const e of layout.entries) n += e.length;
  return n;
}

/** Build a deterministic `WeightLayout` for a fixed-topology brain. */
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
  // Sanity check: the last dense layer's units should equal outputWidth.
  // Validation enforces this; we don't throw here, just expose layout.
  void outputWidth;
  return { entries };
}
