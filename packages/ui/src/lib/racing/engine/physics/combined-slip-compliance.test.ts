import { describe, expect, it } from 'bun:test';
import { Vector3, Quaternion } from 'three';
import { createSoftwareHubStates, stepComplianceSoftware } from '../compliance.js';

/**
 * Compute static hub deflection under a constant lateral + longitudinal
 * force.  In steady state the spring force balances the applied load:
 *
 *   k_eff * x = F_applied  =>  x = F_applied / k_eff
 *
 * This gives the approximate deflection for a sustained combined-slip
 * cornering + braking load.
 */
function staticDeflectionM(
  lateralAccelG: number,
  longAccelG: number,
  massKg: number,
  kEffNpm: number,
): number {
  const lateralForce = lateralAccelG * 9.81 * massKg;
  const longForce = longAccelG * 9.81 * massKg;
  const totalForce = Math.sqrt(lateralForce * lateralForce + longForce * longForce);
  return kEffNpm > 0 ? totalForce / kEffNpm : 0;
}

/**
 * Compute lateral deflection at a single hub under sustained lateral load.
 * The hub body itself (massKg) accelerates laterally; the bushing resists.
 */
function lateralHubDeflectionMm(
  lateralAccelG: number,
  massKg: number,
  kBushingNpm: number,
): number {
  const force = lateralAccelG * 9.81 * massKg;
  const deflectionM = kBushingNpm > 0 ? force / kBushingNpm : 0;
  return deflectionM * 1000; // mm
}

describe('Combined slip with compliance — deflection range', () => {
  const HUB_MASS = 20; // kg, per-corner hub body mass
  const K_BUSING = 150_000; // N/m
  const K_CARCASS = 200_000; // N/m
  const K_SPRING = 75_000; // N/m (front)

  const kEff = 1 / (1 / K_SPRING + 1 / K_CARCASS + 1 / K_BUSING);

  it('effective stiffness is computed as series combination', () => {
    expect(kEff).toBeGreaterThan(0);
    expect(kEff).toBeLessThan(Math.min(K_SPRING, K_CARCASS, K_BUSING));
  });

  it('1.0g lateral + 0.3g long on hub produces deflection in 1–5 mm range', () => {
    // Hub mass sees the cornering load; tire lateral force acts on the hub.
    const deflection = staticDeflectionM(1.0, 0.3, HUB_MASS, K_BUSING);
    const deflectionMm = deflection * 1000;
    expect(deflectionMm).toBeGreaterThanOrEqual(1);
    expect(deflectionMm).toBeLessThanOrEqual(5);
  });

  it('pure 1.0g lateral deflection on hub is within 1–5 mm per hub', () => {
    const deflectionMm = lateralHubDeflectionMm(1.0, HUB_MASS, K_BUSING);
    expect(deflectionMm).toBeGreaterThanOrEqual(1);
    expect(deflectionMm).toBeLessThanOrEqual(5);
  });

  it('0.5g lateral produces smaller deflection than 1.0g', () => {
    const d05 = lateralHubDeflectionMm(0.5, HUB_MASS, K_BUSING);
    const d10 = lateralHubDeflectionMm(1.0, HUB_MASS, K_BUSING);
    expect(d05).toBeLessThan(d10);
    expect(d10).toBeCloseTo(d05 * 2, 5);
  });

  it('stiffer bushing reduces deflection at same load', () => {
    const dSoft = lateralHubDeflectionMm(1.0, HUB_MASS, 80_000);
    const dStiff = lateralHubDeflectionMm(1.0, HUB_MASS, 300_000);
    expect(dStiff).toBeLessThan(dSoft);
  });

  it('deflection remains sub-millimetre when bushing is rigid (k→∞)', () => {
    const dRigid = lateralHubDeflectionMm(1.0, HUB_MASS, 1e9);
    expect(dRigid).toBeLessThan(0.1);
  });
});

describe('Energy stability under combined slip', () => {
  it('total energy does not diverge for damped oscillator under sustained load', () => {
    // Semi-implicit Euler simulation of a hub under sustained combined load.
    const dt = 1 / 240;
    const steps = Math.ceil(2.0 / dt);
    const m = 20; // hub mass
    const k = 150_000; // bushing stiffness
    const cCrit = 2 * Math.sqrt(k * m);
    const c = 0.7 * cCrit;
    // Cornering + braking load on the hub body (not full quarter-car mass).
    const fLateral = 1.0 * 9.81 * m;
    const fLong = 0.3 * 9.81 * m;
    const fTotal = Math.sqrt(fLateral ** 2 + fLong ** 2);

    let x = 0;
    let v = 0;
    let maxEnergy = 0;
    const energyAtStep: number[] = [];

    for (let i = 0; i < steps; i++) {
      const a = (-k * x - c * v + fTotal) / m;
      v += a * dt;
      x += v * dt;
      const pe = 0.5 * k * x * x;
      const ke = 0.5 * m * v * v;
      const energy = pe + ke;
      energyAtStep.push(energy);
      if (energy > maxEnergy) maxEnergy = energy;
    }

    // Steady-state energy must be bounded and not grow without limit.
    const lateWindow = energyAtStep.slice(-Math.floor(0.5 / dt));
    const maxLate = Math.max(...lateWindow);
    const minLate = Math.min(...lateWindow);
    // No unbounded energy growth.
    expect(maxLate).toBeLessThan(maxEnergy * 1.5);
    // Late-window variation is modest (settled oscillation or steady state).
    expect(maxLate - minLate).toBeLessThan(maxEnergy * 0.5);
  });
});

