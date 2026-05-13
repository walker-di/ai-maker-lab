import { describe, expect, it } from 'bun:test';
import {
  applyAbs,
  applyLowSpeedWheelRotationLock,
  applySalisburyDiff,
  brakeFadeFactor,
  classifyEsc,
  computeAeroDownforce,
  computeAeroDrag,
  computeAligningMoment,
  computeEscBrakeTargets,
  computeAntiPitchVertical,
  computeAxleArb,
  computeCamberThrust,
  computeSelfAligningMoment,
  computeTcCut,
  computeYawRestoringMoment,
  stepBrakeTemperature,
  stepDrivetrain,
  stepTireTemperature,
  tireTempMu,
  BRAKE_FADE_T0,
  BRAKE_FADE_T1,
  TIRE_AMBIENT_C,
  type DrivetrainParams,
  type DrivetrainStepInput,
  type DrivetrainWheelInput,
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

  it('downforce is zero at zero speed', () => {
    const r = computeAeroDownforce({ forwardSpeed: 0, clAreaFront: 1.5, clAreaRear: 2 });
    expect(r.frontDownforceN).toBe(0);
    expect(r.rearDownforceN).toBe(0);
  });

  it('downforce scales with speed squared', () => {
    const slow = computeAeroDownforce({ forwardSpeed: 20, clAreaFront: 1.2, clAreaRear: 1.6 });
    const fast = computeAeroDownforce({ forwardSpeed: 40, clAreaFront: 1.2, clAreaRear: 1.6 });
    // Doubling speed gives 4x downforce.
    expect(fast.frontDownforceN).toBeCloseTo(slow.frontDownforceN * 4, 5);
    expect(fast.rearDownforceN).toBeCloseTo(slow.rearDownforceN * 4, 5);
  });

  it('downforce respects per-axle clArea split', () => {
    const r = computeAeroDownforce({ forwardSpeed: 60, clAreaFront: 1, clAreaRear: 3 });
    expect(r.rearDownforceN).toBeCloseTo(r.frontDownforceN * 3, 6);
  });

  it('downforce ignores sign of forwardSpeed (rolling backward still presses the wing down)', () => {
    const fwd = computeAeroDownforce({ forwardSpeed: 30, clAreaFront: 1.4, clAreaRear: 2.1 });
    const back = computeAeroDownforce({ forwardSpeed: -30, clAreaFront: 1.4, clAreaRear: 2.1 });
    expect(back.frontDownforceN).toBeCloseTo(fwd.frontDownforceN, 8);
    expect(back.rearDownforceN).toBeCloseTo(fwd.rearDownforceN, 8);
  });

  it('downforce clamps negative clArea inputs to zero', () => {
    const r = computeAeroDownforce({ forwardSpeed: 50, clAreaFront: -1, clAreaRear: 2 });
    expect(r.frontDownforceN).toBe(0);
    expect(r.rearDownforceN).toBeGreaterThan(0);
  });
});

