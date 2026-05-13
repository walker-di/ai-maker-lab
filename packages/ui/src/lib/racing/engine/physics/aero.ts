/**
 * Aerodynamics. Three contributions:
 *   1. **Drag**, which grows quadratically with speed and includes a
 *      yaw-dependent term so a sliding car loses more speed than a tracking
 *      one.
 *   2. **Yaw-restoring moment**, which steers the chassis back toward its
 *      heading at high speed. This is the air pushing on the back-half of
 *      the car when the chassis is angled to the airflow.
 *   3. **Downforce**, per axle, scaled with airspeed squared. The renderer
 *      adds the result to per-wheel `Fz` BEFORE the tire model so high-speed
 *      corners get the expected grip boost. The plan calls for the matching
 *      reaction on the chassis to be applied separately so aero downforce
 *      cannot levitate the rigid body through a vertical-force artifact.
 *
 * M5: Aero Map support — authored ride-height/pitch/yaw-sensitive tables
 * replace scalar `clAreaFront` / `clAreaRear` when present. Scalar fallback
 * is preserved for all existing presets that omit the map. Pure bilinear
 * interpolation; no Three.js dependency.
 *
 * Pure functions only; no dependence on Three.js. The renderer-side glue is
 * responsible for projecting velocity onto chassis-local axes and applying
 * the resulting force/moment to the rigid body.
 */

// ---------------------------------------------------------------------------
// M5: Aero Map types
// ---------------------------------------------------------------------------

/**
 * A 2-D lookup table keyed by `[axis0Value, axis1Value] → value`.
 *
 * `axis0` is always the primary axis (ride-height, m).
 * `axis1` is the secondary axis (pitch angle, deg; or yaw angle, deg
 *  for the yaw drag sweep).
 * `data[i][j]` is the output at `(axis0[i], axis1[j])`.
 */
export interface AeroTableMap {
  /** Primary axis values (e.g. ride-height in metres), sorted ascending. */
  axis0: ReadonlyArray<number>;
  /** Secondary axis values (e.g. pitch degrees or yaw degrees), sorted ascending. */
  axis1: ReadonlyArray<number>;
  /**
   * Data rows: `data[i]` corresponds to `axis0[i]`, `data[i][j]` to
   * `(axis0[i], axis1[j])`. Length must equal `axis0.length`; each row
   * length must equal `axis1.length`.
   */
  data: ReadonlyArray<ReadonlyArray<number>>;
}

/**
 * Authored aero map for a vehicle. All fields are optional so the engine
 * can fall back to scalar `clAreaFrontM2` / `clAreaRearM2` for presets
 * that have not been authored with maps.
 *
 * Table format: rows indexed by front ride-height (m), columns indexed by
 * pitch angle (deg, positive = nose-up).  The output value is the effective
 * `Cl·A` (m²) for that axle at those conditions.
 *
 * `yawDragMap` rows are indexed by yaw angle (deg), columns by speed (km/h);
 * output is the effective `Cd·A` increment added to the base drag at that
 * yaw angle and speed.
 */
export interface AeroMapPreset {
  /**
   * Front `Cl·A` vs. [ride-height (m), pitch (deg)].
   * Stall occurs when `Cl·A` drops sharply (the table encodes this naturally).
   */
  frontClAreaMap?: AeroTableMap;
  /**
   * Rear `Cl·A` vs. [ride-height (m), pitch (deg)].
   */
  rearClAreaMap?: AeroTableMap;
  /**
   * Yaw drag increment map: extra `Cd·A` vs. [yaw angle (deg), speed (km/h)].
   * When absent the scalar `yawDragGain` fallback is used.
   */
  yawDragMap?: AeroTableMap;
  /**
   * Centre-of-pressure position as a fraction of wheelbase (0 = front axle,
   * 1 = rear axle). When omitted the engine derives it from the front/rear
   * downforce split. Authoring this value directly is useful for cars with
   * complex underbody diffuser geometry.
   */
  copFraction?: number;
  /**
   * Ride-height (m) threshold below which the underbody flow is considered
   * stalled (diffuser stall). Used for telemetry; the stall force reduction
   * is encoded in the table data itself.
   */
  stallRideHeightM?: number;
}

// ---------------------------------------------------------------------------
// Interpolation helper
// ---------------------------------------------------------------------------

/**
 * Clamp `v` to `[lo, hi]`.
 */
function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * Linear interpolation between two scalars.
 */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Find the bracketing index for `v` in a sorted ascending `axis`.
 * Returns `i` such that `axis[i] <= v < axis[i+1]` (clamped at ends).
 */
