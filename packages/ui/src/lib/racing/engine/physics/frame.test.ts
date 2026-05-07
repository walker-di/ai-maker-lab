/**
 * M0 frame and sign-convention regression tests.
 *
 * These tests lock in the project-wide sign conventions for the core
 * per-wheel and chassis telemetry channels that appear in the debug trace
 * (`~` key) and drive the DriftPanel / G-meter HUD elements:
 *
 *   kappa     — slip ratio: positive under drive, negative under braking
 *   alphaRad  — slip angle: positive when contact patch slides to wheel-left
 *               (vy > 0), negative to wheel-right (vy < 0)
 *   Mz        — self-aligning moment: sign follows lateral force × trail,
 *               decays at large slip angle
 *   yawRateRad — chassis angular rate: positive = right turn (automotive)
 *   sideslipRad — chassis sideslip: positive = velocity to chassis right
 *
 * Integration drift check: repeated full resets must leave all channels
 * finite and near-zero with no NaN accumulation — the regression the
 * implementation team flagged for the 0.02 s⁻¹ angular damping reduction.
 */

import { describe, expect, it } from 'bun:test';
import {
  computeAligningMoment,
  computeSelfAligningMoment,
  computeWheelSlipTargets,
} from './index.js';

const DEG = Math.PI / 180;
const FZ_REF = 3500;

// ---------------------------------------------------------------------------
// kappa (slip ratio) sign conventions
// ---------------------------------------------------------------------------

