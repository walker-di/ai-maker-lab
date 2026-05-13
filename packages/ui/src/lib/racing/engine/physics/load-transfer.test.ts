/**
 * Phase 7 helper coverage for the rigid-body load-transfer module.
 *
 * `computeLongitudinalLoadTransfer` already has scenario-style coverage in
 * `contributors.test.ts`. This file focuses on the lateral helper, the
 * sprung/unsprung split, and the front-roll-stiffness-share derivation.
 *
 * Conventions used by these tests match the engine telemetry conventions in
 * `RacingEngine.ts`:
 *   - `accelLatMs2 < 0` represents a left-turn lateral acceleration; load
 *     shifts to the chassis-right (outside) wheels, so `delta > 0`.
 *   - `accelLatMs2 > 0` represents a right-turn lateral acceleration; load
 *     shifts to the chassis-left (outside) wheels, so `delta < 0`.
 */

import { describe, expect, it } from 'bun:test';
import {
  computeFrontRollStiffnessShare,
  computeLateralLoadTransfer,
  computeLongitudinalLoadTransfer,
} from './index.js';

const TRACK_WIDTH_M = 1.6;
const SPRUNG_MASS_KG = 1100;
const UNSPRUNG_FRONT_KG = 50;
const UNSPRUNG_REAR_KG = 50;
const SPRUNG_CG_M = 0.55;
const UNSPRUNG_CG_M = 0.32;

function makeLateralInput(
  accelLatMs2: number,
  overrides: Partial<Parameters<typeof computeLateralLoadTransfer>[0]> = {},
) {
  return {
    accelLatMs2,
    sprungMassKg: SPRUNG_MASS_KG,
    unsprungMassKgFront: UNSPRUNG_FRONT_KG,
    unsprungMassKgRear: UNSPRUNG_REAR_KG,
    sprungCgHeightM: SPRUNG_CG_M,
    unsprungCgHeightM: UNSPRUNG_CG_M,
    trackWidthM: TRACK_WIDTH_M,
    frontRollStiffnessShare: 0.5,
    ...overrides,
  };
}

describe('computeLongitudinalLoadTransfer (re-export)', () => {
  it('still resolves through the load-transfer barrel', () => {
    const dFz = computeLongitudinalLoadTransfer({
      longitudinalAccelMs2: 9.81,
      massKg: 1240,
      cgHeightM: 0.5,
      wheelbaseM: 2.6,
    });
    expect(dFz).toBeGreaterThan(0);
    expect(dFz).toBeCloseTo(2339, 0);
  });
});

describe('computeLateralLoadTransfer', () => {
  it('returns zero deltas for invalid track width', () => {
    const r = computeLateralLoadTransfer(makeLateralInput(8, { trackWidthM: 0 }));
    expect(r.frontDelta).toBe(0);
    expect(r.rearDelta).toBe(0);
  });

  it('returns zero deltas at zero lateral acceleration', () => {
    const r = computeLateralLoadTransfer(makeLateralInput(0));
    expect(r.frontDelta).toBe(0);
    expect(r.rearDelta).toBe(0);
  });

  it('shifts load to the chassis-right wheels under a left turn (accelLat < 0)', () => {
    const r = computeLateralLoadTransfer(makeLateralInput(-9));
    expect(r.frontDelta).toBeGreaterThan(0);
    expect(r.rearDelta).toBeGreaterThan(0);
  });

  it('shifts load to the chassis-left wheels under a right turn (accelLat > 0)', () => {
    const r = computeLateralLoadTransfer(makeLateralInput(9));
    expect(r.frontDelta).toBeLessThan(0);
    expect(r.rearDelta).toBeLessThan(0);
  });

  it('left and right turns produce mirrored deltas of equal magnitude', () => {
    const left = computeLateralLoadTransfer(makeLateralInput(-9));
    const right = computeLateralLoadTransfer(makeLateralInput(9));
    expect(left.frontDelta).toBeCloseTo(-right.frontDelta, 8);
    expect(left.rearDelta).toBeCloseTo(-right.rearDelta, 8);
  });

  it('total delta magnitude follows m * a * h / track within tolerance', () => {
    const accel = -9.5;
    const r = computeLateralLoadTransfer(makeLateralInput(accel));
    const sprungTotal = -(SPRUNG_MASS_KG * accel * SPRUNG_CG_M) / TRACK_WIDTH_M;
    const unsprungTotal =
      -((UNSPRUNG_FRONT_KG + UNSPRUNG_REAR_KG) * accel * UNSPRUNG_CG_M) / TRACK_WIDTH_M;
    expect(r.frontDelta + r.rearDelta).toBeCloseTo(sprungTotal + unsprungTotal, 6);
  });

  it('honours the front roll stiffness share for the sprung-mass portion', () => {
    const accel = -8;
    const evenSplit = computeLateralLoadTransfer(makeLateralInput(accel, { frontRollStiffnessShare: 0.5 }));
    const frontStiff = computeLateralLoadTransfer(makeLateralInput(accel, { frontRollStiffnessShare: 0.7 }));
    const rearStiff = computeLateralLoadTransfer(makeLateralInput(accel, { frontRollStiffnessShare: 0.3 }));

    expect(frontStiff.frontDelta).toBeGreaterThan(evenSplit.frontDelta);
    expect(frontStiff.rearDelta).toBeLessThan(evenSplit.rearDelta);
    expect(rearStiff.frontDelta).toBeLessThan(evenSplit.frontDelta);
    expect(rearStiff.rearDelta).toBeGreaterThan(evenSplit.rearDelta);

    // The sum stays the same because changing the roll share only redistributes
    // sprung-mass transfer between axles; the unsprung component stays put.
    expect(frontStiff.frontDelta + frontStiff.rearDelta).toBeCloseTo(
      evenSplit.frontDelta + evenSplit.rearDelta,
      6,
    );
  });

  it('zero unsprung mass collapses the result onto the sprung-mass term only', () => {
    const accel = -8;
    const r = computeLateralLoadTransfer(makeLateralInput(accel, {
      unsprungMassKgFront: 0,
      unsprungMassKgRear: 0,
    }));
    const sprungTotal = -(SPRUNG_MASS_KG * accel * SPRUNG_CG_M) / TRACK_WIDTH_M;
    expect(r.frontDelta + r.rearDelta).toBeCloseTo(sprungTotal, 6);
  });

  it('isolates unsprung mass on its own axle independent of the roll share', () => {
    const accel = -8;
    const noSprung = computeLateralLoadTransfer(makeLateralInput(accel, {
      sprungMassKg: 0,
      frontRollStiffnessShare: 0.7,
    }));
    const noSprungEven = computeLateralLoadTransfer(makeLateralInput(accel, {
      sprungMassKg: 0,
      frontRollStiffnessShare: 0.5,
    }));
    expect(noSprung.frontDelta).toBeCloseTo(noSprungEven.frontDelta, 8);
    expect(noSprung.rearDelta).toBeCloseTo(noSprungEven.rearDelta, 8);
  });

  it('scales linearly with sprung CG height', () => {
    const accel = -8;
    const base = computeLateralLoadTransfer(makeLateralInput(accel, { sprungCgHeightM: 0.4 }));
    const tall = computeLateralLoadTransfer(makeLateralInput(accel, { sprungCgHeightM: 0.8 }));
    // Lateral transfer is linear in cg height for the sprung-mass term.
    // Subtract the (constant) unsprung contribution before comparing.
    const baseSprung = base.frontDelta + base.rearDelta -
      -((UNSPRUNG_FRONT_KG + UNSPRUNG_REAR_KG) * accel * UNSPRUNG_CG_M) / TRACK_WIDTH_M;
    const tallSprung = tall.frontDelta + tall.rearDelta -
      -((UNSPRUNG_FRONT_KG + UNSPRUNG_REAR_KG) * accel * UNSPRUNG_CG_M) / TRACK_WIDTH_M;
    expect(tallSprung).toBeCloseTo(baseSprung * 2, 6);
  });
});

