/**
 * Racing simulation orchestrator.
 *
 * The engine owns chassis + wheel state and runs the per-step pipeline that
 * combines all the focused physics modules (`./physics/*`). It exposes a small
 * surface — `init`, `step(dt)`, `setSetup`, `setVehiclePreset`, `setTrack`,
 * `dispose` — and emits typed events through `EngineEmitter` so the page model
 * can drive the HUD and persistence.
 *
 * Day-one implementation uses a self-contained rigid-body integrator. The
 * chassis is integrated with explicit `mass = 1240 kg` and an inertia
 * diagonal of `(1500, 1700, 450)` kg·m² (mirroring the prototype's
 * `MassProperties` setup). Jolt-backed physics is wired in via the route-side
 * adapter once we depend on the wasm runtime; the same per-step pipeline runs
 * for both backends because force application happens through the
 * `addChassisForceAtPoint` / `applyChassisTorque` shims.
 *
 * M4: Track contact uses `SurfaceLookup.groundYAt` to resolve ground height
 * from optional authored elevation/kerb data.  Tracks without elevation data
 * continue to use a flat y = 0 ground plane (flat fallback preserved).
 */

import { Quaternion, Vector3 } from 'three';
import { EngineEmitter } from './events.js';
import { computeRackForce, type FfbGeometry } from './ffb.js';
import {
  computeDamperForce,
  DEFAULT_DAMPER_KNEE_PARAMS,
  DEFAULT_DAMPER_KNEE_PARAMS_REAR,
  type DamperKneeParams,
} from './physics/damper-curve.js';
import {
  resolveWheelKinematics,
  computeJackingForce,
  computeProgressiveBumpStop,
  DEFAULT_ROLL_CENTER_HEIGHT_M,
  type KinematicTable,
} from './physics/suspension-kinematics.js';
import { CameraRig, type CameraMode } from './cameras.js';
import { FixedStepLoop } from './fixed-step-loop.js';
import { NullAudioBus, type AudioBus } from './audio-bus.js';
import { RacingInput } from './input.js';
import { SurfaceLookup } from './tracks/surface-lookup.js';
import { ElevationMap, TerrainContact } from './tracks/elevation.js';
import { sampleCentripetal, type SampledPoint } from './tracks/catmull-rom.js';
import {
  applyAbs,
  applyCorneringBrakeControl,
  applyLowSpeedWheelRotationLock,
  brakeFadeFactor,
  classifyEsc,
  computeAckermannAngles,
  computeAeroDownforce,
  computeAeroDrag,
  type AeroMapPreset,
  computeAligningMoment,
  computeAntiPitchVertical,
  computeAxleArb,
  computeCamberThrust,
  computeCasterCamber,
  computeContactPatchPressureDistribution,
  computeEscBrakeTargets,
  computeFrontRollStiffnessShare,
  computeGyroscopicTorque,
  computeLateralLoadTransfer,
  computeLoadSensitiveRelaxationLength,
  computeLongitudinalLoadTransfer,
  computeOverturningMomentNm,
  computeSlidingGripScale,
  computeTcCut,
  computeToeSlipOffset,
  computeWakeEffect,
  computeWheelHeadingBasis,
  computeWheelSlipTargets,
  computeYawRestoringMoment,
  ENGINE_IDLE,
  ENGINE_REDLINE,
  engineTorqueAt,
  evaluatePacejka56Combined,
  stepBrakeTemperature,
  stepDrivetrain,
  stepRelaxedSlip,
  stepTireTemperature,
  tireTempMu,
  TIRE_AMBIENT_C,
  type DrivetrainParams,
  type DrivetrainWheelInput,
} from './physics/index.js';
import {
  stepTireTemperatureZones,
  tireZoneAvgTemp,
  tireTempMuZones,
  type TireThermalZones,
} from './physics/tire-thermal.js';
import {
  stepTirePressure,
  tirePressureMu,
  tirePressurePatchWidthScale,
  TIRE_PRESSURE_COLD_KPA,
  TIRE_PRESSURE_OPTIMAL_KPA,
} from './physics/tire-pressure.js';
import {
  stepTireVertical,
  TIRE_RADIAL_STIFFNESS_NPM,
  TIRE_RADIAL_DAMPING_NSPM,
} from './physics/tire-vertical.js';
import {
  stepTurbo,
  makeTurboState,
  type TurboParams,
  type TurboState,
} from './physics/turbo.js';
import {
  evaluateShiftRequest,
  stepShiftDelay,
  requestShift,
  makeShiftState,
  stepDrivelineCompliance,
  makeDrivelineComplianceState,
  type ShiftLogicParams,
  type ShiftState,
  type DrivelineComplianceParams,
  type DrivelineComplianceState,
} from './physics/drivetrain.js';
import {
  engineTorqueAtWithMap,
  engineBrakeTorqueAt,
  type EngineTorqueMap,
  type EngineBrakingParams,
} from './physics/engine-curve.js';
import type {
  DiffType,
  DriveLayout,
  SetupValues,
  SurfaceId,
  TrackPreset,
  VehiclePreset,
} from '../types.js';
import type { PhysicsContext } from './jolt-loader.js';
import {
  resolveCompliance,
  hasCompliance,
  createChassisBody,
  createHubBodies,
  createComplianceConstraints,
  destroyComplianceBodies,
  writeJoltBodyPose,
  readJoltBodyPose,
  createSoftwareHubStates,
  stepComplianceSoftware,
  applyTorsionalRestoringTorqueToVector,
  type ResolvedCompliance,
  type SoftwareHubState,
} from './compliance.js';

const DEFAULT_SETUP: SetupValues = {
  frontToeDeg: 0,
  rearToeDeg: 0,
  casterDeg: 0,
  ackermannPct: 0,
  motionRatioFront: 1,
  motionRatioRear: 1,
  bumpStopGapFrontMm: 220,
  bumpStopGapRearMm: 220,
  bumpStopRateFrontNmm: 0,
  bumpStopRateRearNmm: 0,
  // M7 fields
  springFrontNpm: 0,
  springRearNpm: 0,
  damperBumpFrontScale: 1.0,
  damperReboundFrontScale: 1.0,
  damperBumpRearScale: 1.0,
  damperReboundRearScale: 1.0,
  diffPowerRamp: 0.45,
  diffCoastRamp: 0.30,
  diffPreloadNm: 60,
  tirePressureFLKpa: 200,
  tirePressureFRKpa: 200,
  tirePressureRLKpa: 200,
  tirePressureRRKpa: 200,
  camberFrontDeg: -1.5,
  camberRearDeg: -1.5,
  brakeBiasFront: 0.565,
  rideHeightFrontMm: 0,
  rideHeightRearMm: 0,
  fuelLoad: 0,
  finalDriveScale: 1.0,
};

/** Maximum fuel mass (kg) — tuned for a GT-class car. */
const MAX_FUEL_MASS_KG = 80;
const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

const DRIVE_EFFICIENCY = 0.93;

const ENGINE_IDLE_OMEGA = ENGINE_IDLE * (2 * Math.PI / 60);
const ENGINE_REDLINE_OMEGA = ENGINE_REDLINE * 1.05 * (2 * Math.PI / 60);

/**
 * Phase 5 drivetrain solver defaults. Each value can be overridden by the
 * vehicle preset's `physics.*` field; presets that omit them keep the
 * tuned-stock behaviour. See `applyVehiclePhysicsPreset()` for the full
 * mapping.
 */
function makeDefaultDrivetrainParams(diffType: DiffType): DrivetrainParams {
  return {
    engineInertia: 0.18,
    flywheelInertia: 0.08,
    gearboxInputInertia: 0.035,
    propshaftInertia: 0.025,
    diffInertia: 0.06,
    clutchMaxTorqueNm: 720,
    clutchStaticFactor: 1.15,
    clutchStickThresholdRadPerSec: 4,
    drivetrainSubsteps: 4,
    diffType,
    diffPreloadNm: 60,
    diffCapacityNm: 1200,
    diffPowerRamp: 0.45,
    diffCoastRamp: 0.30,
    idleOmega: ENGINE_IDLE_OMEGA,
    redlineOmega: ENGINE_REDLINE_OMEGA,
  };
}

// Default centre-of-gravity geometry used when a vehicle preset omits the
// matching `physics.*` field. Values are chosen for a generic sports car
// with a 0.34 m wheel radius and a low cabin; per-vehicle JSON overrides
// these in the catalog presets.
const DEFAULT_CG_HEIGHT_M = 0.5;
const DEFAULT_SPRUNG_CG_HEIGHT_M = 0.52;
const DEFAULT_UNSPRUNG_CG_HEIGHT_M = 0.34;
const DEFAULT_UNSPRUNG_MASS_PER_AXLE_KG = 80;

// Lateral acceleration clamp (m/s²) when computing rigid-body load transfer.
// 2.5 g is well past production-tire grip on dry asphalt and easily covers
// authored race-tire presets, while still suppressing the spurious spikes
// that show up after externally injected velocity changes (most commonly
// inside tests). Without this, a single inflated `accelLatG` sample can
// briefly invert axle load.
const LATERAL_ACCEL_CLAMP_MS2 = 2.5 * 9.81;

// Tire relaxation lengths (m). The contact patch must travel roughly one
// `sigma` before the slip-driven force fully builds — that is what creates
// the physically correct "tire takes a beat to respond" feel and removes
// the artificial low-speed `slipEps = 1.5` cliff the legacy slip helper
// needed. Defaults match the Phase 1 plan and a typical sports tire.
const TIRE_RELAXATION_LENGTH_LONG_M = 0.4;
const TIRE_RELAXATION_LENGTH_LAT_M = 0.55;

// Steering self-aligning geometry defaults. Each preset can override these
// fields per car; values match the Phase 6 plan and a typical road sports
// car geometry. The aligning moment helper consumes them per-wheel.
const DEFAULT_PNEUMATIC_TRAIL_0_M = 0.042;
const DEFAULT_PNEUMATIC_TRAIL_DECAY_DEG = 15;
const DEFAULT_CASTER_TRAIL_SCALE_M_PER_DEG = 0.006;
const DEFAULT_MECHANICAL_TRAIL_MAX_M = 0.065;
const DEFAULT_SCRUB_RADIUS_M = 0.015;
const DEFAULT_STEERING_ALIGN_TORQUE_MAX_NM = 220;
const DEFAULT_STEERING_ALIGN_CENTRE_RATE_SCALE = 1;
const STEERING_ALIGN_FILTER_HZ = 20;

// Low-speed wheel-rotation lock thresholds. Values mirror the Phase 6E
// plan defaults and match `applyLowSpeedWheelRotationLock`'s helper
// defaults. The engine duplicates them here so callers can verify behaviour
// against constants rather than literal numbers.
const LOW_SPEED_WHEEL_LOCK_MPS = 0.4;
const LOW_SPEED_WHEEL_BLEND_MPS = 0.8;
const LOW_SPEED_DRIVE_UNLOCK_NM = 35;
const LOW_SPEED_BRAKE_LOCK_NM = 50;

const SURFACE_TABLE: Record<SurfaceId, { mu: number; roll: number }> = {
  RUBBER: { mu: 1.08, roll: 0.013 },
  ASPHALT: { mu: 1.0, roll: 0.015 },
  MARBLES: { mu: 0.82, roll: 0.02 },
  DAMP: { mu: 0.74, roll: 0.018 },
  CURB: { mu: 0.85, roll: 0.04 },
  GRASS: { mu: 0.45, roll: 0.1 },
  GRAVEL: { mu: 0.3, roll: 0.18 },
};

const WHEEL_CHANNEL_NAMES = ['FL', 'FR', 'RL', 'RR'] as const;

function surfaceWearMultiplier(surface: SurfaceId): number {
  switch (surface) {
    case 'GRAVEL': return 1.9;
    case 'GRASS': return 1.45;
    case 'MARBLES': return 1.25;
    case 'CURB': return 1.15;
    case 'DAMP': return 0.85;
    default: return 1;
  }
}

function sanitizeTrackWetness(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? clamp(value, 0, 1) : 0;
}

function sanitizeTrackCondition(value: unknown): string {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : 'dry';
}

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

interface WheelState {
  index: number;
  /** Local-frame wheel position relative to chassis COM (metres). */
  posLocal: Vector3;
  radius: number;
  inertia: number;
  /** +1 for the +X (right) side of the chassis, -1 for the -X (left). */
  lateralSign: 1 | -1;
  steer: boolean;
  hand: boolean;
  drive: boolean;
  driveShare: number;

  // Setup-driven
  toeDeg: number;
  camberStaticDeg: number;
  camberGain: number;
  antiDivePct: number;
  antiSquatPct: number;

  // Per-step state
  steerAngle: number;
  baseSteerAngle: number;
  omega: number;
  spinAngle: number;
  prevCompression: number;
  compression: number;
  damperVelocity: number;
  bumpStopForce: number;
  bumpStopPct: number;
  contact: boolean;
  surface: SurfaceId;

  fz: number;
  fx: number;
  fy: number;
  mz: number;
  /**
   * Authoritative slip ratio fed into the tire force model. Equal to
   * `slipRatioDynamic` on contact, reset to 0 when airborne. Public
   * snapshot/HUD reads this field.
   */
  slipRatio: number;
  /** Authoritative slip angle (rad). See `slipRatio`. */
  slipAngle: number;
  /** Instantaneous slip ratio target before relaxation lag. Diagnostics only. */
  slipRatioTarget: number;
  /** Instantaneous slip angle target (rad) before relaxation lag. Diagnostics only. */
  slipAngleTarget: number;
  /** Relaxation-filtered slip ratio. Carried across steps. */
  slipRatioDynamic: number;
  /** Relaxation-filtered slip angle (rad). Carried across steps. */
  slipAngleDynamic: number;
  camberRad: number;
  slidePower: number;

  tempC: number;
  brakeTempC: number;
  brakeFade: number;
  /** Deterministic normalized tire-wear accumulation. 0 = fresh, 1 = worn out. */
  tireWear: number;
  /** Normalized flat-spot severity/signal from locked-wheel braking. */
  flatSpotSignal: number;

  // ---- M3 kinematic state ----------------------------------------------
  /** Roll-center height resolved from table this step (m). */
  rollCenterHeightM: number;
  /** Jacking vertical force this step (N, positive = lifts chassis). */
  jackingForceN: number;
  /** Travel-resolved camber (deg) including table delta. */
  camberDeg: number;
  // NOTE: toeDeg (above, in Setup-driven) is reused to carry the
  // travel-resolved value; it is updated each step by resolveWheelKinematics.

  // ---- M1 multi-zone thermal + pressure + vertical ----------------------
  /** Three-zone tire temperatures (inner / middle / outer strip). */
  thermalZones: TireThermalZones;
  /** Current inflation pressure (kPa). */
  pressureKpa: number;
  /** Tire carcass deflection from the previous step (m). Carried for damping. */
  tireDeflection: number;
  /** Tire carcass deflection rate (m/s). Carried for damping. */
  tireDeflectionRate: number;
  /**
   * Peak slip ratio diagnostic from the most recent Pacejka evaluation.
   * Exposed in the snapshot for telemetry / normalization displays.
   */
  kappaPeak: number;
  /**
   * Peak slip angle (rad) diagnostic from the most recent Pacejka evaluation.
   */
  alphaPeakRad: number;
  /** Runtime-adjusted longitudinal relaxation length (m). */
  relaxationLengthLongM: number;
  /** Runtime-adjusted lateral relaxation length (m). */
  relaxationLengthLatM: number;
  /** Sliding-speed grip scale applied before Pacejka. */
  slidingGripScale: number;
  /** Contact-patch sliding speed magnitude (m/s). */
  slidingSpeedMps: number;
  /** Contact-patch pressure share on the inner strip. */
  pressureInner: number;
  /** Contact-patch pressure share on the middle strip. */
  pressureMiddle: number;
  /** Contact-patch pressure share on the outer strip. */
  pressureOuter: number;
  /** Contact-patch pressure centroid, negative = inner/chassis side (m). */
  pressureCentroidM: number;
  /** Overturning moment from pressure centroid (N·m). */
  overturningMomentNm: number;

  absRelease: number;
  absActive: boolean;
  escTorque: number;

  /** Effective brake torque applied this step (after ABS scale + bias + fade + CBC). */
  brakeTorqueApplied: number;
  /** ABS release scale this step (1 = no cut, 0.2 = release window). */
  absScale: number;
  /** This wheel's contribution to chassis-up yaw torque this step (N·m). */
  yawContribution: number;
  /**
   * Effective contact-patch friction coefficient used to evaluate Pacejka
   * this step (surface mu × tire-temp mu × any axle scale). Pure
   * diagnostic surface — feeds the snapshot/HUD tire-utilization view.
   */
  mu: number;
  /**
   * Combined-slip magnitude `hypot(slipRatio, slipAngle)` (dimensionless,
   * with the slip angle in radians). Useful for at-a-glance "how saturated
   * is this tire" telemetry without needing to read both axes.
   */
  combinedSlip: number;

  // ARB pre-pass scratch.
  _preCompression: number;
  _preContact: boolean;
  _arbDfz: number;

  // Inter-pass scratch for the split brake stage.
  _fxFinal: number;
  _frx: number;
  _vx: number;
  /** Rotational external torque this step (Nm). Tire reaction + brake +
   *  handbrake + ESC, fed into the drivetrain solver. Drive torque is
   *  applied by `stepDrivetrain` and is NOT included here. */
  _externalTorque: number;

  // ---- M9 compliance scratch -------------------------------------------
  /** Total force vector (N) applied to this wheel's hub this step. */
  _wheelForce: Vector3;
  /** Total torque vector (N·m) applied to this wheel's hub this step. */
  _wheelTorque: Vector3;
}

interface DriverAidsState {
  absEnabled: boolean;
  tcEnabled: boolean;
  escEnabled: boolean;
  absThreshold: number;
  absReleaseTime: number;
  tcThreshold: number;
  tcWindow: number;
  escMinSpeedKmh: number;
  escOversteerThreshold: number;
  escUndersteerThreshold: number;
  escMaxBrakeTorque: number;
  escTorqueByWheel: number[];
  escTorqueTargetByWheel: number[];
  escApplyRate: number;
  escReleaseRate: number;
  absActive: boolean;
  absEventCount: number;
  tcCut: number;
  driveSlip: number;
  escActive: boolean;
}

export interface RacingEngineConfig {
  vehicle: VehiclePreset;
  track: TrackPreset;
  setup?: SetupValues;
  audio?: AudioBus;
  /** Optional Jolt physics context. When provided and the preset carries
   * nonzero compliance, the engine creates Jolt hub bodies and constraints.
   * When absent (or compliance is zero) the engine uses the rigid fallback.
   */
  physicsContext?: PhysicsContext;
}

