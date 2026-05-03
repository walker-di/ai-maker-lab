/**
 * Setup-screen tunables. These are the values the user can adjust between
 * sessions; they persist in `localStorage` and (optionally) through the
 * RacingTransport.
 */

export interface SetupValues {
  frontToeDeg: number;
  rearToeDeg: number;
  casterDeg: number;
  /** 0 = parallel steering, 1 = ideal Ackermann. */
  ackermannPct: number;
  motionRatioFront: number;
  motionRatioRear: number;
  bumpStopGapFrontMm: number;
  bumpStopGapRearMm: number;
  bumpStopRateFrontNmm: number;
  bumpStopRateRearNmm: number;
}

export const DEFAULT_SETUP: Readonly<SetupValues> = Object.freeze({
  frontToeDeg: 0.0,
  rearToeDeg: 0.0,
  casterDeg: 0.0,
  ackermannPct: 0.0,
  motionRatioFront: 1.0,
  motionRatioRear: 1.0,
  bumpStopGapFrontMm: 220,
  bumpStopGapRearMm: 220,
  bumpStopRateFrontNmm: 0,
  bumpStopRateRearNmm: 0,
});

export function defaultSetup(): SetupValues {
  return { ...DEFAULT_SETUP };
}

const NUMBER_FIELDS: ReadonlyArray<keyof SetupValues> = [
  'frontToeDeg',
  'rearToeDeg',
  'casterDeg',
  'ackermannPct',
  'motionRatioFront',
  'motionRatioRear',
  'bumpStopGapFrontMm',
  'bumpStopGapRearMm',
  'bumpStopRateFrontNmm',
  'bumpStopRateRearNmm',
];

interface FieldRange {
  min: number;
  max: number;
}

const RANGES: Readonly<Record<keyof SetupValues, FieldRange>> = Object.freeze({
  frontToeDeg: { min: -2.0, max: 2.0 },
  rearToeDeg: { min: -2.0, max: 2.0 },
  casterDeg: { min: 0.0, max: 12.0 },
  ackermannPct: { min: 0.0, max: 1.0 },
  motionRatioFront: { min: 0.4, max: 1.5 },
  motionRatioRear: { min: 0.4, max: 1.5 },
  bumpStopGapFrontMm: { min: 50, max: 350 },
  bumpStopGapRearMm: { min: 50, max: 350 },
  bumpStopRateFrontNmm: { min: 0, max: 600 },
  bumpStopRateRearNmm: { min: 0, max: 600 },
});

function clampNumber(v: unknown, fallback: number, range: FieldRange): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : fallback;
  return Math.max(range.min, Math.min(range.max, n));
}

/**
 * Clamp every field to a safe range. Fields that are missing or non-numeric
 * are filled in from `DEFAULT_SETUP`.
 */
export function clampSetup(raw: Partial<SetupValues> | null | undefined): SetupValues {
  const source = raw ?? {};
  const out = defaultSetup();
  for (const key of NUMBER_FIELDS) {
    out[key] = clampNumber(source[key], DEFAULT_SETUP[key], RANGES[key]);
  }
  return out;
}
