import { describe, expect, test } from 'bun:test';

import { EngineWorld, SystemEventBus } from '../engine/world.js';
import { NullPhysicsSystem } from '../engine/physics/null-physics.js';
import { ActuatorSystem } from './ActuatorSystem.js';
import { MorphologyBuilder } from './MorphologyBuilder.js';
import { SensorSystem } from './SensorSystem.js';
import {
  MORPHOLOGY_COMPONENT_KINDS,
  type ActuatorsComponent,
  type AgentComponent,
} from './components.js';
import { createSnakeDna } from './library/snake.js';

const ROOT_POSE = { position: { x: 0, y: 1, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 } };

describe('SensorSystem', () => {
  test('writes joint angle observations into the agent observation buffer', async () => {
    const physics = new NullPhysicsSystem();
    await physics.init({ gravity: { x: 0, y: -9.81, z: 0 } });
    const world = new EngineWorld();
    const builder = new MorphologyBuilder({ physics, world });
    const sensors = new SensorSystem({ physics });

    const dna = createSnakeDna({ segments: 3 });
    const handle = builder.build(dna, ROOT_POSE);
    const agent = world.getComponent<AgentComponent>(
      handle.agentEntity, MORPHOLOGY_COMPONENT_KINDS.agent,
    )!;

    sensors.update(world, 1 / 60, { bus: new SystemEventBus(), stepIndex: 0 });
    expect(agent.stepsSinceSpawn).toBe(1);
    // Observation values are finite numbers.
    for (let i = 0; i < agent.observation.length; i++) {
      expect(Number.isFinite(agent.observation[i] as number)).toBe(true);
    }
    physics.dispose();
  });

  test('skips dead agents', async () => {
    const physics = new NullPhysicsSystem();
    await physics.init({ gravity: { x: 0, y: -9.81, z: 0 } });
    const world = new EngineWorld();
    const builder = new MorphologyBuilder({ physics, world });
    const sensors = new SensorSystem({ physics });

    const dna = createSnakeDna({ segments: 2 });
    const handle = builder.build(dna, ROOT_POSE);
    const agent = world.getComponent<AgentComponent>(
      handle.agentEntity, MORPHOLOGY_COMPONENT_KINDS.agent,
    )!;
    agent.alive = false;

    sensors.update(world, 1 / 60, { bus: new SystemEventBus(), stepIndex: 0 });
    expect(agent.stepsSinceSpawn).toBe(0);
    physics.dispose();
  });
});

describe('ActuatorSystem', () => {
  test('clamps actions and accumulates energy', async () => {
    const physics = new NullPhysicsSystem();
    await physics.init({ gravity: { x: 0, y: -9.81, z: 0 } });
    const world = new EngineWorld();
    const builder = new MorphologyBuilder({ physics, world });
    const actuators = new ActuatorSystem({ physics });

    const dna = createSnakeDna({ segments: 3 });
    const handle = builder.build(dna, ROOT_POSE);
    const agent = world.getComponent<AgentComponent>(
      handle.agentEntity, MORPHOLOGY_COMPONENT_KINDS.agent,
    )!;
    const ac = world.getComponent<ActuatorsComponent>(
      handle.agentEntity, MORPHOLOGY_COMPONENT_KINDS.actuators,
    )!;

    for (let i = 0; i < agent.action.length; i++) agent.action[i] = 999;

    actuators.update(world, 1 / 60, { bus: new SystemEventBus(), stepIndex: 0 });
    // Energy is the sum of clamped magnitudes.
    let expectedEnergy = 0;
    for (const e of ac.entries) expectedEnergy += Math.abs(e.range.max);
    expect(agent.energyUsed).toBeCloseTo(expectedEnergy);
    physics.dispose();
  });

  test('honours boolGate mode', async () => {
    const physics = new NullPhysicsSystem();
    await physics.init({ gravity: { x: 0, y: -9.81, z: 0 } });
    const world = new EngineWorld();
    const builder = new MorphologyBuilder({ physics, world });
    const actuators = new ActuatorSystem({ physics });

    const dna = createSnakeDna({ segments: 2 });
    const handle = builder.build(dna, ROOT_POSE);
    const ac = world.getComponent<ActuatorsComponent>(
      handle.agentEntity, MORPHOLOGY_COMPONENT_KINDS.actuators,
    )!;
    ac.entries[0]!.mode = 'boolGate';
    const agent = world.getComponent<AgentComponent>(
      handle.agentEntity, MORPHOLOGY_COMPONENT_KINDS.agent,
    )!;
    agent.action[0] = -1;

    expect(() =>
      actuators.update(world, 1 / 60, { bus: new SystemEventBus(), stepIndex: 0 }),
    ).not.toThrow();
    physics.dispose();
  });
});
