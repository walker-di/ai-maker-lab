/**
 * Drivetrain solver: rotational dynamics of the entire chain
 * (engine + clutch + gearbox + propshaft + diff + driven wheels) with a
 * Karnopp stick-slip clutch and Salisbury-style limited-slip differential.
 *
 * The orchestrator (`RacingEngine`) computes wheel external torques (tire
 * reaction + brake + handbrake + ESC) for the outer step, then hands them
 * here. Tire/external forces are explicit; the rotational chain integrates
 * with internal substeps so the engine catches the wheels in one outer step.
 *
 * Frame conventions:
 *
 *   - All omegas are rad/s in the same sign convention. Engine and
 *     transmission share the engine-side frame (locked clutch ⇒ same omega).
 *   - For a forward gear (`gearRatio > 0`), positive engine omega drives
 *     positive wheel rotation. For reverse (`gearRatio < 0`), positive
 *     engine omega drives negative wheel rotation; signs propagate through
 *     `overallRatio = gearRatio * finalDrive` automatically.
 *
 * Inertia reflection:
 *
 *   - Engine side `Je = engineInertia + flywheelInertia`.
 *   - Input shaft side aggregates the gearbox input plus everything past the
 *     clutch reflected to input-shaft coordinates. Propshaft is on the
 *     output side of the gearbox so it scales by `1 / gearRatio²`. The diff
 *     carrier and driven wheels are past the final drive so they scale by
 *     `1 / overallRatio²`.
 *   - In neutral the wheel chain is decoupled, so only the gearbox input
 *     inertia couples to the clutch.
 *
 * Karnopp clutch:
 *
 *   - Stick attempt: solve the engine + input shaft system as a rigid body,
 *     compute the constraint torque required to keep them locked, accept if
 *     `|Treq| <= clutchMaxTorqueNm * clutchStaticFactor`, both omegas land
 *     within `[idleOmega, redlineOmega]`, and `|slip| <=
 *     clutchStickThresholdRadPerSec`.
 *   - Slip mode: kinetic friction `clutchMaxTorqueNm * sign(slip)`. Engine
 *     and input shaft integrate independently; the engine clamp catches
 *     idle / redline.
 */

import type { DiffType } from '../../types.js';
export type { DiffType };

const DRIVE_EFFICIENCY = 0.93;
const EPS = 1e-9;

export type ClutchMode = 'locked' | 'slipping';
export type AxleSide = 'left' | 'right';
export type AxlePosition = 'front' | 'rear';

export interface DrivetrainParams {
  engineInertia: number;
  flywheelInertia: number;
  gearboxInputInertia: number;
  propshaftInertia: number;
  diffInertia: number;
  clutchMaxTorqueNm: number;
  clutchStaticFactor: number;
  clutchStickThresholdRadPerSec: number;
  drivetrainSubsteps: number;
  diffType: DiffType;
  diffPreloadNm: number;
  diffCapacityNm: number;
  diffPowerRamp: number;
  diffCoastRamp: number;
  idleOmega: number;
  redlineOmega: number;
}

export interface DrivetrainWheelInput {
  index: number;
  omega: number;
  inertia: number;
  /** Fraction of total drive torque routed to this wheel. Driven wheels
   *  have `driveShare > 0`; non-driven wheels have `0`. */
  driveShare: number;
  axle: AxlePosition;
  side: AxleSide;
  /** External rotational torque this outer step (Nm). Tire reaction +
   *  brake + handbrake + ESC, applied independently by the orchestrator. */
  externalTorqueNm: number;
}

export interface DrivetrainStepInput {
  engineOmega: number;
  /** Input-shaft omega; only meaningful when in neutral, otherwise the
   *  solver derives it from the driven wheel average each substep. */
  transmissionOmega: number;
  wheels: ReadonlyArray<DrivetrainWheelInput>;
  gearRatio: number;
  finalDrive: number;
  engineDriveTorqueNm: number;
  /** Magnitude of engine pumping + friction drag (Nm). Sign is applied
   *  internally via `sign(engineOmega)`. */
  engineDragTorqueNm: number;
  params: DrivetrainParams;
  dt: number;
}