describe('aero downforce', () => {
  it('returns zero load at rest', () => {
    const r = computeAeroDownforce({ forwardSpeed: 0, clAreaFront: 1.5, clAreaRear: 2.5 });
    expect(r.frontDownforceN).toBe(0);
    expect(r.rearDownforceN).toBe(0);
  });

  it('returns zero load when both Cl·A values are zero', () => {
    const r = computeAeroDownforce({ forwardSpeed: 80, clAreaFront: 0, clAreaRear: 0 });
    expect(r.frontDownforceN).toBe(0);
    expect(r.rearDownforceN).toBe(0);
  });

  it('scales with speed squared', () => {
    const slow = computeAeroDownforce({
      forwardSpeed: 30,
      clAreaFront: 1,
      clAreaRear: 2,
    });
    const fast = computeAeroDownforce({
      forwardSpeed: 60,
      clAreaFront: 1,
      clAreaRear: 2,
    });
    expect(fast.frontDownforceN).toBeCloseTo(slow.frontDownforceN * 4, 6);
    expect(fast.rearDownforceN).toBeCloseTo(slow.rearDownforceN * 4, 6);
  });

  it('matches the closed-form q · Cl·A formula', () => {
    const v = 50;
    const rho = 1.225;
    const expectedFront = 0.5 * rho * v * v * 1.4;
    const expectedRear = 0.5 * rho * v * v * 2.6;
    const r = computeAeroDownforce({
      forwardSpeed: v,
      clAreaFront: 1.4,
      clAreaRear: 2.6,
    });
    expect(r.frontDownforceN).toBeCloseTo(expectedFront, 4);
    expect(r.rearDownforceN).toBeCloseTo(expectedRear, 4);
  });

  it('treats reverse motion the same as forward (lift, not push)', () => {
    const fwd = computeAeroDownforce({ forwardSpeed: 40, clAreaFront: 1, clAreaRear: 1.5 });
    const rev = computeAeroDownforce({ forwardSpeed: -40, clAreaFront: 1, clAreaRear: 1.5 });
    expect(rev.frontDownforceN).toBeCloseTo(fwd.frontDownforceN, 6);
    expect(rev.rearDownforceN).toBeCloseTo(fwd.rearDownforceN, 6);
  });

  it('isolates front and rear axles independently', () => {
    const frontOnly = computeAeroDownforce({
      forwardSpeed: 50,
      clAreaFront: 2,
      clAreaRear: 0,
    });
    expect(frontOnly.frontDownforceN).toBeGreaterThan(0);
    expect(frontOnly.rearDownforceN).toBe(0);

    const rearOnly = computeAeroDownforce({
      forwardSpeed: 50,
      clAreaFront: 0,
      clAreaRear: 2,
    });
    expect(rearOnly.frontDownforceN).toBe(0);
    expect(rearOnly.rearDownforceN).toBeGreaterThan(0);
  });

  it('clamps negative or non-finite Cl·A inputs to zero', () => {
    const r = computeAeroDownforce({
      forwardSpeed: 50,
      clAreaFront: -1,
      clAreaRear: Number.NaN,
    });
    expect(r.frontDownforceN).toBe(0);
    expect(r.rearDownforceN).toBe(0);
  });

  it('honours an explicit airDensity override', () => {
    const baseline = computeAeroDownforce({
      forwardSpeed: 40,
      clAreaFront: 1.2,
      clAreaRear: 1.5,
    });
    const halfDensity = computeAeroDownforce({
      forwardSpeed: 40,
      clAreaFront: 1.2,
      clAreaRear: 1.5,
      airDensity: 0.6125,
    });
    expect(halfDensity.frontDownforceN).toBeCloseTo(baseline.frontDownforceN * 0.5, 6);
    expect(halfDensity.rearDownforceN).toBeCloseTo(baseline.rearDownforceN * 0.5, 6);
  });

  it('returns zero load when airDensity is non-positive', () => {
    const r = computeAeroDownforce({
      forwardSpeed: 80,
      clAreaFront: 2,
      clAreaRear: 2,
      airDensity: 0,
    });
    expect(r.frontDownforceN).toBe(0);
    expect(r.rearDownforceN).toBe(0);
  });
});

