/**
 * Force Feedback (FFB) rack-force output pipeline.
 *
 * Converts per-wheel tire forces and steering geometry into a single
 * normalized `rackForce` value in [-1, 1] that the frontend device adapter
 * can scale to the wheel's physical force range.
 *
 * Architecture note: this module is pure physics math. It does NOT import
 * Gamepad API, Web HID, any browser globals, DOM types, or anything from
 * `packages/domain/**`. The caller (RacingEngine) collects inputs from its
 * wheel/chassis state and passes them as plain numbers.
 *
 * Pipeline stages:
 *  1. KPI (kingpin inclination) + SAI (steering axis inclination) — lateral
 *     load on the steering axis generates a centering torque proportional to
 *     front-axle vertical load and the KPI moment arm.
 *  2. Pneumatic trail Mz from the front aligning-moment model — carries the
 *     "going light at the limit" feel at high slip angles.
 *  3. Fx scrub-radius + caster coupling — road-kick and braking pull.
 *  4. Power-steering assist shaping — logarithmic speed-sensitive assist
 *     reduces effort at low speed without eliminating feel at high speed.
 *  5. Gain × user-configurable overall scale.
 *  6. Symmetric clipping to [-ffbMaxNm, +ffbMaxNm], then normalization to
 *     [-1, 1] so the output is device-independent.
 *  7. Finite-safe defaults: NaN / Infinity from upstream are replaced with 0
 *     so a single bad physics step never explodes the device output.
 */

const clamp = (v: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, v));

/** Replace non-finite values with `fallback` (default 0). */
function safe(v: number, fallback = 0): number {
  return Number.isFinite(v) ? v : fallback;
}

// ---- Default geometry constants -----------------------------------------

/** Default kingpin inclination angle (degrees). */
export const DEFAULT_KPI_DEG = 13.0;
/** Default SAI / steering-axis inclination contribution scale. */
export const DEFAULT_SAI_SCALE = 0.55;
/** Default front scrub radius (m) — moment arm for Fx coupling. */
export const DEFAULT_SCRUB_RADIUS_FFB_M = 0.015;
/** Default caster trail used for FFB Fx coupling (m). */
export const DEFAULT_CASTER_TRAIL_FFB_M = 0.016;
/** Default reference torque that maps to rackForce = 1.0 (Nm). */
export const DEFAULT_FFB_MAX_NM = 25.0;
/** Default overall FFB gain applied before clipping. */
export const DEFAULT_FFB_GAIN = 1.0;
/** Default speed (km/h) below which power-steering assist fully engages. */
export const DEFAULT_ASSIST_PEAK_KMH = 15.0;
/** Default minimum assist factor retained at high speed (0..1). */
export const DEFAULT_ASSIST_MIN = 0.15;

// ---- Public types -------------------------------------------------------

/** Steering/FFB geometry knobs used by the FFB pipeline. All fields optional. */
export interface FfbGeometry {
  /** Kingpin inclination angle (degrees). Default 13 deg. */
  kpiDeg?: number;
  /** Multiplier on the KPI/SAI lateral contribution. Default 0.55. */
  saiScale?: number;
  /** Scrub radius (m) — Fx × scrub contributes kick-back feel. Default 0.015 m. */
  scrubRadiusM?: number;
  /**
   * Caster-trail length for FFB Fx coupling (m). Tunable independently from
   * the keyboard self-centre caster trail. Default 0.016 m.
   */
  casterTrailM?: number;
  /**
   * Reference torque that maps to rackForce = 1.0 (Nm). Effectively the
   * "max force" ceiling before normalization. Default 25 Nm.
   */
  ffbMaxNm?: number;
  /** Overall gain applied before the clip. Default 1.0. */
  ffbGain?: number;
  /**
   * Speed at which the power-steering assist is at its maximum (km/h).
   * Below this speed rack force is reduced toward zero. Default 15 km/h.
   */
  assistPeakKmh?: number;
  /**
   * Minimum assist factor retained at high speed (0..1). Default 0.15.
   * A non-zero value ensures a residual light feel at highway speeds.
   */
  assistMin?: number;
}

/** Per-step inputs to the FFB pipeline from the engine's wheel/chassis state. */
export interface FfbStepInput {
  /** Current chassis speed (km/h). */
  speedKmh: number;
  /** Front-left lateral tire force Fy (N). Positive = toward chassis +X. */
  fyFL: number;
  /** Front-right lateral tire force Fy (N). */
  fyFR: number;
  /** Front-left vertical load Fz (N). */
  fzFL: number;
  /** Front-right vertical load Fz (N). */
  fzFR: number;
  /** Front-left aligning moment Mz (Nm) from the engine's aligning model. */
  mzFL: number;
  /** Front-right aligning moment Mz (Nm). */
  mzFR: number;
  /** Front-left longitudinal force Fx (N). */
  fxFL: number;
  /** Front-right longitudinal force Fx (N). */
  fxFR: number;
  /**
   * Normalized steering input in [-1, 1]. Positive = left-turn command.
   * Used to sign the KPI/SAI centering contribution.
   */
  steerNorm: number;
  /** Optional per-vehicle FFB geometry overrides from the vehicle preset. */
  geometry?: FfbGeometry;
}

