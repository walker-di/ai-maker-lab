/**
 * M6 Drivetrain Depth — focused unit tests.
 *
 * Covers:
 *   - turbo spool/boost/torque-multiplier dynamics
 *   - engine torque with boost and engine-map multipliers
 *   - shift refusal / shift delay
 *   - driveshaft compliance (torsional spring + backlash)
 *   - engine braking curve (refined vs legacy)
 *   - NA fallback compatibility (no turbo/map/shiftLogic → pre-M6 behaviour)
 */
import { describe, it, expect } from 'bun:test';

import {
  stepTurbo,
  makeTurboState,
  type TurboParams,
} from './turbo.js';

import {
  engineTorqueAt,
  engineTorqueAtWithMap,
  sampleEngineTorqueMap,
  sampleTorqueCurve,
  engineBrakeTorqueAt,
  type EngineTorqueMap,
} from './engine-curve.js';

import {
  evaluateShiftRequest,
  requestShift,
  stepShiftDelay,
  makeShiftState,
  stepDrivelineCompliance,
  makeDrivelineComplianceState,
  type ShiftLogicParams,
  type DrivelineComplianceParams,
} from './drivetrain.js';

// ============================================================
// Turbo spool / boost / torque multiplier
// ============================================================

describe('turbo spool — NA fallback (no turbo state)', () => {
  it('makeTurboState initialises to zero spool', () => {
    const state = makeTurboState();
    expect(state.spoolRatio).toBe(0);
    expect(state.boostBar).toBe(0);
    expect(state.torqueMultiplier).toBe(1);
    expect(state.isOverboost).toBe(false);
  });
});

describe('stepTurbo — spool-up', () => {
  const params: TurboParams = {
    peakBoostBar: 1.0,
    peakTorqueMultiplier: 1.5,
    targetSpoolRpm: 3000,
    spoolUpTimeS: 1.0,
    spoolDownTimeS: 2.0,
  };

  it('spool rises from 0 when throttle and rpm are applied', () => {
    const state = makeTurboState();
    const targetOmega = 3000 * (2 * Math.PI / 60);
    stepTurbo({ state, throttle: 1.0, engineOmega: targetOmega, dt: 0.1, params });
    expect(state.spoolRatio).toBeGreaterThan(0);
  });

  it('spool increases monotonically under WOT at target rpm', () => {
    const state = makeTurboState();
    const targetOmega = 3000 * (2 * Math.PI / 60);
    let prev = 0;
    for (let i = 0; i < 20; i++) {
      stepTurbo({ state, throttle: 1.0, engineOmega: targetOmega, dt: 0.1, params });
      expect(state.spoolRatio).toBeGreaterThanOrEqual(prev);
      prev = state.spoolRatio;
    }
  });

  it('spool reaches 1 after sufficient time at WOT and target rpm', () => {
    const state = makeTurboState();
    const targetOmega = 3000 * (2 * Math.PI / 60);
    for (let i = 0; i < 100; i++) {
      stepTurbo({ state, throttle: 1.0, engineOmega: targetOmega, dt: 0.1, params });
    }
    expect(state.spoolRatio).toBeCloseTo(1.0, 2);
  });

  it('boost bar is 0 at spool=0', () => {
    const state = makeTurboState(); // spoolRatio = 0
    // Directly check: boost = spool² × peakBoostBar
    expect(state.boostBar).toBe(0);
  });

  it('torque multiplier reaches peakTorqueMultiplier at full spool', () => {
    const state = makeTurboState();
    state.spoolRatio = 1.0; // force to full spool
    const targetOmega = 3000 * (2 * Math.PI / 60);
    // Step once with dt=0 equivalent to not change spool but recalculate
    stepTurbo({ state, throttle: 1.0, engineOmega: targetOmega, dt: 0.0001, params });
    expect(state.torqueMultiplier).toBeCloseTo(1.5, 1);
  });

  it('torque multiplier is 1 at zero boost', () => {
    const state = makeTurboState();
    // spool = 0, boost = 0 → multiplier = 1
    expect(state.torqueMultiplier).toBe(1);
  });
});

