import { describe, expect, it } from 'bun:test';

// Mirror just enough of three.js Vector3 + CatmullRomCurve3 to validate
// that each track preset produces a closed, non-self-intersecting ribbon.
class Vec3 {
  constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
  clone() { return new Vec3(this.x, this.y, this.z); }
  add(v) { this.x += v.x; this.y += v.y; this.z += v.z; return this; }
  addScaled(v, s) { this.x += v.x * s; this.y += v.y * s; this.z += v.z * s; return this; }
  sub(v) { return new Vec3(this.x - v.x, this.y - v.y, this.z - v.z); }
  length() { return Math.hypot(this.x, this.y, this.z); }
  normalize() { const L = this.length() || 1; this.x /= L; this.y /= L; this.z /= L; return this; }
  cross(v) { return new Vec3(this.y * v.z - this.z * v.y, this.z * v.x - this.x * v.z, this.x * v.y - this.y * v.x); }
}

// Centripetal Catmull-Rom interpolation of a closed ring of control points.
// Returns N evenly spaced points (in u parameter, not arc length).
function sampleCentripetal(ctrl, N, alpha = 0.5) {
  const n = ctrl.length;
  const ts = [0];
  for (let i = 0; i < n; i++) {
    const a = ctrl[i];
    const b = ctrl[(i + 1) % n];
    const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
    ts.push(ts[ts.length - 1] + Math.pow(d, alpha));
  }
  const total = ts[ts.length - 1];
  const out = [];
  for (let i = 0; i < N; i++) {
    const u = (i / N) * total;
    let seg = 0;
    while (seg < n - 1 && ts[seg + 1] < u) seg++;
    const localT = (u - ts[seg]) / (ts[seg + 1] - ts[seg]);

    const p0 = ctrl[(seg - 1 + n) % n];
    const p1 = ctrl[seg % n];
    const p2 = ctrl[(seg + 1) % n];
    const p3 = ctrl[(seg + 2) % n];

    const t0 = 0;
    const t1 = Math.pow(Math.hypot(p0[0] - p1[0], p0[1] - p1[1]), alpha);
    const t2 = t1 + Math.pow(Math.hypot(p1[0] - p2[0], p1[1] - p2[1]), alpha);
    const t3 = t2 + Math.pow(Math.hypot(p2[0] - p3[0], p2[1] - p3[1]), alpha);
    const t = t1 + (t2 - t1) * localT;

    function term(pa, pb, ta, tb) {
      const f = (tb - t) / (tb - ta);
      const g = (t - ta) / (tb - ta);
      return [pa[0] * f + pb[0] * g, pa[1] * f + pb[1] * g];
    }
    const A1 = term(p0, p1, t0, t1);
    const A2 = term(p1, p2, t1, t2);
    const A3 = term(p2, p3, t2, t3);
    const B1 = term(A1, A2, t0, t2);
    const B2 = term(A2, A3, t1, t3);
    const C  = term(B1, B2, t1, t2);
    out.push({ x: C[0], z: C[1] });
  }
  return out;
}

// 2D segment intersection (open at both endpoints) — used to check whether
// distinct sections of the track ribbon cross.
function segmentsIntersect(a, b, c, d) {
  function ccw(p, q, r) { return (q.x - p.x) * (r.z - p.z) - (q.z - p.z) * (r.x - p.x); }
  const d1 = ccw(c, d, a);
  const d2 = ccw(c, d, b);
  const d3 = ccw(a, b, c);
  const d4 = ccw(a, b, d);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
      ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return true;
  return false;
}

