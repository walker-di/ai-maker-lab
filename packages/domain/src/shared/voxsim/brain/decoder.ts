/**
 * OutputDecoder: maps brain raw outputs to actuator ids and ranges.
 */

export type OutputActivation = 'tanh' | 'sigmoid' | 'linear';

export interface OutputBinding {
  /** Matches an `ActuatorEntry.id` from the agent's `ActuatorMap`. */
  actuatorId: string;
  range: { min: number; max: number };
  activation: OutputActivation;
}

export interface OutputDecoder {
  outputs: OutputBinding[];
}

export function decoderTotalWidth(decoder: OutputDecoder): number {
  return decoder.outputs.length;
}