export interface DrivetrainStepResult {
  engineOmega: number;
  transmissionOmega: number;
  wheelOmegas: number[];
  /** Diagnostic per-wheel drive torque after gear+final drive+efficiency. */
  driveTorqueByWheel: number[];
  clutchTorqueNm: number;
  clutchSlipRadPerSec: number;
  clutchMode: ClutchMode;
}

export interface SalisburyDiffInput {
  leftOmega: number;
  rightOmega: number;
  leftInertia: number;
  rightInertia: number;
  /** Signed drive torque routed to this axle (Nm). Sign tells power vs coast. */
  driveTorqueAxleNm: number;
  diffType: DiffType;
  preloadNm: number;
  capacityNm: number;
  powerRamp: number;
  coastRamp: number;
  dt: number;
}

export interface SalisburyDiffResult {
  leftOmega: number;
  rightOmega: number;
  /** Lock torque actually applied (Nm), capped at the lock limit. */
  lockTorqueNm: number;
}

/**
 * Apply per-axle differential coupling to two wheels for one substep.
 *
 *   - `welded`: rigid axle, both wheels equalize while preserving angular
 *     momentum (`(JL·ωL + JR·ωR) / (JL+JR)`).
 *   - `open`: no coupling.
 *   - `clutchLSD`: Salisbury ramp model. The lock-torque limit is
 *     `min(capacity, preload + ramp · |drive|)` where `ramp` selects the
 *     power ramp on positive drive and the coast ramp on negative drive.
 *     The applied torque is capped at the equalizing impulse so we never
 *     reverse the relative-omega sign in one substep.
 */
export function applySalisburyDiff(input: SalisburyDiffInput): SalisburyDiffResult {
  const { leftOmega, rightOmega, leftInertia, rightInertia, dt } = input;
  const JL = Math.max(EPS, leftInertia);
  const JR = Math.max(EPS, rightInertia);
  if (input.diffType === 'welded') {
    const Lavg = (JL * leftOmega + JR * rightOmega) / (JL + JR);
    return { leftOmega: Lavg, rightOmega: Lavg, lockTorqueNm: Number.POSITIVE_INFINITY };
  }
  if (input.diffType === 'open') {
    return { leftOmega, rightOmega, lockTorqueNm: 0 };
  }
  // clutchLSD
  const isPower = input.driveTorqueAxleNm >= 0;
  const ramp = isPower ? input.powerRamp : input.coastRamp;
  const lockLimit = Math.min(
    input.capacityNm,
    input.preloadNm + ramp * Math.abs(input.driveTorqueAxleNm),
  );
  const omegaDiff = leftOmega - rightOmega;
  if (lockLimit <= 0 || Math.abs(omegaDiff) < EPS) {
    return { leftOmega, rightOmega, lockTorqueNm: 0 };
  }
  const sgnDiff = omegaDiff >= 0 ? 1 : -1;
  const Jrel = (JL * JR) / (JL + JR);
  const tEq = (Jrel * Math.abs(omegaDiff)) / Math.max(dt, EPS);
  const tApplied = Math.min(tEq, lockLimit);
  const dL = -(tApplied / JL) * dt * sgnDiff;
  const dR = +(tApplied / JR) * dt * sgnDiff;
  return {
    leftOmega: leftOmega + dL,
    rightOmega: rightOmega + dR,
    lockTorqueNm: tApplied,
  };
}

/**
 * Step the drivetrain by `dt` seconds using `params.drivetrainSubsteps`
 * internal substeps. Tire/brake/external wheel torques are explicit
 * (passed in `wheels[i].externalTorqueNm`); the rotational chain is
 * integrated implicitly via the substepped Karnopp clutch.
 */
