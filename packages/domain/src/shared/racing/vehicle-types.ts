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
  finalDrive: number;
  gears: ReadonlyArray<GearRatio>;
  steerMaxDeg: number;
  axleDrive: AxleDriveShare;
  diffType: DiffType;
  /** Optional runtime tuning that lets each built-in car feel distinct. */
  physics?: VehiclePhysicsPreset;
}
