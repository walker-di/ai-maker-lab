/**
 * ActuatorSystem: reads each agent's `action` Float32Array, clamps to range,
 * and forwards to the matching motor via `IPhysicsSystem.setMotorTarget`.
 *
 * Runs once per fixed step, after the brain layer (plan 04) writes actions.
 */

import type { IPhysicsSystem, MotorTarget } from '../engine/physics/types.js';
import type { EngineWorld, System, SystemContext } from '../engine/world.js';
import {
  MORPHOLOGY_COMPONENT_KINDS,
  type ActuatorEntryRuntime,
  type ActuatorsComponent,
  type AgentComponent,
} from './components.js';

export interface ActuatorSystemOptions {
  physics: IPhysicsSystem;
}

export class ActuatorSystem implements System {
  readonly name = 'morphology:actuators';
  private readonly physics: IPhysicsSystem;

  constructor(opts: ActuatorSystemOptions) {
    this.physics = opts.physics;
  }

  update(world: EngineWorld, _dt: number, _ctx: SystemContext): void {
    for (const entity of world.query([
      MORPHOLOGY_COMPONENT_KINDS.agent,
      MORPHOLOGY_COMPONENT_KINDS.actuators,
    ])) {
      const agent = world.getComponent<AgentComponent>(
        entity,
        MORPHOLOGY_COMPONENT_KINDS.agent,
      );
      const actuators = world.getComponent<ActuatorsComponent>(
        entity,
        MORPHOLOGY_COMPONENT_KINDS.actuators,
      );
      if (!agent || !actuators) continue;
      if (!agent.alive) continue;

      let energy = 0;
      const action = agent.action;

      for (const entry of actuators.entries) {
        const raw = action[entry.index] ?? 0;
        const clamped = clamp(raw, entry.range.min, entry.range.max);
        energy += Math.abs(clamped);
        forwardActuator(this.physics, entry, clamped);
      }

      agent.energyUsed += energy;
    }
  }
}

function clamp(v: number, lo: number, hi: number): number {
  if (v < lo) return lo;
  if (v > hi) return hi;
  return v;
}

function forwardActuator(
  physics: IPhysicsSystem,
  entry: ActuatorEntryRuntime,
  value: number,
): void {
  if (!entry.constraintHandle) return;
  let target: MotorTarget;
  switch (entry.mode) {
    case 'targetAngle':
      target = { value };
      break;
    case 'targetVelocity':
      target = { value, velocity: value };
      break;
    case 'targetForce':
      target = { value };
      break;
    case 'boolGate':
      target = { value: value > 0 ? entry.range.max : entry.range.min };
      break;
    default: {
      const _exhaustive: never = entry.mode;
      void _exhaustive;
      return;
    }
  }
  physics.setMotorTarget(entry.constraintHandle, target);
}
