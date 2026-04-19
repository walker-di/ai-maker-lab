/**
 * HyperNEAT browser implementation.
 *
 * The CPPN is a `NeatGenome` over synthetic substrate-coordinate inputs and
 * a synthetic weight-output. On every `setGenome` we rebuild the phenotype
 * by querying the CPPN over every (sourceCoord, targetCoord) pair across
 * substrate layers; phenotype edges with `|weight| < weightThreshold` are
 * pruned.
 */

import type {
  BrainDna,
  CppnSubstrate,
  NeatGenome,
} from '../types.js';
import type { Vec3 } from '../../types.js';
import {
  FIXED_ONLY_METHODS_ERROR,
  type ActivationFrame,
  type PolicyNetwork,
  type PolicyTapHandle,
} from '../policy.js';
import { runDecoder, runEncoder } from '../runtime.js';
import { applyNeatActivation } from './activations.js';
import { indexGenome, topologicalOrder, type NodeIndex } from './topo.js';

interface PhenotypeEdge {
  sourceIndex: number;
  targetIndex: number;
  weight: number;
}

/** CPPN_SUBSTRATE_INPUT_BINDING_IDS — synthetic input ids for the CPPN. */
const CPPN_INPUT_IDS = ['__src_x', '__src_y', '__src_z', '__tgt_x', '__tgt_y', '__tgt_z', '__bias'] as const;
const CPPN_OUTPUT_WEIGHT_ID = '__cppn_weight';
const CPPN_OUTPUT_BIAS_ID = '__cppn_bias';

interface CppnRuntime {
  index: NodeIndex;
  order: number[];
  inputSlot: Map<string, number>;
  outputSlot: Map<string, number>;
  activations: Float32Array;
}

export class HyperNeatPolicyNetwork implements PolicyNetwork {
  private dna: BrainDna | null = null;
  private substrate: CppnSubstrate | null = null;
  private cppn: CppnRuntime | null = null;
  private cppnGenome: NeatGenome | null = null;

  /** Per phenotype-node index -> bias. */
  private phenotypeBiases: Float32Array | null = null;
  private phenotypeActivations: Float32Array | null = null;
  private phenotypeEdges: PhenotypeEdge[] = [];
  /** Phenotype node order: inputs (encoder order), then hidden layers, then outputs. */
  private phenotypeNodeCount = 0;
  private inputStart = 0;
  private outputStart = 0;
  private encodedScratch: Float32Array | null = null;
  private rawOutputScratch: Float32Array | null = null;
  private taps: Set<(frame: ActivationFrame) => void> = new Set();

  async init(dna: BrainDna): Promise<void> {
    if (dna.topology !== 'hyperNeat') {
      throw new Error(`HyperNeatPolicyNetwork requires topology=hyperNeat; got ${dna.topology}`);
    }
    if (!dna.neat?.cppnSubstrate) {
      throw new Error('HyperNeatPolicyNetwork requires brainDna.neat.cppnSubstrate');
    }
    this.dna = dna;
    this.substrate = dna.neat.cppnSubstrate;
    this.encodedScratch = new Float32Array(dna.inputEncoder.inputs.reduce((s, b) => s + b.width, 0));
    this.rawOutputScratch = new Float32Array(dna.outputDecoder.outputs.length);
    this.allocatePhenotype();
  }

  private allocatePhenotype(): void {
    if (!this.substrate) return;
    let count = this.substrate.inputCoords.length;
    this.inputStart = 0;
    for (const layer of this.substrate.hiddenLayers) {
      count += layer.coords.length;
    }
    this.outputStart = count;
    count += this.substrate.outputCoords.length;
    this.phenotypeNodeCount = count;
    this.phenotypeBiases = new Float32Array(count);
    this.phenotypeActivations = new Float32Array(count);
  }

