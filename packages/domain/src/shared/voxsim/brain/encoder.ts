/**
 * InputEncoder: maps sensor ids to slots in the brain's input vector.
 *
 * Browser-safe data only. The runtime helpers in `packages/ui` apply the
 * normalization and clipping per binding.
 */

export type Normalization =
  | { mean: number; std: number }
  | { mean: number[]; std: number[] };

export interface InputBinding {
  /** Matches a `SensorSpec.id` from `BodyDna`. */
  sensorId: string;
  /** Number of floats this binding consumes (must equal the sensor's outputWidth). */
  width: number;
  normalization: Normalization;
  clip?: { min: number; max: number };
}

export interface InputEncoder {
  inputs: InputBinding[];
}

export function encoderTotalWidth(encoder: InputEncoder): number {
  let n = 0;
  for (const b of encoder.inputs) n += b.width;
  return n;
}
