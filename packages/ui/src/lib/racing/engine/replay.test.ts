import { afterEach, describe, expect, it } from 'bun:test';
import { RacingEngine } from './RacingEngine.js';
import {
  ReplayPlayer,
  ReplayRecorder,
  sampleTrace,
  traceDuration,
  type ReplayFrame,
  type ReplayTrace,
} from './replay.js';
import type { TrackPreset, VehiclePreset } from '../types.js';

function makeVehicle(): VehiclePreset {
  return {
    id: 'test-rwd',
    label: 'Test RWD',
    driveLabel: 'RWD',
    layoutLabel: 'Front-mid',
    color: 0xff0000,
    wheelbase: 2.6,
    trackWidth: 1.6,
    frontMassPct: 0.52,
    finalDrive: 3.8,
    gears: [
      { n: 'R', ratio: -3.1 },
      { n: 'N', ratio: 0 },
      { n: '1', ratio: 3.2 },
      { n: '2', ratio: 2.1 },
    ],
    steerMaxDeg: 28,
    axleDrive: { front: 0, rear: 1 },
    diffType: 'clutchLSD',
  };
}

function makeTrack(): TrackPreset {
  return {
    id: 'test-loop',
    label: 'Test Loop',
    groundColor: 0x335533,
    halfWidth: 7,
    curbWidth: 0.8,
    rubberWidth: 2,
    marblesWidth: 1,
    samples: 64,
    ctrl: [
      [0, 0],
      [40, 0],
      [40, 40],
      [0, 40],
    ],
  };
}

const engines: RacingEngine[] = [];

function createEngine(): RacingEngine {
  const engine = new RacingEngine({ vehicle: makeVehicle(), track: makeTrack() });
  engine.resetCar();
  engines.push(engine);
  return engine;
}

afterEach(() => {
  while (engines.length) engines.pop()?.dispose();
});

const STEP = 1 / 240;

function frame(t: number, x: number, overrides: Partial<ReplayFrame> = {}): ReplayFrame {
  return {
    t,
    pos: { x, y: 0, z: 0 },
    quat: { x: 0, y: 0, z: 0, w: 1 },
    wheels: [{ index: 0, position: { x: 0, y: 0, z: 0 }, spinAngle: x, steerAngle: 0 }],
    speedKmh: x * 10,
    rpm: 1000,
    gearLabel: x < 5 ? '1' : '2',
    throttle: 1,
    brake: 0,
    steer: 0,
    handbrake: 0,
    ...overrides,
  };
}

function trace(frames: ReplayFrame[]): ReplayTrace {
  return { kind: 'lap', trackId: 't', vehicleId: 'v', lapMs: traceDuration({ kind: 'lap', trackId: '', vehicleId: '', frames }) * 1000, frames };
}

/** Teleport the car (stationary) through every ordered sector checkpoint. */
function visitCheckpoints(engine: RacingEngine): void {
  const y = engine.worldPos.y;
  for (const p of engine.lapCheckpointPoints()) {
    engine.worldPos.set(p.x, y, p.z);
    engine.velocityWS.set(0, 0, 0);
    engine.step(STEP);
  }
}

/**
 * Complete a valid lap: visit every sector checkpoint, then cross the line.
 * The first call (no lap running) just starts the lap.
 */
function completeLap(engine: RacingEngine): void {
  visitCheckpoints(engine);
  crossLine(engine);
}

/** Teleport the car forward across the start/finish line (centreline starts at x=0 heading +X). */
function crossLine(engine: RacingEngine): void {
  const y = engine.worldPos.y;
  // Stationary behind the line: updates the side without counting a crossing.
  engine.worldPos.set(-0.5, y, 0);
  engine.velocityWS.set(0, 0, 0);
  engine.step(STEP);
  engine.worldPos.set(0.5, y, 0);
  engine.velocityWS.set(12, 0, 0);
  engine.step(STEP);
}

