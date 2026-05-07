import type { SurfaceId } from '../types.js';
import { DEFAULT_ROLL_CENTER_HEIGHT_M } from '../engine/physics/suspension-kinematics.js';

// 'utilization' shows the Phase 7 tire-utilization bar: how close each
// tire is to its current friction-circle ceiling. Useful for tuning
// combined-slip behaviour.
export type RacingTelemetryMode = 'load' | 'slip' | 'utilization';

export interface RacingHudWheelState {
  index: number;
  fz: number;
  fx: number;
  fy: number;
  slipRatio: number;
  slipAngle: number;
  combinedSlip: number;
  /** `hypot(Fx, Fy) / (mu · Fz)` — clamped at 0 if airborne. */
  tireUtilization: number;
  /** Drive torque applied to this wheel by the drivetrain solver (Nm). */
  driveTorqueNm: number;
  surface: SurfaceId | null;
  tempC: number;
  brakeTempC: number;
  /** Normalized tire-wear accumulation. */
  tireWear: number;
  /** Normalized flat-spot signal from locked-wheel braking. */
  flatSpotSignal: number;
  bumpStopPct: number;
  airborne: boolean;
  brakeTorqueApplied: number;
  absScale: number;
  absActive: boolean;
  yawContribution: number;
  // M1 additions
  tempInner: number;
  tempMiddle: number;
  tempOuter: number;
  pressureKpa: number;
  kappaPeak: number;
  alphaPeakRad: number;
  tireDeflection: number;
  // Contact-patch diagnostics
  relaxationLengthLongM?: number;
  relaxationLengthLatM?: number;
  slidingGripScale?: number;
  slidingSpeedMps?: number;
  pressureInner?: number;
  pressureMiddle?: number;
  pressureOuter?: number;
  pressureCentroidM?: number;
  overturningMomentNm?: number;
  // M3 additions
  /** Suspension travel (m, positive = compression). */
  suspensionTravel: number;
  /** Damper shaft velocity (m/s, positive = compression). */
  damperVelocity: number;
  /** Roll-center height (m) from kinematics table. */
  rollCenterHeightM: number;
  /** Jacking force contribution (N, positive = lifts chassis). */
  jackingForceN: number;
  /** Travel-resolved toe angle (deg) including bump-steer. */
  toeDeg: number;
  /** Travel-resolved camber angle (deg). */
  camberDeg: number;
}

export interface RacingHudDrivetrainState {
  engineOmega: number;
  transmissionOmega: number;
  clutchTorqueNm: number;
  clutchMode: 'locked' | 'slipping';
  engineDriveTorqueNm: number;
  engineDragTorqueNm: number;
  // M6 additions
  boostBar: number;
  turboSpoolRatio: number;
  boostTorqueMultiplier: number;
  isOverboost: boolean;
  shiftRefused: boolean;
  shiftRefusalReason: string;
  shiftInProgress: boolean;
  shiftRemainingS: number;
  drivelineComplianceTwistRad: number;
  drivelineComplianceSpringNm: number;
}

export interface RacingHudFfbState {
  /** Normalized rack force in [-1, 1]. Positive = resisting left-turn input. */
  rackForce: number;
  /** KPI/SAI centering torque before assist shaping (Nm). */
  kpiTorqueNm: number;
  /** Aligning moment contribution from both front tires (Nm). */
  mzContributionNm: number;
  /** Fx scrub+caster coupling torque (Nm). */
  fxCouplingNm: number;
  /** Total raw torque before gain/clip (Nm). */
  totalRawNm: number;
  /** Power-steering assist scale this step (0..1). */
  assistScale: number;
}

export interface RacingHudAeroState {
  frontDownforceN: number;
  rearDownforceN: number;
  dragN: number;
  // M5 aero map telemetry — undefined when no aeroMap preset is authored
  /** True when an authored aero map preset is active (false for scalar-only presets). */
  hasAeroMap?: boolean;
  effectiveClAreaFront?: number;
  effectiveClAreaRear?: number;
  /** Centre-of-pressure fraction (0 = all front, 1 = all rear). */
  copFraction?: number;
  frontStalled?: boolean;
  rearStalled?: boolean;
  frontRideHeightM?: number;
  rearRideHeightM?: number;
  // M8 wake-field drag reduction
  /** Current wake drag reduction fraction (0 = no reduction). */
  wakeReduction?: number;
}

