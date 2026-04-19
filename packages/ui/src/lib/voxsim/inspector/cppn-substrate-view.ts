/**
 * Derives a 2D scatter for the HyperNEAT CPPN substrate. Inputs:
 *  - `CppnSubstrate` from `BrainDna.neat.cppnSubstrate`
 *  - the materialized phenotype connection list (sourced from the worker
 *    via the replay header for replays, or from `HyperNeatPolicyNetwork.dumpPhenotype()`
 *    for live mode).
 *
 * Renders are deterministic for the same inputs.
 */

import type { CppnSubstrate } from '../brain/types.js';
import type { Vec3 } from '../types.js';

export interface PhenotypeConnection {
  sourceLayerIndex: number;
  sourceUnitIndex: number;
  targetLayerIndex: number;
  targetUnitIndex: number;
  weight: number;
}

export interface SubstrateCell {
  sourceBindingId: string;
  targetBindingId: string;
  sourceCoord: Vec3;
  targetCoord: Vec3;
  weight: number;
  /** True when the cell is below the substrate's `weightThreshold`. */
  pruned: boolean;
}

export interface DeriveSubstrateInput {
  substrate: CppnSubstrate;
  phenotype: PhenotypeConnection[];
  inputBindingIds: readonly string[];
  outputBindingIds: readonly string[];
  hiddenBindingIds?: readonly (readonly string[])[];
}

function bindingFor(
  layerIndex: number,
  unitIndex: number,
  ids: {
    inputs: readonly string[];
    outputs: readonly string[];
    hidden: readonly (readonly string[])[];
    hiddenLayerCount: number;
  },
): string {
  if (layerIndex === 0) return ids.inputs[unitIndex] ?? `input_${unitIndex}`;
  if (layerIndex === ids.hiddenLayerCount + 1) {
    return ids.outputs[unitIndex] ?? `output_${unitIndex}`;
  }
  const layer = ids.hidden[layerIndex - 1] ?? [];
  return layer[unitIndex] ?? `hidden_${layerIndex - 1}_${unitIndex}`;
}

function coordsFor(
  layerIndex: number,
  unitIndex: number,
  substrate: CppnSubstrate,
): Vec3 {
  const hiddenCount = substrate.hiddenLayers.length;
  if (layerIndex === 0) {
    return substrate.inputCoords[unitIndex] ?? { x: 0, y: 0, z: 0 };
  }
  if (layerIndex === hiddenCount + 1) {
    return substrate.outputCoords[unitIndex] ?? { x: 0, y: 0, z: 0 };
  }
  const layer = substrate.hiddenLayers[layerIndex - 1];
  return layer?.coords[unitIndex] ?? { x: 0, y: 0, z: 0 };
}

export function deriveSubstrateCells(
  input: DeriveSubstrateInput,
): SubstrateCell[] {
  const ids = {
    inputs: input.inputBindingIds,
    outputs: input.outputBindingIds,
    hidden: input.hiddenBindingIds ?? input.substrate.hiddenLayers.map(() => []),
    hiddenLayerCount: input.substrate.hiddenLayers.length,
  };
  const cells: SubstrateCell[] = new Array(input.phenotype.length);
  for (let i = 0; i < input.phenotype.length; i++) {
    const c = input.phenotype[i]!;
    cells[i] = {
      sourceBindingId: bindingFor(c.sourceLayerIndex, c.sourceUnitIndex, ids),
      targetBindingId: bindingFor(c.targetLayerIndex, c.targetUnitIndex, ids),
      sourceCoord: coordsFor(c.sourceLayerIndex, c.sourceUnitIndex, input.substrate),
      targetCoord: coordsFor(c.targetLayerIndex, c.targetUnitIndex, input.substrate),
      weight: c.weight,
      pruned: Math.abs(c.weight) < input.substrate.weightThreshold,
    };
  }
  return cells;
}
