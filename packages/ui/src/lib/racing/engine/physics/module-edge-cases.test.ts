import { describe, expect, it } from 'bun:test';
import {
  ENGINE_CURVE,
  TIRE_FZ_REF,
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
  computeMotionRatio,
  computeSelfAligningMoment,
  computeTcCut,
  computeToeSlipOffset,
  engineTorqueAt,
  pacejkaLat,
  stepBrakeTemperature,
  stepTireTemperature,
  stepTireTemperatureZones,
  stepTirePressure,
  stepTireVertical,
  tirePressureMu,
  tirePressurePatchWidthScale,
  tireZoneAvgTemp,
  tireTempMuZones,
  tireD,
  tireTempMu,
} from './index.js';

const DEG = Math.PI / 180;

describe('racing physics module edge coverage', () => {
  it('tire-load matches reference load exactly at the nominal point', () => {
    expect(tireD(1.15, TIRE_FZ_REF)).toBeCloseTo(1.15 * TIRE_FZ_REF, 8);
  });

  it('pacejka lateral curve falls back from its peak past the reference angle', () => {
    // Phase 2 dropped the legacy `fall` post-peak heuristic — load- and
    // curvature-aware MF coefficients (`pEy1`, `pDy2`) now produce the
    // post-peak grip drop directly. Verify the curve still rolls off past
    // the peak instead of growing unboundedly with slip angle.
    const peak = Math.abs(pacejkaLat(7 * DEG, 3500, 1));
    const past = Math.abs(pacejkaLat(20 * DEG, 3500, 1));
    expect(past).toBeLessThan(peak);
  });

  it('engine curve interpolates between control points and clamps above max rpm', () => {
    const [r0, t0] = ENGINE_CURVE[2];
    const [r1, t1] = ENGINE_CURVE[3];
    const midRpm = (r0 + r1) / 2;
    expect(engineTorqueAt(midRpm)).toBeCloseTo((t0 + t1) / 2, 8);
    expect(engineTorqueAt(99999)).toBe(0);
  });

  it('ackermann preserves parallel steer at zero percentage and mirrors right turns', () => {
    const parallel = computeAckermannAngles(-10 * DEG, 2.8, 1.65, 0);
    expect(parallel.leftRad).toBeCloseTo(-10 * DEG, 8);
    expect(parallel.rightRad).toBeCloseTo(-10 * DEG, 8);

    const rightTurn = computeAckermannAngles(-10 * DEG, 2.8, 1.65, 1);
    expect(Math.abs(rightTurn.rightRad)).toBeGreaterThan(Math.abs(rightTurn.leftRad));
  });

  it('motion-ratio collapses wheel rate at zero leverage', () => {
    expect(computeMotionRatio(65000, 0)).toBe(0);
  });

  it('bump-stop stays off when stiffness is non-positive', () => {
    expect(computeBumpStopForce(0.15, 0.12, 0)).toBe(0);
    expect(computeBumpStopForce(0.15, 0.12, -1000)).toBe(0);
  });

  it('caster-camber depends on steering magnitude, not steering direction', () => {
    const left = computeCasterCamber(0.35, 7);
    const right = computeCasterCamber(-0.35, 7);
    expect(left).toBeCloseTo(right, 8);
    expect(left).toBeLessThan(0);
  });

  it('toe mirrors across chassis sides', () => {
    expect(computeToeSlipOffset(0.15, -1, 'front')).toBeCloseTo(-computeToeSlipOffset(0.15, 1, 'front'), 8);
  });

  it('camber thrust includes caster-induced camber in the effective wheel camber', () => {
    const result = computeCamberThrust({
      staticCamberRad: -2 * DEG,
      rollRad: 0,
      camberGain: 0.5,
      casterCamberRad: -0.5 * DEG,
      lateralSign: 1,
      fz: 3200,
    });
    expect(result.camberRad).toBeCloseTo(-2.5 * DEG, 8);
    expect(result.thrust).toBeLessThan(0);
  });

  it('arb response scales with motion-ratio squared', () => {
    const full = computeAxleArb({
      arbStiffness: 30000,
      motionRatio: 1,
      leftCompression: 0.05,
      rightCompression: 0.01,
      leftInContact: true,
      rightInContact: true,
    });
    const reduced = computeAxleArb({
      arbStiffness: 30000,
      motionRatio: 0.5,
      leftCompression: 0.05,
      rightCompression: 0.01,
      leftInContact: true,
      rightInContact: true,
    });
    expect(Math.abs(reduced.leftDfz)).toBeCloseTo(Math.abs(full.leftDfz) * 0.25, 8);
  });

  it('anti-dive stays off when the geometry percentage is zero', () => {
    expect(computeAntiPitchVertical({ axle: 'front', fxAtContact: -2000, pct: 0 })).toBe(0);
  });

  it('brake fade honors custom onset and full-fade points', () => {
    expect(brakeFadeFactor({ brakeTempC: 200, fadeOnsetC: 100, fadeFullC: 300 })).toBeCloseTo(0.75, 8);
  });

  it('brake thermal moves toward a custom ambient temperature', () => {
    let temp = 250;
    for (let i = 0; i < 1200; i++) {
      temp = stepBrakeTemperature({
        brakeTempC: temp,
        brakeTorque: 0,
        omega: 0,
        contactSpeed: 15,
        dt: 0.05,
        ambientC: 40,
      });
    }
    expect(temp).toBeGreaterThanOrEqual(40);
    expect(temp).toBeLessThan(60);
  });

  it('aero returns zero at rest and opposes lateral velocity sign', () => {
    expect(computeAeroDrag({ forwardSpeed: 0, sideSpeed: 0, cdArea: 0.7 })).toEqual({ fzDragWS: 0, fxDragWS: 0 });
    expect(computeAeroDrag({ forwardSpeed: 20, sideSpeed: -4, cdArea: 0.7 }).fxDragWS).toBeGreaterThan(0);
  });

  it('self-aligning moment flips with lateral force sign and vanishes with zero force', () => {
    expect(computeSelfAligningMoment({ slipAngleRad: 6 * DEG, fySlip: 0 })).toBeCloseTo(0, 8);
    const posFy = computeSelfAligningMoment({ slipAngleRad: 6 * DEG, fySlip: 2500 });
    const negFy = computeSelfAligningMoment({ slipAngleRad: 6 * DEG, fySlip: -2500 });
    expect(posFy).toBeCloseTo(-negFy, 8);
  });

  it('clutch torque saturates symmetrically for negative slip', () => {
    const result = computeClutchTorque({
      engineOmega: 50,
      wheelEngineOmega: 200,
      clutchStiffness: 1000,
      clutchMaxTorque: 500,
    });
    expect(result.clutchTorque).toBeCloseTo(-500, 8);
    expect(result.slip).toBe(-150);
  });

  it('clutch LSD couples more strongly on power than on coast with the same wheel delta', () => {
    const onPower = applyDiffCoupling({
      type: 'clutchLSD',
      leftOmega: 110,
      rightOmega: 50,
      leftInertia: 1.5,
      effectiveThrottle: 0.8,
      driveTorquePerWheel: 250,
      preloadNm: 40,
      capacityNm: 1200,
      powerLockPct: 0.8,
      coastLockPct: 0.1,
      dt: 1 / 240,
    });
    const onCoast = applyDiffCoupling({
      type: 'clutchLSD',
      leftOmega: 110,
      rightOmega: 50,
      leftInertia: 1.5,
      effectiveThrottle: 0,
      driveTorquePerWheel: 250,
      preloadNm: 40,
      capacityNm: 1200,
      powerLockPct: 0.8,
      coastLockPct: 0.1,
      dt: 1 / 240,
    });
    const powerDelta = Math.abs(onPower.leftOmega - onPower.rightOmega);
    const coastDelta = Math.abs(onCoast.leftOmega - onCoast.rightOmega);
    expect(powerDelta).toBeLessThan(coastDelta);
  });

  it('abs release timer decays back to full braking once the event clears', () => {
    const triggered = applyAbs({
      enabled: true,
      driverBrake: 1,
      vx: 20,
      slipRatio: -0.4,
      threshold: 0.18,
      release: 0,
      releaseTime: 0.05,
      dt: 1 / 240,
    });
    const recovered = applyAbs({
      enabled: true,
      driverBrake: 1,
      vx: 20,
      slipRatio: 0,
      threshold: 0.18,
      release: triggered.release,
      releaseTime: 0.05,
      dt: 0.1,
    });
    expect(triggered.scale).toBeLessThan(1);
    expect(recovered.scale).toBe(1);
    expect(recovered.release).toBe(0);
  });

  it('traction control stays inactive below threshold', () => {
    expect(
      computeTcCut({
        enabled: true,
        driverThrottle: 1,
        speedKmh: 40,
        maxDriveSlip: 0.1,
        threshold: 0.12,
        window: 0.18,
      }).cut,
    ).toBe(0);
  });

  it('esc classifies understeer when yaw response lags the requested turn', () => {
    const result = classifyEsc({
      enabled: true,
      speedKmh: 90,
      steerSmoothed: 0.55,
      absLocalVz: 24,
      yawRateRad: 0.1,
      desiredYawRad: 0.5,
      sideslipDeg: 4,
      oversteerThreshold: 0.2,
      understeerThreshold: 0.2,
      minSpeedKmh: 30,
    });
    expect(result.active).toBe(true);
    expect(result.mode).toBe('understeer');
    expect(result.axle).toBe('rear');
  });

  it('tire thermal grip is clamped at both extremes and cooling respects custom ambient', () => {
    expect(tireTempMu(-100)).toBe(0.4);
    expect(tireTempMu(90)).toBe(1);

    let temp = 120;
    for (let i = 0; i < 800; i++) {
      temp = stepTireTemperature({
        tempC: temp,
        slidePower: 0,
        contactSpeed: 10,
        dt: 0.05,
        ambientC: 35,
      });
    }
    expect(temp).toBeGreaterThanOrEqual(35);
    expect(temp).toBeLessThan(50);
  });
});