describe('stepTurbo — spool-down on lift', () => {
  const params: TurboParams = {
    peakBoostBar: 1.0,
    peakTorqueMultiplier: 1.5,
    targetSpoolRpm: 3000,
    spoolUpTimeS: 0.5,
    spoolDownTimeS: 1.0,
  };

  it('spool decays when throttle is zero', () => {
    const state = makeTurboState();
    state.spoolRatio = 0.8;
    const targetOmega = 3000 * (2 * Math.PI / 60);
    stepTurbo({ state, throttle: 0.0, engineOmega: targetOmega, dt: 0.1, params });
    expect(state.spoolRatio).toBeLessThan(0.8);
  });

  it('spool never goes below idleSpoolRatio', () => {
    const paramsWithIdle: TurboParams = { ...params, idleSpoolRatio: 0.1 };
    const state = makeTurboState();
    state.spoolRatio = 0.15;
    const omega = 800 * (2 * Math.PI / 60);
    for (let i = 0; i < 50; i++) {
      stepTurbo({ state, throttle: 0, engineOmega: omega, dt: 0.1, params: paramsWithIdle });
    }
    expect(state.spoolRatio).toBeGreaterThanOrEqual(0.1 - 1e-6);
  });

  it('isOverboost is set when boost exceeds overboostLimitBar', () => {
    const state = makeTurboState();
    state.spoolRatio = 0.99;
    const paramsOB: TurboParams = { ...params, overboostLimitBar: 0.5 };
    const targetOmega = 3000 * (2 * Math.PI / 60);
    stepTurbo({ state, throttle: 1.0, engineOmega: targetOmega, dt: 0.001, params: paramsOB });
    // boostBar = spool² × peakBoostBar ≈ 0.98 × 1.0 = 0.98 > 0.5 → overboost
    expect(state.isOverboost).toBe(true);
  });
});

// ============================================================
// Engine torque with boost and engine map
// ============================================================

describe('sampleEngineTorqueMap', () => {
  const map: EngineTorqueMap = {
    axis0: [0, 1],
    axis1: [1000, 5000],
    data: [
      [1.0, 1.0], // throttle=0 row: multiplier = 1 everywhere
      [1.2, 1.5], // throttle=1 row: 1.2 at 1000 rpm, 1.5 at 5000 rpm
    ],
  };

  it('returns 1 at (0, any rpm)', () => {
    expect(sampleEngineTorqueMap(map, 0, 1000)).toBeCloseTo(1.0, 10);
    expect(sampleEngineTorqueMap(map, 0, 5000)).toBeCloseTo(1.0, 10);
  });

  it('returns authored corner value at (1, 5000)', () => {
    expect(sampleEngineTorqueMap(map, 1, 5000)).toBeCloseTo(1.5, 5);
  });

  it('bilinear interpolation at midpoint throttle and midpoint rpm', () => {
    const result = sampleEngineTorqueMap(map, 0.5, 3000);
    // At throttle=0.5 the row is interpolated between 1 and 1.2 at 1000,
    // and between 1 and 1.5 at 5000.
    // At rpm=3000 (midpoint 1000–5000, t=0.5 on axis1):
    //   low-throttle row: 1 + 0 = 1
    //   high-throttle row: 1.2 + 0.5*(1.5-1.2) = 1.35
    //   blend at throttle=0.5: 1 + 0.5*(1.35 - 1) = 1.175
    expect(result).toBeCloseTo(1.175, 4);
  });

  it('clamps out-of-range throttle to map edges', () => {
    expect(sampleEngineTorqueMap(map, -1, 3000)).toBeCloseTo(sampleEngineTorqueMap(map, 0, 3000), 5);
    expect(sampleEngineTorqueMap(map, 2, 3000)).toBeCloseTo(sampleEngineTorqueMap(map, 1, 3000), 5);
  });
});

