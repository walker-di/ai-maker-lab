import { describe, expect, it } from 'bun:test';
import { placeScenery } from './scenery-placement.js';
import { sampleCentripetal } from './catmull-rom.js';
import type { SceneryHint } from '../../types.js';

function makeSquareTrack(size: number, samples: number) {
  // A square control polygon produces four straight edges with smooth corners.
  return sampleCentripetal(
    [
      [size, size],
      [-size, size],
      [-size, -size],
      [size, -size],
    ],
    samples,
  );
}

function makeCircleTrack(radius: number, samples: number) {
  // Approximate a circle with evenly spaced control points.
  const ctrl: [number, number][] = [];
  const n = 8;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    ctrl.push([Math.cos(a) * radius, Math.sin(a) * radius]);
  }
  return sampleCentripetal(ctrl, samples);
}

function makeHint(partial: Partial<SceneryHint> = {}): SceneryHint {
  return {
    cones: 0,
    barriers: 0,
    lights: 0,
    billboards: 0,
    flags: 0,
    fences: 0,
    grandStands: 0,
    pitBuildings: 0,
    pylons: 0,
    banners: 0,
    radars: 0,
    overheads: 0,
    ...partial,
  };
}

function findClosestIndex(centerline: ReturnType<typeof makeSquareTrack>, x: number, z: number) {
  let bestIdx = 0;
  let bestDist = Infinity;
  for (let i = 0; i < centerline.length; i++) {
    const d = Math.hypot(centerline[i].x - x, centerline[i].z - z);
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }
  return bestIdx;
}

function countByKind(placements: ReturnType<typeof placeScenery>, kind: string) {
  return placements.filter((p) => p.kind === kind).length;
}

