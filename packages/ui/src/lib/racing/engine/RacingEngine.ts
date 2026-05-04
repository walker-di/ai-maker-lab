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
 * Track contact uses an analytic flat-ground raycast (the prototype's same
 * approach) — terrain elevation is a follow-up.
 */

import { Quaternion, Vector3 } from 'three';
import { EngineEmitter } from './events.js';
import { CameraRig, type CameraMode } from './cameras.js';
import { FixedStepLoop } from './fixed-step-loop.js';
import { NullAudioBus, type AudioBus } from './audio-bus.js';
import { RacingInput } from './input.js';
import { SurfaceLookup } from './tracks/surface-lookup.js';
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
  computeAligningMoment,
  computeAntiPitchVertical,
  computeAxleArb,
  computeBumpStopForce,
  computeCamberThrust,
  computeCasterCamber,
  computeEscBrakeTargets,
  computeFrontRollStiffnessShare,
  computeLateralLoadTransfer,
  computeLongitudinalLoadTransfer,
  computeTcCut,
  computeToeSlipOffset,
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
import type {
  DiffType,
  DriveLayout,
  SetupValues,
  SurfaceId,
  TrackPreset,
  VehiclePreset,
} from '../types.js';

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
};
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
    bumpStopPct: number;
    brakeTorqueApplied: number;
    absScale: number;
    absActive: boolean;
    yawContribution: number;
    /** Drive torque (Nm) routed to this wheel by the drivetrain solver. */
    driveTorqueNm: number;
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
  };
  aero: {
    /** Front-axle aero downforce magnitude (N). */
    frontDownforceN: number;
    /** Rear-axle aero downforce magnitude (N). */
    rearDownforceN: number;
    /** Magnitude of chassis-frame aero drag this step (N). */
    dragN: number;
  };
  lap: { lastMs: number | null; bestMs: number | null; t0: number | null };
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

  // ARB
  private arbFront = 25000;
  private arbRear = 22000;

  // Suspension
  private susp = {
    restLen: 0.32,
    kFront: 65000,
    kRear: 60000,
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

  // Aero
  private cdA = 0.7;
  private cyYaw = 0.1;
  /** Effective `Cl · A` for the front axle (m²). 0 = no front downforce. */
  private clAreaFront = 0;
  /** Effective `Cl · A` for the rear axle (m²). 0 = no rear downforce. */
  private clAreaRear = 0;
  /**
   * Per-axle aerodynamic downforce computed by the wheel pass and consumed
   * by `runAero()` to cancel the chassis-up boost it introduces. Without
   * the cancellation, adding downforce to per-wheel `fz` would also pump
   * upward force into the rigid body via the contact-force projection.
   */
  private readonly lastAeroDownforce = { front: 0, rear: 0 };

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
    this.buildSurfaceLookup();
    this.resetCar();
  }

  setVehiclePreset(preset: VehiclePreset): void {
    this.vehicle = preset;
    this.applyVehiclePhysicsPreset();
    this.buildWheels();
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
    this.susp.motionRatioFront = setup.motionRatioFront;
    this.susp.motionRatioRear = setup.motionRatioRear;
    this.susp.bumpStopGapFrontM = setup.bumpStopGapFrontMm * 0.001;
    this.susp.bumpStopGapRearM = setup.bumpStopGapRearMm * 0.001;
    this.susp.bumpStopRateFront = setup.bumpStopRateFrontNmm * 1000;
    this.susp.bumpStopRateRear = setup.bumpStopRateRearNmm * 1000;
    for (let i = 0; i < this.wheels.length; i++) {
      const isFront = i < 2;
      this.wheels[i].toeDeg = isFront ? setup.frontToeDeg : setup.rearToeDeg;
    }
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
      const attachLocal = new Vector3(wheel.posLocal.x, wheel.posLocal.y + 0.47, wheel.posLocal.z);
      const attachWorld = attachLocal.clone().applyQuaternion(this.worldQuat).add(this.worldPos);
      const downDir = new Vector3(0, -1, 0).applyQuaternion(this.worldQuat).normalize();
      const suspensionTravel = this.susp.restLen - wheel.compression;
      const center = attachWorld.clone().addScaledVector(downDir, suspensionTravel);
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
    this.worldPos.set(spawn.x, this.susp.restLen + 0.34 + 0.05, spawn.z);
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
      w.prevCompression = 0;
      w.slipRatio = 0;
      w.slipAngle = 0;
      w.slipRatioTarget = 0;
      w.slipAngleTarget = 0;
      w.slipRatioDynamic = 0;
      w.slipAngleDynamic = 0;
      w._externalTorque = 0;
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
    this.integrateChassis(dt);
    this.updateChassisDerived();
    this.updateLapTimer(this.simTime);
    this.audio.setRpm(this.engineOmega * (60 / (2 * Math.PI)));

    this.events.emit('tick', { simTime: this.simTime, dt });
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
          bumpStopPct: w.bumpStopPct,
          brakeTorqueApplied: w.brakeTorqueApplied,
          absScale: w.absScale,
          absActive: w.absActive,
          yawContribution: w.yawContribution,
          driveTorqueNm: this.driveTorqueByWheel[i] ?? 0,
        };
      }),
      drivetrain: {
        engineOmega: this.engineOmega,
        transmissionOmega: this.transmissionOmega,
        clutchTorqueNm: this.clutchTorqueNm,
        clutchMode: this.clutchMode,
        engineDriveTorqueNm: this.engineDriveTorqueNm,
        engineDragTorqueNm: this.engineDragTorqueNm,
      },
      aero: {
        frontDownforceN: this.lastAeroDownforce.front,
        rearDownforceN: this.lastAeroDownforce.rear,
        dragN: this.aeroDragMagN,
      },
      lap: { lastMs: this.lap.lastMs, bestMs: this.lap.bestMs, t0: this.lap.t0 },
    };
  }

  dispose(): void {
    this.events.removeAll();
    this.input.detach();
    this.audio.dispose();
  }

  shiftUp(): void {
    if (this.gearIndex < this.vehicle.gears.length - 1) this.gearIndex++;
  }
  shiftDown(): void {
    if (this.gearIndex > 0) this.gearIndex--;
  }

  // ---- internal helpers --------------------------------------------------

  private applyVehiclePhysicsPreset(): void {
    const physics = this.vehicle.physics;
    this.chassisMass = physics?.massKg ?? 1240;
    // Body axes are x=roll, y=yaw, z=pitch.
    this.chassisInertia.set(
      physics?.inertiaRollKgM2 ?? 450,
      physics?.inertiaYawKgM2 ?? 1700,
      physics?.inertiaPitchKgM2 ?? 1500,
    );
    this.susp.kFront = physics?.springFrontNpm ?? 65000;
    this.susp.kRear = physics?.springRearNpm ?? 60000;
    this.susp.cBumpFront = physics?.damperBumpFrontNsPm ?? 4200;
    this.susp.cReboundFront = physics?.damperReboundFrontNsPm ?? 5800;
    this.susp.cBumpRear = physics?.damperBumpRearNsPm ?? 4400;
    this.susp.cReboundRear = physics?.damperReboundRearNsPm ?? 6000;
    this.arbFront = physics?.arbFrontNpm ?? 25000;
    this.arbRear = physics?.arbRearNpm ?? 22000;
    this.cdA = physics?.cdAreaM2 ?? 0.7;
    this.cyYaw = physics?.yawAeroCoeff ?? 0.1;
    this.clAreaFront = Math.max(0, physics?.clAreaFrontM2 ?? 0);
    this.clAreaRear = Math.max(0, physics?.clAreaRearM2 ?? 0);
    this.lastAeroDownforce.front = 0;
    this.lastAeroDownforce.rear = 0;
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
  }

  private buildWheels(): void {
    this.wheels.length = 0;
    const halfTrack = this.vehicle.trackWidth * 0.5;
    // Chassis forward = -Z, so front wheels sit at negative Z and rear wheels
    // at positive Z in chassis-local space.
    const frontZ = -this.vehicle.wheelbase * (1 - this.vehicle.frontMassPct);
    const rearZ = this.vehicle.wheelbase * this.vehicle.frontMassPct;
    const positions = [
      new Vector3(-halfTrack, -0.30, frontZ),
      new Vector3(halfTrack, -0.30, frontZ),
      new Vector3(-halfTrack, -0.30, rearZ),
      new Vector3(halfTrack, -0.30, rearZ),
    ];
    const drive = [
      0.5 * this.vehicle.axleDrive.front,
      0.5 * this.vehicle.axleDrive.front,
      0.5 * this.vehicle.axleDrive.rear,
      0.5 * this.vehicle.axleDrive.rear,
    ];
    for (let i = 0; i < 4; i++) {
      const isFront = i < 2;
      this.wheels.push({
        index: i,
        posLocal: positions[i],
        radius: 0.34,
        inertia: 1.4,
        lateralSign: positions[i].x >= 0 ? 1 : -1,
        steer: isFront,
        hand: !isFront,
        drive: drive[i] > 0,
        driveShare: drive[i],
        toeDeg: isFront ? this.setup.frontToeDeg : this.setup.rearToeDeg,
        camberStaticDeg: -1.5,
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
    this.surfaceLookup = new SurfaceLookup({
      points,
      halfWidth: this.trackPreset.halfWidth,
      curbWidth: this.trackPreset.curbWidth,
      rubberWidth: this.trackPreset.rubberWidth,
      marblesWidth: this.trackPreset.marblesWidth,
      defaultOffTrack: 'GRASS',
      zones,
    });
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
    const restLen = this.susp.restLen;
    for (const w of this.wheels) {
      const localPos = new Vector3(w.posLocal.x, w.posLocal.y + 0.47, w.posLocal.z);
      const worldAttach = localPos.clone().applyQuaternion(this.worldQuat).add(this.worldPos);
      const downDir = this.up.clone().multiplyScalar(-1);
      const maxLen = restLen + w.radius;
      let comp = 0;
      let inContact = false;
      if (downDir.y < 0) {
        const t = (0 - worldAttach.y) / downDir.y;
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

    let engineDriveT = 0;
    if (this.effectiveThrottle > 0) {
      const rpm = Math.max(ENGINE_IDLE, this.engineOmega * (60 / (2 * Math.PI)));
      const thr = rpm > ENGINE_REDLINE ? this.effectiveThrottle * 0.05 : this.effectiveThrottle;
      engineDriveT = engineTorqueAt(rpm) * thr;
    }
    const offThrottle = clamp(1 - this.effectiveThrottle * 4, 0, 1);
    const engineDragT = 0.04 * Math.abs(this.engineOmega) + 8 + 20 * offThrottle;

    // Stash engine torques. The rotational chain (engine + clutch + gearbox
    // + diff + driven wheels) is integrated together by `stepDrivetrain`
    // after the wheel-force pass so it sees this step's tire/brake torque.
    this.engineDriveTorqueNm = engineDriveT;
    this.engineDragTorqueNm = engineDragT;
    this.driveTorqueByWheel = [0, 0, 0, 0];

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
    const brakeBiasFront = this.vehicle.physics?.brakeBiasFront ?? 0.565;
    const aids = this.driverAids;
    const steerCmdRad = this.input.state.steerSmoothed * (this.vehicle.steerMaxDeg * RAD);
    const ackermann = computeAckermannAngles(
      steerCmdRad,
      this.vehicle.wheelbase,
      this.vehicle.trackWidth,
      this.setup.ackermannPct,
    );

    // Phase 4 aero downforce: per-axle vertical load that grows with the
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
    });
    this.lastAeroDownforce.front = aeroDown.frontDownforceN;
    this.lastAeroDownforce.rear = aeroDown.rearDownforceN;
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

    for (let i = 0; i < this.wheels.length; i++) {
      const w = this.wheels[i];
      const isFront = i < 2;

      // Toe must mirror across chassis sides — toe-in means each front wheel
      // rotates toward chassis centre, so FL gets a negative steer offset and
      // FR a positive one. `computeToeSlipOffset` returns the correctly
      // mirrored offset for the given axle and `lateralSign`.
      const toeOffset = computeToeSlipOffset(
        w.toeDeg,
        w.lateralSign,
        isFront ? 'front' : 'rear',
      );
      if (w.steer) {
        w.baseSteerAngle = i === 0 ? ackermann.leftRad : ackermann.rightRad;
        w.steerAngle = w.baseSteerAngle + toeOffset;
      } else {
        w.baseSteerAngle = 0;
        w.steerAngle = toeOffset;
      }

      const localPos = new Vector3(w.posLocal.x, w.posLocal.y + 0.47, w.posLocal.z);
      const worldAttach = localPos.clone().applyQuaternion(this.worldQuat).add(this.worldPos);
      const downDir = this.up.clone().multiplyScalar(-1);
      const restLen = this.susp.restLen;
      const maxLen = restLen + w.radius;

      let hit: { t: number; point: Vector3 } | null = null;
      if (downDir.y < 0) {
        const t = (0 - worldAttach.y) / downDir.y;
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
        w.tempC = stepTireTemperature({ tempC: w.tempC, slidePower: 0, contactSpeed: speed, dt });
        w.brakeTempC = stepBrakeTemperature({ brakeTempC: w.brakeTempC, brakeTorque: 0, omega: 0, contactSpeed: speed, dt });
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
      const cBump = isFront ? this.susp.cBumpFront : this.susp.cBumpRear;
      const cReb = isFront ? this.susp.cReboundFront : this.susp.cReboundRear;
      const motionRatio = isFront ? this.susp.motionRatioFront : this.susp.motionRatioRear;
      const motionRatioSq = motionRatio * motionRatio;
      const c = compressionVel >= 0 ? cBump : cReb;
      const fzSpring = k * motionRatioSq * compression + c * motionRatioSq * compressionVel;
      const bumpThreshold = isFront ? this.susp.bumpStopGapFrontM : this.susp.bumpStopGapRearM;
      const bumpRate = isFront ? this.susp.bumpStopRateFront : this.susp.bumpStopRateRear;
      const bumpForce = computeBumpStopForce(compression, bumpThreshold, bumpRate);
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
      const fz = Math.max(0, fzSpring + bumpForce + w._arbDfz + aeroShift + longShift + lateralShift);
      w.fz = fz;
      w.bumpStopForce = bumpForce;
      w.bumpStopPct = clamp(Math.max(0, compression - bumpThreshold) / 0.05, 0, 1);
      w.contact = true;
      w.damperVelocity = compressionVel * motionRatio;

      w.surface = this.surfaceLookup?.surfaceAt(hit.point.x, hit.point.z) ?? 'ASPHALT';
      const surf = SURFACE_TABLE[w.surface];
      const mu = surf.mu * tireTempMu(w.tempC);
      w.mu = mu;

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
      w.slipRatioDynamic = stepRelaxedSlip({
        slipTarget: targets.slipRatio,
        slipDynamic: w.slipRatioDynamic,
        contactSpeed: targets.contactSpeed,
        relaxationLength: TIRE_RELAXATION_LENGTH_LONG_M,
        dt,
      });
      w.slipAngleDynamic = stepRelaxedSlip({
        slipTarget: targets.slipAngleRad,
        slipDynamic: w.slipAngleDynamic,
        contactSpeed: targets.contactSpeed,
        relaxationLength: TIRE_RELAXATION_LENGTH_LAT_M,
        dt,
      });
      w.slipRatio = w.slipRatioDynamic;
      w.slipAngle = w.slipAngleDynamic;
      const slipRatio = w.slipRatio;
      const slipAngle = w.slipAngle;
      w.combinedSlip = Math.hypot(slipRatio, slipAngle);

      // Phase 2 Pacejka MF 5.6 evaluator: pure longitudinal/lateral curves
      // get dfz-based load sensitivity so peak force, slip stiffness, and
      // curvature scale with vertical load. Combined slip is weighted with
      // smooth MF-style cosines (Gxa, Gyk) normalized so they equal `1` at
      // pure slip — there is no `0.35` floor and no isotropic friction-circle
      // clamp downstream, so saturation comes entirely from the tire model.
      const tireOverride = isFront
        ? this.vehicle.physics?.tireFront
        : this.vehicle.physics?.tireRear;
      const tire = evaluatePacejka56Combined({
        kappa: slipRatio,
        alphaRad: slipAngle,
        fz,
        muScale: mu,
        axle: isFront ? 'front' : 'rear',
        params: tireOverride,
      });
      let Fx = tire.fx;
      let Fy = tire.fy;

      // Phase 6A aligning moment: pneumatic trail decays with slip, caster
      // adds mechanical trail at the front, and scrub-radius couples the
      // longitudinal force into yaw. Caster and scrub are front-axle
      // concerns — rear wheels report a pneumatic-only Mz.
      const alignCasterDeg = w.steer ? this.setup.casterDeg : 0;
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

      const rollRad = this.rollDeg * RAD;
      const casterCamberRad = w.steer
        ? computeCasterCamber(w.baseSteerAngle, this.setup.casterDeg)
        : 0;
      const camber = computeCamberThrust({
        staticCamberRad: w.camberStaticDeg * RAD,
        rollRad,
        camberGain: w.camberGain,
        casterCamberRad,
        lateralSign: w.lateralSign,
        fz,
      });
      w.camberRad = camber.camberRad;
      Fy += camber.thrust;

      const slipVx = w.omega * w.radius - vx;
      w.slidePower = Math.abs(Fx * slipVx) + Math.abs(Fy * vy);
      w.tempC = stepTireTemperature({
        tempC: w.tempC,
        slidePower: w.slidePower,
        contactSpeed: Math.abs(vx),
        dt,
      });

      // Phase 6F removed the broad `lowSpeedScale` fade. Dynamic slip with
      // relaxation lag (Phase 1) + the post-drivetrain wheel-rotation lock
      // (Phase 6E) now handle low-speed behaviour without the artificial
      // ramp. We keep a narrow Fy-only standstill blend in the bottom
      // 0.2 m/s of total chassis speed so a stray atan2-driven sideslip
      // sample at exact rest cannot inject a tire-side lateral kick;
      // longitudinal force passes through at full authority so launch
      // grip is whatever Pacejka and the contact patch can actually
      // produce.
      const STANDSTILL_FY_FLOOR_MPS = 0.2;
      if (speed < STANDSTILL_FY_FLOOR_MPS) {
        Fy *= clamp(speed / STANDSTILL_FY_FLOOR_MPS, 0, 1);
      }

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
      const fzApplied = fz + fzGeo;

      const force = new Vector3()
        .addScaledVector(this.up, fzApplied)
        .addScaledVector(wheelFwd, Fx)
        .addScaledVector(wheelLat, Fy);
      totalForce.add(force);
      const wheelTorque = new Vector3().crossVectors(r, force);
      totalTorque.add(wheelTorque);
      // Self-aligning moment about chassis up.
      totalTorque.add(this.up.clone().multiplyScalar(w.mz));
      // Diagnostic: this wheel's contribution to the chassis-up yaw axis.
      w.yawContribution = wheelTorque.dot(this.up) + w.mz;

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
      finalDrive: this.vehicle.finalDrive,
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
    for (let i = 0; i < this.wheels.length; i++) {
      const w = this.wheels[i];
      let omega = result.wheelOmegas[i];
      // Phase 6E low-speed wheel-rotation lock. Below the lock-speed window
      // the contact patch barely moves, so tiny slip-ratio errors can
      // otherwise grow into forward/backward chatter (the legacy
      // `slipEps = 1.5` cliff was masking exactly this). The lock pins the
      // wheel angular velocity to `vx / r` while drive torque stays small
      // and clamps it to zero when the brake is firmly applied; both
      // unlock automatically once real torque is present. Airborne wheels
      // skip the lock entirely (no contact patch).
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
      // Small per-step damping. Stronger for airborne wheels so a
      // freely-spinning wheel does not pin the engine to redline forever
      // through the locked-clutch kinematic coupling.
      const decayRate = w.contact ? 0.05 : 0.5;
      omega *= Math.exp(-decayRate * dt);
      w.omega = omega;
      w.spinAngle += omega * dt;
    }
  }

  private runAero(): void {
    const local = this.velocityWS.clone().applyQuaternion(this.worldQuat.clone().invert());
    const drag = computeAeroDrag({ forwardSpeed: local.z, sideSpeed: local.x, cdArea: this.cdA });
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

    // Linear: a = F / m
    const accel = totalForce.divideScalar(this.chassisMass);
    this.velocityWS.addScaledVector(accel, dt);
    // Linear damping (very mild — keeps integration stable at idle).
    this.velocityWS.multiplyScalar(Math.exp(-0.02 * dt));
    this.worldPos.addScaledVector(this.velocityWS, dt);

    // Don't sink through the ground.
    const minHeight = this.susp.restLen + 0.34 + 0.05 - 0.4;
    if (this.worldPos.y < minHeight) {
      this.worldPos.y = minHeight;
      if (this.velocityWS.y < 0) this.velocityWS.y = 0;
    }

    // Angular: alpha = I^-1 * tau (in body frame). Rotate torque into body frame.
    const invQ = this.worldQuat.clone().invert();
    const torqueLocal = this.appliedTorque.clone().applyQuaternion(invQ);
    const omegaLocal = this.omegaWS.clone().applyQuaternion(invQ);
    const alpha = new Vector3(
      torqueLocal.x / this.chassisInertia.x,
      torqueLocal.y / this.chassisInertia.y,
      torqueLocal.z / this.chassisInertia.z,
    );
    omegaLocal.addScaledVector(alpha, dt);
    omegaLocal.multiplyScalar(Math.exp(-0.18 * dt));
    this.omegaWS.copy(omegaLocal).applyQuaternion(this.worldQuat);

    // Integrate orientation.
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
    if (Math.abs(localVel.z) > 0.5 || Math.abs(localVel.x) > 0.5) {
      this.sideslipRad =
        Math.atan2(localVel.x, Math.max(0.001, Math.abs(localVel.z))) * Math.sign(-localVel.z || 1);
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
