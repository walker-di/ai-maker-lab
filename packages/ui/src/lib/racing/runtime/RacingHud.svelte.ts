import type { SurfaceId } from '../types.js';

/**
 * Presentation model for the Racing HUD. Updated by the page model from
 * engine snapshot data once per render frame. The HUD components read
 * `model.state.*` directly via Svelte 5 reactivity.
 */
export interface RacingHudWheelState {
  index: number;
  fz: number;
  slipRatio: number;
  slipAngle: number;
  surface: SurfaceId | null;
  tempC: number;
  brakeTempC: number;
  airborne: boolean;
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

export interface RacingHudState {
  speedKmh: number;
  rpm: number;
  redlineRpm: number;
  gearLabel: string;
  driftState: string;
  sideslipDeg: number;
  yawRateRad: number;
  rearLockPct: number;
  frontLoadPct: number;
  leftLoadPct: number;
  cameraMode: 'chase' | 'hood' | 'far' | 'map';
  trackId: string;
  vehicleId: string;
  vehicleLabel: string;
  trackLabel: string;
  paused: boolean;
  muted: boolean;
  showDebug: boolean;
  input: RacingHudInputState;
  lap: RacingHudLapState;
  wheels: RacingHudWheelState[];
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
    frontLoadPct: 50,
    leftLoadPct: 50,
    cameraMode: 'chase',
    trackId: '',
    vehicleId: '',
    vehicleLabel: '',
    trackLabel: '',
    paused: false,
    muted: false,
    showDebug: false,
    input: { throttle: 0, brake: 0, steer: 0, handbrake: 0 },
    lap: { bestMs: null, lastMs: null, currentMs: null },
    wheels: [
      { index: 0, fz: 0, slipRatio: 0, slipAngle: 0, surface: null, tempC: 30, brakeTempC: 30, airborne: false },
      { index: 1, fz: 0, slipRatio: 0, slipAngle: 0, surface: null, tempC: 30, brakeTempC: 30, airborne: false },
      { index: 2, fz: 0, slipRatio: 0, slipAngle: 0, surface: null, tempC: 30, brakeTempC: 30, airborne: false },
      { index: 3, fz: 0, slipRatio: 0, slipAngle: 0, surface: null, tempC: 30, brakeTempC: 30, airborne: false },
    ],
  });

  setSpeed(kmh: number): void { this.state.speedKmh = kmh; }
  setRpm(rpm: number): void { this.state.rpm = rpm; }
  setGear(label: string): void { this.state.gearLabel = label; }
  setDriftState(state: string): void { this.state.driftState = state; }
  setSideslip(deg: number): void { this.state.sideslipDeg = deg; }
  setYawRate(rad: number): void { this.state.yawRateRad = rad; }
  setRearLock(pct: number): void { this.state.rearLockPct = pct; }
  setBalance(frontPct: number, leftPct: number): void {
    this.state.frontLoadPct = frontPct;
    this.state.leftLoadPct = leftPct;
  }
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
  setInput(input: RacingHudInputState): void { this.state.input = { ...input }; }
  setLap(lap: RacingHudLapState): void { this.state.lap = { ...lap }; }
  setWheels(wheels: ReadonlyArray<RacingHudWheelState>): void {
    for (let i = 0; i < this.state.wheels.length; i++) {
      const incoming = wheels[i];
      if (!incoming) continue;
      this.state.wheels[i] = { ...incoming };
    }
  }
}

export function createRacingHudModel(): RacingHudModel {
  return new RacingHudModel();
}