/** M4 — Track surface condition fields forwarded from the engine snapshot. */
export interface RacingHudTrackConditionState {
  /** Track surface temperature (°C); 28 when the preset omits it. */
  trackTempC: number;
  /** Rubber-line grip multiplier; 1.0 = no rubber laid down. */
  rubberLineGrip: number;
  /** True when authored elevation data is active (not flat-ground fallback). */
  terrainActive: boolean;
  /** Micro-bump amplitude (m); 0 when the preset omits it. */
  bumpAmplitudeM: number;
  /** Normalized wetness 0..1; 0 when the preset omits it. */
  wetness: number;
  /** Human-readable condition label; `dry` when omitted. */
  condition: string;
}

export interface RacingHudInputState {
  throttle: number;
  brake: number;
  steer: number;
  handbrake: number;
}

export interface RacingHudLapState {
  bestMs: number | null;
  lastMs: number | null;
  currentMs: number | null;
}

export interface RacingTraceSample {
  fl: number;
  fr: number;
  rl: number;
  rr: number;
}

export interface RacingGgPoint {
  latG: number;
  longG: number;
}

export interface RacingHudState {
  speedKmh: number;
  rpm: number;
  redlineRpm: number;
  gearLabel: string;
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
  fps: number;
  telemetryMode: RacingTelemetryMode;
  cameraMode: 'chase' | 'hood' | 'far' | 'map';
  trackId: string;
  vehicleId: string;
  vehicleLabel: string;
  trackLabel: string;
  paused: boolean;
  muted: boolean;
  showDebug: boolean;
  absEnabled: boolean;
  tcEnabled: boolean;
  escEnabled: boolean;
  absActive: boolean;
  tcActive: boolean;
  escActive: boolean;
  tcCutPct: number;
  input: RacingHudInputState;
  lap: RacingHudLapState;
  wheels: RacingHudWheelState[];
  drivetrain: RacingHudDrivetrainState;
  aero: RacingHudAeroState;
  traceSamples: RacingTraceSample[];
  ggTrail: RacingGgPoint[];
  ffb: RacingHudFfbState;
  // M4
  trackCondition: RacingHudTrackConditionState;
}