describe('self-aligning moment', () => {
  it('decays to near-zero past the trail decay angle', () => {
    const peak = Math.abs(computeSelfAligningMoment({ slipAngleRad: 5 * DEG, fySlip: 4000 }));
    const past = Math.abs(computeSelfAligningMoment({ slipAngleRad: 30 * DEG, fySlip: 4000 }));
    expect(past).toBeLessThan(peak * 0.2);
  });

  it('shares sign with fySlip so it reduces (not amplifies) the contact-patch yaw lever', () => {
    // The contact-patch r×F at a front wheel forward of COM produces a chassis-up
    // yaw component opposite in sign to Fy_lat. Mz must share the sign of Fy_lat
    // so adding it brings the effective lever arm from `d_front` down to
    // `d_front − trail` (i.e. self-aligning). The previous code negated this.
    const posFy = computeSelfAligningMoment({ slipAngleRad: 5 * DEG, fySlip: 4000 });
    const negFy = computeSelfAligningMoment({ slipAngleRad: 5 * DEG, fySlip: -4000 });
    expect(posFy).toBeGreaterThan(0);
    expect(negFy).toBeLessThan(0);
    // Magnitude is bounded by `trail0 * |fySlip|` (= 0.042 * 4000 = 168 N·m at α=0).
    expect(Math.abs(posFy)).toBeLessThan(0.042 * 4000);
  });

  it('full aligning moment splits into pneumatic, mechanical, and scrub contributions', () => {
    const r = computeAligningMoment({
      slipAngleRad: 4 * DEG,
      fySlip: 3000,
      fx: -2200,
      casterDeg: 6,
    });
    expect(r.pneumaticTrailM).toBeGreaterThan(0);
    expect(r.mechanicalTrailM).toBeGreaterThan(0);
    expect(r.scrubRadiusM).toBeGreaterThan(0);
    expect(r.pneumaticMz).toBeCloseTo(r.pneumaticTrailM * 3000, 6);
    expect(r.mechanicalMz).toBeCloseTo(r.mechanicalTrailM * 3000, 6);
    expect(r.scrubMz).toBeCloseTo(r.scrubRadiusM * -2200, 6);
    expect(r.mz).toBeCloseTo(r.pneumaticMz + r.mechanicalMz + r.scrubMz, 6);
  });

  it('caster increases mechanical trail (heavier steering self-centre at speed)', () => {
    const noCaster = computeAligningMoment({
      slipAngleRad: 4 * DEG,
      fySlip: 3000,
      fx: 0,
      casterDeg: 0,
    });
    const heavyCaster = computeAligningMoment({
      slipAngleRad: 4 * DEG,
      fySlip: 3000,
      fx: 0,
      casterDeg: 8,
    });
    expect(heavyCaster.mechanicalTrailM).toBeGreaterThan(noCaster.mechanicalTrailM);
    expect(Math.abs(heavyCaster.mz)).toBeGreaterThan(Math.abs(noCaster.mz));
  });
});

describe('low-speed wheel rotation lock', () => {
  it('locks omega to vx/r below the lock speed when no drive torque is present', () => {
    const r = applyLowSpeedWheelRotationLock({
      vx: 0.2,
      omega: 0,
      radius: 0.34,
      driveTorqueNm: 0,
      brakeTorqueNm: 0,
    });
    expect(r.locked).toBe(true);
    expect(r.blend).toBeCloseTo(1, 6);
    expect(r.omega).toBeCloseTo(0.2 / 0.34, 6);
  });

  it('blends through the lock-to-blend speed window', () => {
    const lockSpeed = 0.4;
    const blendSpeed = 0.8;
    const mid = applyLowSpeedWheelRotationLock({
      vx: 0.6,
      omega: 0,
      radius: 0.34,
      driveTorqueNm: 0,
      brakeTorqueNm: 0,
      lockSpeedMps: lockSpeed,
      blendSpeedMps: blendSpeed,
    });
    expect(mid.locked).toBe(true);
    expect(mid.blend).toBeGreaterThan(0);
    expect(mid.blend).toBeLessThan(1);
  });

  it('unlocks when drive torque exceeds the unlock threshold', () => {
    const r = applyLowSpeedWheelRotationLock({
      vx: 0.2,
      omega: 5,
      radius: 0.34,
      driveTorqueNm: 200,
      brakeTorqueNm: 0,
      driveUnlockTorqueNm: 35,
    });
    expect(r.locked).toBe(false);
    expect(r.omega).toBe(5);
  });

  it('forces omega toward zero when the brake clamps the wheel below the lock speed', () => {
    const r = applyLowSpeedWheelRotationLock({
      vx: 0.05,
      omega: 4,
      radius: 0.34,
      driveTorqueNm: 0,
      brakeTorqueNm: 200,
      brakeLockTorqueNm: 50,
    });
    expect(r.locked).toBe(true);
    expect(r.omega).toBeCloseTo(0, 6);
  });

  it('is a passthrough above the blend speed', () => {
    const r = applyLowSpeedWheelRotationLock({
      vx: 5,
      omega: 14,
      radius: 0.34,
      driveTorqueNm: 0,
      brakeTorqueNm: 0,
    });
    expect(r.locked).toBe(false);
    expect(r.omega).toBe(14);
    expect(r.blend).toBe(0);
  });
});

