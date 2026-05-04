/**
 * Rigid-body load-transfer helpers. These translate chassis acceleration and
 * inertial mass distribution into per-axle vertical-load shifts that are
 * applied to per-wheel `Fz` BEFORE Pacejka. Keeping them as pure helpers makes
 * sign and magnitude behaviour easy to test in isolation.
 *
 * Longitudinal transfer was previously colocated with `tire-load.ts`; it now
 * lives here so all four wheels' `Fz` shifts come from one module. The public
 * export name is preserved through `physics/index.ts` so existing consumers
 * are unaffected.
 *
 * Lateral transfer follows the standard rigid-body decomposition:
 *
 *   - The sprung mass acts on the chassis at the sprung CG height, and is
 *     divided between front and rear axles by the FRONT ROLL STIFFNESS SHARE
 *     (springs + ARB at each axle, scaled by motion ratio squared and track
 *     width squared). This is the "stiffer front bar = more understeer" lever
 *     top sims expose.
 *   - The unsprung mass acts at each axle individually at the unsprung CG
 *     height (~ wheel-centre). Its transfer stays on its own axle and does
 *     not redistribute through the chassis.
 *
 * Returned deltas are signed left-to-right axle differentials in newtons:
 * positive means load shifts FROM the left wheels TO the right wheels.
 * Wheels apply them as `lateralSign * axleDelta * 0.5` (FL/RL = -1, FR/RR =
 * +1 in our wheel layout) so symmetry is preserved exactly.
 */

export interface LongitudinalLoadTransferInput {
  /** Chassis longitudinal acceleration (m/s², positive = forward). */
  longitudinalAccelMs2: number;
  /** Total chassis mass (kg). */
  massKg: number;
  /** Centre-of-gravity height above the contact patches (m). */
  cgHeightM: number;
  /** Wheelbase (m). Front-rear distance between contact patches. */
  wheelbaseM: number;
}

/**
 * Longitudinal load transfer from front to rear axle under forward
 * acceleration. The classical rigid-body result `m · a · h / L` shifts a
 * vertical load FROM the front axle TO the rear axle when the chassis
 * accelerates forward, and FROM rear TO front when it decelerates.
 *
 * Returns the magnitude shifted to the rear axle (positive under power,
 * negative under braking). Symmetric across the two wheels on each axle —
 * lateral transfer is handled separately by the lateral helper below.
 *
 * This term is what creates the "rear bites harder when you open the
 * throttle" feel during a slide. Without it, tire normal load only updates
 * through the suspension-compression raycast, which lags by a frame or two
 * and underweights acceleration-driven grip changes the driver expects.
 */
export function computeLongitudinalLoadTransfer(input: LongitudinalLoadTransferInput): number {
  if (input.wheelbaseM <= 0) return 0;
  return (input.massKg * input.longitudinalAccelMs2 * input.cgHeightM) / input.wheelbaseM;
}

export interface LateralLoadTransferInput {
  /**
   * Chassis lateral acceleration (m/s²). Sign follows the engine's existing
   * convention: positive = chassis accelerating to its right (right turn),
   * negative = chassis accelerating to its left (left turn).
   */
  accelLatMs2: number;
  /** Total sprung mass (kg). Derived in the engine as chassis - unsprung. */
  sprungMassKg: number;
  /** Total unsprung mass on the front axle (kg). Wheels + hubs + brakes. */
  unsprungMassKgFront: number;
  /** Total unsprung mass on the rear axle (kg). */
  unsprungMassKgRear: number;
  /** Sprung CG height above the contact patches (m). */
  sprungCgHeightM: number;
  /** Unsprung CG height above the contact patches (m), ~ wheel centre. */
  unsprungCgHeightM: number;
  /** Track width (m). Left-to-right distance between contact patches. */
  trackWidthM: number;
  /**
   * Front roll stiffness share `[0, 1]`. Determines how the SPRUNG-mass
   * lateral transfer is split between front and rear axles. The unsprung
   * contributions stay on their own axle independently of this split.
   */
  frontRollStiffnessShare: number;
}