export interface RacingEngineSnapshot {
  speedKmh: number;
  rpm: number;
  gearLabel: string;
  gearIndex: number;
  driftState: string;
  sideslipDeg: number;
  yawRateRad: number;
  rollDeg: number;
  pitchDeg: number;
  rearLockPct: number;
  rearSlipRatio: number;
  frontSlipDeg: number;
  rearSlipDeg: number;
  frontLoadPct: number;
  leftLoadPct: number;
  ackermannDeltaDeg: number;
  frontToeDeg: number;
  rearToeDeg: number;
  casterDeg: number;
  accelLongG: number;
  accelLatG: number;
  aids: {
    absEnabled: boolean;
    tcEnabled: boolean;
    escEnabled: boolean;
    absActive: boolean;
    tcActive: boolean;
    escActive: boolean;
    tcCut: number;
  };
  wheels: ReadonlyArray<{
    index: number;
    fz: number;
    fx: number;
    fy: number;
    mz: number;
    slipRatio: number;
    slipAngle: number;
    /** Instantaneous slip ratio target before relaxation lag. */
    slipRatioTarget: number;
    /** Instantaneous slip angle (rad) target before relaxation lag. */
    slipAngleTarget: number;
    /** Relaxation-filtered slip ratio carried across steps. */
    slipRatioDynamic: number;
    /** Relaxation-filtered slip angle (rad) carried across steps. */
    slipAngleDynamic: number;
    /** Effective camber (rad) used to evaluate camber thrust this step. */
    camberRad: number;
    /** `hypot(slipRatio, slipAngleRad)` — at-a-glance saturation. */
    combinedSlip: number;
    /** Effective contact-patch friction coefficient this step. */
    mu: number;
    /**
     * Tire utilization in [0, 1+]: `hypot(Fx, Fy) / (mu * Fz)`. >1 means
     * the tire is producing more force than the simple friction-circle
     * ceiling — combined-slip MF can do this transiently because the
     * peak coefficients (pDx1, pDy1) can be slightly above 1.
     */
    tireUtilization: number;
    surface: SurfaceId;
    tempC: number;
    brakeTempC: number;
    /** Normalized tire wear. 0 = fresh, 1 = worn out. */
    tireWear: number;
    /** Normalized flat-spot signal produced by lock-up / heavy braking. */
    flatSpotSignal: number;
    bumpStopPct: number;
    brakeTorqueApplied: number;
    absScale: number;
    absActive: boolean;
    yawContribution: number;
    /** Drive torque (Nm) routed to this wheel by the drivetrain solver. */
    driveTorqueNm: number;
    // ---- M1 additions ---------------------------------------------------
    /** Inner strip temperature (°C) — chassis / camber side. */
    tempInner: number;
    /** Middle strip (crown) temperature (°C). */
    tempMiddle: number;
    /** Outer strip temperature (°C) — kerb / shoulder side. */
    tempOuter: number;
    /** Current inflation pressure (kPa). */
    pressureKpa: number;
    /** Pure-slip peak slip ratio diagnostic. */
    kappaPeak: number;
    /** Pure-slip peak slip angle (rad) diagnostic. */
    alphaPeakRad: number;
    /** Tire carcass radial deflection this step (m). */
    tireDeflection: number;
    /** Runtime-adjusted longitudinal relaxation length (m). */
    relaxationLengthLongM: number;
    /** Runtime-adjusted lateral relaxation length (m). */
    relaxationLengthLatM: number;
    /** Sliding-speed grip scale applied before Pacejka. */
    slidingGripScale: number;
    /** Contact-patch sliding speed magnitude (m/s). */
    slidingSpeedMps: number;
    /** Contact-patch pressure share on the inner strip. */
    pressureInner: number;
    /** Contact-patch pressure share on the middle strip. */
    pressureMiddle: number;
    /** Contact-patch pressure share on the outer strip. */
    pressureOuter: number;
    /** Contact-patch pressure centroid, negative = inner/chassis side (m). */
    pressureCentroidM: number;
    /** Overturning moment from pressure centroid (N·m). */
    overturningMomentNm: number;
    // ---- M3 additions ---------------------------------------------------
    /** Suspension travel (m, positive = compression). */
    suspensionTravel: number;
    /** Damper shaft velocity (m/s, positive = compression) after motion-ratio transform. */
    damperVelocity: number;
    /** Roll-center height (m) resolved from kinematics table this step. */
    rollCenterHeightM: number;
    /** Jacking vertical force contribution this step (N, positive = lifts chassis). */
    jackingForceN: number;
    /** Travel-resolved toe angle (deg) including bump-steer delta. */
    toeDeg: number;
    /** Travel-resolved camber angle (deg). */
    camberDeg: number;
    // ---- M9 additions ---------------------------------------------------
    /** Bushing deflection magnitude (mm, 0 when rigid). */
    hubDeflectionMm: number;
  }>;
  drivetrain: {
    /** Engine crank angular speed (rad/s). */
    engineOmega: number;
    /** Gearbox input shaft angular speed (rad/s). */
    transmissionOmega: number;
    /** Last clutch coupling torque (Nm). */
    clutchTorqueNm: number;
    /** `'locked'` (Karnopp stick) or `'slipping'`. */
    clutchMode: 'locked' | 'slipping';
    /** Engine drive torque the throttle pedal produced this step (Nm). */
    engineDriveTorqueNm: number;
    /** Engine pumping + friction drag magnitude this step (Nm). */
    engineDragTorqueNm: number;
    // ---- M6 drivetrain depth additions ----------------------------------
    /** Current boost gauge pressure (bar). 0 for NA vehicles. */
    boostBar: number;
    /** Normalised turbo spool ratio [0..1]. 0 for NA vehicles. */
    turboSpoolRatio: number;
    /** Torque multiplier applied by the turbo model this step (1.0 = NA). */
    boostTorqueMultiplier: number;
    /** True when boost exceeds the overboost protection threshold. */
    isOverboost: boolean;
    /** True when the most recent shift request was refused by rpm-window logic. */
    shiftRefused: boolean;
    /** Human-readable shift refusal reason (empty when not refused). */
    shiftRefusalReason: string;
    /** True while a shift-delay window is active (gear not yet engaged). */
    shiftInProgress: boolean;
    /** Remaining shift delay (s). 0 when no shift is in progress. */
    shiftRemainingS: number;
    /** Driveshaft torsional twist angle (rad). 0 when no compliance authored. */
    drivelineComplianceTwistRad: number;
    /** Driveshaft torsional spring torque this step (Nm). */
    drivelineComplianceSpringNm: number;
  };
  aero: {
    /** Front-axle aero downforce magnitude (N). */
    frontDownforceN: number;
    /** Rear-axle aero downforce magnitude (N). */
    rearDownforceN: number;
    /** Magnitude of chassis-frame aero drag this step (N). */
    dragN: number;
    // ---- M5 aero map telemetry -----------------------------------------------
    /** True when an authored aero map preset is loaded (false for scalar-only presets). */
    hasAeroMap: boolean;
    /** Effective front Cl·A used this step (m²). Reflects map lookup or scalar. */
    effectiveClAreaFront: number;
    /** Effective rear Cl·A used this step (m²). */
    effectiveClAreaRear: number;
    /**
     * Centre-of-pressure position as fraction of wheelbase (0 = front, 1 = rear).
     * Shifts rearward when more rear downforce is generated.
     */
    copFraction: number;
    /** True when the front underbody is below the authored stall ride-height. */
    frontStalled: boolean;
    /** True when the rear underbody is below the authored stall ride-height. */
    rearStalled: boolean;
    /** Average front ride-height (m) used for aero map lookup this step. */
    frontRideHeightM: number;
    /** Average rear ride-height (m) used for aero map lookup this step. */
    rearRideHeightM: number;
    /** M8: current wake drag reduction fraction (0 = no reduction). */
    wakeReduction: number;
  };
  lap: { lastMs: number | null; bestMs: number | null; t0: number | null };
  /**
   * M2 — Last FFB pipeline result for this step. Available in snapshots so
   * HUD debug panels can read rack-force without subscribing to the event.
   */
  ffb: {
    rackForce: number;
    kpiTorqueNm: number;
    mzContributionNm: number;
    fxCouplingNm: number;
    totalRawNm: number;
    assistScale: number;
  };
  /**
   * M4 — Track surface condition telemetry.  Fields are snapshot-safe (no
   * Three.js references).  `trackTempC` and `rubberLineGrip` are read
   * directly from the active track preset; `terrainActive` flags whether
   * authored elevation data is present so UI can show an indicator.
   */
  trackCondition: {
    /** Current track surface temperature (\u00b0C) from preset; 28 when absent. */
    trackTempC: number;
    /** Rubber-line grip multiplier; 1 when absent. */
    rubberLineGrip: number;
    /** True when authored elevation data is active (not flat-ground). */
    terrainActive: boolean;
    /** Micro-bump amplitude (m); 0 when absent. */
    bumpAmplitudeM: number;
    /** Normalized wetness 0..1; defaults to 0 when the preset omits it. */
    wetness: number;
    /** Human-readable condition label; defaults to `dry`. */
    condition: string;
  };
}

export interface RacingTelemetryWheelSample {
  index: number;
  tireWear: number;
  flatSpotSignal: number;
  slipRatio: number;
  slipAngle: number;
  slidingSpeedMps: number;
  slidingGripScale: number;
  relaxationLengthLongM: number;
  relaxationLengthLatM: number;
  pressureInner: number;
  pressureMiddle: number;
  pressureOuter: number;
  overturningMomentNm: number;
  tempC: number;
  brakeTempC: number;
  surface: SurfaceId;
}

export interface RacingTelemetrySample {
  lap: { lastMs: number | null; bestMs: number | null; currentStartS: number | null };
  timeS: number;
  speedKmh: number;
  rpm: number;
  accelLongG: number;
  accelLatG: number;
  wheels: RacingTelemetryWheelSample[];
}

export interface RacingTelemetryExport {
  version: 1;
  trackId: string;
  vehicleId: string;
  exportedAtSimTimeS: number;
  lap: { lastMs: number | null; bestMs: number | null; currentStartS: number | null };
  samples: RacingTelemetrySample[];
  channels: Record<string, number[]>;
}

export class RacingEngine {
  readonly events = new EngineEmitter();
  readonly cameras = new CameraRig();
  readonly fixedStep = new FixedStepLoop({ hz: 240, maxStepsPerTick: 8 });

  private vehicle: VehiclePreset;
  private trackPreset: TrackPreset;
  private setup: SetupValues;
  private audio: AudioBus;

  private cameraMode: CameraMode = 'chase';

  // Chassis state
  readonly worldPos = new Vector3(0, 1, 0);
  readonly worldQuat = new Quaternion();
  readonly velocityWS = new Vector3();
  readonly omegaWS = new Vector3();
  // Three.js standard convention: chassis forward = -Z, right = +X, up = +Y.
  // The chase camera is at chassis - heading * 7.5 looking down +heading, which
  // in Three.js puts world +X on the right of the screen — matching chassis
  // right and keeping ArrowLeft = visual left turn.
  private readonly forward = new Vector3(0, 0, -1);
  private readonly right = new Vector3(1, 0, 0);
  private readonly up = new Vector3(0, 1, 0);

  private chassisMass = 1240;
  private readonly chassisInertia = new Vector3(1500, 1700, 450);

  /**
   * Steering self-aligning geometry resolved from the active vehicle preset.
   * Per-wheel `Mz` is built from these knobs in the wheel pass and the
   * front-axle aligning torque drives the keyboard self-centre signal.
   */
  private alignGeometry = {
    pneumaticTrail0M: DEFAULT_PNEUMATIC_TRAIL_0_M,
    pneumaticTrailDecayDeg: DEFAULT_PNEUMATIC_TRAIL_DECAY_DEG,
    casterTrailScaleMPerDeg: DEFAULT_CASTER_TRAIL_SCALE_M_PER_DEG,
    mechanicalTrailMaxM: DEFAULT_MECHANICAL_TRAIL_MAX_M,
    scrubRadiusM: DEFAULT_SCRUB_RADIUS_M,
    steeringAlignTorqueMaxNm: DEFAULT_STEERING_ALIGN_TORQUE_MAX_NM,
    steeringAlignCentreRateScale: DEFAULT_STEERING_ALIGN_CENTRE_RATE_SCALE,
  };
  /**
   * Low-pass filtered front-axle aligning feedback in `[-1, 1]`. Negative
   * during a left turn (positive `steerCmd`) so the input model treats it
   * as "assist the return" once the driver releases the steering key.
   */
  private steeringAlignFeedback = 0;

  // Mass distribution / CG geometry used by the rigid-body load-transfer
  // helpers. Sprung mass is derived as `chassisMass - unsprung sum` so total
  // chassis mass is always authoritative and presets can not silently
  // disagree with themselves.
  private cgHeightM = DEFAULT_CG_HEIGHT_M;
  private sprungCgHeightM = DEFAULT_SPRUNG_CG_HEIGHT_M;
  private unsprungCgHeightM = DEFAULT_UNSPRUNG_CG_HEIGHT_M;
  private unsprungMassFrontKg = DEFAULT_UNSPRUNG_MASS_PER_AXLE_KG;
  private unsprungMassRearKg = DEFAULT_UNSPRUNG_MASS_PER_AXLE_KG;

  // Drivetrain state
  private engineOmega = ENGINE_IDLE * (2 * Math.PI / 60);
  private transmissionOmega = ENGINE_IDLE * (2 * Math.PI / 60);
  private gearIndex = 1; // Reverse, Neutral, 1, 2, ... — N is index 1
  private engineDriveTorqueNm = 0;
  private engineDragTorqueNm = 0;
  /** Last clutch-coupling torque returned by `stepDrivetrain`, in Nm. */
  private clutchTorqueNm = 0;
  /** Last clutch-mode tag returned by `stepDrivetrain`. */
  private clutchMode: 'locked' | 'slipping' = 'slipping';
  /** Magnitude of the chassis-frame aerodynamic drag this step (N). */
  private aeroDragMagN = 0;
  private drivetrainParams: DrivetrainParams = makeDefaultDrivetrainParams('clutchLSD');

  // ---- M6 drivetrain depth state ---------------------------------------
  /** Turbo state; undefined = NA vehicle (turboMultiplier stays 1). */
  private turboState: TurboState | undefined = undefined;
  /** Authored turbo params resolved from preset. */
  private turboParams: TurboParams | undefined = undefined;
  /** Authored throttle×rpm engine torque map (M6). */
  private engineTorqueMap: EngineTorqueMap | undefined = undefined;
  /** Authored per-vehicle torque curve override (M6). */
  private engineTorqueCurveOverride: ReadonlyArray<readonly [number, number]> | undefined = undefined;
  /** Authored engine-braking params (M6). */
  private engineBrakingParams: EngineBrakingParams | undefined = undefined;
  /** Shift logic params (M6). */
  private shiftLogicParams: ShiftLogicParams = {};
  /** Shift state machine (M6). */
  private shiftState: ShiftState = makeShiftState();
  /** Driveshaft compliance state (M6). */
  private complianceState: DrivelineComplianceState = makeDrivelineComplianceState();
  /** Authored compliance params (M6). */
  private complianceParams: DrivelineComplianceParams = {};
  /** Last driveline compliance spring torque this step (Nm). */
  private complianceSpringNm = 0;

  // ---- M9: chassis compliance state -----------------------------------
  /** Resolved compliance parameters; all zeros when preset omits them. */
  private complianceConfig: ResolvedCompliance = resolveCompliance({ id: '', label: '', driveLabel: 'RWD', layoutLabel: '', color: 0, wheelbase: 2.6, trackWidth: 1.6, frontMassPct: 0.5, finalDrive: 3.8, gears: [], steerMaxDeg: 30, axleDrive: { front: 0, rear: 1 }, diffType: 'open' });
  /** True when the active preset has nonzero compliance. */
  private complianceActive = false;
  /** True when Jolt bodies are driving integration (false = software fallback). */
  private useJolt = false;
  /** Stored physics context reference (when Jolt is active). */
  private joltCtx: PhysicsContext | null = null;
  /** Jolt hub bodies and constraints (only when useJolt is true). */
  private joltHubBodies: { chassisBody: unknown; hubBodies: unknown[]; constraints: unknown[] } | null = null;
  /** Software hub states (only when complianceActive && !useJolt). */
  private softwareHubs: SoftwareHubState[] = [];
  /** Chassis-local pickup points for the four hubs (shared by both paths). */
  private hubPickupLocal: Vector3[] = [];

  // ARB
  private arbFront = 25000;
  private arbRear = 22000;

  // Suspension
  private susp = {
    restLen: 0.32,
    /** Per-axle rest lengths including the ride-height offset from setup. */
    restLenFront: 0.32,
    restLenRear: 0.32,
    kFront: 65000,
    kRear: 60000,
    /** Preset base bump coefficients (before damper-scaler is applied). */
    kBumpFrontBase: 4200,
    kReboundFrontBase: 5800,
    kBumpRearBase: 4400,
    kReboundRearBase: 6000,
    cBumpFront: 4200,
    cReboundFront: 5800,
    cBumpRear: 4400,
    cReboundRear: 6000,
    motionRatioFront: 1.0,
    motionRatioRear: 1.0,
    bumpStopGapFrontM: 0.22,
    bumpStopGapRearM: 0.22,
    bumpStopRateFront: 0,
    bumpStopRateRear: 0,
  };

  // ---- M7 setup-driven runtime overrides --------------------------------
  /** Effective brake bias (front fraction) from setup. */
  private setupBrakeBiasFront = 0.565;
  /** Effective final-drive multiplier from setup. */
  private setupFinalDriveScale = 1.0;
  /** Preset base mass (kg); fuel delta is added on top. */
  private baseChassisMass = 1240;

  // Aero
  private cdA = 0.7;
  private cyYaw = 0.1;
  /** Effective `Cl · A` for the front axle (m²). 0 = no front downforce. */
  private clAreaFront = 0;
  /** Effective `Cl · A` for the rear axle (m²). 0 = no rear downforce. */
  private clAreaRear = 0;
  /** M5: Authored aero map preset resolved from the vehicle physics preset. */
  private aeroMapPreset: AeroMapPreset | undefined = undefined;
  /**
   * Per-axle aerodynamic downforce computed by the wheel pass and consumed
   * by `runAero()` to cancel the chassis-up boost it introduces. Without
   * the cancellation, adding downforce to per-wheel `fz` would also pump
   * upward force into the rigid body via the contact-force projection.
   */
  private readonly lastAeroDownforce = { front: 0, rear: 0 };
  /** M5: Last full aero downforce result for snapshot telemetry. */
  private lastAeroResult = {
    effectiveClAreaFront: 0,
    effectiveClAreaRear: 0,
    copFraction: 0.5,
    frontStalled: false,
    rearStalled: false,
    frontRideHeightM: 0.1,
    rearRideHeightM: 0.1,
    wakeReduction: 0,
  };
  /** M8: Optional lead car state for slipstream / wake-field computation. */
  private leadCarState: { pos: Vector3; vel: Vector3 } | null = null;

  // ---- M3 suspension kinematic params (resolved from preset) ----------------
  private damperParamsFront: DamperKneeParams | undefined = undefined;
  private damperParamsRear: DamperKneeParams | undefined = undefined;
  private bumpSteerTableFront: KinematicTable | undefined = undefined;
  private bumpSteerTableRear: KinematicTable | undefined = undefined;
  private camberTableFront: KinematicTable | undefined = undefined;
  private camberTableRear: KinematicTable | undefined = undefined;
  private casterTableFront: KinematicTable | undefined = undefined;
  private casterTableRear: KinematicTable | undefined = undefined;
  private rollCenterTableFront: KinematicTable | undefined = undefined;
  private rollCenterTableRear: KinematicTable | undefined = undefined;
  private bumpStopRateTableFront: KinematicTable | undefined = undefined;
  private bumpStopRateTableRear: KinematicTable | undefined = undefined;

  // ---- M1 tire params (resolved from preset in applyVehiclePhysicsPreset) -----
  private tireColdKpa = TIRE_PRESSURE_COLD_KPA;
  private tireOptimalKpa = TIRE_PRESSURE_OPTIMAL_KPA;
  private tireRadialStiffnessNpm = TIRE_RADIAL_STIFFNESS_NPM;
  private tireRadialDampingNspm = TIRE_RADIAL_DAMPING_NSPM;

