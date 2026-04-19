/**
 * NEAT extended with LSTM cell nodes.
 *
 * Connections targeting an `lstm` node carry a `lstmGate` field in
 * `'input' | 'output' | 'forget' | 'candidate'`. Connections without
 * `lstmGate` are interpreted permissively as `candidate` contributions.
 */

import type { BrainDna, LstmCellState, NeatGenome } from '../types.js';
import {
  createLstmCellState,
  resetLstmCellState,
} from '../types.js';
import { runDecoder } from '../runtime.js';
import { applyNeatActivation } from './activations.js';
import { NeatPolicyNetwork } from './NeatPolicyNetwork.js';
import type { ActivationFrame } from '../policy.js';

interface LstmAccumulators {
  input: number;
  forget: number;
  output: number;
  candidate: number;
}

export class NeatLstmPolicyNetwork extends NeatPolicyNetwork {
  private lstm: LstmCellState | null = null;
  private lstmIndexBySlot: Map<number, number> = new Map();
  private gateActivations: Map<number, LstmAccumulators> = new Map();

  protected expectedTopology(): BrainDna['topology'] {
    return 'neatLstm';
  }

  override setGenome(genome: NeatGenome): void {
    super.setGenome(genome);
    if (!this.index) return;
    this.lstmIndexBySlot.clear();
    let lstmCount = 0;
    for (const node of this.index.lstm) {
      const slot = this.index.slot.get(node.id) as number;
      this.lstmIndexBySlot.set(slot, lstmCount++);
    }
    this.lstm = createLstmCellState(lstmCount);
    this.gateActivations.clear();
  }

  override act(observation: Float32Array, scratchAction: Float32Array): void {
    if (!this.dna || !this.index || !this.activations || !this.rawOutputScratch || !this.activationsPrev) {
      throw new Error('NeatLstmPolicyNetwork.act called before setGenome');
    }
    if (this.recurrent) {
      this.activationsPrev.set(this.activations);
    }
    this.writeInputs(observation);
    if (this.recurrent) {
      this.copyInputsAndBiasToPrev();
      for (let iter = 0; iter < this.relaxationIterations; iter++) {
        this.runForwardPass(iter === 0);
      }
    } else {
      if (!this.order) throw new Error('NeatLstmPolicyNetwork: missing topo order');
      for (const id of this.order) {
        const node = this.index.byId.get(id);
        if (!node) continue;
        if (node.kind === 'lstm') {
          this.computeLstmNode(id, false);
        } else {
          this.computeNode(id, false);
        }
      }
    }
    for (let i = 0; i < this.outputOrder.length; i++) {
      this.rawOutputScratch[i] = this.activations[this.outputOrder[i]];
    }
    runDecoder(this.rawOutputScratch, this.dna.outputDecoder, scratchAction);
    if (this.taps.size > 0) {
      const frame = this.buildActivationFrame();
      for (const cb of this.taps) cb(frame);
    }
  }

  private runForwardPass(useRecurrent: boolean): void {
    if (!this.index) return;
    for (const node of this.index.byId.values()) {
      if (node.kind === 'input' || node.kind === 'bias') continue;
      if (node.kind === 'lstm') {
        this.computeLstmNode(node.id, useRecurrent);
      } else {
        this.computeNode(node.id, useRecurrent);
      }
    }
  }

  private computeLstmNode(nodeId: number, useRecurrent: boolean): void {
    if (!this.index || !this.activations || !this.activationsPrev || !this.lstm) return;
    const slot = this.index.slot.get(nodeId) as number;
    const lstmIndex = this.lstmIndexBySlot.get(slot) as number;
    const gates: LstmAccumulators = { input: 0, forget: 0, output: 0, candidate: 0 };
    const incoming = this.index.incoming.get(nodeId) ?? [];
    for (const edge of incoming) {
      const sourceSlot = this.index.slot.get(edge.sourceNodeId) as number;
      const sourceVal = useRecurrent ? this.activationsPrev[sourceSlot] : this.activations[sourceSlot];
      const contribution = sourceVal * edge.weight;
      const gate = edge.lstmGate ?? 'candidate';
      gates[gate] += contribution;
    }
    const node = this.index.byId.get(nodeId);
    const bias = node?.bias ?? 0;
    const inputGate = 1 / (1 + Math.exp(-(gates.input + bias)));
    const forgetGate = 1 / (1 + Math.exp(-(gates.forget + bias)));
    const outputGate = 1 / (1 + Math.exp(-(gates.output + bias)));
    const candidate = Math.tanh(gates.candidate + bias);
    const cell = forgetGate * this.lstm.cellState[lstmIndex] + inputGate * candidate;
    const hidden = outputGate * Math.tanh(cell);
    this.lstm.cellState[lstmIndex] = cell;
    this.lstm.hiddenState[lstmIndex] = hidden;
    this.activations[slot] = hidden;
    this.gateActivations.set(nodeId, {
      input: inputGate,
      forget: forgetGate,
      output: outputGate,
      candidate,
    });
  }

  private buildActivationFrame(): ActivationFrame {
    if (!this.index) {
      return { kind: 'neat', nodeActivations: new Map() };
    }
    const nodeActivations = new Map<number, number>();
    for (const node of this.index.byId.values()) {
      const slot = this.index.slot.get(node.id) as number;
      if (this.activations) nodeActivations.set(node.id, this.activations[slot]);
    }
    const lstmGateActivations = new Map<number, { input: number; forget: number; output: number; candidate: number }>();
    const lstmCellSnapshot = new Map<number, { cell: number; hidden: number }>();
    for (const node of this.index.lstm) {
      const slot = this.index.slot.get(node.id) as number;
      const lstmIndex = this.lstmIndexBySlot.get(slot);
      if (lstmIndex === undefined || !this.lstm) continue;
      lstmCellSnapshot.set(node.id, {
        cell: this.lstm.cellState[lstmIndex],
        hidden: this.lstm.hiddenState[lstmIndex],
      });
      const gates = this.gateActivations.get(node.id);
      if (gates) lstmGateActivations.set(node.id, gates);
    }
    return { kind: 'neat', nodeActivations, lstmGateActivations, lstmCellSnapshot };
  }

  override resetEpisodeState(): void {
    super.resetEpisodeState();
    if (this.lstm) resetLstmCellState(this.lstm);
    this.gateActivations.clear();
  }

  // Test helper.
  __getLstmState(): LstmCellState | null {
    return this.lstm;
  }
  __getLstmIndexBySlot(): Map<number, number> {
    return this.lstmIndexBySlot;
  }

  override dispose(): void {
    super.dispose();
    this.lstm = null;
    this.lstmIndexBySlot.clear();
    this.gateActivations.clear();
  }
}

export function gateActivationsForBuilder(): LstmAccumulators {
  return { input: 0, forget: 0, output: 0, candidate: 0 };
}
