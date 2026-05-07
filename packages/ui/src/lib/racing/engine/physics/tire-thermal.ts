/**
 * Tire thermal model (M1 — multi-zone).
 *
 * The tire tread is modelled as three lateral strips: inner (chassis side),
 * middle (crown), and outer (kerb/shoulder side). Each strip has an
 * independent temperature that evolves from its share of the sliding energy
 * and from lateral heat conduction between adjacent strips.
 *
 * Grip is computed from the AVERAGE of the three strip temperatures so that
 * uneven heating (e.g. excessive camber hot-spots the inner strip) slightly
 * reduces the overall mu even if the middle strip is at the optimum.
 *
 * Legacy single-zone interface (`stepTireTemperature`, `TireThermalStep`)
 * is preserved so existing callers compile without changes. The legacy
 * function internally maps to the average of the three-zone model using the
 * strip weights [0.25, 0.5, 0.25].
 */

import type { PressureDistribution } from './contact-patch.js';

export const TIRE_AMBIENT_C = 30;
export const TIRE_OPTIMAL_C = 90;
export const TIRE_HEAT_K = 1 / 240000; // K per Joule of slide energy
export const TIRE_COOL_K = 0.05;
export const TIRE_COOL_V = 0.0035;

/** Lateral conduction coefficient between adjacent strips (K/s per K difference). */
const STRIP_CONDUCTION_K = 0.8;

export function tireTempMu(tempC: number): number {
  // Inverted parabola peaking at TIRE_OPTIMAL_C with width 60°C.
  const x = (tempC - TIRE_OPTIMAL_C) / 60;
  const factor = 1 - 0.55 * x * x;
  return Math.max(0.4, Math.min(1.05, factor));
}

// ---------------------------------------------------------------------------
// Multi-zone types
// ---------------------------------------------------------------------------

export interface TireThermalZones {
  /** Inner strip temperature (°C) — chassis / camber side. */
  inner: number;
  /** Middle strip (crown) temperature (°C). */
  middle: number;
  /** Outer strip temperature (°C) — kerb / shoulder side. */
  outer: number;
}

export interface TireThermalZoneStep {
  zones: TireThermalZones;
  /** Sliding power at the contact patch (W). */
  slidePower: number;
  /** Forward speed of the contact patch (m/s, magnitude). */
  contactSpeed: number;
  /**
   * Lateral bias [-1, 1]: negative = load leans to inner strip (negative
   * camber / inside wheel), positive = outer strip. Used to distribute
   * sliding energy non-uniformly across the three strips. Supplied by the
   * engine from camber angle and lateral load transfer.
   *
   * A fully symmetric contact (zero bias) distributes heat as [0.25, 0.5, 0.25].
   * At bias = -1 all energy goes to the inner strip; at +1 to the outer.
   */
  lateralBias?: number;
  /**
   * Contact patch width normalizer (dimensionless). Output of
   * `tirePressurePatchWidthScale`: > 1 spreads heat more to the shoulders,
   * < 1 concentrates it in the crown. Defaults to 1.
   */
  patchWidthScale?: number;
  /**
   * Optional three-strip pressure distribution from the contact-patch model.
   * When supplied it becomes the heat-share baseline before slip/camber bias.
   */
  pressureDistribution?: PressureDistribution;
  ambientC?: number;
  dt: number;
}

/**
 * Advance a three-zone tire thermal state by one step.
 *
 * Each strip receives a fraction of the total sliding energy determined by
 * the contact bias and patch width, then cools convectively, then exchanges
 * heat laterally with its neighbours.
 */
export function stepTireTemperatureZones(input: TireThermalZoneStep): TireThermalZones {
  const ambient = input.ambientC ?? TIRE_AMBIENT_C;
  const bias = Math.max(-1, Math.min(1, input.lateralBias ?? 0));
  const widthScale = Math.max(0.85, Math.min(1.1, input.patchWidthScale ?? 1));
  const dt = input.dt;

  // Distribute sliding energy across the three strips.
  // Base distribution [0.25, 0.5, 0.25]; bias shifts energy from middle
  // toward inner (bias < 0) or outer (bias > 0). Width scale broadens the
  // shoulders at lower pressure.
  const biasAbs = Math.abs(bias);
  const shoulderShare = 0.25 * widthScale;
  const midShare = Math.max(0.1, 1 - 2 * shoulderShare);

  const patch = input.pressureDistribution;
  const baseInner = patch?.inner ?? shoulderShare;
  const baseMid = patch?.middle ?? midShare;
  const baseOuter = patch?.outer ?? shoulderShare;
  const innerBase = baseInner + (bias < 0 ? biasAbs * baseMid * 0.5 : 0);
  const outerBase = baseOuter + (bias > 0 ? bias * baseMid * 0.5 : 0);
  const midBase = Math.max(0, 1 - innerBase - outerBase);

  // Normalise so shares sum to 1.
  const shareTotal = innerBase + midBase + outerBase;
  const wInner = innerBase / shareTotal;
  const wMid = midBase / shareTotal;
  const wOuter = outerBase / shareTotal;

  const cool = TIRE_COOL_K + TIRE_COOL_V * input.contactSpeed;

  // Heat input + convective cooling per strip.
  let tInner = input.zones.inner + TIRE_HEAT_K * input.slidePower * wInner * dt;
  let tMid = input.zones.middle + TIRE_HEAT_K * input.slidePower * wMid * dt;
  let tOuter = input.zones.outer + TIRE_HEAT_K * input.slidePower * wOuter * dt;

  tInner -= cool * (tInner - ambient) * dt;
  tMid -= cool * (tMid - ambient) * dt;
  tOuter -= cool * (tOuter - ambient) * dt;

  // Lateral conduction: inner↔middle↔outer.
  const condIm = STRIP_CONDUCTION_K * (tMid - tInner);
  const condMo = STRIP_CONDUCTION_K * (tOuter - tMid);
  tInner += condIm * dt;
  tMid += (-condIm + condMo) * dt;
  tOuter -= condMo * dt;

  return { inner: tInner, middle: tMid, outer: tOuter };
}

/**
 * Average tire temperature from a three-zone state.
 * Weights: inner 25%, middle 50%, outer 25%.
 */
export function tireZoneAvgTemp(zones: TireThermalZones): number {
  return 0.25 * zones.inner + 0.5 * zones.middle + 0.25 * zones.outer;
}

/**
 * Mu from the three-zone state. Computed from the weighted average so a
 * single hot strip partially degrades overall grip without zeroing it.
 */
export function tireTempMuZones(zones: TireThermalZones): number {
  return tireTempMu(tireZoneAvgTemp(zones));
}

// ---------------------------------------------------------------------------
// Legacy single-zone interface (unchanged signatures — backward compatible)
// ---------------------------------------------------------------------------

export interface TireThermalStep {
  tempC: number;
  /** Sliding power at the contact patch (W). */
  slidePower: number;
  /** Forward speed of the contact patch (m/s, magnitude). */
  contactSpeed: number;
  ambientC?: number;
  dt: number;
}

/**
 * Legacy single-zone step. Retained for backward compatibility.
 * Internally routes through `stepTireTemperatureZones` with a symmetric bias.
 */
export function stepTireTemperature(input: TireThermalStep): number {
  const zones = stepTireTemperatureZones({
    zones: { inner: input.tempC, middle: input.tempC, outer: input.tempC },
    slidePower: input.slidePower,
    contactSpeed: input.contactSpeed,
    lateralBias: 0,
    ambientC: input.ambientC,
    dt: input.dt,
  });
  return tireZoneAvgTemp(zones);
}
