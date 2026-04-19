import { describe, expect, test } from 'bun:test';
import { BrainSystem } from './BrainSystem.js';
import { EngineWorld, SystemEventBus } from '../engine/world.js';
import {
  MORPHOLOGY_COMPONENT_KINDS,
  type AgentComponent,
} from '../morphology/components.js';
import type { ActivationFrame, PolicyNetwork } from './policy.js';
import type { NeatGenome } from './types.js';

class StubPolicy implements PolicyNetwork {
  calls = 0;
  async init(): Promise<void> {}
  setWeights(): void {}
  getWeights(): Float32Array {
    return new Float32Array();
  }
  setGenome(_g: NeatGenome): void {}
  getGenome(): NeatGenome {
    throw new Error('not implemented');
  }
  act(_observation: Float32Array, scratchAction: Float32Array): void {
    this.calls++;
    for (let i = 0; i < scratchAction.length; i++) scratchAction[i] = 0.5;
  }
  actBatch(): void {}
  resetEpisodeState(): void {}
  tap(_cb: (frame: ActivationFrame) => void) {
    return { dispose: () => {} };
  }
  dispose(): void {}
}

function makeAgent(world: EngineWorld, policyHandle: string | undefined): { entity: number; agent: AgentComponent } {
  const e = world.createEntity('agent');
  const agent: AgentComponent = {
    bodyDnaId: 'b',
    brainDnaId: 'br',
    policyHandle,
    observation: new Float32Array(2),
    action: new Float32Array(3),
    alive: true,
    stepsSinceSpawn: 0,
    energyUsed: 0,
  };
  world.addComponent<AgentComponent>(e, MORPHOLOGY_COMPONENT_KINDS.agent, agent);
  return { entity: e, agent };
}

describe('BrainSystem', () => {
  test('skips agents without an attached policy', () => {
    const world = new EngineWorld();
    const { agent } = makeAgent(world, undefined);
    agent.action.fill(7);
    const policy = new StubPolicy();
    const sys = new BrainSystem({ resolvePolicy: () => policy });
    sys.update(world, 0.016, { bus: new SystemEventBus(), stepIndex: 0 });
    expect(policy.calls).toBe(0);
    expect(agent.action[0]).toBe(0); // zeroed by skip path
    expect(agent.stepsSinceSpawn).toBe(1);
  });

  test('writes into agent.action when a policy is attached', () => {
    const world = new EngineWorld();
    const policy = new StubPolicy();
    const { agent } = makeAgent(world, 'h');
    const sys = new BrainSystem({ resolvePolicy: (h) => (h === 'h' ? policy : undefined) });
    sys.update(world, 0.016, { bus: new SystemEventBus(), stepIndex: 0 });
    expect(policy.calls).toBe(1);
    expect(agent.action[0]).toBeCloseTo(0.5);
  });

  test('skips dead agents entirely', () => {
    const world = new EngineWorld();
    const policy = new StubPolicy();
    const { agent } = makeAgent(world, 'h');
    agent.alive = false;
    const sys = new BrainSystem({ resolvePolicy: () => policy });
    sys.update(world, 0.016, { bus: new SystemEventBus(), stepIndex: 0 });
    expect(policy.calls).toBe(0);
    expect(agent.stepsSinceSpawn).toBe(0);
  });
});
