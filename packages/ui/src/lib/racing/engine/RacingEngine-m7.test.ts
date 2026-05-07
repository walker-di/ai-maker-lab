/**
 * M7 RacingEngine setup-surface live application tests.
 *
 * Covers:
 *   - engine.setSetup() applies all M7 fields without restart
 *   - Springs override preset values (non-zero) or fall back to preset (zero)
 *   - Damper scalers modify effective damper coefficients
 *   - Diff params propagate to drivetrainParams
 *   - Per-corner tire pressures initialised from setup
 *   - Camber static values applied from setup
 *   - Brake bias taken from setup rather than preset
 *   - Ride-height offsets adjust per-axle rest lengths
 *   - Fuel load adjusts chassis mass
 *   - Final-drive scale applied in drivetrain step
 *   - Backward compat: engine constructed with legacy setup (no M7 fields) stays stable
 */
import { afterEach, describe, expect, it } from 'bun:test';
import { RacingEngine } from './RacingEngine.js';
import type { SetupValues, TrackPreset, VehiclePreset } from '../types.js';

function makeVehicle(): VehiclePreset {
  return {
    id: 'test-rwd-m7',
    label: 'Test RWD M7',
    driveLabel: 'RWD',
    layoutLabel: 'Front-mid',
    color: 0x004488,
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
    physics: {
      massKg: 1200,
      springFrontNpm: 65000,
      springRearNpm: 60000,
      damperBumpFrontNsPm: 4000,
      damperReboundFrontNsPm: 5500,
      damperBumpRearNsPm: 4200,
      damperReboundRearNsPm: 5800,
      brakeBiasFront: 0.55,
    },
  };
}

function makeTrack(): TrackPreset {
  return {
    id: 'test-flat',
    label: 'Test Flat',
    groundColor: 0x223322,
    halfWidth: 7,
    curbWidth: 0.8,
    rubberWidth: 2,
    marblesWidth: 1,
    samples: 64,
    ctrl: [
      [0, 0], [40, 0], [40, 40], [0, 40],
    ],
  };
}

const engines: RacingEngine[] = [];

function makeEngine(setup?: Partial<SetupValues>): RacingEngine {
  const engine = new RacingEngine({ vehicle: makeVehicle(), track: makeTrack(), setup: setup as SetupValues | undefined });
  engine.resetCar();
  engines.push(engine);
  return engine;
}

function stepFor(engine: RacingEngine, totalSeconds: number, dt = 1 / 240): void {
  const steps = Math.ceil(totalSeconds / dt);
  for (let i = 0; i < steps; i++) engine.step(dt);
}

afterEach(() => {
  engines.splice(0);
});

// ---- helper to access private engine fields via cast ---------------------
function priv(engine: RacingEngine): Record<string, unknown> {
  return engine as unknown as Record<string, unknown>;
}

// ---- tests ----------------------------------------------------------------

describe('M7 engine setSetup() — springs', () => {
  it('uses preset spring when setup springFrontNpm is 0 (sentinel)', () => {
    const engine = makeEngine({ springFrontNpm: 0, springRearNpm: 0 });
    const susp = priv(engine)['susp'] as { kFront: number; kRear: number };
    expect(susp.kFront).toBe(65000);
    expect(susp.kRear).toBe(60000);
  });

  it('overrides preset spring when setup springFrontNpm is non-zero', () => {
    const engine = makeEngine({ springFrontNpm: 90000, springRearNpm: 85000 });
    const susp = priv(engine)['susp'] as { kFront: number; kRear: number };
    expect(susp.kFront).toBe(90000);
    expect(susp.kRear).toBe(85000);
  });

  it('setSetup() updates springs live', () => {
    const engine = makeEngine();
    engine.setSetup({
      ...engine.snapshot().setup as unknown as SetupValues,
      springFrontNpm: 100000,
      springRearNpm: 95000,
    } as SetupValues);
    const susp = priv(engine)['susp'] as { kFront: number; kRear: number };
    expect(susp.kFront).toBe(100000);
    expect(susp.kRear).toBe(95000);
  });

  it('reverts to preset spring when setSetup() is called with 0', () => {
    const engine = makeEngine({ springFrontNpm: 100000 });
    engine.setSetup({
      ...engine.snapshot().setup as unknown as SetupValues,
      springFrontNpm: 0,
    } as SetupValues);
    const susp = priv(engine)['susp'] as { kFront: number };
    expect(susp.kFront).toBe(65000);
  });
});

