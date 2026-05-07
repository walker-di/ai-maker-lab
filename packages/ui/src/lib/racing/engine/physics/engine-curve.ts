/**
 * Engine torque curve and engine-map utilities (M6).
 *
 * Baseline NA curve: peak power at 5500 rpm sized to ~250 hp/ton for a
 * 1240 kg chassis (~233 kW / 405 Nm). The curve is interpolated linearly
 * between control points and clamped to 0 outside the rpm domain.
 *
 * M6 additions:
 *  - `EngineTorqueMap` — an authored throttle × rpm table of torque
 *    multipliers so fuelling, ignition-timing, and boost can all be
 *    expressed as a single 2-D lookup that scales the base curve.
 *  - `sampleEngineTorqueMap` — bilinear interpolation over the map.
 *  - `engineTorqueAtWithMap` — drop-in replacement for `engineTorqueAt`
 *    that applies the map multiplier when authored; falls back to the
 *    vanilla curve for naturally-aspirated presets.
 *  - Engine-braking helpers: `engineBrakeTorqueAt` returns the pumping +
 *    friction drag as a continuous function of rpm that rises gently below
 *    idle and increases more steeply above it, reflecting real throttle-off
 *    behaviour without the old flat constant.
 */

/** A `[rpm, Nm]` control point on the engine torque curve. */
export type EngineCurvePoint = readonly [number, number];