export interface LateralLoadTransferResult {
  /**
   * Signed left-to-right load differential at the front axle (newtons).
   * Positive means load shifts from the left front wheel to the right
   * front wheel.
   */
  frontDelta: number;
  /** Signed left-to-right load differential at the rear axle (newtons). */
  rearDelta: number;
}

/**
 * Lateral load transfer with a sprung/unsprung split.
 *
 * The leading negative sign on each term aligns with the engine's existing
 * accelLatG telemetry: a left turn currently reports `accelLatG < 0` and the
 * right-side wheels are outside, so the returned delta must be positive.
 * (i.e. `delta = -m · a · h / track`, then load shifts to the chassis-right
 * wheels for `a < 0`.)
 */
export function computeLateralLoadTransfer(input: LateralLoadTransferInput): LateralLoadTransferResult {
  if (input.trackWidthM <= 0) return { frontDelta: 0, rearDelta: 0 };
  if (input.accelLatMs2 === 0) return { frontDelta: 0, rearDelta: 0 };

  const sprungTotal = -(input.sprungMassKg * input.accelLatMs2 * input.sprungCgHeightM) / input.trackWidthM;
  const frontShare = input.frontRollStiffnessShare;
  const rearShare = 1 - frontShare;
  const frontSprung = sprungTotal * frontShare;
  const rearSprung = sprungTotal * rearShare;

  const frontUnsprung = -(input.unsprungMassKgFront * input.accelLatMs2 * input.unsprungCgHeightM) / input.trackWidthM;
  const rearUnsprung = -(input.unsprungMassKgRear * input.accelLatMs2 * input.unsprungCgHeightM) / input.trackWidthM;

  return {
    frontDelta: frontSprung + frontUnsprung,
    rearDelta: rearSprung + rearUnsprung,
  };
}

export interface FrontRollStiffnessShareInput {
  springFrontNpm: number;
  springRearNpm: number;
  arbFrontNpm: number;
  arbRearNpm: number;
  motionRatioFront: number;
  motionRatioRear: number;
  trackWidthM: number;
}

const ROLL_STIFFNESS_CLAMP_LO = 0.05;
const ROLL_STIFFNESS_CLAMP_HI = 0.95;

/**
 * Roll stiffness share at the FRONT axle, in `[0.05, 0.95]`. Each axle's
 * roll stiffness is `(spring + arb) * motionRatio² * trackWidth² / 2`. Higher
 * front share means the front axle absorbs more of the sprung-mass lateral
 * load transfer, which through tire load sensitivity reduces front grip and
 * pushes the balance toward understeer.
 *
 * Returns NaN when the geometry/stiffness inputs are invalid; callers should
 * treat NaN as "no preset data, fall back to static front-mass percentage".
 */
export function computeFrontRollStiffnessShare(input: FrontRollStiffnessShareInput): number {
  const { trackWidthM } = input;
  if (!(trackWidthM > 0)) return Number.NaN;
  const mrFrontSq = input.motionRatioFront * input.motionRatioFront;
  const mrRearSq = input.motionRatioRear * input.motionRatioRear;
  const trackSq = trackWidthM * trackWidthM;
  const frontWheelRate = input.springFrontNpm * mrFrontSq;
  const rearWheelRate = input.springRearNpm * mrRearSq;
  const frontArbRate = input.arbFrontNpm * mrFrontSq;
  const rearArbRate = input.arbRearNpm * mrRearSq;
  const frontRoll = (frontWheelRate + frontArbRate) * trackSq * 0.5;
  const rearRoll = (rearWheelRate + rearArbRate) * trackSq * 0.5;
  const total = frontRoll + rearRoll;
  if (!(total > 0)) return Number.NaN;
  const share = frontRoll / total;
  if (share < ROLL_STIFFNESS_CLAMP_LO) return ROLL_STIFFNESS_CLAMP_LO;
  if (share > ROLL_STIFFNESS_CLAMP_HI) return ROLL_STIFFNESS_CLAMP_HI;
  return share;
}
