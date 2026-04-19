import { describe, expect, test } from 'bun:test';

import { EngineWorld } from '../engine/world.js';
import { NullPhysicsSystem } from '../engine/physics/null-physics.js';
import { MorphologyBuilder, composeTransform } from './MorphologyBuilder.js';
import { MORPHOLOGY_COMPONENT_KINDS, type AgentComponent } from './components.js';
import { createBipedDna } from './library/biped.js';
import { createQuadrupedDna } from './library/quadruped.js';
import { createSnakeDna } from './library/snake.js';
import { motorsOf, outputWidth } from './types.js';

const ROOT_POSE = { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 } };

describe('MorphologyBuilder', () => {
  test('creates one body per segment and one constraint per joint', async () => {
    const physics = new NullPhysicsSystem();
    await physics.init({ gravity: { x: 0, y: -9.81, z: 0 } });
    const world = new EngineWorld();
    const builder = new MorphologyBuilder({ physics, world });
    const dna = createSnakeDna({ segments: 4 });

    const handle = builder.build(dna, ROOT_POSE);
    expect(handle.segmentBodies.size).toBe(dna.segments.length);
    expect(handle.jointConstraints.size).toBe(dna.joints.length);
    expect(world.entityCount()).toBeGreaterThan(0);
    physics.dispose();
  });

  test('observation and action buffers are sized from the dna', async () => {
    const physics = new NullPhysicsSystem();
    await physics.init({ gravity: { x: 0, y: -9.81, z: 0 } });
    const world = new EngineWorld();
    const builder = new MorphologyBuilder({ physics, world });
    const dna = createSnakeDna({ segments: 4 });

    const handle = builder.build(dna, ROOT_POSE);
    const agent = world.getComponent<AgentComponent>(
      handle.agentEntity,
      MORPHOLOGY_COMPONENT_KINDS.agent,
    )!;
    const expectedObs = dna.sensors.reduce((sum, s) => sum + outputWidth(s), 0);
    expect(agent.observation.length).toBe(expectedObs);
    expect(agent.action.length).toBe(dna.actuators.actuators.length);
    physics.dispose();
  });

  test('dispose removes bodies and constraints', async () => {
    const physics = new NullPhysicsSystem();
    await physics.init({ gravity: { x: 0, y: -9.81, z: 0 } });
    const world = new EngineWorld();
    const builder = new MorphologyBuilder({ physics, world });
    const dna = createSnakeDna({ segments: 3 });

    const handle = builder.build(dna, ROOT_POSE);
    const beforeBodies = physics.snapshot().bodies.length;
    builder.dispose(handle);
    const afterBodies = physics.snapshot().bodies.length;
    expect(afterBodies).toBe(beforeBodies - dna.segments.length);
    expect(world.isAlive(handle.agentEntity)).toBe(false);
    physics.dispose();
  });

  test('absolute world transforms compose along the segment tree', async () => {
    const physics = new NullPhysicsSystem();
    await physics.init({ gravity: { x: 0, y: -9.81, z: 0 } });
    const world = new EngineWorld();
    const builder = new MorphologyBuilder({ physics, world });
    const dna = createSnakeDna({ segments: 3, segmentLength: 0.5 });

    const handle = builder.build(dna, ROOT_POSE);
    const root = handle.segmentBodies.get('s0')!;
    const second = handle.segmentBodies.get('s1')!;
    const third = handle.segmentBodies.get('s2')!;

    const tRoot = physics.getBodyTransform(root);
    const tSecond = physics.getBodyTransform(second);
    const tThird = physics.getBodyTransform(third);

    expect(tSecond.position.z).toBeCloseTo(tRoot.position.z + 0.5);
    expect(tThird.position.z).toBeCloseTo(tRoot.position.z + 1.0);
    physics.dispose();
  });

  test('composeTransform composes parent and local correctly', () => {
    const parent = { position: { x: 1, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 } };
    const local = { position: { x: 0, y: 2, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 } };
    const out = composeTransform(parent, local);
    expect(out.position).toEqual({ x: 1, y: 2, z: 0 });
  });

  test('every starter morphology has a non-empty action vector', async () => {
    const physics = new NullPhysicsSystem();
    await physics.init({ gravity: { x: 0, y: -9.81, z: 0 } });
    const world = new EngineWorld();
    const builder = new MorphologyBuilder({ physics, world });

    const all = [createBipedDna(), createQuadrupedDna(), createSnakeDna()];
    for (const dna of all) {
      const h = builder.build(dna, ROOT_POSE);
      const agent = world.getComponent<AgentComponent>(
        h.agentEntity, MORPHOLOGY_COMPONENT_KINDS.agent,
      )!;
      expect(agent.action.length).toBeGreaterThan(0);
      // Every motorized joint has a matching actuator.
      const actuatorIds = new Set(dna.actuators.actuators.map((a) => a.id));
      for (const j of dna.joints) {
        for (const m of motorsOf(j)) {
          expect(actuatorIds.has(m.actuatorId)).toBe(true);
        }
      }
      builder.dispose(h);
    }
    physics.dispose();
  });
});
