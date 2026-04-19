import { describe, expect, test } from 'bun:test';

import { EngineWorld } from './world.js';

describe('EngineWorld', () => {
  test('adds and reads components by kind', () => {
    const world = new EngineWorld();
    const a = world.createEntity();
    world.addComponent(a, 'pos', { x: 1, y: 2, z: 3 });
    expect(world.getComponent<{ x: number; y: number; z: number }>(a, 'pos')).toEqual({ x: 1, y: 2, z: 3 });
  });

  test('query returns only entities owning every requested kind', () => {
    const world = new EngineWorld();
    const a = world.createEntity();
    const b = world.createEntity();
    const c = world.createEntity();
    world.addComponent(a, 'pos', {});
    world.addComponent(a, 'vel', {});
    world.addComponent(b, 'pos', {});
    world.addComponent(c, 'vel', {});
    expect([...world.query(['pos', 'vel'])]).toEqual([a]);
    expect([...world.query(['pos'])].sort()).toEqual([a, b].sort());
  });

  test('removeEntity frees all components and excludes from queries', () => {
    const world = new EngineWorld();
    const a = world.createEntity();
    world.addComponent(a, 'k', {});
    world.removeEntity(a);
    expect(world.isAlive(a)).toBe(false);
    expect([...world.query(['k'])]).toEqual([]);
  });

  test('tagOf reflects assigned tags', () => {
    const world = new EngineWorld();
    const a = world.createEntity('player');
    expect(world.tagOf(a)).toBe('player');
    world.setTag(a, 'agent-1');
    expect(world.tagOf(a)).toBe('agent-1');
  });

  test('clear resets entity ids', () => {
    const world = new EngineWorld();
    world.createEntity();
    world.createEntity();
    world.clear();
    expect(world.entityCount()).toBe(0);
    const e = world.createEntity();
    expect(e).toBe(1);
  });
});
