/**
 * Tire core thermal model. Heat enters from sliding work at the contact
 * patch (longitudinal slip velocity * Fx + lateral slip velocity * Fy) and
 * leaves through convective cooling that scales with airflow over the tire.
 * `tireTempMu` returns a multiplicative grip factor versus tire core
 * temperature, peaking around the optimal operating window and falling off
 * either side.
 */

export const TIRE_AMBIENT_C = 30;
export const TIRE_OPTIMAL_C = 90;
export const TIRE_HEAT_K = 1 / 240000; // K per Joule of slide energy
export const TIRE_COOL_K = 0.05;
export const TIRE_COOL_V = 0.0035;

export function tireTempMu(tempC: number): number {
  // Inverted parabola peaking at TIRE_OPTIMAL_C with width 60°C.
  const x = (tempC - TIRE_OPTIMAL_C) / 60;
  const factor = 1 - 0.55 * x * x;
  return Math.max(0.4, Math.min(1.05, factor));
}

export interface TireThermalStep {
  tempC: number;
  /** Sliding power at the contact patch (W). */
  slidePower: number;
  /** Forward speed of the contact patch (m/s, magnitude). */
  contactSpeed: number;
  ambientC?: number;
  dt: number;
}

export function stepTireTemperature(input: TireThermalStep): number {
  const ambient = input.ambientC ?? TIRE_AMBIENT_C;
  const cool = TIRE_COOL_K + TIRE_COOL_V * input.contactSpeed;
  let temp = input.tempC + TIRE_HEAT_K * input.slidePower * input.dt;
  temp += -cool * (temp - ambient) * input.dt;
  return temp;
}
