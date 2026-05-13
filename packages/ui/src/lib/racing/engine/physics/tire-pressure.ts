/**
 * Tire pressure model (M1).
 *
 * Tracks how tire inflation pressure evolves during a session and how it
 * influences grip and stiffness. The model is intentionally minimal:
 *
 *   - Cold pressure is the authored value (default 200 kPa / ~29 psi for a
 *     sport tire on asphalt).
 *   - Pressure rises with the average tire core temperature following the
 *     ideal-gas relationship: P ∝ T (K). Hot pressure at 90 °C optimum ≈
 *     220–230 kPa for a typical sport setup.
 *   - Mu scale: over-inflation compresses the contact patch → slight grip
 *     loss. Under-inflation expands the contact patch → grip drop at extreme
 *     deformation. The sensitivity curve is a shallow inverted parabola
 *     centred on `optimalKpa`.
 *   - Contact patch width scale: wider at lower pressure, used by the thermal
 *     model to distribute heat across the inner/middle/outer strips.
 *
 * Per-corner pressure editing is deferred to M7; in M1 all four tires share
 * the same `nominalColdKpa` value from the vehicle preset (or the default).
 */

/** Nominal cold inflation pressure (kPa) for a sport / race tire. */
export const TIRE_PRESSURE_COLD_KPA = 200;
/**
 * Optimal hot pressure (kPa) at the thermal optimum. Set equal to the cold
 * pressure so `tirePressureMu` returns 1.0 at startup, avoiding an initial
 * grip penalty when the tire is at ambient temperature. The target hot
 * pressure the gas-law step converges toward is determined by temperature
 * rather than this constant; this value sets the grip-curve centre.
 */
export const TIRE_PRESSURE_OPTIMAL_KPA = 200;
/**
 * Half-width of the grip sensitivity curve (kPa). At `optimalKpa ± halfWidth`
 * the grip falls to `1 - peakDrop` of the peak.
 */
const PRESSURE_SENSITIVITY_HALF_KPA = 40;
const PRESSURE_GRIP_PEAK_DROP = 0.08;

/** Ambient temperature reference for the ideal-gas calculation (K). */
const T_AMBIENT_K = 303.15; // 30 °C

export interface TirePressureState {
  /** Current inflation pressure (kPa). */
  pressureKpa: number;
}

export interface TirePressureInput {
  /** Current pressure (kPa). */
  pressureKpa: number;
  /**
   * Average tire core temperature (°C). Used for thermal-expansion step.
   * Pass the average of inner/middle/outer strip temps if available,
   * otherwise the single legacy `tempC` value.
   */
  tempAvgC: number;
  /** Authored cold-inflation pressure (kPa). Defaults to `TIRE_PRESSURE_COLD_KPA`. */
  coldKpa?: number;
  dt: number;
}

/**
 * Advance the tire pressure state by one step.
 *
 * The ideal-gas model sets a temperature-dependent target pressure and
 * first-order relaxes the actual pressure toward it. The time constant
 * (~4 s) models the slow diffusion of heat through the carcass, which
 * prevents instantaneous pressure spikes from sharp thermal changes.
 */
export function stepTirePressure(input: TirePressureInput): number {
  const coldKpa = input.coldKpa ?? TIRE_PRESSURE_COLD_KPA;
  const tempK = input.tempAvgC + 273.15;
  // Ideal-gas target: P_hot = P_cold * (T_hot / T_cold).
  const targetKpa = coldKpa * (tempK / T_AMBIENT_K);
  // First-order lag — 4 s time constant. At 240 Hz this barely moves each
  // step, which is intentional: pressure changes are driven by carcass
  // temperature, not instantaneous patch temperature.
  const tau = 4.0;
  return input.pressureKpa + (targetKpa - input.pressureKpa) * (1 - Math.exp(-input.dt / tau));
}

/**
 * Grip multiplier from tire pressure deviation from optimal.
 *
 * Returns a value in roughly `[1 - PRESSURE_GRIP_PEAK_DROP, 1]`: 1.0 at
 * optimal pressure, decaying symmetrically for both over- and under-inflation.
 * The parabola is shallow by design — pressure has a secondary effect on grip
 * compared with thermal state and surface mu.
 *
 * @param pressureKpa - Current inflation pressure (kPa).
 * @param optimalKpa  - Optimal pressure (defaults to `TIRE_PRESSURE_OPTIMAL_KPA`).
 */
export function tirePressureMu(pressureKpa: number, optimalKpa = TIRE_PRESSURE_OPTIMAL_KPA): number {
  const x = (pressureKpa - optimalKpa) / PRESSURE_SENSITIVITY_HALF_KPA;
  const factor = 1 - PRESSURE_GRIP_PEAK_DROP * x * x;
  return Math.max(1 - PRESSURE_GRIP_PEAK_DROP * 2, Math.min(1.0, factor));
}

/**
 * Contact-patch width normalizer (dimensionless, centred on 1.0 at optimal).
 *
 * Lower pressure spreads the patch laterally; this scaling factor feeds the
 * inner/outer thermal bias in the multi-zone thermal model — a low-pressure
 * tire runs hotter on the outer strips because the shoulder contact is wider.
 * Range is clamped to [0.85, 1.1] to prevent unrealistic extremes.
 *
 * @param pressureKpa - Current inflation pressure (kPa).
 * @param optimalKpa  - Optimal pressure.
 */
export function tirePressurePatchWidthScale(
  pressureKpa: number,
  optimalKpa = TIRE_PRESSURE_OPTIMAL_KPA,
): number {
  const ratio = optimalKpa / Math.max(1, pressureKpa);
  return Math.max(0.85, Math.min(1.1, ratio));
}