  setGenome(genome: NeatGenome): void {
    if (!this.dna || !this.substrate) {
      throw new Error('HyperNeatPolicyNetwork.setGenome called before init');
    }
    this.cppnGenome = genome;
    const index = indexGenome(genome);
    const order = topologicalOrder(index);
    const inputSlot = new Map<string, number>();
    for (const node of index.inputs) {
      if (node.inputBindingId) inputSlot.set(node.inputBindingId, index.slot.get(node.id) as number);
    }
    const outputSlot = new Map<string, number>();
    for (const node of index.outputs) {
      if (node.outputBindingId) outputSlot.set(node.outputBindingId, index.slot.get(node.id) as number);
    }
    if (!outputSlot.has(CPPN_OUTPUT_WEIGHT_ID)) {
      throw new Error(`HyperNEAT CPPN must have an output node bound to ${CPPN_OUTPUT_WEIGHT_ID}`);
    }
    this.cppn = {
      index,
      order,
      inputSlot,
      outputSlot,
      activations: new Float32Array(genome.nodes.length),
    };
    this.rebuildPhenotype();
  }

  private rebuildPhenotype(): void {
    if (!this.substrate || !this.phenotypeBiases) return;
    this.phenotypeBiases.fill(0);
    this.phenotypeEdges = [];
    // Build per-layer index lists.
    const layers: { coords: Vec3[]; start: number }[] = [];
    layers.push({ coords: this.substrate.inputCoords, start: 0 });
    let cursor = this.substrate.inputCoords.length;
    for (const layer of this.substrate.hiddenLayers) {
      layers.push({ coords: layer.coords, start: cursor });
      cursor += layer.coords.length;
    }
    layers.push({ coords: this.substrate.outputCoords, start: this.outputStart });
    // For each adjacent layer pair, query the CPPN over every coord pair.
    for (let li = 0; li < layers.length - 1; li++) {
      const src = layers[li];
      const tgt = layers[li + 1];
      for (let s = 0; s < src.coords.length; s++) {
        for (let t = 0; t < tgt.coords.length; t++) {
          const out = this.queryCppn(src.coords[s], tgt.coords[t]);
          if (Math.abs(out.weight) >= this.substrate.weightThreshold) {
            this.phenotypeEdges.push({
              sourceIndex: src.start + s,
              targetIndex: tgt.start + t,
              weight: out.weight,
            });
          }
          // Per-node bias: assign for each target node by averaging across source queries.
          // Spec leaves derivation flexible; we use the latest queried value.
          if (this.substrate.bias && 'fromCppnOutputIndex' in this.substrate.bias) {
            // Already encoded inside `out.bias` if provided; else 0.
            this.phenotypeBiases[tgt.start + t] = out.bias ?? 0;
          } else if (this.substrate.bias && 'constant' in this.substrate.bias) {
            this.phenotypeBiases[tgt.start + t] = this.substrate.bias.constant;
          }
        }
      }
    }
  }

  private queryCppn(src: Vec3, tgt: Vec3): { weight: number; bias?: number } {
    if (!this.cppn) return { weight: 0 };
    const { index, order, inputSlot, outputSlot, activations } = this.cppn;
    activations.fill(0);
    // Bias slots
    for (const bias of index.bias) {
      const slot = index.slot.get(bias.id) as number;
      activations[slot] = 1;
    }
    const writeInput = (id: string, value: number) => {
      const slot = inputSlot.get(id);
      if (slot !== undefined) activations[slot] = value;
    };
    writeInput('__src_x', src.x);
    writeInput('__src_y', src.y);
    writeInput('__src_z', src.z);
    writeInput('__tgt_x', tgt.x);
    writeInput('__tgt_y', tgt.y);
    writeInput('__tgt_z', tgt.z);
    writeInput('__bias', 1);
    for (const id of order) {
      const node = index.byId.get(id);
      if (!node) continue;
      if (node.kind === 'input' || node.kind === 'bias') continue;
      const slot = index.slot.get(id) as number;
      let sum = node.bias;
      const incoming = index.incoming.get(id) ?? [];
      for (const edge of incoming) {
        const sourceSlot = index.slot.get(edge.sourceNodeId) as number;
        sum += activations[sourceSlot] * edge.weight;
      }
      activations[slot] = applyNeatActivation(node.activation, sum);
    }
    const weightSlot = outputSlot.get(CPPN_OUTPUT_WEIGHT_ID);
    const biasSlot = outputSlot.get(CPPN_OUTPUT_BIAS_ID);
    return {
      weight: weightSlot !== undefined ? activations[weightSlot] : 0,
      bias: biasSlot !== undefined ? activations[biasSlot] : undefined,
    };
  }

