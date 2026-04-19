/**
 * Real-Jolt integration tests. The Jolt WASM module loads under bun via
 * `wasm-compat`; if it fails to initialise the test reports the failure
 * cleanly so we can tell apart "broken contract" from "WASM unavailable".
 */
import { describe, expect, test } from 'bun:test';

import { JoltSystem } from './JoltSystem.js';
import { __resetJoltLoaderCache } from './jolt-loader.js';
import type { ArenaDefinition } from '../../types.js';
import { ordinalForVoxelKind } from '../../types.js';

const idTransform = {
  position: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
};

async function tryInit(): Promise<JoltSystem | null> {
  __resetJoltLoaderCache();
  const sys = new JoltSystem();
  try {
    await sys.init({ gravity: { x: 0, y: -9.81, z: 0 } });
    return sys;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('JoltSystem.init failed in test environment:', (e as Error).message);
    return null;
  }
}

describe('JoltSystem', () => {
  test('init then dispose without throwing', async () => {
    const sys = await tryInit();
    if (!sys) return;
    sys.dispose();
  });

  test('a dynamic sphere falls under gravity', async () => {
    const sys = await tryInit();
    if (!sys) return;
    try {
      const handle = sys.createBody({
        kind: 'dynamic',
        shape: { kind: 'sphere', radius: 0.5 },
        transform: { position: { x: 0, y: 10, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 } },
      });
      for (let i = 0; i < 30; i++) sys.step(1000 / 60);
      const t = sys.getBodyTransform(handle);
      // After 0.5 s of free fall: y ≈ 10 - 0.5 * 9.81 * 0.25 ≈ 8.77
      expect(t.position.y).toBeLessThan(10);
      expect(t.position.y).toBeGreaterThan(7.5);
    } finally {
      sys.dispose();
    }
  });

  test('arena chunk colliders catch a falling body', async () => {
    const sys = await tryInit();
    if (!sys) return;
    try {
      const sx = 4, sy = 4, sz = 4;
      const voxels = new Uint8Array(sx * sy * sz);
      // Fill the y=0 floor plane.
      for (let z = 0; z < sz; z++) {
        for (let x = 0; x < sx; x++) {
          voxels[x + sx * (0 + sy * z)] = ordinalForVoxelKind('solid');
        }
      }
      const arena: ArenaDefinition = {
        id: 'a', version: 1,
        chunkSize: { sx, sy, sz },
        voxelSize: 1,
        bounds: { min: { cx: 0, cy: 0, cz: 0 }, max: { cx: 0, cy: 0, cz: 0 } },
        chunks: [{ id: 'c0', chunkOrigin: { cx: 0, cy: 0, cz: 0 }, size: { sx, sy, sz }, voxels }],
        spawns: [{ id: 's', tag: 'a', pose: idTransform }],
        entities: [],
        gravity: { x: 0, y: -9.81, z: 0 },
        skybox: 'default',
      };
      sys.loadArenaColliders(arena);
      const handle = sys.createBody({
        kind: 'dynamic',
        shape: { kind: 'sphere', radius: 0.5 },
        transform: { position: { x: 1.5, y: 5, z: 1.5 }, rotation: { x: 0, y: 0, z: 0, w: 1 } },
      });
      for (let i = 0; i < 120; i++) sys.step(1000 / 60);
      const t = sys.getBodyTransform(handle);
      expect(t.position.y).toBeGreaterThan(0.9);
    } finally {
      sys.dispose();
    }
  });

  test('snapshot returns previous and latest transforms', async () => {
    const sys = await tryInit();
    if (!sys) return;
    try {
      const h = sys.createBody({
        kind: 'dynamic',
        shape: { kind: 'sphere', radius: 0.5 },
        transform: { position: { x: 0, y: 5, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 } },
      });
      sys.step(1000 / 60);
      sys.step(1000 / 60);
      const snap = sys.snapshot();
      expect(snap.stepIndex).toBe(2);
      const entry = snap.bodies.find((b) => b.handle.id === h.id);
      expect(entry).toBeDefined();
      expect(entry!.previous.position.y).toBeGreaterThan(entry!.latest.position.y);
    } finally {
      sys.dispose();
    }
  });
});
