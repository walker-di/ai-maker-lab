import { describe, expect, test } from 'bun:test';
import { EngineWorld } from './world.js';

describe('EngineWorld', () => {
  test('adds and reads components by kind', () => {
    const world = new EngineWorld();
    const a = world.createEntity();
    world.addComponent(a, 'pos', { x: 1, y: 2 });
    expect(world.getComponent<{ x: number; y: number }>(a, 'pos')).toEqual({ x: 1, y: 2 });
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

  test('removeEntity frees all components and excludes it from queries', () => {
    const world = new EngineWorld();
    const a = world.createEntity();
    world.addComponent(a, 'k', {});
    world.removeEntity(a);
    expect(world.isAlive(a)).toBe(false);
    expect([...world.query(['k'])]).toEqual([]);
  });
});