describe('M1 tire modules', () => {
  it('multi-zone thermal: three strips converge toward ambient with no heat input', () => {
    let zones = { inner: 80, middle: 90, outer: 70 };
    // Run ~50 seconds; cooling is intentionally slow (carcass heat retention).
    for (let i = 0; i < 12000; i++) {
      zones = stepTireTemperatureZones({ zones, slidePower: 0, contactSpeed: 5, dt: 1 / 240 });
    }
    // All strips must have cooled significantly from their starting temps.
    expect(zones.inner).toBeLessThan(60);
    expect(zones.middle).toBeLessThan(60);
    expect(zones.outer).toBeLessThan(60);
    // Conduction equalises the strip temps — they must be close to each other.
    expect(Math.abs(zones.inner - zones.middle)).toBeLessThan(5);
    expect(Math.abs(zones.middle - zones.outer)).toBeLessThan(5);
  });

  it('multi-zone thermal: lateral bias concentrates heat to the inner strip', () => {
    const basePower = 15000;
    const dt = 1 / 240;
    let zonesSymmetric = { inner: 30, middle: 30, outer: 30 };
    let zonesBiasedInner = { inner: 30, middle: 30, outer: 30 };
    for (let i = 0; i < 240; i++) {
      zonesSymmetric = stepTireTemperatureZones({ zones: zonesSymmetric, slidePower: basePower, contactSpeed: 5, lateralBias: 0, dt });
      zonesBiasedInner = stepTireTemperatureZones({ zones: zonesBiasedInner, slidePower: basePower, contactSpeed: 5, lateralBias: -1, dt });
    }
    expect(zonesBiasedInner.inner).toBeGreaterThan(zonesSymmetric.inner);
    expect(zonesBiasedInner.outer).toBeLessThan(zonesSymmetric.outer);
  });

  it('multi-zone grip average: cold tires give ~0.45 mu, optimal gives 1.0', () => {
    const cold = { inner: 30, middle: 30, outer: 30 };
    const opt = { inner: 90, middle: 90, outer: 90 };
    expect(tireTempMuZones(cold)).toBeCloseTo(0.45, 2);
    expect(tireTempMuZones(opt)).toBeCloseTo(1.0, 5);
  });

  it('tireZoneAvgTemp uses 25/50/25 weighting', () => {
    expect(tireZoneAvgTemp({ inner: 100, middle: 60, outer: 0 })).toBeCloseTo(100 * 0.25 + 60 * 0.5 + 0 * 0.25, 8);
  });

  it('tire pressure: ideal-gas step raises pressure as temperature rises', () => {
    const p0 = stepTirePressure({ pressureKpa: 200, tempAvgC: 30, coldKpa: 200, dt: 10 });
    expect(p0).toBeCloseTo(200, 2);
    const p1 = stepTirePressure({ pressureKpa: 200, tempAvgC: 90, coldKpa: 200, dt: 10 });
    expect(p1).toBeGreaterThan(200);
  });

  it('tirePressureMu: returns 1.0 at optimal, decays symmetrically above/below', () => {
    expect(tirePressureMu(200, 200)).toBe(1.0);
    const above = tirePressureMu(240, 200);
    const below = tirePressureMu(160, 200);
    expect(above).toBeCloseTo(below, 5);
    expect(above).toBeLessThan(1.0);
    expect(above).toBeGreaterThan(0.8);
  });

  it('tirePressurePatchWidthScale: under-inflation widens patch, over-inflation narrows it', () => {
    const atOptimal = tirePressurePatchWidthScale(200, 200);
    const underInflated = tirePressurePatchWidthScale(160, 200);
    const overInflated = tirePressurePatchWidthScale(240, 200);
    expect(atOptimal).toBeCloseTo(1.0, 5);
    expect(underInflated).toBeGreaterThan(atOptimal);
    expect(overInflated).toBeLessThan(atOptimal);
  });

  it('tire vertical: deflection is positive under small contact and increases with compression', () => {
    // A wheel 10 mm from the ground on a 320 mm radius tire: deflection = 320 - 310 = 10 mm.
    const light = stepTireVertical({
      contactDistance: 0.31,
      radius: 0.32,
      kTireNpm: 160000,
      cTireNspm: 400,
      deflectionRate: 0,
      prevDeflection: 0,
      pressureKpa: 200,
      dt: 1 / 240,
    });
    // More compressed: contactDistance = 0.29 (30 mm deflection).
    const heavy = stepTireVertical({
      contactDistance: 0.29,
      radius: 0.32,
      kTireNpm: 160000,
      cTireNspm: 400,
      deflectionRate: 0,
      prevDeflection: 0,
      pressureKpa: 200,
      dt: 1 / 240,
    });
    expect(light.deflection).toBeGreaterThan(0);
    expect(light.fzContact).toBeGreaterThan(0);
    expect(heavy.deflection).toBeGreaterThan(light.deflection);
    expect(heavy.fzContact).toBeGreaterThan(light.fzContact);

    // Higher pressure makes the tire stiffer (less deflection for same load).
    const highPressure = stepTireVertical({
      contactDistance: 0.31,
      radius: 0.32,
      kTireNpm: 160000,
      cTireNspm: 400,
      deflectionRate: 0,
      prevDeflection: 0,
      pressureKpa: 240,
      dt: 1 / 240,
    });
    expect(highPressure.fzContact).toBeGreaterThan(light.fzContact);
  });
});
