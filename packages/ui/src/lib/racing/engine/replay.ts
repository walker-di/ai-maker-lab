/**
 * Lap replay + ghost support. Records downsampled chassis/wheel poses from
 * engine `tick` events (pose playback, not input re-simulation — the Jolt
 * compliance path and out-of-step shifts make input replays non-reproducible).
 *
 * Everything here is plain data: traces hold no Three.js objects so they can
 * be cloned, serialized, or persisted later without touching the engine.
 */

import { Quaternion, Vector3 } from 'three';
import type { CameraMode, CameraRig } from './cameras.js';
import type { EngineEmitter } from './events.js';
import type { WheelPose } from './three-renderer.js';

export interface Vec3Like {
  x: number;
  y: number;
  z: number;
}

export interface QuatLike {
  x: number;
  y: number;
  z: number;
  w: number;
}

export interface ReplayFrame {
  /** Seconds from the start of the trace. */
  t: number;
  pos: Vec3Like;
  quat: QuatLike;
  wheels: WheelPose[];
  speedKmh: number;
  rpm: number;
  gearLabel: string;
  throttle: number;
  brake: number;
  steer: number;
  handbrake: number;
}

export interface ReplayTrace {
  kind: 'lap' | 'recent';
  trackId: string;
  vehicleId: string;
  /** Lap time for `kind: 'lap'` traces. */
  lapMs?: number;
  frames: ReplayFrame[];
}

/** Structural subset of `RacingEngine` the recorder reads from. */
export interface ReplayRecordable {
  readonly events: EngineEmitter;
  readonly worldPos: Vec3Like;
  readonly worldQuat: QuatLike;
  readonly input: {
    readonly state: { throttle: number; brake: number; steerSmoothed: number; handbrake: number };
  };
  wheelPoses(): WheelPose[];
  snapshot(): { speedKmh: number; rpm: number; gearLabel: string };
}

export interface ReplayRecorderOptions {
  /** Target sample rate (Hz). Default 60. */
  sampleHz?: number;
  /** Length of the rolling "recent" buffer (s). Default 60. */
  recentSeconds?: number;
  /**
   * Longest lap the recorder keeps frames for (s). Past it the lap in progress
   * is dropped and nothing more is buffered until the next line crossing, so
   * a long session that never finishes a lap cannot grow memory without
   * bound. Default 600 (10 min).
   */
  maxLapSeconds?: number;
}

export function traceDuration(trace: ReplayTrace | null | undefined): number {
  if (!trace || trace.frames.length === 0) return 0;
  return trace.frames[trace.frames.length - 1].t;
}

export class ReplayRecorder {
  readonly sampleHz: number;
  readonly recentSeconds: number;
  readonly maxLapSeconds: number;

  lastLap: ReplayTrace | null = null;
  bestLap: ReplayTrace | null = null;

  private engine: ReplayRecordable | null = null;
  private unsubs: Array<() => void> = [];
  private trackId = '';
  private vehicleId = '';
  private simTime = 0;
  private lastSampleTime = -Infinity;
  /** Sim time when the current lap started, or null before the first crossing. */
  private lapStartTime: number | null = null;
  /** Absolute-sim-time frames for the lap in progress. */
  private lapFrames: ReplayFrame[] = [];
  /** Absolute-sim-time frames for the rolling recent buffer. */
  private recentFrames: ReplayFrame[] = [];
  private recentHead = 0;
  private pendingLap: { kind: 'started' } | { kind: 'finished'; lapMs: number } | null = null;

  constructor(options: ReplayRecorderOptions = {}) {
    this.sampleHz = options.sampleHz ?? 60;
    this.recentSeconds = options.recentSeconds ?? 60;
    this.maxLapSeconds = options.maxLapSeconds ?? 600;
  }

  attach(engine: ReplayRecordable, ids: { trackId: string; vehicleId: string }): void {
    this.detach();
    this.engine = engine;
    this.trackId = ids.trackId;
    this.vehicleId = ids.vehicleId;
    this.unsubs.push(
      engine.events.on('tick', (e) => this.onTick(e.simTime)),
      engine.events.on('lapStarted', () => {
        this.pendingLap = { kind: 'started' };
      }),
      engine.events.on('lapFinished', (e) => {
        this.pendingLap = { kind: 'finished', lapMs: e.lapMs };
      }),
    );
  }

  detach(): void {
    for (const unsub of this.unsubs) unsub();
    this.unsubs = [];
    this.engine = null;
  }

  /** Clear all recorded data, including stored laps. */
  reset(): void {
    this.lastLap = null;
    this.bestLap = null;
    this.discardCurrentLap();
    this.recentFrames = [];
    this.recentHead = 0;
    this.lastSampleTime = -Infinity;
  }

