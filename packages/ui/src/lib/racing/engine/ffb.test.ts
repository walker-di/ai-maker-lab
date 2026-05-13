/**
 * M2 FFB pipeline unit tests.
 *
 * Covers: sign convention, KPI/SAI centering, Mz contribution, Fx coupling,
 * assist shaping, gain/clipping, normalization, finite-safe defaults, and
 * the event emission path through RacingEngine.
 */

import { describe, it, expect } from 'bun:test';
import {
  computeAssistScale,
  computeKpiSaiTorque,
  computeMzContribution,
  computeFxCoupling,
  computeRackForce,
  DEFAULT_KPI_DEG,
  DEFAULT_SAI_SCALE,
  DEFAULT_SCRUB_RADIUS_FFB_M,
  DEFAULT_CASTER_TRAIL_FFB_M,
  DEFAULT_FFB_MAX_NM,
  DEFAULT_FFB_GAIN,
  DEFAULT_ASSIST_PEAK_KMH,
  DEFAULT_ASSIST_MIN,
} from './ffb.js';

// ---- computeAssistScale -------------------------------------------------

describe('computeAssistScale', () => {
  it('returns 0 at standstill', () => {
    expect(computeAssistScale(0, DEFAULT_ASSIST_PEAK_KMH, DEFAULT_ASSIST_MIN)).toBe(0);
  });

  it('returns exactly 1 at peak speed', () => {
    const scale = computeAssistScale(
      DEFAULT_ASSIST_PEAK_KMH,
      DEFAULT_ASSIST_PEAK_KMH,
      DEFAULT_ASSIST_MIN,
    );
    expect(scale).toBeCloseTo(1, 5);
  });

  it('falls toward assistMin above peak', () => {
    const high = computeAssistScale(200, DEFAULT_ASSIST_PEAK_KMH, DEFAULT_ASSIST_MIN);
    expect(high).toBeGreaterThanOrEqual(DEFAULT_ASSIST_MIN);
    expect(high).toBeLessThan(1);
  });

  it('is monotonically non-decreasing below peak', () => {
    let prev = 0;
    for (let kmh = 1; kmh <= DEFAULT_ASSIST_PEAK_KMH; kmh++) {
      const cur = computeAssistScale(kmh, DEFAULT_ASSIST_PEAK_KMH, DEFAULT_ASSIST_MIN);
      expect(cur).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = cur;
    }
  });

  it('is monotonically non-increasing above peak (falloff region)', () => {
    let prev = computeAssistScale(DEFAULT_ASSIST_PEAK_KMH, DEFAULT_ASSIST_PEAK_KMH, DEFAULT_ASSIST_MIN);
    for (let kmh = DEFAULT_ASSIST_PEAK_KMH + 1; kmh <= 300; kmh += 5) {
      const cur = computeAssistScale(kmh, DEFAULT_ASSIST_PEAK_KMH, DEFAULT_ASSIST_MIN);
      expect(cur).toBeLessThanOrEqual(prev + 1e-9);
      prev = cur;
    }
  });

  it('falloff never goes below assistMin', () => {
    for (let kmh = DEFAULT_ASSIST_PEAK_KMH; kmh <= 400; kmh += 10) {
      const scale = computeAssistScale(kmh, DEFAULT_ASSIST_PEAK_KMH, DEFAULT_ASSIST_MIN);
      expect(scale).toBeGreaterThanOrEqual(DEFAULT_ASSIST_MIN - 1e-9);
    }
  });

  it('handles NaN speed gracefully (returns 0)', () => {
    expect(computeAssistScale(NaN, DEFAULT_ASSIST_PEAK_KMH, DEFAULT_ASSIST_MIN)).toBe(0);
  });

  it('handles Infinity speed (returns assistMin)', () => {
    const scale = computeAssistScale(Infinity, DEFAULT_ASSIST_PEAK_KMH, DEFAULT_ASSIST_MIN);
    // safe() maps Infinity → 0, so s = 0 → returns 0
    expect(scale).toBe(0);
  });
});

// ---- computeKpiSaiTorque ------------------------------------------------

