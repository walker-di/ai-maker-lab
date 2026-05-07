/**
 * Lightweight dynamic contact-patch helpers.
 *
 * Top-tier sims do not treat the tire as a single algebraic point. This
 * module adds the first measurable carcass/contact-patch layer while staying
 * cheap enough for the current 240 Hz JS engine:
 *
 * - load/pressure/slip-sensitive relaxation length,
 * - sliding-speed grip loss,
 * - three-strip pressure distribution,
 * - overturning-moment telemetry from pressure centroid.
 *
 * The helpers are pure so the validation harness can exercise the same logic
 * the runtime uses.
 */

export interface PressureDistribution {
  inner: number;
  middle: number;
  outer: number;
  /** Lateral centroid in metres; negative = inner/chassis side. */
  centroidM: number;
}

export interface ContactPatchDistributionInput {
  /** Effective wheel camber angle (rad). Negative camber loads the inner strip. */
  camberRad: number;
  /** Current inflation pressure (kPa). */
  pressureKpa: number;
  /** Pressure where the patch is most evenly loaded (kPa). */
  optimalPressureKpa: number;
  /** Half-width of the useful tread contact area (m). */
  patchHalfWidthM?: number;
}

export interface LoadSensitiveRelaxationInput {
  baseLengthM: number;
  /** Current vertical load (N). */
  fz: number;
  /** Reference vertical load for the fitted tire (N). */
  fz0?: number;
  /** Effective surface/tire mu. Lower grip generally stretches response. */
  mu?: number;
  /** Current pressure (kPa). */
  pressureKpa?: number;
  /** Optimal pressure (kPa). */
  optimalPressureKpa?: number;
  /** Combined slip magnitude, using radians for alpha. */
  slipMagnitude?: number;
}

export interface SlidingGripInput {
  /** Contact-patch sliding speed magnitude (m/s). */
  slidingSpeedMps: number;
  /** Strength of speed-sensitive loss. Default is tuned for dry GT slicks. */
  sensitivity?: number;
  /** Lower bound on grip scale. */
  minScale?: number;
}

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

export function computeContactPatchPressureDistribution(
  input: ContactPatchDistributionInput,
): PressureDistribution {
  const halfWidth = input.patchHalfWidthM ?? 0.14;
  const pressureRatio = input.pressureKpa / Math.max(1, input.optimalPressureKpa);

  // Under-pressure loads the shoulders; over-pressure concentrates the crown.
  const shoulderBias = clamp((1 - pressureRatio) * 0.35, -0.18, 0.22);
  const shoulderShare = clamp(0.25 + shoulderBias, 0.12, 0.42);
  const middleBase = clamp(1 - 2 * shoulderShare, 0.16, 0.76);

  // Negative camber shifts the centroid inward. Keep it bounded so telemetry
  // stays usable even for deliberately extreme setup sweeps.
  const camberBias = clamp(-input.camberRad * 3.8, -0.45, 0.45);
  const inner = shoulderShare + Math.max(0, camberBias) * middleBase * 0.5;
  const outer = shoulderShare + Math.max(0, -camberBias) * middleBase * 0.5;
  const middle = Math.max(0.08, 1 - inner - outer);
  const total = inner + middle + outer;

  const normalized = {
    inner: inner / total,
    middle: middle / total,
    outer: outer / total,
  };
  const centroidM = (normalized.outer - normalized.inner) * halfWidth;
  return { ...normalized, centroidM };
}

export function computeOverturningMomentNm(
  fz: number,
  distribution: PressureDistribution,
): number {
  if (!Number.isFinite(fz) || fz <= 0) return 0;
  return fz * distribution.centroidM;
}

export function computeSlidingGripScale(input: SlidingGripInput): number {
  const speed = Math.max(0, Number.isFinite(input.slidingSpeedMps) ? input.slidingSpeedMps : 0);
  const sensitivity = input.sensitivity ?? 0.032;
  const minScale = input.minScale ?? 0.82;
  return clamp(1 - sensitivity * Math.log1p(speed * speed), minScale, 1);
}

export function computeLoadSensitiveRelaxationLength(
  input: LoadSensitiveRelaxationInput,
): number {
  if (!Number.isFinite(input.baseLengthM) || input.baseLengthM <= 0) return 0;
  const fz0 = input.fz0 ?? 3500;
  const fz = Math.max(1, Number.isFinite(input.fz) ? input.fz : fz0);
  const mu = Math.max(0.1, Number.isFinite(input.mu ?? 1) ? input.mu ?? 1 : 1);
  const pressureKpa = input.pressureKpa ?? input.optimalPressureKpa ?? 200;
  const optimalPressureKpa = input.optimalPressureKpa ?? 200;
  const slipMagnitude = Math.max(0, input.slipMagnitude ?? 0);

  const loadScale = clamp(Math.sqrt(fz0 / fz), 0.72, 1.45);
  const gripScale = clamp(1 + (1 - mu) * 0.24, 0.86, 1.24);
  const pressureScale = clamp(1 + Math.abs(pressureKpa - optimalPressureKpa) / optimalPressureKpa * 0.28, 0.92, 1.22);
  const slipScale = clamp(1 + Math.min(slipMagnitude, 1.2) * 0.16, 1, 1.19);

  return input.baseLengthM * loadScale * gripScale * pressureScale * slipScale;
}