  /** Drop the lap in progress (e.g. after a car reset clears the lap timer). */
  discardCurrentLap(): void {
    this.lapStartTime = null;
    this.pendingLap = null;
    this.lapFrames = [];
  }

  /** Sim seconds since the current lap started, or null if no lap is running. */
  lapElapsed(): number | null {
    return this.lapStartTime == null ? null : this.simTime - this.lapStartTime;
  }

  /** O(1): whether `recentTrace()` would return a trace. Safe to call per frame. */
  get hasRecent(): boolean {
    return this.recentFrames.length - this.recentHead >= 2;
  }

  /** Frames buffered for the lap in progress (diagnostics / tests). */
  get currentLapFrameCount(): number {
    return this.lapFrames.length;
  }

  recentTrace(): ReplayTrace | null {
    const frames = this.recentFrames.slice(this.recentHead);
    if (frames.length < 2) return null;
    return this.makeTrace('recent', frames);
  }

  private onTick(simTime: number): void {
    this.simTime = simTime;
    const pending = this.pendingLap;
    this.pendingLap = null;
    // Lap events fire just before `tick` within the same step, so the line
    // crossing is resolved here with the step's own sim time (matching the
    // engine's `lap.t0`). The crossing frame is always sampled.
    const due = simTime - this.lastSampleTime >= 1 / this.sampleHz - 1e-6;
    if (!due && !pending) return;
    this.lastSampleTime = simTime;
    const frame = this.capture(simTime);
    if (!frame) return;

    if (pending?.kind === 'finished' && this.lapStartTime != null) {
      this.lapFrames.push(frame);
      if (this.lapFrames.length >= 2) {
        const trace = this.makeTrace('lap', this.lapFrames, this.lapStartTime);
        trace.lapMs = pending.lapMs;
        this.lastLap = trace;
        if (!this.bestLap || (this.bestLap.lapMs ?? Infinity) > pending.lapMs) this.bestLap = trace;
      }
    }
    if (pending) {
      // A finish line crossing is also the next lap's start.
      this.lapStartTime = simTime;
      this.lapFrames = [frame];
    } else if (this.lapStartTime != null) {
      if (simTime - this.lapStartTime > this.maxLapSeconds) {
        // Over the cap: stop buffering. The lap can no longer produce a
        // trace; the next line crossing starts a fresh one.
        this.lapStartTime = null;
        this.lapFrames = [];
      } else {
        this.lapFrames.push(frame);
      }
    }

    this.recentFrames.push(frame);
    const cutoff = simTime - this.recentSeconds;
    while (this.recentHead < this.recentFrames.length && this.recentFrames[this.recentHead].t < cutoff) {
      this.recentHead += 1;
    }
    // Compact occasionally instead of shifting on every sample.
    if (this.recentHead > 1024) {
      this.recentFrames = this.recentFrames.slice(this.recentHead);
      this.recentHead = 0;
    }
  }

  private capture(simTime: number): ReplayFrame | null {
    const engine = this.engine;
    if (!engine) return null;
    const snap = engine.snapshot();
    const input = engine.input.state;
    return {
      t: simTime,
      pos: { x: engine.worldPos.x, y: engine.worldPos.y, z: engine.worldPos.z },
      quat: { x: engine.worldQuat.x, y: engine.worldQuat.y, z: engine.worldQuat.z, w: engine.worldQuat.w },
      wheels: engine.wheelPoses().map((w) => ({
        index: w.index,
        position: { x: w.position.x, y: w.position.y, z: w.position.z },
        spinAngle: w.spinAngle,
        steerAngle: w.steerAngle,
      })),
      speedKmh: snap.speedKmh,
      rpm: snap.rpm,
      gearLabel: snap.gearLabel,
      throttle: input.throttle,
      brake: input.brake,
      steer: input.steerSmoothed,
      handbrake: input.handbrake,
    };
  }

  private makeTrace(kind: ReplayTrace['kind'], frames: ReplayFrame[], origin?: number): ReplayTrace {
    const t0 = origin ?? frames[0]?.t ?? 0;
    return {
      kind,
      trackId: this.trackId,
      vehicleId: this.vehicleId,
      frames: frames.map((f) => ({ ...f, t: Math.max(0, f.t - t0) })),
    };
  }
}

function lerp(a: number, b: number, k: number): number {
  return a + (b - a) * k;
}

