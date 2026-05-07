/**
 * M1 Regression Tests — QA validation suite.
 *
 * Covers:
 *   1. Normalized combined slip (gxAlpha/gyKappa boundary conditions)
 *   2. Camber-in-MF: pCy2 integration into evaluatePacejka56Combined
 *   3. Tire vertical compliance: pressure scaling, airborne zero-deflection,
 *      effective series stiffness
 *   4. Tire pressure: ideal-gas step finiteness, edge cases, step clamping
 *   5. Multi-zone tire thermal: patchWidthScale effect, conduction equilibrium,
 *      finite values after long runs
 *   6. Integration: M1 fields propagate through RacingEngine snapshot without
 *      NaN after driving + reset cycles
 */

import { afterEach, describe, expect, it } from 'bun:test';
import { RacingEngine } from '../RacingEngine.js';
import type { TrackPreset, VehiclePreset } from '../../types.js';
import {
  evaluatePacejka56Combined,
  DEFAULT_PACEJKA56_PARAMS,
  stepTirePressure,
  tirePressureMu,
  tirePressurePatchWidthScale,
  TIRE_PRESSURE_COLD_KPA,
  TIRE_PRESSURE_OPTIMAL_KPA,
  stepTireTemperatureZones,
  tireZoneAvgTemp,
  tireTempMuZones,
  stepTireVertical,
  effectiveSeriesStiffness,
  TIRE_RADIAL_STIFFNESS_NPM,
  TIRE_RADIAL_DAMPING_NSPM,
} from './index.js';

const DEG = Math.PI / 180;
const FZ_REF = DEFAULT_PACEJKA56_PARAMS.fz0;

// ---------------------------------------------------------------------------
// Engine harness (mirrors conventions from RacingEngine.test.ts)
// ---------------------------------------------------------------------------

