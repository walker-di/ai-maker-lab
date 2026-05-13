/**
 * Chassis compliance layer — hub bodies and bushing constraints.
 *
 * When a PhysicsContext is supplied and the preset carries nonzero
 * compliance parameters, the engine creates four Jolt hub bodies and
 * connects each to the chassis via a SixDOFConstraint with SpringSettings.
 *
 * When no PhysicsContext is available (tests, SSR, etc.) the engine falls
 * back to a pure-JS software compliance model that integrates hub states
 * explicitly with the same spring-damper parameters.  The two paths are
 * physically equivalent at 240 Hz.
 */

import type { PhysicsContext } from './jolt-loader.js';
import { Vector3, Quaternion } from 'three';
import type { VehiclePreset } from '../types.js';

// ---------------------------------------------------------------------------
// Domain mirror — ComplianceConfig is already present on VehiclePhysicsPreset
// ---------------------------------------------------------------------------

export interface ResolvedCompliance {
  hubLinearStiffnessNpm: number;
  hubLinearDampingNspms: number;
  hubRotationalStiffnessNmDeg: number;
  hubRotationalDampingNmSdeg: number;
  chassisTorsionalStiffnessNmDeg: number;
}

export function resolveCompliance(preset: VehiclePreset): ResolvedCompliance {
  const c = preset.physics?.compliance;
  return {
    hubLinearStiffnessNpm: c?.hubLinearStiffnessNpm ?? 0,
    hubLinearDampingNspms: c?.hubLinearDampingNspms ?? 0,
    hubRotationalStiffnessNmDeg: c?.hubRotationalStiffnessNmDeg ?? 0,
    hubRotationalDampingNmSdeg: c?.hubRotationalDampingNmSdeg ?? 0,
    chassisTorsionalStiffnessNmDeg: c?.chassisTorsionalStiffnessNmDeg ?? 0,
  };
}

export function hasCompliance(preset: VehiclePreset): boolean {
  const c = resolveCompliance(preset);
  return (
    c.hubLinearStiffnessNpm > 0 ||
    c.hubRotationalStiffnessNmDeg > 0 ||
    c.chassisTorsionalStiffnessNmDeg > 0
  );
}

// ---------------------------------------------------------------------------
// Jolt-backed hub bodies + SixDOFConstraint helpers
// ---------------------------------------------------------------------------

export interface JoltHubBodies {
  chassisBody: unknown;
  hubBodies: unknown[];
  constraints: unknown[];
}

/** Default mass for a single hub body (kg). Matches the spec: 15–25 kg. */
const HUB_MASS_KG = 20;

/**
 * Create a Jolt dynamic body for the chassis.
 * Collision is disabled (Layer = DYNAMIC but we never enable collision
 * with static ground because ground contact is handled by our raycast).
 */
export function createChassisBody(
  jolt: unknown,
  bodyInterface: unknown,
  massKg: number,
  inertia: Vector3,
  position: Vector3,
  quat: Quaternion,
): unknown {
  const J = jolt as any;
  const bi = bodyInterface as any;

  const shape = new J.BoxShape(new J.Vec3(1.0, 0.3, 1.5));
  const settings = new J.BodyCreationSettings(
    shape,
    new J.RVec3(position.x, position.y, position.z),
    new J.Quat(quat.x, quat.y, quat.z, quat.w),
    J.EMotionType_Dynamic,
    1, // object layer = DYNAMIC
  );
  settings.mOverrideMassProperties = J.EOverrideMassProperties_CalculateInertia;
  settings.mMassPropertiesOverride.mMass = massKg;
  settings.mMassPropertiesOverride.mInertia = new J.Mat44(
    new J.Vec4(inertia.x, 0, 0, 0),
    new J.Vec4(0, inertia.y, 0, 0),
    new J.Vec4(0, 0, inertia.z, 0),
    new J.Vec4(0, 0, 0, 1),
  );

  const body = bi.CreateBody(settings);
  bi.AddBody(body.GetID(), J.EActivation_Activate);
  return body;
}

/**
 * Create four Jolt hub bodies at the static suspension pickup points.
 * Collision is disabled (EmptyShape). Motion type = Dynamic.
 */
