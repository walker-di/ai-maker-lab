/**
 * Vehicle preset shape. Authoring data only — no runtime / Three.js / Jolt
 * references. The engine consumes these through its constructor inputs.
 */

export type DriveLayout = 'rwd' | 'fwd' | 'awd';
export type DriveLabel = 'RWD' | 'FWD' | 'AWD';
export type DiffType = 'welded' | 'open' | 'clutchLSD';

export interface GearRatio {
  /** Letter / number label shown in the HUD (`R`, `N`, `1`, `2`, ...). */
  n: string;
  /** Reduction ratio. `0` for neutral, negative for reverse. */
  ratio: number;
}

export interface AxleDriveShare {
  /** Fraction of total drive torque sent to the front axle (0..1). */
  front: number;
  /** Fraction of total drive torque sent to the rear axle (0..1). */
  rear: number;
}

/**
 * Subset of Pacejka MF 5.6 axle coefficients. The structural shape mirrors
 * the `Pacejka56AxleParams` type used by the UI tire model so authored
 * presets can drop in directly without taking a UI dependency from the
 * domain package. Every field is optional — omitted entries fall back to
 * the runtime defaults inside `packages/ui/src/lib/racing/engine/physics/pacejka.ts`.
 */
export interface TirePacejkaParamsOverride {
  fz0?: number;
  pCx1?: number;
  pDx1?: number;
  pDx2?: number;
  pKx1?: number;
  pKx2?: number;
  pEx1?: number;
  pEx2?: number;
  pCy1?: number;
  pCy2?: number;
  pDy1?: number;
  pDy2?: number;
  pKy1?: number;
  pKy2?: number;
  pEy1?: number;
  pEy2?: number;
  rBx1?: number;
  rCx1?: number;
  rBy1?: number;
  rCy1?: number;
}

export interface ComplianceConfig {
  /** Hub linear stiffness (N/m). 0 = rigid. */
  hubLinearStiffnessNpm?: number;
  /** Hub linear damping (N·s/m). */
  hubLinearDampingNspms?: number;
  /** Hub rotational stiffness (N·m/deg). 0 = rigid. */
  hubRotationalStiffnessNmDeg?: number;
  /** Hub rotational damping (N·m·s/deg). */
  hubRotationalDampingNmSdeg?: number;
  /** Chassis torsional stiffness (N·m/deg). 0 = rigid, Infinity = perfectly rigid. */
  chassisTorsionalStiffnessNmDeg?: number;
}

export interface VehiclePhysicsPreset {
  /** Total chassis mass used by the rigid-body integrator. */
  massKg?: number;
  /** Body-axis pitch inertia (rotation about chassis X / right axis). */
  inertiaPitchKgM2?: number;
  /** Body-axis yaw inertia (rotation about chassis Y / up axis). */
  inertiaYawKgM2?: number;
  /** Body-axis roll inertia (rotation about chassis Z / forward axis). */
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
  /**
   * Effective `Cl · A` for the front axle (m²). Positive values create
   * downward aerodynamic load on the front tires that grows with speed
   * squared. Defaults to 0 so existing road-car presets are unchanged.
   */
  clAreaFrontM2?: number;
  /** Effective `Cl · A` for the rear axle (m²). Defaults to 0. */
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
  /** Crankshaft + rotating engine assembly inertia (kg·m²). */
  engineInertiaKgM2?: number;
  /** Flywheel inertia (kg·m²) added to the engine side of the clutch. */
  flywheelInertiaKgM2?: number;
  /** Gearbox input shaft inertia (kg·m²) on the clutch output side. */
  gearboxInputInertiaKgM2?: number;
  /** Propshaft inertia (kg·m²) reflected through the gear ratio. */
  propshaftInertiaKgM2?: number;
  /** Differential carrier inertia (kg·m²) reflected through the final drive. */
  diffInertiaKgM2?: number;
  /** Kinetic clutch torque cap (Nm). */
  clutchMaxTorqueNm?: number;
  /** Static-friction multiplier on the kinetic torque cap (>= 1). */
  clutchStaticFactor?: number;
  /** Stick band on engine-vs-input slip (rad/s) within which the clutch tries to lock. */
  clutchStickThresholdRadPerSec?: number;
  /** Number of internal substeps for the rotational drivetrain solver. */
  drivetrainSubsteps?: number;
  /** Salisbury LSD preload torque (Nm) applied even on coast/zero throttle. */
  diffPreloadNm?: number;
  /** Salisbury LSD maximum lock torque (Nm). */
  diffCapacityNm?: number;
  /** Salisbury LSD power-side ramp coefficient (0..1). */
  diffPowerRamp?: number;
  /** Salisbury LSD coast-side ramp coefficient (0..1). */
  diffCoastRamp?: number;
  /**
   * Per-axle Pacejka MF 5.6 coefficient overrides for the front tires.
   * Omitted fields fall back to the runtime sport / race tire defaults.
   */
  tireFront?: TirePacejkaParamsOverride;
  /** Per-axle Pacejka MF 5.6 overrides for the rear tires. */
  tireRear?: TirePacejkaParamsOverride;
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
   * onto the [-1, 1] keyboard self-centre feedback signal. Default 220.
   */
  steeringAlignTorqueMaxNm?: number;
  /**
   * Multiplier on the keyboard self-centre rate scaling with the magnitude
   * of the aligning feedback signal. Default 1.
   */
  steeringAlignCentreRateScale?: number;

