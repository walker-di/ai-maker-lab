/**
 * Body-relative joint and motor spec types.
 *
 * These mirror the engine-frame `ConstraintSpec` from plan 02 but stay in body
 * coordinates so a `BodyDna` is portable (any spawn pose, any arena).
 *
 * See `02-jolt-physics-boundary.md` for the engine-frame contract that the UI
 * layer translates these into via `MorphologyBuilder`.
 */

import type { Quat, Transform, Vec3 } from './../vec.js';

export type MotorMode = 'off' | 'velocity' | 'position';

export interface MotorSpec {
  mode: MotorMode;
  maxForce: number;
  /** Hertz; for spring-based position motors. */
  springFrequency?: number;
  /** Damping ratio; for spring-based position motors. */
  springDamping?: number;
  /** Must match an `ActuatorEntry.id` in the body's `ActuatorMap`. */
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

/** Returns every motor spec on a joint as a flat array (sixDof has up to 6). */
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

// Re-exports so consumers only need to import from `joint-spec.js`.
export type { Quat, Transform, Vec3 };