describe('ReplayRecorder', () => {
  it('samples tick events at ~60 Hz into the recent buffer', () => {
    const engine = createEngine();
    const recorder = new ReplayRecorder();
    recorder.attach(engine, { trackId: 'test-loop', vehicleId: 'test-rwd' });

    engine.input.state.throttle = 1;
    for (let i = 0; i < 240; i++) engine.step(STEP);

    const recent = recorder.recentTrace();
    expect(recent).not.toBeNull();
    expect(recent!.frames.length).toBeGreaterThanOrEqual(59);
    expect(recent!.frames.length).toBeLessThanOrEqual(61);
    expect(recent!.frames[0].t).toBe(0);
    expect(traceDuration(recent)).toBeCloseTo(1 - 1 / 60, 2);
    // The last sample is at most one 60 Hz period behind the live car.
    expect(recent!.frames.at(-1)!.pos.x).toBeCloseTo(engine.worldPos.x, 2);
    expect(recent!.frames[0].wheels).toHaveLength(4);
  });

  it('caps the recent buffer to the configured window', () => {
    const engine = createEngine();
    const recorder = new ReplayRecorder({ recentSeconds: 2 });
    recorder.attach(engine, { trackId: 'test-loop', vehicleId: 'test-rwd' });
    for (let i = 0; i < 240 * 5; i++) engine.step(STEP);
    expect(traceDuration(recorder.recentTrace())).toBeLessThanOrEqual(2 + 1e-6);
    expect(traceDuration(recorder.recentTrace())).toBeGreaterThan(1.9);
  });

  it('records a lap trace between line crossings and keeps the fastest as best', () => {
    const engine = createEngine();
    const recorder = new ReplayRecorder();
    recorder.attach(engine, { trackId: 'test-loop', vehicleId: 'test-rwd' });
    const finished: number[] = [];
    engine.events.on('lapFinished', (e) => finished.push(e.lapMs));

    expect(recorder.lapElapsed()).toBeNull();
    completeLap(engine);
    expect(recorder.lapElapsed()).toBe(0);
    for (let i = 0; i < 240; i++) engine.step(STEP);
    expect(recorder.lapElapsed()).toBeCloseTo(1, 6);
    completeLap(engine);

    expect(finished).toHaveLength(1);
    const first = recorder.lastLap!;
    expect(first.kind).toBe('lap');
    expect(first.lapMs).toBe(finished[0]);
    expect(traceDuration(first) * 1000).toBeCloseTo(finished[0], 6);
    expect(recorder.bestLap).toBe(first);

    // A slower lap updates `lastLap` but not `bestLap`.
    for (let i = 0; i < 480; i++) engine.step(STEP);
    completeLap(engine);
    expect(recorder.lastLap).not.toBe(first);
    expect(recorder.bestLap).toBe(first);

    // A faster lap replaces it.
    for (let i = 0; i < 60; i++) engine.step(STEP);
    completeLap(engine);
    expect(recorder.bestLap).toBe(recorder.lastLap);
    expect(recorder.bestLap!.lapMs).toBeLessThan(first.lapMs!);
  });

  it('ignores a line hop: crossing, reversing and recrossing does not create a lap', () => {
    const engine = createEngine();
    const recorder = new ReplayRecorder();
    recorder.attach(engine, { trackId: 'test-loop', vehicleId: 'test-rwd' });
    const finished: number[] = [];
    const started: number[] = [];
    engine.events.on('lapFinished', (e) => finished.push(e.lapMs));
    engine.events.on('lapStarted', (e) => started.push(e.startedAt));

    const y = engine.worldPos.y;
    crossLine(engine);
    expect(started).toHaveLength(1);
    for (let i = 0; i < 60; i++) engine.step(STEP);
    // Reverse back behind the line (no event: not moving forward)...
    engine.worldPos.set(0.5, y, 0);
    engine.velocityWS.set(-6, 0, 0);
    engine.step(STEP);
    engine.worldPos.set(-0.5, y, 0);
    engine.velocityWS.set(-6, 0, 0);
    engine.step(STEP);
    // ...then drive forward over it again.
    engine.worldPos.set(0.5, y, 0);
    engine.velocityWS.set(12, 0, 0);
    engine.step(STEP);

    expect(finished).toHaveLength(0);
    expect(engine.snapshot().lap.lastMs).toBeNull();
    expect(engine.snapshot().lap.bestMs).toBeNull();
    expect(recorder.lastLap).toBeNull();
    expect(recorder.bestLap).toBeNull();
    // The recrossing restarts the lap instead of timing one.
    expect(started).toHaveLength(2);
    expect(recorder.lapElapsed()).toBe(0);

    // Skipping a checkpoint (out of order) still does not count.
    const [, second, third] = engine.lapCheckpointPoints();
    for (const p of [second, third]) {
      engine.worldPos.set(p.x, y, p.z);
      engine.velocityWS.set(0, 0, 0);
      engine.step(STEP);
    }
    crossLine(engine);
    expect(finished).toHaveLength(0);
  });

  it('discards the lap in progress and clears everything on reset', () => {
    const engine = createEngine();
    const recorder = new ReplayRecorder();
    recorder.attach(engine, { trackId: 'test-loop', vehicleId: 'test-rwd' });
    completeLap(engine);
    for (let i = 0; i < 60; i++) engine.step(STEP);
    completeLap(engine);
    expect(recorder.lastLap).not.toBeNull();

    recorder.discardCurrentLap();
    expect(recorder.lapElapsed()).toBeNull();
    expect(recorder.lastLap).not.toBeNull();

    recorder.reset();
    expect(recorder.lastLap).toBeNull();
    expect(recorder.bestLap).toBeNull();
    expect(recorder.recentTrace()).toBeNull();
  });

  it('caps the lap in progress and drops it past maxLapSeconds', () => {
    const engine = createEngine();
    const recorder = new ReplayRecorder({ maxLapSeconds: 1 });
    recorder.attach(engine, { trackId: 'test-loop', vehicleId: 'test-rwd' });
    const finished: number[] = [];
    engine.events.on('lapFinished', (e) => finished.push(e.lapMs));
    completeLap(engine);
    for (let i = 0; i < 120; i++) engine.step(STEP);
    expect(recorder.currentLapFrameCount).toBeGreaterThan(20);
    // Run past the cap: the buffer is dropped and stops growing.
    for (let i = 0; i < 240 * 2; i++) engine.step(STEP);
    expect(recorder.currentLapFrameCount).toBe(0);
    expect(recorder.lapElapsed()).toBeNull();
    // The engine still times the lap, but the recorder keeps no trace for it.
    completeLap(engine);
    expect(finished).toHaveLength(1);
    expect(recorder.lastLap).toBeNull();
    // The crossing starts a fresh, recordable lap.
    expect(recorder.lapElapsed()).toBe(0);
  });

  it('reports recent availability in O(1) without building a trace', () => {
    const engine = createEngine();
    const recorder = new ReplayRecorder();
    recorder.attach(engine, { trackId: 'test-loop', vehicleId: 'test-rwd' });
    expect(recorder.hasRecent).toBe(false);
    engine.step(STEP);
    expect(recorder.hasRecent).toBe(recorder.recentTrace() != null);
    for (let i = 0; i < 20; i++) engine.step(STEP);
    expect(recorder.hasRecent).toBe(true);
    recorder.reset();
    expect(recorder.hasRecent).toBe(false);
  });

  it('stops recording after detach', () => {
    const engine = createEngine();
    const recorder = new ReplayRecorder();
    recorder.attach(engine, { trackId: 'test-loop', vehicleId: 'test-rwd' });
    for (let i = 0; i < 40; i++) engine.step(STEP);
    const before = recorder.recentTrace()!.frames.length;
    recorder.detach();
    for (let i = 0; i < 40; i++) engine.step(STEP);
    expect(recorder.recentTrace()!.frames.length).toBe(before);
  });
});

