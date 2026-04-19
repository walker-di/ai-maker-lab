/**
 * Builds the initial NEAT/HyperNEAT/NEAT-LSTM minimal genome population.
 */

import type {
  BrainDna,
  NeatConnectionGene,
  NeatGenome,
  NeatNodeGene,
  NeatTrainingConfig,
  TrainingAlgorithm,
} from '../../../../shared/voxsim/index.js';
import { encoderTotalWidth } from '../../../../shared/voxsim/index.js';
import { createMulberry32, type SeededPrng } from '../prng.js';
import type { InnovationLedger } from './InnovationLedger.js';

interface BuildOptions {
  algorithm: TrainingAlgorithm;
  brain: BrainDna;
  config: NeatTrainingConfig;
  ledger: InnovationLedger;
  seed: number;
  populationSize: number;
}

function buildMinimalNeatGenome(
  brain: BrainDna,
  ledger: InnovationLedger,
  prng: SeededPrng,
  weightRange: number,
  index: number,
): NeatGenome {
  const inputBindings = brain.inputEncoder.inputs;
  const outputs = brain.outputDecoder.outputs;
  const inputWidth = encoderTotalWidth(brain.inputEncoder);

  const nodes: NeatNodeGene[] = [];
  let nextId = 1;

  // One input node per encoder slot, plus a bias node.
  for (let i = 0; i < inputWidth; i++) {
    const binding = inputBindings.find(
      (b) => i >= 0,
    ); // every binding contributes; for slot identification use index
    void binding;
    nodes.push({
      id: nextId++,
      kind: 'input',
      activation: 'linear',
      bias: 0,
      inputBindingId: `${brain.inputEncoder.inputs[0]?.sensorId ?? 'input'}-${i}`,
    });
  }
  const biasId = nextId++;
  nodes.push({ id: biasId, kind: 'bias', activation: 'linear', bias: 1 });

  const outputIds: number[] = [];
  for (const out of outputs) {
    const id = nextId++;
    nodes.push({
      id,
      kind: 'output',
      activation: 'tanh',
      bias: 0,
      outputBindingId: out.actuatorId,
    });
    outputIds.push(id);
  }

  ledger.reserveNodeId(nextId - 1);

  const connections: NeatConnectionGene[] = [];
  for (let i = 1; i <= inputWidth; i++) {
    for (const outId of outputIds) {
      const innovation = ledger.getOrAssignConnectionInnovation(i, outId, 0);
      connections.push({
        innovation,
        sourceNodeId: i,
        targetNodeId: outId,
        weight: prng.nextRange(-weightRange, weightRange),
        enabled: true,
      });
    }
  }
  for (const outId of outputIds) {
    const innovation = ledger.getOrAssignConnectionInnovation(biasId, outId, 0);
    connections.push({
      innovation,
      sourceNodeId: biasId,
      targetNodeId: outId,
      weight: prng.nextRange(-weightRange, weightRange),
      enabled: true,
    });
  }

  return {
    id: `${brain.id}-init-${index}`,
    nodes,
    connections,
    nextLocalNodeId: nextId,
  };
}

function buildMinimalCppnGenome(
  brain: BrainDna,
  ledger: InnovationLedger,
  prng: SeededPrng,
  weightRange: number,
  index: number,
): NeatGenome {
  // CPPN inputs: (sourceX, sourceY, sourceZ, targetX, targetY, targetZ) + bias
  const inputCount = 6;
  const outputCount = brain.neat?.cppnSubstrate?.bias && 'fromCppnOutputIndex' in brain.neat.cppnSubstrate.bias ? 2 : 1;
  const nodes: NeatNodeGene[] = [];
  let nextId = 1;
  const cppnInputIds: number[] = [];
  for (let i = 0; i < inputCount; i++) {
    const id = nextId++;
    nodes.push({
      id,
      kind: 'input',
      activation: 'linear',
      bias: 0,
      inputBindingId: ['srcX', 'srcY', 'srcZ', 'tgtX', 'tgtY', 'tgtZ'][i] ?? `cppn-${i}`,
    });
    cppnInputIds.push(id);
  }
  const biasId = nextId++;
  nodes.push({ id: biasId, kind: 'bias', activation: 'linear', bias: 1 });

  const outputIds: number[] = [];
  for (let i = 0; i < outputCount; i++) {
    const id = nextId++;
    nodes.push({
      id,
      kind: 'output',
      activation: 'tanh',
      bias: 0,
      outputBindingId: i === 0 ? 'cppn-weight' : 'cppn-bias',
    });
    outputIds.push(id);
  }

  ledger.reserveNodeId(nextId - 1);

  const connections: NeatConnectionGene[] = [];
  for (const inId of cppnInputIds) {
    for (const outId of outputIds) {
      const innovation = ledger.getOrAssignConnectionInnovation(inId, outId, 0);
      connections.push({
        innovation,
        sourceNodeId: inId,
        targetNodeId: outId,
        weight: prng.nextRange(-weightRange, weightRange),
        enabled: true,
      });
    }
  }
  for (const outId of outputIds) {
    const innovation = ledger.getOrAssignConnectionInnovation(biasId, outId, 0);
    connections.push({
      innovation,
      sourceNodeId: biasId,
      targetNodeId: outId,
      weight: prng.nextRange(-weightRange, weightRange),
      enabled: true,
    });
  }

  return {
    id: `${brain.id}-cppn-${index}`,
    nodes,
    connections,
    nextLocalNodeId: nextId,
  };
}

export function buildInitialPopulation(options: BuildOptions): NeatGenome[] {
  const { algorithm, brain, config, ledger, seed, populationSize } = options;
  const range = config.mutation.initialWeightRange;
  const out: NeatGenome[] = [];
  for (let i = 0; i < populationSize; i++) {
    const prng = createMulberry32(((seed | 0) ^ Math.imul(i + 1, 0x9e3779b1)) | 0);
    if (algorithm === 'hyperNeat') {
      out.push(buildMinimalCppnGenome(brain, ledger, prng, range, i));
    } else {
      out.push(buildMinimalNeatGenome(brain, ledger, prng, range, i));
    }
  }
  return out;
}
