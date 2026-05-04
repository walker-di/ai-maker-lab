/**
 * Driver aids: ABS, TC, and ESC. Each is a pure modifier that returns the
 * adjustment to apply to the relevant torque or release timer. The
 * orchestrator threads the aid state through per-substep so the aids can
 * make per-wheel decisions while keeping the integration deterministic.
 */

export interface AbsInput {
  enabled: boolean;
  driverBrake: number;
  /** Forward speed at the contact patch (m/s, signed). */
  vx: number;
  slipRatio: number;
  threshold: number;
  /** Current release timer (s); decremented each step. */
  release: number;
  releaseTime: number;
  dt: number;
}

export interface AbsResult {
  release: number;
  active: boolean;
  /** Multiply the brake torque by this (1 = no cut, less = ABS releasing). */
  scale: number;
}

export function applyAbs({
  enabled,
  driverBrake,
  vx,
  slipRatio,
  threshold,
  release,
  releaseTime,
  dt,
}: AbsInput, releaseScale = 0.2): AbsResult {
  let nextRelease = release;
  if (enabled && driverBrake > 0.05 && Math.abs(vx) > 4 && slipRatio < -threshold) {
    nextRelease = Math.max(release, releaseTime);
  } else {
    nextRelease = Math.max(0, release - dt);
  }
  const scale = nextRelease > 0 ? releaseScale : 1;
  return { release: nextRelease, active: scale < 1, scale };
}

export interface TcInput {
  enabled: boolean;
  driverThrottle: number;
  speedKmh: number;
  /** Maximum slip ratio across driven wheels. */
  maxDriveSlip: number;
  threshold: number;
  window: number;
  /** Optional sideslip magnitude (deg). Large sideslip means the driver is
   *  intentionally drifting; TC authority backs off so opening the throttle
   *  in a deliberate slide still produces forward bite. Defaults to 0. */
  sideslipDeg?: number;
}

export interface TcResult {
  /** Throttle cut fraction in [0, 0.88]. */
  cut: number;
  driveSlip: number;
}

const TC_DRIFT_ENGAGE_DEG = 10;
const TC_DRIFT_FULL_BACKOFF_DEG = 25;
const TC_DRIFT_FLOOR = 0.2;

export function computeTcCut(input: TcInput): TcResult {
  const driveSlip = input.maxDriveSlip;
  if (!input.enabled || input.driverThrottle <= 0.05 || input.speedKmh <= 8) {
    return { cut: 0, driveSlip };
  }
  if (driveSlip <= input.threshold) return { cut: 0, driveSlip };
  const baseCut = Math.max(
    0,
    Math.min(0.88, (driveSlip - input.threshold) / Math.max(0.001, input.window)),
  );
  // During a deliberate slide (high sideslip), reduce TC authority so the
  // driver can hold a power slide on throttle. Full authority below
  // `TC_DRIFT_ENGAGE_DEG`; floors at `TC_DRIFT_FLOOR` past
  // `TC_DRIFT_FULL_BACKOFF_DEG`.
  const sideslipMag = Math.abs(input.sideslipDeg ?? 0);
  let driftScale = 1;
  if (sideslipMag > TC_DRIFT_ENGAGE_DEG) {
    const t = (sideslipMag - TC_DRIFT_ENGAGE_DEG) /
      Math.max(0.001, TC_DRIFT_FULL_BACKOFF_DEG - TC_DRIFT_ENGAGE_DEG);
    driftScale = Math.max(TC_DRIFT_FLOOR, 1 - t * (1 - TC_DRIFT_FLOOR));
  }
  return { cut: baseCut * driftScale, driveSlip };
}

export type EscMode = 'oversteer' | 'understeer' | 'stable';

export interface EscInput {
  enabled: boolean;
  speedKmh: number;
  steerSmoothed: number;
  /** Local-axis longitudinal velocity magnitude (m/s). */
  absLocalVz: number;
  yawRateRad: number;
  desiredYawRad: number;
  sideslipDeg: number;
  oversteerThreshold: number;
  understeerThreshold: number;
  minSpeedKmh: number;
}

export interface EscResult {
  active: boolean;
  mode: EscMode;
  /** Sign of the requested yaw correction. */
  turnSign: 1 | -1 | 0;
  /** Front axle for oversteer correction, rear axle for understeer correction. */
  axle: 'front' | 'rear' | null;
  yawError: number;
}

export interface EscBrakeTargetsInput {
  esc: EscResult;
  maxBrakeTorque: number;
}

export interface EscBrakeTargetsResult {
  torqueByWheel: [number, number, number, number];
  targetWheel: 0 | 1 | 2 | 3 | null;
}

export function classifyEsc(input: EscInput): EscResult {
  if (!input.enabled || input.speedKmh <= input.minSpeedKmh || Math.abs(input.steerSmoothed) <= 0.05 || input.absLocalVz <= 4) {
    return { active: false, mode: 'stable', turnSign: 0, axle: null, yawError: 0 };
  }
  const yawErr = input.yawRateRad - input.desiredYawRad;
  const turnSign = (Math.sign(input.desiredYawRad || input.steerSmoothed || input.yawRateRad) || 0) as 1 | -1 | 0;
  if (turnSign === 0) {
    return { active: false, mode: 'stable', turnSign, axle: null, yawError: yawErr };
  }
  const sameDir = Math.sign(yawErr) === turnSign;
  const errMag = Math.abs(yawErr);
  const slipMag = Math.abs(input.sideslipDeg);
  if (sameDir && errMag > input.oversteerThreshold && slipMag > 7) {
    return { active: true, mode: 'oversteer', turnSign, axle: 'front', yawError: yawErr };
  }
  if (!sameDir && errMag > input.understeerThreshold && Math.abs(input.steerSmoothed) > 0.2 && slipMag < 10) {
    return { active: true, mode: 'understeer', turnSign, axle: 'rear', yawError: yawErr };
  }
  return { active: false, mode: 'stable', turnSign, axle: null, yawError: yawErr };
}

/**
 * Map the ESC classification onto a single-wheel corrective brake target.
 * Wheel indices are `[FL, FR, RL, RR]`.
 * Oversteer gets the outside-front wheel; understeer gets the inside-rear.
 */
export function computeEscBrakeTargets(input: EscBrakeTargetsInput): EscBrakeTargetsResult {
  const torqueByWheel: [number, number, number, number] = [0, 0, 0, 0];
  if (!input.esc.active || input.esc.turnSign === 0) {
    return { torqueByWheel, targetWheel: null };
  }

  let targetWheel: 0 | 1 | 2 | 3 | null = null;
  if (input.esc.mode === 'oversteer') {
    targetWheel = input.esc.turnSign > 0 ? 1 : 0;
  } else if (input.esc.mode === 'understeer') {
    targetWheel = input.esc.turnSign > 0 ? 2 : 3;
  }
  if (targetWheel == null) {
    return { torqueByWheel, targetWheel };
  }

  const authority = Math.max(0.18, Math.min(1, Math.abs(input.esc.yawError) / 0.8));
  torqueByWheel[targetWheel] = input.maxBrakeTorque * authority;
  return { torqueByWheel, targetWheel };
}