export function stepDrivetrain(input: DrivetrainStepInput): DrivetrainStepResult {
  const { params, gearRatio, finalDrive, dt, engineDriveTorqueNm, engineDragTorqueNm } = input;
  const substeps = Math.max(1, Math.floor(params.drivetrainSubsteps));
  const dtSub = dt / substeps;
  const overallRatio = gearRatio * finalDrive;
  const inGear = gearRatio !== 0;

  const Je = Math.max(EPS, params.engineInertia + params.flywheelInertia);
  const Jg = Math.max(EPS, params.gearboxInputInertia);

  const wheelCount = input.wheels.length;
  const omegasW = new Array<number>(wheelCount);
  const driveTorqueByWheel = new Array<number>(wheelCount).fill(0);
  for (let i = 0; i < wheelCount; i++) omegasW[i] = input.wheels[i].omega;

  // Find driven wheels and compute reflected wheel inertia.
  const drivenIdx: number[] = [];
  let sumDrivenInertia = 0;
  let sumDriveShare = 0;
  for (let i = 0; i < wheelCount; i++) {
    const w = input.wheels[i];
    if (w.driveShare > 0) {
      drivenIdx.push(i);
      sumDrivenInertia += w.inertia;
      sumDriveShare += w.driveShare;
    }
  }
  const nDriven = drivenIdx.length;

  let JiCoupled = Jg;
  if (inGear && nDriven > 0) {
    const gearRatioSq = Math.max(EPS, gearRatio * gearRatio);
    const overallRatioSq = Math.max(EPS, overallRatio * overallRatio);
    JiCoupled += params.propshaftInertia / gearRatioSq;
    JiCoupled += params.diffInertia / overallRatioSq;
    JiCoupled += sumDrivenInertia / overallRatioSq;
  }

  let omegaE = input.engineOmega;
  // For neutral the input shaft has its own state. In gear we recompute it
  // from the driven wheel average each substep so the kinematic constraint
  // (input ↔ wheels through the gearbox + final drive) holds exactly.
  let omegaIneutral = input.transmissionOmega;

  let lastClutchTorque = 0;
  let lastClutchMode: ClutchMode = 'slipping';

  for (let s = 0; s < substeps; s++) {
    // 1) Current input-shaft omega
    let avgBefore = 0;
    if (inGear && nDriven > 0) {
      for (const i of drivenIdx) avgBefore += omegasW[i];
      avgBefore /= nDriven;
    }
    const omegaI = inGear && nDriven > 0 ? avgBefore * overallRatio : omegaIneutral;

    // 2) Engine drag direction; engine net torque excluding clutch
    const dragSign = Math.sign(omegaE) || 1;
    const engineNet = engineDriveTorqueNm - dragSign * engineDragTorqueNm;

    // 3) External wheel torque reflected at the input shaft
    let tInputFromWheels = 0;
    if (inGear && nDriven > 0) {
      let sumExt = 0;
      for (const i of drivenIdx) sumExt += input.wheels[i].externalTorqueNm;
      tInputFromWheels = sumExt / overallRatio;
    }

    // 4) Karnopp clutch: try lock, fall back to kinetic slip.
    const slip = omegaE - omegaI;
    const Ji = inGear && nDriven > 0 ? JiCoupled : Jg;
    const Jcombined = Je + Ji;
    const totalTorque = engineNet + tInputFromWheels;
    const alphaCombined = totalTorque / Jcombined;
    const clutchReq = engineNet - Je * alphaCombined;
    const inStick = Math.abs(slip) <= params.clutchStickThresholdRadPerSec;
    const canHold = Math.abs(clutchReq) <= params.clutchMaxTorqueNm * params.clutchStaticFactor;
    // If lock would push the engine through the idle/redline clamp the
    // constraint is unphysical (we'd snap the input shaft to a clamped
    // engine speed), so demote to kinetic slip in that case.
    const omegaELocked = omegaE + alphaCombined * dtSub;
    const lockClamps =
      omegaELocked < params.idleOmega - EPS || omegaELocked > params.redlineOmega + EPS;

    let clutchTorque: number;
    let clutchMode: ClutchMode;
    let alphaE: number;
    let alphaI: number;

    if (inStick && canHold && !lockClamps) {
      clutchTorque = clutchReq;
      clutchMode = 'locked';
      alphaE = alphaCombined;
      alphaI = alphaCombined;
    } else {
      // `Math.sign(0)` returns 0; clutch produces no torque at exactly
      // zero slip in slip mode (falls through to engine clamp / external).
      clutchTorque = params.clutchMaxTorqueNm * Math.sign(slip);
      clutchMode = 'slipping';
      alphaE = (engineNet - clutchTorque) / Je;
      alphaI = (clutchTorque * DRIVE_EFFICIENCY + tInputFromWheels) / Ji;
    }

    omegaE += alphaE * dtSub;
    if (omegaE < params.idleOmega) omegaE = params.idleOmega;
    if (omegaE > params.redlineOmega) omegaE = params.redlineOmega;

    // 5) Update each wheel from its external torque.
    for (let i = 0; i < wheelCount; i++) {
      const w = input.wheels[i];
      omegasW[i] += (w.externalTorqueNm / Math.max(EPS, w.inertia)) * dtSub;
    }

    // 6) Driven wheels: snap the avg to the post-substep input shaft. This
    // is the kinematic constraint that the gearbox + final drive imposes
    // when the clutch transmits torque. The wheel-vs-wheel (diff) motion
    // is preserved through the uniform shift.
    if (inGear && nDriven > 0) {
      const omegaINext = clutchMode === 'locked' ? omegaE : omegaI + alphaI * dtSub;
      const avgTarget = omegaINext / overallRatio;
      let avgAfter = 0;
      for (const i of drivenIdx) avgAfter += omegasW[i];
      avgAfter /= nDriven;
      const shift = avgTarget - avgAfter;
      for (const i of drivenIdx) omegasW[i] += shift;
    } else {
      omegaIneutral += alphaI * dtSub;
    }

    // 7) Per-wheel drive torque diagnostics.
    if (inGear && nDriven > 0 && sumDriveShare > 0) {
      const driveAtAxle = clutchTorque * overallRatio * DRIVE_EFFICIENCY;
      for (let i = 0; i < wheelCount; i++) {
        const w = input.wheels[i];
        driveTorqueByWheel[i] = w.driveShare > 0
          ? driveAtAxle * (w.driveShare / sumDriveShare)
          : 0;
      }
    } else {
      for (let i = 0; i < wheelCount; i++) driveTorqueByWheel[i] = 0;
    }

    // 8) Per-axle differential coupling.
    if (inGear && nDriven > 0) {
      applyAxleDiffCoupling('front', input.wheels, omegasW, drivenIdx, params, dtSub, driveTorqueByWheel);
      applyAxleDiffCoupling('rear', input.wheels, omegasW, drivenIdx, params, dtSub, driveTorqueByWheel);
    }

    lastClutchTorque = clutchTorque;
    lastClutchMode = clutchMode;
  }

  let transmissionOmegaFinal: number;
  if (inGear && nDriven > 0) {
    let avg = 0;
    for (const i of drivenIdx) avg += omegasW[i];
    avg /= nDriven;
    transmissionOmegaFinal = avg * overallRatio;
  } else {
    transmissionOmegaFinal = omegaIneutral;
  }

  return {
    engineOmega: omegaE,
    transmissionOmega: transmissionOmegaFinal,
    wheelOmegas: omegasW,
    driveTorqueByWheel,
    clutchTorqueNm: lastClutchTorque,
    clutchSlipRadPerSec: omegaE - transmissionOmegaFinal,
    clutchMode: lastClutchMode,
  };
}