describe('engineTorqueAtWithMap', () => {
  it('NA vehicle (multiplier=1, no map) matches legacy engineTorqueAt', () => {
    for (const rpm of [1000, 3000, 5500, 8000]) {
      const legacy = engineTorqueAt(rpm);
      const m6 = engineTorqueAtWithMap(rpm, 0.8, 1.0);
      // engineTorqueAtWithMap returns base × boost × mapMult × throttle
      // but throttle is applied inside, so let's compare at throttle = 1.0
      // Actually, the function takes throttle for map lookup only — base torque
      // is NOT scaled by throttle inside this fn (caller scales).
      expect(m6).toBeCloseTo(legacy, 5);
    }
  });

  it('boost multiplier > 1 scales torque above NA curve', () => {
    const rpm = 4000;
    const base = engineTorqueAt(rpm);
    const boosted = engineTorqueAtWithMap(rpm, 1.0, 1.4);
    expect(boosted).toBeCloseTo(base * 1.4, 4);
  });

  it('authored torque curve overrides built-in NA curve', () => {
    const customCurve: ReadonlyArray<readonly [number, number]> = [
      [0, 0],
      [5000, 600],
    ];
    const result = engineTorqueAtWithMap(2500, 1.0, 1.0, customCurve);
    // Linear interp: at 2500/5000 = 0.5 → 300 Nm
    expect(result).toBeCloseTo(300, 3);
  });

  it('sampleTorqueCurve falls back to built-in when curve is undefined', () => {
    const legacy = engineTorqueAt(4000);
    const fallback = sampleTorqueCurve(undefined, 4000);
    expect(fallback).toBeCloseTo(legacy, 5);
  });
});

// ============================================================
// Engine braking curve
// ============================================================

describe('engineBrakeTorqueAt', () => {
  it('returns non-negative value', () => {
    const drag = engineBrakeTorqueAt(200, 0);
    expect(drag).toBeGreaterThan(0);
  });

  it('throttle=1 → near-zero extra drag (only constant friction remains)', () => {
    const fullThrottle = engineBrakeTorqueAt(200, 1.0);
    const noThrottle = engineBrakeTorqueAt(200, 0.0);
    expect(fullThrottle).toBeLessThan(noThrottle);
  });

  it('drag increases with rpm (omega)', () => {
    const low = engineBrakeTorqueAt(100, 0);
    const high = engineBrakeTorqueAt(600, 0);
    expect(high).toBeGreaterThan(low);
  });

  it('respects maxBrakeTorqueNm cap', () => {
    const capped = engineBrakeTorqueAt(10000, 0, { maxBrakeTorqueNm: 50 });
    expect(capped).toBeLessThanOrEqual(50 + 1e-6);
  });

  it('custom params override defaults', () => {
    const custom = engineBrakeTorqueAt(200, 0, {
      linearNmPerRadS: 0.1,
      constantNm: 20,
      pumpingCoeffNmPerRadS2: 0,
      maxBrakeTorqueNm: 1000,
    });
    // drag = 0.1*200 + 20 + 0 = 40
    expect(custom).toBeCloseTo(40, 3);
  });
});

// ============================================================
// Shift refusal
// ============================================================

describe('evaluateShiftRequest — shift refusal', () => {
  const params: ShiftLogicParams = {
    upshiftMinRpm: 2000,
    upshiftMaxRpm: 8000,
    downshiftMinRpm: 0,
    downshiftMaxRpm: 6000,
  };

  it('accepts upshift within rpm window', () => {
    const r = evaluateShiftRequest('up', 5000, params);
    expect(r.refused).toBe(false);
  });

  it('refuses upshift below minRpm', () => {
    const r = evaluateShiftRequest('up', 1500, params);
    expect(r.refused).toBe(true);
    expect(r.reason).toMatch(/upshift refused/);
  });

  it('refuses upshift above maxRpm', () => {
    const r = evaluateShiftRequest('up', 9000, params);
    expect(r.refused).toBe(true);
  });

  it('accepts downshift within rpm window', () => {
    const r = evaluateShiftRequest('down', 4000, params);
    expect(r.refused).toBe(false);
  });

  it('refuses downshift above maxRpm (over-rev protection)', () => {
    const r = evaluateShiftRequest('down', 7000, params);
    expect(r.refused).toBe(true);
    expect(r.reason).toMatch(/downshift refused/);
  });

  it('default params (empty object) never refuse', () => {
    const r = evaluateShiftRequest('up', 0, {});
    expect(r.refused).toBe(false);
  });
});

// ============================================================
// Shift delay
// ============================================================