  // ---- M1 tire additions (all additive / optional) --------------------
  /**
   * Cold (ambient) inflation pressure for all four tires (kPa).
   * Default 200 kPa (~29 psi). Per-corner editing is deferred to M7.
   */
  tireColdPressureKpa?: number;
  /**
   * Optimal hot inflation pressure (kPa). Default 215 kPa.
   */
  tireOptimalPressureKpa?: number;
  /**
   * Tire radial stiffness (N/m). Default 160 000.
   */
  tireRadialStiffnessNpm?: number;
  /**
   * Tire radial damping coefficient (N·s/m). Default 400.
   */
  tireRadialDampingNspm?: number;

  // ---- M3 suspension kinematics (all additive / optional) -------------
  /**
   * Multi-knee damper params for the front axle. When omitted the engine
   * uses flat `damperBumpFrontNsPm` / `damperReboundFrontNsPm` (legacy).
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
   */
  bumpSteerFront?: ReadonlyArray<readonly [number, number]>;
  /** Rear bump-steer table. See `bumpSteerFront`. */
  bumpSteerRear?: ReadonlyArray<readonly [number, number]>;
  /**
   * Front camber-vs-travel table: `[travel_m, camberDeltaDeg]` pairs.
   */
  camberTableFront?: ReadonlyArray<readonly [number, number]>;
  /** Rear camber-vs-travel table. */
  camberTableRear?: ReadonlyArray<readonly [number, number]>;
  /**
   * Front caster-vs-travel table: `[travel_m, casterDeltaDeg]` pairs.
   */
  casterTableFront?: ReadonlyArray<readonly [number, number]>;
  /** Rear caster-vs-travel table. */
  casterTableRear?: ReadonlyArray<readonly [number, number]>;
  /**
   * Front roll-center height vs travel: `[travel_m, height_m]` pairs.
   */
  rollCenterTableFront?: ReadonlyArray<readonly [number, number]>;
  /** Rear roll-center height vs travel. */
  rollCenterTableRear?: ReadonlyArray<readonly [number, number]>;
  /**
   * Front progressive bump-stop rate table: `[penetration_m, rate_N/m]` pairs.
   * When omitted the legacy elastomer model is used.
   */
  bumpStopRateTableFront?: ReadonlyArray<readonly [number, number]>;
  /** Rear progressive bump-stop rate table. */
  bumpStopRateTableRear?: ReadonlyArray<readonly [number, number]>;

  // ---- M5 aero map (all additive / optional) ---------------------------------
  /**
   * Authored 2-D aero map. When present, ride-height/pitch/yaw-sensitive
   * downforce and drag are interpolated from the tables rather than computed
   * from the scalar `clAreaFrontM2` / `clAreaRearM2` / `yawAeroCoeff`.
   * Existing presets that omit this field continue to use the scalar path.
   */
  aeroMap?: {
    /**
     * Front `Cl·A` vs. [rideHeight_m, pitchDeg]. Each cell is the effective
     * lift-area product (m²) at that condition.
     */
    frontClAreaMap?: {
      axis0: ReadonlyArray<number>;
      axis1: ReadonlyArray<number>;
      data: ReadonlyArray<ReadonlyArray<number>>;
    };
    /**
     * Rear `Cl·A` vs. [rideHeight_m, pitchDeg].
     */
    rearClAreaMap?: {
      axis0: ReadonlyArray<number>;
      axis1: ReadonlyArray<number>;
      data: ReadonlyArray<ReadonlyArray<number>>;
    };
    /**
     * Yaw drag increment map vs. [yawDeg, speedKmh]. Output is extra Cd·A
     * added to the scalar base drag.
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
     * Used for telemetry flags; stall force reduction is in the table.
     */
    stallRideHeightM?: number;
  };

  // ---- M2 FFB geometry (all additive / optional) ----------------------
  /**
   * Kingpin inclination angle (degrees) for the FFB pipeline. Default 13 deg.
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
   * Caster trail (m) for the FFB Fx coupling stage. Default 0.016 m.
   */
  ffbCasterTrailM?: number;
  /**
   * Reference torque mapping rackForce = 1.0 (Nm). Default 25 Nm.
   */
  ffbMaxNm?: number;
  /**
   * Overall FFB gain applied before clipping. Default 1.0.
   */
  ffbGain?: number;
  /**
   * Speed at which power-steering assist peaks (km/h). Default 15 km/h.
   */
  ffbAssistPeakKmh?: number;
  /**
   * Minimum assist factor retained at high speed (0..1). Default 0.15.
   */
  ffbAssistMin?: number;

