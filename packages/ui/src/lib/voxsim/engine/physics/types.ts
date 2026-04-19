/**
 * Physics-facing types. All plain-data records — no `jolt-physics` import is
 * allowed in this file so plans 03+ can bind to the physics surface without
 * pulling in the WASM module. The `JoltSystem` implementation translates these
 * into the corresponding Jolt classes internally.
 */

import type { Quat, Transform, Vec3 } from '../../types.js';

export type PhysicsLayer = 'static' | 'dynamic';

export interface PhysicsLayerFilter {
  include: PhysicsLayer[];
}

export interface BodyHandle {
  readonly id: number;
  readonly layer: PhysicsLayer;
  readonly userTag?: string;
}

export interface ConstraintHandle {
  readonly id: number;
  readonly kind: ConstraintSpec['kind'];
  readonly bodyA: BodyHandle;
  readonly bodyB: BodyHandle;
}

export interface ShapeHandle {
  readonly id: number;
  readonly kind: ShapeSpec['kind'];
}

export interface RayHit {
  bodyHandle: BodyHandle;
  point: Vec3;
  normal: Vec3;
  distance: number;
  userTag?: string;
}

export interface OverlapHit {
  bodyHandle: BodyHandle;
  userTag?: string;
}

export type MotorMode = 'off' | 'velocity' | 'position';

export interface MotorParams {
  mode: MotorMode;
  maxForce: number;
  /** Hertz; for spring-based position motors. */
  springFrequency?: number;
  /** Damping ratio; for spring-based position motors. */
  springDamping?: number;
}

export interface MotorTarget {
  /** Setpoint in radians for hinge/swing-twist position motors, or m/s for slider velocity motors. */
  value: number;
  /** Optional secondary value (e.g. position motors that also accept velocity). */
  velocity?: number;
}

export interface SixDofMotors {
  translationX?: MotorParams;
  translationY?: MotorParams;
  translationZ?: MotorParams;
  rotationX?: MotorParams;
  rotationY?: MotorParams;
  rotationZ?: MotorParams;
}

export interface TranslationLimits {
  minX: number; maxX: number;
  minY: number; maxY: number;
  minZ: number; maxZ: number;
}

export interface RotationLimits {
  /** All angles in radians. */
  minX: number; maxX: number;
  minY: number; maxY: number;
  minZ: number; maxZ: number;
}

// -----------------------------------------------------------------------------
// Shape specs
// -----------------------------------------------------------------------------

export type ShapeSpec =
  | { kind: 'box'; halfExtents: Vec3 }
  | { kind: 'sphere'; radius: number }
  | { kind: 'capsule'; halfHeight: number; radius: number }
  | { kind: 'compound'; children: { shape: ShapeSpec; transform: Transform }[] }
  | { kind: 'mesh'; vertices: Float32Array; indices: Uint32Array }
  | {
      kind: 'heightField';
      samples: Float32Array;
      columns: number;
      rows: number;
      spacingXz: number;
    };

// -----------------------------------------------------------------------------
// Body specs
// -----------------------------------------------------------------------------

export type BodyKind = 'static' | 'dynamic' | 'kinematic';

export interface BodySpec {
  kind: BodyKind;
  layer?: PhysicsLayer;
  shape: ShapeSpec;
  transform: Transform;
  /** Mass in kg. Only meaningful for `dynamic`; defaults to 1. */
  mass?: number;
  friction?: number;
  restitution?: number;
  linearDamping?: number;
  angularDamping?: number;
  /** Debug label only. Never used by physics resolution. */
  userTag?: string;
}

// -----------------------------------------------------------------------------
// Constraint specs
// -----------------------------------------------------------------------------

interface ConstraintBase {
  bodyA: BodyHandle;
  bodyB: BodyHandle;
}

