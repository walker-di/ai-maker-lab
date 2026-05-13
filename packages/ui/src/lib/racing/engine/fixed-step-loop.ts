/**
 * Re-exported fixed-step accumulator. Identical to the platformer one — kept
 * separate so the racing engine doesn't accidentally couple to platformer
 * internals.
 */
export {
  FixedStepLoop,
  type FixedStepLoopOptions,
} from '../../platformer/engine/fixed-step-loop.js';