export const ENGINE_CURVE: ReadonlyArray<EngineCurvePoint> = [
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

/**
 * Authored 2-D engine torque map.
 *
 * `axis0` is the throttle axis (0..1, monotonically increasing).
 * `axis1` is the rpm axis (monotonically increasing).
 * `data[i][j]` is the torque *multiplier* at `(axis0[i], axis1[j])`.
 * A multiplier of 1 means "follow the base NA curve exactly."
 * Values > 1 represent boost-enrichment (turbo cars typically exceed 1 in
 * the mid-range); values < 1 model intentional fuel-cut, flat-shift, etc.
 */
export interface EngineTorqueMap {
  /** Throttle axis breakpoints (0..1). */
  axis0: ReadonlyArray<number>;
  /** RPM axis breakpoints. */
  axis1: ReadonlyArray<number>;
  /** Row = throttle index, column = rpm index. Value = torque multiplier. */
  data: ReadonlyArray<ReadonlyArray<number>>;
}

/**
 * Bilinear interpolation over an `EngineTorqueMap`.
 * Returns the torque multiplier for the given (throttle, rpm) operating point.
 * Safe to call with out-of-range inputs — they are clamped to the map edges.
 */
export function sampleEngineTorqueMap(
  map: EngineTorqueMap,
  throttle: number,
  rpm: number,
): number {
  const { axis0, axis1, data } = map;
  const n0 = axis0.length;
  const n1 = axis1.length;
  if (n0 < 1 || n1 < 1) return 1;

  let i0 = 0;
  for (let i = 1; i < n0 - 1; i++) {
    if (axis0[i] <= throttle) i0 = i;
  }
  const i1 = Math.min(i0 + 1, n0 - 1);

  let j0 = 0;
  for (let j = 1; j < n1 - 1; j++) {
    if (axis1[j] <= rpm) j0 = j;
  }
  const j1 = Math.min(j0 + 1, n1 - 1);

  const da = axis0[i1] - axis0[i0];
  const ta = da > 1e-9 ? (throttle - axis0[i0]) / da : 0;
  const ta_ = Math.max(0, Math.min(1, ta));

  const dr = axis1[j1] - axis1[j0];
  const tr = dr > 1e-9 ? (rpm - axis1[j0]) / dr : 0;
  const tr_ = Math.max(0, Math.min(1, tr));

  const r00 = (data[i0]?.[j0]) ?? 1;
  const r01 = (data[i0]?.[j1]) ?? 1;
  const r10 = (data[i1]?.[j0]) ?? 1;
  const r11 = (data[i1]?.[j1]) ?? 1;

  return r00 * (1 - ta_) * (1 - tr_)
    + r10 * ta_ * (1 - tr_)
    + r01 * (1 - ta_) * tr_
    + r11 * ta_ * tr_;
}

/**
 * Interpolate the base NA torque curve at the given rpm.
 * Clamps to 0 outside the defined rpm range.
 */
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

/**
 * Sample an authored torque curve (array of `[rpm, Nm]` pairs) at the given
 * rpm.  Falls back to the built-in NA curve when `curve` is undefined or
 * empty.
 */
export function sampleTorqueCurve(
  curve: ReadonlyArray<EngineCurvePoint> | undefined,
  rpm: number,
): number {
  const pts = curve && curve.length >= 2 ? curve : ENGINE_CURVE;
  const maxRpm = pts[pts.length - 1][0];
  const r = Math.max(0, Math.min(maxRpm, rpm));
  for (let i = 1; i < pts.length; i++) {
    const [r0, t0] = pts[i - 1];
    const [r1, t1] = pts[i];
    if (r <= r1) {
      const frac = (r - r0) / Math.max(1, r1 - r0);
      return t0 + (t1 - t0) * frac;
    }
  }
  return 0;
}

/**
 * Full M6 torque evaluation: samples the authored torque curve (or the
 * built-in NA curve when absent), applies the `boostMultiplier` from the
 * turbo model, and optionally scales via the 2-D engine-torque map.
 */
export function engineTorqueAtWithMap(
  rpm: number,
  throttle: number,
  boostMultiplier: number,
  curve?: ReadonlyArray<EngineCurvePoint>,
  torqueMap?: EngineTorqueMap,
): number {
  const baseTorque = sampleTorqueCurve(curve, rpm);
  const mapMultiplier = torqueMap ? sampleEngineTorqueMap(torqueMap, throttle, rpm) : 1;
  return baseTorque * boostMultiplier * mapMultiplier;
}

/**
 * Engine-braking torque magnitude (Nm) at the given omega and throttle
 * position.  On a fully closed throttle the drag is the sum of pumping
 * work, valve/friction losses, and speed-proportional losses.  Full
 * throttle → near-zero extra drag (only `constantNm` base friction remains).
 */
export interface EngineBrakingParams {
  /** Viscous drag coefficient (Nm / (rad/s)). Default 0.04. */
  linearNmPerRadS?: number;
  /** Constant Coulomb friction drag (Nm). Default 8. */
  constantNm?: number;
  /**
   * Throttle-off pumping coefficient (Nm / (rad/s)² × offThrottle).
   * Default 0.001.
   */
  pumpingCoeffNmPerRadS2?: number;
  /** Maximum engine braking torque cap (Nm). Default 300. */
  maxBrakeTorqueNm?: number;
}

const DEFAULT_ENGINE_BRAKE_LINEAR = 0.04;
const DEFAULT_ENGINE_BRAKE_CONSTANT = 8;
const DEFAULT_ENGINE_BRAKE_PUMPING = 0.001;
const DEFAULT_ENGINE_BRAKE_MAX = 300;

/**
 * Compute the engine braking drag magnitude (Nm, always ≥ 0) applied
 * opposite to crankshaft rotation when the throttle is closed.
 *
 * `throttle` = 0 → full engine braking; `throttle` = 1 → near-zero drag.
 */
export function engineBrakeTorqueAt(
  omegaRadS: number,
  throttle: number,
  params?: EngineBrakingParams,
): number {
  const linear = params?.linearNmPerRadS ?? DEFAULT_ENGINE_BRAKE_LINEAR;
  const constant = params?.constantNm ?? DEFAULT_ENGINE_BRAKE_CONSTANT;
  const pumping = params?.pumpingCoeffNmPerRadS2 ?? DEFAULT_ENGINE_BRAKE_PUMPING;
  const maxT = params?.maxBrakeTorqueNm ?? DEFAULT_ENGINE_BRAKE_MAX;

  const absOmega = Math.abs(omegaRadS);
  const offThrottle = Math.max(0, 1 - throttle * 4);
  const drag = linear * absOmega + constant + pumping * absOmega * absOmega * offThrottle;
  return Math.min(drag, maxT);
}
