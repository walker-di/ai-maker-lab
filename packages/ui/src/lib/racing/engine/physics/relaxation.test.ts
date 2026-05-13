import { describe, expect, it } from 'bun:test';
import { computeWheelSlipTargets, stepRelaxedSlip } from './index.js';

describe('computeWheelSlipTargets', () => {
  it('returns zero slip when wheel rolls freely with no lateral velocity', () => {
    const r = computeWheelSlipTargets({
      longitudinalSpeed: 20,
      lateralSpeed: 0,
      wheelAngularSpeed: 20 / 0.34,
      wheelRadius: 0.34,
    });
    expect(r.slipRatio).toBeCloseTo(0, 6);
    expect(r.slipAngleRad).toBeCloseTo(0, 8);
    expect(r.contactSpeed).toBeCloseTo(20, 6);
    expect(r.wheelSurfaceSpeed).toBeCloseTo(20, 6);
  });

  it('slip ratio is positive under drive (omega*r > vx) and negative under brake', () => {
    const drive = computeWheelSlipTargets({
      longitudinalSpeed: 18,
      lateralSpeed: 0,
      wheelAngularSpeed: 22 / 0.34,
      wheelRadius: 0.34,
    });
    const brake = computeWheelSlipTargets({
      longitudinalSpeed: 22,
      lateralSpeed: 0,
      wheelAngularSpeed: 18 / 0.34,
      wheelRadius: 0.34,
    });
    expect(drive.slipRatio).toBeGreaterThan(0);
    expect(brake.slipRatio).toBeLessThan(0);
    expect(drive.slipRatio).toBeCloseTo(-brake.slipRatio, 8);
  });

  it('slip angle flips sign with lateral velocity sign', () => {
    const right = computeWheelSlipTargets({
      longitudinalSpeed: 20,
      lateralSpeed: 2,
      wheelAngularSpeed: 20 / 0.34,
      wheelRadius: 0.34,
    });
    const left = computeWheelSlipTargets({
      longitudinalSpeed: 20,
      lateralSpeed: -2,
      wheelAngularSpeed: 20 / 0.34,
      wheelRadius: 0.34,
    });
    expect(right.slipAngleRad).toBeLessThan(0);
    expect(left.slipAngleRad).toBeGreaterThan(0);
    expect(right.slipAngleRad).toBeCloseTo(-left.slipAngleRad, 8);
  });

  it('does NOT clamp low-speed longitudinal input the way the legacy 1.5 m/s helper did', () => {
    // Legacy `computeSlipAngleRad` reported the same angle for vx=0.2 and
    // vx=1.5 because of the `1.5` clamp. The new helper must distinguish
    // them so low-speed transitions are smooth instead of cliffed.
    const slow = computeWheelSlipTargets({
      longitudinalSpeed: 0.2,
      lateralSpeed: 2,
      wheelAngularSpeed: 0,
      wheelRadius: 0.34,
    });
    const oneFive = computeWheelSlipTargets({
      longitudinalSpeed: 1.5,
      lateralSpeed: 2,
      wheelAngularSpeed: 0,
      wheelRadius: 0.34,
    });
    expect(Math.abs(slow.slipAngleRad)).toBeGreaterThan(Math.abs(oneFive.slipAngleRad));
  });

  it('returns finite, signed targets at exact standstill (no NaN)', () => {
    const r = computeWheelSlipTargets({
      longitudinalSpeed: 0,
      lateralSpeed: 0,
      wheelAngularSpeed: 0,
      wheelRadius: 0.34,
    });
    expect(Number.isFinite(r.slipRatio)).toBe(true);
    expect(Number.isFinite(r.slipAngleRad)).toBe(true);
    expect(r.slipRatio).toBe(0);
    expect(r.slipAngleRad).toBeCloseTo(0, 8);
    expect(r.contactSpeed).toBe(0);
  });

  it('reverse rolling produces a finite, signed slip ratio', () => {
    // Both vx and omega negative, same magnitude -> rolling backwards
    // smoothly. Slip ratio should be ~0 in that case.
    const r = computeWheelSlipTargets({
      longitudinalSpeed: -8,
      lateralSpeed: 0,
      wheelAngularSpeed: -8 / 0.34,
      wheelRadius: 0.34,
    });
    expect(Number.isFinite(r.slipRatio)).toBe(true);
    expect(r.slipRatio).toBeCloseTo(0, 6);
  });

  it('returns hypot contact speed for tire-thermal / relaxation context', () => {
    const r = computeWheelSlipTargets({
      longitudinalSpeed: 12,
      lateralSpeed: 5,
      wheelAngularSpeed: 12 / 0.34,
      wheelRadius: 0.34,
    });
    expect(r.contactSpeed).toBeCloseTo(13, 6);
  });
});