describe('Salisbury LSD', () => {
  const baseDiff = {
    leftInertia: 1.5,
    rightInertia: 1.5,
    preloadNm: 60,
    capacityNm: 1200,
    powerRamp: 0.5,
    coastRamp: 0.2,
    dt: 1 / 240,
  };

  it('welded diff equalises wheel speeds preserving angular momentum', () => {
    const r = applySalisburyDiff({
      ...baseDiff,
      leftOmega: 100,
      rightOmega: 60,
      driveTorqueAxleNm: 0,
      diffType: 'welded',
    });
    const expectedAvg = (1.5 * 100 + 1.5 * 60) / (1.5 + 1.5);
    expect(r.leftOmega).toBeCloseTo(expectedAvg, 6);
    expect(r.rightOmega).toBeCloseTo(expectedAvg, 6);
  });

  it('open diff leaves wheel speeds untouched', () => {
    const r = applySalisburyDiff({
      ...baseDiff,
      leftOmega: 100,
      rightOmega: 60,
      driveTorqueAxleNm: 200,
      diffType: 'open',
    });
    expect(r.leftOmega).toBe(100);
    expect(r.rightOmega).toBe(60);
    expect(r.lockTorqueNm).toBe(0);
  });

  it('clutchLSD lock torque grows with drive on power but stays at preload on coast', () => {
    const lowPower = applySalisburyDiff({
      ...baseDiff,
      leftOmega: 110,
      rightOmega: 80,
      driveTorqueAxleNm: 100,
      diffType: 'clutchLSD',
    });
    const highPower = applySalisburyDiff({
      ...baseDiff,
      leftOmega: 110,
      rightOmega: 80,
      driveTorqueAxleNm: 800,
      diffType: 'clutchLSD',
    });
    const lowCoast = applySalisburyDiff({
      ...baseDiff,
      leftOmega: 110,
      rightOmega: 80,
      driveTorqueAxleNm: -100,
      diffType: 'clutchLSD',
    });
    expect(highPower.lockTorqueNm).toBeGreaterThan(lowPower.lockTorqueNm);
    // Same |drive| but coast: lock torque is bounded by the smaller coast
    // ramp so it must be lower than the equivalent power-side lock.
    expect(lowCoast.lockTorqueNm).toBeLessThan(lowPower.lockTorqueNm);
  });

  it('clutchLSD lock torque saturates at the capacity ceiling', () => {
    const small = applySalisburyDiff({
      ...baseDiff,
      capacityNm: 200,
      leftOmega: 200,
      rightOmega: 50,
      driveTorqueAxleNm: 5000,
      diffType: 'clutchLSD',
    });
    expect(small.lockTorqueNm).toBeLessThanOrEqual(200);
  });

  it('clutchLSD preload alone reduces wheel-speed delta even at zero throttle', () => {
    // Zero drive torque means coast ramp contributes nothing; the LSD only
    // has its preload to fight the |dOmega|. We expect a non-zero coupling
    // torque (capped at preload) and a smaller post-step delta.
    const r = applySalisburyDiff({
      ...baseDiff,
      preloadNm: 80,
      leftOmega: 100,
      rightOmega: 60,
      driveTorqueAxleNm: 0,
      diffType: 'clutchLSD',
    });
    expect(r.lockTorqueNm).toBeGreaterThan(0);
    expect(r.lockTorqueNm).toBeLessThanOrEqual(80);
    expect(Math.abs(r.leftOmega - r.rightOmega)).toBeLessThan(40);
  });

  it('clutchLSD locks more strongly on power than coast when powerRamp > coastRamp', () => {
    const power = applySalisburyDiff({
      ...baseDiff,
      powerRamp: 0.6,
      coastRamp: 0.2,
      leftOmega: 100,
      rightOmega: 60,
      driveTorqueAxleNm: 500,
      diffType: 'clutchLSD',
    });
    const coast = applySalisburyDiff({
      ...baseDiff,
      powerRamp: 0.6,
      coastRamp: 0.2,
      leftOmega: 100,
      rightOmega: 60,
      driveTorqueAxleNm: -500,
      diffType: 'clutchLSD',
    });
    // Same |drive|, same delta, but power side has the bigger ramp so it
    // builds more lock torque and pulls the wheels closer to equal speed.
    expect(power.lockTorqueNm).toBeGreaterThan(coast.lockTorqueNm);
    const powerDelta = Math.abs(power.leftOmega - power.rightOmega);
    const coastDelta = Math.abs(coast.leftOmega - coast.rightOmega);
    expect(powerDelta).toBeLessThan(coastDelta);
  });
});

