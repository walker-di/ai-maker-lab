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

import type { Pacejka56AxleParams } from './engine/physics/pacejka.js';

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
  /**
   * Per-axle Pacejka MF 5.6 coefficient overrides. Omitted fields fall back
   * to `DEFAULT_PACEJKA56_FRONT` / `DEFAULT_PACEJKA56_REAR`. Authoring data
   * can use this to make individual cars feel distinct (peak grip, slip
   * stiffness, combined-slip cosine shape, etc.).
   */
  tireFront?: Partial<Pacejka56AxleParams>;
  /** Per-axle Pacejka MF 5.6 overrides for the rear tires. See `tireFront`. */
  tireRear?: Partial<Pacejka56AxleParams>;
  /** Pneumatic trail at zero slip (m). Default 0.042. */
  pneumaticTrail0M?: number;
  /** Slip angle (deg) where pneumatic trail decays to 1/e. Default 15. */
  pneumaticTrailDecayDeg?: number;
  /** Mechanical trail generated per degree of caster (m/deg). Default 0.006. */
  casterTrailScaleMPerDeg?: number;
  /** Cap for caster-derived mechanical trail (m). Default 0.065. */
  mechanicalTrailMaxM?: number;
  /** Effective scrub radius (m) for the front axle. Default 0.015. */
  scrubRadiusM?: number;
  /**
   * Reference torque magnitude (N·m) that maps the front-axle aligning Mz
   * onto the [-1, 1] keyboard self-centre feedback signal. Larger values
   * make the steering feel "lighter" because the front Mz only fills a
   * small fraction of the assist authority. Default 220.
   */
  steeringAlignTorqueMaxNm?: number;
  /**
   * Multiplier on the keyboard self-centre rate scaling with the magnitude
   * of the aligning feedback signal. Default 1 (full feedback authority).
   */
  steeringAlignCentreRateScale?: number;

  // ---- M2 FFB geometry (all additive / optional) ----------------------
  /**
   * Kingpin inclination angle (degrees) for the FFB pipeline. Default 13 deg.
   * Couples front-axle vertical load into a restorative steering torque.
   */
  ffbKpiDeg?: number;
  /**
   * SAI / KPI lateral contribution multiplier for FFB. Default 0.55.
   */
  ffbSaiScale?: number;
  /**
   * Scrub radius (m) for the FFB Fx coupling stage. Default 0.015 m.
   */
  ffbScrubRadiusM?: number;
  /**
   * Caster trail (m) used for the FFB Fx coupling stage. Default 0.016 m.
   * Tunable independently from the keyboard alignment trail.
   */
  ffbCasterTrailM?: number;
  /**
   * Reference torque that maps to rackForce = 1.0 (Nm). Default 25 Nm.
   */
  ffbMaxNm?: number;
  /**
   * Overall FFB gain applied before clipping. Default 1.0.
   */
  ffbGain?: number;
  /**
   * Speed at which the power-steering assist peaks (km/h). Default 15 km/h.
   */
  ffbAssistPeakKmh?: number;
  /**
   * Minimum assist factor retained at high speed (0..1). Default 0.15.
   */
  ffbAssistMin?: number;

  // ---- M1 tire additions (all additive / optional) --------------------
  /**
   * Cold (ambient) inflation pressure for all four tires (kPa).
   * Default 200 kPa (~29 psi). Per-corner editing is deferred to M7.
   */
  tireColdPressureKpa?: number;
  /**
   * Optimal hot inflation pressure (kPa). Default 215 kPa.
   * `tirePressureMu` peaks at this value.
   */
  tireOptimalPressureKpa?: number;
  /**
   * Tire radial stiffness (N/m). Controls carcass compliance for kerb
   * impulse absorption and the tire-vertical spring force. Default 160 000.
   */
  tireRadialStiffnessNpm?: number;
  /**
   * Tire radial damping coefficient (N·s/m). Default 400.
   */
  tireRadialDampingNspm?: number;

  // ---- M3 suspension kinematics (all additive / optional) -------------
  /**
   * Multi-knee damper params for the front axle. When omitted the engine
   * uses flat coefficients equal to `damperBumpFrontNsPm` /
   * `damperReboundFrontNsPm` (legacy behaviour preserved).
   */
  damperFront?: {
    lsb: number;
    hsb: number;
    kneeB: number;
    lsr: number;
    hsr: number;
    kneeR: number;
  };
  /** Multi-knee damper params for the rear axle. See `damperFront`. */
  damperRear?: {
    lsb: number;
    hsb: number;
    kneeB: number;
    lsr: number;
    hsr: number;
    kneeR: number;
  };
  /**
   * Front bump-steer table: `[travel_m, toeDeltaDeg]` pairs (sorted by
   * travel). `travel = 0` is the design position; positive = compression.
   * The delta is added to the static toe and mirrored across chassis sides.
   */
  bumpSteerFront?: ReadonlyArray<readonly [number, number]>;
  /** Rear bump-steer table. See `bumpSteerFront`. */
  bumpSteerRear?: ReadonlyArray<readonly [number, number]>;
  /**
   * Front camber-vs-travel table: `[travel_m, camberDeltaDeg]` pairs.
   * Delta is added to `staticCamberDeg` (both wheels share the same table).
   */
  camberTableFront?: ReadonlyArray<readonly [number, number]>;
  /** Rear camber-vs-travel table. See `camberTableFront`. */
  camberTableRear?: ReadonlyArray<readonly [number, number]>;
  /**
   * Front caster-vs-travel table: `[travel_m, casterDeltaDeg]` pairs.
   */
  casterTableFront?: ReadonlyArray<readonly [number, number]>;
  /** Rear caster-vs-travel table. See `casterTableFront`. */
  casterTableRear?: ReadonlyArray<readonly [number, number]>;
  /**
   * Front roll-center height vs travel: `[travel_m, height_m]` pairs.
   */
  rollCenterTableFront?: ReadonlyArray<readonly [number, number]>;
  /** Rear roll-center height vs travel. See `rollCenterTableFront`. */
  rollCenterTableRear?: ReadonlyArray<readonly [number, number]>;
  /**
   * Front progressive bump-stop rate table: `[penetration_m, rate_N/m]`
   * pairs where `penetration_m` is depth past the bump-stop threshold.
   * When omitted the legacy elastomer model is used.
   */
  bumpStopRateTableFront?: ReadonlyArray<readonly [number, number]>;
  /** Rear progressive bump-stop rate table. See `bumpStopRateTableFront`. */
  bumpStopRateTableRear?: ReadonlyArray<readonly [number, number]>;

  // ---- M5 aero map (all additive / optional) ---------------------------------
  /**
   * Authored 2-D aero lookup table. When present, overrides the scalar
   * `clAreaFrontM2` / `clAreaRearM2` with ride-height and pitch-sensitive
   * values. Presets that omit this field continue to use the scalar path.
   */
  aeroMap?: {
    /**
     * Front `Cl·A` map keyed by `[rideHeight_m, pitchDeg]`.
     */
    frontClAreaMap?: {
      axis0: ReadonlyArray<number>;
      axis1: ReadonlyArray<number>;
      data: ReadonlyArray<ReadonlyArray<number>>;
    };
    /**
     * Rear `Cl·A` map keyed by `[rideHeight_m, pitchDeg]`.
     */
    rearClAreaMap?: {
      axis0: ReadonlyArray<number>;
      axis1: ReadonlyArray<number>;
      data: ReadonlyArray<ReadonlyArray<number>>;
    };
    /**
     * Yaw drag increment map keyed by `[yawDeg, speedKmh]`. Adds extra
     * Cd·A to the scalar base drag at high sideslip angles.
     */
    yawDragMap?: {
      axis0: ReadonlyArray<number>;
      axis1: ReadonlyArray<number>;
      data: ReadonlyArray<ReadonlyArray<number>>;
    };
    /**
     * Authored centre-of-pressure fraction (0 = front axle, 1 = rear axle).
     * When omitted, derived from the front/rear downforce split.
     */
    copFraction?: number;
    /**
     * Ride-height (m) below which underbody flow is considered stalled.
     * The force reduction is encoded in the table data; this threshold is
     * used for telemetry flags only.
     */
    stallRideHeightM?: number;
  };

  // ---- M8: wake field + gyroscopic torque (all additive / optional) -
  /** Length of the aerodynamic wake behind the car (m). Default 20. */
  wakeLengthM?: number;
  /** Lateral half-width of the wake (m). Default 4. */
  wakeWidthM?: number;
  /** Maximum drag reduction fraction in the wake (0..1). Default 0.25. */
  wakeReductionPct?: number;
  /** Rotational inertia of a single wheel assembly (kg·m²). Default 1.4. */
  wheelInertiaKgM2?: number;

  // ---- M6 drivetrain depth (all additive / optional) -----------------
  /**
   * Turbocharger parameters.  When present the engine activates boost/spool
   * simulation and scales the engine torque output.  When absent the vehicle
   * is treated as naturally aspirated (turboMultiplier = 1 always).
   */
  turbo?: {
    peakBoostBar?: number;
    overboostLimitBar?: number;
    peakTorqueMultiplier?: number;
    targetSpoolRpm?: number;
    spoolUpTimeS?: number;
    spoolDownTimeS?: number;
    idleSpoolRatio?: number;
    efficiencyScale?: number;
  };
  /**
   * Authored engine torque map (throttle × rpm multiplier table).  When
   * present it scales the base torque curve so fuelling maps, flat-shift
   * zones, and overrev cutbacks can be expressed as authored data rather
   * than hard-coded offsets.
   */
  engineTorqueMap?: {
    axis0: ReadonlyArray<number>;
    axis1: ReadonlyArray<number>;
    data: ReadonlyArray<ReadonlyArray<number>>;
  };
  /**
   * Authored torque curve: `[rpm, Nm]` control-point list.  When present
   * replaces the built-in NA curve so each vehicle can express its own
   * characteristic shape before boost scaling.
   */
  engineTorqueCurve?: ReadonlyArray<readonly [number, number]>;
  /**
   * Shift-refusal and shift-delay logic.  When absent the engine shifts
   * instantaneously without refusal (pre-M6 default).
   */
  shiftLogic?: {
    upshiftMinRpm?: number;
    upshiftMaxRpm?: number;
    downshiftMinRpm?: number;
    downshiftMaxRpm?: number;
    shiftTimeS?: number;
    shiftThrottleCutFraction?: number;
  };
  /**
   * Driveline torsional compliance (propshaft spring + damper + backlash).
   * When absent the shaft is modelled as perfectly rigid (pre-M6 default).
   */
  drivelineCompliance?: {
    shaftStiffnessNmRad?: number;
    shaftDampingNmSRad?: number;
    backlashRad?: number;
  };
  /**
   * Engine braking refinement parameters.  When absent the legacy flat-
   * constant model from `runDrivetrainAndAids` is used unchanged.
   */
  engineBraking?: {
    linearNmPerRadS?: number;
    constantNm?: number;
    pumpingCoeffNmPerRadS2?: number;
    maxBrakeTorqueNm?: number;
  };

  // ---- Chassis compliance (racing-chassis-compliance OpenSpec) ------
  compliance?: ComplianceConfig;
}