const TRACKS = {
  'classic-twist': {
    halfWidth: 6.0,
    samples: 240,
    ctrl: [
      [  0,  60], [ 50,  50], [ 70,  10], [ 60, -30], [ 30, -60],
      [-10, -55], [-30, -25], [-55,   0], [-50,  35], [-25,  55],
    ],
  },
  'lakeside-gp': {
    halfWidth: 7.0,
    samples: 280,
    ctrl: [
      [   0,  90], [  55,  85], [ 105,  55], [ 120,   5], [ 100, -45],
      [  55, -75], [   0, -82], [ -55, -70], [-100, -40], [-115,   5],
      [ -95,  55], [ -50,  85],
    ],
  },
  'corkscrew-ridge': {
    halfWidth: 5.4,
    samples: 280,
    ctrl: [
      [   0,  68], [  38,  60], [  62,  32], [  72,  -5], [  58, -42],
      [  22, -65], [ -18, -65], [ -52, -48], [ -38, -22], [ -58,   5],
      [ -38,  28], [ -55,  48],
    ],
  },
  'harbor-chicane': {
    halfWidth: 5.8,
    samples: 260,
    ctrl: [
      [  -8,  70], [  40,  72], [  70,  55], [  72,  20], [  90,   0],
      [  85, -30], [  50, -55], [  10, -60], [ -25, -45], [ -55, -20],
      [ -80,   0], [ -78,  35], [ -50,  62],
    ],
  },
  'desert-bowl': {
    halfWidth: 7.6,
    samples: 300,
    ctrl: [
      [   0, 110], [  70,  95], [ 120,  55], [ 130,   0], [ 120, -55],
      [  70, -95], [  30,-100], [   0, -90], [ -30,-100], [ -70, -95],
      [-120, -55], [-130,   0], [-120,  55], [ -70,  95],
    ],
  },
  'forest-loop': {
    halfWidth: 6.2,
    samples: 280,
    ctrl: [
      [   0,  90], [  40,  78], [  75,  35], [  80,  -5], [  70, -50],
      [  30, -80], [ -15, -82], [ -55, -55], [ -75, -15], [ -65,  20],
      [ -80,  55], [ -45,  85],
    ],
  },
};

function checkClosed(points) {
  const a = points[0];
  const b = points[points.length - 1];
  const d = Math.hypot(a.x - b.x, a.z - b.z);
  return d > 0 && d < 50;
}

function findRibbonIntersection(points, halfWidth, label) {
  // Build the asphalt ribbon edges (left + right), as line segments between
  // consecutive samples. Then look for intersecting pairs of edges that are
  // not adjacent (more than ~halfWidth*2 apart along the spline).
  const n = points.length;
  const left = new Array(n);
  const right = new Array(n);
  for (let i = 0; i < n; i++) {
    const cur = points[i];
    const nxt = points[(i + 1) % n];
    const tan = { x: nxt.x - cur.x, z: nxt.z - cur.z };
    const L = Math.hypot(tan.x, tan.z) || 1;
    tan.x /= L; tan.z /= L;
    const r = { x: -tan.z, z: tan.x };
    left[i] = { x: cur.x - r.x * halfWidth, z: cur.z - r.z * halfWidth };
    right[i] = { x: cur.x + r.x * halfWidth, z: cur.z + r.z * halfWidth };
  }

  // Adjacent samples can have grazing overlaps; ignore i,j within `skip`
  // indices of each other (skip ≈ 1.5x road width measured in samples).
  const skip = Math.max(8, Math.ceil((halfWidth * 4) / 5));

  function wrapDist(i, j) {
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

describe('track presets are closed and non-self-intersecting', () => {
  for (const [key, preset] of Object.entries(TRACKS)) {
    it(`track "${key}" samples a closed loop`, () => {
      const pts = sampleCentripetal(preset.ctrl, preset.samples);
      expect(pts.length).toBe(preset.samples);
      expect(checkClosed(pts)).toBe(true);
    });

    it(`track "${key}" has no self-intersecting asphalt edges`, () => {
      const pts = sampleCentripetal(preset.ctrl, preset.samples);
      const err = findRibbonIntersection(pts, preset.halfWidth, key);
      if (err) console.log('  ' + err);
      expect(err).toBeNull();
    });
  }
});
