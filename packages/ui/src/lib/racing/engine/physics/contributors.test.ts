import { describe, expect, it } from 'bun:test';
import {
  applyAbs,
  applyDiffCoupling,
  brakeFadeFactor,
  classifyEsc,
  computeAeroDrag,
  computeAntiPitchVertical,
  computeAxleArb,
  computeCamberThrust,
  computeClutchTorque,
  computeSelfAligningMoment,
  computeTcCut,
  computeYawRestoringMoment,
  stepBrakeTemperature,
  stepEngineOmega,
  stepTireTemperature,
  tireTempMu,
  BRAKE_FADE_T0,
  BRAKE_FADE_T1,
  TIRE_AMBIENT_C,
} from './index.js';

const DEG = Math.PI / 180;

describe('camber thrust', () => {
  it('cancels symmetrically at zero roll with negative camber', () => {
    const left = computeCamberThrust({
      staticCamberRad: -2.5 * DEG,
      rollRad: 0,
      camberGain: 0.4,
      casterCamberRad: 0,
      lateralSign: -1,
      fz: 3500,
    });
    const right = computeCamberThrust({
      staticCamberRad: -2.5 * DEG,
      rollRad: 0,
      camberGain: 0.4,
      casterCamberRad: 0,
      lateralSign: 1,
      fz: 3500,
    });
    expect(left.thrust + right.thrust).toBeCloseTo(0, 6);
  });

  it('roll camber pushes the outside wheel toward chassis centre', () => {
    // rollRad > 0 means the +X side of the chassis dips. Outside wheel = +X
    // side; we expect MORE negative camber there.
    const outsideRoll = computeCamberThrust({
      staticCamberRad: 0,
      rollRad: 5 * DEG,
      camberGain: 0.6,
      casterCamberRad: 0,
      lateralSign: 1,
      fz: 4000,
    });
    expect(outsideRoll.camberRad).toBeLessThan(0);
  });
});

describe('axle ARB', () => {
  it('zeroes when one wheel is airborne', () => {
    const r = computeAxleArb({
      arbStiffness: 25000,
      motionRatio: 1,
      leftCompression: 0.05,
      rightCompression: 0.0,
      leftInContact: true,
      rightInContact: false,
    });
    expect(r.leftDfz).toBe(0);
    expect(r.rightDfz).toBe(0);
  });

  it('transfers load from the more-compressed to the less-compressed wheel', () => {
    const r = computeAxleArb({
      arbStiffness: 25000,
      motionRatio: 1,
      leftCompression: 0.06,
      rightCompression: 0.02,
      leftInContact: true,
      rightInContact: true,
    });
    expect(r.leftDfz).toBeLessThan(0);
    expect(r.rightDfz).toBeGreaterThan(0);
    expect(r.leftDfz + r.rightDfz).toBeCloseTo(0, 6);
  });
});

describe('anti-dive / anti-squat', () => {
  it('lifts the front under braking', () => {
    expect(
      computeAntiPitchVertical({ axle: 'front', fxAtContact: -2000, pct: 0.2 }),
    ).toBeGreaterThan(0);
  });
  it('lifts the rear under throttle', () => {
    expect(
      computeAntiPitchVertical({ axle: 'rear', fxAtContact: 1500, pct: 0.15 }),
    ).toBeGreaterThan(0);
  });
  it('does nothing for the wrong combination', () => {
    expect(
      computeAntiPitchVertical({ axle: 'front', fxAtContact: 1500, pct: 0.2 }),
    ).toBe(0);
    expect(
      computeAntiPitchVertical({ axle: 'rear', fxAtContact: -2000, pct: 0.15 }),
    ).toBe(0);
  });
});

describe('brake fade', () => {
  it('returns 1 below fade onset', () => {
    expect(brakeFadeFactor({ brakeTempC: BRAKE_FADE_T0 - 50 })).toBeCloseTo(1, 6);
  });
  it('drops to 0.5 at full fade', () => {
    expect(brakeFadeFactor({ brakeTempC: BRAKE_FADE_T1 })).toBeCloseTo(0.5, 6);
  });
  it('clamps below 0.5 past full fade', () => {
    expect(brakeFadeFactor({ brakeTempC: 800 })).toBeCloseTo(0.5, 6);
  });
});

