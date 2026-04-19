/**
 * Validation rules for `BrainDna`. Returns a structured result so callers can
 * decide whether to surface warnings to users or hard-fail.
 */

import type { BrainDna } from './brain-dna.js';
import { isNeatTopology } from './brain-dna.js';
import { encoderTotalWidth } from './encoder.js';
import { decoderTotalWidth } from './decoder.js';
import type { NeatGenome } from './neat/neat-genome.js';
import { validateNeatGenome } from './neat/validation.js';
import type { NeatGenomeValidationIssue } from './neat/validation.js';

export interface BrainDnaValidationIssue {
  code: string;
  message: string;
  path?: string;
}

export interface BrainDnaValidationResult {
  ok: boolean;
  issues: BrainDnaValidationIssue[];
}

function isFinite01Std(n: number | number[]): boolean {
  if (Array.isArray(n)) return n.every((v) => Number.isFinite(v) && v > 0);
  return Number.isFinite(n) && n > 0;
}

function isFiniteScalarOrVector(n: number | number[]): boolean {
  if (Array.isArray(n)) return n.every((v) => Number.isFinite(v));
  return Number.isFinite(n);
}

export function validateBrainDna(
  dna: BrainDna,
  neatGenome?: NeatGenome,
): BrainDnaValidationResult {
  const issues: BrainDnaValidationIssue[] = [];
  const inputWidth = encoderTotalWidth(dna.inputEncoder);
  const outputWidth = decoderTotalWidth(dna.outputDecoder);

  if (!Number.isFinite(dna.seed)) {
    issues.push({ code: 'seed_not_finite', message: 'seed must be a finite number', path: 'seed' });
  }

  // Encoder rules
  const seenSensorIds = new Set<string>();
  for (let i = 0; i < dna.inputEncoder.inputs.length; i++) {
    const b = dna.inputEncoder.inputs[i];
    const path = `inputEncoder.inputs[${i}]`;
    if (!b.sensorId) {
      issues.push({ code: 'encoder_missing_sensor_id', message: 'sensorId is required', path });
    } else if (seenSensorIds.has(b.sensorId)) {
      issues.push({
        code: 'encoder_duplicate_sensor_id',
        message: `sensorId ${b.sensorId} appears more than once`,
        path,
      });
    } else {
      seenSensorIds.add(b.sensorId);
    }
    if (!Number.isFinite(b.width) || b.width <= 0) {
      issues.push({
        code: 'encoder_width_invalid',
        message: 'width must be a positive finite integer',
        path,
      });
    }
    if (!isFiniteScalarOrVector(b.normalization.mean)) {
      issues.push({
        code: 'encoder_norm_mean_invalid',
        message: 'normalization.mean must be finite',
        path,
      });
    }
    if (!isFinite01Std(b.normalization.std)) {
      issues.push({
        code: 'encoder_norm_std_invalid',
        message: 'normalization.std must be finite and > 0',
        path,
      });
    }
    if (Array.isArray(b.normalization.mean) && b.normalization.mean.length !== b.width) {
      issues.push({
        code: 'encoder_norm_mean_width_mismatch',
        message: 'normalization.mean vector length must equal width',
        path,
      });
    }
    if (Array.isArray(b.normalization.std) && b.normalization.std.length !== b.width) {
      issues.push({
        code: 'encoder_norm_std_width_mismatch',
        message: 'normalization.std vector length must equal width',
        path,
      });
    }
    if (b.clip) {
      if (!Number.isFinite(b.clip.min) || !Number.isFinite(b.clip.max) || b.clip.min >= b.clip.max) {
        issues.push({
          code: 'encoder_clip_invalid',
          message: 'clip.min must be finite and strictly less than clip.max',
          path,
        });
      }
    }
  }

  // Decoder rules
  const seenActuatorIds = new Set<string>();
  for (let i = 0; i < dna.outputDecoder.outputs.length; i++) {
    const b = dna.outputDecoder.outputs[i];
    const path = `outputDecoder.outputs[${i}]`;
    if (!b.actuatorId) {
      issues.push({
        code: 'decoder_missing_actuator_id',
        message: 'actuatorId is required',
        path,
      });
    } else if (seenActuatorIds.has(b.actuatorId)) {
      issues.push({
        code: 'decoder_duplicate_actuator_id',
        message: `actuatorId ${b.actuatorId} appears more than once`,
        path,
      });
    } else {
      seenActuatorIds.add(b.actuatorId);
    }
    if (!Number.isFinite(b.range.min) || !Number.isFinite(b.range.max) || b.range.min >= b.range.max) {
      issues.push({
        code: 'decoder_range_invalid',
        message: 'range.min must be finite and strictly less than range.max',
        path,
      });
    }
  }

  // Topology-specific rules
  if (!isNeatTopology(dna.topology)) {
    if (dna.neat) {
      issues.push({
        code: 'neat_config_forbidden',
        message: 'neat config is only allowed for NEAT-variant topologies',
        path: 'neat',
      });
    }
    if (dna.layers.length === 0) {
      issues.push({
        code: 'mlp_layers_empty',
        message: 'fixed-topology brains must declare at least one layer',
        path: 'layers',
      });
    } else {
      // First dense layer should accept inputWidth (we just check there's a dense layer eventually)
      const denseLayers = dna.layers.filter((l) => l.kind === 'dense');
      if (denseLayers.length === 0) {
        issues.push({
          code: 'mlp_no_dense_layer',
          message: 'fixed-topology brains must include at least one dense layer',
          path: 'layers',
        });
      } else {
        const last = denseLayers[denseLayers.length - 1];
        if (last.kind === 'dense') {
          if (last.units !== outputWidth) {
            issues.push({
              code: 'mlp_final_units_mismatch',
              message: `final dense layer units (${last.units}) must equal outputDecoder.totalWidth() (${outputWidth})`,
              path: 'layers',
            });
          }
          if (last.activation !== 'linear') {
            issues.push({
              code: 'mlp_final_activation_not_linear',
              message: 'final dense layer activation must be linear; per-output activation runs in the decoder',
              path: 'layers',
            });
          }
        }
      }
      // Recurrent gating
      for (let i = 0; i < dna.layers.length; i++) {
        const layer = dna.layers[i];
        if (layer.kind === 'gru' && dna.topology !== 'recurrentMlp') {
          issues.push({
            code: 'recurrent_layer_in_non_recurrent_topology',
            message: 'gru layers require topology = "recurrentMlp"',
            path: `layers[${i}]`,
          });
        }
        if (layer.kind === 'dropout' && (!Number.isFinite(layer.rate) || layer.rate < 0 || layer.rate >= 1)) {
          issues.push({
            code: 'dropout_rate_invalid',
            message: 'dropout rate must be in [0, 1)',
            path: `layers[${i}]`,
          });
        }
      }
    }
    if (inputWidth <= 0) {
      issues.push({
        code: 'encoder_total_width_zero',
        message: 'encoder must produce at least one input channel',
        path: 'inputEncoder',
      });
    }
    if (outputWidth <= 0) {
      issues.push({
        code: 'decoder_total_width_zero',
        message: 'decoder must produce at least one output channel',
        path: 'outputDecoder',
      });
    }
  } else {
    if (dna.layers.length !== 0) {
      issues.push({
        code: 'neat_layers_must_be_empty',
        message: 'NEAT-variant brains must have an empty layers array',
        path: 'layers',
      });
    }
    if (!dna.neat) {
      issues.push({
        code: 'neat_config_required',
        message: 'NEAT-variant topology requires neat config',
        path: 'neat',
      });
    } else {
      if (!Number.isFinite(dna.neat.seed)) {
        issues.push({
          code: 'neat_seed_not_finite',
          message: 'neat.seed must be finite',
          path: 'neat.seed',
        });
      }
      if (!Number.isFinite(dna.neat.initialNodeBias)) {
        issues.push({
          code: 'neat_initial_node_bias_not_finite',
          message: 'neat.initialNodeBias must be finite',
          path: 'neat.initialNodeBias',
        });
      }
      if (dna.topology === 'hyperNeat') {
        if (!dna.neat.cppnSubstrate) {
          issues.push({
            code: 'hyperneat_substrate_required',
            message: 'topology hyperNeat requires neat.cppnSubstrate',
            path: 'neat.cppnSubstrate',
          });
        }
      } else if (dna.neat.cppnSubstrate) {
        issues.push({
          code: 'cppn_substrate_forbidden',
          message: 'cppnSubstrate is only allowed for hyperNeat topology',
          path: 'neat.cppnSubstrate',
        });
      }
    }
    if (neatGenome) {
      const genomeResult = validateNeatGenome(neatGenome, dna);
      for (const issue of genomeResult.issues) {
        issues.push({
          code: `neat_genome_${issue.code}`,
          message: issue.message,
          path: issue.path ? `neatGenome.${issue.path}` : 'neatGenome',
        });
      }
    }
  }

  return { ok: issues.length === 0, issues };
}

export type { NeatGenomeValidationIssue };
