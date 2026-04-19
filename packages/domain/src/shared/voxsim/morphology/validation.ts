/**
 * Pure validation for `BodyDna`.
 *
 * Mirrors the shape of `validateArenaDefinition` from the arena layer so the
 * editor and persistence paths can apply both validators uniformly.
 */

import type { ActuatorEntry } from './actuator-map.js';
import type { BodyDna, SegmentSpec } from './body-dna.js';
import type { JointSpec, MotorSpec } from './joint-spec.js';
import { motorsOf } from './joint-spec.js';
import type { SensorSpec } from './sensor-spec.js';

export interface BodyDnaValidationIssue {
  code: string;
  message: string;
  segmentId?: string;
  jointId?: string;
  sensorId?: string;
  actuatorId?: string;
}

export interface BodyDnaValidationResult {
  ok: boolean;
  errors: BodyDnaValidationIssue[];
  warnings: BodyDnaValidationIssue[];
}

function isFinitePositive(n: number): boolean {
  return Number.isFinite(n) && n > 0;
}

function massOf(seg: SegmentSpec): number {
  return seg.mass;
}

function shapeIsPositive(seg: SegmentSpec): boolean {
  switch (seg.shape.kind) {
    case 'box':
      return (
        isFinitePositive(seg.shape.halfExtents.x) &&
        isFinitePositive(seg.shape.halfExtents.y) &&
        isFinitePositive(seg.shape.halfExtents.z)
      );
    case 'sphere':
      return isFinitePositive(seg.shape.radius);
    case 'capsule':
      return isFinitePositive(seg.shape.halfHeight) && isFinitePositive(seg.shape.radius);
    default: {
      const _exhaustive: never = seg.shape;
      void _exhaustive;
      return false;
    }
  }
}

function angleOrderOk(min: number, max: number): boolean {
  return Number.isFinite(min) && Number.isFinite(max) && min <= max;
}

function checkMotor(
  motor: MotorSpec,
  actuatorIds: Set<string>,
  jointId: string,
  errors: BodyDnaValidationIssue[],
): void {
  if (!isFinitePositive(motor.maxForce)) {
    errors.push({
      code: 'motor.max-force-non-positive',
      message: `Joint ${jointId} motor (actuator ${motor.actuatorId}) has non-positive maxForce.`,
      jointId,
      actuatorId: motor.actuatorId,
    });
  }
  if (!actuatorIds.has(motor.actuatorId)) {
    errors.push({
      code: 'motor.actuator-id-missing',
      message: `Joint ${jointId} references actuatorId "${motor.actuatorId}" which is not in actuators.`,
      jointId,
      actuatorId: motor.actuatorId,
    });
  }
}

function checkJointLimits(
  joint: JointSpec,
  errors: BodyDnaValidationIssue[],
): void {
  switch (joint.kind) {
    case 'hinge':
      if (!angleOrderOk(joint.minAngle, joint.maxAngle)) {
        errors.push({
          code: 'joint.angle-limits-inverted',
          message: `Hinge ${joint.id} requires minAngle <= maxAngle.`,
          jointId: joint.id,
        });
      }
      break;
    case 'slider':
      if (!angleOrderOk(joint.minDistance, joint.maxDistance)) {
        errors.push({
          code: 'joint.distance-limits-inverted',
          message: `Slider ${joint.id} requires minDistance <= maxDistance.`,
          jointId: joint.id,
        });
      }
      break;
    case 'swingTwist':
      if (!angleOrderOk(joint.twistMinAngle, joint.twistMaxAngle)) {
        errors.push({
          code: 'joint.angle-limits-inverted',
          message: `SwingTwist ${joint.id} requires twistMinAngle <= twistMaxAngle.`,
          jointId: joint.id,
        });
      }
      if (joint.normalHalfConeAngle < 0 || joint.planeHalfConeAngle < 0) {
        errors.push({
          code: 'joint.cone-angle-negative',
          message: `SwingTwist ${joint.id} cone angles must be non-negative.`,
          jointId: joint.id,
        });
      }
      break;
    case 'sixDof': {
      const t = joint.translationLimits;
      const r = joint.rotationLimits;
      if (
        !angleOrderOk(t.minX, t.maxX) ||
        !angleOrderOk(t.minY, t.maxY) ||
        !angleOrderOk(t.minZ, t.maxZ)
      ) {
        errors.push({
          code: 'joint.translation-limits-inverted',
          message: `SixDof ${joint.id} translation limits invalid.`,
          jointId: joint.id,
        });
      }
      if (
        !angleOrderOk(r.minX, r.maxX) ||
        !angleOrderOk(r.minY, r.maxY) ||
        !angleOrderOk(r.minZ, r.maxZ)
      ) {
        errors.push({
          code: 'joint.rotation-limits-inverted',
          message: `SixDof ${joint.id} rotation limits invalid.`,
          jointId: joint.id,
        });
      }
      break;
    }
    case 'fixed':
      break;
    default: {
      const _exhaustive: never = joint;
      void _exhaustive;
      break;
    }
  }
}

