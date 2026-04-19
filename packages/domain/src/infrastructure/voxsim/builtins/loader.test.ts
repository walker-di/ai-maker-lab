import { describe, expect, it } from 'bun:test';
import { JsonBuiltInArenaSource, inflateRecipe } from './loader.js';
import {
  isSolidVoxel,
  ordinalForVoxelKind,
  voxelKindFromOrdinal,
} from '../../../shared/voxsim/index.js';

describe('JsonBuiltInArenaSource', () => {
  it('lists the bundled flat, slope and obstacle arenas', async () => {
    const source = new JsonBuiltInArenaSource();
    const arenas = await source.listArenas();
    const ids = arenas.map((a) => a.id).sort();
    expect(ids).toEqual(['flat-arena', 'obstacle-course', 'slope-arena']);
  });

  it('marks bundled metadata as builtin source', async () => {
    const source = new JsonBuiltInArenaSource();
    const arenas = await source.listArenas();
    for (const arena of arenas) {
      expect(arena.metadata.source).toBe('builtin');
    }
  });

  it('inflates flat-arena with a fully-tiled solid floor', async () => {
    const source = new JsonBuiltInArenaSource();
    const flat = await source.findArena('flat-arena');
    expect(flat).toBeDefined();
    const def = flat!.definition;

    const xMin = def.bounds.min.cx * def.chunkSize.sx;
    const xMax = (def.bounds.max.cx + 1) * def.chunkSize.sx - 1;
    const zMin = def.bounds.min.cz * def.chunkSize.sz;
    const zMax = (def.bounds.max.cz + 1) * def.chunkSize.sz - 1;

    const solidOrdinal = ordinalForVoxelKind('solid');
    let groundCount = 0;
    let nonGroundSolids = 0;
    for (const chunk of def.chunks) {
      for (let z = 0; z < chunk.size.sz; z++) {
        for (let y = 0; y < chunk.size.sy; y++) {
          for (let x = 0; x < chunk.size.sx; x++) {
            const ord = chunk.voxels[x + chunk.size.sx * (y + chunk.size.sy * z)]!;
            if (ord === solidOrdinal) {
              if (y === 0 && chunk.chunkOrigin.cy === 0) {
                groundCount += 1;
              } else {
                nonGroundSolids += 1;
              }
            }
          }
        }
      }
    }
    const expectedGround = (xMax - xMin + 1) * (zMax - zMin + 1);
    expect(groundCount).toBe(expectedGround);
    expect(nonGroundSolids).toBe(0);
  });

  it('caches loaded arenas across calls', async () => {
    const source = new JsonBuiltInArenaSource();
    const a = await source.listArenas();
    const b = await source.listArenas();
    expect(a.length).toBe(b.length);
    expect(a[0]!.id).toBe(b[0]!.id);
    expect(a[0]).not.toBe(b[0]);
  });

  it('returns undefined for unknown arena ids', async () => {
    const source = new JsonBuiltInArenaSource();
    const missing = await source.findArena('does-not-exist');
    expect(missing).toBeUndefined();
  });

  it('produces ramp voxels for the slope arena', async () => {
    const source = new JsonBuiltInArenaSource();
    const slope = await source.findArena('slope-arena');
    expect(slope).toBeDefined();
    const rampOrdinal = ordinalForVoxelKind('ramp');
    let rampCount = 0;
    for (const chunk of slope!.definition.chunks) {
      for (const ord of chunk.voxels) {
        if (ord === rampOrdinal) rampCount += 1;
      }
    }
    expect(rampCount).toBeGreaterThan(0);
  });

  it('produces hazard and goal voxels for the obstacle course', async () => {
    const source = new JsonBuiltInArenaSource();
    const course = await source.findArena('obstacle-course');
    expect(course).toBeDefined();
    let hazard = 0;
    let goal = 0;
    for (const chunk of course!.definition.chunks) {
      for (const ord of chunk.voxels) {
        const kind = voxelKindFromOrdinal(ord);
        if (kind === 'hazard') hazard += 1;
        if (kind === 'goal') goal += 1;
      }
    }
    expect(hazard).toBeGreaterThan(0);
    expect(goal).toBeGreaterThan(0);
  });
});

describe('inflateRecipe', () => {
  it('throws on invalid arenas', () => {
    expect(() =>
      inflateRecipe({
        id: 'bad',
        metadata: {
          title: 'bad',
          author: 'test',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
          source: 'builtin',
        },
        chunkSize: { sx: 4, sy: 4, sz: 4 },
        voxelSize: 1,
        bounds: { min: { cx: 0, cy: 0, cz: 0 }, max: { cx: 0, cy: 0, cz: 0 } },
        fills: [],
        spawns: [],
      }),
    ).toThrow();
  });

  it('keeps voxel ordinals consistent with isSolidVoxel', () => {
    const entry = inflateRecipe({
      id: 'tiny',
      metadata: {
        title: 'tiny',
        author: 'test',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        source: 'builtin',
      },
      chunkSize: { sx: 4, sy: 4, sz: 4 },
      voxelSize: 1,
      bounds: { min: { cx: 0, cy: 0, cz: 0 }, max: { cx: 0, cy: 0, cz: 0 } },
      fills: [{ type: 'voxel', x: 1, y: 0, z: 1, kind: 'solid' }],
      spawns: [
        {
          id: 'spawn',
          tag: 't',
          pose: { position: { x: 2, y: 2, z: 2 }, rotation: { x: 0, y: 0, z: 0, w: 1 } },
        },
      ],
    });
    const voxel = entry.definition.chunks[0]!.voxels[1 + 4 * (0 + 4 * 1)]!;
    const kind = voxelKindFromOrdinal(voxel)!;
    expect(isSolidVoxel(kind)).toBe(true);
  });
});
