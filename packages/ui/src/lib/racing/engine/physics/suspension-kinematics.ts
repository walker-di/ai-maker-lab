/**
 * Travel-dependent suspension kinematics.
 *
 * Replaces flat (constant) geometry coefficients with piecewise-linear
 * lookup tables that encode how toe, camber, caster, and roll-center height
 * change as the wheel travels through its suspension stroke.
 *
 * All tables are `[travel_m, value]` pairs, sorted by ascending travel.
 * `travel = 0` is the static design position; negative values are droop
 * (extension), positive values are compression (bump).
 *
 * A vehicle preset that omits these tables gets the same constant-geometry
 * behaviour as M0/M1/M2, because every helper falls back to returning the
 * static setup value when no table is provided.
 *
 * Units:
 *  - travel:      metres (positive = compression)
 *  - toe:         degrees (positive = toe-in)
 *  - camber:      degrees (positive = top-out / negative camber when negative)
 *  - caster:      degrees
 *  - rollCenter:  metres above contact-patch ground plane
 */

/** A single `[travel_m, value]` table entry. */
export type KinematicPoint = readonly [number, number];

/** A complete kinematic table, sorted by travel ascending. */
export type KinematicTable = ReadonlyArray<KinematicPoint>;

/**
 * Piecewise-linear interpolation into a sorted `KinematicTable`.
 * Extrapolates the nearest segment beyond the table bounds.
 */
export function interpolateKinematic(table: KinematicTable, travel: number): number {
  if (table.length === 0) return 0;
  if (table.length === 1) return table[0][1];

  // Below the lowest entry — extrapolate off the first segment.
  if (travel <= table[0][0]) {
    const [t0, v0] = table[0];
    const [t1, v1] = table[1];
    const dt = t1 - t0;
    if (Math.abs(dt) < 1e-10) return v0;
    return v0 + ((travel - t0) / dt) * (v1 - v0);
  }

  // Above the highest entry — extrapolate off the last segment.
  const last = table[table.length - 1];
  const secondLast = table[table.length - 2];
  if (travel >= last[0]) {
    const [t0, v0] = secondLast;
    const [t1, v1] = last;
    const dt = t1 - t0;
    if (Math.abs(dt) < 1e-10) return v1;
    return v0 + ((travel - t0) / dt) * (v1 - v0);
  }

  // Find the bracketing pair.
  for (let i = 0; i < table.length - 1; i++) {
    const [t0, v0] = table[i];
    const [t1, v1] = table[i + 1];
    if (travel >= t0 && travel <= t1) {
      const dt = t1 - t0;
      if (Math.abs(dt) < 1e-10) return v0;
      return v0 + ((travel - t0) / dt) * (v1 - v0);
    }
  }

  return table[table.length - 1][1];
}

// ---------------------------------------------------------------------------
// Bump-steer (travel-dependent toe)
// ---------------------------------------------------------------------------

export interface BumpSteerInput {
  /** Static toe setting from setup (degrees). */
  staticToeDeg: number;
  /** Suspension travel this step (m, positive = compression). */
  travel: number;
  /**
   * Lookup table for toe-change as a function of travel (degrees relative to
   * the design-position toe). When `undefined` the function returns
   * `staticToeDeg` unchanged.
   */
  bumpSteerTable: KinematicTable | undefined;
  /** +1 for chassis-right wheel, -1 for chassis-left. */
  lateralSign: 1 | -1;
}

/**
 * Resolve the travel-dependent toe angle for a single wheel.
 * Returns the total toe in degrees (setup static + bump-steer delta).
 * The returned value carries the correct sign for the wheel's chassis side.
 */
export function computeBumpSteerToe(input: BumpSteerInput): number {
  if (!input.bumpSteerTable || input.bumpSteerTable.length === 0) {
    return input.staticToeDeg;
  }
  const delta = interpolateKinematic(input.bumpSteerTable, input.travel);
  // Bump-steer deltas are defined as per-side toe change; mirror across the
  // chassis centreline so both wheels toe consistently (positive table entry
  // = toe-in on both sides under compression).
  return input.staticToeDeg + input.lateralSign * delta;
}

