import { describe, expect, it } from 'bun:test';
import { ElevationMap, HeightField, TerrainContact } from './elevation.js';

describe('ElevationMap', () => {
  it('returns 0 for empty sample set (flat fallback)', () => {
    const map = new ElevationMap([]);
    expect(map.groundY(0)).toBe(0);
    expect(map.groundY(50)).toBe(0);
  });

  it('clamps to first sample when index is before first entry', () => {
    const map = new ElevationMap([{ segmentIndex: 10, y: 5 }]);
    expect(map.groundY(0)).toBe(5);
    expect(map.groundY(5)).toBe(5);
  });

  it('clamps to last sample when index is beyond last entry', () => {
    const map = new ElevationMap([{ segmentIndex: 10, y: 5 }]);
    expect(map.groundY(20)).toBe(5);
  });

  it('interpolates linearly between two samples', () => {
    const map = new ElevationMap([
      { segmentIndex: 0, y: 0 },
      { segmentIndex: 100, y: 10 },
    ]);
    expect(map.groundY(50)).toBeCloseTo(5, 5);
    expect(map.groundY(25)).toBeCloseTo(2.5, 5);
    expect(map.groundY(75)).toBeCloseTo(7.5, 5);
  });

  it('interpolates correctly with out-of-order input samples', () => {
    const map = new ElevationMap([
      { segmentIndex: 100, y: 10 },
      { segmentIndex: 0, y: 0 },
    ]);
    expect(map.groundY(50)).toBeCloseTo(5, 5);
  });

  it('handles multiple segments via binary search', () => {
    const map = new ElevationMap([
      { segmentIndex: 0, y: 0 },
      { segmentIndex: 50, y: 5 },
      { segmentIndex: 100, y: 0 },
    ]);
    // First half: 0 -> 5
    expect(map.groundY(25)).toBeCloseTo(2.5, 5);
    // Second half: 5 -> 0
    expect(map.groundY(75)).toBeCloseTo(2.5, 5);
  });
});

describe('HeightField', () => {
  function makeFlat3x3(height: number) {
    return new HeightField({
      originX: 0,
      originZ: 0,
      cellSizeX: 10,
      cellSizeZ: 10,
      cols: 3,
      rows: 3,
      heights: Array(9).fill(height),
    });
  }

  it('returns constant height for a uniform flat field', () => {
    const hf = makeFlat3x3(5);
    expect(hf.groundY(10, 10)).toBeCloseTo(5, 5);
    expect(hf.groundY(5, 5)).toBeCloseTo(5, 5);
  });

  it('returns fallbackY for queries outside the grid', () => {
    const hf = new HeightField({
      originX: 0,
      originZ: 0,
      cellSizeX: 10,
      cellSizeZ: 10,
      cols: 3,
      rows: 3,
      heights: Array(9).fill(5),
      fallbackY: -1,
    });
    expect(hf.groundY(-1, 0)).toBe(-1);
    expect(hf.groundY(0, 100)).toBe(-1);
  });

  it('bilinearly interpolates a sloped field', () => {
    // 3x2 grid: height increases linearly with x (column index).
    // col0=h0, col1=h5, col2=h10
    const hf = new HeightField({
      originX: 0,
      originZ: 0,
      cellSizeX: 5,
      cellSizeZ: 10,
      cols: 3,
      rows: 2,
      heights: [0, 5, 10, 0, 5, 10],
    });
    expect(hf.groundY(5, 5)).toBeCloseTo(5, 4);
    expect(hf.groundY(0, 5)).toBeCloseTo(0, 4);
    expect(hf.groundY(2.5, 5)).toBeCloseTo(2.5, 4);
  });

  it('normalAt returns a normal pointing away from the slope', () => {
    // 3x2 grid with height rising in the +x direction.
    const hf = new HeightField({
      originX: 0,
      originZ: 0,
      cellSizeX: 5,
      cellSizeZ: 10,
      cols: 3,
      rows: 2,
      heights: [0, 5, 10, 0, 5, 10],
    });
    const n = hf.normalAt(5, 5);
    // ny is positive (upward component)
    expect(n.ny).toBeGreaterThan(0);
    // nx is negative (slope rises in +x, normal tilts in -x)
    expect(n.nx).toBeLessThan(0);
  });
});

describe('TerrainContact', () => {
  it('isFlat is true when both inputs are null', () => {
    const tc = new TerrainContact(null, null);
    expect(tc.isFlat).toBe(true);
  });

  it('returns 0 for flat terrain at any position', () => {
    const tc = new TerrainContact(null, null);
    expect(tc.groundY(0, 0, 0)).toBe(0);
    expect(tc.groundY(100, 200, 50)).toBe(0);
  });

  it('delegates to ElevationMap when no HeightField', () => {
    const map = new ElevationMap([
      { segmentIndex: 0, y: 0 },
      { segmentIndex: 100, y: 20 },
    ]);
    const tc = new TerrainContact(null, map);
    expect(tc.isFlat).toBe(false);
    expect(tc.groundY(0, 0, 50)).toBeCloseTo(10, 4);
  });

  it('delegates to HeightField when present, ignoring ElevationMap', () => {
    const hf = new HeightField({
      originX: 0,
      originZ: 0,
      cellSizeX: 10,
      cellSizeZ: 10,
      cols: 2,
      rows: 2,
      heights: [3, 3, 3, 3],
    });
    const map = new ElevationMap([{ segmentIndex: 0, y: 99 }]);
    const tc = new TerrainContact(hf, map);
    // HeightField takes precedence
    expect(tc.groundY(5, 5, 0)).toBeCloseTo(3, 4);
  });
});
