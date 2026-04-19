/**
 * Body DNA: the portable description of a robot or bio-organism.
 *
 * Browser-safe data only. The editor, the trainer, the persistence layer, and
 * the replay viewer all operate on this same type. The UI's `MorphologyBuilder`
 * (plan 03) consumes a `BodyDna` plus a root pose and produces an `AgentHandle`
 * with Jolt bodies, constraints, and ECS components.
 */

import type { ActuatorMap } from './actuator-map.js';
import type { JointSpec } from './joint-spec.js';
import type { LineageRef } from './lineage.js';
import type { SensorSpec } from './sensor-spec.js';
import type { Transform, Vec3 } from './../vec.js';

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
  /** Initial pose relative to the body root frame. */
  restPose: Transform;
  friction?: number;
  restitution?: number;
  /** Hint for the renderer in plan 01 via the `agents` layer. Hex string. */
  colorHint?: string;
  /** Other segment ids this segment is allowed to collide with. Default empty. */
  selfCollidesWith?: string[];
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

/**
 * Optional death rules attached to a body DNA. Evaluated by `SensorSystem`
 * after sensor reads. The trainer (plan 05) owns respawn vs. episode-end
 * decisions; this is just the firing condition.
 */
export interface DeathRule {
  deathFromTilt?: { segmentId: string; toleranceRadians: number };
  deathFromContact?: { segmentId: string; voxelKinds: string[] };
  deathFromTimeout?: { maxSteps: number };
}