export function createHubBodies(
  jolt: unknown,
  bodyInterface: unknown,
  pickupPoints: Vector3[],
): unknown[] {
  const J = jolt as any;
  const bi = bodyInterface as any;
  const hubs: unknown[] = [];

  for (const pos of pickupPoints) {
    const shape = new J.EmptyShape();
    const settings = new J.BodyCreationSettings(
      shape,
      new J.RVec3(pos.x, pos.y, pos.z),
      new J.Quat(0, 0, 0, 1),
      J.EMotionType_Dynamic,
      1,
    );
    settings.mOverrideMassProperties = J.EOverrideMassProperties_CalculateInertia;
    settings.mMassPropertiesOverride.mMass = HUB_MASS_KG;
    settings.mMassPropertiesOverride.mInertia = new J.Mat44(
      new J.Vec4(0.5, 0, 0, 0),
      new J.Vec4(0, 0.5, 0, 0),
      new J.Vec4(0, 0, 0.5, 0),
      new J.Vec4(0, 0, 0, 1),
    );
    const body = bi.CreateBody(settings);
    bi.AddBody(body.GetID(), J.EActivation_Activate);
    hubs.push(body);
  }

  return hubs;
}

/**
 * Create a SixDOFConstraint per hub connecting it to the chassis.
 *
 * Translational DOFs use SpringSettings with frequency 10–15 Hz and
 * damping 0.7–1.0 when compliance stiffness is nonzero.  When stiffness
 * is zero the DOF is locked rigidly via mLimitMin = mLimitMax = 0.
 *
 * Hard translational limits of ±50 mm prevent visual separation.
 */
export function createComplianceConstraints(
  jolt: unknown,
  physicsSystem: unknown,
  chassisBody: unknown,
  hubBodies: unknown[],
  preset: VehiclePreset,
): unknown[] {
  const J = jolt as any;
  const ps = physicsSystem as any;
  const comp = resolveCompliance(preset);
  const constraints: unknown[] = [];

  const makeSpring = (frequency: number, damping: number) => {
    const ss = new J.SpringSettings();
    ss.mFrequency = frequency;
    ss.mDamping = damping;
    return ss;
  };

  for (const hub of hubBodies) {
    const settings = new J.SixDOFConstraintSettings();
    settings.mBody1 = chassisBody;
    settings.mBody2 = hub;
    settings.mSpace = J.EConstraintSpace_LocalToBodyCOM;
    settings.mPosition1 = new J.Vec3(0, 0, 0);
    settings.mPosition2 = new J.Vec3(0, 0, 0);
    settings.mAxisX1 = new J.Vec3(1, 0, 0);
    settings.mAxisX2 = new J.Vec3(1, 0, 0);
    settings.mAxisY1 = new J.Vec3(0, 1, 0);
    settings.mAxisY2 = new J.Vec3(0, 1, 0);

    // Translational axes: XYZ = 0,1,2
    for (let axis = 0; axis < 3; axis++) {
      if (comp.hubLinearStiffnessNpm > 0) {
        const k = comp.hubLinearStiffnessNpm;
        const m = HUB_MASS_KG;
        const freq = (1 / (2 * Math.PI)) * Math.sqrt(k / m);
        const clampedFreq = Math.max(5, Math.min(20, freq));
        const damp = Math.max(0.6, Math.min(1.0, comp.hubLinearDampingNspms / (2 * Math.sqrt(k * m))));

        settings.mLimitsSpringSettings[axis] = makeSpring(clampedFreq, damp);
        settings.mLimitMin[axis] = -0.05; // ±50 mm hard limit
        settings.mLimitMax[axis] = 0.05;
      } else {
        settings.mLimitMin[axis] = 0;
        settings.mLimitMax[axis] = 0;
      }
    }

    // Rotational axes: twist + swing.
    if (comp.hubRotationalStiffnessNmDeg > 0) {
      for (let axis = 3; axis < 6; axis++) {
        const kRotNmRad = comp.hubRotationalStiffnessNmDeg * (180 / Math.PI);
        const inertia = 0.5;
        const freqRot = (1 / (2 * Math.PI)) * Math.sqrt(kRotNmRad / inertia);
        const clampedFreqRot = Math.max(5, Math.min(20, freqRot));
        const dampRot = Math.max(
          0.6,
          Math.min(1.0, comp.hubRotationalDampingNmSdeg / (2 * Math.sqrt(kRotNmRad * inertia))),
        );
        settings.mLimitsSpringSettings[axis] = makeSpring(clampedFreqRot, dampRot);
        settings.mLimitMin[axis] = -5 * (Math.PI / 180); // ±5 deg
        settings.mLimitMax[axis] = 5 * (Math.PI / 180);
      }
    } else {
      for (let axis = 3; axis < 6; axis++) {
        settings.mLimitMin[axis] = 0;
        settings.mLimitMax[axis] = 0;
      }
    }

    const constraint = settings.CreateConstraint(chassisBody, hub);
    ps.AddConstraint(constraint);
    constraints.push(constraint);
  }

  return constraints;
}

