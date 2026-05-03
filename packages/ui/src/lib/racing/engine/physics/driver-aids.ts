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
}

export interface TcResult {
  /** Throttle cut fraction in [0, 0.88]. */
  cut: number;
  driveSlip: number;
}

export function computeTcCut(input: TcInput): TcResult {
  const driveSlip = input.maxDriveSlip;
  if (!input.enabled || input.driverThrottle <= 0.05 || input.speedKmh <= 8) {
    return { cut: 0, driveSlip };
  }
  if (driveSlip <= input.threshold) return { cut: 0, driveSlip };
  const cut = Math.max(
    0,
    Math.min(0.88, (driveSlip - input.threshold) / Math.max(0.001, input.window)),
  );
  return { cut, driveSlip };
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
  /** Brake-bias side ('inner' = front-inside or rear-inside). */
  axle: 'front' | 'rear' | null;
  yawError: number;
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
