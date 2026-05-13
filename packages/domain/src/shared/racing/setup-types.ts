/**
 * Setup-screen tunables. These are the values the user can adjust between
 * sessions; they persist in `localStorage` and (optionally) through the
 * RacingTransport.
 *
 * M7: expanded with springs, dampers, diff, per-corner tire pressures,
 * camber, brake bias, ride height, fuel load, and gear-ratio multiplier.
 * All new fields are optional for backward compatibility; `clampSetup()`
 * fills missing values from `DEFAULT_SETUP`.
 *
 * Deferred to M8 or later:
 *   - Per-axle Pacejka coefficient overrides via setup (too complex for UI)
 *   - Authored kinematic-table swapping via setup (preset concern, not setup)
 *   - ARB rates (additive preset field; deferred until suspension UI group
 *     is finalised)
 */

export interface SetupValues {
  // ---- M0/pre-M7: geometry & bump-stop tunables -------------------------
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

  // ---- M7: suspension springs -------------------------------------------
  /** Front spring rate (N/m). 0 = use the vehicle preset's value. */
  springFrontNpm: number;
  /** Rear spring rate (N/m). 0 = use the vehicle preset's value. */
  springRearNpm: number;

  // ---- M7: damper scalers -----------------------------------------------
  /**
   * Front bump-damper multiplier applied to the preset base coefficient.
   * 1.0 = unmodified; range [0.5, 2.0].
   */
  damperBumpFrontScale: number;
  /**
   * Front rebound-damper multiplier. 1.0 = unmodified; range [0.5, 2.0].
   */
  damperReboundFrontScale: number;
  /**
   * Rear bump-damper multiplier. 1.0 = unmodified; range [0.5, 2.0].
   */
  damperBumpRearScale: number;
  /**
   * Rear rebound-damper multiplier. 1.0 = unmodified; range [0.5, 2.0].
   */
  damperReboundRearScale: number;

  // ---- M7: differential -------------------------------------------------
  /**
   * LSD power-ramp factor (0–1). Only meaningful when diffType =
   * 'clutchLSD'; ignored otherwise.
   */
  diffPowerRamp: number;
  /** LSD coast-ramp factor (0–1). Only meaningful for clutchLSD. */
  diffCoastRamp: number;
  /** LSD preload torque (N·m). Range [0, 200]. */
  diffPreloadNm: number;

  // ---- M7: per-corner tire pressures ------------------------------------
  /** Front-left cold inflation pressure (kPa). */
  tirePressureFLKpa: number;
  /** Front-right cold inflation pressure (kPa). */
  tirePressureFRKpa: number;
  /** Rear-left cold inflation pressure (kPa). */
  tirePressureRLKpa: number;
  /** Rear-right cold inflation pressure (kPa). */
  tirePressureRRKpa: number;

  // ---- M7: camber -------------------------------------------------------
  /** Front static camber (deg, negative = top of wheel leans inward). */
  camberFrontDeg: number;
  /** Rear static camber (deg, negative = top of wheel leans inward). */
  camberRearDeg: number;

  // ---- M7: brake bias ---------------------------------------------------
  /**
   * Front brake-bias fraction (0–1). Overrides the vehicle preset.
   * 0.565 is a typical baseline for mid-engine RWD.
   */
  brakeBiasFront: number;

  // ---- M7: ride height --------------------------------------------------
  /**
   * Front ride-height offset (mm) added to the default suspension design
   * length. Positive raises the car; negative lowers it. Range [-30, 30].
   */
  rideHeightFrontMm: number;
  /** Rear ride-height offset (mm). Range [-30, 30]. */
  rideHeightRearMm: number;

  // ---- M7: fuel load ----------------------------------------------------
  /**
   * Fuel-tank fill level (0–1). 0 = no mass delta (backward-compatible
   * default — the preset massKg is used as-is). 1.0 = full tank adds
   * MAX_FUEL_MASS_KG (80 kg) on top of the preset base mass.
   */
  fuelLoad: number;

  // ---- M7: gear-ratio trim ----------------------------------------------
  /**
   * Uniform final-drive multiplier applied on top of the preset's
   * finalDrive ratio. 1.0 = unmodified; range [0.7, 1.5].
   * Allows the user to lengthen or shorten gearing without swapping ratio
   * stacks. Full per-gear editing is deferred to a future authoring surface.
   */
  finalDriveScale: number;
}