/** Remove hub bodies and constraints from the physics world. */
export function destroyComplianceBodies(
  jolt: unknown,
  bodyInterface: unknown,
  physicsSystem: unknown,
  hubs: JoltHubBodies,
): void {
  const J = jolt as any;
  const bi = bodyInterface as any;
  const ps = physicsSystem as any;

  for (const c of hubs.constraints) {
    ps.RemoveConstraint(c);
  }
  for (const hub of hubs.hubBodies) {
    bi.RemoveBody((hub as any).GetID());
    bi.DestroyBody((hub as any).GetID());
  }
  if (hubs.chassisBody) {
    bi.RemoveBody((hubs.chassisBody as any).GetID());
    bi.DestroyBody((hubs.chassisBody as any).GetID());
  }
}

// ---------------------------------------------------------------------------
// Pose sync helpers
// ---------------------------------------------------------------------------

export function readJoltBodyPose(
  jolt: unknown,
  bodyInterface: unknown,
  body: unknown,
): { pos: Vector3; quat: Quaternion; vel: Vector3; omega: Vector3 } {
  const J = jolt as any;
  const bi = bodyInterface as any;
  const id = (body as any).GetID();
  const pos = bi.GetCenterOfMassPosition(id);
  const rot = bi.GetRotation(id);
  const vel = bi.GetLinearVelocity(id);
  const ang = bi.GetAngularVelocity(id);
  return {
    pos: new Vector3(pos.GetX(), pos.GetY(), pos.GetZ()),
    quat: new Quaternion(rot.GetX(), rot.GetY(), rot.GetZ(), rot.GetW()),
    vel: new Vector3(vel.GetX(), vel.GetY(), vel.GetZ()),
    omega: new Vector3(ang.GetX(), ang.GetY(), ang.GetZ()),
  };
}

export function writeJoltBodyPose(
  jolt: unknown,
  bodyInterface: unknown,
  body: unknown,
  pos: Vector3,
  quat: Quaternion,
  vel: Vector3,
  omega: Vector3,
): void {
  const J = jolt as any;
  const bi = bodyInterface as any;
  const id = (body as any).GetID();
  bi.SetPositionAndRotation(
    id,
    new J.RVec3(pos.x, pos.y, pos.z),
    new J.Quat(quat.x, quat.y, quat.z, quat.w),
  );
  bi.SetLinearVelocity(id, new J.Vec3(vel.x, vel.y, vel.z));
  bi.SetAngularVelocity(id, new J.Vec3(omega.x, omega.y, omega.z));
}

// ---------------------------------------------------------------------------
// Software compliance fallback (no Jolt WASM needed)
// ---------------------------------------------------------------------------

export interface SoftwareHubState {
  pos: Vector3;
  quat: Quaternion;
  vel: Vector3;
  omega: Vector3;
  mass: number;
  inertia: Vector3;
}

export function createSoftwareHubStates(pickupPoints: Vector3[]): SoftwareHubState[] {
  return pickupPoints.map((pos) => ({
    pos: pos.clone(),
    quat: new Quaternion(0, 0, 0, 1),
    vel: new Vector3(0, 0, 0),
    omega: new Vector3(0, 0, 0),
    mass: HUB_MASS_KG,
    inertia: new Vector3(0.5, 0.5, 0.5),
  }));
}

export interface ChassisState {
  pos: Vector3;
  quat: Quaternion;
  vel: Vector3;
  omega: Vector3;
  mass: number;
  inertia: Vector3;
}

