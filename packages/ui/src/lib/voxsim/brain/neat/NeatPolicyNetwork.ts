/**
 * Pure-JS forward pass for classic NEAT genomes.
 *
 * Two execution modes:
 * - DAG mode (`allowRecurrent === false`): topological order computed once on
 *   `setGenome`; `act` walks it linearly in O(connections).
 * - Recurrent mode (`allowRecurrent === true`): `act` runs `relaxationIterations`
 *   passes over every non-input node using the previous activation buffer for
 *   cyclic edges.
 */

import type {
  BrainDna,
  NeatGenome,
} from '../types.js';
import {
  FIXED_ONLY_METHODS_ERROR,
  type ActivationFrame,
  type PolicyNetwork,
  type PolicyTapHandle,
} from '../policy.js';
import { runDecoder, runEncoder } from '../runtime.js';
import { applyNeatActivation } from './activations.js';
import { indexGenome, topologicalOrder, type NodeIndex } from './topo.js';

export class NeatPolicyNetwork implements PolicyNetwork {
  protected dna: BrainDna | null = null;
  protected genome: NeatGenome | null = null;
  protected index: NodeIndex | null = null;
  protected order: number[] | null = null;
  protected recurrent = false;
  protected relaxationIterations = 1;
  protected encodedScratch: Float32Array | null = null;
  protected rawOutputScratch: Float32Array | null = null;
  protected activations: Float32Array | null = null;
  protected activationsPrev: Float32Array | null = null;
  protected inputBindingToSlot: Map<string, number> = new Map();
  protected outputBindingToSlot: Map<string, number> = new Map();
  protected outputOrder: number[] = [];
  protected taps: Set<(frame: ActivationFrame) => void> = new Set();

  protected expectedTopology(): BrainDna['topology'] {
    return 'neat';
  }

  async init(dna: BrainDna): Promise<void> {
    if (dna.topology !== this.expectedTopology()) {
      throw new Error(
        `${this.constructor.name} requires topology=${this.expectedTopology()}; got ${dna.topology}`,
      );
    }
    if (!dna.neat) throw new Error(`${this.constructor.name} requires brainDna.neat`);
    this.dna = dna;
    this.recurrent = dna.neat.allowRecurrent;
    this.relaxationIterations = dna.neat.relaxationIterations ?? 1;
    this.encodedScratch = new Float32Array(dna.inputEncoder.inputs.reduce((s, b) => s + b.width, 0));
    this.rawOutputScratch = new Float32Array(dna.outputDecoder.outputs.length);
    this.outputOrder = dna.outputDecoder.outputs.map((o) => -1); // resolved on setGenome
  }

  setGenome(genome: NeatGenome): void {
    if (!this.dna) throw new Error(`${this.constructor.name}.setGenome called before init`);
    this.genome = genome;
    this.index = indexGenome(genome);
    this.activations = new Float32Array(genome.nodes.length);
    this.activationsPrev = new Float32Array(genome.nodes.length);
    if (!this.recurrent) {
      this.order = topologicalOrder(this.index);
    } else {
      this.order = null;
    }
    this.inputBindingToSlot.clear();
    for (const node of this.index.inputs) {
      if (node.inputBindingId !== undefined) {
        this.inputBindingToSlot.set(node.inputBindingId, this.index.slot.get(node.id) as number);
      }
    }
    this.outputBindingToSlot.clear();
    for (const node of this.index.outputs) {
      if (node.outputBindingId !== undefined) {
        this.outputBindingToSlot.set(node.outputBindingId, this.index.slot.get(node.id) as number);
      }
    }
    // Resolve decoder order.
    const decoder = this.dna.outputDecoder;
    this.outputOrder = decoder.outputs.map((b) => {
      const slot = this.outputBindingToSlot.get(b.actuatorId);
      if (slot === undefined) {
        throw new Error(`NEAT genome lacks output node for actuatorId=${b.actuatorId}`);
      }
      return slot;
    });
  }

  getGenome(): NeatGenome {
    if (!this.genome) throw new Error('setGenome not called');
    return this.genome;
  }

  setWeights(_weights: Float32Array): void {
    throw new Error(FIXED_ONLY_METHODS_ERROR);
  }
  getWeights(): Float32Array {
    throw new Error(FIXED_ONLY_METHODS_ERROR);
  }

