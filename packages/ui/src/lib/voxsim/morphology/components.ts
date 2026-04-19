/**
 * Reserved ECS component kinds for the morphology subsystem.
 *
 * `MorphologyBuilder` attaches these components to the agent's entity. The
 * brain layer (plan 04) reads `Agent.observation` and writes `Agent.action`;
 * the trainer layer (plan 05) reads `Agent.alive`, `Agent.stepsSinceSpawn`,
 * and the energy total tracked by `ActuatorSystem`.
 */

import type { BodyHandle, ConstraintHandle } from '../engine/physics/types.js';
import type {
  ActuatorMode,
  ActuatorRange,
  JointSpec,
  SensorSpec,
} from './types.js';

export const MORPHOLOGY_COMPONENT_KINDS = {
  agent: 'morphology:agent',
  segments: 'morphology:segments',
  joints: 'morphology:joints',
  sensors: 'morphology:sensors',
  actuators: 'morphology:actuators',
} as const;

export type MorphologyComponentKind =
  (typeof MORPHOLOGY_COMPONENT_KINDS)[keyof typeof MORPHOLOGY_COMPONENT_KINDS];

export interface AgentComponent {
  bodyDnaId: string;
  brainDnaId?: string;
  policyHandle?: unknown;
  observation: Float32Array;
  action: Float32Array;
  alive: boolean;
  stepsSinceSpawn: number;
  /** Cumulative |action| sum (one term per step). Used by reward shaping. */
  energyUsed: number;
}

export interface SegmentEntry {
  id: string;
  bodyHandle: BodyHandle;
  /** Three.js mesh uuid; empty string when running headless. */
  meshId: string;
}

export interface SegmentsComponent {
  bodies: SegmentEntry[];
}

export interface JointEntry {
  id: string;
  constraintHandle: ConstraintHandle;
  jointSpec: JointSpec;
}

export interface JointsComponent {
  joints: JointEntry[];
}

export interface SensorEntry {
  spec: SensorSpec;
  /** Offset (in floats) into `AgentComponent.observation`. */
  offset: number;
  /** Number of floats this sensor writes. */
  width: number;
}

export interface SensorsComponent {
  sensors: SensorEntry[];
}

export interface ActuatorEntryRuntime {
  actuatorId: string;
  index: number;
  range: ActuatorRange;
  mode: ActuatorMode;
  /** The constraint whose motor this entry drives; undefined for boolGate placeholders. */
  constraintHandle?: ConstraintHandle;
}

export interface ActuatorsComponent {
  entries: ActuatorEntryRuntime[];
}
