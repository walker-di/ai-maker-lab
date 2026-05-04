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