  // ---- M2 FFB pipeline state -------------------------------------------
  /** FFB geometry resolved from the active vehicle preset. */
  private ffbGeometry: FfbGeometry = {};
  /** Last FFB result — carried for snapshot / HUD even between ticks. */
  private lastFfbResult = {
    rackForce: 0,
    kpiTorqueNm: 0,
    mzContributionNm: 0,
    fxCouplingNm: 0,
    totalRawNm: 0,
    assistScale: 0,
  };

  // Wheels (4)
  private readonly wheels: WheelState[] = [];

  // Driver aids
  private readonly driverAids: DriverAidsState = {
    absEnabled: true,
    tcEnabled: true,
    escEnabled: false,
    absThreshold: 0.18,
    absReleaseTime: 0.05,
    tcThreshold: 0.12,
    tcWindow: 0.18,
    escMinSpeedKmh: 30,
    escOversteerThreshold: 0.2,
    escUndersteerThreshold: 0.2,
    escMaxBrakeTorque: 2400,
    escTorqueByWheel: [0, 0, 0, 0],
    escTorqueTargetByWheel: [0, 0, 0, 0],
    escApplyRate: 6,
    escReleaseRate: 8,
    absActive: false,
    absEventCount: 0,
    tcCut: 0,
    driveSlip: 0,
    escActive: false,
  };

  readonly input = new RacingInput({
    alignFeedback: () =>
      this.steeringAlignFeedback * this.alignGeometry.steeringAlignCentreRateScale,
  });

  private surfaceLookup: SurfaceLookup | null = null;
  private terrainContact: TerrainContact | null = null;
  private centerline: SampledPoint[] = [];
  private simTime = 0;

  // Lap timer
  private lap = {
    bestMs: null as number | null,
    lastMs: null as number | null,
    t0: null as number | null,
    prevSign: 0,
  };

  // Derived
  speedKmh = 0;
  driftState = 'IDLE';
  sideslipRad = 0;
  yawRateRad = 0;
  accelLongG = 0;
  accelLatG = 0;
  private readonly prevLocalVelocity = new Vector3();
  private lastStepDt = 1 / 240;
  rollDeg = 0;
  pitchDeg = 0;
  rearLockPct = 0;
  frontLoadPct = 50;
  leftLoadPct = 50;

  constructor(config: RacingEngineConfig) {
    this.vehicle = config.vehicle;
    this.trackPreset = config.track;
    this.setup = { ...DEFAULT_SETUP, ...(config.setup ?? {}) };
    this.audio = config.audio ?? new NullAudioBus();
    this.applyVehiclePhysicsPreset();
    this.buildWheels();
    this.buildCompliance(config.physicsContext);
    // Apply M7 setup fields (damper scalers, diff, springs override, etc.)
    // after preset and wheel build so all base values are initialised.
    this.setSetup(this.setup);
    this.buildSurfaceLookup();
    this.resetCar();
  }

  setVehiclePreset(preset: VehiclePreset): void {
    this.vehicle = preset;
    this.applyVehiclePhysicsPreset();
    this.buildWheels();
    this.buildCompliance(this.joltCtx ?? undefined);
    this.resetCar();
  }

  setTrack(preset: TrackPreset): void {
    this.trackPreset = preset;
    this.buildSurfaceLookup();
    this.resetCar();
    this.lap = { bestMs: null, lastMs: null, t0: null, prevSign: 0 };
  }

  setSetup(setup: SetupValues): void {
    this.setup = setup;

    // ---- pre-M7 suspension geometry ------------------------------------
    this.susp.motionRatioFront = setup.motionRatioFront;
    this.susp.motionRatioRear = setup.motionRatioRear;
    this.susp.bumpStopGapFrontM = setup.bumpStopGapFrontMm * 0.001;
    this.susp.bumpStopGapRearM = setup.bumpStopGapRearMm * 0.001;
    this.susp.bumpStopRateFront = setup.bumpStopRateFrontNmm * 1000;
    this.susp.bumpStopRateRear = setup.bumpStopRateRearNmm * 1000;

    // ---- M7: springs ---------------------------------------------------
    // 0 = "use preset value" sentinel; non-zero overrides the preset.
    // Guard against undefined (old pre-M7 setup objects passed at runtime).
    const physics = this.vehicle.physics;
    const springFront = setup.springFrontNpm ?? 0;
    this.susp.kFront = springFront > 0
      ? springFront
      : (physics?.springFrontNpm ?? 65000);
    const springRear = setup.springRearNpm ?? 0;
    this.susp.kRear = springRear > 0
      ? springRear
      : (physics?.springRearNpm ?? 60000);

    // ---- M7: damper scalers --------------------------------------------
    this.susp.cBumpFront = this.susp.kBumpFrontBase * (setup.damperBumpFrontScale ?? 1.0);
    this.susp.cReboundFront = this.susp.kReboundFrontBase * (setup.damperReboundFrontScale ?? 1.0);
    this.susp.cBumpRear = this.susp.kBumpRearBase * (setup.damperBumpRearScale ?? 1.0);
    this.susp.cReboundRear = this.susp.kReboundRearBase * (setup.damperReboundRearScale ?? 1.0);

    // ---- M7: diff ------------------------------------------------------
    this.drivetrainParams.diffPowerRamp = setup.diffPowerRamp ?? DEFAULT_SETUP.diffPowerRamp;
    this.drivetrainParams.diffCoastRamp = setup.diffCoastRamp ?? DEFAULT_SETUP.diffCoastRamp;
    this.drivetrainParams.diffPreloadNm = setup.diffPreloadNm ?? DEFAULT_SETUP.diffPreloadNm;

    // ---- M7: ride height -----------------------------------------------
    const rhFront = (setup.rideHeightFrontMm ?? 0) * 0.001;
    const rhRear = (setup.rideHeightRearMm ?? 0) * 0.001;
    this.susp.restLenFront = this.susp.restLen + rhFront;
    this.susp.restLenRear = this.susp.restLen + rhRear;

    // ---- M7: brake bias ------------------------------------------------
    this.setupBrakeBiasFront = setup.brakeBiasFront ?? DEFAULT_SETUP.brakeBiasFront;

    // ---- M7: fuel load -------------------------------------------------
    const fuelMassKg = (setup.fuelLoad ?? DEFAULT_SETUP.fuelLoad) * MAX_FUEL_MASS_KG;
    this.chassisMass = this.baseChassisMass + fuelMassKg;

    // ---- M7: final drive scale -----------------------------------------
    this.setupFinalDriveScale = setup.finalDriveScale ?? DEFAULT_SETUP.finalDriveScale;

    // ---- per-wheel: toe, camber, per-corner pressure -------------------
    const flKpa = setup.tirePressureFLKpa ?? DEFAULT_SETUP.tirePressureFLKpa;
    const frKpa = setup.tirePressureFRKpa ?? DEFAULT_SETUP.tirePressureFRKpa;
    const rlKpa = setup.tirePressureRLKpa ?? DEFAULT_SETUP.tirePressureRLKpa;
    const rrKpa = setup.tirePressureRRKpa ?? DEFAULT_SETUP.tirePressureRRKpa;
    const cornerPressures = [flKpa, frKpa, rlKpa, rrKpa];
    for (let i = 0; i < this.wheels.length; i++) {
      const isFront = i < 2;
      const w = this.wheels[i];
      w.toeDeg = isFront ? setup.frontToeDeg : setup.rearToeDeg;
      w.camberStaticDeg = isFront
        ? (setup.camberFrontDeg ?? DEFAULT_SETUP.camberFrontDeg)
        : (setup.camberRearDeg ?? DEFAULT_SETUP.camberRearDeg);
      w.camberDeg = w.camberStaticDeg;
      w.pressureKpa = cornerPressures[i];
    }
    // Keep tireColdKpa in sync with the per-corner average so thermal
    // equilibration targets the correct nominal.
    this.tireColdKpa = (flKpa + frKpa + rlKpa + rrKpa) * 0.25;
  }

  setAbsEnabled(enabled: boolean): void {
    this.driverAids.absEnabled = enabled;
    if (!enabled) {
      this.driverAids.absActive = false;
      this.driverAids.absEventCount = 0;
      for (const wheel of this.wheels) {
        wheel.absRelease = 1;
        wheel.absActive = false;
      }
    }
  }

  setTcEnabled(enabled: boolean): void {
    this.driverAids.tcEnabled = enabled;
    if (!enabled) {
      this.driverAids.tcCut = 0;
      this.driverAids.driveSlip = 0;
    }
  }

  setEscEnabled(enabled: boolean): void {
    this.driverAids.escEnabled = enabled;
    if (!enabled) {
      this.driverAids.escActive = false;
      this.driverAids.escTorqueByWheel.fill(0);
      this.driverAids.escTorqueTargetByWheel.fill(0);
      for (const wheel of this.wheels) {
        wheel.escTorque = 0;
      }
    }
  }

  setCameraMode(mode: CameraMode): void {
    this.cameraMode = mode;
  }

  cycleCameraMode(): CameraMode {
    const order: CameraMode[] = ['chase', 'hood', 'far', 'map'];
    const idx = order.indexOf(this.cameraMode);
    this.cameraMode = order[(idx + 1) % order.length];
    return this.cameraMode;
  }

  /** M8: set the lead car for slipstream / wake-field drag reduction. */
  setLeadCarState(pos: { x: number; y: number; z: number }, vel: { x: number; y: number; z: number }): void {
    if (!this.leadCarState) {
      this.leadCarState = { pos: new Vector3(), vel: new Vector3() };
    }
    this.leadCarState.pos.set(pos.x, pos.y, pos.z);
    this.leadCarState.vel.set(vel.x, vel.y, vel.z);
  }

  /** M8: clear the lead car so wake-field drag reduction is disabled. */
  clearLeadCarState(): void {
    this.leadCarState = null;
  }

  /**
   * Advance the camera rig by one frame using the chassis pose. This avoids
   * exposing Three.js Vector3 to the route layer — callers just provide `dt`.
   */
  updateCamera(dt: number): void {
    const forward = new Vector3(0, 0, -1).applyQuaternion(this.worldQuat);
    this.cameras.step({
      carPosition: this.worldPos,
      carForward: forward,
      dt,
      mode: this.cameraMode,
    });
  }

  cameraPose(): {
    position: { x: number; y: number; z: number };
    target: { x: number; y: number; z: number };
    up: { x: number; y: number; z: number };
  } {
    const s = this.cameras.state;
    return {
      position: { x: s.position.x, y: s.position.y, z: s.position.z },
      target: { x: s.target.x, y: s.target.y, z: s.target.z },
      up: { x: s.up.x, y: s.up.y, z: s.up.z },
    };
  }

  wheelPoses(): Array<{
    index: number;
    position: { x: number; y: number; z: number };
    spinAngle: number;
    steerAngle: number;
  }> {
    return this.wheels.map((wheel) => {
      let center: Vector3;
      if (this.complianceActive) {
        // M9: hub position is the wheel center when compliance is active.
        center = wheel.posLocal.clone().applyQuaternion(this.worldQuat).add(this.worldPos);
      } else {
        const attachLocal = new Vector3(wheel.posLocal.x, wheel.posLocal.y + 0.47, wheel.posLocal.z);
        const attachWorld = attachLocal.clone().applyQuaternion(this.worldQuat).add(this.worldPos);
        const downDir = new Vector3(0, -1, 0).applyQuaternion(this.worldQuat).normalize();
        const suspensionTravel = this.susp.restLen - wheel.compression;
        center = attachWorld.clone().addScaledVector(downDir, suspensionTravel);
      }
      return {
        index: wheel.index,
        position: { x: center.x, y: center.y, z: center.z },
        spinAngle: wheel.spinAngle,
        steerAngle: wheel.steerAngle,
      };
    });
  }

  resetCar(): void {
    const spawn = this.computeSpawnPose();
    // M4: spawn height accounts for authored terrain at the spawn point.
    const spawnGroundY = this.surfaceLookup?.groundYAt(spawn.x, spawn.z) ?? 0;
    this.worldPos.set(spawn.x, spawnGroundY + this.susp.restLen + 0.34 + 0.05, spawn.z);
    this.worldQuat.copy(spawn.quat);
    this.velocityWS.set(0, 0, 0);
    this.omegaWS.set(0, 0, 0);
    this.appliedForce.set(0, 0, 0);
    this.appliedTorque.set(0, 0, 0);
    this.prevLocalVelocity.set(0, 0, 0);
    this.lastStepDt = 1 / 240;
    this.engineOmega = ENGINE_IDLE_OMEGA;
    this.transmissionOmega = ENGINE_IDLE_OMEGA;
    this.engineDriveTorqueNm = 0;
    this.engineDragTorqueNm = 0;
    this.steeringAlignFeedback = 0;
    this.gearIndex = 1; // Neutral
    // M6: reset turbo and shift state on car reset.
    if (this.turboState) {
      this.turboState = makeTurboState();
    }
    this.shiftState = makeShiftState();
    this.complianceState = makeDrivelineComplianceState();
    this.complianceSpringNm = 0;
    for (const w of this.wheels) {
      w.omega = 0;
      w.spinAngle = 0;
      w.absRelease = 0;
      w.absActive = false;
      w.absScale = 1;
      w.escTorque = 0;
      w.brakeTorqueApplied = 0;
      w.yawContribution = 0;
      w.tempC = TIRE_AMBIENT_C;
      w.brakeTempC = TIRE_AMBIENT_C;
      w.brakeFade = 1;
      w.tireWear = 0;
      w.flatSpotSignal = 0;
      w.prevCompression = 0;
      w.slipRatio = 0;
      w.slipAngle = 0;
      w.slipRatioTarget = 0;
      w.slipAngleTarget = 0;
      w.slipRatioDynamic = 0;
      w.slipAngleDynamic = 0;
      w._externalTorque = 0;
      // M1 thermal / pressure / vertical reset
      w.thermalZones = { inner: TIRE_AMBIENT_C, middle: TIRE_AMBIENT_C, outer: TIRE_AMBIENT_C };
      // M7: use per-corner cold pressures from setup; fall back to average
      // tireColdKpa for wheels without individual assignments or when the
      // setup object pre-dates M7 and these fields are missing.
      const cornerPressures = [
        this.setup.tirePressureFLKpa ?? this.tireColdKpa,
        this.setup.tirePressureFRKpa ?? this.tireColdKpa,
        this.setup.tirePressureRLKpa ?? this.tireColdKpa,
        this.setup.tirePressureRRKpa ?? this.tireColdKpa,
      ];
      w.pressureKpa = cornerPressures[w.index] ?? this.tireColdKpa;
      w.tireDeflection = 0;
      w.tireDeflectionRate = 0;
      w.kappaPeak = 0;
      w.alphaPeakRad = 0;
      w.relaxationLengthLongM = TIRE_RELAXATION_LENGTH_LONG_M;
      w.relaxationLengthLatM = TIRE_RELAXATION_LENGTH_LAT_M;
      w.slidingGripScale = 1;
      w.slidingSpeedMps = 0;
      w.pressureInner = 0.25;
      w.pressureMiddle = 0.5;
      w.pressureOuter = 0.25;
      w.pressureCentroidM = 0;
      w.overturningMomentNm = 0;
      // M3 kinematic reset
      w.rollCenterHeightM = DEFAULT_ROLL_CENTER_HEIGHT_M;
      w.jackingForceN = 0;
    }
    // M9: reset hub states.
    if (this.complianceActive) {
      if (this.useJolt && this.joltCtx && this.joltHubBodies) {
        const { jolt, bodyInterface } = this.joltCtx;
        const { chassisBody, hubBodies } = this.joltHubBodies;
        writeJoltBodyPose(jolt, bodyInterface, chassisBody, this.worldPos, this.worldQuat, this.velocityWS, this.omegaWS);
        for (let i = 0; i < hubBodies.length; i++) {
          const pos = this.hubPickupLocal[i].clone().applyQuaternion(this.worldQuat).add(this.worldPos);
          writeJoltBodyPose(jolt, bodyInterface, hubBodies[i], pos, this.worldQuat, new Vector3(0,0,0), new Vector3(0,0,0));
        }
      } else {
        for (let i = 0; i < this.softwareHubs.length; i++) {
          const hub = this.softwareHubs[i];
          hub.pos.copy(this.hubPickupLocal[i].clone().applyQuaternion(this.worldQuat).add(this.worldPos));
          hub.quat.copy(this.worldQuat);
          hub.vel.set(0, 0, 0);
          hub.omega.set(0, 0, 0);
        }
      }
    }
    this.lap.t0 = null;
    this.lap.prevSign = 0;
  }

  /** Drive the simulation forward by `dt` seconds of wall-clock time. */
  tick(dt: number): { steps: number; alpha: number } {
    return this.fixedStep.tick(dt, () => this.step(this.fixedStep.stepDt));
  }

  /** Single fixed-step. Public for testing. */
  step(dt: number): void {
    this.simTime += dt;

    this.input.update(dt, this.speedKmh);
    this.updateBasis();

    this.runArbPrepass();
    this.runDrivetrainAndAids(dt);
    this.runWheelPass(dt);
    // Phase 5: integrated rotational chain (engine + clutch + gearbox +
    // diff + driven wheels) advances together using the explicit tire /
    // brake torque the wheel pass just stamped onto each wheel.
    this.runDrivetrainRotationalStep(dt);
    this.runAero();
    this.lastStepDt = dt;

    // M9: compliance path bifurcation.
    if (this.complianceActive) {
      if (this.useJolt && this.joltCtx && this.joltHubBodies) {
        // Jolt path: apply torsional torque to chassis body, then step Jolt.
        this.stepJoltCompliance(dt);
      } else {
        // Software path: explicit spring-damper compliance + chassis integration.
        applyTorsionalRestoringTorqueToVector(
          this.right,
          this.rollDeg,
          this.complianceConfig,
          this.appliedTorque,
        );
        const wheelForces = this.wheels.map((w) => w._wheelForce);
        stepComplianceSoftware(
          {
            pos: this.worldPos,
            quat: this.worldQuat,
            vel: this.velocityWS,
            omega: this.omegaWS,
            mass: this.chassisMass,
            inertia: this.chassisInertia,
          },
          this.softwareHubs,
          this.hubPickupLocal,
          wheelForces,
          this.appliedForce.clone(),
          this.appliedTorque.clone(),
          this.complianceConfig,
          dt,
        );
        this.appliedForce.set(0, 0, 0);
        this.appliedTorque.set(0, 0, 0);
        this.syncSoftwareHubsToWheels();
      }
    } else {
      // Rigid fallback — exact pre-M9 code path.
      this.integrateChassis(dt);
    }

    this.updateChassisDerived();
    this.updateLapTimer(this.simTime);
    this.audio.setRpm(this.engineOmega * (60 / (2 * Math.PI)));

    this.events.emit('tick', { simTime: this.simTime, dt });

    // M2 FFB pipeline — run after the wheel pass so front-wheel Fz/Fy/Mz/Fx
    // are fully resolved for this step.
    this.lastFfbResult = computeRackForce({
      speedKmh: this.speedKmh,
      fyFL: this.wheels[0].fy,
      fyFR: this.wheels[1].fy,
      fzFL: this.wheels[0].fz,
      fzFR: this.wheels[1].fz,
      mzFL: this.wheels[0].mz,
      mzFR: this.wheels[1].mz,
      fxFL: this.wheels[0].fx,
      fxFR: this.wheels[1].fx,
      steerNorm: this.input.state.steerSmoothed,
      geometry: this.ffbGeometry,
    });
    this.events.emit('ffbRackForce', {
      simTime: this.simTime,
      ...this.lastFfbResult,
    });
  }