export const DEFAULT_SETUP: Readonly<SetupValues> = Object.freeze({
  // Pre-M7 fields
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
  // M7 springs (0 = "use preset value")
  springFrontNpm: 0,
  springRearNpm: 0,
  // M7 damper scalers
  damperBumpFrontScale: 1.0,
  damperReboundFrontScale: 1.0,
  damperBumpRearScale: 1.0,
  damperReboundRearScale: 1.0,
  // M7 diff (defaults match makeDefaultDrivetrainParams for backward compat)
  diffPowerRamp: 0.45,
  diffCoastRamp: 0.30,
  diffPreloadNm: 60,
  // M7 per-corner pressures (200 kPa ≈ 29 psi, nominal cold)
  tirePressureFLKpa: 200,
  tirePressureFRKpa: 200,
  tirePressureRLKpa: 200,
  tirePressureRRKpa: 200,
  // M7 camber
  camberFrontDeg: -1.5,
  camberRearDeg: -1.5,
  // M7 brake bias
  brakeBiasFront: 0.565,
  // M7 ride height
  rideHeightFrontMm: 0,
  rideHeightRearMm: 0,
  // M7 fuel (0 = no mass delta; uses preset massKg as-is — backward compat)
  fuelLoad: 0,
  // M7 final-drive scale
  finalDriveScale: 1.0,
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
  'springFrontNpm',
  'springRearNpm',
  'damperBumpFrontScale',
  'damperReboundFrontScale',
  'damperBumpRearScale',
  'damperReboundRearScale',
  'diffPowerRamp',
  'diffCoastRamp',
  'diffPreloadNm',
  'tirePressureFLKpa',
  'tirePressureFRKpa',
  'tirePressureRLKpa',
  'tirePressureRRKpa',
  'camberFrontDeg',
  'camberRearDeg',
  'brakeBiasFront',
  'rideHeightFrontMm',
  'rideHeightRearMm',
  'fuelLoad',
  'finalDriveScale',
];

interface FieldRange {
  min: number;
  max: number;
}

const RANGES: Readonly<Record<keyof SetupValues, FieldRange>> = Object.freeze({
  // Pre-M7
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
  // M7 springs (0 = "use preset"; max ~300 kN/m for stiff race car)
  springFrontNpm: { min: 0, max: 300_000 },
  springRearNpm: { min: 0, max: 300_000 },
  // M7 damper scalers
  damperBumpFrontScale: { min: 0.5, max: 2.0 },
  damperReboundFrontScale: { min: 0.5, max: 2.0 },
  damperBumpRearScale: { min: 0.5, max: 2.0 },
  damperReboundRearScale: { min: 0.5, max: 2.0 },
  // M7 diff
  diffPowerRamp: { min: 0.0, max: 1.0 },
  diffCoastRamp: { min: 0.0, max: 1.0 },
  diffPreloadNm: { min: 0, max: 200 },
  // M7 per-corner pressures (kPa: 130 ≈ 19 psi, 280 ≈ 41 psi)
  tirePressureFLKpa: { min: 130, max: 280 },
  tirePressureFRKpa: { min: 130, max: 280 },
  tirePressureRLKpa: { min: 130, max: 280 },
  tirePressureRRKpa: { min: 130, max: 280 },
  // M7 camber (typical GT/touring range)
  camberFrontDeg: { min: -4.5, max: 0.5 },
  camberRearDeg: { min: -4.5, max: 0.5 },
  // M7 brake bias
  brakeBiasFront: { min: 0.3, max: 0.8 },
  // M7 ride height offset (mm)
  rideHeightFrontMm: { min: -30, max: 30 },
  rideHeightRearMm: { min: -30, max: 30 },
  // M7 fuel (0 = no mass delta; full tank = 1.0 adds MAX_FUEL_MASS_KG)
  fuelLoad: { min: 0, max: 1.0 },
  // M7 final-drive scale
  finalDriveScale: { min: 0.7, max: 1.5 },
});

function clampNumber(v: unknown, fallback: number, range: FieldRange): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : fallback;
  return Math.max(range.min, Math.min(range.max, n));
}

/**
 * Clamp every field to a safe range. Fields that are missing or non-numeric
 * are filled in from `DEFAULT_SETUP`. Backward-compatible with old setup rows
 * that only carry the pre-M7 fields.
 */
export function clampSetup(raw: Partial<SetupValues> | null | undefined): SetupValues {
  const source = raw ?? {};
  const out = defaultSetup();
  for (const key of NUMBER_FIELDS) {
    out[key] = clampNumber(source[key], DEFAULT_SETUP[key], RANGES[key]);
  }
  return out;
}