describe('M7 engine setSetup() — damper scalers', () => {
  it('default scale of 1.0 leaves damper coefficients unchanged from preset', () => {
    const engine = makeEngine({
      damperBumpFrontScale: 1.0,
      damperReboundFrontScale: 1.0,
      damperBumpRearScale: 1.0,
      damperReboundRearScale: 1.0,
    });
    const susp = priv(engine)['susp'] as {
      cBumpFront: number; cReboundFront: number;
      cBumpRear: number; cReboundRear: number;
    };
    expect(susp.cBumpFront).toBeCloseTo(4000);
    expect(susp.cReboundFront).toBeCloseTo(5500);
    expect(susp.cBumpRear).toBeCloseTo(4200);
    expect(susp.cReboundRear).toBeCloseTo(5800);
  });

  it('scale of 1.5 multiplies the base coefficient by 1.5', () => {
    const engine = makeEngine({
      damperBumpFrontScale: 1.5,
      damperReboundFrontScale: 2.0,
    });
    const susp = priv(engine)['susp'] as {
      cBumpFront: number; cReboundFront: number;
    };
    expect(susp.cBumpFront).toBeCloseTo(4000 * 1.5);
    expect(susp.cReboundFront).toBeCloseTo(5500 * 2.0);
  });

  it('setSetup() updates damper scalers live', () => {
    const engine = makeEngine();
    engine.setSetup({
      ...engine.snapshot().setup as unknown as SetupValues,
      damperBumpRearScale: 1.8,
      damperReboundRearScale: 0.7,
    } as SetupValues);
    const susp = priv(engine)['susp'] as {
      cBumpRear: number; cReboundRear: number;
    };
    expect(susp.cBumpRear).toBeCloseTo(4200 * 1.8);
    expect(susp.cReboundRear).toBeCloseTo(5800 * 0.7);
  });
});

describe('M7 engine setSetup() — diff', () => {
  it('diff params from setup are applied to drivetrainParams', () => {
    const engine = makeEngine({
      diffPowerRamp: 0.7,
      diffCoastRamp: 0.15,
      diffPreloadNm: 120,
    });
    const dp = priv(engine)['drivetrainParams'] as {
      diffPowerRamp: number; diffCoastRamp: number; diffPreloadNm: number;
    };
    expect(dp.diffPowerRamp).toBeCloseTo(0.7);
    expect(dp.diffCoastRamp).toBeCloseTo(0.15);
    expect(dp.diffPreloadNm).toBeCloseTo(120);
  });

  it('setSetup() updates diff live', () => {
    const engine = makeEngine();
    engine.setSetup({
      ...engine.snapshot().setup as unknown as SetupValues,
      diffPowerRamp: 0.9,
      diffCoastRamp: 0.05,
      diffPreloadNm: 180,
    } as SetupValues);
    const dp = priv(engine)['drivetrainParams'] as {
      diffPowerRamp: number; diffCoastRamp: number; diffPreloadNm: number;
    };
    expect(dp.diffPowerRamp).toBeCloseTo(0.9);
    expect(dp.diffCoastRamp).toBeCloseTo(0.05);
    expect(dp.diffPreloadNm).toBeCloseTo(180);
  });
});

describe('M7 engine setSetup() — per-corner tire pressures', () => {
  it('wheels initialise with per-corner pressures from setup', () => {
    const engine = makeEngine({
      tirePressureFLKpa: 210,
      tirePressureFRKpa: 215,
      tirePressureRLKpa: 205,
      tirePressureRRKpa: 208,
    });
    const wheels = priv(engine)['wheels'] as Array<{ pressureKpa: number }>;
    expect(wheels[0].pressureKpa).toBeCloseTo(210);
    expect(wheels[1].pressureKpa).toBeCloseTo(215);
    expect(wheels[2].pressureKpa).toBeCloseTo(205);
    expect(wheels[3].pressureKpa).toBeCloseTo(208);
  });

  it('setSetup() updates per-corner pressures live', () => {
    const engine = makeEngine();
    engine.setSetup({
      ...engine.snapshot().setup as unknown as SetupValues,
      tirePressureFLKpa: 220,
      tirePressureFRKpa: 220,
      tirePressureRLKpa: 218,
      tirePressureRRKpa: 218,
    } as SetupValues);
    const wheels = priv(engine)['wheels'] as Array<{ pressureKpa: number }>;
    expect(wheels[0].pressureKpa).toBeCloseTo(220);
    expect(wheels[2].pressureKpa).toBeCloseTo(218);
  });
});

