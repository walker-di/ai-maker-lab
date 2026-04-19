import { describe, expect, it } from 'bun:test';

import { deriveSubstrateCells } from './cppn-substrate-view.js';
import type { CppnSubstrate } from '../brain/types.js';

const substrate: CppnSubstrate = {
  kind: 'grid2d',
  inputCoords: [
    { x: 0, y: 0, z: 0 },
    { x: 1, y: 0, z: 0 },
  ],
  hiddenLayers: [
    {
      layerLabel: 'h0',
      coords: [
        { x: 0, y: 1, z: 0 },
        { x: 1, y: 1, z: 0 },
      ],
    },
  ],
  outputCoords: [{ x: 0.5, y: 2, z: 0 }],
  weightThreshold: 0.1,
  bias: { constant: 0 },
};

describe('deriveSubstrateCells', () => {
  it('maps input/hidden/output indices to coordinates and binding ids', () => {
    const cells = deriveSubstrateCells({
      substrate,
      phenotype: [
        { sourceLayerIndex: 0, sourceUnitIndex: 0, targetLayerIndex: 1, targetUnitIndex: 0, weight: 0.7 },
        { sourceLayerIndex: 1, sourceUnitIndex: 1, targetLayerIndex: 2, targetUnitIndex: 0, weight: -0.05 },
      ],
      inputBindingIds: ['imu[0]', 'imu[1]'],
      outputBindingIds: ['motor'],
      hiddenBindingIds: [['h0_0', 'h0_1']],
    });
    expect(cells).toHaveLength(2);
    expect(cells[0]!.sourceBindingId).toBe('imu[0]');
    expect(cells[0]!.targetBindingId).toBe('h0_0');
    expect(cells[0]!.sourceCoord).toEqual({ x: 0, y: 0, z: 0 });
    expect(cells[0]!.targetCoord).toEqual({ x: 0, y: 1, z: 0 });
    expect(cells[0]!.pruned).toBe(false);
    expect(cells[1]!.sourceBindingId).toBe('h0_1');
    expect(cells[1]!.targetBindingId).toBe('motor');
    expect(cells[1]!.pruned).toBe(true);
  });

  it('falls back to fabricated binding ids when none provided', () => {
    const cells = deriveSubstrateCells({
      substrate,
      phenotype: [
        { sourceLayerIndex: 0, sourceUnitIndex: 1, targetLayerIndex: 2, targetUnitIndex: 0, weight: 0.5 },
      ],
      inputBindingIds: [],
      outputBindingIds: [],
    });
    expect(cells[0]!.sourceBindingId).toBe('input_1');
    expect(cells[0]!.targetBindingId).toBe('output_0');
  });

  it('returns an empty array when phenotype is empty', () => {
    expect(
      deriveSubstrateCells({
        substrate,
        phenotype: [],
        inputBindingIds: [],
        outputBindingIds: [],
      }),
    ).toEqual([]);
  });
});