  // ---- M9: chassis compliance (all additive / optional) ---------------
  /**
   * Suspension bushing compliance and chassis torsional stiffness.
   * When absent the chassis is perfectly rigid (pre-M9 default).
   */
  compliance?: ComplianceConfig;

  // ---- M8: wake field (all additive / optional) ----------------------
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
   * is naturally aspirated (boost multiplier = 1 always).
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
   * Authored 2-D engine torque map (throttle axis × rpm axis, multiplier
   * values).  When present scales the base torque curve so fuelling maps,
   * flat-shift zones, and overrev cutbacks can be expressed as data.
   */
  engineTorqueMap?: {
    axis0: ReadonlyArray<number>;
    axis1: ReadonlyArray<number>;
    data: ReadonlyArray<ReadonlyArray<number>>;
  };
  /**
   * Authored torque curve: `[rpm, Nm]` control-point list.  When present
   * replaces the built-in NA curve for this vehicle.
   */
  engineTorqueCurve?: ReadonlyArray<readonly [number, number]>;
  /**
   * Shift-refusal and shift-delay logic.  When absent the gearbox shifts
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
   * Engine-braking refinement.  When absent the engine uses the pre-M6
   * flat-constant drag model.
   */
  engineBraking?: {
    linearNmPerRadS?: number;
    constantNm?: number;
    pumpingCoeffNmPerRadS2?: number;
    maxBrakeTorqueNm?: number;
  };

  // ---- Chassis compliance (racing-chassis-compliance OpenSpec) ------
  /**
   * Suspension bushing and chassis torsional compliance parameters.
   * When absent or zero the hub is rigidly fixed to the chassis (legacy).
   */
  compliance?: ComplianceConfig;
}

/**
 * Chassis compliance authoring parameters.
 *
 * All fields are optional with zero defaults (rigid fallback).  When
 * nonzero, the engine creates per-corner hub bodies connected to the
 * chassis via compliant constraints and computes effective wheel rate as
 * the series combination of tire carcass, bushing, and spring stiffness.
 */
export interface ComplianceConfig {
  /** Hub linear bushing stiffness (N/m). 0 = rigid (infinite). */
  hubLinearStiffnessNpm?: number;
  /** Hub linear bushing damping (N·s/m). Default 0. */
  hubLinearDampingNspms?: number;
  /** Hub rotational bushing stiffness (N·m/deg). 0 = rigid. */
  hubRotationalStiffnessNmDeg?: number;
  /** Hub rotational bushing damping (N·m·s/deg). Default 0. */
  hubRotationalDampingNmSdeg?: number;
  /** Chassis torsional stiffness resisting roll/yaw twist (N·m/deg). Infinity = rigid. */
  chassisTorsionalStiffnessNmDeg?: number;
}

export interface VehicleDimensionsPreset {
  /** Overall body length including aero appendages (m). */
  overallLengthM?: number;
  /** Maximum body width excluding mirrors (m). */
  overallWidthM?: number;
  /** Roof height (m). */
  overallHeightM?: number;
  /** Front track width center-to-center (m). */
  frontTrackWidthM?: number;
  /** Rear track width center-to-center (m). */
  rearTrackWidthM?: number;
}

export interface TireGeometryPreset {
  /** Front tyre section width (m). */
  frontSectionWidthM?: number;
  /** Rear tyre section width (m). */
  rearSectionWidthM?: number;
  /** Front tyre overall diameter (m). */
  frontOverallDiameterM?: number;
  /** Rear tyre overall diameter (m). */
  rearOverallDiameterM?: number;
}

export interface VehiclePreset {
  id: string;
  label: string;
  driveLabel: DriveLabel;
  layoutLabel: string;
  /** Body colour as hex integer. */
  color: number;
  /** Wheelbase (front-to-rear axle) in metres. */
  wheelbase: number;
  /** Track width (left-to-right) in metres. */
  trackWidth: number;
  /** Static front-axle mass percentage (0..1). */
  frontMassPct: number;
  /** Optional explicit body and per-axle dimensions for rendering / wheel placement. */
  dimensions?: VehicleDimensionsPreset;
  /** Optional tyre geometry for wheel placement, inertia, and rendering. */
  tires?: TireGeometryPreset;
  finalDrive: number;
  gears: ReadonlyArray<GearRatio>;
  steerMaxDeg: number;
  axleDrive: AxleDriveShare;
  diffType: DiffType;
  /** Optional runtime tuning that lets each built-in car feel distinct. */
  physics?: VehiclePhysicsPreset;
}
