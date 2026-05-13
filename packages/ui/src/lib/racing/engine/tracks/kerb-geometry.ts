/**
 * Simple 3D kerb contact geometry (M4).
 *
 * A kerb strip is modelled as a raised, slightly sloped ramp that runs
 * parallel to the track edge.  When a wheel centre is detected inside a
 * kerb zone (by `SurfaceLookup`) this module computes:
 *
 *   1. The effective ground height at the contact point (`groundY`),
 *      giving the engine a non-zero raycast hit height.
 *   2. A bump impulse magnitude proportional to the lateral penetration
 *      depth inside the kerb, which can be added to wheel Fz this step.
 *
 * All geometry is authoring-data-driven and pure-math — no Three.js / Jolt.
 *
 * Physical model
 * --------------
 * Each kerb is treated as a rectangular ramp whose cross-section is:
 *
 *         kerb edge (track side)          outer edge
 *   y=0 __|____________.                 .___
 *                       \               /
 *   raised crown at       \ slope angle /
 *   y = crownHeight        \           /
 *                           . — width — .
 *
 * The "sausage" variant (common in modern circuits) has a flat top at
 * `crownHeight` over the central fraction of the kerb; the ramps occupy
 * the remaining fraction on each side.
 */

export interface KerbProfile {
  /**
   * Total kerb strip width (m).  Should match the `curbWidth` in
   * `SurfaceLookupConfig` for consistent zone detection.
   */
  widthM: number;
  /** Peak height at the crown of the kerb (m). */
  crownHeightM: number;
  /**
   * Fraction of the strip width that is the flat top plateau (0–1).
   * 0 = pure triangle ramp (each side slopes to the crown).
   * 0.5 = sausage kerb with a plateau over the central 50%.
   */
  topFlatFraction: number;
  /**
   * Perturbation-force multiplier when a wheel crests the crown (N).
   * Applied by the engine as an additive Fz impulse.
   * 0 disables bump impulses entirely (smooth kerb).
   */
  bumpForceN: number;
}

export const DEFAULT_KERB_PROFILE: KerbProfile = {
  widthM: 0.5,
  crownHeightM: 0.04,
  topFlatFraction: 0.0,
  bumpForceN: 800,
};

/**
 * Contact result returned by `kerbContactAt`.
 */
export interface KerbContact {
  /** Effective ground height at the wheel contact point (m). */
  groundY: number;
  /**
   * Lateral penetration depth into the kerb (0 at the inboard edge,
   * 1 at the outboard edge / outer boundary).
   */
  lateralPenetration: number;
  /** Recommended additive vertical impulse to wheel Fz (N). */
  bumpImpulseN: number;
}

/**
 * Compute the kerb surface height and bump impulse for a wheel positioned
 * at `distFromInboard` metres from the inboard (track-side) kerb edge.
 *
 * Returns `null` if the wheel is not inside the kerb strip.
 *
 * @param profile           Kerb shape descriptor.
 * @param distFromInboard   Lateral distance from the track edge (m).
 */
export function kerbContactAt(
  profile: KerbProfile,
  distFromInboard: number,
): KerbContact | null {
  const { widthM, crownHeightM, topFlatFraction, bumpForceN } = profile;
  if (distFromInboard < 0 || distFromInboard > widthM) return null;

  const penetration = distFromInboard / widthM;
  const flatStart = 0.5 - topFlatFraction * 0.5;
  const flatEnd = 0.5 + topFlatFraction * 0.5;

  let heightFraction: number;
  if (penetration <= flatStart) {
    heightFraction = flatStart > 0 ? penetration / flatStart : 1;
  } else if (penetration >= flatEnd) {
    const descent = flatEnd < 1 ? (penetration - flatEnd) / (1 - flatEnd) : 0;
    heightFraction = 1 - descent;
  } else {
    heightFraction = 1;
  }

  const groundY = heightFraction * crownHeightM;
  const bumpImpulseN = heightFraction * bumpForceN;

  return { groundY, lateralPenetration: penetration, bumpImpulseN };
}

/**
 * Evaluate kerb contact from a signed lateral offset from the track centerline.
 *
 * This convenience wrapper is called by the engine after `SurfaceLookup`
 * reports `surface == 'CURB'`.  The caller passes the absolute lateral
 * offset already computed by `closestPointOnCenterline`.
 *
 * @param distFromCenterline  Signed lateral distance (m); magnitude must
 *                            exceed `halfWidth` to reach the kerb.
 * @param halfWidth           Half the asphalt track width (m).
 * @param profile             Kerb profile to evaluate.
 */
export function kerbContactFromLateralOffset(
  distFromCenterline: number,
  halfWidth: number,
  profile: KerbProfile,
): KerbContact | null {
  const absDist = Math.abs(distFromCenterline);
  const distFromInboard = absDist - halfWidth;
  return kerbContactAt(profile, distFromInboard);
}