export class RacingHudModel {
  state = $state<RacingHudState>({
    speedKmh: 0,
    rpm: 1100,
    redlineRpm: 8400,
    gearLabel: 'N',
    driftState: 'IDLE',
    sideslipDeg: 0,
    yawRateRad: 0,
    rearLockPct: 0,
    rearSlipRatio: 0,
    frontSlipDeg: 0,
    rearSlipDeg: 0,
    frontLoadPct: 50,
    leftLoadPct: 50,
    ackermannDeltaDeg: 0,
    frontToeDeg: 0,
    rearToeDeg: 0,
    casterDeg: 0,
    accelLongG: 0,
    accelLatG: 0,
    fps: 0,
    telemetryMode: 'load',
    rollDeg: 0,
    pitchDeg: 0,
    cameraMode: 'chase',
    trackId: '',
    vehicleId: '',
    vehicleLabel: '',
    trackLabel: '',
    paused: false,
    muted: false,
    showDebug: false,
    absEnabled: true,
    tcEnabled: true,
    escEnabled: false,
    absActive: false,
    tcActive: false,
    escActive: false,
    tcCutPct: 0,
    input: { throttle: 0, brake: 0, steer: 0, handbrake: 0 },
    lap: { bestMs: null, lastMs: null, currentMs: null },
    wheels: [
      { index: 0, fz: 0, fx: 0, fy: 0, slipRatio: 0, slipAngle: 0, combinedSlip: 0, tireUtilization: 0, driveTorqueNm: 0, surface: null, tempC: 30, brakeTempC: 30, tireWear: 0, flatSpotSignal: 0, bumpStopPct: 0, airborne: false, brakeTorqueApplied: 0, absScale: 1, absActive: false, yawContribution: 0, tempInner: 30, tempMiddle: 30, tempOuter: 30, pressureKpa: 200, kappaPeak: 0, alphaPeakRad: 0, tireDeflection: 0, suspensionTravel: 0, damperVelocity: 0, rollCenterHeightM: DEFAULT_ROLL_CENTER_HEIGHT_M, jackingForceN: 0, toeDeg: 0, camberDeg: -1.5 },
      { index: 1, fz: 0, fx: 0, fy: 0, slipRatio: 0, slipAngle: 0, combinedSlip: 0, tireUtilization: 0, driveTorqueNm: 0, surface: null, tempC: 30, brakeTempC: 30, tireWear: 0, flatSpotSignal: 0, bumpStopPct: 0, airborne: false, brakeTorqueApplied: 0, absScale: 1, absActive: false, yawContribution: 0, tempInner: 30, tempMiddle: 30, tempOuter: 30, pressureKpa: 200, kappaPeak: 0, alphaPeakRad: 0, tireDeflection: 0, suspensionTravel: 0, damperVelocity: 0, rollCenterHeightM: DEFAULT_ROLL_CENTER_HEIGHT_M, jackingForceN: 0, toeDeg: 0, camberDeg: -1.5 },
      { index: 2, fz: 0, fx: 0, fy: 0, slipRatio: 0, slipAngle: 0, combinedSlip: 0, tireUtilization: 0, driveTorqueNm: 0, surface: null, tempC: 30, brakeTempC: 30, tireWear: 0, flatSpotSignal: 0, bumpStopPct: 0, airborne: false, brakeTorqueApplied: 0, absScale: 1, absActive: false, yawContribution: 0, tempInner: 30, tempMiddle: 30, tempOuter: 30, pressureKpa: 200, kappaPeak: 0, alphaPeakRad: 0, tireDeflection: 0, suspensionTravel: 0, damperVelocity: 0, rollCenterHeightM: DEFAULT_ROLL_CENTER_HEIGHT_M, jackingForceN: 0, toeDeg: 0, camberDeg: -1.5 },
      { index: 3, fz: 0, fx: 0, fy: 0, slipRatio: 0, slipAngle: 0, combinedSlip: 0, tireUtilization: 0, driveTorqueNm: 0, surface: null, tempC: 30, brakeTempC: 30, tireWear: 0, flatSpotSignal: 0, bumpStopPct: 0, airborne: false, brakeTorqueApplied: 0, absScale: 1, absActive: false, yawContribution: 0, tempInner: 30, tempMiddle: 30, tempOuter: 30, pressureKpa: 200, kappaPeak: 0, alphaPeakRad: 0, tireDeflection: 0, suspensionTravel: 0, damperVelocity: 0, rollCenterHeightM: DEFAULT_ROLL_CENTER_HEIGHT_M, jackingForceN: 0, toeDeg: 0, camberDeg: -1.5 },
    ],
    drivetrain: {
      engineOmega: 0,
      transmissionOmega: 0,
      clutchTorqueNm: 0,
      clutchMode: 'slipping',
      engineDriveTorqueNm: 0,
      engineDragTorqueNm: 0,
      boostBar: 0,
      turboSpoolRatio: 0,
      boostTorqueMultiplier: 1,
      isOverboost: false,
      shiftRefused: false,
      shiftRefusalReason: '',
      shiftInProgress: false,
      shiftRemainingS: 0,
      drivelineComplianceTwistRad: 0,
      drivelineComplianceSpringNm: 0,
    },
    aero: {
      frontDownforceN: 0,
      rearDownforceN: 0,
      dragN: 0,
    },
    traceSamples: [],
    ggTrail: [],
    ffb: {
      rackForce: 0,
      kpiTorqueNm: 0,
      mzContributionNm: 0,
      fxCouplingNm: 0,
      totalRawNm: 0,
      assistScale: 0,
    },
    trackCondition: {
      trackTempC: 28,
      rubberLineGrip: 1,
      terrainActive: false,
      bumpAmplitudeM: 0,
      wetness: 0,
      condition: 'dry',
    },
  });