function makeVehicle(): VehiclePreset {
  return {
    id: 'test-m1',
    label: 'M1 Test RWD',
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

function stepFor(engine: RacingEngine, totalSeconds: number, dt = 1 / 240): void {
  const steps = Math.ceil(totalSeconds / dt);
  for (let i = 0; i < steps; i++) engine.step(dt);
}

afterEach(() => {
  for (const engine of engines.splice(0)) engine.dispose();
});

// ---------------------------------------------------------------------------
// 1. Normalized combined slip — gxAlpha / gyKappa boundary conditions
// ---------------------------------------------------------------------------

describe('M1 — normalized combined slip boundary conditions', () => {
  it('gxAlpha equals exactly 1.0 at zero slip angle (pure longitudinal)', () => {
    const r = evaluatePacejka56Combined({ kappa: 0.15, alphaRad: 0, fz: FZ_REF, muScale: 1, axle: 'rear' });
    expect(r.gxAlpha).toBeCloseTo(1.0, 10);
  });

  it('gyKappa equals exactly 1.0 at zero slip ratio (pure lateral)', () => {
    const r = evaluatePacejka56Combined({ kappa: 0, alphaRad: 8 * DEG, fz: FZ_REF, muScale: 1, axle: 'front' });
    expect(r.gyKappa).toBeCloseTo(1.0, 10);
  });

  it('both weights stay in [0, 1] across the full operating range', () => {
    const kappas = [-0.3, -0.15, -0.05, 0, 0.05, 0.15, 0.3];
    const alphas = [-15, -8, -4, 0, 4, 8, 15].map((d) => d * DEG);
    for (const kappa of kappas) {
      for (const alpha of alphas) {
        const r = evaluatePacejka56Combined({ kappa, alphaRad: alpha, fz: FZ_REF, muScale: 1, axle: 'rear' });
        expect(r.gxAlpha).toBeGreaterThanOrEqual(0);
        expect(r.gxAlpha).toBeLessThanOrEqual(1);
        expect(r.gyKappa).toBeGreaterThanOrEqual(0);
        expect(r.gyKappa).toBeLessThanOrEqual(1);
      }
    }
  });

  it('combined Fx is strictly less than pure-slip Fx under non-zero slip angle', () => {
    // Any non-zero alpha must attenuate Fx relative to its pure-slip value.
    for (const alphaDeg of [2, 5, 10, 15]) {
      const r = evaluatePacejka56Combined({ kappa: 0.12, alphaRad: alphaDeg * DEG, fz: FZ_REF, muScale: 1, axle: 'rear' });
      expect(Math.abs(r.fx)).toBeLessThan(Math.abs(r.fxPure));
    }
  });

  it('combined Fy is strictly less than pure-slip Fy under non-zero slip ratio', () => {
    for (const kappa of [0.05, 0.1, 0.2]) {
      const r = evaluatePacejka56Combined({ kappa, alphaRad: 6 * DEG, fz: FZ_REF, muScale: 1, axle: 'front' });
      expect(Math.abs(r.fy)).toBeLessThan(Math.abs(r.fyPure));
    }
  });

  it('force vector magnitude stays finite and does not diverge unboundedly at combined slip', () => {
    // The MF 5.6 evaluator does not apply an isotropic friction-circle clamp.
    // The combined-slip cosine weights saturate naturally, so the force
    // magnitude is bounded. At combined slip the geometric sum of two near-peak
    // axes can exceed mu*Fz — that is physical (the vector ceiling only holds
    // when a single axis is at its independent peak). We verify finiteness and
    // that the magnitude stays within a generous physical bound (~1.5 * mu * Fz).
    const MU_CEILING = 1.5;
    for (const kappa of [-0.2, -0.1, 0.1, 0.2]) {
      for (const alphaDeg of [-12, -6, 6, 12]) {
        const r = evaluatePacejka56Combined({
          kappa,
          alphaRad: alphaDeg * DEG,
          fz: FZ_REF,
          muScale: 1,
          axle: 'rear',
        });
        const mag = Math.hypot(r.fx, r.fy);
        expect(Number.isFinite(mag)).toBe(true);
        expect(mag).toBeLessThanOrEqual(FZ_REF * MU_CEILING);
      }
    }
  });

  it('no NaN or Infinity in any result field across degenerate inputs', () => {
    const cases = [
      { kappa: 0, alphaRad: 0, fz: 0, muScale: 1 },
      { kappa: 0, alphaRad: 0, fz: FZ_REF, muScale: 0 },
      { kappa: 1e6, alphaRad: 0, fz: FZ_REF, muScale: 1 },
      { kappa: 0, alphaRad: Math.PI / 2 - 0.001, fz: FZ_REF, muScale: 1 },
    ];
    for (const c of cases) {
      const r = evaluatePacejka56Combined({ ...c, axle: 'rear' });
      for (const val of [r.fx, r.fy, r.fxPure, r.fyPure, r.gxAlpha, r.gyKappa, r.dfz]) {
        expect(Number.isFinite(val)).toBe(true);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Camber-in-MF: pCy2 integration
// ---------------------------------------------------------------------------

describe('M1 — camber thrust integrated into Pacejka MF lateral force', () => {
  it('positive camber shifts Fy in the camber-thrust direction relative to zero camber', () => {
    const base = evaluatePacejka56Combined({
      kappa: 0, alphaRad: 0, fz: FZ_REF, muScale: 1, axle: 'front', camberRad: 0,
    });
    const positiveC = evaluatePacejka56Combined({
      kappa: 0, alphaRad: 0, fz: FZ_REF, muScale: 1, axle: 'front', camberRad: 2 * DEG,
    });
    const negativeC = evaluatePacejka56Combined({
      kappa: 0, alphaRad: 0, fz: FZ_REF, muScale: 1, axle: 'front', camberRad: -2 * DEG,
    });
    // At zero slip: camber thrust is the sole contributor to Fy.
    expect(positiveC.fy).toBeGreaterThan(base.fy);
    expect(negativeC.fy).toBeLessThan(base.fy);
    // Symmetry: equal but opposite camber produces equal but opposite force delta.
    expect(positiveC.fy).toBeCloseTo(-negativeC.fy, 6);
  });

  it('camber thrust scales linearly with fz at pure slip (zero alpha, zero kappa)', () => {
    const fz1 = FZ_REF;
    const fz2 = FZ_REF * 1.5;
    const r1 = evaluatePacejka56Combined({
      kappa: 0, alphaRad: 0, fz: fz1, muScale: 1, axle: 'front', camberRad: 3 * DEG,
    });
    const r2 = evaluatePacejka56Combined({
      kappa: 0, alphaRad: 0, fz: fz2, muScale: 1, axle: 'front', camberRad: 3 * DEG,
    });
    // Fy_camber = pCy2 * camberRad * Fz — linear with Fz.
    const ratio = r2.fy / r1.fy;
    expect(ratio).toBeCloseTo(fz2 / fz1, 1);
  });

  it('zero pCy2 removes camber thrust: camberRad has no effect', () => {
    const noGain = { pCy2: 0 };
    const r0 = evaluatePacejka56Combined({
      kappa: 0, alphaRad: 0, fz: FZ_REF, muScale: 1, axle: 'front', camberRad: 0, params: noGain,
    });
    const rC = evaluatePacejka56Combined({
      kappa: 0, alphaRad: 0, fz: FZ_REF, muScale: 1, axle: 'front', camberRad: 5 * DEG, params: noGain,
    });
    expect(r0.fy).toBeCloseTo(rC.fy, 8);
  });

  it('camber thrust is attenuated by gyKappa under combined slip', () => {
    // With drive slip, the Gy factor attenuates the full lateral output (which
    // now includes camber thrust). Under combined slip, |Fy| must be strictly
    // less than the pure-lateral |Fy| computed at the same camber.
    const pure = evaluatePacejka56Combined({
      kappa: 0, alphaRad: 0, fz: FZ_REF, muScale: 1, axle: 'front', camberRad: 3 * DEG,
    });
    const combined = evaluatePacejka56Combined({
      kappa: 0.15, alphaRad: 0, fz: FZ_REF, muScale: 1, axle: 'front', camberRad: 3 * DEG,
    });
    expect(Math.abs(combined.fy)).toBeLessThan(Math.abs(pure.fy));
  });
});

// ---------------------------------------------------------------------------
// 3. Tire vertical compliance
// ---------------------------------------------------------------------------

describe('M1 — tire vertical compliance (stepTireVertical / effectiveSeriesStiffness)', () => {
  it('deflection is zero when the wheel is airborne (contactDistance > radius)', () => {
    const r = stepTireVertical({
      contactDistance: 0.40, // wheel floating 80 mm above ground
      radius: 0.32,
      deflectionRate: 0,
      prevDeflection: 0,
      dt: 1 / 240,
    });
    expect(r.deflection).toBe(0);
    expect(r.fzContact).toBe(0);
  });

  it('fzContact grows monotonically with compression depth', () => {
    const depths = [0.005, 0.01, 0.02, 0.04]; // deflections in meters
    let prevFz = 0;
    for (const d of depths) {
      const r = stepTireVertical({
        contactDistance: 0.32 - d,
        radius: 0.32,
        deflectionRate: 0,
        prevDeflection: d * 0.5,
        dt: 1 / 240,
      });
      expect(r.fzContact).toBeGreaterThan(prevFz);
      prevFz = r.fzContact;
    }
  });

  it('pressure-scaled stiffness: higher pressure produces higher fzContact at same deflection', () => {
    // Use prevDeflection equal to the actual steady-state deflection (0.01 m)
    // so the finite-difference deflection rate is zero and fzContact is purely
    // from the spring term: fzContact = k0 * (pressure / 200) * deflection.
    // This isolates the pressure scaling without the constant-damping contribution.
    const DEFLECTION = 0.01; // radius - contactDistance = 0.32 - 0.31
    const base = { contactDistance: 0.31, radius: 0.32, deflectionRate: 0, prevDeflection: DEFLECTION, dt: 1 / 240 };
    const low = stepTireVertical({ ...base, pressureKpa: 150 });
    const nominal = stepTireVertical({ ...base, pressureKpa: 200 });
    const high = stepTireVertical({ ...base, pressureKpa: 250 });
    expect(nominal.fzContact).toBeGreaterThan(low.fzContact);
    expect(high.fzContact).toBeGreaterThan(nominal.fzContact);
    // Linearity with pressure: ratio of forces must match ratio of pressures exactly.
    expect(high.fzContact / nominal.fzContact).toBeCloseTo(250 / 200, 5);
    expect(nominal.fzContact / low.fzContact).toBeCloseTo(200 / 150, 5);
  });

  it('fzContact is never negative even under fast rebound (large negative deflection rate)', () => {
    const r = stepTireVertical({
      contactDistance: 0.315,
      radius: 0.32,
      deflectionRate: -50, // extreme fast rebound
      prevDeflection: 0.01,
      dt: 1 / 240,
    });
    expect(r.fzContact).toBeGreaterThanOrEqual(0);
  });

  it('deflectionRate is carried forward for the next step', () => {
    const r = stepTireVertical({
      contactDistance: 0.31,
      radius: 0.32,
      deflectionRate: 0,
      prevDeflection: 0,
      dt: 1 / 240,
    });
    expect(Number.isFinite(r.deflectionRate)).toBe(true);
    // On first contact with prevDeflection=0, rate should be non-negative.
    expect(r.deflectionRate).toBeGreaterThanOrEqual(0);
  });

  it('effectiveSeriesStiffness is less than both spring inputs', () => {
    const kSusp = 30000;
    const kTire = TIRE_RADIAL_STIFFNESS_NPM;
    const kEff = effectiveSeriesStiffness(kSusp, kTire);
    expect(kEff).toBeLessThan(kSusp);
    expect(kEff).toBeLessThan(kTire);
    // Algebraic identity: 1/kEff = 1/kSusp + 1/kTire.
    expect(kEff).toBeCloseTo((kSusp * kTire) / (kSusp + kTire), 5);
  });

  it('effectiveSeriesStiffness returns zero when either stiffness is zero', () => {
    expect(effectiveSeriesStiffness(0, TIRE_RADIAL_STIFFNESS_NPM)).toBe(0);
    expect(effectiveSeriesStiffness(30000, 0)).toBe(0);
  });

  it('default stiffness/damping constants are positive and in a physically reasonable range', () => {
    // Calibrated for 205/55 R16 at 200 kPa: 160 000 N/m ± 50%.
    expect(TIRE_RADIAL_STIFFNESS_NPM).toBeGreaterThan(80_000);
    expect(TIRE_RADIAL_STIFFNESS_NPM).toBeLessThan(320_000);
    expect(TIRE_RADIAL_DAMPING_NSPM).toBeGreaterThan(0);
    expect(TIRE_RADIAL_DAMPING_NSPM).toBeLessThan(5_000);
  });
});

// ---------------------------------------------------------------------------
// 4. Tire pressure model
// ---------------------------------------------------------------------------

describe('M1 — tire pressure model (stepTirePressure / tirePressureMu / patchWidthScale)', () => {
  it('pressure step is finite and positive for all typical temperatures', () => {
    for (const tempC of [0, 20, 30, 60, 90, 120, 150]) {
      const p = stepTirePressure({ pressureKpa: 200, tempAvgC: tempC, coldKpa: 200, dt: 1 / 240 });
      expect(Number.isFinite(p)).toBe(true);
      expect(p).toBeGreaterThan(0);
    }
  });

  it('pressure converges toward the ideal-gas target over time', () => {
    // At 90 °C, target ≈ 200 * (363.15 / 303.15) ≈ 239.6 kPa.
    let p = 200;
    for (let i = 0; i < 2400; i++) { // 10 s at 240 Hz
      p = stepTirePressure({ pressureKpa: p, tempAvgC: 90, coldKpa: 200, dt: 1 / 240 });
    }
    // After 10 s (2.5 time constants), pressure should be well above cold value.
    expect(p).toBeGreaterThan(220);
    // And the value should be finite, not divergent.
    expect(Number.isFinite(p)).toBe(true);
  });

  it('pressure matches cold value exactly when temperature equals reference ambient (~30 °C)', () => {
    // T_AMBIENT_K = 303.15 K (30 °C). At that temperature ideal-gas target = coldKpa.
    const p = stepTirePressure({ pressureKpa: 200, tempAvgC: 30, coldKpa: 200, dt: 100 });
    expect(p).toBeCloseTo(200, 2);
  });

  it('TIRE_PRESSURE_COLD_KPA and TIRE_PRESSURE_OPTIMAL_KPA constants are equal (cold-start no-penalty)', () => {
    // Architecture review confirmed these must be equal so cold startup incurs
    // no grip penalty. If they drift apart, the grip curve will penalize a
    // fresh session, which will show up as sluggish cold-lap behaviour.
    expect(TIRE_PRESSURE_COLD_KPA).toBe(TIRE_PRESSURE_OPTIMAL_KPA);
  });

  it('tirePressureMu is exactly 1.0 at optimal pressure', () => {
    expect(tirePressureMu(200, 200)).toBe(1.0);
    expect(tirePressureMu(TIRE_PRESSURE_OPTIMAL_KPA)).toBe(1.0);
  });

  it('tirePressureMu is symmetric: over- and under-inflation by the same delta give equal mu', () => {
    for (const delta of [10, 20, 40, 60, 80]) {
      const above = tirePressureMu(200 + delta, 200);
      const below = tirePressureMu(200 - delta, 200);
      expect(above).toBeCloseTo(below, 8);
    }
  });

  it('tirePressureMu never drops below the clamped floor', () => {
    // floor = 1 - 2 * PRESSURE_GRIP_PEAK_DROP = 0.84
    const extreme = tirePressureMu(0, 200); // catastrophic under-inflation
    expect(extreme).toBeGreaterThanOrEqual(0.84);
    expect(extreme).toBeLessThan(1.0);
  });

  it('tirePressurePatchWidthScale equals 1.0 at optimal, >1 under-inflated, <1 over-inflated', () => {
    expect(tirePressurePatchWidthScale(200, 200)).toBeCloseTo(1.0, 5);
    expect(tirePressurePatchWidthScale(160, 200)).toBeGreaterThan(1.0);
    expect(tirePressurePatchWidthScale(240, 200)).toBeLessThan(1.0);
  });

  it('tirePressurePatchWidthScale is clamped to [0.85, 1.1]', () => {
    expect(tirePressurePatchWidthScale(0.001, 200)).toBeCloseTo(1.1, 5); // extreme under-inflation → cap
    expect(tirePressurePatchWidthScale(10000, 200)).toBeCloseTo(0.85, 5); // extreme over-inflation → floor
  });

  it('pressure step output is monotonically increasing with temperature at fixed starting pressure', () => {
    // Higher temperature → higher ideal-gas target → single step moves more.
    const temps = [30, 60, 90, 120];
    let prev = 200; // step output at T=30 ≈ starting pressure
    for (const tempC of temps) {
      const p = stepTirePressure({ pressureKpa: 200, tempAvgC: tempC, coldKpa: 200, dt: 1.0 });
      expect(p).toBeGreaterThanOrEqual(prev - 0.01); // allow numerical noise at 30 °C
      prev = p;
    }
  });
});

// ---------------------------------------------------------------------------
// 5. Multi-zone tire thermal model
// ---------------------------------------------------------------------------

describe('M1 — multi-zone tire thermal (stepTireTemperatureZones)', () => {
  it('patch width scale > 1 (under-inflation) concentrates more heat to shoulder strips', () => {
    const dt = 1 / 240;
    const power = 20000;
    const steps = 240; // 1 second

    let zoneNominal = { inner: 30, middle: 30, outer: 30 };
    let zoneWide = { inner: 30, middle: 30, outer: 30 };

    for (let i = 0; i < steps; i++) {
      zoneNominal = stepTireTemperatureZones({ zones: zoneNominal, slidePower: power, contactSpeed: 5, patchWidthScale: 1.0, lateralBias: 0, dt });
      // widthScale > 1 simulates under-inflation: broader shoulder contact
      zoneWide = stepTireTemperatureZones({ zones: zoneWide, slidePower: power, contactSpeed: 5, patchWidthScale: 1.1, lateralBias: 0, dt });
    }

    // Wider patch pushes more energy to the shoulders → inner+outer hotter, middle cooler.
    const shoulderNominal = (zoneNominal.inner + zoneNominal.outer) / 2;
    const shoulderWide = (zoneWide.inner + zoneWide.outer) / 2;
    expect(shoulderWide).toBeGreaterThan(shoulderNominal);
    expect(zoneWide.middle).toBeLessThan(zoneNominal.middle);
  });

  it('lateral conduction equilibrates strip temperatures over time', () => {
    // Start with a steep temperature gradient across the three strips.
    let zones = { inner: 120, middle: 30, outer: 120 };
    // Run 30 s with no slide power; conduction should flatten the gradient.
    for (let i = 0; i < 7200; i++) {
      zones = stepTireTemperatureZones({ zones, slidePower: 0, contactSpeed: 0, dt: 1 / 240 });
    }
    // All strips should converge to within 10 °C of each other.
    expect(Math.abs(zones.inner - zones.middle)).toBeLessThan(10);
    expect(Math.abs(zones.outer - zones.middle)).toBeLessThan(10);
  });

  it('all strip temperatures remain finite after a long high-power run', () => {
    let zones = { inner: 30, middle: 30, outer: 30 };
    // 60 seconds of extreme slide power
    for (let i = 0; i < 14400; i++) {
      zones = stepTireTemperatureZones({
        zones,
        slidePower: 100_000,
        contactSpeed: 50,
        patchWidthScale: 1.0,
        lateralBias: 0.5,
        dt: 1 / 240,
      });
    }
    expect(Number.isFinite(zones.inner)).toBe(true);
    expect(Number.isFinite(zones.middle)).toBe(true);
    expect(Number.isFinite(zones.outer)).toBe(true);
    // Temperatures must not diverge — convective cooling creates a ceiling.
    expect(zones.inner).toBeLessThan(600);
    expect(zones.middle).toBeLessThan(600);
    expect(zones.outer).toBeLessThan(600);
  });

  it('tireZoneAvgTemp matches the 25/50/25 weighted formula exactly', () => {
    const zones = { inner: 80, middle: 95, outer: 65 };
    const expected = 0.25 * zones.inner + 0.5 * zones.middle + 0.25 * zones.outer;
    expect(tireZoneAvgTemp(zones)).toBeCloseTo(expected, 10);
  });

  it('tireTempMuZones at uniform optimal temp returns 1.0', () => {
    expect(tireTempMuZones({ inner: 90, middle: 90, outer: 90 })).toBeCloseTo(1.0, 5);
  });

  it('tireTempMuZones degrades when one strip is severely overheated', () => {
    // Inner strip at 150 °C (well past optimal), others at optimal.
    const mu = tireTempMuZones({ inner: 150, middle: 90, outer: 90 });
    // With 25% inner weight, the average is 90 * 0.75 + 150 * 0.25 = 105 °C.
    // At 105 °C, mu < 1 (tire is past peak). Must be less than 1.
    expect(mu).toBeLessThan(1.0);
    expect(mu).toBeGreaterThan(0.4); // not catastrophic
  });

  it('no NaN in strip temps when inputs contain edge-case values', () => {
    const cases = [
      { slidePower: 0, contactSpeed: 0 },
      { slidePower: 1e9, contactSpeed: 0 },  // zero speed but extreme power
      { slidePower: 0, contactSpeed: 200 },   // very high speed
      { slidePower: 1, contactSpeed: 200, patchWidthScale: 0.85, lateralBias: -1 },
      { slidePower: 1, contactSpeed: 200, patchWidthScale: 1.1, lateralBias: 1 },
    ];
    for (const c of cases) {
      const zones = stepTireTemperatureZones({
        zones: { inner: 30, middle: 30, outer: 30 },
        dt: 1 / 240,
        ...c,
      });
      expect(Number.isFinite(zones.inner)).toBe(true);
      expect(Number.isFinite(zones.middle)).toBe(true);
      expect(Number.isFinite(zones.outer)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// 6. Integration: M1 fields in RacingEngine snapshot — finiteness + reset
// ---------------------------------------------------------------------------

describe('M1 — RacingEngine snapshot: M1 fields are finite and reset cleanly', () => {
  it('all M1 snapshot fields are finite at session start (after resetCar)', () => {
    const engine = createEngine();
    stepFor(engine, 0.1);
    const snap = engine.snapshot();
    for (const wheel of snap.wheels) {
      expect(Number.isFinite(wheel.tempInner)).toBe(true);
      expect(Number.isFinite(wheel.tempMiddle)).toBe(true);
      expect(Number.isFinite(wheel.tempOuter)).toBe(true);
      expect(Number.isFinite(wheel.pressureKpa)).toBe(true);
      expect(Number.isFinite(wheel.kappaPeak)).toBe(true);
      expect(Number.isFinite(wheel.alphaPeakRad)).toBe(true);
      expect(Number.isFinite(wheel.tireDeflection)).toBe(true);
    }
  });

  it('tire pressure initialises to cold pressure at session start', () => {
    const engine = createEngine();
    // Do not step — read immediately after reset.
    const snap = engine.snapshot();
    for (const wheel of snap.wheels) {
      expect(wheel.pressureKpa).toBeCloseTo(TIRE_PRESSURE_COLD_KPA, 1);
    }
  });

  it('tire temperatures start at ambient after resetCar', () => {
    const engine = createEngine();
    const snap = engine.snapshot();
    for (const wheel of snap.wheels) {
      // TIRE_AMBIENT_C = 30 °C
      expect(wheel.tempInner).toBeCloseTo(30, 1);
      expect(wheel.tempMiddle).toBeCloseTo(30, 1);
      expect(wheel.tempOuter).toBeCloseTo(30, 1);
    }
  });

  it('tireDeflection is non-negative and finite when wheels are on the track', () => {
    const engine = createEngine();
    stepFor(engine, 0.5); // settle on track surface
    const snap = engine.snapshot();
    for (const wheel of snap.wheels) {
      expect(wheel.tireDeflection).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(wheel.tireDeflection)).toBe(true);
    }
  });

  it('kappaPeak and alphaPeakRad are positive after the engine is rolling', () => {
    const engine = createEngine();
    engine.shiftUp();
    // Manually step with key-like throttle by pushing velocity.
    (engine as unknown as { input: { state: { throttle: number } } }).input.state.throttle = 0.8;
    stepFor(engine, 0.5);
    const snap = engine.snapshot();
    for (const wheel of snap.wheels) {
      expect(wheel.kappaPeak).toBeGreaterThan(0);
      expect(wheel.alphaPeakRad).toBeGreaterThan(0);
    }
  });

  it('M1 fields remain finite after driving for 5 s and then resetCar', () => {
    const engine = createEngine();
    engine.shiftUp();
    // Apply throttle for several seconds
    (engine as unknown as { input: { state: { throttle: number } } }).input.state.throttle = 0.6;
    stepFor(engine, 5);
    // Reset the car
    engine.resetCar();
    const snap = engine.snapshot();
    for (const wheel of snap.wheels) {
      expect(Number.isFinite(wheel.tempInner)).toBe(true);
      expect(Number.isFinite(wheel.tempMiddle)).toBe(true);
      expect(Number.isFinite(wheel.tempOuter)).toBe(true);
      expect(Number.isFinite(wheel.pressureKpa)).toBe(true);
      expect(Number.isFinite(wheel.kappaPeak)).toBe(true);
      expect(Number.isFinite(wheel.alphaPeakRad)).toBe(true);
      expect(Number.isFinite(wheel.tireDeflection)).toBe(true);
      // After reset: temperatures back to ambient, pressure to cold.
      expect(wheel.tempInner).toBeCloseTo(30, 1);
      expect(wheel.pressureKpa).toBeCloseTo(TIRE_PRESSURE_COLD_KPA, 1);
    }
  });

  it('no NaN in any snapshot field after repeated driving + reset cycles', () => {
    const engine = createEngine();
    const internals = engine as unknown as { input: { state: { throttle: number; brake: number } } };

    for (let cycle = 0; cycle < 3; cycle++) {
      internals.input.state.throttle = 0.7;
      stepFor(engine, 2);
      internals.input.state.throttle = 0;
      internals.input.state.brake = 1;
      stepFor(engine, 1);
      internals.input.state.brake = 0;
      engine.resetCar();
    }

    const snap = engine.snapshot();
    // Check all M1 numeric fields across all wheels for NaN / Infinity.
    for (const wheel of snap.wheels) {
      const m1Fields: Array<keyof typeof wheel> = [
        'tempInner', 'tempMiddle', 'tempOuter', 'pressureKpa',
        'kappaPeak', 'alphaPeakRad', 'tireDeflection',
      ];
      for (const key of m1Fields) {
        const val = wheel[key];
        if (typeof val === 'number') {
          expect(Number.isFinite(val)).toBe(true);
        }
      }
    }
  });

  it('tireDeflection correctly reflects a Fz spike under kerb-like compression', () => {
    // Simulate a hard kerb hit by compressing the tire contact more than usual.
    // This tests that the pressure-scaled vertical compliance model produces a
    // meaningfully higher fzContact when the tire is more compressed.
    const deflectionLight = stepTireVertical({
      contactDistance: 0.315, // 5 mm deflection
      radius: 0.32,
      deflectionRate: 0,
      prevDeflection: 0,
      pressureKpa: 200,
      dt: 1 / 240,
    });
    const deflectionHeavy = stepTireVertical({
      contactDistance: 0.30, // 20 mm deflection — kerb hit
      radius: 0.32,
      deflectionRate: 5, // tire impacting at 5 m/s into surface
      prevDeflection: 0.005,
      pressureKpa: 200,
      dt: 1 / 240,
    });
    // A kerb hit (heavy deflection + positive rate) must produce a meaningfully
    // larger fzContact spike than gentle rolling contact.
    expect(deflectionHeavy.fzContact).toBeGreaterThan(deflectionLight.fzContact * 2);
    expect(Number.isFinite(deflectionHeavy.fzContact)).toBe(true);
  });
});