/** Result of the FFB pipeline for one simulation step. */
export interface FfbResult {
  /**
   * Normalized rack force in [-1, 1].
   * Positive = force resisting a left-turn input (steer > 0).
   * The device adapter multiplies this by the wheel's physical max torque.
   */
  rackForce: number;
  /** Raw KPI/SAI centering torque before assist shaping (Nm). */
  kpiTorqueNm: number;
  /** Raw aligning moment from both front tires (Nm). */
  mzContributionNm: number;
  /** Raw Fx scrub+caster coupling torque (Nm). */
  fxCouplingNm: number;
  /** Sum of all raw contributions before gain/clip (Nm). */
  totalRawNm: number;
  /** Power-steering assist scale applied this step (0..1). */
  assistScale: number;
}

// ---- Sub-computation helpers --------------------------------------------

/**
 * Power-steering assist scale.
 *
 * Below `assistPeakKmh`: scale ramps 0 → 1 on a log curve (light feel).
 * Above `assistPeakKmh`: scale falls toward `assistMin` (retained tire feel).
 */
export function computeAssistScale(
  speedKmh: number,
  assistPeakKmh: number,
  assistMin: number,
): number {
  const s = Math.max(0, safe(speedKmh));
  const peak = Math.max(1, safe(assistPeakKmh, DEFAULT_ASSIST_PEAK_KMH));
  const minF = clamp(safe(assistMin, DEFAULT_ASSIST_MIN), 0, 1);
  if (s <= 0) return 0;
  const logS = Math.log1p(s);
  const logPeak = Math.log1p(peak);
  if (s <= peak) {
    return clamp(logS / logPeak, 0, 1);
  }
  return clamp(minF + (1 - minF) * (logPeak / logS), minF, 1);
}

/**
 * KPI / SAI centering torque.
 * An inclined steering axis generates a torque proportional to front-axle
 * vertical load that resists the current steer input.
 */
export function computeKpiSaiTorque(
  fzFL: number,
  fzFR: number,
  steerNorm: number,
  kpiDeg: number,
  saiScale: number,
): number {
  const kpiRad = Math.abs(safe(kpiDeg, DEFAULT_KPI_DEG)) * (Math.PI / 180);
  const totalFz = Math.max(0, safe(fzFL) + safe(fzFR));
  const magnitude = safe(saiScale, DEFAULT_SAI_SCALE) * totalFz * Math.sin(kpiRad);
  return safe(steerNorm) * magnitude;
}

/**
 * Pneumatic trail + caster Mz contribution from both front tires.
 */
export function computeMzContribution(mzFL: number, mzFR: number): number {
  return safe(mzFL) + safe(mzFR);
}

/**
 * Scrub radius + caster trail Fx coupling.
 * Longitudinal force at the scrub/caster arm generates a torque about the
 * kingpin felt as road-kick under braking or strong traction.
 */
export function computeFxCoupling(
  fxFL: number,
  fxFR: number,
  scrubRadiusM: number,
  casterTrailM: number,
): number {
  const arm = Math.max(0, safe(scrubRadiusM) + safe(casterTrailM));
  return (safe(fxFL) + safe(fxFR)) * arm;
}

// ---- Full pipeline -------------------------------------------------------

/**
 * Compute rack force for one simulation step.
 *
 * All non-finite input values are silently replaced with 0 so that a single
 * unstable physics step cannot lock up or saturate the device output.
 */
export function computeRackForce(input: FfbStepInput): FfbResult {
  const g = input.geometry ?? {};
  const kpiDeg = safe(g.kpiDeg ?? DEFAULT_KPI_DEG);
  const saiScale = safe(g.saiScale ?? DEFAULT_SAI_SCALE);
  const scrubM = safe(g.scrubRadiusM ?? DEFAULT_SCRUB_RADIUS_FFB_M);
  const casterTrailM = safe(g.casterTrailM ?? DEFAULT_CASTER_TRAIL_FFB_M);
  const ffbMaxNm = Math.max(1, safe(g.ffbMaxNm ?? DEFAULT_FFB_MAX_NM));
  const ffbGain = Math.max(0, safe(g.ffbGain ?? DEFAULT_FFB_GAIN));
  const assistPeakKmh = Math.max(1, safe(g.assistPeakKmh ?? DEFAULT_ASSIST_PEAK_KMH));
  const assistMin = clamp(safe(g.assistMin ?? DEFAULT_ASSIST_MIN), 0, 1);

  const kpiTorqueNm = computeKpiSaiTorque(
    input.fzFL, input.fzFR, input.steerNorm, kpiDeg, saiScale,
  );
  const mzContributionNm = computeMzContribution(input.mzFL, input.mzFR);
  const fxCouplingNm = computeFxCoupling(input.fxFL, input.fxFR, scrubM, casterTrailM);

  const totalRawNm = kpiTorqueNm + mzContributionNm + fxCouplingNm;
  const assistScale = computeAssistScale(input.speedKmh, assistPeakKmh, assistMin);
  const gained = totalRawNm * assistScale * ffbGain;
  const clipped = clamp(gained, -ffbMaxNm, ffbMaxNm);
  const rackForce = clipped / ffbMaxNm;

  return {
    rackForce: safe(rackForce, 0),
    kpiTorqueNm: safe(kpiTorqueNm, 0),
    mzContributionNm: safe(mzContributionNm, 0),
    fxCouplingNm: safe(fxCouplingNm, 0),
    totalRawNm: safe(totalRawNm, 0),
    assistScale,
  };
}
