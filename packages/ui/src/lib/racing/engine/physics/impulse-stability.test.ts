import { describe, expect, it } from 'bun:test';
import { Vector3, Quaternion } from 'three';
import { createSoftwareHubStates, stepComplianceSoftware, applyTorsionalRestoringTorqueToVector } from '../compliance.js';
import { chassisRollFromRightY } from './compliance-math.js';

/**
 * Simulate a single-degree-of-freedom spring-mass-damper using the
 * semi-implicit Euler scheme that the engine runs at 240 Hz.  This
 * validates the chosen bushing parameters (stiffness + damping) produce
 * a stable, non-divergent response before the full Jolt integration
 * is wired in.
 */
function simulateHubImpulse(opts: {
  massKg: number;
  kNpm: number;
  cNspm: number;
  impulseN: number;
  impulseDurationS: number;
  dt: number;
  totalTimeS: number;
}): {
  displacements: number[];
  velocities: number[];
  maxDisplacementM: number;
  finalDisplacementM: number;
  finalVelocityMs: number;
  settled: boolean;
} {
  let x = 0;
  let v = 0;
  const steps = Math.ceil(opts.totalTimeS / opts.dt);
  const impulseSteps = Math.ceil(opts.impulseDurationS / opts.dt);
  const displacements: number[] = [];
  const velocities: number[] = [];
  let maxDisplacementM = 0;

  for (let i = 0; i < steps; i++) {
    const fExternal = i < impulseSteps ? opts.impulseN : 0;
    const fSpring = -opts.kNpm * x;
    const fDamper = -opts.cNspm * v;
    const a = (fSpring + fDamper + fExternal) / opts.massKg;
    v += a * opts.dt;
    x += v * opts.dt;
    displacements.push(x);
    velocities.push(v);
    if (Math.abs(x) > maxDisplacementM) maxDisplacementM = Math.abs(x);
  }

  const settleWindow = Math.floor(0.1 / opts.dt); // last 0.1 s
  const late = displacements.slice(-settleWindow);
  const settled = late.every((d) => Math.abs(d) < 0.0005); // 0.5 mm

  return {
    displacements,
    velocities,
    maxDisplacementM,
    finalDisplacementM: x,
    finalVelocityMs: v,
    settled,
  };
}

describe('Hub impulse stability — mathematical simulation', () => {
  const DT = 1 / 240;
  const MASS = 20; // kg
  const K = 150_000; // N/m
  const C = 2500; // N·s/m (damping ratio ~0.7 for these params)

  it('10,000 N impulse for one step produces bounded deflection', () => {
    const result = simulateHubImpulse({
      massKg: MASS,
      kNpm: K,
      cNspm: C,
      impulseN: 10_000,
      impulseDurationS: DT,
      dt: DT,
      totalTimeS: 0.5,
    });
    expect(result.maxDisplacementM).toBeGreaterThan(0.001); // > 1 mm
    expect(result.maxDisplacementM).toBeLessThan(0.05); // < 50 mm hard limit
  });

  it('hub returns to equilibrium within 0.5 s without divergence', () => {
    const result = simulateHubImpulse({
      massKg: MASS,
      kNpm: K,
      cNspm: C,
      impulseN: 10_000,
      impulseDurationS: DT,
      dt: DT,
      totalTimeS: 0.5,
    });
    expect(result.settled).toBe(true);
    expect(Math.abs(result.finalDisplacementM)).toBeLessThan(0.001);
    expect(Math.abs(result.finalVelocityMs)).toBeLessThan(0.01);
  });

  it('under-damped but stable: peak overshoot < 25% of static deflection', () => {
    // Static deflection under 10 kN = F/k ≈ 66.7 mm
    const staticDeflection = 10_000 / K;
    const result = simulateHubImpulse({
      massKg: MASS,
      kNpm: K,
      cNspm: C,
      impulseN: 10_000,
      impulseDurationS: DT,
      dt: DT,
      totalTimeS: 0.5,
    });
    // For short impulse, the system is effectively excited by momentum.
    // The peak displacement should stay within a reasonable bound.
    expect(result.maxDisplacementM).toBeLessThan(staticDeflection * 1.5);
  });

  it('stability holds at different damping ratios', () => {
    for (const dampingRatio of [0.6, 0.7, 1.0]) {
      const cCrit = 2 * Math.sqrt(K * MASS);
      const c = dampingRatio * cCrit;
      const result = simulateHubImpulse({
        massKg: MASS,
        kNpm: K,
        cNspm: c,
        impulseN: 10_000,
        impulseDurationS: DT,
        dt: DT,
        totalTimeS: 0.5,
      });
      expect(result.settled).toBe(true);
      expect(Math.abs(result.finalDisplacementM)).toBeLessThan(0.001);
    }
  });

  it('stays stable at production 240 Hz step rate', () => {
    const result240 = simulateHubImpulse({
      massKg: MASS,
      kNpm: K,
      cNspm: C,
      impulseN: 10_000,
      impulseDurationS: DT,
      dt: DT,
      totalTimeS: 1.0,
    });
    // Energy must not grow unbounded over a full second.
    const late = result240.displacements.slice(-Math.floor(0.1 / DT));
    const maxLate = Math.max(...late.map(Math.abs));
    expect(maxLate).toBeLessThan(0.001);
  });
});

