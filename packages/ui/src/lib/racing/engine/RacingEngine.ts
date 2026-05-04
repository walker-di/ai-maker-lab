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
  applyDiffCoupling,
  brakeFadeFactor,
  classifyEsc,
  computeAckermannAngles,
  computeAeroDrag,
  computeAntiPitchVertical,
  computeAxleArb,
  computeBumpStopForce,
  computeCamberThrust,
  computeCasterCamber,
  computeClutchTorque,
  computeSelfAligningMoment,
  computeTcCut,
  computeYawRestoringMoment,
  ENGINE_IDLE,
  ENGINE_REDLINE,
  engineTorqueAt,
  pacejkaLat,
  pacejkaLong,
  stepBrakeTemperature,
  stepEngineOmega,
  stepTireTemperature,
  tireD,
  tireTempMu,
  TIRE_AMBIENT_C,
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
  slipRatio: number;
  slipAngle: number;
  camberRad: number;
  slidePower: number;

  tempC: number;
  brakeTempC: number;
  brakeFade: number;

  absRelease: number;
  absActive: boolean;
  escTorque: number;

  // ARB pre-pass scratch.
  _preCompression: number;
  _preContact: boolean;
  _arbDfz: number;
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
    slipRatio: number;
    slipAngle: number;
    surface: SurfaceId;
    tempC: number;
    brakeTempC: number;
    bumpStopPct: number;
  }>;
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
  private readonly forward = new Vector3(0, 0, 1);
  private readonly right = new Vector3(1, 0, 0);
  private readonly up = new Vector3(0, 1, 0);

  private readonly chassisMass = 1240;
  private readonly chassisInertia = new Vector3(1500, 1700, 450);

  // Drivetrain state
  private engineOmega = ENGINE_IDLE * (2 * Math.PI / 60);
  private gearIndex = 1; // Reverse, Neutral, 1, 2, ... — N is index 1
  private clutchStiffness = 350;
  private clutchMaxTorque = 720;
  private engineInertia = 0.18;

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

  // Diff
  private diff = { type: 'clutchLSD' as DiffType, powerLockPct: 0.45, coastLockPct: 0.3, preloadNm: 60, capacityNm: 1200 };

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

  readonly input = new RacingInput({ casterDeg: () => this.setup.casterDeg });

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
    this.buildWheels();
    this.buildSurfaceLookup();
    this.resetCar();
  }

  setVehiclePreset(preset: VehiclePreset): void {
    this.vehicle = preset;
    this.diff.type = preset.diffType;
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
    const forward = new Vector3(0, 0, 1).applyQuaternion(this.worldQuat);
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
    this.engineOmega = ENGINE_IDLE * (2 * Math.PI / 60);
    this.gearIndex = 1; // Neutral
    for (const w of this.wheels) {
      w.omega = 0;
      w.spinAngle = 0;
      w.absRelease = 0;
      w.absActive = false;
      w.escTorque = 0;
      w.tempC = TIRE_AMBIENT_C;
      w.brakeTempC = TIRE_AMBIENT_C;
      w.brakeFade = 1;
      w.prevCompression = 0;
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
    this.runDiffCoupling(dt);
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
      wheels: this.wheels.map((w) => ({
        index: w.index,
        fz: w.fz,
        slipRatio: w.slipRatio,
        slipAngle: w.slipAngle,
        surface: w.surface,
        tempC: w.tempC,
        brakeTempC: w.brakeTempC,
        bumpStopPct: w.bumpStopPct,
      })),
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

  private buildWheels(): void {
    this.wheels.length = 0;
    const halfTrack = this.vehicle.trackWidth * 0.5;
    const frontZ = this.vehicle.wheelbase * (1 - this.vehicle.frontMassPct);
    const rearZ = -this.vehicle.wheelbase * this.vehicle.frontMassPct;
    const positions = [
      new Vector3(halfTrack, -0.30, frontZ),
      new Vector3(-halfTrack, -0.30, frontZ),
      new Vector3(halfTrack, -0.30, rearZ),
      new Vector3(-halfTrack, -0.30, rearZ),
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
        lateralSign: i % 2 === 0 ? 1 : -1,
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
        camberRad: 0,
        slidePower: 0,
        tempC: TIRE_AMBIENT_C,
        brakeTempC: TIRE_AMBIENT_C,
        brakeFade: 1,
        absRelease: 0,
        absActive: false,
        escTorque: 0,
        _preCompression: 0,
        _preContact: false,
        _arbDfz: 0,
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
    const quat = new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), tangent);
    return { x: first.x, z: first.z, quat };
  }

  private updateBasis(): void {
    this.forward.set(0, 0, 1).applyQuaternion(this.worldQuat);
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
    const gear = this.vehicle.gears[this.gearIndex];
    const ratio = gear.ratio * this.vehicle.finalDrive;
    const drivenOmegaAvg = this.wheels.reduce(
      (sum, w) => sum + (w.driveShare || 0) * w.omega,
      0,
    );
    const wheelEngineOmega = drivenOmegaAvg * ratio;

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
      yawRateRad: this.yawRateRad,
      desiredYawRad,
      sideslipDeg: this.sideslipRad * DEG,
      oversteerThreshold: aids.escOversteerThreshold,
      understeerThreshold: aids.escUndersteerThreshold,
      minSpeedKmh: aids.escMinSpeedKmh,
    });
    aids.escActive = esc.active;
    aids.escTorqueTargetByWheel.fill(0);
    if (esc.active && esc.turnSign !== 0 && esc.axle) {
      const leftTurn = esc.turnSign > 0;
      const targetIndex = esc.axle === 'front'
        ? (leftTurn ? 0 : 1)
        : (leftTurn ? 3 : 2);
      const threshold = esc.mode === 'oversteer'
        ? aids.escOversteerThreshold
        : aids.escUndersteerThreshold;
      const cap = aids.escMaxBrakeTorque * (esc.mode === 'understeer' ? 0.8 : 1);
      const normalized = clamp(
        (Math.abs(esc.yawError) - threshold) / Math.max(0.05, threshold * 2),
        0,
        1,
      );
      aids.escTorqueTargetByWheel[targetIndex] = cap * normalized;
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

    let clutchT = 0;
    this.driveTorqueByWheel = [0, 0, 0, 0];
    if (gear.ratio !== 0) {
      const r = computeClutchTorque({
        engineOmega: this.engineOmega,
        wheelEngineOmega,
        clutchStiffness: this.clutchStiffness,
        clutchMaxTorque: this.clutchMaxTorque,
      });
      clutchT = r.clutchTorque;
      const wheelTotal = clutchT * ratio * DRIVE_EFFICIENCY;
      for (let i = 0; i < 4; i++) {
        this.driveTorqueByWheel[i] = wheelTotal * this.wheels[i].driveShare;
      }
    }

    this.engineOmega = stepEngineOmega({
      engineOmega: this.engineOmega,
      engineDriveTorque: engineDriveT,
      engineDragTorque: engineDragT,
      clutchTorque: clutchT,
      engineInertia: this.engineInertia,
      idleOmega: ENGINE_IDLE * (2 * Math.PI / 60),
      redlineOmega: ENGINE_REDLINE * 1.05 * (2 * Math.PI / 60),
      dt,
    });

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
    const maxBrakeTorque = 4200;
    const brakeBiasFront = 0.565;
    const aids = this.driverAids;
    const steerCmdRad = this.input.state.steerSmoothed * (this.vehicle.steerMaxDeg * RAD);
    const ackermann = computeAckermannAngles(
      steerCmdRad,
      this.vehicle.wheelbase,
      this.vehicle.trackWidth,
      this.setup.ackermannPct,
    );

    const totalForce = new Vector3();
    const totalTorque = new Vector3();

    for (let i = 0; i < this.wheels.length; i++) {
      const w = this.wheels[i];
      const isFront = i < 2;

      if (w.steer) {
        w.baseSteerAngle = i === 0 ? ackermann.leftRad : ackermann.rightRad;
        w.steerAngle = w.baseSteerAngle + w.toeDeg * RAD;
      } else {
        w.baseSteerAngle = 0;
        w.steerAngle = w.toeDeg * RAD;
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
        w.slidePower = 0;
        w.surface = 'ASPHALT';
        w.compression = 0;
        w.bumpStopForce = 0;
        w.bumpStopPct = 0;
        w.tempC = stepTireTemperature({ tempC: w.tempC, slidePower: 0, contactSpeed: speed, dt });
        w.brakeTempC = stepBrakeTemperature({ brakeTempC: w.brakeTempC, brakeTorque: 0, omega: 0, contactSpeed: speed, dt });
        w.omega *= Math.exp(-0.5 * dt);
        if (w.drive) w.omega += this.driveTorqueByWheel[i] / w.inertia * dt;
        w.spinAngle += w.omega * dt;
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
      const fz = Math.max(0, fzSpring + bumpForce + w._arbDfz);
      w.fz = fz;
      w.bumpStopForce = bumpForce;
      w.bumpStopPct = clamp(Math.max(0, compression - bumpThreshold) / 0.05, 0, 1);
      w.contact = true;
      w.damperVelocity = compressionVel * motionRatio;

      w.surface = this.surfaceLookup?.surfaceAt(hit.point.x, hit.point.z) ?? 'ASPHALT';
      const surf = SURFACE_TABLE[w.surface];
      const mu = surf.mu * tireTempMu(w.tempC);

      const wheelFwd = this.forward.clone().applyAxisAngle(this.up, w.steerAngle).normalize();
      const wheelLat = new Vector3().crossVectors(this.up, wheelFwd).normalize();
      const r = hit.point.clone().sub(this.worldPos);
      const vAtContact = this.velocityWS.clone().add(new Vector3().crossVectors(this.omegaWS, r));
      const vx = vAtContact.dot(wheelFwd);
      const vy = vAtContact.dot(wheelLat);

      const slipEps = 1.5;
      const slipRatio = (w.omega * w.radius - vx) / (Math.abs(vx) + slipEps);
      const slipAngle = -Math.atan2(vy, Math.max(Math.abs(vx), 1.5));
      w.slipRatio = slipRatio;
      w.slipAngle = slipAngle;

      const fall = 0.11;
      let Fx = pacejkaLong(slipRatio, fz, mu);
      let Fy = pacejkaLat(slipAngle, fz, mu, fall);
      const Gyk = 1 / (1 + 1.8 * Math.abs(slipRatio));
      Fy *= Gyk;

      w.mz = computeSelfAligningMoment({ slipAngleRad: slipAngle, fySlip: Fy });

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

      const lowSpeedScale = clamp(speed / 1.5, 0, 1);
      Fy *= lowSpeedScale;
      Fx *= 0.4 + 0.6 * lowSpeedScale;

      const Fmax = tireD(mu, fz);
      const F = Math.hypot(Fx, Fy);
      if (F > Fmax && Fmax > 0) {
        const k2 = Fmax / F;
        Fx *= k2; Fy *= k2;
      }

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
      totalTorque.add(new Vector3().crossVectors(r, force));
      // Self-aligning moment about chassis up.
      totalTorque.add(this.up.clone().multiplyScalar(w.mz));

      // Wheel angular velocity.
      let netTorque = 0;
      if (w.drive) netTorque += this.driveTorqueByWheel[i];
      netTorque -= (Fx - Frx) * w.radius;

      const biasFactor = isFront ? brakeBiasFront : 1 - brakeBiasFront;
      const fade = brakeFadeFactor({ brakeTempC: w.brakeTempC });
      w.brakeFade = fade;
      const abs = applyAbs({
        enabled: aids.absEnabled,
        driverBrake: this.driverBrake,
        vx,
        slipRatio,
        threshold: aids.absThreshold,
        release: w.absRelease,
        releaseTime: aids.absReleaseTime,
        dt,
      });
      w.absRelease = abs.release;
      w.absActive = abs.active;
      if (abs.active) {
        aids.absActive = true;
        aids.absEventCount++;
      }
      const brakeTorqueRaw = this.driverBrake * maxBrakeTorque * biasFactor * fade * abs.scale;
      const handbrakeTorque = w.hand ? this.input.state.handbrake * 4200 : 0;
      const escBrakeTorque = aids.escTorqueByWheel[i] || 0;
      w.escTorque = escBrakeTorque;
      const brakeTorque = brakeTorqueRaw + handbrakeTorque + escBrakeTorque;
      w.brakeTempC = stepBrakeTemperature({
        brakeTempC: w.brakeTempC,
        brakeTorque,
        omega: w.omega,
        contactSpeed: Math.abs(vx),
        dt,
      });
      const omegaSign = Math.sign(w.omega) || (vx > 0 ? 1 : vx < 0 ? -1 : 0);
      const maxBrakeReactMag = Math.abs(w.omega) * w.inertia / Math.max(dt, 1e-6) + Math.abs(netTorque);
      const brakeReact = -omegaSign * Math.min(maxBrakeReactMag, brakeTorque);
      netTorque += brakeReact;

      w.omega += (netTorque / w.inertia) * dt;
      w.omega *= Math.exp(-0.05 * dt);
      w.spinAngle += w.omega * dt;
    }

    this.appliedForce.copy(totalForce);
    this.appliedTorque.copy(totalTorque);
  }

  private runDiffCoupling(dt: number): void {
    const wL = this.wheels[2];
    const wR = this.wheels[3];
    const r = applyDiffCoupling({
      type: this.diff.type,
      leftOmega: wL.omega,
      rightOmega: wR.omega,
      leftInertia: wL.inertia,
      effectiveThrottle: this.effectiveThrottle,
      driveTorquePerWheel: (this.driveTorqueByWheel[2] + this.driveTorqueByWheel[3]) * 0.5,
      preloadNm: this.diff.preloadNm,
      capacityNm: this.diff.capacityNm,
      powerLockPct: this.diff.powerLockPct,
      coastLockPct: this.diff.coastLockPct,
      dt,
    });
    wL.omega = r.leftOmega;
    wR.omega = r.rightOmega;
  }

  private runAero(): void {
    const local = this.velocityWS.clone().applyQuaternion(this.worldQuat.clone().invert());
    const drag = computeAeroDrag({ forwardSpeed: local.z, sideSpeed: local.x, cdArea: this.cdA });
    const speed = this.velocityWS.length();
    const yawMoment = computeYawRestoringMoment({
      sideslipRad: this.sideslipRad,
      speed,
      cyYaw: this.cyYaw,
    });
    // Convert local-frame drag back to world.
    const dragWS = new Vector3()
      .addScaledVector(this.right, drag.fxDragWS)
      .addScaledVector(this.forward, drag.fzDragWS);
    this.appliedForce.add(dragWS);
    this.appliedTorque.add(this.up.clone().multiplyScalar(yawMoment));
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
    this.accelLongG = localAccel.z / 9.81;
    this.prevLocalVelocity.copy(localVel);
    if (Math.abs(localVel.z) > 0.5 || Math.abs(localVel.x) > 0.5) {
      this.sideslipRad =
        Math.atan2(localVel.x, Math.max(0.001, Math.abs(localVel.z))) * Math.sign(localVel.z || 1);
    } else {
      this.sideslipRad = 0;
    }
    this.yawRateRad = this.omegaWS.dot(this.up);

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
