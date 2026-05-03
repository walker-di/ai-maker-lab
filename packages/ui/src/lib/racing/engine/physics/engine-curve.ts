/**
 * Engine torque curve. Peak power at 5500 rpm sized to ~250 hp/ton for a
 * 1240 kg chassis: peak ~233 kW (313 hp) from ~405 Nm at 5500 rpm. The
 * curve is interpolated linearly between control points and clamped to 0
 * outside the rpm domain.
 */

export const ENGINE_CURVE: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [1000, 170],
  [2500, 280],
  [4000, 365],
  [5500, 405],
  [6800, 395],
  [7800, 360],
  [8500, 295],
  [9200, 0],
];

export const ENGINE_REDLINE = 8400;
export const ENGINE_IDLE = 1100;

export function engineTorqueAt(rpm: number): number {
  const maxRpm = ENGINE_CURVE[ENGINE_CURVE.length - 1][0];
  const r = Math.max(0, Math.min(maxRpm, rpm));
  for (let i = 1; i < ENGINE_CURVE.length; i++) {
    const [r0, t0] = ENGINE_CURVE[i - 1];
    const [r1, t1] = ENGINE_CURVE[i];
    if (r <= r1) {
      const t = (r - r0) / Math.max(1, r1 - r0);
      return t0 + (t1 - t0) * t;
    }
  }
  return 0;
}
