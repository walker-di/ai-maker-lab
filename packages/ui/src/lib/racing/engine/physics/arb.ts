/**
 * Anti-roll bar load transfer. Real ARBs transfer vertical force between the
 * left and right wheels on an axle: the more-compressed wheel sees its load
 * reduced and the less-compressed one sees an equal increase. The effective
 * stiffness is multiplied by the squared motion ratio just like the spring.
 *
 * IMPORTANT: an ARB with one end in the air can't push on the other side, so
 * we gate the transfer on BOTH wheels of the axle being in contact. If either
 * is airborne the contribution is zero — preventing load from being attributed
 * to a wheel that isn't touching the ground.
 *
 * Returns the per-wheel `dFz` to add to the spring force. The pair always sums
 * to zero so total chassis load is unchanged.
 */

export interface AxleArbInput {
  arbStiffness: number;
  motionRatio: number;
  leftCompression: number;
  rightCompression: number;
  leftInContact: boolean;
  rightInContact: boolean;
}

export interface AxleArbResult {
  /** dFz to add to the left wheel's vertical force (newtons). */
  leftDfz: number;
  /** dFz to add to the right wheel's vertical force (newtons). */
  rightDfz: number;
}

export function computeAxleArb(input: AxleArbInput): AxleArbResult {
  if (!input.leftInContact || !input.rightInContact) {
    return { leftDfz: 0, rightDfz: 0 };
  }
  const mr2 = input.motionRatio * input.motionRatio;
  const dF = (input.arbStiffness * mr2 * (input.leftCompression - input.rightCompression)) / 2;
  return { leftDfz: -dF, rightDfz: +dF };
}
