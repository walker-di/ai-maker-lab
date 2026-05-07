/**
 * M4 surface-lookup terrain/kerb integration tests.
 * Surface-id tests live in the existing ribbon-geometry.test.ts;
 * these tests focus purely on the M4 groundYAt and kerbBumpImpulseAt additions.
 */
import { describe, expect, it } from 'bun:test';
import { SurfaceLookup, type SurfaceLookupConfig } from './surface-lookup.js';
import { TerrainContact, ElevationMap, HeightField } from './elevation.js';
import type { KerbProfile } from './kerb-geometry.js';

function makeLine(): SurfaceLookupConfig {
  // Straight line along X: 0,0 -> 100,0 -> 100,1 -> 0,1 (degenerate loop)
  return {
    points: [
      { x: 0, z: 0 },
      { x: 50, z: 0 },
      { x: 100, z: 0 },
    ],
    halfWidth: 7,
    curbWidth: 0.5,
    rubberWidth: 2,
    marblesWidth: 1,
    defaultOffTrack: 'GRASS',
    zones: [],
  };
}

describe('SurfaceLookup.groundYAt — flat fallback', () => {
  it('returns 0 when no terrain and no kerb profile are configured', () => {
    const lookup = new SurfaceLookup(makeLine());
    expect(lookup.groundYAt(25, 0)).toBe(0);
    expect(lookup.groundYAt(0, 0)).toBe(0);
  });

  it('returns 0 when terrain isFlat', () => {
    const cfg = { ...makeLine(), terrain: new TerrainContact(null, null) };
    const lookup = new SurfaceLookup(cfg);
    expect(lookup.groundYAt(25, 0)).toBe(0);
  });
});

describe('SurfaceLookup.groundYAt — with ElevationMap', () => {
  it('returns interpolated height from the elevation map', () => {
    const map = new ElevationMap([
      { segmentIndex: 0, y: 0 },
      { segmentIndex: 2, y: 10 },
    ]);
    const terrain = new TerrainContact(null, map);
    const lookup = new SurfaceLookup({ ...makeLine(), terrain });
    // At the midpoint of the line (~segment index 1) the height should be ~5
    const y = lookup.groundYAt(50, 0);
    expect(y).toBeGreaterThan(0);
    expect(y).toBeLessThan(11);
  });
});

describe('SurfaceLookup.groundYAt — with HeightField', () => {
  it('returns terrain height from the height field', () => {
    const hf = new HeightField({
      originX: -50,
      originZ: -50,
      cellSizeX: 200,
      cellSizeZ: 200,
      cols: 2,
      rows: 2,
      heights: [4, 4, 4, 4],
    });
    const terrain = new TerrainContact(hf, null);
    const lookup = new SurfaceLookup({ ...makeLine(), terrain });
    expect(lookup.groundYAt(25, 0)).toBeCloseTo(4, 4);
    expect(lookup.groundYAt(75, 0)).toBeCloseTo(4, 4);
  });
});

describe('SurfaceLookup.groundYAt — kerb height overlay', () => {
  const kerbProfile: KerbProfile = {
    widthM: 0.5,
    crownHeightM: 0.04,
    topFlatFraction: 0.0,
    bumpForceN: 800,
  };

  it('returns > 0 for a point at the mid-point of the kerb strip', () => {
    const lookup = new SurfaceLookup({ ...makeLine(), kerbProfile });
    // halfWidth = 7, kerbWidth = 0.5. Point at lateral 7.25 is mid-kerb.
    const y = lookup.groundYAt(50, 7.25);
    expect(y).toBeGreaterThan(0);
    expect(y).toBeLessThanOrEqual(kerbProfile.crownHeightM);
  });

  it('returns 0 for a point on clean asphalt with only kerb configured', () => {
    const lookup = new SurfaceLookup({ ...makeLine(), kerbProfile });
    expect(lookup.groundYAt(50, 0)).toBe(0);
  });

  it('stacks kerb height on top of terrain height', () => {
    const hf = new HeightField({
      originX: -50,
      originZ: -50,
      cellSizeX: 200,
      cellSizeZ: 200,
      cols: 2,
      rows: 2,
      heights: [2, 2, 2, 2],
    });
    const terrain = new TerrainContact(hf, null);
    const lookup = new SurfaceLookup({ ...makeLine(), terrain, kerbProfile });
    // On asphalt: terrain height only
    expect(lookup.groundYAt(50, 0)).toBeCloseTo(2, 4);
    // Mid-kerb: terrain + kerb ramp
    const y = lookup.groundYAt(50, 7.25);
    expect(y).toBeGreaterThan(2);
  });
});

describe('SurfaceLookup.kerbBumpImpulseAt', () => {
  const kerbProfile: KerbProfile = {
    widthM: 0.5,
    crownHeightM: 0.04,
    topFlatFraction: 0.0,
    bumpForceN: 800,
  };

  it('returns 0 when no kerb profile is configured', () => {
    const lookup = new SurfaceLookup(makeLine());
    expect(lookup.kerbBumpImpulseAt(50, 7.25)).toBe(0);
  });

  it('returns 0 for a point on asphalt', () => {
    const lookup = new SurfaceLookup({ ...makeLine(), kerbProfile });
    expect(lookup.kerbBumpImpulseAt(50, 0)).toBe(0);
  });

  it('returns > 0 for a point in the kerb strip', () => {
    const lookup = new SurfaceLookup({ ...makeLine(), kerbProfile });
    const impulse = lookup.kerbBumpImpulseAt(50, 7.25);
    expect(impulse).toBeGreaterThan(0);
    expect(impulse).toBeLessThanOrEqual(kerbProfile.bumpForceN);
  });
});