describe('drivetrain (Karnopp clutch + axle dispatch)', () => {
  const params: DrivetrainParams = {
    engineInertia: 0.16,
    flywheelInertia: 0.05,
    gearboxInputInertia: 0.04,
    propshaftInertia: 0.03,
    diffInertia: 0.06,
    clutchMaxTorqueNm: 500,
    clutchStaticFactor: 1.3,
    clutchStickThresholdRadPerSec: 8,
    drivetrainSubsteps: 4,
    diffType: 'clutchLSD',
    diffPreloadNm: 60,
    diffCapacityNm: 1200,
    diffPowerRamp: 0.5,
    diffCoastRamp: 0.2,
    idleOmega: 1100 * (2 * Math.PI / 60),
    redlineOmega: 9000 * (2 * Math.PI / 60),
  };

  function makeWheels(rearOmega: number, externalTorqueRear = 0): DrivetrainWheelInput[] {
    return [
      { index: 0, omega: 0, inertia: 1.2, driveShare: 0, axle: 'front', side: 'left', externalTorqueNm: 0 },
      { index: 1, omega: 0, inertia: 1.2, driveShare: 0, axle: 'front', side: 'right', externalTorqueNm: 0 },
      { index: 2, omega: rearOmega, inertia: 1.4, driveShare: 0.5, axle: 'rear', side: 'left', externalTorqueNm: externalTorqueRear },
      { index: 3, omega: rearOmega, inertia: 1.4, driveShare: 0.5, axle: 'rear', side: 'right', externalTorqueNm: externalTorqueRear },
    ];
  }

  it('idle / redline clamp keeps engine omega bounded across substeps', () => {
    const tooLow: DrivetrainStepInput = {
      engineOmega: params.idleOmega - 50,
      transmissionOmega: 0,
      wheels: makeWheels(0),
      gearRatio: 0,
      finalDrive: 3.8,
      engineDriveTorqueNm: 0,
      engineDragTorqueNm: 0,
      params,
      dt: 1 / 240,
    };
    const r = stepDrivetrain(tooLow);
    expect(r.engineOmega).toBeGreaterThanOrEqual(params.idleOmega - 1e-6);
    expect(r.engineOmega).toBeLessThanOrEqual(params.redlineOmega + 1e-6);
  });

  it('locked clutch holds engine and input shaft together at small slip', () => {
    // Pick a wheel speed that keeps the matched engine omega comfortably
    // below redline (otherwise the clamp demotes the lock to slip mode).
    const wheelOmega = 50;
    const gearRatio = 2.1;
    const finalDrive = 3.8;
    const overall = gearRatio * finalDrive;
    const input: DrivetrainStepInput = {
      engineOmega: wheelOmega * overall, // perfectly matched, |slip| = 0
      transmissionOmega: 0,
      wheels: makeWheels(wheelOmega, -10),
      gearRatio,
      finalDrive,
      engineDriveTorqueNm: 0,
      engineDragTorqueNm: 0,
      params,
      dt: 1 / 240,
    };
    const r = stepDrivetrain(input);
    expect(r.clutchMode).toBe('locked');
    // Locked: engine omega moves with the input shaft, |slip| stays near zero.
    expect(Math.abs(r.clutchSlipRadPerSec)).toBeLessThan(params.clutchStickThresholdRadPerSec);
  });

  it('slipping clutch produces clutch torque saturated at clutchMaxTorqueNm', () => {
    const wheelOmega = 30;
    const gearRatio = 2.1;
    const finalDrive = 3.8;
    const overall = gearRatio * finalDrive;
    // Force a very large slip so the clutch must run in kinetic mode.
    const input: DrivetrainStepInput = {
      engineOmega: wheelOmega * overall + 200,
      transmissionOmega: 0,
      wheels: makeWheels(wheelOmega),
      gearRatio,
      finalDrive,
      engineDriveTorqueNm: 0,
      engineDragTorqueNm: 0,
      params,
      dt: 1 / 240,
    };
    const r = stepDrivetrain(input);
    expect(r.clutchMode).toBe('slipping');
    expect(Math.abs(r.clutchTorqueNm)).toBeCloseTo(params.clutchMaxTorqueNm, 6);
  });

  it('drive torque flows from the engine through the gearbox to the rear wheels', () => {
    const wheelOmega = 30;
    const gearRatio = 2.1;
    const finalDrive = 3.8;
    const overall = gearRatio * finalDrive;
    const input: DrivetrainStepInput = {
      engineOmega: wheelOmega * overall + 50,
      transmissionOmega: 0,
      wheels: makeWheels(wheelOmega),
      gearRatio,
      finalDrive,
      engineDriveTorqueNm: 220,
      engineDragTorqueNm: 0,
      params,
      dt: 1 / 240,
    };
    const r = stepDrivetrain(input);
    // Wheels with driveShare > 0 receive a non-zero diagnostic torque…
    expect(r.driveTorqueByWheel[2]).not.toBe(0);
    expect(r.driveTorqueByWheel[3]).not.toBe(0);
    // …and front wheels (driveShare = 0) receive nothing.
    expect(r.driveTorqueByWheel[0]).toBe(0);
    expect(r.driveTorqueByWheel[1]).toBe(0);
  });

  it('locked clutch conserves angular momentum for a no-torque two-inertia case', () => {
    // No engine torque, no engine drag, no external wheel torque. Engine
    // and input shaft start within the stick threshold so the clutch
    // locks. The combined system has no external angular momentum source,
    // so angular momentum at the engine + reflected input-side inertia
    // should be conserved across one outer step.
    const wheelOmega = 30;
    const gearRatio = 2.1;
    const finalDrive = 3.8;
    const overall = gearRatio * finalDrive;
    const noTorque: Omit<DrivetrainParams, 'idleOmega' | 'redlineOmega'> = {
      engineInertia: 0.16,
      flywheelInertia: 0.05,
      gearboxInputInertia: 0.04,
      propshaftInertia: 0.03,
      diffInertia: 0.06,
      clutchMaxTorqueNm: 800,
      clutchStaticFactor: 1.5,
      clutchStickThresholdRadPerSec: 16,
      drivetrainSubsteps: 1,
      diffType: 'open',
      diffPreloadNm: 0,
      diffCapacityNm: 0,
      diffPowerRamp: 0,
      diffCoastRamp: 0,
    };
    const conservativeParams: DrivetrainParams = {
      ...noTorque,
      idleOmega: 0,
      redlineOmega: Number.POSITIVE_INFINITY,
    };

    const Je = conservativeParams.engineInertia + conservativeParams.flywheelInertia;
    const overallSq = overall * overall;
    const Ji =
      conservativeParams.gearboxInputInertia +
      conservativeParams.propshaftInertia / (gearRatio * gearRatio) +
      conservativeParams.diffInertia / overallSq +
      (1.4 + 1.4) / overallSq;

    const startEngine = wheelOmega * overall + 4;
    const startInputAtShaft = wheelOmega * overall;
    const initialMomentum = Je * startEngine + Ji * startInputAtShaft;

    const r = stepDrivetrain({
      engineOmega: startEngine,
      transmissionOmega: 0,
      wheels: makeWheels(wheelOmega),
      gearRatio,
      finalDrive,
      engineDriveTorqueNm: 0,
      engineDragTorqueNm: 0,
      params: conservativeParams,
      dt: 1 / 240,
    });

    expect(r.clutchMode).toBe('locked');
    const finalMomentum = Je * r.engineOmega + Ji * r.transmissionOmega;
    expect(Math.abs(finalMomentum - initialMomentum) / Math.abs(initialMomentum)).toBeLessThan(0.05);
  });

  it('neutral gear advances engine omega without coupling driven wheels', () => {
    const neutralParams: DrivetrainParams = { ...params, drivetrainSubsteps: 1 };
    const wheelOmega = 25;
    const r = stepDrivetrain({
      engineOmega: neutralParams.idleOmega + 100,
      transmissionOmega: neutralParams.idleOmega + 100,
      wheels: makeWheels(wheelOmega),
      gearRatio: 0,
      finalDrive: 3.8,
      engineDriveTorqueNm: 200,
      engineDragTorqueNm: 0,
      params: neutralParams,
      dt: 1 / 60,
    });
    expect(r.engineOmega).toBeGreaterThan(neutralParams.idleOmega + 100);
    expect(r.driveTorqueByWheel[2]).toBe(0);
    expect(r.driveTorqueByWheel[3]).toBe(0);
    expect(r.wheelOmegas[2]).toBeCloseTo(wheelOmega, 6);
    expect(r.wheelOmegas[3]).toBeCloseTo(wheelOmega, 6);
  });

  it('reverse gear flips drive torque sign at the wheels but keeps inertias positive', () => {
    const wheelOmega = -10;
    const reverseRatio = -3.1;
    const finalDrive = 3.8;
    const overall = reverseRatio * finalDrive;
    const r = stepDrivetrain({
      engineOmega: wheelOmega * overall,
      transmissionOmega: 0,
      wheels: makeWheels(wheelOmega),
      gearRatio: reverseRatio,
      finalDrive,
      engineDriveTorqueNm: 200,
      engineDragTorqueNm: 0,
      params,
      dt: 1 / 240,
    });
    // Reverse gear with positive engine drive torque should rotate the
    // rear wheels in the negative direction (i.e. reverse). Drive
    // diagnostic at each driven wheel must therefore be negative.
    expect(r.driveTorqueByWheel[2]).toBeLessThan(0);
    expect(r.driveTorqueByWheel[3]).toBeLessThan(0);
    // Inertias never go negative anywhere — engine omega stays finite.
    expect(Number.isFinite(r.engineOmega)).toBe(true);
  });

  it('drivetrain integration stays finite and bounded across dt = 1/60, 1/120, 1/240', () => {
    function simulate(dt: number, totalSeconds: number): number {
      const wheelOmega = 30;
      const gearRatio = 2.1;
      const finalDrive = 3.8;
      const overall = gearRatio * finalDrive;
      let engineOmega = wheelOmega * overall + 100;
      let wheelOmegaState = wheelOmega;
      const steps = Math.round(totalSeconds / dt);
      for (let i = 0; i < steps; i++) {
        const r = stepDrivetrain({
          engineOmega,
          transmissionOmega: 0,
          wheels: makeWheels(wheelOmegaState),
          gearRatio,
          finalDrive,
          engineDriveTorqueNm: 200,
          engineDragTorqueNm: 0,
          params,
          dt,
        });
        engineOmega = r.engineOmega;
        wheelOmegaState = r.wheelOmegas[2];
      }
      return engineOmega;
    }
    const at240 = simulate(1 / 240, 0.5);
    const at120 = simulate(1 / 120, 0.5);
    const at60 = simulate(1 / 60, 0.5);
    expect(Number.isFinite(at240)).toBe(true);
    expect(Number.isFinite(at120)).toBe(true);
    expect(Number.isFinite(at60)).toBe(true);
    for (const o of [at240, at120, at60]) {
      expect(o).toBeGreaterThanOrEqual(params.idleOmega - 1e-6);
      expect(o).toBeLessThanOrEqual(params.redlineOmega + 1e-6);
    }
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
  it('TC drift back-off: omitted sideslip behaves the same as zero (regression guard)', () => {
    const omitted = computeTcCut({
      enabled: true,
      driverThrottle: 1,
      speedKmh: 30,
      maxDriveSlip: 0.25,
      threshold: 0.12,
      window: 0.18,
    });
    const explicitZero = computeTcCut({
      enabled: true,
      driverThrottle: 1,
      speedKmh: 30,
      maxDriveSlip: 0.25,
      threshold: 0.12,
      window: 0.18,
      sideslipDeg: 0,
    });
    expect(omitted.cut).toBeCloseTo(explicitZero.cut, 12);
  });
  it('TC drift back-off reduces cut when sideslip is moderate', () => {
    const grip = computeTcCut({
      enabled: true,
      driverThrottle: 1,
      speedKmh: 30,
      maxDriveSlip: 0.25,
      threshold: 0.12,
      window: 0.18,
      sideslipDeg: 0,
    });
    const slide = computeTcCut({
      enabled: true,
      driverThrottle: 1,
      speedKmh: 30,
      maxDriveSlip: 0.25,
      threshold: 0.12,
      window: 0.18,
      sideslipDeg: 20,
    });
    expect(slide.cut).toBeLessThan(grip.cut);
    expect(slide.cut).toBeGreaterThan(0);
  });
  it('TC drift back-off floors at TC_DRIFT_FLOOR past full back-off angle', () => {
    const grip = computeTcCut({
      enabled: true,
      driverThrottle: 1,
      speedKmh: 30,
      maxDriveSlip: 0.25,
      threshold: 0.12,
      window: 0.18,
      sideslipDeg: 0,
    });
    const fullDrift = computeTcCut({
      enabled: true,
      driverThrottle: 1,
      speedKmh: 30,
      maxDriveSlip: 0.25,
      threshold: 0.12,
      window: 0.18,
      sideslipDeg: 25,
    });
    const beyond = computeTcCut({
      enabled: true,
      driverThrottle: 1,
      speedKmh: 30,
      maxDriveSlip: 0.25,
      threshold: 0.12,
      window: 0.18,
      sideslipDeg: 60,
    });
    // Floor multiplier is 0.2; cut should approach `grip.cut * 0.2`.
    expect(fullDrift.cut).toBeCloseTo(grip.cut * 0.2, 6);
    // Sign symmetric: negative sideslip behaves the same as positive.
    const negative = computeTcCut({
      enabled: true,
      driverThrottle: 1,
      speedKmh: 30,
      maxDriveSlip: 0.25,
      threshold: 0.12,
      window: 0.18,
      sideslipDeg: -25,
    });
    expect(negative.cut).toBeCloseTo(fullDrift.cut, 12);
    // Past the back-off angle the cut stays clamped at the floor.
    expect(beyond.cut).toBeCloseTo(fullDrift.cut, 12);
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

  it('ESC brake targets map oversteer to outside-front and understeer to inside-rear', () => {
    const oversteer = computeEscBrakeTargets({
      esc: { active: true, mode: 'oversteer', turnSign: 1, axle: 'front', yawError: 0.6 },
      maxBrakeTorque: 2400,
    });
    expect(oversteer.targetWheel).toBe(1);
    expect(oversteer.torqueByWheel[0]).toBe(0);
    expect(oversteer.torqueByWheel[1]).toBeCloseTo(1800, 8);
    expect(oversteer.torqueByWheel[2]).toBe(0);
    expect(oversteer.torqueByWheel[3]).toBe(0);

    const understeer = computeEscBrakeTargets({
      esc: { active: true, mode: 'understeer', turnSign: 1, axle: 'rear', yawError: -0.4 },
      maxBrakeTorque: 1920,
    });
    expect(understeer.targetWheel).toBe(2);
    expect(understeer.torqueByWheel[0]).toBe(0);
    expect(understeer.torqueByWheel[1]).toBe(0);
    expect(understeer.torqueByWheel[2]).toBeCloseTo(960, 8);
    expect(understeer.torqueByWheel[3]).toBe(0);
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
