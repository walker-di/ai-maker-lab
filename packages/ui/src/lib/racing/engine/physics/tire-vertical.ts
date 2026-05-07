/**
 * Tire vertical compliance model (M1).
 *
 * A real tire is not a rigid disk — its carcass deforms under vertical load,
 * creating a spring-damper in series with the suspension. This module provides
 * a simple two-parameter model:
 *
 *   Fz_contact = kTire * deflection + cTire * deflection_rate
 *
 * where `deflection` is the difference between the geometric contact distance
 * (from the suspension raycast) and the loaded tire radius.
 *
 * In the engine integration, the tire spring acts in series with the suspension
 * spring. At 240 Hz the series stiffness approximation is close enough; a full
 * sub-step integration (like a proper contact solver) is overkill for M1.
 *
 * Practical effects:
 *   - Kerb hits: the stiff suspension sees a rapid geometry change; the tire
 *     compliance absorbs part of the impulse before it reaches the chassis.
 *   - Load spikes: `Fz` rises faster than the suspension alone would produce,
 *     giving M2 FFB rack force a more realistic jolt profile.
 *   - The compliance is pressure-sensitive: a higher-pressure tire is stiffer
 *     (less deflection per unit load), which ties into the pressure model.
 *
 * Default stiffness is calibrated for a 205/55 R16 at 200 kPa: roughly
 * 160 000 N/m radial stiffness (empirical data from Michelin/Bridgestone
 * tire stiffness tables for sport/road tires).
 */

/** Default tire radial stiffness (N/m). */
export const TIRE_RADIAL_STIFFNESS_NPM = 160_000;
/** Default tire radial damping (N·s/m). Roughly 1–2% of stiffness × resonance period. */
export const TIRE_RADIAL_DAMPING_NSPM = 400;
/** Minimum pressure reference for stiffness scaling (kPa). */
const PRESSURE_REFERENCE_KPA = 200;

export interface TireVerticalInput {
  /**
   * Geometric contact distance from the suspension attachment point to the
   * ground (m). Equal to the raycast `t` value returned by the suspension
   * raycast pass.
   */
  contactDistance: number;
  /** Unloaded (free) tire radius (m). */
  radius: number;
  /** Tire radial spring stiffness (N/m). Defaults to `TIRE_RADIAL_STIFFNESS_NPM`. */
  kTireNpm?: number;
  /** Tire radial damping coefficient (N·s/m). Defaults to `TIRE_RADIAL_DAMPING_NSPM`. */
  cTireNspm?: number;
  /** Current tire deflection rate (m/s), i.e. `d(deflection)/dt`. Carried across steps. */
  deflectionRate: number;
  /**
   * Previous step's tire deflection (m). Pass 0 on the first contact step.
   * Used to compute the deflection rate when the caller does not pre-derive it.
   * If `deflectionRate` is provided and non-zero, this field is not used for
   * rate computation.
   */
  prevDeflection?: number;
  /** Current inflation pressure (kPa). Used to scale stiffness. */
  pressureKpa?: number;
  dt: number;
}

export interface TireVerticalResult {
  /**
   * Contact-patch vertical load (N). This is the force the tire exerts on
   * the road (and the equal-and-opposite reaction force on the chassis).
   * Callers should add this to the suspension spring force for the full Fz.
   */
  fzContact: number;
  /** Current tire deflection (m). Store in wheel state for the next step. */
  deflection: number;
  /** Deflection rate (m/s). Store in wheel state for the next step. */
  deflectionRate: number;
}

/**
 * Compute the tire vertical contact force for one step.
 *
 * The carcass deflects by `max(0, radius - contactDistance)` when the tire is
 * compressed into the road. The spring-damper produces the contact force.
 * Stiffness is scaled linearly with pressure so an over-inflated tire feels
 * stiffer (less deflection) and an under-inflated tire more compliant.
 */
export function stepTireVertical(input: TireVerticalInput): TireVerticalResult {
  const k0 = input.kTireNpm ?? TIRE_RADIAL_STIFFNESS_NPM;
  const c = input.cTireNspm ?? TIRE_RADIAL_DAMPING_NSPM;
  const pressure = input.pressureKpa ?? PRESSURE_REFERENCE_KPA;

  // Pressure-scaled stiffness: k grows linearly with inflation pressure.
  const kTire = k0 * (pressure / PRESSURE_REFERENCE_KPA);

  const rawDeflection = input.radius - input.contactDistance;
  const deflection = Math.max(0, rawDeflection);

  // Deflection rate: prefer the pre-computed value; fall back to finite
  // difference against the previous step's deflection.
  let deflRate = input.deflectionRate;
  if (deflRate === 0 && input.prevDeflection !== undefined && input.dt > 0) {
    deflRate = (deflection - input.prevDeflection) / input.dt;
  }

  // Clamp the damping contribution so it cannot pull the contact force below
  // zero (unrealistic tensile force from a fast rebound).
  const fzSpring = kTire * deflection;
  const fzDamp = c * deflRate;
  const fzContact = Math.max(0, fzSpring + fzDamp);

  return { fzContact, deflection, deflectionRate: deflRate };
}

/**
 * Effective tire spring rate in a series combination with the suspension.
 *
 * `k_eff = (k_susp * k_tire) / (k_susp + k_tire)`
 *
 * Useful for callers that want to pre-estimate the series stiffness for
 * natural-frequency sanity checks or compliance-sensitive load-transfer math.
 */
export function effectiveSeriesStiffness(kSuspNpm: number, kTireNpm: number): number {
  const denom = kSuspNpm + kTireNpm;
  return denom > 0 ? (kSuspNpm * kTireNpm) / denom : 0;
}

/**
 * Effective wheel rate at the contact patch when bushing compliance is
 * present, modelling tire carcass, bushing, and suspension spring in series.
 *
 * `1/k_eff = 1/k_carcass + 1/k_bushing + 1/k_spring`
 *
 * When `kBushing` is 0 (default / rigid), `k_eff` equals the two-spring
 * carcass+spring result (no regression).  When all three are present the
 * total compliance is the sum of the individual compliances (reciprocals).
 */
export function effectiveWheelRate(
  kSpringNpm: number,
  kCarcassNpm: number,
  kBushingNpm: number,
): number {
  // Zero bushing stiffness means rigid (infinite stiffness) — no compliance.
  // Zero spring or carcass means the chain is broken (zero effective stiffness).
  if (kSpringNpm <= 0 || kCarcassNpm <= 0) return 0;
  const complianceSpring = 1 / kSpringNpm;
  const complianceCarcass = 1 / kCarcassNpm;
  const complianceBushing = kBushingNpm > 0 ? 1 / kBushingNpm : 0;
  const totalCompliance = complianceSpring + complianceCarcass + complianceBushing;
  return totalCompliance > 0 ? 1 / totalCompliance : 0;
}