function slerpQuat(a: QuatLike, b: QuatLike, k: number): QuatLike {
  let bx = b.x;
  let by = b.y;
  let bz = b.z;
  let bw = b.w;
  let cos = a.x * bx + a.y * by + a.z * bz + a.w * bw;
  if (cos < 0) {
    cos = -cos;
    bx = -bx;
    by = -by;
    bz = -bz;
    bw = -bw;
  }
  let ka: number;
  let kb: number;
  if (cos > 0.9995) {
    ka = 1 - k;
    kb = k;
  } else {
    const theta = Math.acos(Math.min(1, cos));
    const sin = Math.sin(theta);
    ka = Math.sin((1 - k) * theta) / sin;
    kb = Math.sin(k * theta) / sin;
  }
  const x = a.x * ka + bx * kb;
  const y = a.y * ka + by * kb;
  const z = a.z * ka + bz * kb;
  const w = a.w * ka + bw * kb;
  const len = Math.hypot(x, y, z, w) || 1;
  return { x: x / len, y: y / len, z: z / len, w: w / len };
}

/**
 * Interpolated frame at time `t` (clamped to the trace). Returns null for an
 * empty trace.
 */
export function sampleTrace(trace: ReplayTrace | null | undefined, t: number): ReplayFrame | null {
  const frames = trace?.frames;
  if (!frames || frames.length === 0) return null;
  if (t <= frames[0].t) return frames[0];
  const last = frames[frames.length - 1];
  if (t >= last.t) return last;

  let lo = 0;
  let hi = frames.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (frames[mid].t <= t) lo = mid;
    else hi = mid;
  }
  const a = frames[lo];
  const b = frames[hi];
  const span = b.t - a.t;
  const k = span > 0 ? (t - a.t) / span : 0;
  const near = k < 0.5 ? a : b;
  return {
    t,
    pos: { x: lerp(a.pos.x, b.pos.x, k), y: lerp(a.pos.y, b.pos.y, k), z: lerp(a.pos.z, b.pos.z, k) },
    quat: slerpQuat(a.quat, b.quat, k),
    wheels: a.wheels.map((wa, i) => {
      const wb = b.wheels[i] ?? wa;
      return {
        index: wa.index,
        position: {
          x: lerp(wa.position.x, wb.position.x, k),
          y: lerp(wa.position.y, wb.position.y, k),
          z: lerp(wa.position.z, wb.position.z, k),
        },
        spinAngle: lerp(wa.spinAngle, wb.spinAngle, k),
        steerAngle: lerp(wa.steerAngle, wb.steerAngle, k),
      };
    }),
    speedKmh: lerp(a.speedKmh, b.speedKmh, k),
    rpm: lerp(a.rpm, b.rpm, k),
    gearLabel: near.gearLabel,
    throttle: lerp(a.throttle, b.throttle, k),
    brake: lerp(a.brake, b.brake, k),
    steer: lerp(a.steer, b.steer, k),
    handbrake: lerp(a.handbrake, b.handbrake, k),
  };
}

export const REPLAY_SPEEDS = [0.25, 0.5, 1, 2] as const;
export type ReplaySpeed = (typeof REPLAY_SPEEDS)[number];

/** Playback cursor over a single trace. */
export class ReplayPlayer {
  time = 0;
  speed: ReplaySpeed = 1;
  playing = true;
  loop = true;

  constructor(readonly trace: ReplayTrace) {}

  get duration(): number {
    return traceDuration(this.trace);
  }

  advance(dt: number): ReplayFrame | null {
    if (this.playing) {
      const next = this.time + dt * this.speed;
      const duration = this.duration;
      if (next >= duration) {
        if (this.loop && duration > 0) this.time = next % duration;
        else {
          this.time = duration;
          this.playing = false;
        }
      } else {
        this.time = next;
      }
    }
    return this.current();
  }

  current(): ReplayFrame | null {
    return sampleTrace(this.trace, this.time);
  }

  seek(t: number): void {
    this.time = Math.min(this.duration, Math.max(0, t));
  }

  togglePlay(): void {
    if (!this.playing && this.time >= this.duration) this.time = 0;
    this.playing = !this.playing;
  }

  setSpeed(speed: ReplaySpeed): void {
    this.speed = speed;
  }
}

/** Drive a (replay-owned) camera rig from a recorded frame. */
export function stepReplayCamera(rig: CameraRig, frame: ReplayFrame, dt: number, mode: CameraMode): void {
  const quat = new Quaternion(frame.quat.x, frame.quat.y, frame.quat.z, frame.quat.w);
  rig.step({
    carPosition: new Vector3(frame.pos.x, frame.pos.y, frame.pos.z),
    // Chassis forward convention is -Z.
    carForward: new Vector3(0, 0, -1).applyQuaternion(quat),
    dt,
    mode,
  });
}