export interface ComplianceConfig {
  hubLinearStiffnessNpm?: number;
  hubLinearDampingNspms?: number;
  hubRotationalStiffnessNmDeg?: number;
  hubRotationalDampingNmSdeg?: number;
  chassisTorsionalStiffnessNmDeg?: number;
}

export interface VehicleDimensionsPreset {
  overallLengthM?: number;
  overallWidthM?: number;
  overallHeightM?: number;
  frontTrackWidthM?: number;
  rearTrackWidthM?: number;
}

export interface TireGeometryPreset {
  frontSectionWidthM?: number;
  rearSectionWidthM?: number;
  frontOverallDiameterM?: number;
  rearOverallDiameterM?: number;
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
  dimensions?: VehicleDimensionsPreset;
  tires?: TireGeometryPreset;
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
  flags?: number;
  fences?: number;
  grandStands?: number;
  pitBuildings?: number;
  pylons?: number;
  banners?: number;
  radars?: number;
  overheads?: number;
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

  // ---- M4: 3D track surface -------------------------------------------------

  /** Sparse elevation key-frames indexed by centerline segment. */
  elevationSamples?: ReadonlyArray<{ segmentIndex: number; y: number }>;
  /** Kerb cross-section geometry. */
  kerbProfile?: {
    widthM: number;
    crownHeightM: number;
    topFlatFraction: number;
    bumpForceN: number;
  };
  /** Peak-to-peak amplitude of micro-bump Fz perturbations (m). */
  bumpAmplitudeM?: number;
  /** Initial track surface temperature (degrees C). */
  trackTempC?: number;
  /** Rubber-line grip multiplier relative to clean asphalt. */
  rubberLineGrip?: number;
  /** Normalized wetness for the preset/session, 0 = dry and 1 = fully wet. */
  wetness?: number;
  /** Human-readable condition label (for example `dry`, `damp`, `wet`). */
  condition?: string;
}

