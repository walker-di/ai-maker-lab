/**
 * Camber thrust contribution. A tilted tire generates extra lateral force.
 * Effective camber = static + a roll-induced term + caster-induced camber.
 *
 * Sign convention: camber is stored wheel-relative (-2.5° = "top tilts
 * inboard" on BOTH sides). The lateral axis (`wheelLat`) is the same
 * chassis-frame axis on both sides, so we multiply the camber thrust by
 * `lateralSign` to mirror it correctly. With this factor a symmetric
 * negative-camber setup at zero roll cancels to zero net side force, while
 * each wheel still pulls toward the chassis centre through a corner.
 *
 * Returns the lateral-force contribution (newtons) along `wheelLat`.
 */

export interface CamberInput {
  staticCamberRad: number;
  rollRad: number;
  /** Outside-wheel camber gain coefficient (0 = no roll camber). */
  camberGain: number;
  /** Caster-induced camber from `caster-camber.ts` (already negative on
   *  the outside wheel under steering). */
  casterCamberRad: number;
  /** +1 for the +X (right) side of the chassis, -1 for the -X (left) side. */
  lateralSign: 1 | -1;
  /** Vertical load on the contact patch (newtons). */
  fz: number;
  /** Camber-thrust gain coefficient (Nm per rad per N). Default 1.5. */
  gain?: number;
}

export interface CamberResult {
  camberRad: number;
  thrust: number;
}

export function computeCamberThrust(input: CamberInput): CamberResult {
  const gain = input.gain ?? 1.5;
  const camberRad =
    input.staticCamberRad -
    input.lateralSign * input.rollRad * input.camberGain +
    input.casterCamberRad;
  const thrust = input.lateralSign * gain * camberRad * input.fz;
  return { camberRad, thrust };
}