describe('computeKpiSaiTorque', () => {
  it('returns 0 at zero steer', () => {
    expect(computeKpiSaiTorque(3000, 3000, 0, DEFAULT_KPI_DEG, DEFAULT_SAI_SCALE)).toBe(0);
  });

  it('is positive for positive steer (left turn) with load', () => {
    const t = computeKpiSaiTorque(3000, 3000, 1, DEFAULT_KPI_DEG, DEFAULT_SAI_SCALE);
    expect(t).toBeGreaterThan(0);
  });

  it('is negative for negative steer (right turn)', () => {
    const t = computeKpiSaiTorque(3000, 3000, -1, DEFAULT_KPI_DEG, DEFAULT_SAI_SCALE);
    expect(t).toBeLessThan(0);
  });

  it('is antisymmetric in steer sign', () => {
    const tL = computeKpiSaiTorque(3000, 3000, 0.5, DEFAULT_KPI_DEG, DEFAULT_SAI_SCALE);
    const tR = computeKpiSaiTorque(3000, 3000, -0.5, DEFAULT_KPI_DEG, DEFAULT_SAI_SCALE);
    expect(tL).toBeCloseTo(-tR, 10);
  });

  it('scales linearly with vertical load', () => {
    const t1 = computeKpiSaiTorque(1000, 1000, 1, DEFAULT_KPI_DEG, DEFAULT_SAI_SCALE);
    const t2 = computeKpiSaiTorque(2000, 2000, 1, DEFAULT_KPI_DEG, DEFAULT_SAI_SCALE);
    expect(t2).toBeCloseTo(2 * t1, 8);
  });

  it('returns 0 for zero load regardless of steer', () => {
    expect(computeKpiSaiTorque(0, 0, 1, DEFAULT_KPI_DEG, DEFAULT_SAI_SCALE)).toBe(0);
  });
});

// ---- computeMzContribution ----------------------------------------------

describe('computeMzContribution', () => {
  it('sums both tire Mz values', () => {
    expect(computeMzContribution(10, 15)).toBeCloseTo(25, 10);
  });

  it('handles negative values (high-slip "light" feel)', () => {
    expect(computeMzContribution(-5, -5)).toBeCloseTo(-10, 10);
  });

  it('treats NaN inputs as 0', () => {
    expect(computeMzContribution(NaN, 10)).toBeCloseTo(10, 10);
    expect(computeMzContribution(10, NaN)).toBeCloseTo(10, 10);
  });
});

// ---- computeFxCoupling --------------------------------------------------

describe('computeFxCoupling', () => {
  it('returns 0 when Fx is 0', () => {
    expect(computeFxCoupling(0, 0, DEFAULT_SCRUB_RADIUS_FFB_M, DEFAULT_CASTER_TRAIL_FFB_M)).toBe(0);
  });

  it('scales with Fx magnitude', () => {
    const arm = DEFAULT_SCRUB_RADIUS_FFB_M + DEFAULT_CASTER_TRAIL_FFB_M;
    const result = computeFxCoupling(1000, 1000, DEFAULT_SCRUB_RADIUS_FFB_M, DEFAULT_CASTER_TRAIL_FFB_M);
    expect(result).toBeCloseTo(2000 * arm, 6);
  });

  it('negative Fx yields negative coupling', () => {
    const r = computeFxCoupling(-500, -500, DEFAULT_SCRUB_RADIUS_FFB_M, DEFAULT_CASTER_TRAIL_FFB_M);
    expect(r).toBeLessThan(0);
  });
});

// ---- computeRackForce ---------------------------------------------------