describe('M7 engine setSetup() — camber', () => {
  it('wheels initialise with camber from setup', () => {
    const engine = makeEngine({ camberFrontDeg: -2.5, camberRearDeg: -2.0 });
    const wheels = priv(engine)['wheels'] as Array<{ camberStaticDeg: number; camberDeg: number }>;
    expect(wheels[0].camberStaticDeg).toBeCloseTo(-2.5);
    expect(wheels[1].camberStaticDeg).toBeCloseTo(-2.5);
    expect(wheels[2].camberStaticDeg).toBeCloseTo(-2.0);
    expect(wheels[3].camberStaticDeg).toBeCloseTo(-2.0);
  });

  it('setSetup() updates camber live', () => {
    const engine = makeEngine();
    engine.setSetup({
      ...engine.snapshot().setup as unknown as SetupValues,
      camberFrontDeg: -3.0,
      camberRearDeg: -2.5,
    } as SetupValues);
    const wheels = priv(engine)['wheels'] as Array<{ camberStaticDeg: number }>;
    expect(wheels[0].camberStaticDeg).toBeCloseTo(-3.0);
    expect(wheels[2].camberStaticDeg).toBeCloseTo(-2.5);
  });
});

describe('M7 engine setSetup() — brake bias', () => {
  it('engine uses setup brakeBiasFront rather than preset value', () => {
    // Preset has brakeBiasFront = 0.55; setup overrides it.
    const engine = makeEngine({ brakeBiasFront: 0.70 });
    const bias = priv(engine)['setupBrakeBiasFront'] as number;
    expect(bias).toBeCloseTo(0.70);
  });

  it('setSetup() updates brake bias live', () => {
    const engine = makeEngine({ brakeBiasFront: 0.55 });
    engine.setSetup({
      ...engine.snapshot().setup as unknown as SetupValues,
      brakeBiasFront: 0.62,
    } as SetupValues);
    const bias = priv(engine)['setupBrakeBiasFront'] as number;
    expect(bias).toBeCloseTo(0.62);
  });
});

describe('M7 engine setSetup() — ride height', () => {
  it('positive rideHeightFrontMm increases front rest length', () => {
    const engine = makeEngine({ rideHeightFrontMm: 10, rideHeightRearMm: 0 });
    const susp = priv(engine)['susp'] as { restLen: number; restLenFront: number; restLenRear: number };
    expect(susp.restLenFront).toBeCloseTo(susp.restLen + 0.010, 6);
    expect(susp.restLenRear).toBeCloseTo(susp.restLen, 6);
  });

  it('negative rideHeightRearMm decreases rear rest length', () => {
    const engine = makeEngine({ rideHeightFrontMm: 0, rideHeightRearMm: -15 });
    const susp = priv(engine)['susp'] as { restLen: number; restLenRear: number };
    expect(susp.restLenRear).toBeCloseTo(susp.restLen - 0.015, 6);
  });

  it('setSetup() updates ride height live', () => {
    const engine = makeEngine();
    engine.setSetup({
      ...engine.snapshot().setup as unknown as SetupValues,
      rideHeightFrontMm: 20,
      rideHeightRearMm: -10,
    } as SetupValues);
    const susp = priv(engine)['susp'] as { restLen: number; restLenFront: number; restLenRear: number };
    expect(susp.restLenFront).toBeCloseTo(susp.restLen + 0.020, 6);
    expect(susp.restLenRear).toBeCloseTo(susp.restLen - 0.010, 6);
  });
});

describe('M7 engine setSetup() — fuel load', () => {
  it('fuelLoad 0 (default) adds no extra mass above base', () => {
    const engine = makeEngine({ fuelLoad: 0 });
    const baseMass = priv(engine)['baseChassisMass'] as number;
    const totalMass = priv(engine)['chassisMass'] as number;
    expect(totalMass).toBeCloseTo(baseMass, 2);
  });

  it('full fuel (1.0) adds MAX_FUEL_MASS_KG (80 kg) to base mass', () => {
    const engine = makeEngine({ fuelLoad: 1.0 });
    const baseMass = priv(engine)['baseChassisMass'] as number;
    const totalMass = priv(engine)['chassisMass'] as number;
    expect(totalMass).toBeCloseTo(baseMass + 80, 2);
  });

  it('half fuel adds 40 kg', () => {
    const engine = makeEngine({ fuelLoad: 0.5 });
    const baseMass = priv(engine)['baseChassisMass'] as number;
    const totalMass = priv(engine)['chassisMass'] as number;
    expect(totalMass).toBeCloseTo(baseMass + 40, 1);
  });

  it('setSetup() updates fuel mass live', () => {
    const engine = makeEngine({ fuelLoad: 0 });
    engine.setSetup({
      ...engine.snapshot().setup as unknown as SetupValues,
      fuelLoad: 0.75,
    } as SetupValues);
    const baseMass = priv(engine)['baseChassisMass'] as number;
    const totalMass = priv(engine)['chassisMass'] as number;
    expect(totalMass).toBeCloseTo(baseMass + 80 * 0.75, 2);
  });
});