  snapshot(): RacingEngineSnapshot {
    const gear = this.vehicle.gears[this.gearIndex];
    const frontSlipDeg = Math.abs((this.wheels[0].slipAngle + this.wheels[1].slipAngle) * 0.5 * DEG);
    const rearSlipDeg = Math.abs((this.wheels[2].slipAngle + this.wheels[3].slipAngle) * 0.5 * DEG);
    const rearSlipRatio = Math.abs((this.wheels[2].slipRatio + this.wheels[3].slipRatio) * 0.5);
    const ackermannDeltaDeg = Math.abs((this.wheels[0].baseSteerAngle - this.wheels[1].baseSteerAngle) * DEG);
    return {
      speedKmh: this.speedKmh,
      rpm: this.engineOmega * (60 / (2 * Math.PI)),
      gearLabel: gear?.n ?? 'N',
      gearIndex: this.gearIndex,
      driftState: this.driftState,
      sideslipDeg: this.sideslipRad * DEG,
      yawRateRad: this.yawRateRad,
      rollDeg: this.rollDeg,
      pitchDeg: this.pitchDeg,
      rearLockPct: this.rearLockPct,
      rearSlipRatio,
      frontSlipDeg,
      rearSlipDeg,
      frontLoadPct: this.frontLoadPct,
      leftLoadPct: this.leftLoadPct,
      ackermannDeltaDeg,
      frontToeDeg: this.setup.frontToeDeg,
      rearToeDeg: this.setup.rearToeDeg,
      casterDeg: this.setup.casterDeg,
      accelLongG: this.accelLongG,
      accelLatG: this.accelLatG,
      aids: {
        absEnabled: this.driverAids.absEnabled,
        tcEnabled: this.driverAids.tcEnabled,
        escEnabled: this.driverAids.escEnabled,
        absActive: this.driverAids.absActive,
        tcActive: this.driverAids.tcCut > 0.01,
        escActive: this.driverAids.escActive,
        tcCut: this.driverAids.tcCut,
      },
      wheels: this.wheels.map((w, i) => {
        const ceiling = Math.max(1e-3, w.mu * w.fz);
        const tireUtilization = Math.hypot(w.fx, w.fy) / ceiling;
        return {
          index: w.index,
          fz: w.fz,
          fx: w.fx,
          fy: w.fy,
          mz: w.mz,
          slipRatio: w.slipRatio,
          slipAngle: w.slipAngle,
          slipRatioTarget: w.slipRatioTarget,
          slipAngleTarget: w.slipAngleTarget,
          slipRatioDynamic: w.slipRatioDynamic,
          slipAngleDynamic: w.slipAngleDynamic,
          camberRad: w.camberRad,
          combinedSlip: w.combinedSlip,
          mu: w.mu,
          tireUtilization,
          surface: w.surface,
          tempC: w.tempC,
          brakeTempC: w.brakeTempC,
          tireWear: w.tireWear,
          flatSpotSignal: w.flatSpotSignal,
          bumpStopPct: w.bumpStopPct,
          brakeTorqueApplied: w.brakeTorqueApplied,
          absScale: w.absScale,
          absActive: w.absActive,
          yawContribution: w.yawContribution,
          driveTorqueNm: this.driveTorqueByWheel[i] ?? 0,
          // M1 multi-zone thermal + pressure + slip-peak diagnostics
          tempInner: w.thermalZones.inner,
          tempMiddle: w.thermalZones.middle,
          tempOuter: w.thermalZones.outer,
          pressureKpa: w.pressureKpa,
          kappaPeak: w.kappaPeak,
          alphaPeakRad: w.alphaPeakRad,
          tireDeflection: w.tireDeflection,
          relaxationLengthLongM: w.relaxationLengthLongM,
          relaxationLengthLatM: w.relaxationLengthLatM,
          slidingGripScale: w.slidingGripScale,
          slidingSpeedMps: w.slidingSpeedMps,
          pressureInner: w.pressureInner,
          pressureMiddle: w.pressureMiddle,
          pressureOuter: w.pressureOuter,
          pressureCentroidM: w.pressureCentroidM,
          overturningMomentNm: w.overturningMomentNm,
          // M3 suspension kinematics diagnostics
          suspensionTravel: w.compression,
          damperVelocity: w.damperVelocity,
          rollCenterHeightM: w.rollCenterHeightM,
          jackingForceN: w.jackingForceN,
          toeDeg: w.toeDeg,
          camberDeg: w.camberDeg,
          // M9 compliance telemetry
          hubDeflectionMm: this.complianceActive
            ? w.posLocal.clone().sub(this.hubPickupLocal[w.index]).length() * 1000
            : 0,
        };
      }),
      drivetrain: {
        engineOmega: this.engineOmega,
        transmissionOmega: this.transmissionOmega,
        clutchTorqueNm: this.clutchTorqueNm,
        clutchMode: this.clutchMode,
        engineDriveTorqueNm: this.engineDriveTorqueNm,
        engineDragTorqueNm: this.engineDragTorqueNm,
        // M6 drivetrain depth
        boostBar: this.turboState?.boostBar ?? 0,
        turboSpoolRatio: this.turboState?.spoolRatio ?? 0,
        boostTorqueMultiplier: this.turboState?.torqueMultiplier ?? 1,
        isOverboost: this.turboState?.isOverboost ?? false,
        shiftRefused: this.shiftState.lastRefused,
        shiftRefusalReason: this.shiftState.lastRefusalReason,
        shiftInProgress: this.shiftState.inProgress,
        shiftRemainingS: this.shiftState.inProgress
          ? Math.max(0, this.shiftState.totalTimeS - this.shiftState.elapsedS)
          : 0,
        drivelineComplianceTwistRad: this.complianceState.twistRad,
        drivelineComplianceSpringNm: this.complianceSpringNm,
      },
      aero: {
        frontDownforceN: this.lastAeroDownforce.front,
        rearDownforceN: this.lastAeroDownforce.rear,
        dragN: this.aeroDragMagN,
        hasAeroMap: this.aeroMapPreset !== undefined,
        effectiveClAreaFront: this.lastAeroResult.effectiveClAreaFront,
        effectiveClAreaRear: this.lastAeroResult.effectiveClAreaRear,
        copFraction: this.lastAeroResult.copFraction,
        frontStalled: this.lastAeroResult.frontStalled,
        rearStalled: this.lastAeroResult.rearStalled,
        frontRideHeightM: this.lastAeroResult.frontRideHeightM,
        rearRideHeightM: this.lastAeroResult.rearRideHeightM,
        wakeReduction: this.lastAeroResult.wakeReduction,
      },
      lap: { lastMs: this.lap.lastMs, bestMs: this.lap.bestMs, t0: this.lap.t0 },
      ffb: { ...this.lastFfbResult },
      trackCondition: {
        trackTempC: this.trackPreset.trackTempC ?? 28,
        rubberLineGrip: this.trackPreset.rubberLineGrip ?? 1,
        terrainActive: !(this.terrainContact?.isFlat ?? true),
        bumpAmplitudeM: this.trackPreset.bumpAmplitudeM ?? 0,
        wetness: sanitizeTrackWetness(this.trackPreset.wetness),
        condition: sanitizeTrackCondition(this.trackPreset.condition),
      },
    };
  }

  exportTelemetry(): RacingTelemetryExport {
    const snap = this.snapshot();
    const sample: RacingTelemetrySample = {
      lap: {
        lastMs: snap.lap.lastMs,
        bestMs: snap.lap.bestMs,
        currentStartS: snap.lap.t0,
      },
      timeS: this.simTime,
      speedKmh: snap.speedKmh,
      rpm: snap.rpm,
      accelLongG: snap.accelLongG,
      accelLatG: snap.accelLatG,
      wheels: snap.wheels.map((w) => ({
        index: w.index,
        tireWear: w.tireWear,
        flatSpotSignal: w.flatSpotSignal,
        slipRatio: w.slipRatio,
        slipAngle: w.slipAngle,
        slidingSpeedMps: w.slidingSpeedMps,
        slidingGripScale: w.slidingGripScale,
        relaxationLengthLongM: w.relaxationLengthLongM,
        relaxationLengthLatM: w.relaxationLengthLatM,
        pressureInner: w.pressureInner,
        pressureMiddle: w.pressureMiddle,
        pressureOuter: w.pressureOuter,
        overturningMomentNm: w.overturningMomentNm,
        tempC: w.tempC,
        brakeTempC: w.brakeTempC,
        surface: w.surface,
      })),
    };
    const channels: Record<string, number[]> = {
      timeS: [sample.timeS],
      speedKmh: [sample.speedKmh],
      rpm: [sample.rpm],
      accelLongG: [sample.accelLongG],
      accelLatG: [sample.accelLatG],
    };
    for (const wheel of sample.wheels) {
      const name = WHEEL_CHANNEL_NAMES[wheel.index] ?? `W${wheel.index}`;
      channels[`tireWear${name}`] = [wheel.tireWear];
      channels[`flatSpot${name}`] = [wheel.flatSpotSignal];
      channels[`slipRatio${name}`] = [wheel.slipRatio];
      channels[`slipAngle${name}`] = [wheel.slipAngle];
      channels[`slidingSpeedMps${name}`] = [wheel.slidingSpeedMps];
      channels[`slidingGripScale${name}`] = [wheel.slidingGripScale];
      channels[`relaxationLongM${name}`] = [wheel.relaxationLengthLongM];
      channels[`relaxationLatM${name}`] = [wheel.relaxationLengthLatM];
      channels[`pressureInner${name}`] = [wheel.pressureInner];
      channels[`pressureMiddle${name}`] = [wheel.pressureMiddle];
      channels[`pressureOuter${name}`] = [wheel.pressureOuter];
      channels[`overturningMomentNm${name}`] = [wheel.overturningMomentNm];
      channels[`tireTempC${name}`] = [wheel.tempC];
      channels[`brakeTempC${name}`] = [wheel.brakeTempC];
    }
    return {
      version: 1,
      trackId: this.trackPreset.id,
      vehicleId: this.vehicle.id,
      exportedAtSimTimeS: this.simTime,
      lap: sample.lap,
      samples: [sample],
      channels,
    };
  }

  dispose(): void {
    this.events.removeAll();
    this.input.detach();
    this.audio.dispose();
    this.destroyJoltCompliance();
  }

  shiftUp(): void {
    const rpm = this.engineOmega * (60 / (2 * Math.PI));
    const hasShiftLogic = this.shiftLogicParams.shiftTimeS !== undefined ||
      this.shiftLogicParams.upshiftMinRpm !== undefined ||
      this.shiftLogicParams.downshiftMinRpm !== undefined;
    if (hasShiftLogic) {
      const accepted = requestShift(
        'up',
        this.gearIndex,
        this.vehicle.gears.length,
        rpm,
        this.shiftState,
        this.shiftLogicParams,
      );
      // Instantaneous shift (shiftTimeS === 0) applies immediately.
      if (accepted && !this.shiftState.inProgress && this.shiftState.targetGearIndex >= 0) {
        this.gearIndex = this.shiftState.targetGearIndex;
        this.shiftState.targetGearIndex = -1;
      }
    } else {
      if (this.gearIndex < this.vehicle.gears.length - 1) this.gearIndex++;
    }
  }
  shiftDown(): void {
    const rpm = this.engineOmega * (60 / (2 * Math.PI));
    const hasShiftLogic = this.shiftLogicParams.shiftTimeS !== undefined ||
      this.shiftLogicParams.upshiftMinRpm !== undefined ||
      this.shiftLogicParams.downshiftMinRpm !== undefined;
    if (hasShiftLogic) {
      const accepted = requestShift(
        'down',
        this.gearIndex,
        this.vehicle.gears.length,
        rpm,
        this.shiftState,
        this.shiftLogicParams,
      );
      if (accepted && !this.shiftState.inProgress && this.shiftState.targetGearIndex >= 0) {
        this.gearIndex = this.shiftState.targetGearIndex;
        this.shiftState.targetGearIndex = -1;
      }
    } else {
      if (this.gearIndex > 0) this.gearIndex--;
    }
  }

  // ---- internal helpers --------------------------------------------------

  private applyVehiclePhysicsPreset(): void {
    const physics = this.vehicle.physics;
    this.baseChassisMass = physics?.massKg ?? 1240;
    this.chassisMass = this.baseChassisMass + (this.setup.fuelLoad ?? DEFAULT_SETUP.fuelLoad) * MAX_FUEL_MASS_KG;
    // Body axes are x=roll, y=yaw, z=pitch.
    this.chassisInertia.set(
      physics?.inertiaRollKgM2 ?? 450,
      physics?.inertiaYawKgM2 ?? 1700,
      physics?.inertiaPitchKgM2 ?? 1500,
    );
    // Store preset base values; setSetup() applies scalers on top of these.
    this.susp.kFront = physics?.springFrontNpm ?? 65000;
    this.susp.kRear = physics?.springRearNpm ?? 60000;
    this.susp.kBumpFrontBase = physics?.damperBumpFrontNsPm ?? 4200;
    this.susp.kReboundFrontBase = physics?.damperReboundFrontNsPm ?? 5800;
    this.susp.kBumpRearBase = physics?.damperBumpRearNsPm ?? 4400;
    this.susp.kReboundRearBase = physics?.damperReboundRearNsPm ?? 6000;
    this.susp.cBumpFront = this.susp.kBumpFrontBase;
    this.susp.cReboundFront = this.susp.kReboundFrontBase;
    this.susp.cBumpRear = this.susp.kBumpRearBase;
    this.susp.cReboundRear = this.susp.kReboundRearBase;
    // M7: initialise per-axle rest lengths; setSetup() adds the ride-height
    // offset on top.  Restoring from a preset resets the offset to 0.
    this.susp.restLenFront = this.susp.restLen;
    this.susp.restLenRear = this.susp.restLen;
    // M7: reset setup-driven scalar overrides to neutral.
    this.setupBrakeBiasFront = this.setup.brakeBiasFront ?? DEFAULT_SETUP.brakeBiasFront;
    this.setupFinalDriveScale = this.setup.finalDriveScale ?? DEFAULT_SETUP.finalDriveScale;
    this.arbFront = physics?.arbFrontNpm ?? 25000;
    this.arbRear = physics?.arbRearNpm ?? 22000;
    this.cdA = physics?.cdAreaM2 ?? 0.7;
    this.cyYaw = physics?.yawAeroCoeff ?? 0.1;
    this.clAreaFront = Math.max(0, physics?.clAreaFrontM2 ?? 0);
    this.clAreaRear = Math.max(0, physics?.clAreaRearM2 ?? 0);
    // M5: resolve aero map from preset (cast is safe: structural types match).
    this.aeroMapPreset = physics?.aeroMap as AeroMapPreset | undefined;
    this.lastAeroDownforce.front = 0;
    this.lastAeroDownforce.rear = 0;
    this.lastAeroResult = {
      effectiveClAreaFront: 0,
      effectiveClAreaRear: 0,
      copFraction: 0.5,
      frontStalled: false,
      rearStalled: false,
      frontRideHeightM: 0.1,
      rearRideHeightM: 0.1,
      wakeReduction: 0,
    };
    this.cgHeightM = physics?.cgHeightM ?? DEFAULT_CG_HEIGHT_M;
    this.sprungCgHeightM = physics?.sprungCgHeightM ?? this.cgHeightM;
    this.unsprungCgHeightM = physics?.unsprungCgHeightM ?? DEFAULT_UNSPRUNG_CG_HEIGHT_M;
    this.unsprungMassFrontKg = physics?.unsprungMassFrontKg ?? DEFAULT_UNSPRUNG_MASS_PER_AXLE_KG;
    this.unsprungMassRearKg = physics?.unsprungMassRearKg ?? DEFAULT_UNSPRUNG_MASS_PER_AXLE_KG;
    this.alignGeometry = {
      pneumaticTrail0M: physics?.pneumaticTrail0M ?? DEFAULT_PNEUMATIC_TRAIL_0_M,
      pneumaticTrailDecayDeg:
        physics?.pneumaticTrailDecayDeg ?? DEFAULT_PNEUMATIC_TRAIL_DECAY_DEG,
      casterTrailScaleMPerDeg:
        physics?.casterTrailScaleMPerDeg ?? DEFAULT_CASTER_TRAIL_SCALE_M_PER_DEG,
      mechanicalTrailMaxM: physics?.mechanicalTrailMaxM ?? DEFAULT_MECHANICAL_TRAIL_MAX_M,
      scrubRadiusM: physics?.scrubRadiusM ?? DEFAULT_SCRUB_RADIUS_M,
      steeringAlignTorqueMaxNm:
        physics?.steeringAlignTorqueMaxNm ?? DEFAULT_STEERING_ALIGN_TORQUE_MAX_NM,
      steeringAlignCentreRateScale:
        physics?.steeringAlignCentreRateScale ?? DEFAULT_STEERING_ALIGN_CENTRE_RATE_SCALE,
    };
    this.steeringAlignFeedback = 0;
    const defaults = makeDefaultDrivetrainParams(this.vehicle.diffType);
    this.drivetrainParams = {
      engineInertia: physics?.engineInertiaKgM2 ?? defaults.engineInertia,
      flywheelInertia: physics?.flywheelInertiaKgM2 ?? defaults.flywheelInertia,
      gearboxInputInertia: physics?.gearboxInputInertiaKgM2 ?? defaults.gearboxInputInertia,
      propshaftInertia: physics?.propshaftInertiaKgM2 ?? defaults.propshaftInertia,
      diffInertia: physics?.diffInertiaKgM2 ?? defaults.diffInertia,
      clutchMaxTorqueNm: physics?.clutchMaxTorqueNm ?? defaults.clutchMaxTorqueNm,
      clutchStaticFactor: physics?.clutchStaticFactor ?? defaults.clutchStaticFactor,
      clutchStickThresholdRadPerSec:
        physics?.clutchStickThresholdRadPerSec ?? defaults.clutchStickThresholdRadPerSec,
      drivetrainSubsteps: physics?.drivetrainSubsteps ?? defaults.drivetrainSubsteps,
      diffType: this.vehicle.diffType,
      diffPreloadNm: physics?.diffPreloadNm ?? defaults.diffPreloadNm,
      diffCapacityNm: physics?.diffCapacityNm ?? defaults.diffCapacityNm,
      diffPowerRamp: physics?.diffPowerRamp ?? defaults.diffPowerRamp,
      diffCoastRamp: physics?.diffCoastRamp ?? defaults.diffCoastRamp,
      idleOmega: ENGINE_IDLE_OMEGA,
      redlineOmega: ENGINE_REDLINE_OMEGA,
    };
    // M1 tire params
    this.tireColdKpa = physics?.tireColdPressureKpa ?? TIRE_PRESSURE_COLD_KPA;
    this.tireOptimalKpa = physics?.tireOptimalPressureKpa ?? TIRE_PRESSURE_OPTIMAL_KPA;
    this.tireRadialStiffnessNpm = physics?.tireRadialStiffnessNpm ?? TIRE_RADIAL_STIFFNESS_NPM;
    this.tireRadialDampingNspm = physics?.tireRadialDampingNspm ?? TIRE_RADIAL_DAMPING_NSPM;
    // M2 FFB geometry — pick up any preset-supplied overrides; undefined
    // fields fall through to the defaults inside computeRackForce.
    this.ffbGeometry = {
      kpiDeg: physics?.ffbKpiDeg,
      saiScale: physics?.ffbSaiScale,
      scrubRadiusM: physics?.ffbScrubRadiusM,
      casterTrailM: physics?.ffbCasterTrailM,
      ffbMaxNm: physics?.ffbMaxNm,
      ffbGain: physics?.ffbGain,
      assistPeakKmh: physics?.ffbAssistPeakKmh,
      assistMin: physics?.ffbAssistMin,
    };
    // M3 suspension kinematics — resolve from preset; undefined means
    // "no table" and falls back to legacy constant-geometry behaviour.
    this.damperParamsFront = physics?.damperFront;
    this.damperParamsRear = physics?.damperRear;
    this.bumpSteerTableFront = physics?.bumpSteerFront as KinematicTable | undefined;
    this.bumpSteerTableRear = physics?.bumpSteerRear as KinematicTable | undefined;
    this.camberTableFront = physics?.camberTableFront as KinematicTable | undefined;
    this.camberTableRear = physics?.camberTableRear as KinematicTable | undefined;
    this.casterTableFront = physics?.casterTableFront as KinematicTable | undefined;
    this.casterTableRear = physics?.casterTableRear as KinematicTable | undefined;
    this.rollCenterTableFront = physics?.rollCenterTableFront as KinematicTable | undefined;
    this.rollCenterTableRear = physics?.rollCenterTableRear as KinematicTable | undefined;
    this.bumpStopRateTableFront = physics?.bumpStopRateTableFront as KinematicTable | undefined;
    this.bumpStopRateTableRear = physics?.bumpStopRateTableRear as KinematicTable | undefined;
    // M6: resolve turbo, engine map, shift logic, and driveline compliance.
    this.turboParams = physics?.turbo;
    if (this.turboParams) {
      this.turboState = makeTurboState();
    } else {
      this.turboState = undefined;
    }
    this.engineTorqueMap = physics?.engineTorqueMap as EngineTorqueMap | undefined;
    this.engineTorqueCurveOverride = physics?.engineTorqueCurve;
    this.engineBrakingParams = physics?.engineBraking;
    this.shiftLogicParams = (physics?.shiftLogic as ShiftLogicParams | undefined) ?? {};
    this.shiftState = makeShiftState();
    this.complianceParams = (physics?.drivelineCompliance as DrivelineComplianceParams | undefined) ?? {};
    this.complianceState = makeDrivelineComplianceState();
    this.complianceSpringNm = 0;
    // M9: resolve chassis compliance config.
    this.complianceConfig = resolveCompliance(this.vehicle);
    this.complianceActive = hasCompliance(this.vehicle);
  }