function applyAxleDiffCoupling(
  axle: AxlePosition,
  wheels: ReadonlyArray<DrivetrainWheelInput>,
  omegasW: number[],
  drivenIdx: number[],
  params: DrivetrainParams,
  dtSub: number,
  driveTorqueByWheel: number[],
): void {
  let leftIdx = -1;
  let rightIdx = -1;
  for (const i of drivenIdx) {
    const w = wheels[i];
    if (w.axle === axle) {
      if (w.side === 'left') leftIdx = i;
      else if (w.side === 'right') rightIdx = i;
    }
  }
  if (leftIdx < 0 || rightIdx < 0) return;

  const result = applySalisburyDiff({
    leftOmega: omegasW[leftIdx],
    rightOmega: omegasW[rightIdx],
    leftInertia: wheels[leftIdx].inertia,
    rightInertia: wheels[rightIdx].inertia,
    driveTorqueAxleNm: (driveTorqueByWheel[leftIdx] || 0) + (driveTorqueByWheel[rightIdx] || 0),
    diffType: params.diffType,
    preloadNm: params.diffPreloadNm,
    capacityNm: params.diffCapacityNm,
    powerRamp: params.diffPowerRamp,
    coastRamp: params.diffCoastRamp,
    dt: dtSub,
  });
  omegasW[leftIdx] = result.leftOmega;
  omegasW[rightIdx] = result.rightOmega;
}

