/**
 * Pure physics math used by the racing simulation. Each module is a small,
 * focused helper with no Three.js / Jolt dependency so it stays unit-testable
 * in isolation. The simulation step in `RacingEngine.ts` orchestrates them.
 */

export { tireD, TIRE_FZ_REF, TIRE_LOAD_FALLOFF } from './tire-load.js';
export {
  computeLongitudinalLoadTransfer,
  computeLateralLoadTransfer,
  computeFrontRollStiffnessShare,
  type LongitudinalLoadTransferInput,
  type LateralLoadTransferInput,
  type LateralLoadTransferResult,
  type FrontRollStiffnessShareInput,
} from './load-transfer.js';
export {
  pacejkaLat,
  pacejkaLong,
  evaluatePacejka56Combined,
  DEFAULT_PACEJKA56_PARAMS,
  DEFAULT_PACEJKA56_FRONT,
  DEFAULT_PACEJKA56_REAR,
  type Pacejka56Axle,
  type Pacejka56AxleParams,
  type Pacejka56Input,
  type Pacejka56Result,
} from './pacejka.js';
export {
  ENGINE_CURVE,
  ENGINE_REDLINE,
  ENGINE_IDLE,
  engineTorqueAt,
} from './engine-curve.js';
export { computeAckermannAngles, type AckermannPair } from './ackermann.js';
export {
  computeWheelHeadingBasis,
  computeSlipAngleRad,
  computeWheelSlipTargets,
  type WheelHeadingBasis,
  type WheelSlipTargetInput,
  type WheelSlipTargets,
} from './wheel-kinematics.js';
export {
  stepRelaxedSlip,
  type RelaxationStepInput,
} from './relaxation.js';
export { computeMotionRatio } from './motion-ratio.js';
export { computeBumpStopForce } from './bump-stop.js';
export { computeCasterCamber } from './caster-camber.js';
export { computeToeSlipOffset, type Axle } from './toe.js';
export {
  computeCamberThrust,
  type CamberInput,
  type CamberResult,
} from './camber.js';
export { computeAxleArb, type AxleArbInput, type AxleArbResult } from './arb.js';
export {
  computeAntiPitchVertical,
  type AntiPitchInput,
} from './anti-dive.js';
export {
  brakeFadeFactor,
  stepBrakeTemperature,
  BRAKE_AMBIENT_C,
  BRAKE_FADE_T0,
  BRAKE_FADE_T1,
  BRAKE_HEAT_K,
  BRAKE_COOL_K,
  BRAKE_COOL_V,
  type BrakeFadeInput,
  type BrakeThermalStep,
} from './brakes.js';
export {
  computeAeroDownforce,
  computeAeroDrag,
  computeYawRestoringMoment,
  type AeroDownforceInput,
  type AeroDownforceResult,
  type AeroDragInput,
  type AeroDragResult,
  type YawRestoringInput,
} from './aero.js';
export {
  computeAligningMoment,
  computeSelfAligningMoment,
  type AligningMomentInput,
  type AligningMomentResult,
  type MzInput,
} from './mz.js';
export {
  applyLowSpeedWheelRotationLock,
  type LowSpeedWheelLockInput,
  type LowSpeedWheelLockResult,
} from './low-speed-wheel.js';
export {
  applyCorneringBrakeControl,
  type CbcOptions,
  type WheelQuad,
} from './brake-balance.js';
export {
  stepDrivetrain,
  applySalisburyDiff,
  computeClutchTorque,
  applyDiffCoupling,
  stepEngineOmega,
  type AxlePosition,
  type AxleSide,
  type ClutchMode,
  type ClutchTorqueInput,
  type ClutchTorqueResult,
  type DiffStepInput,
  type DiffStepResult,
  type DiffType,
  type DrivetrainParams,
  type DrivetrainStepInput,
  type DrivetrainStepResult,
  type DrivetrainWheelInput,
  type EngineStepInput,
  type SalisburyDiffInput,
  type SalisburyDiffResult,
} from './drivetrain.js';
export {
  applyAbs,
  computeTcCut,
  classifyEsc,
  computeEscBrakeTargets,
  type AbsInput,
  type AbsResult,
  type TcInput,
  type TcResult,
  type EscInput,
  type EscMode,
  type EscResult,
  type EscBrakeTargetsInput,
  type EscBrakeTargetsResult,
} from './driver-aids.js';
export {
  tireTempMu,
  stepTireTemperature,
  TIRE_AMBIENT_C,
  TIRE_OPTIMAL_C,
  TIRE_HEAT_K,
  TIRE_COOL_K,
  TIRE_COOL_V,
  type TireThermalStep,
} from './tire-thermal.js';