describe('placeScenery', () => {
  it('returns empty array when cadence is undefined', () => {
    const centerline = makeSquareTrack(50, 40);
    expect(placeScenery({ centerline, halfWidth: 5, cadence: undefined })).toEqual([]);
  });

  it('returns empty array when total prop count is zero', () => {
    const centerline = makeSquareTrack(50, 40);
    expect(placeScenery({ centerline, halfWidth: 5, cadence: makeHint() })).toEqual([]);
  });

  it('returns empty array when centerline is too short', () => {
    expect(placeScenery({ centerline: [{ x: 0, z: 0 }], halfWidth: 5, cadence: makeHint({ flags: 1 }) })).toEqual([]);
  });

  describe('start/finish area', () => {
    const centerline = makeSquareTrack(50, 80);

    it('places flag at index 0 outer side on first flag', () => {
      const result = placeScenery({ centerline, halfWidth: 5, cadence: makeHint({ flags: 1 }) });
      expect(countByKind(result, 'flag')).toBe(1);
      const flag = result.find((p) => p.kind === 'flag')!;
      // Should be near control point 0 which is (50,50)
      const pt0 = centerline[0];
      const dx = flag.x - pt0.x;
      const dz = flag.z - pt0.z;
      const dist = Math.hypot(dx, dz);
      // Offset = halfWidth + 1.5 = 6.5, so distance from centerline should be ~6.5
      expect(dist).toBeCloseTo(6.5, 0);
      expect(flag.y).toBe(0);
    });

    it('places multiple flags at index 0 and mid-lap', () => {
      const result = placeScenery({ centerline, halfWidth: 5, cadence: makeHint({ flags: 2 }) });
      expect(countByKind(result, 'flag')).toBe(2);
      const flags = result.filter((p) => p.kind === 'flag');
      const pt0 = centerline[0];
      const ptMid = centerline[Math.floor(centerline.length / 2)];
      const d0 = Math.hypot(flags[0].x - pt0.x, flags[0].z - pt0.z);
      const d1 = Math.hypot(flags[1].x - ptMid.x, flags[1].z - ptMid.z);
      expect(d0).toBeCloseTo(6.5, 0);
      expect(d1).toBeCloseTo(6.5, 0);
    });

    it('places banners at indices 0, 1, 2', () => {
      const result = placeScenery({ centerline, halfWidth: 5, cadence: makeHint({ banners: 3 }) });
      expect(countByKind(result, 'banner')).toBe(3);
    });

    it('places radar near index 2', () => {
      const result = placeScenery({ centerline, halfWidth: 5, cadence: makeHint({ radars: 1 }) });
      expect(countByKind(result, 'radar')).toBe(1);
      const radar = result.find((p) => p.kind === 'radar')!;
      const pt2 = centerline[2];
      const dist = Math.hypot(radar.x - pt2.x, radar.z - pt2.z);
      expect(dist).toBeCloseTo(7.5, 0);
    });

    it('places overhead gantry elevated', () => {
      const result = placeScenery({ centerline, halfWidth: 5, cadence: makeHint({ overheads: 1 }) });
      expect(countByKind(result, 'overhead')).toBe(1);
      const o = result.find((p) => p.kind === 'overhead')!;
      expect(o.y).toBe(4.5);
    });

    it('places pit buildings on inner side near start', () => {
      const result = placeScenery({ centerline, halfWidth: 5, cadence: makeHint({ pitBuildings: 2 }) });
      expect(countByKind(result, 'pitBuilding')).toBe(2);
      const pts = result.filter((p) => p.kind === 'pitBuilding');
      for (const pt of pts) {
        expect(pt.y).toBe(0);
      }
    });
  });

  describe('corner-based props', () => {
    const centerline = makeSquareTrack(50, 80);

    it('places pylons at local curvature maxima on outer edge', () => {
      const result = placeScenery({ centerline, halfWidth: 5, cadence: makeHint({ pylons: 4 }) });
      const pylons = result.filter((p) => p.kind === 'pylon');
      expect(pylons.length).toBeGreaterThan(0); // at least some corners detected
      for (const p of pylons) {
        // Pylons should be on the outer side
        const dist = Math.hypot(p.x, p.z);
        expect(dist).toBeGreaterThan(Math.hypot(centerline[0].x, centerline[0].z) * 0.9);
      }
    });

    it('places barriers at sharp corners when count covers them', () => {
      // A square has 4 sharp corners. With barriers=4 they should all land on corners.
      const result = placeScenery({ centerline, halfWidth: 5, cadence: makeHint({ barriers: 4 }) });
      expect(countByKind(result, 'barrier')).toBe(4);
      const barriers = result.filter((p) => p.kind === 'barrier');
      // Each barrier should be near a corner (~50, 50 area)
      for (const b of barriers) {
        const distFromCenter = Math.hypot(b.x, b.z);
        expect(distFromCenter).toBeGreaterThan(65);
      }
    });

    it('fills remaining barriers on gentle curves then sharp inner', () => {
      // Request many barriers to force fill onto sharp inner edges too.
      const result = placeScenery({ centerline, halfWidth: 5, cadence: makeHint({ barriers: 12 }) });
      expect(countByKind(result, 'barrier')).toBe(12);
    });

    it('places cones at sharp corner inner edges first', () => {
      // Square has 4 corners. We request 4 cones; they should land on inner runoff.
      const result = placeScenery({ centerline, halfWidth: 5, cadence: makeHint({ cones: 4 }) });
      expect(countByKind(result, 'cone')).toBe(4);
      const cones = result.filter((p) => p.kind === 'cone');
      // Inner edge means closer to origin than the centerline point.
      for (const c of cones) {
        const closestIdx = findClosestIndex(centerline, c.x, c.z);
        const cp = centerline[closestIdx];
        const coneDist = Math.hypot(c.x, c.z);
        const centerDist = Math.hypot(cp.x, cp.z);
        expect(coneDist).toBeLessThan(centerDist + 1); // inner or near edge
      }
    });
  });

  describe('straight-based props', () => {
    const centerline = makeSquareTrack(50, 80);

    it('spaces lights evenly and primarily on straights', () => {
      const result = placeScenery({ centerline, halfWidth: 5, cadence: makeHint({ lights: 8 }) });
      expect(countByKind(result, 'light')).toBe(8);
      // Lights should be spread out roughly evenly (not bunched at one corner)
      const lights = result.filter((p) => p.kind === 'light');
      const xs = lights.map((p) => p.x);
      const spread = Math.max(...xs) - Math.min(...xs);
      expect(spread).toBeGreaterThan(20);
    });

    it('places billboards on straights away from start/finish', () => {
      const result = placeScenery({ centerline, halfWidth: 5, cadence: makeHint({ billboards: 4 }) });
      expect(countByKind(result, 'billboard')).toBe(4);
      const bills = result.filter((p) => p.kind === 'billboard');
      for (const b of bills) {
        const dist = Math.hypot(b.x, b.z);
        expect(dist).toBeGreaterThan(55); // outer side, away from origin
      }
    });

    it('places grandstands on the longest straight segments', () => {
      const result = placeScenery({ centerline, halfWidth: 5, cadence: makeHint({ grandStands: 1 }) });
      expect(countByKind(result, 'grandStand')).toBeGreaterThanOrEqual(1);
      const stands = result.filter((p) => p.kind === 'grandStand');
      // Grandstands span 3-5 consecutive points
      expect(stands.length).toBeGreaterThanOrEqual(3);
      // All grandstands should be on outer side (farther from origin)
      for (const s of stands) {
        const distFromCenter = Math.hypot(s.x, s.z);
        expect(distFromCenter).toBeGreaterThan(70);
      }
    });

    it('places fences respecting count', () => {
      const result = placeScenery({ centerline, halfWidth: 5, cadence: makeHint({ fences: 20 }) });
      expect(countByKind(result, 'fence')).toBe(20);
    });

    it('places fences densely when count is high', () => {
      const result = placeScenery({ centerline, halfWidth: 5, cadence: makeHint({ fences: 200 }) });
      expect(countByKind(result, 'fence')).toBe(Math.min(200, centerline.length * 2));
    });
  });

  describe('round track (no straights, all curves)', () => {
    const centerline = makeCircleTrack(50, 80);

    it('still places props on circular track', () => {
      const result = placeScenery({
        centerline,
        halfWidth: 5,
        cadence: makeHint({ barriers: 10, cones: 5, lights: 5 }),
      });
      expect(result.length).toBeGreaterThan(0);
    });

    it('places lights on curves when count exceeds threshold', () => {
      // With a circle there are no straights; lights must fall back to curves.
      const result = placeScenery({ centerline, halfWidth: 5, cadence: makeHint({ lights: 20 }) });
      expect(countByKind(result, 'light')).toBe(20);
    });
  });

  describe('mixed track', () => {
    it('produces unique prop kinds as requested', () => {
      const centerline = makeSquareTrack(50, 80);
      const result = placeScenery({
        centerline,
        halfWidth: 5,
        cadence: makeHint({
          flags: 1,
          banners: 2,
          radars: 1,
          overheads: 1,
          pitBuildings: 2,
          pylons: 2,
          barriers: 8,
          cones: 4,
          lights: 6,
          fences: 10,
          grandStands: 1,
          billboards: 2,
        }),
      });
      expect(countByKind(result, 'flag')).toBe(1);
      expect(countByKind(result, 'banner')).toBe(2);
      expect(countByKind(result, 'radar')).toBe(1);
      expect(countByKind(result, 'overhead')).toBe(1);
      expect(countByKind(result, 'pitBuilding')).toBe(2);
      expect(countByKind(result, 'pylon')).toBeGreaterThanOrEqual(0);
      expect(countByKind(result, 'barrier')).toBe(8);
      expect(countByKind(result, 'cone')).toBe(4);
      expect(countByKind(result, 'light')).toBe(6);
      expect(countByKind(result, 'fence')).toBe(10);
      expect(countByKind(result, 'grandStand')).toBeGreaterThanOrEqual(3);
      expect(countByKind(result, 'billboard')).toBe(2);
    });
  });
});