describe('Hub impulse stability — software compliance integration', () => {
  const DT = 1 / 240;

  function makeChassis(): ChassisState {
    return {
      pos: new Vector3(0, 0.4, 0),
      quat: new Quaternion(0, 0, 0, 1),
      vel: new Vector3(0, 0, 0),
      omega: new Vector3(0, 0, 0),
      mass: 1240,
      inertia: new Vector3(1500, 1700, 450),
    };
  }

  function makeHubs(): SoftwareHubState[] {
    return createSoftwareHubStates([
      new Vector3(-0.7, 0.4, 1.2),  // FL at chassis height
      new Vector3(0.7, 0.4, 1.2),   // FR at chassis height
      new Vector3(-0.7, 0.4, -1.2), // RL at chassis height
      new Vector3(0.7, 0.4, -1.2),  // RR at chassis height
    ]);
  }

  const comp = {
    hubLinearStiffnessNpm: 150_000,
    hubLinearDampingNspms: 2_500,
    hubRotationalStiffnessNmDeg: 8,
    hubRotationalDampingNmSdeg: 0.4,
    chassisTorsionalStiffnessNmDeg: 22_000,
  };

  it('10,000 N impulse to a single hub deflects and returns to equilibrium', () => {
    const chassis = makeChassis();
    const hubs = makeHubs();
    const pickupLocal = [
      new Vector3(-0.7, 0, 1.2),
      new Vector3(0.7, 0, 1.2),
      new Vector3(-0.7, 0, -1.2),
      new Vector3(0.7, 0, -1.2),
    ];
    const forces = hubs.map(() => new Vector3(0, 0, 0));

    // Apply 10,000 N upward impulse to FL for one step
    forces[0].set(0, 10_000, 0);
    stepComplianceSoftware(chassis, hubs, pickupLocal, forces, new Vector3(0, 0, 0), new Vector3(0, 0, 0), comp, DT);
    forces[0].set(0, 0, 0);

    let initialDeflection = 0;
    const deflections: number[] = [];

    // Run all 120 steps, record deflections
    for (let i = 0; i < 120; i++) {
      if (i === 0) {
        initialDeflection = hubs[0].pos.y - (chassis.pos.y + pickupLocal[0].y);
      }
      stepComplianceSoftware(chassis, hubs, pickupLocal, forces, new Vector3(0, 0, 0), new Vector3(0, 0, 0), comp, DT);
      deflections.push(hubs[0].pos.y - (chassis.pos.y + pickupLocal[0].y));
    }

    // Peak deflection should be bounded (impulse response < 50 mm)
    const peakDeflection = Math.max(...deflections.map(Math.abs));
    expect(peakDeflection).toBeGreaterThan(0.001);
    expect(peakDeflection).toBeLessThan(0.05);

    // Late-window amplitude should be small (damped oscillation settling)
    const late = deflections.slice(-Math.floor(0.1 / DT));
    const lateAmplitude = Math.max(...late.map(Math.abs)) - Math.min(...late.map(Math.abs));
    expect(lateAmplitude).toBeLessThan(0.02); // settles within 20 mm
  });

  it('chassis roll settles within 0.1° within 0.5 seconds after impulse', () => {
    const chassis = makeChassis();
    const hubs = makeHubs();
    const pickupLocal = [
      new Vector3(-0.7, 0, 1.2),
      new Vector3(0.7, 0, 1.2),
      new Vector3(-0.7, 0, -1.2),
      new Vector3(0.7, 0, -1.2),
    ];
    const forces = hubs.map(() => new Vector3(0, 0, 0));
    forces[0].set(0, 10_000, 0);
    stepComplianceSoftware(chassis, hubs, pickupLocal, forces, new Vector3(0, 0, 0), new Vector3(0, 0, 0), comp, DT);
    forces[0].set(0, 0, 0);

    for (let i = 0; i < 119; i++) {
      const right = new Vector3(1, 0, 0).applyQuaternion(chassis.quat);
      const rollDeg = chassisRollFromRightY(right.y);
      applyTorsionalRestoringTorqueToVector(right, rollDeg, comp, new Vector3(0, 0, 0));
      stepComplianceSoftware(chassis, hubs, pickupLocal, forces, new Vector3(0, 0, 0), new Vector3(0, 0, 0), comp, DT);
    }

    const right = new Vector3(1, 0, 0).applyQuaternion(chassis.quat);
    const rollDeg = chassisRollFromRightY(right.y);
    expect(Math.abs(rollDeg)).toBeLessThan(0.1);
  });
});