// =====================================================================
// Legacy drivetrain helpers (pre-stepDrivetrain refactor).
//
// `RacingEngine` and several test files still call the old per-helper API
// (computeClutchTorque + applyDiffCoupling + stepEngineOmega). The new
// `stepDrivetrain` solver is meant to replace them in a follow-up refactor,
// but until that lands we keep these helpers exported here so the engine
// keeps building. The implementations are byte-for-byte from the previous
// drivetrain.ts; do not extend them — extend `stepDrivetrain` instead.
// =====================================================================

export interface ClutchTorqueInput {
  engineOmega: number;
  /** Average driven wheel omega multiplied by the active gear ratio. */
  wheelEngineOmega: number;
  clutchStiffness: number;
  clutchMaxTorque: number;
}

export interface ClutchTorqueResult {
  clutchTorque: number;
  slip: number;
}

export function computeClutchTorque(input: ClutchTorqueInput): ClutchTorqueResult {
  const slip = input.engineOmega - input.wheelEngineOmega;
  const requested = input.clutchStiffness * slip;
  const clutchTorque = Math.max(
    -input.clutchMaxTorque,
    Math.min(input.clutchMaxTorque, requested),
  );
  return { clutchTorque, slip };
}

export interface DiffStepInput {
  type: DiffType;
  leftOmega: number;
  rightOmega: number;
  leftInertia: number;
  /** Throttle pedal value (0..1). LSD splits power vs coast lock by this. */
  effectiveThrottle: number;
  /** Average drive torque applied to the rear axle this step (Nm). */
  driveTorquePerWheel: number;
  preloadNm: number;
  capacityNm: number;
  powerLockPct: number;
  coastLockPct: number;
  dt: number;
}

export interface DiffStepResult {
  leftOmega: number;
  rightOmega: number;
}

export function applyDiffCoupling(input: DiffStepInput): DiffStepResult {
  const { leftOmega, rightOmega, type, dt } = input;
  switch (type) {
    case 'open':
      return { leftOmega, rightOmega };
    case 'welded': {
      const avg = (leftOmega + rightOmega) * 0.5;
      return { leftOmega: avg, rightOmega: avg };
    }
    case 'clutchLSD': {
      const onPower = input.effectiveThrottle > 0.05;
      const lockPct = onPower ? input.powerLockPct : input.coastLockPct;
      const driveMag = Math.abs(input.driveTorquePerWheel) * 2;
      const couplingMax = Math.min(input.capacityNm, input.preloadNm + lockPct * driveMag);
      const dOmega = leftOmega - rightOmega;
      const blend = Math.max(
        0,
        Math.min(1, (couplingMax * dt) / (input.leftInertia * Math.max(1, Math.abs(dOmega)))),
      );
      const avg = (leftOmega + rightOmega) * 0.5;
      return {
        leftOmega: leftOmega + (avg - leftOmega) * blend,
        rightOmega: rightOmega + (avg - rightOmega) * blend,
      };
    }
  }
}

export interface EngineStepInput {
  engineOmega: number;
  engineDriveTorque: number;
  /** Engine internal drag (pumping + friction), already with pumping fade. */
  engineDragTorque: number;
  clutchTorque: number;
  engineInertia: number;
  /** Idle governor floor (rad/s). */
  idleOmega: number;
  /** Hard rev limiter (rad/s). */
  redlineOmega: number;
  dt: number;
}

export function stepEngineOmega(input: EngineStepInput): number {
  const dragSign = Math.sign(input.engineOmega) || 1;
  const netT = input.engineDriveTorque - dragSign * input.engineDragTorque - input.clutchTorque;
  let omega = input.engineOmega + (netT / input.engineInertia) * input.dt;
  if (omega < input.idleOmega) omega = input.idleOmega;
  if (omega > input.redlineOmega) omega = input.redlineOmega;
  return omega;
}