  getGenome(): NeatGenome {
    if (!this.cppnGenome) throw new Error('setGenome not called');
    return this.cppnGenome;
  }
  setWeights(_weights: Float32Array): void {
    throw new Error(FIXED_ONLY_METHODS_ERROR);
  }
  getWeights(): Float32Array {
    throw new Error(FIXED_ONLY_METHODS_ERROR);
  }

  act(observation: Float32Array, scratchAction: Float32Array): void {
    if (!this.dna || !this.substrate || !this.phenotypeActivations || !this.phenotypeBiases || !this.encodedScratch || !this.rawOutputScratch) {
      throw new Error('HyperNeatPolicyNetwork.act called before setGenome');
    }
    runEncoder(observation, this.dna.inputEncoder, this.encodedScratch);
    this.phenotypeActivations.fill(0);
    // Write encoder values into the input slots in encoder order.
    let cursor = 0;
    for (let i = 0; i < this.dna.inputEncoder.inputs.length; i++) {
      const binding = this.dna.inputEncoder.inputs[i];
      // Use the first channel only; multi-channel sensors should declare
      // per-channel substrate coords in the substrate config.
      this.phenotypeActivations[i] = this.encodedScratch[cursor];
      cursor += binding.width;
    }
    // Propagate in substrate order: collect per-target sums then activate.
    const sums = new Float32Array(this.phenotypeNodeCount);
    sums.set(this.phenotypeBiases);
    for (const edge of this.phenotypeEdges) {
      sums[edge.targetIndex] += this.phenotypeActivations[edge.sourceIndex] * edge.weight;
    }
    // Activate non-input nodes with tanh.
    for (let i = this.substrate.inputCoords.length; i < this.phenotypeNodeCount; i++) {
      this.phenotypeActivations[i] = Math.tanh(sums[i]);
    }
    for (let i = 0; i < this.dna.outputDecoder.outputs.length; i++) {
      this.rawOutputScratch[i] = this.phenotypeActivations[this.outputStart + i];
    }
    runDecoder(this.rawOutputScratch, this.dna.outputDecoder, scratchAction);
  }

  actBatch(observations: Float32Array, batchSize: number, scratchActions: Float32Array): void {
    const inputWidth = this.encodedScratch?.length ?? 0;
    const outputWidth = this.rawOutputScratch?.length ?? 0;
    for (let i = 0; i < batchSize; i++) {
      this.act(
        observations.subarray(i * inputWidth, (i + 1) * inputWidth),
        scratchActions.subarray(i * outputWidth, (i + 1) * outputWidth),
      );
    }
  }

  resetEpisodeState(): void {
    if (this.phenotypeActivations) this.phenotypeActivations.fill(0);
  }

  tap(cb: (frame: ActivationFrame) => void): PolicyTapHandle {
    this.taps.add(cb);
    return { dispose: () => this.taps.delete(cb) };
  }

  dispose(): void {
    this.cppn = null;
    this.cppnGenome = null;
    this.phenotypeActivations = null;
    this.phenotypeBiases = null;
    this.phenotypeEdges = [];
    this.encodedScratch = null;
    this.rawOutputScratch = null;
    this.taps.clear();
  }

  // Test helpers.
  __getPhenotypeEdges(): readonly PhenotypeEdge[] {
    return this.phenotypeEdges;
  }
  __getPhenotypeNodeCount(): number {
    return this.phenotypeNodeCount;
  }
}

export const HYPERNEAT_CPPN_INPUT_IDS = CPPN_INPUT_IDS;
export const HYPERNEAT_CPPN_WEIGHT_OUTPUT_ID = CPPN_OUTPUT_WEIGHT_ID;
export const HYPERNEAT_CPPN_BIAS_OUTPUT_ID = CPPN_OUTPUT_BIAS_ID;