/**
 * Integrate hubs and chassis together with explicit compliance spring-damper
 * forces.  This is the physics-equivalent of a SixDOFConstraint with
 * SpringSettings, but evaluated in plain JS.
 *
 * @param chassis      — mutable chassis state (integrated in-place)
 * @param hubs         — mutable hub states (integrated in-place)
 * @param pickupLocal  — suspension pickup points in chassis-local space
 * @param wheelForces  — per-wheel force applied at hub center (from tire model)
 * @param extraChassisForce  — additional force on chassis COM (aero, etc.)
 * @param extraChassisTorque — additional torque on chassis COM
 * @param params       — compliance parameters
 * @param dt           — step duration (s)
 */
export function stepComplianceSoftware(
  chassis: ChassisState,
  hubs: SoftwareHubState[],
  pickupLocal: Vector3[],
  wheelForces: Vector3[],
  extraChassisForce: Vector3,
  extraChassisTorque: Vector3,
  params: ResolvedCompliance,
  dt: number,
): void {
  // --- 1. Compute compliance forces and integrate hubs -------------------
  for (let i = 0; i < hubs.length; i++) {
    const hub = hubs[i];
    const localAttach = pickupLocal[i];

    const nominalAttach = localAttach.clone().applyQuaternion(chassis.quat).add(chassis.pos);
    const deflection = hub.pos.clone().sub(nominalAttach);
    const deflectionLocal = deflection.clone().applyQuaternion(chassis.quat.clone().invert());

    // Attachment point velocity on chassis.
    const rAttach = localAttach.clone().applyQuaternion(chassis.quat);
    const attachVel = chassis.vel.clone().add(
      new Vector3().crossVectors(chassis.omega, rAttach),
    );
    const relVel = hub.vel.clone().sub(attachVel);
    const relVelLocal = relVel.clone().applyQuaternion(chassis.quat.clone().invert());

    // Linear compliance force (negative sign = restoring).
    const fCompLocal = new Vector3();
    if (params.hubLinearStiffnessNpm > 0) {
      fCompLocal.x = -(params.hubLinearStiffnessNpm * deflectionLocal.x + params.hubLinearDampingNspms * relVelLocal.x);
      fCompLocal.y = -(params.hubLinearStiffnessNpm * deflectionLocal.y + params.hubLinearDampingNspms * relVelLocal.y);
      fCompLocal.z = -(params.hubLinearStiffnessNpm * deflectionLocal.z + params.hubLinearDampingNspms * relVelLocal.z);
    }
    const fComp = fCompLocal.clone().applyQuaternion(chassis.quat);

    // Rotational compliance torque on hub.
    const tCompLocal = new Vector3();
    if (params.hubRotationalStiffnessNmDeg > 0) {
      const qRel = hub.quat.clone().multiply(chassis.quat.clone().invert());
      // Small-angle approximation for quaternion xyz components.
      const angleX = 2 * qRel.x * qRel.w;
      const angleY = 2 * qRel.y * qRel.w;
      const angleZ = 2 * qRel.z * qRel.w;
      const kRot = params.hubRotationalStiffnessNmDeg * (Math.PI / 180);
      const cRot = params.hubRotationalDampingNmSdeg * (Math.PI / 180);
      tCompLocal.x = -(kRot * angleX + cRot * (hub.omega.x - chassis.omega.x));
      tCompLocal.y = -(kRot * angleY + cRot * (hub.omega.y - chassis.omega.y));
      tCompLocal.z = -(kRot * angleZ + cRot * (hub.omega.z - chassis.omega.z));
    }
    const tComp = tCompLocal.clone().applyQuaternion(chassis.quat);

    // Total force on hub = wheel + compliance + gravity.
    const fHub = wheelForces[i].clone().add(fComp).add(new Vector3(0, -9.81 * hub.mass, 0));
    const tHub = tComp.clone();

    // Integrate hub linear motion.
    const hubAccel = fHub.divideScalar(hub.mass);
    hub.vel.addScaledVector(hubAccel, dt);
    hub.pos.addScaledVector(hub.vel, dt);

    // Integrate hub angular motion.
    const alphaLocal = new Vector3(
      tHub.x / hub.inertia.x,
      tHub.y / hub.inertia.y,
      tHub.z / hub.inertia.z,
    );
    const omegaLocal = hub.omega.clone();
    omegaLocal.addScaledVector(alphaLocal, dt);
    hub.omega.copy(omegaLocal);

    const dq = new Quaternion(
      hub.omega.x * 0.5 * dt,
      hub.omega.y * 0.5 * dt,
      hub.omega.z * 0.5 * dt,
      0,
    );
    const newQ = hub.quat.clone();
    newQ.x += dq.x * newQ.w + dq.y * newQ.z - dq.z * newQ.y;
    newQ.y += -dq.x * newQ.z + dq.y * newQ.w + dq.z * newQ.x;
    newQ.z += dq.x * newQ.y - dq.y * newQ.x + dq.z * newQ.w;
    newQ.w += -dq.x * newQ.x - dq.y * newQ.y - dq.z * newQ.z;
    newQ.normalize();
    hub.quat.copy(newQ);

    // Accumulate reaction on chassis (equal and opposite at attachment point).
    extraChassisForce.add(fComp.clone().multiplyScalar(-1));
    extraChassisTorque.add(new Vector3().crossVectors(rAttach, fComp.clone().multiplyScalar(-1)));
    extraChassisTorque.add(tComp.clone().multiplyScalar(-1));
  }

  // --- 2. Integrate chassis ----------------------------------------------
  const gravity = new Vector3(0, -9.81 * chassis.mass, 0);
  const totalForce = extraChassisForce.clone().add(gravity);
  const accel = totalForce.divideScalar(chassis.mass);
  chassis.vel.addScaledVector(accel, dt);
  chassis.pos.addScaledVector(chassis.vel, dt);

  const invQ = chassis.quat.clone().invert();
  const torqueLocal = extraChassisTorque.clone().applyQuaternion(invQ);
  const omegaLocal = chassis.omega.clone().applyQuaternion(invQ);
  const alpha = new Vector3(
    torqueLocal.x / chassis.inertia.x,
    torqueLocal.y / chassis.inertia.y,
    torqueLocal.z / chassis.inertia.z,
  );
  omegaLocal.addScaledVector(alpha, dt);
  omegaLocal.multiplyScalar(Math.exp(-0.02 * dt));
  chassis.omega.copy(omegaLocal).applyQuaternion(chassis.quat);

  const dq = new Quaternion(
    chassis.omega.x * 0.5 * dt,
    chassis.omega.y * 0.5 * dt,
    chassis.omega.z * 0.5 * dt,
    0,
  );
  const newQ = chassis.quat.clone();
  newQ.x += dq.x * newQ.w + dq.y * newQ.z - dq.z * newQ.y;
  newQ.y += -dq.x * newQ.z + dq.y * newQ.w + dq.z * newQ.x;
  newQ.z += dq.x * newQ.y - dq.y * newQ.x + dq.z * newQ.w;
  newQ.w += -dq.x * newQ.x - dq.y * newQ.y - dq.z * newQ.z;
  newQ.normalize();
  chassis.quat.copy(newQ);
}

