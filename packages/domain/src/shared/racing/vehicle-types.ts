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
