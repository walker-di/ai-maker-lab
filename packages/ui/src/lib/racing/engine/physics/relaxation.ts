/**
 * Tire relaxation-length filter.
 *
 * Real tires do not generate slip force instantaneously when the contact
 * patch starts to slide. The patch needs to travel some characteristic
 * distance (the *relaxation length* `sigma`) before the carcass deforms
 * enough to produce the steady-state Pacejka force for the current slip
 * input. Treating slip as an instantaneous algebraic function of contact
 * velocity (the legacy behaviour driven by `slipEps = 1.5 m/s` in the
 * engine wheel pass) is what produces the brittle low-speed cliff and the
 * "tire force snaps to its target" sensation that distinguishes our sim
 * from AC / AMS2 / rFactor 2.
 *
 * The relaxation-length model is a first-order lag where the time
 * constant is governed by *contact distance* rather than wall-clock time:
 *
 * ```text
 *   tau = sigma / |contactSpeed|
 *   dynamic <- dynamic + (target - dynamic) * (1 - exp(-dt / tau))
 * ```
 *
 * Because `tau` grows as the contact patch slows, the response naturally
 * stretches at low speed without needing a fake denominator floor in the
 * slip definition itself. At higher speed `tau` shrinks toward zero and
 * the dynamic value tracks the algebraic target closely.
 *
 * The helper is fully pure: it returns the next-step dynamic slip value
 * and does no allocation.
 *
 * Typical defaults from Phase 1 of the rework: longitudinal `sigmaX = 0.40 m`,
 * lateral `sigmaY = 0.55 m`. Real production tire models tune `sigma` per
 * compound and load.
 */

export interface RelaxationStepInput {
  /** Steady-state slip target (slip ratio or slip angle, in any units). */
  slipTarget: number;
  /** Slip value carried over from the previous step. */
  slipDynamic: number;
  /** Contact-patch travel speed used to compute the lag time constant (m/s). */
  contactSpeed: number;
  /** Relaxation length for the channel being filtered (m). */
  relaxationLength: number;
  /** Integration step (s). */
  dt: number;
}

/**
 * Step a single relaxation-filtered slip channel forward by `dt`.
 *
 * Behavioural contract (relied on by `relaxation.test.ts`):
 *
 * - When `relaxationLength <= 0` the helper degenerates to algebraic
 *   passthrough (`slipDynamic = slipTarget`), preserving the legacy
 *   behaviour for callers that opt into "no relaxation".
 * - When `dt <= 0` or `contactSpeed === 0` the helper returns
 *   `slipDynamic` unchanged. Slip cannot evolve without contact-patch
 *   travel, which is what kills the low-speed standstill chatter the
 *   legacy `slipEps` clamp was trying to mask.
 * - When `slipTarget` is non-finite (NaN/Infinity) the dynamic value is
 *   sanitised back to 0 so a single bad input cannot poison the lag
 *   forever.
 * - When `contactSpeed` or `slipDynamic` is non-finite the dynamic value
 *   is held at its last good value (caller-side recovery is preferred to
 *   silently zeroing the response).
 */
export function stepRelaxedSlip(input: RelaxationStepInput): number {
  if (!Number.isFinite(input.slipTarget)) return 0;
  if (!Number.isFinite(input.slipDynamic)) return input.slipDynamic;
  if (!Number.isFinite(input.contactSpeed)) return input.slipDynamic;
  if (input.relaxationLength <= 0) return input.slipTarget;
  if (input.dt <= 0) return input.slipDynamic;

  const speed = Math.abs(input.contactSpeed);
  if (speed <= 0) return input.slipDynamic;

  const tau = input.relaxationLength / speed;
  const alpha = 1 - Math.exp(-input.dt / tau);
  return input.slipDynamic + (input.slipTarget - input.slipDynamic) * alpha;
}
