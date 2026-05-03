/**
 * Ribbon geometry validators. Build the left and right edges of the track
 * ribbon from a sampled centerline + half-width, then check whether any
 * non-adjacent pair of edge segments intersects (which would mean the
 * track preset folds back on itself).
 */

import type { SampledPoint } from './catmull-rom.js';

export interface RibbonEdges {
  left: SampledPoint[];
  right: SampledPoint[];
}

export function buildRibbonEdges(points: SampledPoint[], halfWidth: number): RibbonEdges {
  const n = points.length;
  const left = new Array<SampledPoint>(n);
  const right = new Array<SampledPoint>(n);
  for (let i = 0; i < n; i++) {
    const cur = points[i];
    const nxt = points[(i + 1) % n];
    const tan = { x: nxt.x - cur.x, z: nxt.z - cur.z };
    const L = Math.hypot(tan.x, tan.z) || 1;
    tan.x /= L;
    tan.z /= L;
    const r = { x: -tan.z, z: tan.x };
    left[i] = { x: cur.x - r.x * halfWidth, z: cur.z - r.z * halfWidth };
    right[i] = { x: cur.x + r.x * halfWidth, z: cur.z + r.z * halfWidth };
  }
  return { left, right };
}

function segmentsIntersect(
  a: SampledPoint,
  b: SampledPoint,
  c: SampledPoint,
  d: SampledPoint,
): boolean {
  function ccw(p: SampledPoint, q: SampledPoint, r: SampledPoint): number {
    return (q.x - p.x) * (r.z - p.z) - (q.z - p.z) * (r.x - p.x);
  }
  const d1 = ccw(c, d, a);
  const d2 = ccw(c, d, b);
  const d3 = ccw(a, b, c);
  const d4 = ccw(a, b, d);
  return (
    ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
    ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
  );
}

/**
 * Returns the first self-intersection found, or `null` if the ribbon is
 * safe. `label` is included in the message so callers can tell which track
 * preset failed.
 */
export function findRibbonIntersection(
  points: SampledPoint[],
  halfWidth: number,
  label: string,
): string | null {
  const { left, right } = buildRibbonEdges(points, halfWidth);
  const n = points.length;

  // Adjacent samples can have grazing overlaps; ignore i,j within `skip`
  // indices of each other (skip ≈ 1.5x road width measured in samples).
  const skip = Math.max(8, Math.ceil((halfWidth * 4) / 5));

  function wrapDist(i: number, j: number): number {
    const d = Math.abs(i - j);
    return Math.min(d, n - d);
  }

  for (let i = 0; i < n; i++) {
    const a = left[i];
    const b = left[(i + 1) % n];
    for (let j = i + 1; j < n; j++) {
      if (wrapDist(i, j) <= skip) continue;
      const c = left[j];
      const d = left[(j + 1) % n];
      if (segmentsIntersect(a, b, c, d)) {
        return `${label}: left-edge self-intersection at i=${i}, j=${j}`;
      }
      const c2 = right[j];
      const d2 = right[(j + 1) % n];
      if (segmentsIntersect(a, b, c2, d2)) {
        return `${label}: left/right edge cross at i=${i}, j=${j}`;
      }
    }
    const ar = right[i];
    const br = right[(i + 1) % n];
    for (let j = i + 1; j < n; j++) {
      if (wrapDist(i, j) <= skip) continue;
      const c = right[j];
      const d = right[(j + 1) % n];
      if (segmentsIntersect(ar, br, c, d)) {
        return `${label}: right-edge self-intersection at i=${i}, j=${j}`;
      }
    }
  }
  return null;
}

export function isLoopClosed(points: SampledPoint[]): boolean {
  if (points.length < 2) return false;
  const a = points[0];
  const b = points[points.length - 1];
  const d = Math.hypot(a.x - b.x, a.z - b.z);
  return d > 0 && d < 50;
}