// ---------------------------------------------------------------------------
// Camber-vs-travel
// ---------------------------------------------------------------------------

export interface CamberVsTravelInput {
  /** Static camber setting (degrees). */
  staticCamberDeg: number;
  /** Suspension travel (m, positive = compression). */
  travel: number;
  /**
   * Lookup table for camber gain vs travel (degrees/m of travel, i.e. the
   * table stores Δcamber_deg per metre). When `undefined` the static value
   * is returned unchanged.
   */
  camberTable: KinematicTable | undefined;
}

/**
 * Resolve the travel-dependent camber angle (degrees).
 * The table stores camber in degrees at each travel point (NOT a rate).
 * Returns the total effective camber.
 */
export function computeCamberVsTravel(input: CamberVsTravelInput): number {
  if (!input.camberTable || input.camberTable.length === 0) {
    return input.staticCamberDeg;
  }
  const delta = interpolateKinematic(input.camberTable, input.travel);
  return input.staticCamberDeg + delta;
}

// ---------------------------------------------------------------------------
// Caster-vs-travel
// ---------------------------------------------------------------------------

export interface CasterVsTravelInput {
  /** Static caster setting from setup (degrees). */
  staticCasterDeg: number;
  /** Suspension travel (m, positive = compression). */
  travel: number;
  /**
   * Lookup table for caster change vs travel (degrees delta from static).
   * When `undefined` the static caster is returned unchanged.
   */
  casterTable: KinematicTable | undefined;
}

/**
 * Resolve the travel-dependent caster angle (degrees).
 * Returns the total effective caster.
 */
export function computeCasterVsTravel(input: CasterVsTravelInput): number {
  if (!input.casterTable || input.casterTable.length === 0) {
    return input.staticCasterDeg;
  }
  const delta = interpolateKinematic(input.casterTable, input.travel);
  return input.staticCasterDeg + delta;
}

// ---------------------------------------------------------------------------
// Roll-center height vs travel (jacking force)
// ---------------------------------------------------------------------------

export interface RollCenterInput {
  /**
   * Lookup table for roll-center height vs travel (metres above the contact-
   * patch plane). When `undefined` a default value of 0.06 m is used.
   */
  rollCenterTable: KinematicTable | undefined;
  /** Suspension travel (m, positive = compression). */
  travel: number;
}

/** Default roll-center height when no table is provided (m). */
export const DEFAULT_ROLL_CENTER_HEIGHT_M = 0.06;

/**
 * Resolve the instantaneous roll-center height (metres above contact-patch
 * plane). The value is consumed by the jacking-force calculation.
 */
export function computeRollCenterHeight(input: RollCenterInput): number {
  if (!input.rollCenterTable || input.rollCenterTable.length === 0) {
    return DEFAULT_ROLL_CENTER_HEIGHT_M;
  }
  return interpolateKinematic(input.rollCenterTable, input.travel);
}

// ---------------------------------------------------------------------------
// Jacking force (roll-center migration under lateral load)
// ---------------------------------------------------------------------------

export interface JackingForceInput {
  /**
   * Lateral tire force on this wheel (N). Positive = chassis-right.
   * The jacking force is proportional to the component of the tire force
   * that passes through the roll centre; the formula simplifies to
   * `Fy * rcHeight / trackHalf`.
   */
  fy: number;
  /** Roll-center height (m) from `computeRollCenterHeight`. */
  rollCenterHeightM: number;
  /** Half of the track width (m). Typically `trackWidth / 2`. */
  trackHalfM: number;
}