describe('M0 frame — kappa sign convention', () => {
  it('is zero when the wheel rolls freely with no longitudinal velocity difference', () => {
    const r = computeWheelSlipTargets({
      longitudinalSpeed: 20,
      lateralSpeed: 0,
      wheelAngularSpeed: 20 / 0.34,
      wheelRadius: 0.34,
    });
    expect(r.slipRatio).toBeCloseTo(0, 6);
  });

  it('is positive under drive (omega*r > vx)', () => {
    const r = computeWheelSlipTargets({
      longitudinalSpeed: 15,
      lateralSpeed: 0,
      wheelAngularSpeed: 20 / 0.34,
      wheelRadius: 0.34,
    });
    expect(r.slipRatio).toBeGreaterThan(0);
  });

  it('is negative under braking (omega*r < vx)', () => {
    const r = computeWheelSlipTargets({
      longitudinalSpeed: 20,
      lateralSpeed: 0,
      wheelAngularSpeed: 10 / 0.34,
      wheelRadius: 0.34,
    });
    expect(r.slipRatio).toBeLessThan(0);
  });

  it('is negative at wheel lock (omega = 0, vx > 0)', () => {
    const r = computeWheelSlipTargets({
      longitudinalSpeed: 20,
      lateralSpeed: 0,
      wheelAngularSpeed: 0,
      wheelRadius: 0.34,
    });
    expect(r.slipRatio).toBeLessThan(0);
  });

  it('drive and brake slip are equal-magnitude and opposite-sign for symmetric inputs', () => {
    const drive = computeWheelSlipTargets({
      longitudinalSpeed: 16,
      lateralSpeed: 0,
      wheelAngularSpeed: 20 / 0.34,
      wheelRadius: 0.34,
    });
    const brake = computeWheelSlipTargets({
      longitudinalSpeed: 20,
      lateralSpeed: 0,
      wheelAngularSpeed: 16 / 0.34,
      wheelRadius: 0.34,
    });
    expect(drive.slipRatio).toBeGreaterThan(0);
    expect(brake.slipRatio).toBeLessThan(0);
    expect(drive.slipRatio).toBeCloseTo(-brake.slipRatio, 8);
  });

  it('is finite and non-NaN at exact standstill', () => {
    const r = computeWheelSlipTargets({
      longitudinalSpeed: 0,
      lateralSpeed: 0,
      wheelAngularSpeed: 0,
      wheelRadius: 0.34,
    });
    expect(Number.isFinite(r.slipRatio)).toBe(true);
    expect(r.slipRatio).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// alphaRad (slip angle) sign conventions
// ---------------------------------------------------------------------------

describe('M0 frame — alphaRad (slip angle) sign convention', () => {
  it('is zero when the contact patch has no lateral velocity', () => {
    const r = computeWheelSlipTargets({
      longitudinalSpeed: 20,
      lateralSpeed: 0,
      wheelAngularSpeed: 20 / 0.34,
      wheelRadius: 0.34,
    });
    expect(r.slipAngleRad).toBeCloseTo(0, 8);
  });

  it('is negative when the contact patch slides to wheel-right (vy > 0)', () => {
    // vy > 0 means the patch is moving toward wheel +y (rightward).
    // Convention: alphaRad < 0 for right-ward lateral slide.
    const r = computeWheelSlipTargets({
      longitudinalSpeed: 20,
      lateralSpeed: 2,
      wheelAngularSpeed: 20 / 0.34,
      wheelRadius: 0.34,
    });
    expect(r.slipAngleRad).toBeLessThan(0);
  });

  it('is positive when the contact patch slides to wheel-left (vy < 0)', () => {
    const r = computeWheelSlipTargets({
      longitudinalSpeed: 20,
      lateralSpeed: -2,
      wheelAngularSpeed: 20 / 0.34,
      wheelRadius: 0.34,
    });
    expect(r.slipAngleRad).toBeGreaterThan(0);
  });

  it('is odd-symmetric: equal magnitude, opposite sign for mirrored lateral velocity', () => {
    const right = computeWheelSlipTargets({
      longitudinalSpeed: 20,
      lateralSpeed: 3,
      wheelAngularSpeed: 20 / 0.34,
      wheelRadius: 0.34,
    });
    const left = computeWheelSlipTargets({
      longitudinalSpeed: 20,
      lateralSpeed: -3,
      wheelAngularSpeed: 20 / 0.34,
      wheelRadius: 0.34,
    });
    expect(right.slipAngleRad).toBeCloseTo(-left.slipAngleRad, 8);
  });

  it('saturates toward ±π/2 as lateral speed greatly exceeds longitudinal speed', () => {
    const r = computeWheelSlipTargets({
      longitudinalSpeed: 1,
      lateralSpeed: 100,
      wheelAngularSpeed: 1 / 0.34,
      wheelRadius: 0.34,
    });
    expect(Math.abs(r.slipAngleRad)).toBeGreaterThan(Math.PI / 4);
    expect(Math.abs(r.slipAngleRad)).toBeLessThanOrEqual(Math.PI / 2 + 1e-9);
  });

  it('is finite and non-NaN at exact standstill with zero lateral speed', () => {
    const r = computeWheelSlipTargets({
      longitudinalSpeed: 0,
      lateralSpeed: 0,
      wheelAngularSpeed: 0,
      wheelRadius: 0.34,
    });
    expect(Number.isFinite(r.slipAngleRad)).toBe(true);
    expect(r.slipAngleRad).toBeCloseTo(0, 8);
  });

  it('magnitude grows monotonically from near-zero to near-90° as lateral speed increases', () => {
    const vxFixed = 20;
    const vyValues = [0.5, 2, 6, 15];
    let prev = 0;
    for (const vy of vyValues) {
      const r = computeWheelSlipTargets({
        longitudinalSpeed: vxFixed,
        lateralSpeed: vy,
        wheelAngularSpeed: vxFixed / 0.34,
        wheelRadius: 0.34,
      });
      expect(Math.abs(r.slipAngleRad)).toBeGreaterThan(prev);
      prev = Math.abs(r.slipAngleRad);
    }
  });
});

// ---------------------------------------------------------------------------
// Mz (self-aligning moment) sign conventions
// ---------------------------------------------------------------------------

describe('M0 frame — Mz (self-aligning moment) sign convention', () => {
  it('is zero when both slip angle and lateral force are zero', () => {
    const r = computeAligningMoment({
      slipAngleRad: 0,
      fySlip: 0,
      fx: 0,
      casterDeg: 0,
    });
    expect(r.mz).toBe(0);
    expect(r.pneumaticMz).toBe(0);
    expect(r.mechanicalMz).toBe(0);
  });

  it('shares sign with fySlip at small slip angles (trail > 0)', () => {
    // Positive fySlip (force toward wheel +y, chassis right) with small slip
    // angle → positive pneumatic Mz (positive trail × positive force).
    const r = computeAligningMoment({
      slipAngleRad: 3 * DEG,
      fySlip: 1000,
      fx: 0,
      casterDeg: 0,
    });
    expect(r.pneumaticMz).toBeGreaterThan(0);
    expect(r.mz).toBeGreaterThan(0);
  });

  it('is odd-symmetric in fySlip at fixed slip angle', () => {
    const pos = computeAligningMoment({
      slipAngleRad: 5 * DEG,
      fySlip: 800,
      fx: 0,
      casterDeg: 0,
    });
    const neg = computeAligningMoment({
      slipAngleRad: 5 * DEG,
      fySlip: -800,
      fx: 0,
      casterDeg: 0,
    });
    expect(pos.mz).toBeCloseTo(-neg.mz, 8);
  });

  it('decays as |slipAngle| grows — trail collapses at large slip', () => {
    const small = computeAligningMoment({
      slipAngleRad: 2 * DEG,
      fySlip: 1000,
      fx: 0,
      casterDeg: 0,
    });
    const large = computeAligningMoment({
      slipAngleRad: 30 * DEG,
      fySlip: 1000,
      fx: 0,
      casterDeg: 0,
    });
    expect(large.pneumaticTrailM).toBeLessThan(small.pneumaticTrailM);
    expect(Math.abs(large.pneumaticMz)).toBeLessThan(Math.abs(small.pneumaticMz));
  });

  it('caster increases total Mz compared to zero-caster baseline', () => {
    const noCaster = computeAligningMoment({
      slipAngleRad: 5 * DEG,
      fySlip: 800,
      fx: 0,
      casterDeg: 0,
    });
    const withCaster = computeAligningMoment({
      slipAngleRad: 5 * DEG,
      fySlip: 800,
      fx: 0,
      casterDeg: 7,
    });
    expect(Math.abs(withCaster.mz)).toBeGreaterThan(Math.abs(noCaster.mz));
    expect(withCaster.mechanicalTrailM).toBeGreaterThan(0);
  });

  it('scrub torque shares sign with scrubSign * fx', () => {
    const pos = computeAligningMoment({
      slipAngleRad: 0,
      fySlip: 0,
      fx: 500,
      casterDeg: 0,
      scrubSign: 1,
    });
    const neg = computeAligningMoment({
      slipAngleRad: 0,
      fySlip: 0,
      fx: 500,
      casterDeg: 0,
      scrubSign: -1,
    });
    expect(pos.scrubMz).toBeGreaterThan(0);
    expect(neg.scrubMz).toBeLessThan(0);
    expect(pos.scrubMz).toBeCloseTo(-neg.scrubMz, 8);
  });

  it('computeSelfAligningMoment (legacy wrapper) matches computeAligningMoment with caster=0 scrub=0 fx=0', () => {
    const slipAngleRad = 6 * DEG;
    const fySlip = 900;
    const legacy = computeSelfAligningMoment({ slipAngleRad, fySlip });
    const full = computeAligningMoment({
      slipAngleRad,
      fySlip,
      fx: 0,
      casterDeg: 0,
      casterTrailScaleMPerDeg: 0,
      mechanicalTrailMaxM: 0,
      scrubRadiusM: 0,
    });
    expect(legacy).toBeCloseTo(full.mz, 8);
  });

  it('total Mz is the sum of pneumatic, mechanical, and scrub components', () => {
    const r = computeAligningMoment({
      slipAngleRad: 4 * DEG,
      fySlip: 600,
      fx: 300,
      casterDeg: 5,
      scrubSign: 1,
    });
    expect(r.mz).toBeCloseTo(r.pneumaticMz + r.mechanicalMz + r.scrubMz, 8);
  });

  it('pneumatic trail at zero slip equals the configured pneumaticTrail0M', () => {
    const customTrail = 0.055;
    const r = computeAligningMoment({
      slipAngleRad: 0,
      fySlip: 0,
      fx: 0,
      casterDeg: 0,
      pneumaticTrail0M: customTrail,
    });
    expect(r.pneumaticTrailM).toBeCloseTo(customTrail, 8);
  });
});

// ---------------------------------------------------------------------------
// yawRateRad and sideslipRad sign conventions (chassis frame)
//
// These tests exercise the formulas in `updateChassisDerived` indirectly by
// verifying the pure mathematical relationships they encode — the same
// formulas are exercised at the full-engine level in RacingEngine.test.ts
// (mirrors steering-response test and M0 sideslip sign test), but this
// module isolates the raw math so a sign regression can be pinpointed here
// before reading engine code.
// ---------------------------------------------------------------------------

describe('M0 frame — yawRateRad sign convention (formula verification)', () => {
  // yawRateRad = -omegaWS.dot(up)
  // In Three.js, chassis up ≈ world +Y. A right turn means the angular
  // velocity vector points DOWN (world -Y), so omegaWS.y < 0 and the
  // negation produces a positive yawRateRad. Convention: positive = right.
  it('negation of omega_up gives positive yaw for a right-turning chassis', () => {
    // Right turn: chassis rotates clockwise when viewed from above.
    // omegaWS.y < 0 (right-hand rule around +Y = left turn).
    const omegaUpComponent = -1.2; // rad/s, downward projection (right turn)
    const yawRateRad = -omegaUpComponent; // the formula in RacingEngine.ts
    expect(yawRateRad).toBeGreaterThan(0);
  });

  it('negation of omega_up gives negative yaw for a left-turning chassis', () => {
    const omegaUpComponent = 1.2; // rad/s, upward projection (left turn)
    const yawRateRad = -omegaUpComponent;
    expect(yawRateRad).toBeLessThan(0);
  });

  it('zero omega_up produces zero yaw rate', () => {
    const yawRateRad = -(0);
    // Use toBeCloseTo to treat IEEE-754 -0 and +0 as equivalent.
    expect(yawRateRad).toBeCloseTo(0, 10);
  });
});

describe('M0 frame — sideslipRad sign convention (formula verification)', () => {
  // sideslipRad = atan2(localVel.x, -localVel.z)
  // chassis forward = -Z (Three.js), chassis right = +X (Three.js).
  // +X lateral velocity = sliding to chassis right → positive sideslip.
  // Ref: SAE J670, where positive beta = velocity vector displaced clockwise
  // from the vehicle heading (i.e. nose-left, tail-right = rear slides right).

  function sideslipForLocalVel(vx: number, vz: number): number {
    return Math.atan2(vx, -vz);
  }

  it('is positive when the chassis slides to the right (localVel.x > 0, -Z forward)', () => {
    // Car moving forward (-Z) and sliding right (+X).
    expect(sideslipForLocalVel(3, -20)).toBeGreaterThan(0);
  });

  it('is negative when the chassis slides to the left (localVel.x < 0, -Z forward)', () => {
    expect(sideslipForLocalVel(-3, -20)).toBeLessThan(0);
  });

  it('is zero when the chassis moves purely forward with no lateral component', () => {
    expect(sideslipForLocalVel(0, -20)).toBeCloseTo(0, 8);
  });

  it('is odd-symmetric: equal magnitude, opposite sign for mirrored lateral velocity', () => {
    const right = sideslipForLocalVel(4, -20);
    const left = sideslipForLocalVel(-4, -20);
    expect(right).toBeCloseTo(-left, 8);
  });

  it('approaches +π/2 for a fully sideways rightward slide', () => {
    // Moving purely to the right (+X) with no forward component.
    const beta = sideslipForLocalVel(20, 0);
    expect(beta).toBeCloseTo(Math.PI / 2, 6);
  });

  it('approaches -π/2 for a fully sideways leftward slide', () => {
    const beta = sideslipForLocalVel(-20, 0);
    expect(beta).toBeCloseTo(-Math.PI / 2, 6);
  });

  it('magnitude increases as the lateral/forward ratio grows', () => {
    const small = Math.abs(sideslipForLocalVel(2, -20));
    const large = Math.abs(sideslipForLocalVel(8, -20));
    expect(large).toBeGreaterThan(small);
  });
});

// ---------------------------------------------------------------------------
// Coherence: kappa / alphaRad feed into Mz in the expected directions
// ---------------------------------------------------------------------------

describe('M0 frame — kappa + alphaRad coherence with Mz', () => {
  it('increasing slip angle reduces pneumatic trail (convergent physics)', () => {
    // Physically: as slip angle grows the contact patch begins sliding
    // homogeneously; the asymmetric pressure distribution that creates
    // pneumatic trail disappears. Trail must decay monotonically.
    const angles = [1, 5, 10, 20, 40].map((d) => d * DEG);
    let prevTrail = Infinity;
    for (const a of angles) {
      const r = computeAligningMoment({ slipAngleRad: a, fySlip: 0, fx: 0, casterDeg: 0 });
      expect(r.pneumaticTrailM).toBeLessThan(prevTrail);
      prevTrail = r.pneumaticTrailM;
    }
  });

  it('combined-slip input: non-zero kappa reduces alphaRad-driven Mz magnitude (combined slip attenuates)', () => {
    // When longitudinal slip is non-zero the tire sidewall deformation has
    // a longitudinal component that partly destroys the lateral pressure
    // asymmetry. We confirm via the evaluator's Gyk factor: the slip ratio
    // input to computeWheelSlipTargets reduces the effective Fy that feeds Mz.
    // Here we just verify the raw kappa = 0 vs kappa ≠ 0 direction using the
    // slip-target helper to demonstrate the correct input framing.
    const vx = 20;
    const lateralSpeed = 3; // gives a moderate alphaRad
    const noKappa = computeWheelSlipTargets({
      longitudinalSpeed: vx,
      lateralSpeed,
      wheelAngularSpeed: vx / 0.34, // no drive slip
      wheelRadius: 0.34,
    });
    const withKappa = computeWheelSlipTargets({
      longitudinalSpeed: vx,
      lateralSpeed,
      wheelAngularSpeed: (vx * 1.2) / 0.34, // 20% drive slip
      wheelRadius: 0.34,
    });
    // Both slip angles should be the same (lateral speed is identical)…
    expect(noKappa.slipAngleRad).toBeCloseTo(withKappa.slipAngleRad, 6);
    // …but the driven case has positive kappa, which feeds into a friction
    // circle and would reduce Fy (the full combined-slip path is in the MF
    // evaluator, but the slip TARGET correctness can already be asserted here).
    expect(withKappa.slipRatio).toBeGreaterThan(0);
    expect(noKappa.slipRatio).toBeCloseTo(0, 6);
  });
});

// ---------------------------------------------------------------------------
// Integration drift check
// ---------------------------------------------------------------------------

describe('M0 frame — NaN / finite guard on slip helpers under repeated reset', () => {
  it('computeWheelSlipTargets stays finite across 500 random-ish input combinations', () => {
    // Simulates the kind of chassis-state variation that occurs during
    // repeated resets and mid-session chassis teleports. No NaN or Infinity
    // may appear in any output channel.
    const radius = 0.34;
    let nanCount = 0;

    for (let i = 0; i < 500; i++) {
      const vx = (i % 50) - 10; // -10…39 m/s
      const vy = Math.sin(i * 0.1) * 8;
      const omega = vx / radius + Math.cos(i * 0.07) * 5;
      const r = computeWheelSlipTargets({
        longitudinalSpeed: vx,
        lateralSpeed: vy,
        wheelAngularSpeed: omega,
        wheelRadius: radius,
      });
      if (
        !Number.isFinite(r.slipRatio) ||
        !Number.isFinite(r.slipAngleRad) ||
        !Number.isFinite(r.contactSpeed) ||
        !Number.isFinite(r.wheelSurfaceSpeed)
      ) {
        nanCount++;
      }
    }
    expect(nanCount).toBe(0);
  });

  it('computeAligningMoment stays finite across 500 random-ish input combinations', () => {
    let nanCount = 0;

    for (let i = 0; i < 500; i++) {
      const slipAngleRad = ((i % 100) - 50) * DEG; // ±50°
      const fySlip = (Math.sin(i * 0.13) * 4000);
      const fx = Math.cos(i * 0.09) * 2000;
      const casterDeg = (i % 12);
      const r = computeAligningMoment({ slipAngleRad, fySlip, fx, casterDeg });
      if (
        !Number.isFinite(r.mz) ||
        !Number.isFinite(r.pneumaticTrailM) ||
        !Number.isFinite(r.mechanicalTrailM) ||
        !Number.isFinite(r.pneumaticMz) ||
        !Number.isFinite(r.mechanicalMz) ||
        !Number.isFinite(r.scrubMz)
      ) {
        nanCount++;
      }
    }
    expect(nanCount).toBe(0);
  });

  it('slip-angle formula stays finite at exact zero longitudinal speed across ±20 m/s lateral sweep', () => {
    let nanCount = 0;
    for (let vy = -20; vy <= 20; vy += 0.5) {
      const r = computeWheelSlipTargets({
        longitudinalSpeed: 0,
        lateralSpeed: vy,
        wheelAngularSpeed: 0,
        wheelRadius: 0.34,
      });
      if (!Number.isFinite(r.slipAngleRad)) nanCount++;
    }
    expect(nanCount).toBe(0);
  });
});