function bracketIndex(axis: ReadonlyArray<number>, v: number): number {
  if (axis.length < 2) return 0;
  if (v <= axis[0]) return 0;
  if (v >= axis[axis.length - 1]) return axis.length - 2;
  let lo = 0;
  let hi = axis.length - 2;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (axis[mid + 1] <= v) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * Bilinear interpolation on a 2-D aero table map.
 *
 * @param map - the authored lookup table
 * @param v0 - primary axis value (e.g. ride-height)
 * @param v1 - secondary axis value (e.g. pitch angle)
 * @returns interpolated output value
 */
export function sampleAeroTable(map: AeroTableMap, v0: number, v1: number): number {
  const { axis0, axis1, data } = map;
  if (axis0.length === 0 || axis1.length === 0) return 0;
  if (axis0.length === 1 && axis1.length === 1) return data[0]?.[0] ?? 0;

  const i = bracketIndex(axis0, v0);
  const j = bracketIndex(axis1, v1);

  const t0 =
    axis0.length < 2
      ? 0
      : clamp((v0 - axis0[i]) / (axis0[i + 1] - axis0[i]), 0, 1);
  const t1 =
    axis1.length < 2
      ? 0
      : clamp((v1 - axis1[j]) / (axis1[j + 1] - axis1[j]), 0, 1);

  const r0 = data[i];
  const r1 = data[i + 1] ?? data[i];

  const v00 = r0?.[j] ?? 0;
  const v01 = r0?.[j + 1] ?? r0?.[j] ?? 0;
  const v10 = r1?.[j] ?? 0;
  const v11 = r1?.[j + 1] ?? r1?.[j] ?? 0;

  const top = lerp(v00, v01, t1);
  const bot = lerp(v10, v11, t1);
  return lerp(top, bot, t0);
}

// ---------------------------------------------------------------------------
// M5: Downforce with aero-map support
// ---------------------------------------------------------------------------

export interface AeroDownforceInput {
  /**
   * Chassis-local longitudinal speed (m/s). Sign is irrelevant — wings and
   * splitters generate downward load whether the car is rolling forward or
   * backward — so the helper takes the magnitude.
   */
  forwardSpeed: number;
  /** Effective `Cl · A` for the front axle (m²). Negative inputs clamp to 0. */
  clAreaFront: number;
  /** Effective `Cl · A` for the rear axle (m²). Negative inputs clamp to 0. */
  clAreaRear: number;
  /** Air density. Default `1.225 kg/m³` at sea level, 15 °C. */
  airDensity?: number;
  // ---- M5 aero-map inputs (all optional — scalar fallback when absent) ----
  /** Authored aero map preset. When absent scalar `clAreaFront/Rear` is used. */
  aeroMap?: AeroMapPreset;
  /**
   * Average front ride-height (m) from suspension travel. Positive means
   * the body is higher off the ground (less downforce from underbody effect).
   */
  frontRideHeightM?: number;
  /** Average rear ride-height (m) from suspension travel. */
  rearRideHeightM?: number;
  /**
   * Chassis pitch angle (deg, positive = nose-up / understeer-prone posture).
   */
  pitchDeg?: number;
}

export interface AeroDownforceResult {
  /** Total downward load on the front axle (N). Always >= 0. */
  frontDownforceN: number;
  /** Total downward load on the rear axle (N). Always >= 0. */
  rearDownforceN: number;
  // ---- M5 telemetry outputs -----------------------------------------------
  /**
   * Effective `Cl·A` for the front axle used this call (m²).  Reflects the
   * aero-map result when a map is present, otherwise the scalar input.
   */
  effectiveClAreaFront: number;
  /**
   * Effective `Cl·A` for the rear axle used this call (m²).
   */
  effectiveClAreaRear: number;
  /**
   * Centre-of-pressure position as fraction of wheelbase (0 = front, 1 = rear).
   * Derived from the front/rear downforce split unless the map authors it
   * directly via `copFraction`.
   */
  copFraction: number;
  /**
   * True when the front underbody is operating below the stall ride-height
   * threshold authored in the aero map.
   */
  frontStalled: boolean;
  /**
   * True when the rear underbody is operating below the stall ride-height.
   */
  rearStalled: boolean;
}

/**
 * Per-axle aerodynamic downforce.
 *
 * Returns the totals for each axle; callers are expected to split the value
 * across the two wheels (typically 50/50 unless an asymmetric wing is being
 * modelled, which is out of scope for Phase 4).
 *
 * M5: When `aeroMap` is provided and the relevant sub-tables are present,
 * bilinear interpolation replaces the fixed scalar `Cl·A`.  Missing axes
 * use the scalar fields as fallback so the scalar path is always preserved.
 */
export function computeAeroDownforce(input: AeroDownforceInput): AeroDownforceResult {
  const rho = input.airDensity ?? 1.225;
  const v = Math.abs(input.forwardSpeed);

  const zero: AeroDownforceResult = {
    frontDownforceN: 0,
    rearDownforceN: 0,
    effectiveClAreaFront: 0,
    effectiveClAreaRear: 0,
    copFraction: 0.5,
    frontStalled: false,
    rearStalled: false,
  };

  if (!Number.isFinite(v) || v <= 0 || !Number.isFinite(rho) || rho <= 0) {
    return zero;
  }

  const map = input.aeroMap;
  const frontRh = input.frontRideHeightM ?? 0.1;
  const rearRh = input.rearRideHeightM ?? 0.1;
  const pitchDeg = input.pitchDeg ?? 0;

  // Stall detection uses the average ride-height as the primary dimension.
  const stallRh = map?.stallRideHeightM;
  const frontStalled = stallRh !== undefined && frontRh < stallRh;
  const rearStalled = stallRh !== undefined && rearRh < stallRh;

  let clFront: number;
  let clRear: number;

  if (map?.frontClAreaMap) {
    // Use average ride-height as primary axis, pitch as secondary.
    clFront = Math.max(0, sampleAeroTable(map.frontClAreaMap, frontRh, pitchDeg));
  } else {
    clFront = Number.isFinite(input.clAreaFront) ? Math.max(0, input.clAreaFront) : 0;
  }

  if (map?.rearClAreaMap) {
    clRear = Math.max(0, sampleAeroTable(map.rearClAreaMap, rearRh, pitchDeg));
  } else {
    clRear = Number.isFinite(input.clAreaRear) ? Math.max(0, input.clAreaRear) : 0;
  }

  const q = 0.5 * rho * v * v;
  const frontN = q * clFront;
  const rearN = q * clRear;

  // CoP fraction: from authored value or derived from the downforce split.
  let copFraction: number;
  if (map?.copFraction !== undefined && Number.isFinite(map.copFraction)) {
    copFraction = clamp(map.copFraction, 0, 1);
  } else {
    const total = frontN + rearN;
    copFraction = total > 1e-6 ? rearN / total : 0.5;
  }

  return {
    frontDownforceN: frontN,
    rearDownforceN: rearN,
    effectiveClAreaFront: clFront,
    effectiveClAreaRear: clRear,
    copFraction,
    frontStalled,
    rearStalled,
  };
}

// ---------------------------------------------------------------------------
// Drag (unchanged scalar path + M5 yaw-map support)
// ---------------------------------------------------------------------------

export interface AeroDragInput {
  /** Forward speed component along chassis +Z (m/s). */
  forwardSpeed: number;
  /** Lateral speed component along chassis +X (m/s). */
  sideSpeed: number;
  /** Drag coefficient · area (`0.5 ρ Cd A` is folded in). */
  cdArea: number;
  /** Air density × half (`0.5 ρ`). Default `0.6125` at sea level. */
  rhoHalf?: number;
  /** Extra drag coefficient applied to the lateral component. Default 1.6. */
  yawDragGain?: number;
  // ---- M5 yaw drag map (optional) -----------------------------------------
  /**
   * Authored yaw drag map.  When present the bilinear lookup replaces the
   * scalar `yawDragGain` term for the side-speed drag contribution.
   * Primary axis: yaw angle (deg), secondary axis: speed (km/h).
   */
  yawDragMap?: AeroTableMap;
  /**
   * Current vehicle speed in km/h. Used as the secondary axis for
   * `yawDragMap`. Required when `yawDragMap` is provided.
   */
  speedKmh?: number;
}

export interface AeroDragResult {
  /** Drag force along the negative chassis +Z (N), always non-positive. */
  fzDragWS: number;
  /** Lateral drag along chassis +X (N), opposes the side velocity. */
  fxDragWS: number;
}

export function computeAeroDrag(input: AeroDragInput): AeroDragResult {
  const rho2 = input.rhoHalf ?? 0.6125;
  const v2 = Math.hypot(input.forwardSpeed, input.sideSpeed);
  const vSq = v2 * v2;
  if (v2 < 1e-3) return { fzDragWS: 0, fxDragWS: 0 };

  const fwd = input.forwardSpeed === 0
    ? 0
    : -Math.sign(input.forwardSpeed) * rho2 * input.cdArea * vSq * Math.abs(input.forwardSpeed) / v2;

  let lat: number;
  if (input.sideSpeed === 0) {
    lat = 0;
  } else if (input.yawDragMap) {
    // M5: map-based yaw drag — look up Cd·A increment at current yaw/speed.
    const yawDeg = Math.abs(Math.atan2(input.sideSpeed, Math.max(1e-3, Math.abs(input.forwardSpeed))) * (180 / Math.PI));
    const speedKmh = input.speedKmh ?? v2 * 3.6;
    const cdaIncrement = Math.max(0, sampleAeroTable(input.yawDragMap, yawDeg, speedKmh));
    const effectiveCdA = input.cdArea + cdaIncrement;
    lat = -Math.sign(input.sideSpeed) * rho2 * effectiveCdA * vSq * Math.abs(input.sideSpeed) / v2;
  } else {
    const yawGain = input.yawDragGain ?? 1.6;
    lat = -Math.sign(input.sideSpeed) * rho2 * input.cdArea * yawGain * vSq * Math.abs(input.sideSpeed) / v2;
  }

  return { fzDragWS: fwd, fxDragWS: lat };
}

// ---------------------------------------------------------------------------
// Yaw restoring (unchanged)
// ---------------------------------------------------------------------------

export interface YawRestoringInput {
  /** Chassis-local sideslip angle in radians (positive = nose right). */
  sideslipRad: number;
  /** Air speed (m/s). */
  speed: number;
  /** Yaw-aero coefficient (≈ 0.10 for a sport sedan). */
  cyYaw?: number;
}

/** Yaw-restoring moment magnitude (positive = restores nose toward airflow). */
export function computeYawRestoringMoment({
  sideslipRad,
  speed,
  cyYaw = 0.1,
}: YawRestoringInput): number {
  const s = Math.max(-1, Math.min(1, Math.sin(sideslipRad)));
  return -cyYaw * speed * speed * s;
}

// ---------------------------------------------------------------------------
// M8: Slipstream / Wake Field
// ---------------------------------------------------------------------------

export interface WakeEffectInput {
  /** Lead car world position (m). */
  leadCarPos: { x: number; y: number; z: number };
  /** Lead car world velocity (m/s). */
  leadCarVel: { x: number; y: number; z: number };
  /** Follower car world position (m). */
  followerPos: { x: number; y: number; z: number };
  /** Maximum wake length behind the lead car (m). */
  wakeLengthM: number;
  /** Maximum lateral wake half-width (m). */
  wakeWidthM: number;
  /** Maximum drag reduction as a fraction, e.g. 0.25 = 25 % reduction. */
  wakeReductionPct: number;
}

export interface WakeEffectResult {
  /** Drag reduction factor [0, wakeReductionPct]. 0 = no reduction. */
  wakeReduction: number;
}

/**
 * Compute aerodynamic drag reduction when a follower car sits in the wake
 * of a lead car.
 *
 * The reduction scales with:
 *   - longitudinal distance (full at bumper, zero at wakeLengthM)
 *   - lateral offset      (full on centreline, zero at wakeWidthM)
 *
 * Both cars must be moving for a wake to exist. The follower must be behind
 * the lead car (projected onto the lead velocity direction).
 */
export function computeWakeEffect(input: WakeEffectInput): WakeEffectResult {
  const {
    leadCarPos,
    leadCarVel,
    followerPos,
    wakeLengthM,
    wakeWidthM,
    wakeReductionPct,
  } = input;

  // Clamp to defensive range [0, 1] to guard against mis-authored presets.
  const safeWakeReductionPct = Math.min(1, Math.max(0, wakeReductionPct));

  if (
    !Number.isFinite(wakeLengthM) || wakeLengthM <= 0 ||
    !Number.isFinite(wakeWidthM) || wakeWidthM <= 0 ||
    !Number.isFinite(wakeReductionPct) || wakeReductionPct <= 0
  ) {
    return { wakeReduction: 0 };
  }

  const leadSpeed = Math.hypot(leadCarVel.x, leadCarVel.y, leadCarVel.z);
  if (leadSpeed < 1e-3) {
    return { wakeReduction: 0 };
  }

  const dx = followerPos.x - leadCarPos.x;
  const dy = followerPos.y - leadCarPos.y;
  const dz = followerPos.z - leadCarPos.z;

  const lx = leadCarVel.x / leadSpeed;
  const ly = leadCarVel.y / leadSpeed;
  const lz = leadCarVel.z / leadSpeed;

  // Positive = follower is ahead of the lead car.
  const longitudinal = dx * lx + dy * ly + dz * lz;
  if (longitudinal >= 0) {
    return { wakeReduction: 0 };
  }

  const distBehind = -longitudinal;
  if (distBehind > wakeLengthM) {
    return { wakeReduction: 0 };
  }

  // Perpendicular (lateral) component magnitude.
  const perpX = dx - longitudinal * lx;
  const perpY = dy - longitudinal * ly;
  const perpZ = dz - longitudinal * lz;
  const lateralDist = Math.hypot(perpX, perpY, perpZ);

  if (lateralDist > wakeWidthM) {
    return { wakeReduction: 0 };
  }

  const longFactor = 1 - distBehind / wakeLengthM;
  const latFactor = 1 - lateralDist / wakeWidthM;
  const factor = longFactor * latFactor;

  return { wakeReduction: safeWakeReductionPct * factor };
}
