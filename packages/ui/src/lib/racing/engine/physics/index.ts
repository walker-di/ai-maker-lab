/**
 * Pure physics math used by the racing simulation. Each module is a small,
 * focused helper with no Three.js / Jolt dependency so it stays unit-testable
 * in isolation. The simulation step in `RacingEngine.ts` orchestrates them.
 */

export { tireD, TIRE_FZ_REF, TIRE_LOAD_FALLOFF } from './tire-load.js';
export { pacejkaLat, pacejkaLong } from './pacejka.js';
export {
  ENGINE_CURVE,
  ENGINE_REDLINE,
  ENGINE_IDLE,
  engineTorqueAt,
} from './engine-curve.js';
export { computeAckermannAngles, type AckermannPair } from './ackermann.js';
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
  computeAeroDrag,
  computeYawRestoringMoment,
  type AeroDragInput,
  type AeroDragResult,
  type YawRestoringInput,
} from './aero.js';
export { computeSelfAligningMoment, type MzInput } from './mz.js';
export {
  computeClutchTorque,
  applyDiffCoupling,
  stepEngineOmega,
  type ClutchTorqueInput,
  type ClutchTorqueResult,
  type DiffStepInput,
  type DiffStepResult,
  type DiffType,
  type EngineStepInput,
} from './drivetrain.js';
export {
  applyAbs,
  computeTcCut,
  classifyEsc,
  type AbsInput,
  type AbsResult,
  type TcInput,
  type TcResult,
  type EscInput,
  type EscMode,
  type EscResult,
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