describe('aero', () => {
  it('drag opposes motion', () => {
    const r = computeAeroDrag({ forwardSpeed: 50, sideSpeed: 0, cdArea: 0.7 });
    expect(r.fzDragWS).toBeLessThan(0);
    expect(r.fxDragWS).toBe(0);
  });
  it('yaw drag amplifies side component', () => {
    const r = computeAeroDrag({ forwardSpeed: 30, sideSpeed: 5, cdArea: 0.7, yawDragGain: 1.6 });
    expect(Math.abs(r.fxDragWS)).toBeGreaterThan(0);
  });
  it('yaw moment restores nose toward airflow (sideslip > 0 → moment < 0)', () => {
    expect(computeYawRestoringMoment({ sideslipRad: 10 * DEG, speed: 50 })).toBeLessThan(0);
    expect(computeYawRestoringMoment({ sideslipRad: -10 * DEG, speed: 50 })).toBeGreaterThan(0);
  });
});

describe('self-aligning moment', () => {
  it('decays to near-zero past the trail decay angle', () => {
    const peak = Math.abs(computeSelfAligningMoment({ slipAngleRad: 5 * DEG, fySlip: 4000 }));
    const past = Math.abs(computeSelfAligningMoment({ slipAngleRad: 30 * DEG, fySlip: 4000 }));
    expect(past).toBeLessThan(peak * 0.2);
  });
});

describe('drivetrain', () => {
  it('clutch torque saturates at clutchMaxTorque', () => {
    const r = computeClutchTorque({
      engineOmega: 200,
      wheelEngineOmega: 50,
      clutchStiffness: 1000,
      clutchMaxTorque: 600,
    });
    expect(r.clutchTorque).toBeCloseTo(600, 6);
  });

  it('welded diff averages both wheels exactly', () => {
    const r = applyDiffCoupling({
      type: 'welded',
      leftOmega: 100,
      rightOmega: 60,
      leftInertia: 1.5,
      effectiveThrottle: 0.5,
      driveTorquePerWheel: 200,
      preloadNm: 60,
      capacityNm: 1200,
      powerLockPct: 0.5,
      coastLockPct: 0.2,
      dt: 1 / 240,
    });
    expect(r.leftOmega).toBeCloseTo(80, 6);
    expect(r.rightOmega).toBeCloseTo(80, 6);
  });

  it('open diff leaves wheels untouched', () => {
    const r = applyDiffCoupling({
      type: 'open',
      leftOmega: 100,
      rightOmega: 60,
      leftInertia: 1.5,
      effectiveThrottle: 0.5,
      driveTorquePerWheel: 200,
      preloadNm: 60,
      capacityNm: 1200,
      powerLockPct: 0.5,
      coastLockPct: 0.2,
      dt: 1 / 240,
    });
    expect(r.leftOmega).toBe(100);
    expect(r.rightOmega).toBe(60);
  });

  it('clutchLSD pulls wheels toward axle average without locking them', () => {
    const r = applyDiffCoupling({
      type: 'clutchLSD',
      leftOmega: 100,
      rightOmega: 60,
      leftInertia: 1.5,
      effectiveThrottle: 0.6,
      driveTorquePerWheel: 200,
      preloadNm: 60,
      capacityNm: 1200,
      powerLockPct: 0.5,
      coastLockPct: 0.2,
      dt: 1 / 240,
    });
    expect(r.leftOmega).toBeLessThan(100);
    expect(r.rightOmega).toBeGreaterThan(60);
    // Neither should equal the average — partial coupling only.
    expect(Math.abs(r.leftOmega - r.rightOmega)).toBeGreaterThan(0.1);
  });

  it('engine omega clamps at idle and redline', () => {
    const idleOmega = 1100 * (2 * Math.PI / 60);
    const redlineOmega = 9000 * (2 * Math.PI / 60);
    const tooLow = stepEngineOmega({
      engineOmega: idleOmega - 50,
      engineDriveTorque: 0,
      engineDragTorque: 0,
      clutchTorque: 0,
      engineInertia: 0.18,
      idleOmega,
      redlineOmega,
      dt: 1 / 240,
    });
    expect(tooLow).toBeGreaterThanOrEqual(idleOmega);
    const tooHigh = stepEngineOmega({
      engineOmega: redlineOmega + 50,
      engineDriveTorque: 0,
      engineDragTorque: 0,
      clutchTorque: 0,
      engineInertia: 0.18,
      idleOmega,
      redlineOmega,
      dt: 1 / 240,
    });
    expect(tooHigh).toBeLessThanOrEqual(redlineOmega);
  });
});