  private frontTrackWidthM(): number {
    return this.vehicle.dimensions?.frontTrackWidthM ?? this.vehicle.trackWidth;
  }

  private rearTrackWidthM(): number {
    return this.vehicle.dimensions?.rearTrackWidthM ?? this.vehicle.trackWidth;
  }

  private frontWheelRadiusM(): number {
    return (this.vehicle.tires?.frontOverallDiameterM ?? 0.68) * 0.5;
  }

  private rearWheelRadiusM(): number {
    return (this.vehicle.tires?.rearOverallDiameterM ?? 0.68) * 0.5;
  }

  private buildWheels(): void {
    this.wheels.length = 0;
    const halfFrontTrack = this.frontTrackWidthM() * 0.5;
    const halfRearTrack = this.rearTrackWidthM() * 0.5;
    // Chassis forward = -Z, so front wheels sit at negative Z and rear wheels
    // at positive Z in chassis-local space.
    const frontZ = -this.vehicle.wheelbase * (1 - this.vehicle.frontMassPct);
    const rearZ = this.vehicle.wheelbase * this.vehicle.frontMassPct;
    const positions = [
      new Vector3(-halfFrontTrack, -0.30, frontZ),
      new Vector3(halfFrontTrack, -0.30, frontZ),
      new Vector3(-halfRearTrack, -0.30, rearZ),
      new Vector3(halfRearTrack, -0.30, rearZ),
    ];
    const drive = [
      0.5 * this.vehicle.axleDrive.front,
      0.5 * this.vehicle.axleDrive.front,
      0.5 * this.vehicle.axleDrive.rear,
      0.5 * this.vehicle.axleDrive.rear,
    ];
    const wheelInertia = this.vehicle.physics?.wheelInertiaKgM2 ?? 1.4;
    for (let i = 0; i < 4; i++) {
      const isFront = i < 2;
      this.wheels.push({
        index: i,
        posLocal: positions[i],
        radius: isFront ? this.frontWheelRadiusM() : this.rearWheelRadiusM(),
        inertia: wheelInertia,
        lateralSign: positions[i].x >= 0 ? 1 : -1,
        steer: isFront,
        hand: !isFront,
        drive: drive[i] > 0,
        driveShare: drive[i],
        toeDeg: isFront ? this.setup.frontToeDeg : this.setup.rearToeDeg,
        camberStaticDeg: isFront
          ? (this.setup.camberFrontDeg ?? DEFAULT_SETUP.camberFrontDeg)
          : (this.setup.camberRearDeg ?? DEFAULT_SETUP.camberRearDeg),
        camberGain: 0.4,
        antiDivePct: isFront ? 0.18 : 0,
        antiSquatPct: isFront ? 0 : 0.14,
        steerAngle: 0,
        baseSteerAngle: 0,
        omega: 0,
        spinAngle: 0,
        prevCompression: 0,
        compression: 0,
        damperVelocity: 0,
        bumpStopForce: 0,
        bumpStopPct: 0,
        contact: false,
        surface: 'ASPHALT',
        fz: 0,
        fx: 0,
        fy: 0,
        mz: 0,
        slipRatio: 0,
        slipAngle: 0,
        slipRatioTarget: 0,
        slipAngleTarget: 0,
        slipRatioDynamic: 0,
        slipAngleDynamic: 0,
        camberRad: 0,
        slidePower: 0,
        tempC: TIRE_AMBIENT_C,
        brakeTempC: TIRE_AMBIENT_C,
        brakeFade: 1,
        tireWear: 0,
        flatSpotSignal: 0,
        absRelease: 0,
        absActive: false,
        escTorque: 0,
        brakeTorqueApplied: 0,
        absScale: 1,
        yawContribution: 0,
        mu: 1,
        combinedSlip: 0,
        _preCompression: 0,
        _preContact: false,
        _arbDfz: 0,
        _fxFinal: 0,
        _frx: 0,
        _vx: 0,
        _externalTorque: 0,
        // M9 compliance scratch
        _wheelForce: new Vector3(),
        _wheelTorque: new Vector3(),
        // M1 multi-zone thermal + pressure + vertical
        thermalZones: { inner: TIRE_AMBIENT_C, middle: TIRE_AMBIENT_C, outer: TIRE_AMBIENT_C },
        pressureKpa: [
          this.setup.tirePressureFLKpa ?? this.tireColdKpa,
          this.setup.tirePressureFRKpa ?? this.tireColdKpa,
          this.setup.tirePressureRLKpa ?? this.tireColdKpa,
          this.setup.tirePressureRRKpa ?? this.tireColdKpa,
        ][i],
        tireDeflection: 0,
        tireDeflectionRate: 0,
        kappaPeak: 0,
        alphaPeakRad: 0,
        relaxationLengthLongM: TIRE_RELAXATION_LENGTH_LONG_M,
        relaxationLengthLatM: TIRE_RELAXATION_LENGTH_LAT_M,
        slidingGripScale: 1,
        slidingSpeedMps: 0,
        pressureInner: 0.25,
        pressureMiddle: 0.5,
        pressureOuter: 0.25,
        pressureCentroidM: 0,
        overturningMomentNm: 0,
        // M3 kinematic state
        rollCenterHeightM: DEFAULT_ROLL_CENTER_HEIGHT_M,
        jackingForceN: 0,
        camberDeg: isFront
          ? (this.setup.camberFrontDeg ?? DEFAULT_SETUP.camberFrontDeg)
          : (this.setup.camberRearDeg ?? DEFAULT_SETUP.camberRearDeg),
      });
    }
  }

  private buildSurfaceLookup(): void {
    const points = sampleCentripetal(this.trackPreset.ctrl, this.trackPreset.samples);
    this.centerline = points;
    const zones: { x: number; z: number; w: number; h: number; rot: number; surface: SurfaceId }[] = [];
    for (const z of this.trackPreset.gravelZones ?? []) {
      zones.push({ x: z.x, z: z.z, w: z.w, h: z.h, rot: (z as { rot?: number }).rot ?? 0, surface: 'GRAVEL' });
    }
    for (const z of this.trackPreset.dampZones ?? []) {
      zones.push({ x: z.x, z: z.z, w: z.w, h: z.h, rot: (z as { rot?: number }).rot ?? 0, surface: 'DAMP' });
    }
    for (const z of this.trackPreset.surfaceZones ?? []) {
      zones.push({ x: z.x, z: z.z, w: z.w, h: z.h, rot: z.rot ?? 0, surface: z.surface });
    }

    // M4: build terrain contact from authored elevation/height-field data.
    // Falls back to flat ground (null) for tracks that carry no elevation data.
    const elevationSamples = this.trackPreset.elevationSamples;
    const elevationMap = elevationSamples && elevationSamples.length > 0
      ? new ElevationMap(elevationSamples)
      : null;
    // HeightField path wired in M5+ (full terrain import); null until then.
    this.terrainContact = new TerrainContact(null, elevationMap);

    // M4: kerb profile — use the track-authored profile when present.
    // When absent, use null so existing tracks get flat kerb behavior
    // (preserves backward compatibility for all built-in tracks).
    const kerbProfile = this.trackPreset.kerbProfile ?? null;

    this.surfaceLookup = new SurfaceLookup({
      points,
      halfWidth: this.trackPreset.halfWidth,
      curbWidth: this.trackPreset.curbWidth,
      rubberWidth: this.trackPreset.rubberWidth,
      marblesWidth: this.trackPreset.marblesWidth,
      defaultOffTrack: 'GRASS',
      zones,
      terrain: this.terrainContact,
      kerbProfile,
    });
  }

  // ---- M9: compliance helpers ------------------------------------------

  private buildCompliance(physicsContext?: PhysicsContext): void {
    // Tear down any previous Jolt state.
    this.destroyJoltCompliance();
    this.softwareHubs = [];
    this.hubPickupLocal = [];
    this.useJolt = false;

    if (!this.complianceActive) return;

    // Build shared pickup-local table.
    const frontZ = -this.vehicle.wheelbase * (1 - this.vehicle.frontMassPct);
    const rearZ = this.vehicle.wheelbase * this.vehicle.frontMassPct;
    this.hubPickupLocal = [
      new Vector3(-this.frontTrackWidthM() * 0.5, -0.30, frontZ),
      new Vector3(this.frontTrackWidthM() * 0.5, -0.30, frontZ),
      new Vector3(-this.rearTrackWidthM() * 0.5, -0.30, rearZ),
      new Vector3(this.rearTrackWidthM() * 0.5, -0.30, rearZ),
    ];

    if (physicsContext) {
      const { jolt, physicsSystem, bodyInterface } = physicsContext;
      try {
        const chassisBody = createChassisBody(
          jolt, bodyInterface, this.chassisMass, this.chassisInertia,
          this.worldPos, this.worldQuat,
        );
        if (chassisBody) {
          const hubBodies = createHubBodies(
            jolt, bodyInterface,
            this.hubPickupLocal.map((p) => p.clone().applyQuaternion(this.worldQuat).add(this.worldPos)),
          );
          if (hubBodies && hubBodies.length === 4) {
            const constraints = createComplianceConstraints(
              jolt, physicsSystem, chassisBody, hubBodies, this.vehicle,
            );
            this.joltHubBodies = { chassisBody, hubBodies, constraints };
            this.joltCtx = physicsContext;
            this.useJolt = true;
          }
        }
      } catch {
        this.useJolt = false;
      }
    }

    if (!this.useJolt) {
      this.softwareHubs = createSoftwareHubStates(
        this.hubPickupLocal.map((p) => p.clone().applyQuaternion(this.worldQuat).add(this.worldPos)),
      );
    }
  }

  private destroyJoltCompliance(): void {
    if (!this.joltCtx || !this.joltHubBodies) return;
    try {
      const { jolt, physicsSystem, bodyInterface } = this.joltCtx;
      destroyComplianceBodies(jolt, bodyInterface, physicsSystem, this.joltHubBodies);
    } catch {
      /* swallow disposal errors */
    }
    this.joltHubBodies = null;
    this.joltCtx = null;
    this.useJolt = false;
  }

  private syncSoftwareHubsToWheels(): void {
    if (!this.complianceActive || this.useJolt) return;
    for (let i = 0; i < this.wheels.length; i++) {
      const w = this.wheels[i];
      const hub = this.softwareHubs[i];
      if (!hub) continue;
      // Update wheel pose from hub state for telemetry and renderer.
      // The hub position is the wheel center.
      w.posLocal.copy(hub.pos.clone().sub(this.worldPos).applyQuaternion(this.worldQuat.clone().invert()));
    }
  }

  private computeSpawnPose(): { x: number; z: number; quat: Quaternion } {
    const first = this.centerline[0];
    const next = this.centerline[1] ?? first;
    if (!first) {
      return { x: 0, z: 0, quat: new Quaternion() };
    }
    const tangent = new Vector3(next.x - first.x, 0, next.z - first.z);
    if (tangent.lengthSq() < 1e-6) {
      return { x: first.x, z: first.z, quat: new Quaternion() };
    }
    tangent.normalize();
    // Reference forward is -Z (Three.js convention); align that with the
    // track tangent so the car spawns pointing along the centerline.
    const quat = new Quaternion().setFromUnitVectors(new Vector3(0, 0, -1), tangent);
    return { x: first.x, z: first.z, quat };
  }

  private updateBasis(): void {
    this.forward.set(0, 0, -1).applyQuaternion(this.worldQuat);
    this.right.set(1, 0, 0).applyQuaternion(this.worldQuat);
    this.up.set(0, 1, 0).applyQuaternion(this.worldQuat);
    this.speedKmh = Math.abs(this.velocityWS.dot(this.forward)) * 3.6;
  }

  private runArbPrepass(): void {
    for (const w of this.wheels) {
      const isFront = w.index < 2;
      const restLen = isFront ? this.susp.restLenFront : this.susp.restLenRear;
      const localPos = new Vector3(w.posLocal.x, w.posLocal.y + 0.47, w.posLocal.z);
      const worldAttach = localPos.clone().applyQuaternion(this.worldQuat).add(this.worldPos);
      const downDir = this.up.clone().multiplyScalar(-1);
      const maxLen = restLen + w.radius;
      let comp = 0;
      let inContact = false;
      if (downDir.y < 0) {
        const groundY = this.surfaceLookup?.groundYAt(worldAttach.x, worldAttach.z) ?? 0;
        const t = (groundY - worldAttach.y) / downDir.y;
        if (t > 0 && t <= maxLen) {
          comp = restLen - (t - w.radius);
          inContact = true;
        }
      }
      w._preCompression = comp;
      w._preContact = inContact;
    }
    const front = computeAxleArb({
      arbStiffness: this.arbFront,
      motionRatio: this.susp.motionRatioFront,
      leftCompression: this.wheels[0]._preCompression,
      rightCompression: this.wheels[1]._preCompression,
      leftInContact: this.wheels[0]._preContact,
      rightInContact: this.wheels[1]._preContact,
    });
    const rear = computeAxleArb({
      arbStiffness: this.arbRear,
      motionRatio: this.susp.motionRatioRear,
      leftCompression: this.wheels[2]._preCompression,
      rightCompression: this.wheels[3]._preCompression,
      leftInContact: this.wheels[2]._preContact,
      rightInContact: this.wheels[3]._preContact,
    });
    this.wheels[0]._arbDfz = front.leftDfz;
    this.wheels[1]._arbDfz = front.rightDfz;
    this.wheels[2]._arbDfz = rear.leftDfz;
    this.wheels[3]._arbDfz = rear.rightDfz;
  }

  private driveTorqueByWheel: number[] = [0, 0, 0, 0];
  private effectiveThrottle = 0;
  private driverBrake = 0;

  private runDrivetrainAndAids(dt: number): void {
    const aids = this.driverAids;
    aids.absActive = false;
    aids.absEventCount = 0;
    aids.tcCut = 0;
    aids.driveSlip = 0;
    aids.escActive = false;

    const driverThrottle = this.input.state.throttle;
    const driverBrake = this.input.state.brake;
    this.driverBrake = driverBrake;

    let maxDriveSlip = 0;
    for (const w of this.wheels) {
      if (w.driveShare > 0 && w.slipRatio > maxDriveSlip) maxDriveSlip = w.slipRatio;
    }
    const tc = computeTcCut({
      enabled: aids.tcEnabled,
      driverThrottle,
      speedKmh: this.speedKmh,
      maxDriveSlip,
      threshold: aids.tcThreshold,
      window: aids.tcWindow,
      // Feed the prior step's sideslip into TC so the drift back-off in
      // `computeTcCut` actually triggers during a deliberate slide.
      // Without this the TC `driftScale` defaults to 1 and full TC
      // authority cuts engine torque the moment rear wheels start to
      // spin, which kills the throttle-in-slide forward bite that drives
      // load transfer to the rear axle. `classifyEsc` below already
      // consumes the same value the same way.
      sideslipDeg: this.sideslipRad * DEG,
    });
    aids.tcCut = tc.cut;
    aids.driveSlip = tc.driveSlip;

    const localVelForEsc = this.velocityWS.clone().applyQuaternion(this.worldQuat.clone().invert());
    const absLocalVz = Math.abs(localVelForEsc.z);
    const desiredYawRad = clamp(
      Math.tan(this.input.state.steerSmoothed * (this.vehicle.steerMaxDeg * RAD)) * absLocalVz / Math.max(1.6, this.vehicle.wheelbase),
      -1.2,
      1.2,
    );
    const esc = classifyEsc({
      enabled: aids.escEnabled,
      speedKmh: this.speedKmh,
      steerSmoothed: this.input.state.steerSmoothed,
      absLocalVz,
      // `this.yawRateRad` is exported in the automotive sign convention
      // (positive = right turn) so the public telemetry stays unchanged.
      // `desiredYawRad` is computed in the geometric convention here
      // (positive = left, matching `steerSmoothed`). Negate the actual yaw
      // rate so the two share a frame inside `classifyEsc` — without this
      // a normal left turn was always classified as understeer and any
      // genuine oversteer was missed.
      yawRateRad: -this.yawRateRad,
      desiredYawRad,
      sideslipDeg: this.sideslipRad * DEG,
      oversteerThreshold: aids.escOversteerThreshold,
      understeerThreshold: aids.escUndersteerThreshold,
      minSpeedKmh: aids.escMinSpeedKmh,
    });
    aids.escActive = esc.active;
    aids.escTorqueTargetByWheel.fill(0);
    const escTargets = computeEscBrakeTargets({
      esc,
      maxBrakeTorque: aids.escMaxBrakeTorque * (esc.mode === 'understeer' ? 0.8 : 1),
    });
    for (let i = 0; i < escTargets.torqueByWheel.length; i++) {
      aids.escTorqueTargetByWheel[i] = escTargets.torqueByWheel[i];
    }

    for (let i = 0; i < aids.escTorqueByWheel.length; i++) {
      const cur = aids.escTorqueByWheel[i] || 0;
      const target = aids.escTorqueTargetByWheel[i] || 0;
      const rate = target > cur ? aids.escApplyRate : aids.escReleaseRate;
      const maxStep = aids.escMaxBrakeTorque * rate * dt;
      aids.escTorqueByWheel[i] = cur + clamp(target - cur, -maxStep, maxStep);
    }

    this.effectiveThrottle = driverThrottle * (1 - aids.tcCut);

    // M6: step turbo spool BEFORE computing engine torque so the boost
    // multiplier is available for this step's torque evaluation.
    if (this.turboState && this.turboParams) {
      stepTurbo({
        state: this.turboState,
        throttle: this.effectiveThrottle,
        engineOmega: this.engineOmega,
        dt,
        params: this.turboParams,
      });
    }

    // M6: step shift delay — may change effective gear index.
    const shiftResult = stepShiftDelay({
      shiftState: this.shiftState,
      currentGearIndex: this.gearIndex,
      maxGearIndex: this.vehicle.gears.length - 1,
      dt,
      throttleCutFraction: this.shiftLogicParams.shiftThrottleCutFraction ?? 0.8,
    });
    // Apply completed deferred gear change.
    if (shiftResult.gearJustChanged) {
      this.gearIndex = shiftResult.effectiveGearIndex;
    }
    const shiftThrottleScale = shiftResult.throttleScale;

    const boostMult = this.turboState?.torqueMultiplier ?? 1;

    let engineDriveT = 0;
    if (this.effectiveThrottle > 0) {
      const rpm = Math.max(ENGINE_IDLE, this.engineOmega * (60 / (2 * Math.PI)));
      const thrScaled = rpm > ENGINE_REDLINE
        ? this.effectiveThrottle * 0.05 * shiftThrottleScale
        : this.effectiveThrottle * shiftThrottleScale;
      engineDriveT = engineTorqueAtWithMap(
        rpm,
        thrScaled,
        boostMult,
        this.engineTorqueCurveOverride,
        this.engineTorqueMap,
      ) * thrScaled;
    }
    // M6: refined engine braking using authored `EngineBrakingParams` when
    // available; falls back gracefully to the legacy flat model.
    const engineDragT = this.engineBrakingParams
      ? engineBrakeTorqueAt(this.engineOmega, this.effectiveThrottle, this.engineBrakingParams)
      : (() => {
          const offThrottle = clamp(1 - this.effectiveThrottle * 4, 0, 1);
          return 0.04 * Math.abs(this.engineOmega) + 8 + 20 * offThrottle;
        })();

    // Stash engine torques. The rotational chain (engine + clutch + gearbox
    // + diff + driven wheels) is integrated together by `stepDrivetrain`
    // after the wheel-force pass so it sees this step's tire/brake torque.
    this.engineDriveTorqueNm = engineDriveT;
    this.engineDragTorqueNm = engineDragT;
    this.driveTorqueByWheel = [0, 0, 0, 0];

    // R2: auto-clear refused flag when no shift input arrives this step and no
    // shift is in progress, so the HUD refusal indicator dismisses after the
    // driver releases the paddle rather than lingering until the next attempt.
    const noShiftInput = !this.input.state.shiftUp && !this.input.state.shiftDown;
    if (noShiftInput && !this.shiftState.inProgress) {
      this.shiftState.lastRefused = false;
      this.shiftState.lastRefusalReason = '';
    }

    if (this.input.state.shiftUp) {
      this.shiftUp();
      this.input.state.shiftUp = false;
    }
    if (this.input.state.shiftDown) {
      this.shiftDown();
      this.input.state.shiftDown = false;
    }
  }