export type ConstraintSpec =
  | (ConstraintBase & {
      kind: 'fixed';
      transformA: Transform;
      transformB: Transform;
    })
  | (ConstraintBase & {
      kind: 'hinge';
      pivot: Vec3;
      axis: Vec3;
      minAngle: number;
      maxAngle: number;
      motor?: MotorParams;
    })
  | (ConstraintBase & {
      kind: 'slider';
      pivot: Vec3;
      axis: Vec3;
      minDistance: number;
      maxDistance: number;
      motor?: MotorParams;
    })
  | (ConstraintBase & {
      kind: 'swingTwist';
      position: Vec3;
      twistAxis: Vec3;
      planeAxis: Vec3;
      normalHalfConeAngle: number;
      planeHalfConeAngle: number;
      twistMinAngle: number;
      twistMaxAngle: number;
      motor?: MotorParams;
    })
  | (ConstraintBase & {
      kind: 'sixDof';
      position: Vec3;
      axisX: Vec3;
      axisY: Vec3;
      translationLimits: TranslationLimits;
      rotationLimits: RotationLimits;
      motors?: SixDofMotors;
    });

// -----------------------------------------------------------------------------
// Snapshots & queries
// -----------------------------------------------------------------------------

export interface PhysicsBodySnapshot {
  handle: BodyHandle;
  previous: Transform;
  latest: Transform;
}

export interface PhysicsSnapshot {
  bodies: PhysicsBodySnapshot[];
  stepIndex: number;
}

export type ShapeQuery =
  | { kind: 'box'; halfExtents: Vec3; transform: Transform }
  | { kind: 'sphere'; radius: number; center: Vec3 }
  | { kind: 'capsule'; halfHeight: number; radius: number; transform: Transform };

// -----------------------------------------------------------------------------
// Physics system contract (implemented by JoltSystem & NullPhysicsSystem)
// -----------------------------------------------------------------------------

export interface PhysicsConfig {
  gravity: Vec3;
  numThreads?: number;
  maxBodies?: number;
  maxBodyPairs?: number;
  maxContactConstraints?: number;
  /**
   * Optional override for the WASM `locateFile` resolver. When omitted, the
   * loader resolves bundled assets from `/voxsim/jolt/`.
   */
  wasmLocateFile?: (file: string) => string;
}

export interface DebugLineSegment {
  from: Vec3;
  to: Vec3;
  color: number;
}

export interface IPhysicsSystem {
  init(config: PhysicsConfig): Promise<void>;
  loadArenaColliders(arena: import('../../types.js').ArenaDefinition): void;
  unloadArenaColliders(): void;
  step(dtMs: number): void;
  snapshot(): PhysicsSnapshot;
  dispose(): void;

  createBody(spec: BodySpec): BodyHandle;
  removeBody(handle: BodyHandle): void;

  addConstraint(spec: ConstraintSpec): ConstraintHandle;
  removeConstraint(handle: ConstraintHandle): void;
  setMotorTarget(handle: ConstraintHandle, target: MotorTarget): void;

  getBodyTransform(handle: BodyHandle): Transform;
  setBodyTransform(handle: BodyHandle, transform: Transform): void;
  applyImpulse(handle: BodyHandle, impulse: Vec3, at?: Vec3): void;

  /** World-frame linear velocity. Returns zeros for static bodies. */
  getBodyLinearVelocity(handle: BodyHandle): Vec3;
  /** World-frame angular velocity (radians per second). Returns zeros for static bodies. */
  getBodyAngularVelocity(handle: BodyHandle): Vec3;

  castRay(
    origin: Vec3,
    direction: Vec3,
    maxDistance: number,
    filter?: PhysicsLayerFilter,
  ): RayHit | undefined;
  queryOverlap(shape: ShapeQuery, filter?: PhysicsLayerFilter): OverlapHit[];

  getDebugLines?(): DebugLineSegment[];
}

export function defaultPhysicsConfig(gravity: Vec3): Required<Omit<PhysicsConfig, 'wasmLocateFile'>> & {
  wasmLocateFile?: PhysicsConfig['wasmLocateFile'];
} {
  return {
    gravity,
    numThreads: 1,
    maxBodies: 8192,
    maxBodyPairs: 16384,
    maxContactConstraints: 8192,
  };
}

/** Helper to copy a Vec3 without aliasing. */
export function cloneVec3(v: Vec3): Vec3 {
  return { x: v.x, y: v.y, z: v.z };
}

/** Helper to copy a Quat without aliasing. */
export function cloneQuat(q: Quat): Quat {
  return { x: q.x, y: q.y, z: q.z, w: q.w };
}

/** Helper to copy a Transform without aliasing. */
export function cloneTransform(t: Transform): Transform {
  return { position: cloneVec3(t.position), rotation: cloneQuat(t.rotation) };
}
