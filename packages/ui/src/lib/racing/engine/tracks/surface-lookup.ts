/**
 * Surface lookup. Given a sampled centerline + half-width and an optional set
 * of zone overlays (gravel / damp / curb / explicit), return the surface id
 * at any world XZ point. The on-track lookup uses the projected distance
 * onto the closest segment of the centerline; off-track returns `GRASS` or
 * `GRAVEL` depending on the zone overlap.
 *
 * Zones are stored axis-aligned with an optional rotation. We test points by
 * inverse-rotating into the zone-local frame and checking the half-extents.
 */

import type { SurfaceId } from '../../types.js';
import type { SampledPoint } from './catmull-rom.js';

export interface SurfaceZoneInput {
  x: number;
  z: number;
  w: number;
  h: number;
  rot: number;
  surface: SurfaceId;
}

export interface SurfaceLookupConfig {
  points: ReadonlyArray<SampledPoint>;
  halfWidth: number;
  curbWidth: number;
  rubberWidth: number;
  marblesWidth: number;
  defaultOffTrack: SurfaceId;
  zones: ReadonlyArray<SurfaceZoneInput>;
}

export class SurfaceLookup {
  constructor(private readonly cfg: SurfaceLookupConfig) {}

  surfaceAt(x: number, z: number): SurfaceId {
    // Zones override everything else.
    for (const zone of this.cfg.zones) {
      if (this.zoneContains(zone, x, z)) return zone.surface;
    }
    const closest = this.closestPointOnCenterline(x, z);
    const distLat = Math.abs(closest.lateral);
    if (distLat <= this.cfg.rubberWidth) return 'RUBBER';
    if (distLat <= this.cfg.rubberWidth + this.cfg.marblesWidth) return 'MARBLES';
    if (distLat <= this.cfg.halfWidth) return 'ASPHALT';
    if (distLat <= this.cfg.halfWidth + this.cfg.curbWidth) return 'CURB';
    return this.cfg.defaultOffTrack;
  }

  closestPointOnCenterline(x: number, z: number): {
    index: number;
    lateral: number;
    along: number;
  } {
    const pts = this.cfg.points;
    let best = { index: 0, lateral: Infinity, along: 0 };
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const segLen2 = dx * dx + dz * dz;
      if (segLen2 < 1e-9) continue;
      const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / segLen2));
      const px = a.x + dx * t;
      const pz = a.z + dz * t;
      const lat = Math.hypot(x - px, z - pz);
      if (lat < best.lateral) best = { index: i, lateral: lat, along: t };
    }
    return best;
  }

  private zoneContains(zone: SurfaceZoneInput, x: number, z: number): boolean {
    const cos = Math.cos(-zone.rot);
    const sin = Math.sin(-zone.rot);
    const dx = x - zone.x;
    const dz = z - zone.z;
    const lx = dx * cos - dz * sin;
    const lz = dx * sin + dz * cos;
    return Math.abs(lx) <= zone.w * 0.5 && Math.abs(lz) <= zone.h * 0.5;
  }
}
