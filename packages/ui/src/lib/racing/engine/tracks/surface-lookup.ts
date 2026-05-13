/**
 * Surface lookup. Given a sampled centerline + half-width and an optional set
 * of zone overlays (gravel / damp / curb / explicit), return the surface id
 * at any world XZ point. The on-track lookup uses the projected distance
 * onto the closest segment of the centerline; off-track returns `GRASS` or
 * `GRAVEL` depending on the zone overlap.
 *
 * Zones are stored axis-aligned with an optional rotation. We test points by
 * inverse-rotating into the zone-local frame and checking the half-extents.
 *
 * M4: The lookup also exposes `groundYAt` which resolves the surface height
 * at a world (x, z) position by combining the optional `TerrainContact`
 * resolver with a kerb height override when the point lands on a CURB strip.
 * Flat-ground fallback (y = 0) is preserved when no terrain data is provided.
 */

import type { SurfaceId } from '../../types.js';
import type { SampledPoint } from './catmull-rom.js';
import { type TerrainContact } from './elevation.js';
import {
  kerbContactFromLateralOffset,
  type KerbProfile,
} from './kerb-geometry.js';

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
  /**
   * M4: optional terrain contact resolver for authored elevation / height
   * field data.  When absent the lookup returns y = 0 (flat ground).
   */
  terrain?: TerrainContact | null;
  /**
   * M4: optional kerb profile used to compute the raised-kerb ground height
   * for points that fall on a CURB strip.  When absent kerbs return y = 0.
   */
  kerbProfile?: KerbProfile | null;
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

  /**
   * M4: Ground height (m, +Y up) at world position (x, z).
   *
   * Resolution order:
   *   1. If a `terrain` resolver is configured, delegate to it (heightField
   *      or elevation-map, whichever is non-null).
   *   2. If the point falls on a CURB strip and a `kerbProfile` is
   *      configured, overlay the kerb ramp height on top of the terrain
   *      height from step 1.
   *   3. Otherwise return 0 (flat-ground fallback).
   *
   * The kerb height is ADDED to the terrain baseline so authored elevation
   * and kerb geometry compose correctly (e.g., a kerb on a hill).
   */
  groundYAt(x: number, z: number): number {
    const closest = this.closestPointOnCenterline(x, z);

    let baseY = 0;
    if (this.cfg.terrain && !this.cfg.terrain.isFlat) {
      const fracIndex = closest.index + closest.along;
      baseY = this.cfg.terrain.groundY(x, z, fracIndex);
    }

    if (this.cfg.kerbProfile) {
      const kerbContact = kerbContactFromLateralOffset(
        closest.lateral,
        this.cfg.halfWidth,
        this.cfg.kerbProfile,
      );
      if (kerbContact) {
        baseY += kerbContact.groundY;
      }
    }

    return baseY;
  }

  /**
   * M4: Kerb bump impulse (N) for a wheel at world position (x, z).
   * Returns 0 when no kerb profile is configured or the wheel is not on a
   * CURB strip.
   */
  kerbBumpImpulseAt(x: number, z: number): number {
    if (!this.cfg.kerbProfile) return 0;
    const closest = this.closestPointOnCenterline(x, z);
    const kerbContact = kerbContactFromLateralOffset(
      closest.lateral,
      this.cfg.halfWidth,
      this.cfg.kerbProfile,
    );
    return kerbContact?.bumpImpulseN ?? 0;
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