  private runWheelPass(dt: number): void {
    const speed = this.velocityWS.length();
    const maxBrakeTorque = this.vehicle.physics?.brakeTorqueMaxNm ?? 4200;
    const brakeBiasFront = this.setupBrakeBiasFront;
    const aids = this.driverAids;
    const steerCmdRad = this.input.state.steerSmoothed * (this.vehicle.steerMaxDeg * RAD);
    const ackermann = computeAckermannAngles(
      steerCmdRad,
      this.vehicle.wheelbase,
      this.vehicle.trackWidth,
      this.setup.ackermannPct,
    );

    // M5: derive per-axle ride-height from suspension compression for aero map
    // lookup. restLen - compression gives the current spring length; subtracting
    // wheel radius approximates the chassis-to-ground clearance.
    const frontRideHeightM = Math.max(0,
      this.susp.restLenFront - (this.wheels[0].compression + this.wheels[1].compression) * 0.5 - this.wheels[0].radius);
    const rearRideHeightM = Math.max(0,
      this.susp.restLenRear - (this.wheels[2].compression + this.wheels[3].compression) * 0.5 - this.wheels[2].radius);

    // Phase 4 / M5 aero downforce: per-axle vertical load that grows with the
    // chassis-local longitudinal speed squared. We add the per-wheel half
    // to `fz` BEFORE Pacejka so high-speed corners get the expected grip
    // boost. The matching upward chassis-force boost is canceled inside
    // `runAero()`, so net vertical motion stays governed by gravity +
    // suspension contact (downforce only buys grip, not lift).
    const aeroLocalVel = this.velocityWS.clone().applyQuaternion(this.worldQuat.clone().invert());
    const aeroDown = computeAeroDownforce({
      forwardSpeed: aeroLocalVel.z,
      clAreaFront: this.clAreaFront,
      clAreaRear: this.clAreaRear,
      aeroMap: this.aeroMapPreset,
      frontRideHeightM,
      rearRideHeightM,
      pitchDeg: this.pitchDeg,
    });
    this.lastAeroDownforce.front = aeroDown.frontDownforceN;
    this.lastAeroDownforce.rear = aeroDown.rearDownforceN;
    this.lastAeroResult = {
      effectiveClAreaFront: aeroDown.effectiveClAreaFront,
      effectiveClAreaRear: aeroDown.effectiveClAreaRear,
      copFraction: aeroDown.copFraction,
      frontStalled: aeroDown.frontStalled,
      rearStalled: aeroDown.rearStalled,
      frontRideHeightM,
      rearRideHeightM,
      wakeReduction: this.lastAeroResult.wakeReduction,
    };
    const aeroPerWheelFront = aeroDown.frontDownforceN * 0.5;
    const aeroPerWheelRear = aeroDown.rearDownforceN * 0.5;

    // Phase 3 longitudinal weight transfer: m·a·h/L shifts vertical load
    // from the front to the rear axle when the chassis accelerates forward.
    // We feed this DIRECTLY into the per-wheel `fz` used by the tire model
    // so opening the throttle in a slide lifts rear `fz` (and therefore
    // rear grip) immediately, instead of waiting a frame or two for the
    // suspension raycast to compress under pitch.
    //
    // `accelLongG` carries last step's value (this method runs before
    // `updateChassisDerived`). Externally injected velocity changes — most
    // commonly inside tests — can produce spuriously large accelerations on
    // the next step, so we clamp to ±2g (the practical road-tire ceiling)
    // to keep load transfer sane without smothering normal acceleration.
    const longAccelG = clamp(this.accelLongG, -2, 2);
    const dFzLong = computeLongitudinalLoadTransfer({
      longitudinalAccelMs2: longAccelG * 9.81,
      massKg: this.chassisMass,
      cgHeightM: this.cgHeightM,
      wheelbaseM: this.vehicle.wheelbase,
    });
    const longTransferPerWheel = dFzLong * 0.5;

    // Phase 3 lateral load transfer: m·a·h/T shifts vertical load from the
    // inside wheels to the outside wheels under cornering. We split the
    // SPRUNG-mass contribution between front and rear axles by roll
    // stiffness share (springs + ARB at each axle) and apply each axle's
    // UNSPRUNG-mass contribution locally. This is the rigid-body
    // counterpart to the existing ARB elastic transfer in
    // `runArbPrepass()`: ARB represents the suspension's compliance
    // response, while this term is the chassis-up load shift the tires
    // feel before any suspension travel develops. The ±2.5g clamp guards
    // against externally injected `accelLatG` spikes (mostly in tests).
    const latAccelMs2 = clamp(
      this.accelLatG * 9.81,
      -LATERAL_ACCEL_CLAMP_MS2,
      LATERAL_ACCEL_CLAMP_MS2,
    );
    const unsprungTotal = this.unsprungMassFrontKg + this.unsprungMassRearKg;
    const sprungMassKg = Math.max(0, this.chassisMass - unsprungTotal);
    const rollStiffnessShareRaw = computeFrontRollStiffnessShare({
      springFrontNpm: this.susp.kFront,
      springRearNpm: this.susp.kRear,
      arbFrontNpm: this.arbFront,
      arbRearNpm: this.arbRear,
      motionRatioFront: this.susp.motionRatioFront,
      motionRatioRear: this.susp.motionRatioRear,
      trackWidthM: this.vehicle.trackWidth,
    });
    const fallbackShare = clamp(this.vehicle.frontMassPct, 0.05, 0.95);
    const frontRollStiffnessShare = Number.isFinite(rollStiffnessShareRaw)
      ? rollStiffnessShareRaw
      : fallbackShare;
    const lateralTransfer = computeLateralLoadTransfer({
      accelLatMs2: latAccelMs2,
      sprungMassKg,
      unsprungMassKgFront: this.unsprungMassFrontKg,
      unsprungMassKgRear: this.unsprungMassRearKg,
      sprungCgHeightM: this.sprungCgHeightM,
      unsprungCgHeightM: this.unsprungCgHeightM,
      trackWidthM: this.vehicle.trackWidth,
      frontRollStiffnessShare,
    });

    const totalForce = new Vector3();
    const totalTorque = new Vector3();

    let frontAlignMz = 0;
    let frontAlignLoad = 0;

    // M8: accumulate gyroscopic roll torque from steering wheels.
    let gyroRollTorqueNm = 0;

    for (let i = 0; i < this.wheels.length; i++) {
      const w = this.wheels[i];
      const isFront = i < 2;

      // M3: resolve travel-dependent kinematics (toe/camber/caster/roll-center).
      // At this point `compression` is not yet available for the first iteration
      // (kinematics need travel from the suspension raycast below), so we resolve
      // kinematics using the PREVIOUS step's compression. This one-step lag is
      // negligible at 240 Hz and is the standard real-time practice.
      const prevTravel = w.prevCompression; // set from last step
      const kinBumpSteerTable = isFront ? this.bumpSteerTableFront : this.bumpSteerTableRear;
      const kinCamberTable = isFront ? this.camberTableFront : this.camberTableRear;
      const kinCasterTable = isFront ? this.casterTableFront : this.casterTableRear;
      const kinRcTable = isFront ? this.rollCenterTableFront : this.rollCenterTableRear;
      const staticToe = isFront ? this.setup.frontToeDeg : this.setup.rearToeDeg;
      const kin = resolveWheelKinematics({
        staticToeDeg: staticToe,
        staticCamberDeg: w.camberStaticDeg,
        staticCasterDeg: this.setup.casterDeg,
        travel: prevTravel,
        lateralSign: w.lateralSign,
        bumpSteerTable: kinBumpSteerTable,
        camberTable: kinCamberTable,
        casterTable: kinCasterTable,
        rollCenterTable: kinRcTable,
      });
      // Store resolved kinematic state for snapshot/HUD.
      w.toeDeg = kin.toeDeg;
      w.camberDeg = kin.camberDeg;
      w.rollCenterHeightM = kin.rollCenterHeightM;
      // Use travel-resolved toe for the wheel-heading and slip-angle calc.
      const effectiveToe = kin.toeDeg;

      // Toe must mirror across chassis sides — toe-in means each front wheel
      // rotates toward chassis centre, so FL gets a negative steer offset and
      // FR a positive one. `computeToeSlipOffset` returns the correctly
      // mirrored offset for the given axle and `lateralSign`.
      const toeOffset = computeToeSlipOffset(
        effectiveToe,
        w.lateralSign,
        isFront ? 'front' : 'rear',
      );
      const prevSteerAngle = w.steerAngle;
      if (w.steer) {
        w.baseSteerAngle = i === 0 ? ackermann.leftRad : ackermann.rightRad;
        w.steerAngle = w.baseSteerAngle + toeOffset;
      } else {
        w.baseSteerAngle = 0;
        w.steerAngle = toeOffset;
      }
      // M8: gyroscopic torque from steering-induced precession.
      if (w.steer) {
        const steerRate = (w.steerAngle - prevSteerAngle) / Math.max(dt, 1e-6);
        const gyro = computeGyroscopicTorque({
          wheelOmega: w.omega,
          wheelInertia: w.inertia,
          steerRate,
        });
        gyroRollTorqueNm += gyro.torqueRollNm;
      }

      const localPos = new Vector3(w.posLocal.x, w.posLocal.y + 0.47, w.posLocal.z);
      const worldAttach = localPos.clone().applyQuaternion(this.worldQuat).add(this.worldPos);
      const downDir = this.up.clone().multiplyScalar(-1);
      const restLen = isFront ? this.susp.restLenFront : this.susp.restLenRear;
      const maxLen = restLen + w.radius;

      let hit: { t: number; point: Vector3 } | null = null;
      if (downDir.y < 0) {
        // M4: resolve ground height from authored elevation/kerb data; falls
        // back to 0 for flat-ground tracks without elevation data.
        const groundY = this.surfaceLookup?.groundYAt(worldAttach.x, worldAttach.z) ?? 0;
        const t = (groundY - worldAttach.y) / downDir.y;
        if (t > 0 && t <= maxLen) {
          hit = { t, point: worldAttach.clone().add(downDir.clone().multiplyScalar(t)) };
        }
      }

      if (!hit) {
        w.contact = false;
        w.fz = 0; w.fx = 0; w.fy = 0; w.slipRatio = 0; w.slipAngle = 0; w.mz = 0;
        // Airborne: drain the relaxation-length lag back to zero so the
        // tire does not slam to a saturated value the moment the wheel
        // touches down again.
        w.slipRatioTarget = 0;
        w.slipAngleTarget = 0;
        w.slipRatioDynamic = 0;
        w.slipAngleDynamic = 0;
        w.slidePower = 0;
        w.surface = 'ASPHALT';
        w.combinedSlip = 0;
        w.compression = 0;
        w.bumpStopForce = 0;
        w.bumpStopPct = 0;
        w.brakeTorqueApplied = 0;
        w.absScale = 1;
        w.yawContribution = 0;
        // M1 multi-zone thermal cool-down while airborne (no slide energy).
        w.thermalZones = stepTireTemperatureZones({
          zones: w.thermalZones,
          slidePower: 0,
          contactSpeed: speed,
          dt,
        });
        w.tempC = tireZoneAvgTemp(w.thermalZones);
        // Update pressure from average temp.
        w.pressureKpa = stepTirePressure({ pressureKpa: w.pressureKpa, tempAvgC: w.tempC, coldKpa: this.tireColdKpa, dt });
        w.brakeTempC = stepBrakeTemperature({ brakeTempC: w.brakeTempC, brakeTorque: 0, omega: 0, contactSpeed: speed, dt });
        w.tireDeflection = 0;
        w.tireDeflectionRate = 0;
        w.relaxationLengthLongM = TIRE_RELAXATION_LENGTH_LONG_M;
        w.relaxationLengthLatM = TIRE_RELAXATION_LENGTH_LAT_M;
        w.slidingGripScale = 1;
        w.slidingSpeedMps = 0;
        w.pressureInner = 0.25;
        w.pressureMiddle = 0.5;
        w.pressureOuter = 0.25;
        w.pressureCentroidM = 0;
        w.overturningMomentNm = 0;
        // No tire / brake torque on an airborne wheel. Drive torque (when
        // the clutch is engaged) is applied by the drivetrain solver in
        // `runDrivetrainRotationalStep()`.
        w._externalTorque = 0;
        continue;
      }

      const compression = restLen - (hit.t - w.radius);
      const compressionVel = (compression - w.prevCompression) / Math.max(dt, 1e-6);
      w.prevCompression = compression;
      w.compression = compression;

      const k = isFront ? this.susp.kFront : this.susp.kRear;
      const motionRatio = isFront ? this.susp.motionRatioFront : this.susp.motionRatioRear;
      const motionRatioSq = motionRatio * motionRatio;
      // M3 multi-knee damper: use authored DamperKneeParams when available;
      // fall back to the flat cBump/cRebound already stored in susp.*.
      const damperVelShaft = compressionVel * motionRatio;
      const damperParams = isFront ? this.damperParamsFront : this.damperParamsRear;
      let damperForce: number;
      if (damperParams) {
        // computeDamperForce already uses the shaft-velocity convention
        // (positive = bump). Scale back by motionRatio² to get wheel-frame
        // force — note the force is computed at shaft velocity so it must
        // be reflected through the motion-ratio arm to produce a wheel-frame
        // load. The factor is motionRatio (not motionRatio²) because
        // computeDamperForce already returns the force at the shaft; the
        // wheel sees it multiplied by the lever ratio once more.
        damperForce = computeDamperForce(damperVelShaft, damperParams) * motionRatio;
      } else {
        const cBump = isFront ? this.susp.cBumpFront : this.susp.cBumpRear;
        const cReb = isFront ? this.susp.cReboundFront : this.susp.cReboundRear;
        const c = compressionVel >= 0 ? cBump : cReb;
        damperForce = c * motionRatioSq * compressionVel;
      }
      const fzSpring = k * motionRatioSq * compression + damperForce;
      // M3 progressive bump-stop: authored rate table when available.
      const bumpThreshold = isFront ? this.susp.bumpStopGapFrontM : this.susp.bumpStopGapRearM;
      const bumpRate = isFront ? this.susp.bumpStopRateFront : this.susp.bumpStopRateRear;
      const bumpStopTable = isFront ? this.bumpStopRateTableFront : this.bumpStopRateTableRear;
      const bumpForce = computeProgressiveBumpStop({
        compression,
        threshold: bumpThreshold,
        baseRateNpm: bumpRate,
        rateTable: bumpStopTable,
      });
      // Aero downforce share: split each axle total equally left/right.
      // Default `clArea*` of 0 keeps `aeroShift = 0` for road-car presets so
      // existing behaviour is preserved unless authoring data opts in.
      const aeroShift = isFront ? aeroPerWheelFront : aeroPerWheelRear;
      // Phase 3 longitudinal transfer: forward accel REMOVES load from the
      // front axle and ADDS it to the rear. Front wheels get `-`, rear `+`.
      const longShift = isFront ? -longTransferPerWheel : longTransferPerWheel;
      // Phase 3 lateral transfer: per-axle delta is the signed left→right
      // load shift. Project through `lateralSign` (FL/RL = -1, FR/RR = +1)
      // so the inside wheel gets `-` and the outside wheel gets `+`. The
      // half factor splits the axle delta evenly between the two wheels on
      // that axle, mirroring the longitudinal-transfer split.
      const axleLatDelta = isFront ? lateralTransfer.frontDelta : lateralTransfer.rearDelta;
      const lateralShift = w.lateralSign * axleLatDelta * 0.5;
      // M4: kerb bump impulse — additive Fz spike when the wheel rides over a
      // raised kerb.  Zero on flat tracks or off-kerb positions.
      const kerbImpulse = this.surfaceLookup?.kerbBumpImpulseAt(hit.point.x, hit.point.z) ?? 0;
      const fz = Math.max(0, fzSpring + bumpForce + w._arbDfz + aeroShift + longShift + lateralShift + kerbImpulse);
      w.fz = fz;
      w.bumpStopForce = bumpForce;
      w.bumpStopPct = clamp(Math.max(0, compression - bumpThreshold) / 0.05, 0, 1);
      w.contact = true;
      w.damperVelocity = compressionVel * motionRatio;

      w.surface = this.surfaceLookup?.surfaceAt(hit.point.x, hit.point.z) ?? 'ASPHALT';
      const surf = SURFACE_TABLE[w.surface];
      // M1: use multi-zone tire thermal mu so inner/outer strip divergence
      // affects grip. `tireTempMuZones` averages inner/middle/outer (weighted
      // 25/50/25) then applies the same inverted parabola as `tireTempMu`.
      const mu = surf.mu * tireTempMuZones(w.thermalZones);
      // w.mu is overwritten below after pressure scaling is applied.

      const heading = computeWheelHeadingBasis(w.steerAngle);
      const wheelFwd = this.right.clone()
        .multiplyScalar(heading.forwardX)
        .addScaledVector(this.forward, heading.forwardZ)
        .normalize();
      const wheelLat = this.right.clone()
        .multiplyScalar(heading.lateralX)
        .addScaledVector(this.forward, heading.lateralZ)
        .normalize();
      const r = hit.point.clone().sub(this.worldPos);
      const vAtContact = this.velocityWS.clone().add(new Vector3().crossVectors(this.omegaWS, r));
      const vx = vAtContact.dot(wheelFwd);
      const vy = vAtContact.dot(wheelLat);
      const tireOverride = isFront
        ? this.vehicle.physics?.tireFront
        : this.vehicle.physics?.tireRear;
      const slipVxForPatch = w.omega * w.radius - vx;
      const slidingSpeedMps = Math.hypot(slipVxForPatch, vy);
      w.slidingSpeedMps = slidingSpeedMps;

      // Phase 1 wheel-frame + relaxation-length pipeline:
      //   1. Compute INSTANTANEOUS slip targets in the project-local SAE
      //      wheel frame (`+x` rolling direction, `+y` wheel-right). The
      //      symmetric denominator removes the legacy `+1.5` low-speed
      //      cliff and stays finite at standstill.
      //   2. Lag the dynamic slip behind the target with first-order
      //      relaxation in path-domain (`travel = contactSpeed * dt`).
      //   3. Feed the dynamic slip into Pacejka and downstream consumers.
      const targets = computeWheelSlipTargets({
        longitudinalSpeed: vx,
        lateralSpeed: vy,
        wheelAngularSpeed: w.omega,
        wheelRadius: w.radius,
      });
      w.slipRatioTarget = targets.slipRatio;
      w.slipAngleTarget = targets.slipAngleRad;
      const slipTargetMagnitude = Math.hypot(targets.slipRatio, targets.slipAngleRad);
      const relaxationFz0 = tireOverride?.fz0 ?? 3500;
      w.relaxationLengthLongM = computeLoadSensitiveRelaxationLength({
        baseLengthM: TIRE_RELAXATION_LENGTH_LONG_M,
        fz,
        fz0: relaxationFz0,
        mu,
        pressureKpa: w.pressureKpa,
        optimalPressureKpa: this.tireOptimalKpa,
        slipMagnitude: slipTargetMagnitude,
      });
      w.relaxationLengthLatM = computeLoadSensitiveRelaxationLength({
        baseLengthM: TIRE_RELAXATION_LENGTH_LAT_M,
        fz,
        fz0: relaxationFz0,
        mu,
        pressureKpa: w.pressureKpa,
        optimalPressureKpa: this.tireOptimalKpa,
        slipMagnitude: slipTargetMagnitude,
      });
      w.slipRatioDynamic = stepRelaxedSlip({
        slipTarget: targets.slipRatio,
        slipDynamic: w.slipRatioDynamic,
        contactSpeed: targets.contactSpeed,
        relaxationLength: w.relaxationLengthLongM,
        dt,
      });
      w.slipAngleDynamic = stepRelaxedSlip({
        slipTarget: targets.slipAngleRad,
        slipDynamic: w.slipAngleDynamic,
        contactSpeed: targets.contactSpeed,
        relaxationLength: w.relaxationLengthLatM,
        dt,
      });
      w.slipRatio = w.slipRatioDynamic;
      w.slipAngle = w.slipAngleDynamic;
      const slipRatio = w.slipRatio;
      const slipAngle = w.slipAngle;
      w.combinedSlip = Math.hypot(slipRatio, slipAngle);

      // M1: resolve camber geometry BEFORE Pacejka so the effective camber
      // angle can be fed into the MF lateral path (pCy2 term) instead of
      // being added as a downstream add-on.
      const rollRad = this.rollDeg * RAD;
      // M3: use travel-resolved caster from kinematics (kin.casterDeg) when
      // tables are authored; fall back to the static setup value otherwise.
      // `kin` was resolved above from the previous step's compression.
      const effectiveCasterDeg = kin.casterDeg;
      const casterCamberRad = w.steer
        ? computeCasterCamber(w.baseSteerAngle, effectiveCasterDeg)
        : 0;
      // M3: use travel-resolved camber (kin.camberDeg) as the static input
      // when a camber table is authored; falls through to camberStaticDeg
      // when no table is provided (kin.camberDeg === w.camberStaticDeg).
      const camber = computeCamberThrust({
        staticCamberRad: kin.camberDeg * RAD,
        rollRad,
        camberGain: w.camberGain,
        casterCamberRad,
        lateralSign: w.lateralSign,
        fz,
      });
      w.camberRad = camber.camberRad;
      // M1: camber thrust is only physically meaningful when the tire is
      // rolling — at a standstill the relaxation-length slip dynamics are
      // already driving Fy toward zero, but the MF camber path (fyCamber =
      // pCy2 * camberRad * fz) would inject a spurious lateral force that
      // creates non-zero Mz and drifts the alignment feedback signal. We
      // apply the same standstill blend to the camberRad input that the
      // slip-generated Fy receives below, so both contributions fade
      // consistently as speed drops below 0.2 m/s.
      const STANDSTILL_FY_FLOOR_MPS = 0.2;
      const standstillFyScale = speed < STANDSTILL_FY_FLOOR_MPS
        ? clamp(speed / STANDSTILL_FY_FLOOR_MPS, 0, 1)
        : 1;
      // The `fyCamber = pCy2 * camberRad * fz` term in `evaluatePureLateral`
      // uses the raw camber angle, but the Pacejka lateral convention
      // (positive Fy = force toward chassis-right) requires the camber
      // force to be INWARD for negative camber. Multiplying by `lateralSign`
      // mirrors the sign correctly: left wheel (lateralSign=-1) with
      // negative camberRad → positive product → inward force.
      const camberRadForMF = w.lateralSign * camber.camberRad * standstillFyScale;

      // M1: pressure-sensitive mu: multiply surface×thermal mu by the
      // pressure deviation factor so under/over-inflated tires lose grip.
      const pressureMuScale = tirePressureMu(w.pressureKpa, this.tireOptimalKpa);
      w.slidingGripScale = computeSlidingGripScale({ slidingSpeedMps });
      const muWithPressure = mu * pressureMuScale * w.slidingGripScale;

      // Phase 2 Pacejka MF 5.6 evaluator: pure longitudinal/lateral curves
      // get dfz-based load sensitivity so peak force, slip stiffness, and
      // curvature scale with vertical load. Combined slip is weighted with
      // smooth MF-style cosines (Gxa, Gyk) normalized so they equal `1` at
      // pure slip — there is no `0.35` floor and no isotropic friction-circle
      // clamp downstream, so saturation comes entirely from the tire model.
      // M1: camberRad is now passed in so the MF evaluator integrates camber
      // thrust into the lateral force (pCy2 path) rather than us adding it
      // downstream.
      const tire = evaluatePacejka56Combined({
        kappa: slipRatio,
        alphaRad: slipAngle,
        fz,
        muScale: muWithPressure,
        axle: isFront ? 'front' : 'rear',
        params: tireOverride,
        camberRad: camberRadForMF,
      });
      let Fx = tire.fx;
      let Fy = tire.fy;
      // Store peak diagnostics for snapshot / telemetry.
      w.kappaPeak = tire.kappaPeak;
      w.alphaPeakRad = tire.alphaPeakRad;
      w.mu = muWithPressure;

      // Phase 6F: standstill Fy blend — applied HERE, before Mz computation,
      // so the aligning moment and feedback signal are both zeroed at rest.
      // `standstillFyScale` was computed when scaling `camberRadForMF`; the
      // same factor zeros Fy (slip + camber) as speed drops below 0.2 m/s.
      // Applying it before `computeAligningMoment` prevents the relaxation-lag
      // slip-angle carry-over from injecting a spurious Mz at standstill that
      // would bias the steering-align filter. Fx is NOT scaled here — drive
      // torque at low speed is the mechanism that accelerates the car from rest.
      if (standstillFyScale < 1) {
        Fy *= standstillFyScale;
      }

      // Phase 6A aligning moment: pneumatic trail decays with slip, caster
      // adds mechanical trail at the front, and scrub-radius couples the
      // longitudinal force into yaw. Caster and scrub are front-axle
      // concerns — rear wheels report a pneumatic-only Mz.
      const alignCasterDeg = w.steer ? kin.casterDeg : 0;
      const alignScrubRadius = w.steer ? this.alignGeometry.scrubRadiusM : 0;
      const alignResult = computeAligningMoment({
        slipAngleRad: slipAngle,
        fySlip: Fy,
        fx: Fx,
        casterDeg: alignCasterDeg,
        pneumaticTrail0M: this.alignGeometry.pneumaticTrail0M,
        pneumaticTrailDecayDeg: this.alignGeometry.pneumaticTrailDecayDeg,
        casterTrailScaleMPerDeg: this.alignGeometry.casterTrailScaleMPerDeg,
        mechanicalTrailMaxM: this.alignGeometry.mechanicalTrailMaxM,
        scrubRadiusM: alignScrubRadius,
        scrubSign: w.lateralSign,
      });
      w.mz = alignResult.mz;
      if (isFront) {
        frontAlignMz += alignResult.mz;
        frontAlignLoad += fz;
      }

      // M1 multi-zone thermal: compute lateral bias from camber angle
      // (negative camber tilts the load toward the inner strip) and from
      // lateral load transfer sign (outer wheel runs hotter on the outside
      // strip). `lateralSign` encodes which chassis side the wheel is on;
      // the bias sign is: negative camber (inner tilt) → inner strip hotter
      // → negative bias.
      const camberBias = clamp(-camber.camberRad * 4, -1, 1);
      const patchWidthScale = tirePressurePatchWidthScale(w.pressureKpa, this.tireOptimalKpa);
      const pressureDistribution = computeContactPatchPressureDistribution({
        camberRad: camber.camberRad,
        pressureKpa: w.pressureKpa,
        optimalPressureKpa: this.tireOptimalKpa,
      });
      w.pressureInner = pressureDistribution.inner;
      w.pressureMiddle = pressureDistribution.middle;
      w.pressureOuter = pressureDistribution.outer;
      w.pressureCentroidM = pressureDistribution.centroidM;
      w.overturningMomentNm = computeOverturningMomentNm(fz, pressureDistribution);
      const slipVx = slipVxForPatch;
      w.slidePower = Math.abs(Fx * slipVx) + Math.abs(Fy * vy);
      w.thermalZones = stepTireTemperatureZones({
        zones: w.thermalZones,
        slidePower: w.slidePower,
        contactSpeed: Math.abs(vx),
        lateralBias: camberBias,
        patchWidthScale,
        pressureDistribution,
        dt,
      });
      w.tempC = tireZoneAvgTemp(w.thermalZones);
      // Update pressure from new average temperature.
      w.pressureKpa = stepTirePressure({
        pressureKpa: w.pressureKpa,
        tempAvgC: w.tempC,
        coldKpa: this.tireColdKpa,
        dt,
      });
      // M8 tire wear: deterministic, bounded accumulation from slip work and
      // thermal load. The tiny baseline keeps channels finite and monotonic
      // while preserving fresh-tire behaviour for short tests and old presets.
      const normalizedSlideWork = fz > 1
        ? clamp(w.slidePower / Math.max(1, fz * Math.max(1, targets.contactSpeed)), 0, 4)
        : 0;
      const thermalLoad = clamp((w.tempC - 70) / 110, 0, 2);
      const slipWearLoad = clamp(Math.abs(slipRatio) * 0.55 + Math.abs(slipAngle) * 1.35 + normalizedSlideWork * 0.35, 0, 4);
      const wearRate = (0.000002 + 0.00008 * slipWearLoad * (1 + thermalLoad)) * surfaceWearMultiplier(w.surface);
      w.tireWear = clamp(w.tireWear + wearRate * dt, 0, 1);
      // M1 tire vertical compliance: compute deflection-based contact force
      // augmentation. The tire spring acts in series with the suspension;
      // `stepTireVertical` returns the net contact force from the carcass
      // spring + damper. We do not re-add this to fz (which already came
      // from the suspension spring pass) but carry the deflection for the
      // next step's damping rate computation.
      const vertResult = stepTireVertical({
        contactDistance: hit.t - w.radius,
        radius: w.radius,
        kTireNpm: this.tireRadialStiffnessNpm,
        cTireNspm: this.tireRadialDampingNspm,
        deflectionRate: w.tireDeflectionRate,
        prevDeflection: w.tireDeflection,
        pressureKpa: w.pressureKpa,
        dt,
      });
      w.tireDeflection = vertResult.deflection;
      w.tireDeflectionRate = vertResult.deflectionRate;

      // Phase 2 removed the isotropic `hypot(Fx, Fy) <= tireD(mu, fz)`
      // friction-circle clamp. Combined-slip MF saturates naturally — the
      // clamp was a second penalty on top of Gxa/Gyk that over-killed `Fx`
      // in transitions. Numeric safety against pathological inputs is
      // covered by the per-axis cosine weights (bounded in [0, 1]) and the
      // dfz-clamped Dx/Dy peaks inside the evaluator.

      let Frx = 0;
      if (Math.abs(vx) > 0.1) {
        Frx = (vx > 0 ? -1 : 1) * surf.roll * fz;
        Fx += Frx;
      }
      w.fx = Fx; w.fy = Fy;

      const fzGeo = computeAntiPitchVertical({
        axle: isFront ? 'front' : 'rear',
        fxAtContact: Fx,
        pct: isFront ? w.antiDivePct : w.antiSquatPct,
      });
      // M3 jacking force: lateral tire force acting through the roll-center
      // height produces a vertical chassis force. We compute it and store it
      // on the wheel state for telemetry; the actual chassis application is
      // via the normal force projection (fzApplied) so the sign lifts the
      // chassis on the loaded side under high lateral load.
      const jackingForce = computeJackingForce({
        fy: Fy,
        rollCenterHeightM: w.rollCenterHeightM,
        trackHalfM: this.vehicle.trackWidth * 0.5,
      });
      w.jackingForceN = jackingForce;
      const fzApplied = fz + fzGeo + jackingForce;

      const force = new Vector3()
        .addScaledVector(this.up, fzApplied)
        .addScaledVector(wheelFwd, Fx)
        .addScaledVector(wheelLat, Fy);
      if (this.complianceActive) {
        w._wheelForce = force;
        w._wheelTorque = this.up.clone().multiplyScalar(w.mz);
        w.yawContribution = new Vector3().crossVectors(r, force).dot(this.up) + w.mz;
        // M9: when Jolt is active, apply forces directly to Jolt hub bodies.
        if (this.useJolt && this.joltCtx && this.joltHubBodies) {
          const { jolt, bodyInterface } = this.joltCtx;
          const hub = this.joltHubBodies.hubBodies[i];
          // Apply force at contact patch (approximate with hub center for now).
          (bodyInterface as any).AddForce(hub, new (jolt as any).Vec3(force.x, force.y, force.z));
          if (w.mz !== 0) {
            const tq = new (jolt as any).Vec3(0, w.mz, 0);
            (bodyInterface as any).AddTorque(hub, tq);
          }
        }
      } else {
        totalForce.add(force);
        const wheelTorque = new Vector3().crossVectors(r, force);
        totalTorque.add(wheelTorque);
        // Self-aligning moment about chassis up.
        totalTorque.add(this.up.clone().multiplyScalar(w.mz));
        // Diagnostic: this wheel's contribution to the chassis-up yaw axis.
        w.yawContribution = wheelTorque.dot(this.up) + w.mz;
      }

      // Stash for the brake-stage second pass.
      w._fxFinal = Fx;
      w._frx = Frx;
      w._vx = vx;
    }

    // Phase 6C front-axle aligning feedback. Sum the front-wheel Mz and
    // divide by the configured authority, then low-pass at ~20 Hz. Sign:
    // in this engine a left turn (positive `steerCmd`) produces negative
    // front `fySlip` and therefore negative pneumatic Mz, so the same
    // negative sign already reaches the input model as "assist return for
    // positive `steerCmd`". A right turn flips both signs symmetrically.
    // The front-load gate forces the signal back to zero at standstill or
    // when the front wheels lose contact with the surface.
    const FRONT_LOAD_GATE_N = 200;
    const alignNorm =
      frontAlignLoad > FRONT_LOAD_GATE_N && this.alignGeometry.steeringAlignTorqueMaxNm > 0
        ? clamp(frontAlignMz / this.alignGeometry.steeringAlignTorqueMaxNm, -1, 1)
        : 0;
    const alignAlpha = 1 - Math.exp(-STEERING_ALIGN_FILTER_HZ * dt);
    this.steeringAlignFeedback += (alignNorm - this.steeringAlignFeedback) * alignAlpha;

    // M8: apply accumulated gyroscopic roll torque to chassis.
    // Project onto the chassis roll axis (this.right) in world space,
    // not the fixed world-X axis, so the torque follows the car's yaw.
    totalTorque.addScaledVector(this.right, gyroRollTorqueNm);

    this.appliedForce.copy(totalForce);
    this.appliedTorque.copy(totalTorque);

    // Brake-stage second pass: needs all four `fz` values up-front so we can
    // run cornering brake control (CBC) and stop the inside wheel from
    // tripping ABS first under hard combined brake + steer.
    const cbc = applyCorneringBrakeControl([
      this.wheels[0].fz,
      this.wheels[1].fz,
      this.wheels[2].fz,
      this.wheels[3].fz,
    ]);
    for (let i = 0; i < this.wheels.length; i++) {
      const w = this.wheels[i];
      const isFront = i < 2;
      if (!w.contact) continue;
      const Fx = w._fxFinal;
      const Frx = w._frx;
      const vx = w._vx;

      // Tire reaction torque on the wheel (excluding rolling resistance,
      // which is already folded into `Fx`; we re-add `Frx` here so the net
      // tire term is just the driving Fx without rolling resistance).
      const tireReactionTorque = -(Fx - Frx) * w.radius;

      const biasFactor = isFront ? brakeBiasFront : 1 - brakeBiasFront;
      const fade = brakeFadeFactor({ brakeTempC: w.brakeTempC });
      w.brakeFade = fade;
      const abs = applyAbs({
        enabled: aids.absEnabled,
        driverBrake: this.driverBrake,
        vx,
        slipRatio: w.slipRatio,
        threshold: aids.absThreshold,
        release: w.absRelease,
        releaseTime: aids.absReleaseTime,
        dt,
      });
      w.absRelease = abs.release;
      w.absActive = abs.active;
      w.absScale = abs.scale;
      if (abs.active) {
        aids.absActive = true;
        aids.absEventCount++;
      }
      const brakeTorqueRaw =
        this.driverBrake * maxBrakeTorque * biasFactor * fade * abs.scale * cbc[i];
      const handbrakeTorque = w.hand ? this.input.state.handbrake * 4200 : 0;
      const escBrakeTorque = aids.escTorqueByWheel[i] || 0;
      w.escTorque = escBrakeTorque;
      const brakeTorque = brakeTorqueRaw + handbrakeTorque + escBrakeTorque;
      w.brakeTorqueApplied = brakeTorque;
      // M8 flat-spot signal: accumulated only when a contacted tire is sliding
      // longitudinally under substantial brake torque. ABS reduces the signal
      // naturally through `abs.scale`; wet/slow defaults stay near zero.
      const brakeCapacity = Math.max(1, maxBrakeTorque * biasFactor);
      const brakeSeverity = clamp(brakeTorque / brakeCapacity, 0, 2);
      const lockSeverity = clamp((Math.abs(w.slipRatio) - 0.22) / 0.78, 0, 1)
        * clamp(Math.abs(vx) / 8, 0, 1)
        * brakeSeverity;
      w.flatSpotSignal = clamp(w.flatSpotSignal + lockSeverity * dt * 0.45, 0, 1);
      w.brakeTempC = stepBrakeTemperature({
        brakeTempC: w.brakeTempC,
        brakeTorque,
        omega: w.omega,
        contactSpeed: Math.abs(vx),
        dt,
      });
      // Cap brake torque so it cannot reverse the wheel sign through this
      // outer step alone (drive torque is added inside the drivetrain
      // solver; this cap is a numerical safety, not a physics constraint).
      const omegaSign = Math.sign(w.omega) || (vx > 0 ? 1 : vx < 0 ? -1 : 0);
      const maxBrakeReactMag =
        (Math.abs(w.omega) * w.inertia) / Math.max(dt, 1e-6) + Math.abs(tireReactionTorque);
      const brakeReact = -omegaSign * Math.min(maxBrakeReactMag, brakeTorque);

      w._externalTorque = tireReactionTorque + brakeReact;
    }
  }

