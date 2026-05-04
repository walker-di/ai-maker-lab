import type { SurfaceId } from '../types.js';

export type RacingTelemetryMode = 'load' | 'slip';

export interface RacingHudWheelState {
  index: number;
  fz: number;
  slipRatio: number;
  slipAngle: number;
  surface: SurfaceId | null;
  tempC: number;
  brakeTempC: number;
  bumpStopPct: number;
  airborne: boolean;
  brakeTorqueApplied: number;
  absScale: number;
  absActive: boolean;
  yawContribution: number;
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
  traceSamples: RacingTraceSample[];
  ggTrail: RacingGgPoint[];
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
      { index: 0, fz: 0, slipRatio: 0, slipAngle: 0, surface: null, tempC: 30, brakeTempC: 30, bumpStopPct: 0, airborne: false, brakeTorqueApplied: 0, absScale: 1, absActive: false, yawContribution: 0 },
      { index: 1, fz: 0, slipRatio: 0, slipAngle: 0, surface: null, tempC: 30, brakeTempC: 30, bumpStopPct: 0, airborne: false, brakeTorqueApplied: 0, absScale: 1, absActive: false, yawContribution: 0 },
      { index: 2, fz: 0, slipRatio: 0, slipAngle: 0, surface: null, tempC: 30, brakeTempC: 30, bumpStopPct: 0, airborne: false, brakeTorqueApplied: 0, absScale: 1, absActive: false, yawContribution: 0 },
      { index: 3, fz: 0, slipRatio: 0, slipAngle: 0, surface: null, tempC: 30, brakeTempC: 30, bumpStopPct: 0, airborne: false, brakeTorqueApplied: 0, absScale: 1, absActive: false, yawContribution: 0 },
    ],
    traceSamples: [],
    ggTrail: [],
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
  pushTelemetry(sample: RacingTraceSample, gg: RacingGgPoint): void {
    this.state.traceSamples = [...this.state.traceSamples.slice(-119), sample];
    this.state.ggTrail = [...this.state.ggTrail.slice(-79), gg];
  }
  toggleTelemetryMode(): void {
    this.state.telemetryMode = this.state.telemetryMode === 'load' ? 'slip' : 'load';
  }
}

export function createRacingHudModel(): RacingHudModel {
  return new RacingHudModel();
}