describe('computeFrontRollStiffnessShare', () => {
  const baseInput = {
    springFrontNpm: 65000,
    springRearNpm: 60000,
    arbFrontNpm: 25000,
    arbRearNpm: 22000,
    motionRatioFront: 1,
    motionRatioRear: 1,
    trackWidthM: TRACK_WIDTH_M,
  };

  it('returns NaN for invalid track width or zero stiffness so callers can fall back', () => {
    expect(computeFrontRollStiffnessShare({ ...baseInput, trackWidthM: 0 })).toBeNaN();
    expect(
      computeFrontRollStiffnessShare({
        ...baseInput,
        springFrontNpm: 0,
        springRearNpm: 0,
        arbFrontNpm: 0,
        arbRearNpm: 0,
      }),
    ).toBeNaN();
  });

  it('symmetric springs and ARBs land at 0.5 share', () => {
    const share = computeFrontRollStiffnessShare({
      ...baseInput,
      springFrontNpm: 60000,
      springRearNpm: 60000,
      arbFrontNpm: 22000,
      arbRearNpm: 22000,
    });
    expect(share).toBeCloseTo(0.5, 6);
  });

  it('stiffer front bar pushes the share above 0.5 (more understeer)', () => {
    const baseline = computeFrontRollStiffnessShare(baseInput);
    const stiffer = computeFrontRollStiffnessShare({ ...baseInput, arbFrontNpm: 60000 });
    expect(stiffer).toBeGreaterThan(baseline);
  });

  it('stiffer rear bar pushes the share below 0.5 (more oversteer)', () => {
    const baseline = computeFrontRollStiffnessShare(baseInput);
    const stiffer = computeFrontRollStiffnessShare({ ...baseInput, arbRearNpm: 60000 });
    expect(stiffer).toBeLessThan(baseline);
  });

  it('motion ratio enters quadratically: halving the front MR roughly halves the front roll rate', () => {
    const full = computeFrontRollStiffnessShare(baseInput);
    const halfFront = computeFrontRollStiffnessShare({ ...baseInput, motionRatioFront: 0.5 });
    expect(halfFront).toBeLessThan(full);
  });

  it('clamps to (0.05, 0.95) for pathological inputs', () => {
    const allFront = computeFrontRollStiffnessShare({
      ...baseInput,
      springRearNpm: 0,
      arbRearNpm: 0,
    });
    const allRear = computeFrontRollStiffnessShare({
      ...baseInput,
      springFrontNpm: 0,
      arbFrontNpm: 0,
    });
    expect(allFront).toBeLessThanOrEqual(0.95);
    expect(allFront).toBeGreaterThan(0.5);
    expect(allRear).toBeGreaterThanOrEqual(0.05);
    expect(allRear).toBeLessThan(0.5);
  });
});