export interface SetupValues {
  // ---- pre-M7 geometry & bump-stop --------------------------------------
  frontToeDeg: number;
  rearToeDeg: number;
  casterDeg: number;
  /** 0 = parallel steering, 1 = ideal Ackermann. */
  ackermannPct: number;
  motionRatioFront: number;
  motionRatioRear: number;
  bumpStopGapFrontMm: number;
  bumpStopGapRearMm: number;
  bumpStopRateFrontNmm: number;
  bumpStopRateRearNmm: number;

  // ---- M7: springs ------------------------------------------------------
  /** Front spring rate (N/m). 0 = use vehicle preset value. */
  springFrontNpm: number;
  /** Rear spring rate (N/m). 0 = use vehicle preset value. */
  springRearNpm: number;

  // ---- M7: damper scalers -----------------------------------------------
  damperBumpFrontScale: number;
  damperReboundFrontScale: number;
  damperBumpRearScale: number;
  damperReboundRearScale: number;

  // ---- M7: differential -------------------------------------------------
  diffPowerRamp: number;
  diffCoastRamp: number;
  diffPreloadNm: number;

  // ---- M7: per-corner tire pressures ------------------------------------
  tirePressureFLKpa: number;
  tirePressureFRKpa: number;
  tirePressureRLKpa: number;
  tirePressureRRKpa: number;

  // ---- M7: camber -------------------------------------------------------
  camberFrontDeg: number;
  camberRearDeg: number;

  // ---- M7: brake bias ---------------------------------------------------
  brakeBiasFront: number;

  // ---- M7: ride height --------------------------------------------------
  rideHeightFrontMm: number;
  rideHeightRearMm: number;

  // ---- M7: fuel load ----------------------------------------------------
  fuelLoad: number;

  // ---- M7: gear-ratio trim ----------------------------------------------
  finalDriveScale: number;
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
