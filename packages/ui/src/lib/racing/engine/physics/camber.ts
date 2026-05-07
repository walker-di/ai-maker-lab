/**
 * Camber thrust contribution — geometry helper for resolving effective camber.
 *
 * M1 note: camber thrust is now integrated into the Pacejka MF evaluator via
 * the `pCy2` coefficient and the `camberRad` field on `Pacejka56Input`. The
 * MF path applies combined-slip weighting to the full lateral output, which
 * is physically more accurate than a downstream add-on.
 *
 * `computeCamberThrust` is kept for:
 *   - resolving the effective camber angle (its primary geometric purpose);
 *   - use as a fallback when the MF path is not available (e.g. legacy tests);
 *   - any caller that genuinely needs the thrust as a separate term.
 *
 * New `RacingEngine` code passes `camberRad` into `evaluatePacejka56Combined`
 * and uses `computeCamberThrust().camberRad` only for the geometry; the
 * `thrust` field is no longer added on top of the MF lateral output.
 *
 * Sign convention: camber is stored wheel-relative (-2.5° = "top tilts
 * inboard" on BOTH sides). The lateral axis (`wheelLat`) is the same
 * chassis-frame axis on both sides, so we multiply the camber thrust by
 * `lateralSign` to mirror it correctly. With this factor a symmetric
 * negative-camber setup at zero roll cancels to zero net side force, while
 * each wheel still pulls toward the chassis centre through a corner.
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
