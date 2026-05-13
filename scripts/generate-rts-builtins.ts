/**
 * Emits the bundled built-in RTS map JSON files into
 * `packages/domain/src/infrastructure/rts/builtins/`. Run with:
 *   bun run scripts/generate-rts-builtins.ts
 */
import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { MapDefinition, ResourceNode, TerrainKind } from '../packages/domain/src/shared/rts/index.js';

interface MapTemplate {
  id: string;
  cols: number;
  rows: number;
  maxAltitude: number;
  spawns: { factionId: string; col: number; row: number }[];
  altitude?: (col: number, row: number) => number;
  resources: { kind: 'mineral' | 'gas'; col: number; row: number; amount: number }[];
  title: string;
}

function buildMap(t: MapTemplate): MapDefinition {
  const altitudeFn = t.altitude ?? (() => 0);
  const altitude = Array.from({ length: t.rows }, (_, row) =>
    Array.from({ length: t.cols }, (_, col) => Math.max(0, Math.min(t.maxAltitude, altitudeFn(col, row)))),
  );
  const terrain: TerrainKind[][] = Array.from({ length: t.rows }, (_, row) =>
    Array.from({ length: t.cols }, (_, col) => {
      const a = altitude[row]![col]!;
      if (a >= 2) return 'rock';
      if (a >= 1) return 'dirt';
      return 'grass';
    }),
  );
  // Place cliffs on lower side of altitude transitions.
  for (let row = 0; row < t.rows; row++) {
    for (let col = 0; col < t.cols; col++) {
      const a = altitude[row]![col]!;
      let upper = a;
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nr = row + dr;
        const nc = col + dc;
        if (nr < 0 || nr >= t.rows || nc < 0 || nc >= t.cols) continue;
        const na = altitude[nr]![nc]!;
        if (na > a) upper = Math.max(upper, na);
      }
      if (upper > a) {
        terrain[row]![col] = 'cliff';
      }
    }
  }
  // Carve a ramp at one neighbor for each elevated cell so the cliff isn't impassable.
  for (let row = 0; row < t.rows; row++) {
    for (let col = 0; col < t.cols; col++) {
      if (terrain[row]![col] === 'cliff') {
        // demote first cliff in the row that's adjacent to spawn area.
        for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const nr = row + dr;
          const nc = col + dc;
          if (nr < 0 || nr >= t.rows || nc < 0 || nc >= t.cols) continue;
          const na = altitude[nr]![nc]!;
          if (na > altitude[row]![col]!) {
            // demote one cliff to dirt as a ramp; only if not on a spawn.
            const isSpawn = t.spawns.some((s) => s.col === col && s.row === row);
            if (!isSpawn) {
              terrain[row]![col] = 'dirt';
            }
            break;
          }
        }
        break;
      }
    }
  }
  const resources: ResourceNode[] = t.resources.map((r, i) => ({
    id: `${r.kind}-${i + 1}`,
    kind: r.kind,
    tile: { col: r.col, row: r.row },
    amount: r.amount,
  }));
  return {
    id: t.id,
    version: 1,
    size: { cols: t.cols, rows: t.rows },
    tileSize: { width: 64, height: 32 },
    maxAltitude: t.maxAltitude,
    terrain,
    altitude: { levels: altitude },
    resources,
    spawns: t.spawns.map((s) => ({ factionId: s.factionId, tile: { col: s.col, row: s.row } })),
    metadata: {
      title: t.title,
      author: 'AI Maker Lab',
      createdAt: '1970-01-01T00:00:00Z',
      updatedAt: '1970-01-01T00:00:00Z',
      source: 'builtin',
    },
  };
}

const tinySkirmish = buildMap({
  id: 'tiny-skirmish',
  title: 'Tiny Skirmish',
  cols: 32,
  rows: 32,
  maxAltitude: 0,
  spawns: [
    { factionId: 'p1', col: 4, row: 4 },
    { factionId: 'p2', col: 27, row: 27 },
  ],
  resources: [
    { kind: 'mineral', col: 6, row: 6, amount: 1000 },
    { kind: 'mineral', col: 7, row: 4, amount: 1000 },
    { kind: 'gas', col: 5, row: 8, amount: 1500 },
    { kind: 'mineral', col: 25, row: 25, amount: 1000 },
    { kind: 'mineral', col: 24, row: 27, amount: 1000 },
    { kind: 'gas', col: 26, row: 23, amount: 1500 },
  ],
});

const cliffside = buildMap({
  id: 'cliffside',
  title: 'Cliffside',
  cols: 64,
  rows: 64,
  maxAltitude: 2,
  spawns: [
    { factionId: 'p1', col: 6, row: 6 },
    { factionId: 'p2', col: 56, row: 56 },
  ],
  altitude: (col, row) => {
    if (col > 30 && col < 36) return 0;
    if (col >= 36) return 1;
    return 0;
  },
  resources: [
    { kind: 'mineral', col: 8, row: 8, amount: 1500 },
    { kind: 'mineral', col: 9, row: 6, amount: 1500 },
    { kind: 'gas', col: 4, row: 12, amount: 1500 },
    { kind: 'mineral', col: 56, row: 54, amount: 1500 },
    { kind: 'mineral', col: 54, row: 56, amount: 1500 },
    { kind: 'gas', col: 60, row: 50, amount: 1500 },
  ],
});

const dualRamps = buildMap({
  id: 'dual-ramps',
  title: 'Dual Ramps',
  cols: 64,
  rows: 64,
  maxAltitude: 2,
  spawns: [
    { factionId: 'p1', col: 6, row: 6 },
    { factionId: 'p2', col: 56, row: 6 },
    { factionId: 'p3', col: 6, row: 56 },
    { factionId: 'p4', col: 56, row: 56 },
  ],
  altitude: (col, row) => {
    const cx = col - 32;
    const cy = row - 32;
    const d2 = cx * cx + cy * cy;
    if (d2 < 12 * 12) return 1;
    return 0;
  },
  resources: [
    { kind: 'mineral', col: 8, row: 8, amount: 1500 },
    { kind: 'mineral', col: 8, row: 56, amount: 1500 },
    { kind: 'mineral', col: 56, row: 8, amount: 1500 },
    { kind: 'mineral', col: 56, row: 56, amount: 1500 },
    { kind: 'gas', col: 32, row: 32, amount: 2000 },
  ],
});

const outDir = fileURLToPath(new URL('../packages/domain/src/infrastructure/rts/builtins/', import.meta.url));
await mkdir(outDir, { recursive: true });
await writeFile(`${outDir}tiny-skirmish.json`, JSON.stringify(tinySkirmish, null, 2));
await writeFile(`${outDir}cliffside.json`, JSON.stringify(cliffside, null, 2));
await writeFile(`${outDir}dual-ramps.json`, JSON.stringify(dualRamps, null, 2));

console.log('Generated 3 built-in RTS maps in', outDir);
