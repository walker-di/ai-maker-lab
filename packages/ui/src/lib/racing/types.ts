/**
 * Local UI types mirror for the Racing feature.
 *
 * `packages/ui` cannot depend on `packages/domain` (see
 * `packages/ui/AGENTS.md`). This file mirrors the structural shape declared
 * in `packages/domain/src/shared/racing/`. Domain types satisfy these
 * structurally when passed in from the app layer.
 *
 * If you add or change a field in the shared domain, mirror it here in the
 * same change. Both files must stay structurally compatible.
 */

export type DriveLayout = 'rwd' | 'fwd' | 'awd';

export type DiffType = 'welded' | 'open' | 'clutchLSD';

export type CameraMode = 'chase' | 'hood' | 'far' | 'map';

export interface Vec2Tuple {
  0: number;
  1: number;
  length: 2;
}

export type SurfaceId = 'RUBBER' | 'ASPHALT' | 'MARBLES' | 'DAMP' | 'CURB' | 'GRASS' | 'GRAVEL';

export interface SurfaceDef {
  id: SurfaceId;
  /** Friction coefficient at the contact patch (dry asphalt = 1.0). */
  mu: number;
  /** Rolling resistance coefficient. */
  roll: number;
  /** Visual hex colour for renderers. */
  color: number;
}

/** A `[rpm, Nm]` control point on the engine torque curve. */
export type EngineCurvePoint = readonly [number, number];

export interface VehiclePhysicsPreset {
  massKg?: number;
  inertiaPitchKgM2?: number;
  inertiaYawKgM2?: number;
  inertiaRollKgM2?: number;
  springFrontNpm?: number;
  springRearNpm?: number;
  damperBumpFrontNsPm?: number;
  damperReboundFrontNsPm?: number;
  damperBumpRearNsPm?: number;
  damperReboundRearNsPm?: number;
  arbFrontNpm?: number;
  arbRearNpm?: number;
  brakeTorqueMaxNm?: number;
  brakeBiasFront?: number;
  cdAreaM2?: number;
  yawAeroCoeff?: number;
  /** Effective `Cl · A` for the front axle (m²). Defaults to 0 (no downforce). */
  clAreaFrontM2?: number;
  /** Effective `Cl · A` for the rear axle (m²). Defaults to 0 (no downforce). */
  clAreaRearM2?: number;
  /** Total chassis CG height above the contact patches (m). */
  cgHeightM?: number;
  /** Sprung-mass CG height above the contact patches (m). */
  sprungCgHeightM?: number;
  /** Unsprung-mass CG height above the contact patches (m), ~ wheel centre. */
  unsprungCgHeightM?: number;
  /** Total unsprung mass on the front axle (kg). Wheels + hubs + brakes. */
  unsprungMassFrontKg?: number;
  /** Total unsprung mass on the rear axle (kg). */
  unsprungMassRearKg?: number;
  engineInertiaKgM2?: number;
  flywheelInertiaKgM2?: number;
  gearboxInputInertiaKgM2?: number;
  propshaftInertiaKgM2?: number;
  diffInertiaKgM2?: number;
  clutchMaxTorqueNm?: number;
  clutchStaticFactor?: number;
  clutchStickThresholdRadPerSec?: number;
  drivetrainSubsteps?: number;
  diffPreloadNm?: number;
  diffCapacityNm?: number;
  diffPowerRamp?: number;
  diffCoastRamp?: number;
}

export interface VehiclePreset {
  id: string;
  label: string;
  driveLabel: 'RWD' | 'FWD' | 'AWD';
  layoutLabel: string;
  /** Hex body colour used by the renderer. */
  color: number;
  wheelbase: number;
  trackWidth: number;
  /** Static front-axle mass percentage (0..1). */
  frontMassPct: number;
  finalDrive: number;
  gears: ReadonlyArray<{ n: string; ratio: number }>;
  steerMaxDeg: number;
  axleDrive: { front: number; rear: number };
  diffType: DiffType;
  physics?: VehiclePhysicsPreset;
}

export interface SurfaceZone {
  id?: string;
  surface: SurfaceId;
  /** World-space rectangle, optionally rotated about its centre. */
  x: number;
  z: number;
  w: number;
  h: number;
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
  groundColor: number;
  halfWidth: number;
  curbWidth: number;
  rubberWidth: number;
  marblesWidth: number;
  samples: number;
  /** Closed Catmull-Rom centerline as `[x, z]` tuples. */
  ctrl: ReadonlyArray<readonly [number, number]>;
  gravelZones?: ReadonlyArray<SurfaceZone | { x: number; z: number; w: number; h: number; rot?: number }>;
  dampZones?: ReadonlyArray<SurfaceZone | { x: number; z: number; w: number; h: number; rot?: number }>;
  surfaceZones?: ReadonlyArray<SurfaceZone>;
  apexes?: ReadonlyArray<number>;
  propCadence?: SceneryHint;
}

export interface SetupValues {
  frontToeDeg: number;
  rearToeDeg: number;
  casterDeg: number;
  ackermannPct: number;
  motionRatioFront: number;
  motionRatioRear: number;
  bumpStopGapFrontMm: number;
  bumpStopGapRearMm: number;
  bumpStopRateFrontNmm: number;
  bumpStopRateRearNmm: number;
}

export interface SectorTime {
  index: number;
  ms: number;
}

export interface LapResult {
  id: string;
  sessionId: string;
  trackId: string;
  vehicleId: string;
  lapMs: number;
  sectors: SectorTime[];
  finishedAt: string;
}

export interface RacingSession {
  id: string;
  trackId: string;
  vehicleId: string;
  startedAt: string;
  endedAt?: string;
}