describe('requestShift + stepShiftDelay', () => {
  it('instantaneous shift (shiftTimeS=0) commits gear immediately', () => {
    const shiftState = makeShiftState();
    const accepted = requestShift('up', 1, 7, 5000, shiftState, { shiftTimeS: 0, upshiftMinRpm: 0 });
    expect(accepted).toBe(true);
    expect(shiftState.inProgress).toBe(false);
    // Instantaneous path: targetGearIndex is set but inProgress = false
    expect(shiftState.targetGearIndex).toBe(2);
  });

  it('delayed shift: inProgress=true during delay window', () => {
    const shiftState = makeShiftState();
    requestShift('up', 1, 7, 5000, shiftState, { shiftTimeS: 0.3, upshiftMinRpm: 0 });
    expect(shiftState.inProgress).toBe(true);
    expect(shiftState.targetGearIndex).toBe(2);

    const result = stepShiftDelay({
      shiftState,
      currentGearIndex: 1,
      maxGearIndex: 6,
      dt: 0.1,
      throttleCutFraction: 0.8,
    });
    // Still in window after 0.1 s of a 0.3 s delay
    expect(result.gearJustChanged).toBe(false);
    expect(result.effectiveGearIndex).toBe(1);
    expect(result.throttleScale).toBeCloseTo(0.2, 5); // 1 - 0.8 cut
  });

  it('delayed shift completes after full delay', () => {
    const shiftState = makeShiftState();
    requestShift('up', 1, 7, 5000, shiftState, { shiftTimeS: 0.2, upshiftMinRpm: 0 });

    // Step dt > delay time
    const result = stepShiftDelay({
      shiftState,
      currentGearIndex: 1,
      maxGearIndex: 6,
      dt: 0.25,
      throttleCutFraction: 0.8,
    });
    expect(result.gearJustChanged).toBe(true);
    expect(result.effectiveGearIndex).toBe(2);
    expect(shiftState.inProgress).toBe(false);
  });

  it('refused shift sets lastRefused flag', () => {
    const shiftState = makeShiftState();
    const accepted = requestShift('up', 1, 7, 500, shiftState, { upshiftMinRpm: 2000, shiftTimeS: 0.2 });
    expect(accepted).toBe(false);
    expect(shiftState.lastRefused).toBe(true);
  });

  it('no shift at gear limit', () => {
    const shiftState = makeShiftState();
    const accepted = requestShift('up', 6, 7, 5000, shiftState, {});
    expect(accepted).toBe(false);
  });

  it('no stacking of shifts while inProgress', () => {
    const shiftState = makeShiftState();
    requestShift('up', 1, 7, 5000, shiftState, { shiftTimeS: 0.3 });
    const second = requestShift('up', 1, 7, 5000, shiftState, { shiftTimeS: 0.3 });
    expect(second).toBe(false);
  });

  it('throttle scale is 1 when no shift in progress', () => {
    const shiftState = makeShiftState();
    const result = stepShiftDelay({
      shiftState,
      currentGearIndex: 2,
      maxGearIndex: 6,
      dt: 0.016,
      throttleCutFraction: 0.8,
    });
    expect(result.throttleScale).toBe(1);
    expect(result.gearJustChanged).toBe(false);
  });
});

// ============================================================
// Driveshaft compliance
// ============================================================

