/**
 * Actuator map + entry shapes.
 *
 * The actuator map defines the action vector layout. The brain layer (plan 04)
 * writes one float per `ActuatorEntry` in declared order; `ActuatorSystem`
 * (plan 03) clamps and forwards each float to the matching motor.
 */

export type ActuatorMode =
  | 'targetAngle'
  | 'targetVelocity'
  | 'targetForce'
  | 'boolGate';

export interface ActuatorRange {
  min: number;
  max: number;
}

export interface ActuatorEntry {
  id: string;
  range: ActuatorRange;
  mode: ActuatorMode;
}

export interface ActuatorMap {
  actuators: ActuatorEntry[];
}