  protected writeInputs(observation: Float32Array): void {
    if (!this.dna || !this.encodedScratch || !this.activations) return;
    runEncoder(observation, this.dna.inputEncoder, this.encodedScratch);
    let cursor = 0;
    for (const binding of this.dna.inputEncoder.inputs) {
      const slot = this.inputBindingToSlot.get(binding.sensorId);
      if (slot !== undefined) {
        // For multi-channel sensors we put the *first* channel into the input
        // slot. Multi-channel sensor wiring needs synthetic per-channel inputs
        // in the genome; that's handled by the trainer in plan 05.
        this.activations[slot] = this.encodedScratch[cursor];
      }
      cursor += binding.width;
    }
    // Bias nodes always carry 1.0
    if (this.index) {
      for (const bias of this.index.bias) {
        const slot = this.index.slot.get(bias.id);
        if (slot !== undefined) this.activations[slot] = 1;
      }
    }
  }

  protected copyInputsAndBiasToPrev(): void {
    if (!this.index || !this.activations || !this.activationsPrev) return;
    for (const node of this.index.inputs) {
      const slot = this.index.slot.get(node.id) as number;
      this.activationsPrev[slot] = this.activations[slot];
    }
    for (const node of this.index.bias) {
      const slot = this.index.slot.get(node.id) as number;
      this.activationsPrev[slot] = this.activations[slot];
    }
  }

  protected computeNode(nodeId: number, useRecurrent: boolean): void {
    if (!this.index || !this.activations || !this.activationsPrev) return;
    const node = this.index.byId.get(nodeId);
    if (!node) return;
    if (node.kind === 'input' || node.kind === 'bias') return;
    if (node.kind === 'lstm') return; // handled by subclass
    const slot = this.index.slot.get(nodeId) as number;
    let sum = node.bias;
    const incoming = this.index.incoming.get(nodeId) ?? [];
    for (const edge of incoming) {
      const sourceSlot = this.index.slot.get(edge.sourceNodeId) as number;
      const sourceVal = useRecurrent ? this.activationsPrev[sourceSlot] : this.activations[sourceSlot];
      sum += sourceVal * edge.weight;
    }
    this.activations[slot] = applyNeatActivation(node.activation, sum);
  }

  act(observation: Float32Array, scratchAction: Float32Array): void {
    if (!this.dna || !this.index || !this.activations || !this.rawOutputScratch || !this.activationsPrev) {
      throw new Error('NeatPolicyNetwork.act called before setGenome');
    }
    if (this.recurrent) {
      this.activationsPrev.set(this.activations);
      this.writeInputs(observation);
      this.copyInputsAndBiasToPrev();
      for (let iter = 0; iter < this.relaxationIterations; iter++) {
        for (const node of this.index.byId.values()) {
          if (node.kind === 'input' || node.kind === 'bias') continue;
          this.computeNode(node.id, iter === 0);
        }
      }
    } else {
      if (!this.order) throw new Error('NeatPolicyNetwork: missing topo order');
      this.writeInputs(observation);
      for (const id of this.order) {
        this.computeNode(id, false);
      }
    }
    for (let i = 0; i < this.outputOrder.length; i++) {
      this.rawOutputScratch[i] = this.activations[this.outputOrder[i]];
    }
    runDecoder(this.rawOutputScratch, this.dna.outputDecoder, scratchAction);
    if (this.taps.size > 0) {
      const frame: ActivationFrame = {
        kind: 'neat',
        nodeActivations: new Map(),
      };
      for (const node of this.index.byId.values()) {
        const slot = this.index.slot.get(node.id) as number;
        frame.nodeActivations.set(node.id, this.activations[slot]);
      }
      for (const cb of this.taps) cb(frame);
    }
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
    if (this.activations) this.activations.fill(0);
    if (this.activationsPrev) this.activationsPrev.fill(0);
  }

  tap(cb: (frame: ActivationFrame) => void): PolicyTapHandle {
    this.taps.add(cb);
    return { dispose: () => this.taps.delete(cb) };
  }

  dispose(): void {
    this.activations = null;
    this.activationsPrev = null;
    this.encodedScratch = null;
    this.rawOutputScratch = null;
    this.index = null;
    this.order = null;
    this.taps.clear();
  }
}
