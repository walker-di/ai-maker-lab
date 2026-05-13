/**
 * Cornering Brake Control (CBC).
 *
 * Real cars with EBD/CBC reduce hydraulic pressure to the unloaded inside
 * wheel during a turn so it doesn't lock first under hard braking. Without
 * this, asymmetric ABS releases on the inside front produce a yaw moment
 * opposite the steering direction (the "brake + steer-left → yaw right"
 * glitch).
 *
 * `applyCorneringBrakeControl` returns a per-wheel scalar in `[1−k, 1+k]` that
 * tracks the wheel's load fraction within its axle. With `k=0`, all wheels
 * brake equally (no balancing). With `k=1`, the brake torque is fully load-
 * proportional. We default to `k=0.6` — strong enough to keep the inside
 * wheel from tripping ABS first, gentle enough to leave normal straight-line
 * stops untouched (loads are already symmetric there).
 *
 * Pure function; consumed by `RacingEngine.runWheelPass` and tested in
 * `brake-balance.test.ts`.
 */

export interface CbcOptions {
  /** Balancing strength in [0, 1]. */
  k?: number;
}

export type WheelQuad<T> = readonly [T, T, T, T];

export function applyCorneringBrakeControl(
  fzPerWheel: WheelQuad<number>,
  options: CbcOptions = {},
): WheelQuad<number> {
  const k = clamp01(options.k ?? 0.6);
  const frontAvg = (fzPerWheel[0] + fzPerWheel[1]) * 0.5;
  const rearAvg = (fzPerWheel[2] + fzPerWheel[3]) * 0.5;
  const norm = (fz: number, axleAvg: number): number => {
    if (axleAvg < 1) return 1;
    const ratio = fz / axleAvg;
    return Math.max(0, 1 - k + k * ratio);
  };
  return [
    norm(fzPerWheel[0], frontAvg),
    norm(fzPerWheel[1], frontAvg),
    norm(fzPerWheel[2], rearAvg),
    norm(fzPerWheel[3], rearAvg),
  ];
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