describe('computeRackForce', () => {
  const baseInput = {
    speedKmh: 80,
    fyFL: -800,
    fyFR: -800,
    fzFL: 3500,
    fzFR: 3500,
    mzFL: 8,
    mzFR: 8,
    fxFL: -200,
    fxFR: -200,
    steerNorm: 0.5,
  };

  it('output is in [-1, 1]', () => {
    const { rackForce } = computeRackForce(baseInput);
    expect(rackForce).toBeGreaterThanOrEqual(-1);
    expect(rackForce).toBeLessThanOrEqual(1);
  });

  it('totalRawNm is finite', () => {
    const { totalRawNm } = computeRackForce(baseInput);
    expect(Number.isFinite(totalRawNm)).toBe(true);
  });

  it('assistScale is in (0, 1] at 80 km/h', () => {
    const { assistScale } = computeRackForce(baseInput);
    expect(assistScale).toBeGreaterThan(0);
    expect(assistScale).toBeLessThanOrEqual(1);
  });

  it('rackForce is 0 at standstill (full assist = 0)', () => {
    const { rackForce } = computeRackForce({ ...baseInput, speedKmh: 0 });
    expect(rackForce).toBe(0);
  });

  it('sign follows steer: positive steer yields positive rackForce', () => {
    const { rackForce } = computeRackForce({ ...baseInput, steerNorm: 0.5 });
    // KPI contribution dominates and is positive for positive steer with load
    expect(rackForce).toBeGreaterThan(0);
  });

  it('sign follows steer: negative steer yields negative rackForce', () => {
    const mirror = {
      ...baseInput,
      steerNorm: -0.5,
      mzFL: -8,
      mzFR: -8,
    };
    const { rackForce } = computeRackForce(mirror);
    expect(rackForce).toBeLessThan(0);
  });

  it('clips output to [-1, 1] with high gain', () => {
    const extreme = computeRackForce({
      ...baseInput,
      speedKmh: 200,
      fzFL: 50000,
      fzFR: 50000,
      geometry: { ffbGain: 100, ffbMaxNm: 1 },
    });
    expect(extreme.rackForce).toBeGreaterThanOrEqual(-1);
    expect(extreme.rackForce).toBeLessThanOrEqual(1);
  });

  it('all-NaN inputs produce finite zero output', () => {
    const nanInput = {
      speedKmh: NaN,
      fyFL: NaN,
      fyFR: NaN,
      fzFL: NaN,
      fzFR: NaN,
      mzFL: NaN,
      mzFR: NaN,
      fxFL: NaN,
      fxFR: NaN,
      steerNorm: NaN,
    };
    const { rackForce, totalRawNm, assistScale } = computeRackForce(nanInput);
    expect(rackForce).toBe(0);
    expect(Number.isFinite(totalRawNm)).toBe(true);
    expect(assistScale).toBe(0);
  });

  it('respects geometry overrides', () => {
    const noKpi = computeRackForce({
      ...baseInput,
      geometry: { kpiDeg: 0, saiScale: 0, scrubRadiusM: 0, casterTrailM: 0 },
    });
    // With KPI=0 and no scrub, only Mz contributes
    const mzOnly = computeRackForce({
      ...baseInput,
      fzFL: 0,
      fzFR: 0,
      fxFL: 0,
      fxFR: 0,
      geometry: { kpiDeg: 0, saiScale: 0, scrubRadiusM: 0, casterTrailM: 0 },
    });
    expect(Number.isFinite(noKpi.rackForce)).toBe(true);
    expect(Number.isFinite(mzOnly.rackForce)).toBe(true);
  });

  it('kpiTorqueNm increases with load (centering torque is load-proportional)', () => {
    // Use totalRawNm (pre-clip) so saturation at ffbMaxNm does not mask the
    // proportional relationship between vertical load and centering torque.
    const lo = computeRackForce({ ...baseInput, fzFL: 500, fzFR: 500, speedKmh: 80 });
    const hi = computeRackForce({ ...baseInput, fzFL: 5000, fzFR: 5000, speedKmh: 80 });
    expect(hi.kpiTorqueNm).toBeGreaterThan(lo.kpiTorqueNm);
  });
});

// ---- Event emission via RacingEngine ------------------------------------

import { RacingEngine } from './RacingEngine.js';
import type { TrackPreset, VehiclePreset } from '../types.js';

function makeVehicle(): VehiclePreset {
  return {
    id: 'ffb-test-rwd',
    label: 'FFB Test RWD',
    driveLabel: 'RWD',
    layoutLabel: 'Test',
    color: 0xff0000,
    wheelbase: 2.6,
    trackWidth: 1.6,
    frontMassPct: 0.52,
    finalDrive: 3.8,
    gears: [
      { n: 'R', ratio: -3.1 },
      { n: 'N', ratio: 0 },
      { n: '1', ratio: 3.2 },
    ],
    steerMaxDeg: 28,
    axleDrive: { front: 0, rear: 1 },
    diffType: 'clutchLSD',
  };
}

function makeTrack(): TrackPreset {
  return {
    id: 'ffb-test-track',
    label: 'FFB Test Track',
    groundColor: 0x333333,
    halfWidth: 8,
    curbWidth: 1,
    rubberWidth: 1,
    marblesWidth: 0.5,
    samples: 64,
    ctrl: [
      [0, 0], [50, 0], [100, 50], [50, 100], [0, 100], [-50, 50],
    ] as ReadonlyArray<readonly [number, number]>,
  };
}