describe('stepRelaxedSlip', () => {
  it('reaches 1 - 1/e of a step input after one relaxation length of travel', () => {
    const sigma = 0.5;
    const v = 25;
    const dt = sigma / v; // travel of exactly one sigma in one step
    const next = stepRelaxedSlip({
      slipTarget: 1,
      slipDynamic: 0,
      contactSpeed: v,
      relaxationLength: sigma,
      dt,
    });
    const expected = 1 - Math.exp(-1);
    expect(next).toBeCloseTo(expected, 6);
  });

  it('approaches the target monotonically without overshoot', () => {
    let dynamic = 0;
    const samples: number[] = [];
    for (let i = 0; i < 200; i++) {
      dynamic = stepRelaxedSlip({
        slipTarget: 0.2,
        slipDynamic: dynamic,
        contactSpeed: 20,
        relaxationLength: 0.5,
        dt: 1 / 240,
      });
      samples.push(dynamic);
    }
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i]).toBeGreaterThanOrEqual(samples[i - 1]);
      expect(samples[i]).toBeLessThanOrEqual(0.2 + 1e-9);
    }
    expect(samples[samples.length - 1]).toBeCloseTo(0.2, 4);
  });

  it('returns the slip target immediately when relaxation length is non-positive', () => {
    expect(
      stepRelaxedSlip({
        slipTarget: 0.3,
        slipDynamic: 0,
        contactSpeed: 10,
        relaxationLength: 0,
        dt: 1 / 240,
      }),
    ).toBe(0.3);
    expect(
      stepRelaxedSlip({
        slipTarget: 0.3,
        slipDynamic: 0,
        contactSpeed: 10,
        relaxationLength: -1,
        dt: 1 / 240,
      }),
    ).toBe(0.3);
  });

  it('holds the dynamic value when dt is zero', () => {
    expect(
      stepRelaxedSlip({
        slipTarget: 1,
        slipDynamic: 0.4,
        contactSpeed: 25,
        relaxationLength: 0.5,
        dt: 0,
      }),
    ).toBe(0.4);
  });

  it('holds the dynamic value at standstill so slip cannot evolve without travel', () => {
    expect(
      stepRelaxedSlip({
        slipTarget: 1,
        slipDynamic: 0.4,
        contactSpeed: 0,
        relaxationLength: 0.5,
        dt: 1 / 240,
      }),
    ).toBe(0.4);
  });

  it('responds faster at higher speed for the same dt and sigma', () => {
    const slow = stepRelaxedSlip({
      slipTarget: 1,
      slipDynamic: 0,
      contactSpeed: 5,
      relaxationLength: 0.5,
      dt: 1 / 240,
    });
    const fast = stepRelaxedSlip({
      slipTarget: 1,
      slipDynamic: 0,
      contactSpeed: 50,
      relaxationLength: 0.5,
      dt: 1 / 240,
    });
    expect(fast).toBeGreaterThan(slow);
  });

  it('guards NaN inputs without poisoning the dynamic slip', () => {
    expect(
      stepRelaxedSlip({
        slipTarget: Number.NaN,
        slipDynamic: 0.1,
        contactSpeed: 20,
        relaxationLength: 0.5,
        dt: 1 / 240,
      }),
    ).toBe(0);
    expect(
      stepRelaxedSlip({
        slipTarget: 0.2,
        slipDynamic: 0.1,
        contactSpeed: Number.NaN,
        relaxationLength: 0.5,
        dt: 1 / 240,
      }),
    ).toBe(0.1);
  });
});
