/**
 * Procedural prop placement around a track ribbon. For now this is just a
 * spec-level helper: it returns a list of `(position, kind)` items that the
 * renderer can mount. The renderer-side glue (in `three-renderer.ts`)
 * decides which mesh to instantiate per kind.
 *
 * Not all of this needs to ship day-one. For the migration, we expose an
 * empty list as a default and let the renderer skip placement until the
 * follow-up ticket "scenery placement parity" lands.
 */

import type { SampledPoint } from './catmull-rom.js';
import type { SceneryHint } from '../../types.js';

export type PropKind = 'cone' | 'barrier' | 'light' | 'billboard';

export interface PropPlacement {
  kind: PropKind;
  x: number;
  y: number;
  z: number;
  rot: number;
}

export interface SceneryPlacementInput {
  centerline: ReadonlyArray<SampledPoint>;
  halfWidth: number;
  cadence: SceneryHint | undefined;
}

export function placeScenery(input: SceneryPlacementInput): PropPlacement[] {
  if (!input.cadence) return [];
  const { cones = 0, barriers = 0, lights = 0, billboards = 0 } = input.cadence;
  const total = cones + barriers + lights + billboards;
  if (total <= 0 || input.centerline.length === 0) return [];
  const placements: PropPlacement[] = [];
  const stride = Math.max(1, Math.floor(input.centerline.length / total));
  let idx = 0;
  const counts: Array<{ kind: PropKind; n: number }> = [
    { kind: 'cone', n: cones },
    { kind: 'barrier', n: barriers },
    { kind: 'light', n: lights },
    { kind: 'billboard', n: billboards },
  ];
  for (const { kind, n } of counts) {
    for (let i = 0; i < n; i++) {
      const pt = input.centerline[(idx * stride) % input.centerline.length];
      const next = input.centerline[((idx * stride) + 1) % input.centerline.length];
      const tan = { x: next.x - pt.x, z: next.z - pt.z };
      const len = Math.hypot(tan.x, tan.z) || 1;
      const tx = tan.x / len;
      const tz = tan.z / len;
      // Right-hand normal.
      const nx = -tz;
      const nz = tx;
      const sideSign = (i % 2 === 0) ? 1 : -1;
      const offset = input.halfWidth + 1.4;
      placements.push({
        kind,
        x: pt.x + nx * offset * sideSign,
        y: 0,
        z: pt.z + nz * offset * sideSign,
        rot: Math.atan2(tx, tz),
      });
      idx++;
    }
  }
  return placements;
}