function jointGraphIsTree(
  joints: JointSpec[],
  segmentIds: Set<string>,
  rootSegmentId: string,
  errors: BodyDnaValidationIssue[],
): void {
  // Each non-root segment should have exactly one incoming joint edge from a
  // parent, and traversal from the root must reach every segment with no
  // cycles.
  const parentOf = new Map<string, string>();
  for (const j of joints) {
    if (!segmentIds.has(j.parentSegmentId)) {
      errors.push({
        code: 'joint.parent-missing',
        message: `Joint ${j.id} parentSegmentId "${j.parentSegmentId}" not found in segments.`,
        jointId: j.id,
      });
    }
    if (!segmentIds.has(j.childSegmentId)) {
      errors.push({
        code: 'joint.child-missing',
        message: `Joint ${j.id} childSegmentId "${j.childSegmentId}" not found in segments.`,
        jointId: j.id,
      });
    }
    if (j.childSegmentId === rootSegmentId) {
      errors.push({
        code: 'joint.child-is-root',
        message: `Joint ${j.id} child cannot be the root segment "${rootSegmentId}".`,
        jointId: j.id,
      });
    }
    if (parentOf.has(j.childSegmentId)) {
      errors.push({
        code: 'joint.duplicate-parent',
        message: `Segment ${j.childSegmentId} has more than one parent joint (cycle/duplicate).`,
        jointId: j.id,
      });
      continue;
    }
    parentOf.set(j.childSegmentId, j.parentSegmentId);
  }

  // Walk from root using parentOf reversed.
  const childrenOf = new Map<string, string[]>();
  for (const [child, parent] of parentOf) {
    const arr = childrenOf.get(parent) ?? [];
    arr.push(child);
    childrenOf.set(parent, arr);
  }

  if (!segmentIds.has(rootSegmentId)) {
    errors.push({
      code: 'body.root-missing',
      message: `rootSegmentId "${rootSegmentId}" not found in segments.`,
    });
    return;
  }

  const visited = new Set<string>();
  const stack: string[] = [rootSegmentId];
  while (stack.length > 0) {
    const cur = stack.pop()!;
    if (visited.has(cur)) {
      errors.push({
        code: 'joint.cycle-detected',
        message: `Cycle detected at segment "${cur}".`,
        segmentId: cur,
      });
      continue;
    }
    visited.add(cur);
    for (const c of childrenOf.get(cur) ?? []) stack.push(c);
  }

  for (const segId of segmentIds) {
    if (!visited.has(segId)) {
      errors.push({
        code: 'segment.unreachable-from-root',
        message: `Segment "${segId}" is not reachable from root "${rootSegmentId}".`,
        segmentId: segId,
      });
    }
  }
}

