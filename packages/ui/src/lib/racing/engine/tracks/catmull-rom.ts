/**
 * Centripetal Catmull-Rom interpolation of a closed ring of control points.
 *
 * Returns N evenly spaced points (in u parameter, not arc length). This is a
 * minimal pure-math implementation that the racing engine uses to sample
 * track centerlines without pulling in Three.js for the math itself.
 *
 * Three.js `CatmullRomCurve3` produces equivalent geometry for the same
 * control points and `'centripetal'` parameterisation; this helper exists
 * so the track-geometry tests don't need to load Three.js, and so the
 * domain-side track validators can sample without `three`.
 */

export interface SampledPoint {
  x: number;
  z: number;
}

export type CenterlineCtrl = ReadonlyArray<readonly [number, number]>;

export function sampleCentripetal(
  ctrl: CenterlineCtrl,
  N: number,
  alpha = 0.5,
): SampledPoint[] {
  const n = ctrl.length;
  const ts: number[] = [0];
  for (let i = 0; i < n; i++) {
    const a = ctrl[i];
    const b = ctrl[(i + 1) % n];
    const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
    ts.push(ts[ts.length - 1] + Math.pow(d, alpha));
  }
  const total = ts[ts.length - 1];
  const out: SampledPoint[] = [];
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

    function term(
      pa: readonly [number, number],
      pb: readonly [number, number],
      ta: number,
      tb: number,
    ): [number, number] {
      const f = (tb - t) / (tb - ta);
      const g = (t - ta) / (tb - ta);
      return [pa[0] * f + pb[0] * g, pa[1] * f + pb[1] * g];
    }
    const A1 = term(p0, p1, t0, t1);
    const A2 = term(p1, p2, t1, t2);
    const A3 = term(p2, p3, t2, t3);
    const B1 = term(A1, A2, t0, t2);
    const B2 = term(A2, A3, t1, t3);
    const C = term(B1, B2, t1, t2);
    out.push({ x: C[0], z: C[1] });
  }
  return out;
}