describe('Combined slip with compliance — software integration', () => {
  const DT = 1 / 240;

  function makeChassis() {
    return {
      pos: new Vector3(0, 0.4, 0),
      quat: new Quaternion(0, 0, 0, 1),
      vel: new Vector3(0, 0, 0),
      omega: new Vector3(0, 0, 0),
      mass: 1240,
      inertia: new Vector3(1500, 1700, 450),
    };
  }

  function makeHubs() {
    return createSoftwareHubStates([
      new Vector3(-0.7, 0, 1.2),
      new Vector3(0.7, 0, 1.2),
      new Vector3(-0.7, 0, -1.2),
      new Vector3(0.7, 0, -1.2),
    ]);
  }

  const comp = {
    hubLinearStiffnessNpm: 150_000,
    hubLinearDampingNspms: 2_500,
    hubRotationalStiffnessNmDeg: 8,
    hubRotationalDampingNmSdeg: 0.4,
    chassisTorsionalStiffnessNmDeg: 22_000,
  };

  const pickupLocal = [
    new Vector3(-0.7, 0, 1.2),
    new Vector3(0.7, 0, 1.2),
    new Vector3(-0.7, 0, -1.2),
    new Vector3(0.7, 0, -1.2),
  ];

  it('sustained 1.0g lateral + 0.3g long produces hub lateral deflection 1–5 mm', () => {
    const chassis = makeChassis();
    const hubs = makeHubs();
    const forces = hubs.map(() => new Vector3(0, 0, 0));

    // Apply sustained combined load to FL hub
    const lateralForce = 1.0 * 9.81 * 20; // N
    const longForce = 0.3 * 9.81 * 20;    // N
    forces[0].set(longForce, 0, lateralForce);

    for (let i = 0; i < 120; i++) {
      stepComplianceSoftware(chassis, hubs, pickupLocal, forces, new Vector3(0, 0, 0), new Vector3(0, 0, 0), comp, DT);
    }

    const nominalAttach = pickupLocal[0].clone().applyQuaternion(chassis.quat).add(chassis.pos);
    const deflection = hubs[0].pos.clone().sub(nominalAttach);
    const lateralDeflectionMm = Math.abs(deflection.z) * 1000;

    expect(lateralDeflectionMm).toBeGreaterThanOrEqual(1);
    expect(lateralDeflectionMm).toBeLessThanOrEqual(5);
  });

  it('combined-slip simulation does not destabilise with compliance', () => {
    const chassis = makeChassis();
    const hubs = makeHubs();
    const forces = hubs.map(() => new Vector3(0, 0, 0));
    const lateralForce = 1.0 * 9.81 * 20;
    const longForce = 0.3 * 9.81 * 20;
    forces[0].set(longForce, 0, lateralForce);

    for (let i = 0; i < 240; i++) {
      stepComplianceSoftware(chassis, hubs, pickupLocal, forces, new Vector3(0, 0, 0), new Vector3(0, 0, 0), comp, DT);
    }

    // Assert no NaN / Infinite
    expect(Number.isFinite(chassis.pos.x)).toBe(true);
    expect(Number.isFinite(chassis.pos.y)).toBe(true);
    expect(Number.isFinite(chassis.pos.z)).toBe(true);
    for (const hub of hubs) {
      expect(Number.isFinite(hub.pos.x)).toBe(true);
      expect(Number.isFinite(hub.pos.y)).toBe(true);
      expect(Number.isFinite(hub.pos.z)).toBe(true);
    }

    // Assert hub stays within reasonable bounds
    const nominalAttach = pickupLocal[0].clone().applyQuaternion(chassis.quat).add(chassis.pos);
    const deflection = hubs[0].pos.clone().sub(nominalAttach);
    expect(Math.abs(deflection.y)).toBeLessThan(0.05); // < 50 mm vertical
    expect(Math.abs(deflection.x)).toBeLessThan(0.05); // < 50 mm lateral

    // Assert chassis roll stays bounded
    const right = new Vector3(1, 0, 0).applyQuaternion(chassis.quat);
    const rollDeg = Math.atan2(-right.y, Math.sqrt(right.x * right.x + right.z * right.z)) * (180 / Math.PI);
    expect(Math.abs(rollDeg)).toBeLessThan(5);
  });
});