  setSpeed(kmh: number): void { this.state.speedKmh = kmh; }
  setRpm(rpm: number): void { this.state.rpm = rpm; }
  setGear(label: string): void { this.state.gearLabel = label; }
  setDriftState(state: string): void { this.state.driftState = state; }
  setSideslip(deg: number): void { this.state.sideslipDeg = deg; }
  setYawRate(rad: number): void { this.state.yawRateRad = rad; }
  setRearLock(pct: number): void { this.state.rearLockPct = pct; }
  setOrientation(rollDeg: number, pitchDeg: number): void {
    this.state.rollDeg = rollDeg;
    this.state.pitchDeg = pitchDeg;
  }
  setBalance(frontPct: number, leftPct: number): void {
    this.state.frontLoadPct = frontPct;
    this.state.leftLoadPct = leftPct;
  }
  setHandlingMetrics(metrics: {
    rearSlipRatio: number;
    frontSlipDeg: number;
    rearSlipDeg: number;
    ackermannDeltaDeg: number;
    frontToeDeg: number;
    rearToeDeg: number;
    casterDeg: number;
    accelLongG: number;
    accelLatG: number;
  }): void {
    this.state.rearSlipRatio = metrics.rearSlipRatio;
    this.state.frontSlipDeg = metrics.frontSlipDeg;
    this.state.rearSlipDeg = metrics.rearSlipDeg;
    this.state.ackermannDeltaDeg = metrics.ackermannDeltaDeg;
    this.state.frontToeDeg = metrics.frontToeDeg;
    this.state.rearToeDeg = metrics.rearToeDeg;
    this.state.casterDeg = metrics.casterDeg;
    this.state.accelLongG = metrics.accelLongG;
    this.state.accelLatG = metrics.accelLatG;
  }
  setFps(fps: number): void { this.state.fps = fps; }
  setCameraMode(mode: 'chase' | 'hood' | 'far' | 'map'): void { this.state.cameraMode = mode; }
  setVehicle(id: string, label: string): void {
    this.state.vehicleId = id;
    this.state.vehicleLabel = label;
  }
  setTrack(id: string, label: string): void {
    this.state.trackId = id;
    this.state.trackLabel = label;
  }
  setPaused(paused: boolean): void { this.state.paused = paused; }
  setMuted(muted: boolean): void { this.state.muted = muted; }
  setShowDebug(show: boolean): void { this.state.showDebug = show; }
  setAidState(aids: {
    absEnabled: boolean;
    tcEnabled: boolean;
    escEnabled: boolean;
    absActive: boolean;
    tcActive: boolean;
    escActive: boolean;
    tcCutPct: number;
  }): void {
    this.state.absEnabled = aids.absEnabled;
    this.state.tcEnabled = aids.tcEnabled;
    this.state.escEnabled = aids.escEnabled;
    this.state.absActive = aids.absActive;
    this.state.tcActive = aids.tcActive;
    this.state.escActive = aids.escActive;
    this.state.tcCutPct = aids.tcCutPct;
  }
  setInput(input: RacingHudInputState): void { this.state.input = { ...input }; }
  setLap(lap: RacingHudLapState): void { this.state.lap = { ...lap }; }
  setWheels(wheels: ReadonlyArray<RacingHudWheelState>): void {
    for (let i = 0; i < this.state.wheels.length; i++) {
      const incoming = wheels[i];
      if (!incoming) continue;
      this.state.wheels[i] = { ...incoming };
    }
  }
  setDrivetrain(state: RacingHudDrivetrainState): void {
    this.state.drivetrain = { ...state };
  }
  setFfb(state: RacingHudFfbState): void {
    this.state.ffb = { ...state };
  }
  setAero(state: RacingHudAeroState): void {
    this.state.aero = { ...state };
  }
  setTrackCondition(state: RacingHudTrackConditionState): void {
    this.state.trackCondition = { ...state };
  }
  pushTelemetry(sample: RacingTraceSample, gg: RacingGgPoint): void {
    this.state.traceSamples = [...this.state.traceSamples.slice(-119), sample];
    this.state.ggTrail = [...this.state.ggTrail.slice(-79), gg];
  }
  toggleTelemetryMode(): void {
    // load → slip → utilization → load
    const order: RacingTelemetryMode[] = ['load', 'slip', 'utilization'];
    const idx = order.indexOf(this.state.telemetryMode);
    this.state.telemetryMode = order[(idx + 1) % order.length] ?? 'load';
  }
}

export function createRacingHudModel(): RacingHudModel {
  return new RacingHudModel();
}