describe('stepDrivelineCompliance', () => {
  const stiffParams: DrivelineComplianceParams = {
    shaftStiffnessNmRad: 10000,
    shaftDampingNmSRad: 50,
    backlashRad: 0,
  };

  it('returns zero spring torque for rigid shaft (no params)', () => {
    const state = makeDrivelineComplianceState();
    const r = stepDrivelineCompliance({
      state,
      inputOmega: 100,
      outputOmega: 80,
      params: {},
      dt: 0.01,
    });
    expect(r.springTorqueNm).toBe(0);
  });

  it('positive twist when input > output omega', () => {
    const state = makeDrivelineComplianceState();
    // inputOmega > outputOmega → twist accumulates positively
    const r = stepDrivelineCompliance({
      state,
      inputOmega: 120,
      outputOmega: 100,
      params: stiffParams,
      dt: 0.01,
    });
    // twist = (120-100)*0.01 = 0.2 rad
    // spring = 10000*0.2 + 50*20 = 2000 + 1000 = 3000 Nm
    expect(r.twistRad).toBeCloseTo(0.2, 5);
    expect(r.springTorqueNm).toBeCloseTo(3000, 1);
  });

  it('twist grows with each step when input consistently faster than output', () => {
    const state = makeDrivelineComplianceState();
    let prev = 0;
    for (let i = 0; i < 5; i++) {
      const r = stepDrivelineCompliance({
        state,
        inputOmega: 110,
        outputOmega: 100,
        params: stiffParams,
        dt: 0.01,
      });
      expect(r.twistRad).toBeGreaterThan(prev);
      prev = r.twistRad;
    }
  });

  it('backlash dead-band: no spring torque within ±backlashRad', () => {
    const backlashParams: DrivelineComplianceParams = {
      shaftStiffnessNmRad: 10000,
      shaftDampingNmSRad: 0,
      backlashRad: 0.05,
    };
    const state = makeDrivelineComplianceState();
    // inputOmega slightly above outputOmega → small twist, inside backlash
    const r = stepDrivelineCompliance({
      state,
      inputOmega: 101,
      outputOmega: 100,
      params: backlashParams,
      dt: 0.001, // twist = 0.001 rad < 0.05 backlash → dead-band
    });
    expect(r.springTorqueNm).toBeCloseTo(0, 5);
  });

  it('backlash: spring activates once twist exceeds backlash', () => {
    const backlashParams: DrivelineComplianceParams = {
      shaftStiffnessNmRad: 10000,
      shaftDampingNmSRad: 0,
      backlashRad: 0.05,
    };
    const state = makeDrivelineComplianceState();
    state.twistRad = 0.06; // pre-seed beyond backlash
    const r = stepDrivelineCompliance({
      state,
      inputOmega: 101,
      outputOmega: 100,
      params: backlashParams,
      dt: 0.001,
    });
    // active twist = 0.061 - 0.05 = 0.011 rad
    expect(r.springTorqueNm).toBeGreaterThan(0);
  });

  it('zero twist when omega speeds are equal', () => {
    const state = makeDrivelineComplianceState();
    const r = stepDrivelineCompliance({
      state,
      inputOmega: 100,
      outputOmega: 100,
      params: stiffParams,
      dt: 0.01,
    });
    expect(r.springTorqueNm).toBeCloseTo(0, 5);
    expect(r.twistRad).toBeCloseTo(0, 10);
  });
});

// ============================================================
// Fallback / backward-compat — NA preset still works
// ============================================================
// NOTE: Domain-level validateVehiclePreset M6 field tests live in
// packages/domain/src/shared/racing/validation-m6.test.ts to
// keep the engine test within import-boundary rules.

// ============================================================
// Fallback / backward-compat — NA preset still works
// ============================================================

describe('M6 backward compatibility', () => {
  it('sampleTorqueCurve with undefined falls back to built-in curve', () => {
    // At 5500 rpm the NA curve returns 405 Nm
    expect(sampleTorqueCurve(undefined, 5500)).toBeCloseTo(405, 0);
  });

  it('engineTorqueAtWithMap with NA defaults matches legacy engineTorqueAt', () => {
    const rpm = 4000;
    const legacy = engineTorqueAt(rpm);
    const m6 = engineTorqueAtWithMap(rpm, 0.5, 1.0, undefined, undefined);
    expect(m6).toBeCloseTo(legacy, 5);
  });

  it('engineBrakeTorqueAt default params give plausible drag at redline', () => {
    const redlineOmega = 8400 * (2 * Math.PI / 60);
    const drag = engineBrakeTorqueAt(redlineOmega, 0);
    expect(drag).toBeGreaterThan(10);
    expect(drag).toBeLessThanOrEqual(300); // default cap
  });

  it('shift logic absent → no refusal for any rpm', () => {
    const r = evaluateShiftRequest('up', 0, {});
    expect(r.refused).toBe(false);
  });

  it('compliance absent → zero spring torque', () => {
    const state = makeDrivelineComplianceState();
    const r = stepDrivelineCompliance({
      state,
      inputOmega: 200,
      outputOmega: 100,
      params: {},
      dt: 0.01,
    });
    expect(r.springTorqueNm).toBe(0);
  });
});