function checkSensor(
  sensor: SensorSpec,
  segmentIds: Set<string>,
  jointIds: Set<string>,
  errors: BodyDnaValidationIssue[],
): void {
  switch (sensor.kind) {
    case 'jointAngle':
    case 'jointAngularVelocity':
      if (!jointIds.has(sensor.jointId)) {
        errors.push({
          code: 'sensor.joint-missing',
          message: `Sensor ${sensor.id} references unknown jointId "${sensor.jointId}".`,
          sensorId: sensor.id,
        });
      }
      break;
    case 'groundContact':
    case 'imuOrientation':
    case 'imuAngularVelocity':
    case 'bodyVelocity':
      if (!segmentIds.has(sensor.segmentId)) {
        errors.push({
          code: 'sensor.segment-missing',
          message: `Sensor ${sensor.id} references unknown segmentId "${sensor.segmentId}".`,
          sensorId: sensor.id,
        });
      }
      break;
    case 'voxelSightShort':
      if (!segmentIds.has(sensor.segmentId)) {
        errors.push({
          code: 'sensor.segment-missing',
          message: `Sensor ${sensor.id} references unknown segmentId "${sensor.segmentId}".`,
          sensorId: sensor.id,
        });
      }
      if (!isFinitePositive(sensor.maxDistance)) {
        errors.push({
          code: 'sensor.max-distance-non-positive',
          message: `Sensor ${sensor.id} maxDistance must be positive.`,
          sensorId: sensor.id,
        });
      }
      if (!Number.isInteger(sensor.rayCount) || sensor.rayCount <= 0) {
        errors.push({
          code: 'sensor.ray-count-invalid',
          message: `Sensor ${sensor.id} rayCount must be a positive integer.`,
          sensorId: sensor.id,
        });
      }
      break;
    case 'proximityToFood':
      if (!segmentIds.has(sensor.segmentId)) {
        errors.push({
          code: 'sensor.segment-missing',
          message: `Sensor ${sensor.id} references unknown segmentId "${sensor.segmentId}".`,
          sensorId: sensor.id,
        });
      }
      if (!isFinitePositive(sensor.maxDistance)) {
        errors.push({
          code: 'sensor.max-distance-non-positive',
          message: `Sensor ${sensor.id} maxDistance must be positive.`,
          sensorId: sensor.id,
        });
      }
      break;
    default: {
      const _exhaustive: never = sensor;
      void _exhaustive;
      break;
    }
  }
}

export function validateBodyDna(dna: BodyDna): BodyDnaValidationResult {
  const errors: BodyDnaValidationIssue[] = [];
  const warnings: BodyDnaValidationIssue[] = [];

  const segmentIds = new Set<string>();
  for (const seg of dna.segments) {
    if (segmentIds.has(seg.id)) {
      errors.push({
        code: 'segment.duplicate-id',
        message: `Duplicate segment id "${seg.id}".`,
        segmentId: seg.id,
      });
    }
    segmentIds.add(seg.id);

    if (!isFinitePositive(massOf(seg))) {
      errors.push({
        code: 'segment.mass-non-positive',
        message: `Segment "${seg.id}" mass must be positive (got ${seg.mass}).`,
        segmentId: seg.id,
      });
    }
    if (!shapeIsPositive(seg)) {
      errors.push({
        code: 'segment.shape-non-positive',
        message: `Segment "${seg.id}" shape has non-positive dimensions.`,
        segmentId: seg.id,
      });
    }
  }

  const jointIds = new Set<string>();
  for (const j of dna.joints) {
    if (jointIds.has(j.id)) {
      errors.push({
        code: 'joint.duplicate-id',
        message: `Duplicate joint id "${j.id}".`,
        jointId: j.id,
      });
    }
    jointIds.add(j.id);
    checkJointLimits(j, errors);
  }

  jointGraphIsTree(dna.joints, segmentIds, dna.rootSegmentId, errors);

  const actuatorIds = new Set<string>();
  for (const a of dna.actuators.actuators) {
    if (actuatorIds.has(a.id)) {
      errors.push({
        code: 'actuator.duplicate-id',
        message: `Duplicate actuator id "${a.id}".`,
        actuatorId: a.id,
      });
    }
    actuatorIds.add(a.id);
  }

  // Track which actuators are referenced by motors; mismatch is a warning if
  // there are extra unused actuators, but an error if a motor points at an
  // unknown actuator (handled in checkMotor).
  const referencedActuators = new Set<string>();
  for (const j of dna.joints) {
    for (const m of motorsOf(j)) {
      checkMotor(m, actuatorIds, j.id, errors);
      referencedActuators.add(m.actuatorId);
    }
  }

  for (const a of dna.actuators.actuators) {
    if (!referencedActuators.has(a.id)) {
      warnings.push({
        code: 'actuator.unreferenced',
        message: `Actuator "${a.id}" is declared but not referenced by any motor.`,
        actuatorId: a.id,
      });
    }
  }

  if (referencedActuators.size !== dna.actuators.actuators.length) {
    // The action vector layout is the actuators array; missing references mean
    // some entries do nothing. This is a soft mismatch (warning above), but a
    // hard error only when a motor points at a missing actuator (already
    // recorded). So nothing to do here.
  }

  for (const s of dna.sensors) {
    checkSensor(s, segmentIds, jointIds, errors);
  }

  return { ok: errors.length === 0, errors, warnings };
}

void ([] as ActuatorEntry[]);
