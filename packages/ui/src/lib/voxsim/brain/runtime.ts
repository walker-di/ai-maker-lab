/**
 * Pure encoder/decoder runtime helpers used by every `PolicyNetwork`
 * implementation and by `BrainSystem`.
 *
 * Both helpers write into caller-owned buffers and never allocate.
 */

import type { InputEncoder, Normalization, OutputBinding, OutputDecoder } from './types.js';

function meanAt(norm: Normalization, ch: number): number {
  if (Array.isArray(norm.mean)) return norm.mean[ch];
  return norm.mean;
}

function stdAt(norm: Normalization, ch: number): number {
  if (Array.isArray(norm.std)) return norm.std[ch];
  return norm.std;
}

/**
 * Apply per-binding normalization and clipping to the agent's observation
 * vector and write the result into `scratchInput`.
 */
export function runEncoder(
  observation: Float32Array,
  encoder: InputEncoder,
  scratchInput: Float32Array,
): void {
  let cursor = 0;
  for (const binding of encoder.inputs) {
    for (let ch = 0; ch < binding.width; ch++) {
      const raw = observation[cursor];
      const m = meanAt(binding.normalization, ch);
      const s = stdAt(binding.normalization, ch);
      let v = (raw - m) / (s === 0 ? 1 : s);
      if (binding.clip) {
        if (v < binding.clip.min) v = binding.clip.min;
        else if (v > binding.clip.max) v = binding.clip.max;
      }
      scratchInput[cursor] = v;
      cursor++;
    }
  }
}

function applyOutputActivation(value: number, kind: OutputBinding['activation']): number {
  switch (kind) {
    case 'tanh':
      return Math.tanh(value);
    case 'sigmoid':
      return 1 / (1 + Math.exp(-value));
    case 'linear':
    default:
      return value;
  }
}

/**
 * Map raw policy outputs to actuator-range scaled actions.
 *
 * `tanh` outputs are in `[-1, 1]`, `sigmoid` outputs are in `[0, 1]`, and
 * `linear` outputs are passed through unchanged before linear scaling into
 * the binding's range.
 */
export function runDecoder(
  rawOutput: Float32Array,
  decoder: OutputDecoder,
  scratchAction: Float32Array,
): void {
  for (let i = 0; i < decoder.outputs.length; i++) {
    const binding = decoder.outputs[i];
    const activated = applyOutputActivation(rawOutput[i], binding.activation);
    let scaled: number;
    if (binding.activation === 'tanh') {
      // [-1, 1] -> [min, max]
      const half = (binding.range.max - binding.range.min) * 0.5;
      const center = (binding.range.max + binding.range.min) * 0.5;
      scaled = center + activated * half;
    } else if (binding.activation === 'sigmoid') {
      // [0, 1] -> [min, max]
      scaled = binding.range.min + activated * (binding.range.max - binding.range.min);
    } else {
      scaled = activated;
    }
    scratchAction[i] = scaled;
  }
}
