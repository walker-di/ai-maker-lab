/**
 * BrainSystem: runs after `SensorSystem`, before `ActuatorSystem`. For every
 * agent that has both `observation` and an attached `PolicyNetwork`, it
 * encodes the observation, runs `policy.act`, decodes the raw output into
 * `action`, and steps `stepsSinceSpawn`.
 *
 * Agents without an attached policy keep `action` as zero so `ActuatorSystem`
 * issues each motor's neutral target.
 */

import type { EngineWorld, System, SystemContext } from '../engine/world.js';
import {
  MORPHOLOGY_COMPONENT_KINDS,
  type AgentComponent,
} from '../morphology/components.js';
import type { PolicyNetwork } from './policy.js';

export interface BrainSystemOptions {
  /**
   * Resolves a policy by handle. The handle is whatever the engine's
   * `attachPolicy` API returned (typically a string). Returning `undefined`
   * skips the agent for this tick.
   */
  resolvePolicy: (handle: unknown) => PolicyNetwork | undefined;
}

export class BrainSystem implements System {
  readonly name = 'brain';
  private readonly resolvePolicy: BrainSystemOptions['resolvePolicy'];

  constructor(opts: BrainSystemOptions) {
    this.resolvePolicy = opts.resolvePolicy;
  }

  update(world: EngineWorld, _dt: number, _ctx: SystemContext): void {
    for (const entity of world.query([MORPHOLOGY_COMPONENT_KINDS.agent])) {
      const agent = world.getComponent<AgentComponent>(
        entity,
        MORPHOLOGY_COMPONENT_KINDS.agent,
      );
      if (!agent || !agent.alive) continue;
      agent.stepsSinceSpawn++;
      if (agent.policyHandle === undefined) {
        agent.action.fill(0);
        continue;
      }
      const policy = this.resolvePolicy(agent.policyHandle);
      if (!policy) {
        agent.action.fill(0);
        continue;
      }
      policy.act(agent.observation, agent.action);
    }
  }
}