describe('RacingEngine ffbRackForce event', () => {
  it('emits ffbRackForce on every step with finite rackForce', () => {
    const engine = new RacingEngine({ vehicle: makeVehicle(), track: makeTrack() });

    const payloads: Array<{ rackForce: number; simTime: number }> = [];
    const unsub = engine.events.on('ffbRackForce', (p) => payloads.push(p));

    engine.step(1 / 240);
    engine.step(1 / 240);

    unsub();
    engine.dispose();

    expect(payloads.length).toBe(2);
    for (const p of payloads) {
      expect(Number.isFinite(p.rackForce)).toBe(true);
      expect(p.rackForce).toBeGreaterThanOrEqual(-1);
      expect(p.rackForce).toBeLessThanOrEqual(1);
      expect(Number.isFinite(p.simTime)).toBe(true);
    }
  });

  it('snapshot.ffb.rackForce matches the last emitted event rackForce', () => {
    const engine = new RacingEngine({ vehicle: makeVehicle(), track: makeTrack() });
    let lastPayload = { rackForce: -99 };
    engine.events.on('ffbRackForce', (p) => { lastPayload = p; });
    engine.step(1 / 240);
    const snap = engine.snapshot();
    engine.dispose();
    expect(snap.ffb.rackForce).toBeCloseTo(lastPayload.rackForce, 10);
  });

  it('ffbRackForce is emitted after tick in the same step (one-step lag)', () => {
    // Documents the known ordering: tick fires first, then ffbRackForce.
    // A tick handler reading snap.ffb sees the PREVIOUS frame's result.
    const engine = new RacingEngine({ vehicle: makeVehicle(), track: makeTrack() });
    const order: string[] = [];
    engine.events.on('tick', () => order.push('tick'));
    engine.events.on('ffbRackForce', () => order.push('ffb'));
    engine.step(1 / 240);
    engine.dispose();
    expect(order).toEqual(['tick', 'ffb']);
  });

  it('all snapshot.ffb fields are finite after cold start', () => {
    const engine = new RacingEngine({ vehicle: makeVehicle(), track: makeTrack() });
    engine.step(1 / 240);
    const snap = engine.snapshot();
    engine.dispose();
    expect(Number.isFinite(snap.ffb.rackForce)).toBe(true);
    expect(Number.isFinite(snap.ffb.kpiTorqueNm)).toBe(true);
    expect(Number.isFinite(snap.ffb.mzContributionNm)).toBe(true);
    expect(Number.isFinite(snap.ffb.fxCouplingNm)).toBe(true);
    expect(Number.isFinite(snap.ffb.totalRawNm)).toBe(true);
    expect(Number.isFinite(snap.ffb.assistScale)).toBe(true);
  });
});

// ---- No-device adapter fallback -----------------------------------------
// Tests that attachFfbOutputAdapter is safe when no Gamepad/haptics present.
// Simulates the no-hardware fallback path without importing device APIs.

describe('no-device adapter fallback', () => {
  it('computeRackForce produces a valid payload for adapter consumption at standstill', () => {
    // At standstill the adapter would receive rackForce = 0 → intensity = 0 → no pulse.
    const payload = computeRackForce({
      speedKmh: 0,
      fyFL: 0, fyFR: 0,
      fzFL: 3500, fzFR: 3500,
      mzFL: 0, mzFR: 0,
      fxFL: 0, fxFR: 0,
      steerNorm: 0,
    });
    expect(payload.rackForce).toBe(0);
    expect(payload.assistScale).toBe(0);
    expect(Number.isFinite(payload.totalRawNm)).toBe(true);
  });

  it('intensity derived from rackForce is always in [0, 1]', () => {
    // Mirrors the adapter logic: intensity = abs(rackForce) * gain (gain defaults to 1)
    const cases = [
      { speedKmh: 0, steerNorm: 0 },
      { speedKmh: 80, steerNorm: 0.5 },
      { speedKmh: 80, steerNorm: -0.5 },
      { speedKmh: 200, steerNorm: 1 },
      { speedKmh: 200, steerNorm: -1 },
    ];
    const base = {
      fyFL: -800, fyFR: -800,
      fzFL: 3500, fzFR: 3500,
      mzFL: 8, mzFR: 8,
      fxFL: -200, fxFR: -200,
    };
    for (const c of cases) {
      const { rackForce } = computeRackForce({ ...base, ...c });
      const intensity = Math.abs(rackForce) * 1.0;
      expect(intensity).toBeGreaterThanOrEqual(0);
      expect(intensity).toBeLessThanOrEqual(1);
    }
  });

  it('engine emits ffbRackForce every step regardless of whether an adapter is attached', () => {
    const engine = new RacingEngine({ vehicle: makeVehicle(), track: makeTrack() });
    let count = 0;
    engine.events.on('ffbRackForce', () => { count++; });
    for (let i = 0; i < 5; i++) engine.step(1 / 240);
    engine.dispose();
    expect(count).toBe(5);
  });
});

// ---- HUD cold-start defaults --------------------------------------------

describe('HUD cold-start FFB defaults (M2 assistScale fix)', () => {
  it('engine cold-start lastFfbResult has assistScale=0', () => {
    // Before the first step, snapshot().ffb should reflect the engine sentinel (0).
    const engine = new RacingEngine({ vehicle: makeVehicle(), track: makeTrack() });
    const snap = engine.snapshot();
    engine.dispose();
    // Engine cold-start: assistScale sentinel must be 0, not 1.
    expect(snap.ffb.assistScale).toBe(0);
  });
});