describe('M7 engine setSetup() — final drive scale', () => {
  it('default scale of 1.0 does not modify effective final drive', () => {
    const engine = makeEngine({ finalDriveScale: 1.0 });
    const scale = priv(engine)['setupFinalDriveScale'] as number;
    expect(scale).toBe(1.0);
  });

  it('scale > 1 stored in setupFinalDriveScale', () => {
    const engine = makeEngine({ finalDriveScale: 1.3 });
    const scale = priv(engine)['setupFinalDriveScale'] as number;
    expect(scale).toBeCloseTo(1.3);
  });

  it('setSetup() updates final drive scale live', () => {
    const engine = makeEngine();
    engine.setSetup({
      ...engine.snapshot().setup as unknown as SetupValues,
      finalDriveScale: 0.85,
    } as SetupValues);
    const scale = priv(engine)['setupFinalDriveScale'] as number;
    expect(scale).toBeCloseTo(0.85);
  });
});

describe('M7 engine backward compatibility — legacy setup (no M7 fields)', () => {
  it('engine constructed with only pre-M7 fields remains numerically stable', () => {
    // Simulate the pre-M7 setup object (no M7 fields)
    const legacySetup = {
      frontToeDeg: 0.2,
      rearToeDeg: -0.1,
      casterDeg: 4.0,
      ackermannPct: 0.3,
      motionRatioFront: 1.0,
      motionRatioRear: 1.0,
      bumpStopGapFrontMm: 200,
      bumpStopGapRearMm: 200,
      bumpStopRateFrontNmm: 50,
      bumpStopRateRearNmm: 50,
    };
    // TypeScript will complain but runtime accepts it through setSetup spread fallback.
    const engine = makeEngine(legacySetup as Partial<SetupValues>);
    // Should not throw and should remain stable after a step
    engine.input.state.throttle = 0.5;
    expect(() => stepFor(engine, 1)).not.toThrow();
    const snap = engine.snapshot();
    for (const w of snap.wheels) {
      expect(Number.isFinite(w.fz)).toBe(true);
    }
  });

  it('setSetup() with a partial M7 object uses defaults for missing fields', () => {
    const engine = makeEngine();
    // setSetup with only a subset of new M7 fields
    engine.setSetup({
      ...engine.snapshot().setup as unknown as SetupValues,
      // Only override these; the rest come from the existing setup
      springFrontNpm: 80000,
      fuelLoad: 0.5,
    } as SetupValues);
    const susp = priv(engine)['susp'] as { kFront: number };
    expect(susp.kFront).toBe(80000);
    const baseMass = priv(engine)['baseChassisMass'] as number;
    const totalMass = priv(engine)['chassisMass'] as number;
    expect(totalMass).toBeCloseTo(baseMass + 40, 1);
  });
});

describe('M7 engine setSetup() — snapshot consistency', () => {
  it('engine remains numerically stable after applying M7 setup changes', () => {
    const engine = makeEngine({
      springFrontNpm: 90000,
      springRearNpm: 85000,
      damperBumpFrontScale: 1.3,
      damperReboundFrontScale: 1.1,
      damperBumpRearScale: 1.2,
      damperReboundRearScale: 0.9,
      diffPowerRamp: 0.7,
      diffCoastRamp: 0.2,
      diffPreloadNm: 100,
      tirePressureFLKpa: 210,
      tirePressureFRKpa: 215,
      tirePressureRLKpa: 205,
      tirePressureRRKpa: 208,
      camberFrontDeg: -2.0,
      camberRearDeg: -1.8,
      brakeBiasFront: 0.60,
      rideHeightFrontMm: 5,
      rideHeightRearMm: -3,
      fuelLoad: 0.8,
      finalDriveScale: 1.1,
    });
    engine.input.state.throttle = 0.8;
    expect(() => stepFor(engine, 3)).not.toThrow();
    const snap = engine.snapshot();
    for (const w of snap.wheels) {
      expect(Number.isFinite(w.fz)).toBe(true);
      expect(Number.isFinite(w.slipRatio)).toBe(true);
    }
    expect(Number.isFinite(snap.speedKmh)).toBe(true);
  });
});
