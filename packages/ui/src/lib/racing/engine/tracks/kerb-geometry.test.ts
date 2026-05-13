import { describe, expect, it } from 'bun:test';
import {
  kerbContactAt,
  kerbContactFromLateralOffset,
  DEFAULT_KERB_PROFILE,
  type KerbProfile,
} from './kerb-geometry.js';

const FLAT_PROFILE: KerbProfile = {
  widthM: 0.5,
  crownHeightM: 0.04,
  topFlatFraction: 0.0,
  bumpForceN: 800,
};

const SAUSAGE_PROFILE: KerbProfile = {
  widthM: 0.6,
  crownHeightM: 0.06,
  topFlatFraction: 0.5,
  bumpForceN: 1200,
};

const SMOOTH_PROFILE: KerbProfile = {
  widthM: 0.5,
  crownHeightM: 0.04,
  topFlatFraction: 0.0,
  bumpForceN: 0,
};

describe('kerbContactAt', () => {
  it('returns null when outside the kerb strip (negative offset)', () => {
    expect(kerbContactAt(FLAT_PROFILE, -0.1)).toBeNull();
  });

  it('returns null when beyond the outer edge', () => {
    expect(kerbContactAt(FLAT_PROFILE, 0.6)).toBeNull();
  });

  it('returns groundY = 0 at the inboard edge', () => {
    const c = kerbContactAt(FLAT_PROFILE, 0);
    expect(c).not.toBeNull();
    expect(c!.groundY).toBeCloseTo(0, 5);
  });

  it('returns peak height at mid-point (triangle ramp crown)', () => {
    const c = kerbContactAt(FLAT_PROFILE, FLAT_PROFILE.widthM * 0.5);
    expect(c).not.toBeNull();
    expect(c!.groundY).toBeCloseTo(FLAT_PROFILE.crownHeightM, 4);
  });

  it('returns groundY = 0 at the outboard edge (complete descent)', () => {
    const c = kerbContactAt(FLAT_PROFILE, FLAT_PROFILE.widthM);
    expect(c).not.toBeNull();
    expect(c!.groundY).toBeCloseTo(0, 4);
  });

  it('bumpImpulseN is zero when bumpForceN = 0 (smooth kerb)', () => {
    const c = kerbContactAt(SMOOTH_PROFILE, SMOOTH_PROFILE.widthM * 0.5);
    expect(c!.bumpImpulseN).toBe(0);
  });

  it('bump impulse is bounded by bumpForceN', () => {
    const c = kerbContactAt(FLAT_PROFILE, FLAT_PROFILE.widthM * 0.5);
    expect(c!.bumpImpulseN).toBeLessThanOrEqual(FLAT_PROFILE.bumpForceN);
    expect(c!.bumpImpulseN).toBeGreaterThan(0);
  });

  it('sausage kerb has flat plateau at full height', () => {
    const midLeft = kerbContactAt(SAUSAGE_PROFILE, SAUSAGE_PROFILE.widthM * 0.35);
    const centre = kerbContactAt(SAUSAGE_PROFILE, SAUSAGE_PROFILE.widthM * 0.5);
    const midRight = kerbContactAt(SAUSAGE_PROFILE, SAUSAGE_PROFILE.widthM * 0.65);
    expect(midLeft!.groundY).toBeCloseTo(SAUSAGE_PROFILE.crownHeightM, 4);
    expect(centre!.groundY).toBeCloseTo(SAUSAGE_PROFILE.crownHeightM, 4);
    expect(midRight!.groundY).toBeCloseTo(SAUSAGE_PROFILE.crownHeightM, 4);
  });

  it('lateral penetration is 0 at inboard and 1 at outboard', () => {
    const inboard = kerbContactAt(FLAT_PROFILE, 0)!;
    const outboard = kerbContactAt(FLAT_PROFILE, FLAT_PROFILE.widthM)!;
    expect(inboard.lateralPenetration).toBeCloseTo(0, 5);
    expect(outboard.lateralPenetration).toBeCloseTo(1, 5);
  });
});

describe('kerbContactFromLateralOffset', () => {
  it('returns null when the wheel is on asphalt (inside halfWidth)', () => {
    expect(kerbContactFromLateralOffset(5, 7, FLAT_PROFILE)).toBeNull();
  });

  it('returns null when the wheel is outside the kerb strip', () => {
    // halfWidth = 7, kerbWidth = 0.5, so kerb ends at 7.5
    expect(kerbContactFromLateralOffset(8.0, 7, FLAT_PROFILE)).toBeNull();
  });

  it('returns non-null when the wheel is in the kerb strip', () => {
    // halfWidth = 7, kerb at 7.25 (0.25 m inside the 0.5 m kerb)
    const c = kerbContactFromLateralOffset(7.25, 7, FLAT_PROFILE);
    expect(c).not.toBeNull();
  });

  it('works symmetrically for negative offset (left kerb)', () => {
    const left = kerbContactFromLateralOffset(-7.25, 7, FLAT_PROFILE);
    const right = kerbContactFromLateralOffset(7.25, 7, FLAT_PROFILE);
    expect(left).not.toBeNull();
    expect(left!.groundY).toBeCloseTo(right!.groundY, 5);
  });

  it('DEFAULT_KERB_PROFILE is consistent with kerbContactAt', () => {
    const c = kerbContactAt(DEFAULT_KERB_PROFILE, DEFAULT_KERB_PROFILE.widthM * 0.5);
    expect(c!.bumpImpulseN).toBeCloseTo(DEFAULT_KERB_PROFILE.bumpForceN, 1);
  });
});

describe('bump impulse bounds', () => {
  it('impulse never exceeds bumpForceN for any penetration depth', () => {
    for (let d = 0; d <= FLAT_PROFILE.widthM; d += 0.01) {
      const c = kerbContactAt(FLAT_PROFILE, d);
      if (c) {
        expect(c.bumpImpulseN).toBeLessThanOrEqual(FLAT_PROFILE.bumpForceN + 1e-9);
        expect(c.bumpImpulseN).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