describe('driver aids', () => {
  it('ABS releases when slip is past threshold and brake is on', () => {
    const r = applyAbs({
      enabled: true,
      driverBrake: 1,
      vx: 25,
      slipRatio: -0.5,
      threshold: 0.18,
      release: 0,
      releaseTime: 0.05,
      dt: 1 / 240,
    });
    expect(r.active).toBe(true);
    expect(r.scale).toBeLessThan(1);
  });
  it('ABS stays off below speed threshold', () => {
    const r = applyAbs({
      enabled: true,
      driverBrake: 1,
      vx: 1,
      slipRatio: -0.5,
      threshold: 0.18,
      release: 0,
      releaseTime: 0.05,
      dt: 1 / 240,
    });
    expect(r.active).toBe(false);
  });
  it('TC cuts throttle proportionally past threshold', () => {
    const r = computeTcCut({
      enabled: true,
      driverThrottle: 1,
      speedKmh: 30,
      maxDriveSlip: 0.25,
      threshold: 0.12,
      window: 0.18,
    });
    expect(r.cut).toBeGreaterThan(0);
    expect(r.cut).toBeLessThanOrEqual(0.88);
  });
  it('ESC classifies oversteer when yaw error matches turn direction', () => {
    const r = classifyEsc({
      enabled: true,
      speedKmh: 80,
      steerSmoothed: 0.5,
      absLocalVz: 22,
      yawRateRad: 1.0,
      desiredYawRad: 0.5,
      sideslipDeg: 10,
      oversteerThreshold: 0.2,
      understeerThreshold: 0.2,
      minSpeedKmh: 30,
    });
    expect(r.active).toBe(true);
    expect(r.mode).toBe('oversteer');
  });
});

describe('tire thermal', () => {
  it('mu peaks at the optimal window', () => {
    expect(tireTempMu(90)).toBeCloseTo(1, 6);
    expect(tireTempMu(30)).toBeLessThan(tireTempMu(80));
    expect(tireTempMu(180)).toBeLessThan(tireTempMu(120));
  });

  it('sliding work raises temp relative to no slide', () => {
    let withSlide = 60;
    let noSlide = 60;
    for (let i = 0; i < 200; i++) {
      withSlide = stepTireTemperature({
        tempC: withSlide,
        slidePower: 5e5,
        contactSpeed: 5,
        dt: 0.05,
      });
      noSlide = stepTireTemperature({
        tempC: noSlide,
        slidePower: 0,
        contactSpeed: 5,
        dt: 0.05,
      });
    }
    expect(withSlide).toBeGreaterThan(noSlide);
  });

  it('cools toward ambient when sliding stops', () => {
    let temp = 90;
    for (let i = 0; i < 600; i++) {
      temp = stepTireTemperature({ tempC: temp, slidePower: 0, contactSpeed: 30, dt: 0.05 });
    }
    expect(temp).toBeLessThan(60);
    expect(temp).toBeGreaterThanOrEqual(TIRE_AMBIENT_C);
  });
});

describe('brake thermal', () => {
  it('brake work raises temp relative to off-pedal', () => {
    let onBrake = 60;
    let offBrake = 60;
    for (let i = 0; i < 200; i++) {
      onBrake = stepBrakeTemperature({
        brakeTempC: onBrake,
        brakeTorque: 4200,
        omega: 100,
        contactSpeed: 5,
        dt: 0.05,
      });
      offBrake = stepBrakeTemperature({
        brakeTempC: offBrake,
        brakeTorque: 0,
        omega: 0,
        contactSpeed: 5,
        dt: 0.05,
      });
    }
    expect(onBrake).toBeGreaterThan(offBrake);
  });

  it('cools toward ambient when off-pedal', () => {
    let temp = 200;
    for (let i = 0; i < 1200; i++) {
      temp = stepBrakeTemperature({
        brakeTempC: temp,
        brakeTorque: 0,
        omega: 0,
        contactSpeed: 30,
        dt: 0.05,
      });
    }
    expect(temp).toBeLessThan(60);
  });
});