/**
 * Jacking vertical force contribution (N, positive = lifts chassis).
 *
 * A high roll-center directs the tire reaction through a short moment arm,
 * so more of the lateral force acts along the suspension link and creates an
 * upward jacking force on the chassis — the classic race-car handling
 * trade-off between jack and compliance.
 *
 * The sign convention is: positive `fy` on the outside wheel (positive
 * `lateralSign` during a left turn) produces a positive (upward) jacking
 * force on that corner.
 */
export function computeJackingForce(input: JackingForceInput): number {
  const arm = Math.max(0.01, input.trackHalfM);
  return input.fy * (input.rollCenterHeightM / arm);
}

// ---------------------------------------------------------------------------
// Progressive bump-stop with authored table
// ---------------------------------------------------------------------------

export interface ProgressiveBumpStopInput {
  /** Suspension compression (m). */
  compression: number;
  /**
   * Travel threshold at which the bump-stop begins to engage (m).
   * Usually matches `bumpStopGapFrontM` / `bumpStopGapRearM`.
   */
  threshold: number;
  /**
   * Base bump-stop rate at contact (N/m). Maps to the existing
   * `bumpStopRateFront` / `bumpStopRateRear` field.
   */
  baseRateNpm: number;
  /**
   * Optional authored progressive rate table. Entries are
   * `[over_m, rate_N/m]` where `over_m` is the penetration depth past the
   * threshold. When `undefined`, the legacy `computeBumpStopForce` behaviour
   * is preserved.
   */
  rateTable: KinematicTable | undefined;
}

/**
 * Progressive bump-stop force (N, positive resists further compression).
 *
 * Without a `rateTable` this matches `computeBumpStopForce` exactly
 * (continuous-rate elastomer model). With a table the rate is interpolated
 * from the authored curve, enabling multi-stage compound bump-stops common
 * on racing cars.
 */
export function computeProgressiveBumpStop(input: ProgressiveBumpStopInput): number {
  if (input.compression <= input.threshold || input.baseRateNpm <= 0) return 0;
  const over = input.compression - input.threshold;
  if (!input.rateTable || input.rateTable.length === 0) {
    // Legacy elastomer model: rate grows continuously with penetration.
    return input.baseRateNpm * over * (1 + over / 0.03);
  }
  // Authored progressive table: integrate rate over penetration by using the
  // average rate across the segment (trapezoidal-style).
  const rate = interpolateKinematic(input.rateTable, over);
  return rate * over;
}

// ---------------------------------------------------------------------------
// Complete per-wheel kinematic state resolved for one step
// ---------------------------------------------------------------------------

export interface WheelKinematicsInput {
  staticToeDeg: number;
  staticCamberDeg: number;
  staticCasterDeg: number;
  travel: number;
  lateralSign: 1 | -1;
  bumpSteerTable: KinematicTable | undefined;
  camberTable: KinematicTable | undefined;
  casterTable: KinematicTable | undefined;
  rollCenterTable: KinematicTable | undefined;
}

export interface WheelKinematicsResult {
  toeDeg: number;
  camberDeg: number;
  casterDeg: number;
  rollCenterHeightM: number;
}

/**
 * Resolve all travel-dependent kinematic angles for a single wheel in one
 * call. This is the primary entry point used by `RacingEngine.ts`.
 */
export function resolveWheelKinematics(input: WheelKinematicsInput): WheelKinematicsResult {
  return {
    toeDeg: computeBumpSteerToe({
      staticToeDeg: input.staticToeDeg,
      travel: input.travel,
      bumpSteerTable: input.bumpSteerTable,
      lateralSign: input.lateralSign,
    }),
    camberDeg: computeCamberVsTravel({
      staticCamberDeg: input.staticCamberDeg,
      travel: input.travel,
      camberTable: input.camberTable,
    }),
    casterDeg: computeCasterVsTravel({
      staticCasterDeg: input.staticCasterDeg,
      travel: input.travel,
      casterTable: input.casterTable,
    }),
    rollCenterHeightM: computeRollCenterHeight({
      rollCenterTable: input.rollCenterTable,
      travel: input.travel,
    }),
  };
}
