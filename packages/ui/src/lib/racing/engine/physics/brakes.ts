/**
 * Brake torque + brake-disc thermal model. Disc heat rises from work done
 * against rotation (τ·ω·dt) and falls through convective cooling that scales
 * with the airflow over the disc. Past a fade-onset temperature, the peak
 * torque the pad can transmit drops linearly until it hits 50% at
 * `fadeFullC`. This produces the "long brake pedal" feel of repeated heavy
 * braking.
 *
 * `BRAKE_FADE_T0` and `BRAKE_FADE_T1` mirror the prototype constants
 * (220°C onset, 500°C 50% fade).
 */

export const BRAKE_AMBIENT_C = 30;
export const BRAKE_FADE_T0 = 220;
export const BRAKE_FADE_T1 = 500;
export const BRAKE_HEAT_K = 1 / 80000; // K per Joule
export const BRAKE_COOL_K = 0.04;
export const BRAKE_COOL_V = 0.0035;

export interface BrakeFadeInput {
  brakeTempC: number;
  fadeOnsetC?: number;
  fadeFullC?: number;
}

export function brakeFadeFactor({
  brakeTempC,
  fadeOnsetC = BRAKE_FADE_T0,
  fadeFullC = BRAKE_FADE_T1,
}: BrakeFadeInput): number {
  const span = Math.max(1, fadeFullC - fadeOnsetC);
  const t = Math.max(0, Math.min(1, (brakeTempC - fadeOnsetC) / span));
  return 1 - 0.5 * t;
}

export interface BrakeThermalStep {
  brakeTempC: number;
  /** Brake torque applied this step (Nm, magnitude only). */
  brakeTorque: number;
  /** Wheel angular velocity (rad/s). */
  omega: number;
  /** Forward speed of the contact patch (m/s, magnitude only). */
  contactSpeed: number;
  dt: number;
  ambientC?: number;
}

export function stepBrakeTemperature(input: BrakeThermalStep): number {
  const ambient = input.ambientC ?? BRAKE_AMBIENT_C;
  const work = Math.abs(input.brakeTorque * input.omega) * input.dt;
  const cool = BRAKE_COOL_K + BRAKE_COOL_V * input.contactSpeed;
  let temp = input.brakeTempC + BRAKE_HEAT_K * work;
  temp += -cool * (temp - ambient) * input.dt;
  return temp;
}