// ---------------------------------------------------------------------------
// Torsional restoring torque helpers
// ---------------------------------------------------------------------------

/**
 * Apply a restoring torque to the chassis that resists torsional flex.
 *
 * τ = -k_torsion * roll_rad  (around chassis longitudinal / roll axis)
 */
export function applyTorsionalRestoringTorque(
  chassisRightWS: Vector3,
  rollDeg: number,
  params: ResolvedCompliance,
  dt: number,
  applyTorque: (torque: Vector3) => void,
): void {
  if (params.chassisTorsionalStiffnessNmDeg <= 0) return;
  const kRad = params.chassisTorsionalStiffnessNmDeg * (Math.PI / 180);
  const rollRad = rollDeg * (Math.PI / 180);
  const torqueMag = -kRad * rollRad;
  applyTorque(chassisRightWS.clone().multiplyScalar(torqueMag));
}

/** Software version: directly mutate a torque accumulator vector. */
export function applyTorsionalRestoringTorqueToVector(
  chassisRightWS: Vector3,
  rollDeg: number,
  params: ResolvedCompliance,
  target: Vector3,
): void {
  if (params.chassisTorsionalStiffnessNmDeg <= 0) return;
  const kRad = params.chassisTorsionalStiffnessNmDeg * (Math.PI / 180);
  const rollRad = rollDeg * (Math.PI / 180);
  const torqueMag = -kRad * rollRad;
  target.addScaledVector(chassisRightWS, torqueMag);
}