  /**
   * Phase 5 rotational integration. The wheel-force pass has already
   * stamped each wheel's tire/brake/handbrake/ESC torque into
   * `_externalTorque`; this method hands the engine + clutch +
   * gearbox + diff + driven wheels to the integrated solver so the
   * rotational chain advances coherently in one outer step.
   *
   * Drive torque is computed inside the solver via a Karnopp stick-slip
   * clutch and reflected inertias, so we don't double-count it here. The
   * driven-wheel kinematic constraint (avg ↔ input shaft) is enforced
   * each substep and Salisbury-style LSD coupling runs per axle inside
   * the same loop.
   */
  private runDrivetrainRotationalStep(dt: number): void {
    const gear = this.vehicle.gears[this.gearIndex];
    const wheels: DrivetrainWheelInput[] = this.wheels.map((w, i) => ({
      index: i,
      omega: w.omega,
      inertia: w.inertia,
      driveShare: w.driveShare,
      axle: i < 2 ? 'front' : 'rear',
      side: w.lateralSign < 0 ? 'left' : 'right',
      externalTorqueNm: w._externalTorque,
    }));
    const result = stepDrivetrain({
      engineOmega: this.engineOmega,
      transmissionOmega: this.transmissionOmega,
      wheels,
      gearRatio: gear.ratio,
      finalDrive: this.vehicle.finalDrive * this.setupFinalDriveScale,
      engineDriveTorqueNm: this.engineDriveTorqueNm,
      engineDragTorqueNm: this.engineDragTorqueNm,
      params: this.drivetrainParams,
      dt,
    });
    this.engineOmega = result.engineOmega;
    this.transmissionOmega = result.transmissionOmega;
    this.driveTorqueByWheel = result.driveTorqueByWheel.slice(0, 4);
    this.clutchTorqueNm = result.clutchTorqueNm;
    this.clutchMode = result.clutchMode;

    // M6: Driveline compliance — compute torsional spring torque between
    // transmission output and average driven-wheel hub.  When no compliance
    // is authored the result is zero and behaviour is unchanged.
    const inGear = gear.ratio !== 0;
    if (inGear && (this.complianceParams.shaftStiffnessNmRad ?? 0) > 0) {
      const drivenOmegas = this.wheels
        .filter(w => w.driveShare > 0)
        .map(w => result.wheelOmegas[w.index]);
      const avgWheelOmega = drivenOmegas.length > 0
        ? drivenOmegas.reduce((s, v) => s + v, 0) / drivenOmegas.length
        : 0;
      const compResult = stepDrivelineCompliance({
        state: this.complianceState,
        inputOmega: result.transmissionOmega,
        outputOmega: avgWheelOmega * Math.abs(gear.ratio * this.vehicle.finalDrive * this.setupFinalDriveScale),
        params: this.complianceParams,
        dt,
      });
      this.complianceSpringNm = compResult.springTorqueNm;
    } else {
      this.complianceSpringNm = 0;
      if (!inGear) {
        this.complianceState = makeDrivelineComplianceState();
      }
    }

    for (let i = 0; i < this.wheels.length; i++) {
      const w = this.wheels[i];
      let omega = result.wheelOmegas[i];
      if (w.contact) {
        const lock = applyLowSpeedWheelRotationLock({
          vx: w._vx,
          omega,
          radius: w.radius,
          driveTorqueNm: this.driveTorqueByWheel[i] ?? 0,
          brakeTorqueNm: w.brakeTorqueApplied,
          lockSpeedMps: LOW_SPEED_WHEEL_LOCK_MPS,
          blendSpeedMps: LOW_SPEED_WHEEL_BLEND_MPS,
          driveUnlockTorqueNm: LOW_SPEED_DRIVE_UNLOCK_NM,
          brakeLockTorqueNm: LOW_SPEED_BRAKE_LOCK_NM,
        });
        omega = lock.omega;
      }
      const decayRate = w.contact ? 0.05 : 0.5;
      omega *= Math.exp(-decayRate * dt);
      w.omega = omega;
      w.spinAngle += omega * dt;
    }
  }

