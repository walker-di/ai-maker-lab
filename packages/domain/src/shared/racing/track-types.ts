/**
 * Track preset shape. Authoring data only — no runtime / Three.js / Jolt
 * references. The engine builds the actual `CatmullRomCurve3`, ribbon mesh,
 * and surface lookups from this data.
 */

import type { SurfaceId } from './surface-types.js';

/** A control point on the closed Catmull-Rom centerline as `[x, z]`. */
export type CenterlineCtrl = readonly [number, number];

export interface SurfaceZone {
  /** World x of zone centre. */
  x: number;
  /** World z of zone centre. */
  z: number;
  /** Zone width along the rotated x axis. */
  w: number;
  /** Zone height along the rotated z axis. */
  h: number;
  /** Rotation about Y in radians. */
  rot: number;
}

export interface SceneryHint {
  cones?: number;
  barriers?: number;
  lights?: number;
  billboards?: number;
}

export interface TrackPreset {
  id: string;
  label: string;
  /** Hex colour used to paint the surrounding ground / grass. */
  groundColor: number;
  /** Half the asphalt width, in metres. */
  halfWidth: number;
  /** Curb strip width along each side, in metres. */
  curbWidth: number;
  /** Width of the rubber-line racing groove, in metres. */
  rubberWidth: number;
  /** Width of the marbles strip outside the rubber line, in metres. */
  marblesWidth: number;
  /** Number of samples along the closed centerline. */
  samples: number;
  ctrl: ReadonlyArray<CenterlineCtrl>;
  /** Optional gravel zones (off-track penalty area; default surface = `GRAVEL`). */
  gravelZones?: ReadonlyArray<SurfaceZone>;
  /** Optional wet/damp zones (lower mu; default surface = `DAMP`). */
  dampZones?: ReadonlyArray<SurfaceZone>;
  /** Optional explicit zones with an arbitrary surface id. */
  surfaceZones?: ReadonlyArray<SurfaceZone & { surface: SurfaceId }>;
  /** Optional sample indices on the centerline that should attract apex props. */
  apexes?: ReadonlyArray<number>;
  /** Hint counts for procedural prop placement. */
  propCadence?: SceneryHint;
}
