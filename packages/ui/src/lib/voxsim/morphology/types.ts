/**
 * Local UI types mirror for voxsim morphology.
 *
 * Mirrors `packages/domain/src/shared/voxsim/morphology/`. The domain types
 * satisfy these structurally when callers pass them in. If you change a field
 * in the shared morphology types, mirror the change here in the same commit.
 */

import type { Quat, Transform, Vec3 } from '../types.js';

export type OrganismKind = 'robot' | 'bioOrganism';

export type SegmentShapeSpec =
  | { kind: 'box'; halfExtents: Vec3 }
  | { kind: 'sphere'; radius: number }
  | { kind: 'capsule'; halfHeight: number; radius: number };

export interface SegmentSpec {
  id: string;
  tag: string;
  shape: SegmentShapeSpec;
  mass: number;
  restPose: Transform;
  friction?: number;
  restitution?: number;
  colorHint?: string;
  selfCollidesWith?: string[];
}

export type MotorMode = 'off' | 'velocity' | 'position';

export interface MotorSpec {
  mode: MotorMode;
  maxForce: number;
  springFrequency?: number;
  springDamping?: number;
  actuatorId: string;
}

export type SixDofMotorAxis =
  | 'translationX'
  | 'translationY'
  | 'translationZ'
  | 'rotationX'
  | 'rotationY'
  | 'rotationZ';

export type SixDofMotorSpecs = Partial<Record<SixDofMotorAxis, MotorSpec>>;

export interface SegmentTranslationLimits {
  minX: number; maxX: number;
  minY: number; maxY: number;
  minZ: number; maxZ: number;
}

export interface SegmentRotationLimits {
  minX: number; maxX: number;
  minY: number; maxY: number;
  minZ: number; maxZ: number;
}

interface JointBase {
  id: string;
  parentSegmentId: string;
  childSegmentId: string;
}

export type JointSpec =
  | (JointBase & {
      kind: 'fixed';
      transformOnParent: Transform;
      transformOnChild: Transform;
    })
  | (JointBase & {
      kind: 'hinge';
      pivotOnParent: Vec3;
      axisOnParent: Vec3;
      minAngle: number;
      maxAngle: number;
      motor?: MotorSpec;
    })
  | (JointBase & {
      kind: 'slider';
      pivotOnParent: Vec3;
      axisOnParent: Vec3;
      minDistance: number;
      maxDistance: number;
      motor?: MotorSpec;
    })
  | (JointBase & {
      kind: 'swingTwist';
      positionOnParent: Vec3;
      twistAxisOnParent: Vec3;
      planeAxisOnParent: Vec3;
      normalHalfConeAngle: number;
      planeHalfConeAngle: number;
      twistMinAngle: number;
      twistMaxAngle: number;
      motor?: MotorSpec;
    })
  | (JointBase & {
      kind: 'sixDof';
      positionOnParent: Vec3;
      axisXOnParent: Vec3;
      axisYOnParent: Vec3;
      translationLimits: SegmentTranslationLimits;
      rotationLimits: SegmentRotationLimits;
      motors?: SixDofMotorSpecs;
    });

export type SensorSpec =
  | {
      kind: 'groundContact';
      id: string;
      segmentId: string;
      thresholdRadians?: number;
    }
  | { kind: 'jointAngle'; id: string; jointId: string }
  | { kind: 'jointAngularVelocity'; id: string; jointId: string }
  | { kind: 'imuOrientation'; id: string; segmentId: string }
  | { kind: 'imuAngularVelocity'; id: string; segmentId: string }
  | { kind: 'bodyVelocity'; id: string; segmentId: string }
  | {
      kind: 'voxelSightShort';
      id: string;
      segmentId: string;
      rayCount: number;
      halfFovRadians: number;
      maxDistance: number;
    }
  | {
      kind: 'proximityToFood';
      id: string;
      segmentId: string;
      maxDistance: number;
    };

export type SensorKind = SensorSpec['kind'];

export type ActuatorMode =
  | 'targetAngle'
  | 'targetVelocity'
  | 'targetForce'
  | 'boolGate';

export interface ActuatorRange { min: number; max: number }

export interface ActuatorEntry {
  id: string;
  range: ActuatorRange;
  mode: ActuatorMode;
}

export interface ActuatorMap {
  actuators: ActuatorEntry[];
}

export interface LineageRef {
  parentBodyDnaId?: string;
  mutationSummary?: string;
  generation?: number;
}

export interface BodyDnaMetadata {
  name: string;
  createdAt: string;
  updatedAt: string;
  author: string;
}

export interface BodyDna {
  id: string;
  version: number;
  kind: OrganismKind;
  rootSegmentId: string;
  segments: SegmentSpec[];
  joints: JointSpec[];
  sensors: SensorSpec[];
  actuators: ActuatorMap;
  lineage?: LineageRef;
  metadata: BodyDnaMetadata;
}

export interface DeathRule {
  deathFromTilt?: { segmentId: string; toleranceRadians: number };
  deathFromContact?: { segmentId: string; voxelKinds: string[] };
  deathFromTimeout?: { maxSteps: number };
}

export function outputWidth(spec: SensorSpec): number {
  switch (spec.kind) {
    case 'groundContact':
    case 'jointAngle':
    case 'jointAngularVelocity':
    case 'proximityToFood':
      return 1;
    case 'imuOrientation':
      return 4;
    case 'imuAngularVelocity':
    case 'bodyVelocity':
      return 3;
    case 'voxelSightShort':
      return spec.rayCount;
    default: {
      const _exhaustive: never = spec;
      void _exhaustive;
      return 0;
    }
  }
}

export function motorsOf(joint: JointSpec): MotorSpec[] {
  switch (joint.kind) {
    case 'fixed':
      return [];
    case 'hinge':
    case 'slider':
    case 'swingTwist':
      return joint.motor ? [joint.motor] : [];
    case 'sixDof': {
      if (!joint.motors) return [];
      const out: MotorSpec[] = [];
      for (const key of [
        'translationX', 'translationY', 'translationZ',
        'rotationX', 'rotationY', 'rotationZ',
      ] as const) {
        const m = joint.motors[key];
        if (m) out.push(m);
      }
      return out;
    }
    default: {
      const _exhaustive: never = joint;
      void _exhaustive;
      return [];
    }
  }
}

// re-exports for convenience
export type { Quat, Transform, Vec3 };
