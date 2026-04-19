import { describe, expect, test } from 'bun:test';

import { NullPhysicsSystem } from './null-physics.js';
import type { BodySpec, ConstraintSpec } from './types.js';
import { ordinalForVoxelKind, type ArenaDefinition } from '../../types.js';

const idTransform = {
  position: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
};

function spec(): BodySpec {
  return { kind: 'dynamic', shape: { kind: 'sphere', radius: 1 }, transform: idTransform };
}

describe('NullPhysicsSystem', () => {
  test('init / dispose are idempotent', async () => {
    const p = new NullPhysicsSystem();
    await p.init({ gravity: { x: 0, y: -9.81, z: 0 } });
    p.dispose();
    expect(p.snapshot().bodies.length).toBe(0);
  });

  test('createBody / removeBody track handles', async () => {
    const p = new NullPhysicsSystem();
    await p.init({ gravity: { x: 0, y: 0, z: 0 } });
    const a = p.createBody(spec());
    const b = p.createBody(spec());
    expect(a.id).not.toBe(b.id);
    expect(p.snapshot().bodies.length).toBe(2);
    p.removeBody(a);
    expect(p.snapshot().bodies.length).toBe(1);
  });

  test('snapshot increments stepIndex on each step', async () => {
    const p = new NullPhysicsSystem();
    await p.init({ gravity: { x: 0, y: 0, z: 0 } });
    expect(p.snapshot().stepIndex).toBe(0);
    p.step(16);
    expect(p.snapshot().stepIndex).toBe(1);
    p.step(16);
    expect(p.snapshot().stepIndex).toBe(2);
  });

  test('addConstraint stores a constraint handle', async () => {
    const p = new NullPhysicsSystem();
    await p.init({ gravity: { x: 0, y: 0, z: 0 } });
    const a = p.createBody(spec());
    const b = p.createBody(spec());
    const c: ConstraintSpec = {
      kind: 'hinge',
      bodyA: a,
      bodyB: b,
      pivot: { x: 0, y: 0, z: 0 },
      axis: { x: 0, y: 1, z: 0 },
      minAngle: -1,
      maxAngle: 1,
    };
    const h = p.addConstraint(c);
    expect(h.id).toBeGreaterThan(0);
    p.removeConstraint(h);
  });

  test('loadArenaColliders is a no-op without throwing', async () => {
    const p = new NullPhysicsSystem();
    await p.init({ gravity: { x: 0, y: -9.81, z: 0 } });
    const arena: ArenaDefinition = {
      id: 'a', version: 1,
      chunkSize: { sx: 1, sy: 1, sz: 1 },
      voxelSize: 1,
      bounds: { min: { cx: 0, cy: 0, cz: 0 }, max: { cx: 0, cy: 0, cz: 0 } },
      chunks: [{
        id: 'c0', chunkOrigin: { cx: 0, cy: 0, cz: 0 }, size: { sx: 1, sy: 1, sz: 1 },
        voxels: new Uint8Array([ordinalForVoxelKind('solid')]),
      }],
      spawns: [{ id: 's', tag: 'a', pose: idTransform }],
      entities: [],
      gravity: { x: 0, y: -9.81, z: 0 },
      skybox: 'default',
    };
    p.loadArenaColliders(arena);
    p.unloadArenaColliders();
    expect(p.snapshot().bodies.length).toBe(0);
  });
});