  private runAero(): void {
    // M8: wake-field drag reduction when following a lead car.
    let wakeReduction = 0;
    let effectiveCdA = this.cdA;
    if (this.leadCarState) {
      const wake = computeWakeEffect({
        leadCarPos: this.leadCarState.pos,
        leadCarVel: this.leadCarState.vel,
        followerPos: this.worldPos,
        wakeLengthM: this.vehicle.physics?.wakeLengthM ?? 20,
        wakeWidthM: this.vehicle.physics?.wakeWidthM ?? 4,
        wakeReductionPct: this.vehicle.physics?.wakeReductionPct ?? 0.25,
      });
      wakeReduction = wake.wakeReduction;
      effectiveCdA *= (1 - wakeReduction);
    }
    this.lastAeroResult.wakeReduction = wakeReduction;

    const local = this.velocityWS.clone().applyQuaternion(this.worldQuat.clone().invert());
    const drag = computeAeroDrag({
      forwardSpeed: local.z,
      sideSpeed: local.x,
      cdArea: effectiveCdA,
      yawDragMap: this.aeroMapPreset?.yawDragMap,
      speedKmh: this.speedKmh,
    });
    this.aeroDragMagN = Math.hypot(drag.fxDragWS, drag.fzDragWS);
    const speed = this.velocityWS.length();
    const yawMoment = computeYawRestoringMoment({
      sideslipRad: this.sideslipRad,
      speed,
      cyYaw: this.cyYaw,
    });
    // Convert local-frame drag back to world. `computeAeroDrag` returns force
    // components along the chassis +X (right) and chassis +Z axes. In our
    // Three.js convention chassis-forward = world -Z (i.e. `this.forward`
    // points along chassis -Z), so the +Z drag must be applied along
    // `-this.forward` to land in the correct world direction.
    const dragWS = new Vector3()
      .addScaledVector(this.right, drag.fxDragWS)
      .addScaledVector(this.forward, -drag.fzDragWS);
    this.appliedForce.add(dragWS);
    this.appliedTorque.add(this.up.clone().multiplyScalar(yawMoment));

    // Phase 4 chassis-side reaction: `runWheelPass` added per-axle aero
    // downforce into per-wheel `fz`, which feeds the contact-force
    // projection that pushes the chassis upward. Without a matching
    // downward force, downforce would lift the car instead of just
    // boosting tire grip. Apply the equal-and-opposite load on the chassis
    // body so the net vertical aero contribution to rigid-body motion is
    // zero when all four tires are on the ground (and naturally pushes a
    // partially airborne car back toward the surface).
    const totalAeroDown = this.lastAeroDownforce.front + this.lastAeroDownforce.rear;
    if (totalAeroDown > 0) {
      this.appliedForce.addScaledVector(this.up, -totalAeroDown);
    }
  }

  private readonly appliedForce = new Vector3();
  private readonly appliedTorque = new Vector3();

  private integrateChassis(dt: number): void {
    // Gravity.
    const gravity = new Vector3(0, -9.81 * this.chassisMass, 0);
    const totalForce = this.appliedForce.clone().add(gravity);

    // Semi-implicit Euler linear integration: advance velocity first with
    // a = F/m, then advance position with the already-updated velocity.
    // This removes the explicit-Euler energy-injection bias at the cost of
    // a tiny implicit overshoot that is inconsequential at 240 Hz.
    // No artificial linear damping is applied; all dissipation comes from
    // tire rolling resistance, aero drag, and drivetrain losses.
    const accel = totalForce.divideScalar(this.chassisMass);
    this.velocityWS.addScaledVector(accel, dt);
    this.worldPos.addScaledVector(this.velocityWS, dt);

    // Don't sink through the ground (account for authored terrain height).
    const groundFloor = this.surfaceLookup?.groundYAt(this.worldPos.x, this.worldPos.z) ?? 0;
    const minHeight = groundFloor + this.susp.restLen + 0.34 + 0.05 - 0.4;
    if (this.worldPos.y < minHeight) {
      this.worldPos.y = minHeight;
      if (this.velocityWS.y < 0) this.velocityWS.y = 0;
    }

    // Angular semi-implicit Euler: advance omega first, then integrate the
    // quaternion with the updated omega. Body-frame formulation keeps the
    // inertia tensor diagonal and avoids a world-frame tensor transform.
    // A small structural damping (0.02 s⁻¹) replaces the old 0.18 s⁻¹
    // fudge; at 240 Hz this is exp(-0.02/240) ≈ 0.9999, essentially free.
    // All meaningful rotational dissipation comes from the tire lateral
    // forces (Fy × moment arm) rather than from this term.
    const invQ = this.worldQuat.clone().invert();
    const torqueLocal = this.appliedTorque.clone().applyQuaternion(invQ);
    const omegaLocal = this.omegaWS.clone().applyQuaternion(invQ);
    const alpha = new Vector3(
      torqueLocal.x / this.chassisInertia.x,
      torqueLocal.y / this.chassisInertia.y,
      torqueLocal.z / this.chassisInertia.z,
    );
    omegaLocal.addScaledVector(alpha, dt);
    omegaLocal.multiplyScalar(Math.exp(-0.02 * dt));
    this.omegaWS.copy(omegaLocal).applyQuaternion(this.worldQuat);

    // Integrate orientation with the updated omega (semi-implicit).
    const dq = new Quaternion(this.omegaWS.x * 0.5 * dt, this.omegaWS.y * 0.5 * dt, this.omegaWS.z * 0.5 * dt, 0);
    const newQ = this.worldQuat.clone();
    newQ.x += dq.x * newQ.w + dq.y * newQ.z - dq.z * newQ.y;
    newQ.y += -dq.x * newQ.z + dq.y * newQ.w + dq.z * newQ.x;
    newQ.z += dq.x * newQ.y - dq.y * newQ.x + dq.z * newQ.w;
    newQ.w += -dq.x * newQ.x - dq.y * newQ.y - dq.z * newQ.z;
    newQ.normalize();
    this.worldQuat.copy(newQ);

    this.appliedForce.set(0, 0, 0);
    this.appliedTorque.set(0, 0, 0);
  }

  /** M9: Jolt-backed compliance step. Applies aero + torsion to the Jolt
   *  chassis body, steps the physics system, then syncs poses back. */
  private stepJoltCompliance(dt: number): void {
    if (!this.joltCtx || !this.joltHubBodies) return;
    const { jolt, physicsSystem, bodyInterface } = this.joltCtx;
    const { chassisBody } = this.joltHubBodies;
    const J = jolt as any;
    const bi = bodyInterface as any;
    const ps = physicsSystem as any;

    // Sync chassis pose to Jolt (kinematic override so raycast stays
    // authoritative for ground contact).
    writeJoltBodyPose(
      jolt, bi, chassisBody,
      this.worldPos, this.worldQuat, this.velocityWS, this.omegaWS,
    );

    // Apply aero and gravity to Jolt chassis.
    bi.AddForce(chassisBody, new J.Vec3(this.appliedForce.x, this.appliedForce.y, this.appliedForce.z));
    bi.AddTorque(chassisBody, new J.Vec3(this.appliedTorque.x, this.appliedTorque.y, this.appliedTorque.z));
    bi.AddForce(chassisBody, new J.Vec3(0, -9.81 * this.chassisMass, 0));

    // Apply torsional restoring torque to chassis.
    if (this.complianceConfig.chassisTorsionalStiffnessNmDeg > 0) {
      const kRad = this.complianceConfig.chassisTorsionalStiffnessNmDeg * (Math.PI / 180);
      const rollRad = this.rollDeg * (Math.PI / 180);
      const torqueMag = -kRad * rollRad;
      const torque = this.right.clone().multiplyScalar(torqueMag);
      bi.AddTorque(chassisBody, new J.Vec3(torque.x, torque.y, torque.z));
    }

    this.appliedForce.set(0, 0, 0);
    this.appliedTorque.set(0, 0, 0);

    // Step Jolt. Disable gravity because we applied it manually.
    const prevGravity = ps.GetGravity();
    ps.SetGravity(new J.Vec3(0, 0, 0));
    ps.Update(dt, 1, 1);
    ps.SetGravity(prevGravity);

    // Read back chassis state.
    const chassisPose = readJoltBodyPose(jolt, bi, chassisBody);
    this.worldPos.copy(chassisPose.pos);
    this.worldQuat.copy(chassisPose.quat);
    this.velocityWS.copy(chassisPose.vel);
    this.omegaWS.copy(chassisPose.omega);
  }

  private updateChassisDerived(): void {
    this.rollDeg = Math.asin(clamp(-this.right.y, -1, 1)) * DEG;
    this.pitchDeg = Math.asin(clamp(this.forward.y, -1, 1)) * DEG;

    const fzFL = this.wheels[0].fz, fzFR = this.wheels[1].fz;
    const fzRL = this.wheels[2].fz, fzRR = this.wheels[3].fz;
    const fzTotal = fzFL + fzFR + fzRL + fzRR;
    if (fzTotal > 1) {
      this.frontLoadPct = ((fzFL + fzFR) / fzTotal) * 100;
      this.leftLoadPct = ((fzFL + fzRL) / fzTotal) * 100;
    } else {
      this.frontLoadPct = 50;
      this.leftLoadPct = 50;
    }
    const invQ = this.worldQuat.clone().invert();
    const localVel = this.velocityWS.clone().applyQuaternion(invQ);
    const dt = Math.max(this.lastStepDt, 1e-6);
    const localAccel = localVel.clone().sub(this.prevLocalVelocity).divideScalar(dt);
    this.accelLatG = localAccel.x / 9.81;
    // Chassis forward = -Z (Three.js convention). The chassis-local Z axis
    // therefore points OUT the back of the car, so we negate `localAccel.z`
    // and `localVel.z` projections to preserve the standard automotive
    // telemetry signs: accelLongG > 0 = forward acceleration, yawRateRad > 0
    // = right turn, sideslipDeg > 0 = velocity to chassis-right of forward.
    this.accelLongG = -localAccel.z / 9.81;
    this.prevLocalVelocity.copy(localVel);
    // Sideslip: angle between chassis heading and velocity vector, in the
    // chassis ground plane. `atan2(x, -z)` gives positive when the velocity
    // vector leans toward chassis +X (right), which is the automotive/SAE
    // convention: positive sideslip ↔ rear sliding out to the right.
    // The speed gate suppresses the noisy atan2 at very low velocities.
    if (Math.abs(localVel.z) > 0.5 || Math.abs(localVel.x) > 0.5) {
      this.sideslipRad = Math.atan2(localVel.x, -localVel.z);
    } else {
      this.sideslipRad = 0;
    }
    this.yawRateRad = -this.omegaWS.dot(this.up);

    const rearOmega = (this.wheels[2].omega + this.wheels[3].omega) * 0.5;
    const rearRollSpeed = rearOmega * this.wheels[2].radius;
    const refSpeed = Math.abs(localVel.z);
    if (refSpeed > 1.5) {
      this.rearLockPct = clamp(1 - Math.abs(rearRollSpeed) / refSpeed, -1, 1);
    } else {
      this.rearLockPct = 0;
    }

    // Drift state classification (descriptive only).
    const speedKmh = this.speedKmh;
    const absBetaDeg = Math.abs(this.sideslipRad * DEG);
    const absRearK = Math.abs((this.wheels[2].slipRatio + this.wheels[3].slipRatio) * 0.5);
    const frontA = Math.abs((this.wheels[0].slipAngle + this.wheels[1].slipAngle) * 0.5 * DEG);
    const rearA = Math.abs((this.wheels[2].slipAngle + this.wheels[3].slipAngle) * 0.5 * DEG);

    if (speedKmh < 5) this.driftState = 'IDLE';
    else if (this.rearLockPct > 0.6 && this.input.state.handbrake > 0.2) this.driftState = 'HANDBRAKE LOCK';
    else if (this.rearLockPct > 0.6 && this.input.state.brake > 0.2) this.driftState = 'BRAKE LOCK';
    else if (absRearK > 0.2 && this.input.state.throttle > 0.3 && absBetaDeg > 6) this.driftState = 'POWER SLIDE';
    else if (absBetaDeg > 8) this.driftState = 'DRIFT';
    else if (frontA > 8 && frontA > rearA + 2) this.driftState = 'UNDERSTEER';
    else if (rearA > frontA + 4) this.driftState = 'OVERSTEER';
    else this.driftState = 'GRIP';
  }

  private updateLapTimer(now: number): void {
    if (!this.centerline.length) return;
    const sp = this.centerline[0];
    const next = this.centerline[1];
    const tan = { x: next.x - sp.x, z: next.z - sp.z };
    const tanLen = Math.hypot(tan.x, tan.z) || 1;
    const tx = tan.x / tanLen;
    const tz = tan.z / tanLen;
    const rightX = -tz;
    const rightZ = tx;
    const relX = this.worldPos.x - sp.x;
    const relZ = this.worldPos.z - sp.z;
    const distAlong = relX * tx + relZ * tz;
    const distLat = relX * rightX + relZ * rightZ;
    const sign = distAlong >= 0 ? 1 : -1;
    const closeEnough = Math.abs(distLat) < this.trackPreset.halfWidth + 0.6;
    const movingForward = this.velocityWS.dot(new Vector3(tx, 0, tz)) > 1;
    if (this.lap.prevSign !== 0 && sign !== this.lap.prevSign && closeEnough && movingForward) {
      const wallNow = now * 1000;
      if (this.lap.t0 == null) {
        this.lap.t0 = wallNow;
        this.events.emit('lapStarted', {
          trackId: this.trackPreset.id,
          vehicleId: this.vehicle.id,
          startedAt: wallNow,
        });
      } else {
        const ms = wallNow - this.lap.t0;
        this.lap.lastMs = ms;
        if (this.lap.bestMs == null || ms < this.lap.bestMs) this.lap.bestMs = ms;
        this.lap.t0 = wallNow;
        this.events.emit('lapFinished', {
          trackId: this.trackPreset.id,
          vehicleId: this.vehicle.id,
          lapMs: ms,
          sectors: [],
        });
      }
    }
    this.lap.prevSign = sign;
  }
}

// Re-exported for adapter ergonomics.
export type { CameraMode, DriveLayout };
