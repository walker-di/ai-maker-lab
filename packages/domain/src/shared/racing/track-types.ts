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
  flags?: number;
  fences?: number;
  grandStands?: number;
  pitBuildings?: number;
  pylons?: number;
  banners?: number;
  radars?: number;
  overheads?: number;
}

/**
 * M4: One authored elevation key-frame along the centerline.
 * Mirrors `ElevationSample` from the engine's elevation module but lives in
 * the domain layer so it can be authored in JSON presets without importing
 * any engine/Three.js code.
 */
export interface TrackElevationSample {
  /** Index into the sampled centerline array (0 ... N-1). */
  segmentIndex: number;
  /** World-space height (m, +Y up). */
  y: number;
}

/**
 * M4: Kerb profile authoring data (mirrors `KerbProfile` in engine layer).
 * Lives in the domain layer so presets can carry kerb geometry without
 * depending on engine code.
 */
export interface TrackKerbProfile {
  /** Total kerb strip width (m). Must match `curbWidth`. */
  widthM: number;
  /** Peak height at the crown (m). */
  crownHeightM: number;
  /**
   * Fraction of the strip that is the flat top plateau (0-1).
   * 0 = pure triangle ramp.  0.5 = sausage kerb.
   */
  topFlatFraction: number;
  /**
   * Additive Fz impulse (N) applied when a wheel crests the crown.
   * 0 = smooth kerb with no bump impulse.
   */
  bumpForceN: number;
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

  // ---- M4: 3D track surface -------------------------------------------------

  /**
   * Sparse elevation key-frames indexed by centerline segment.
   * When absent the engine uses a flat y = 0 ground plane.
   */
  elevationSamples?: ReadonlyArray<TrackElevationSample>;

  /**
   * Kerb cross-section geometry.  When absent, kerbs are treated as flat
   * (zero height, zero bump impulse).  Set `bumpForceN: 0` to produce
   * smooth kerbs with no bump impulse when a profile is provided.
   */
  kerbProfile?: TrackKerbProfile;

  /**
   * Peak-to-peak amplitude of procedural micro-bump perturbations on the
   * asphalt surface (m).  0 = perfectly smooth.  Typical range 0–0.02 m.
   * The engine uses this as a white-noise Fz perturbation budget.
   */
  bumpAmplitudeM?: number;

  /**
   * Initial track surface temperature (\u00b0C).  Used to seed grip modifiers
   * when condition-aware lap comparison is required.  Defaults to 28 \u00b0C when
   * absent (a neutral warm-dry baseline).
   */
  trackTempC?: number;

  /**
   * Rubber-line grip multiplier relative to clean asphalt (1.0 = same as
   * asphalt; typical real-world range 1.03–1.12 for heavily rubbed surfaces).
   * When absent the engine uses the surface table value for `'RUBBER'`.
   */
  rubberLineGrip?: number;

  /** Normalized wetness for the preset/session, 0 = dry and 1 = fully wet. */
  wetness?: number;

  /** Human-readable condition label (for example `dry`, `damp`, `wet`). */
  condition?: string;
}