describe('sampleTrace', () => {
  const t = trace([frame(0, 0), frame(1, 10), frame(2, 20)]);

  it('clamps outside the trace and handles empty traces', () => {
    expect(sampleTrace(t, -1)!.pos.x).toBe(0);
    expect(sampleTrace(t, 5)!.pos.x).toBe(20);
    expect(sampleTrace({ ...t, frames: [] }, 0)).toBeNull();
    expect(sampleTrace(null, 0)).toBeNull();
  });

  it('lerps scalar channels and picks the nearest discrete gear', () => {
    const s = sampleTrace(t, 0.25)!;
    expect(s.pos.x).toBeCloseTo(2.5, 6);
    expect(s.speedKmh).toBeCloseTo(25, 6);
    expect(s.wheels[0].spinAngle).toBeCloseTo(2.5, 6);
    expect(s.gearLabel).toBe('1');
    expect(sampleTrace(t, 0.75)!.gearLabel).toBe('2');
  });

  it('slerps orientation along the shortest path', () => {
    const half = Math.SQRT1_2;
    const rot = trace([
      frame(0, 0),
      // 90° about Y, stored with a flipped sign to exercise the shortest-path branch.
      frame(1, 0, { quat: { x: 0, y: -half, z: 0, w: -half } }),
    ]);
    const q = sampleTrace(rot, 0.5)!.quat;
    const angle = 2 * Math.acos(Math.abs(q.w));
    expect(angle).toBeCloseTo(Math.PI / 4, 5);
    expect(Math.hypot(q.x, q.y, q.z, q.w)).toBeCloseTo(1, 6);
  });
});

describe('ReplayPlayer', () => {
  const t = trace([frame(0, 0), frame(1, 10), frame(2, 20)]);

  it('advances by dt × speed and loops by default', () => {
    const player = new ReplayPlayer(t);
    player.advance(0.5);
    expect(player.time).toBeCloseTo(0.5, 6);
    player.setSpeed(2);
    expect(player.advance(0.5)!.pos.x).toBeCloseTo(15, 6);
    // 1.5 + 0.75 × 2 = 3.0 → wraps to 1.0 on a 2 s trace.
    player.advance(0.75);
    expect(player.time).toBeCloseTo(1, 6);
  });

  it('stops at the end without loop and restarts on play', () => {
    const player = new ReplayPlayer(t);
    player.loop = false;
    player.advance(3);
    expect(player.time).toBe(2);
    expect(player.playing).toBe(false);
    player.togglePlay();
    expect(player.playing).toBe(true);
    expect(player.time).toBe(0);
  });

  it('seeks within bounds and holds position while paused', () => {
    const player = new ReplayPlayer(t);
    player.seek(10);
    expect(player.time).toBe(2);
    player.seek(-1);
    expect(player.time).toBe(0);
    player.seek(1);
    player.togglePlay();
    player.advance(1);
    expect(player.time).toBe(1);
  });
});
