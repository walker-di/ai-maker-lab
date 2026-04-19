/**
 * Per-LSTM-node sliding window of gate activations and cell/hidden state
 * values. Driven from `NeatActivationFrame.lstmGates`.
 */

import type { NeatActivationFrame, NeatLstmGateSnapshot } from './types.js';

export interface LstmCellSample {
  stepIndex: number;
  gates: NeatLstmGateSnapshot;
}

export interface LstmCellViewOptions {
  windowSize?: number;
}

const DEFAULT_WINDOW = 256;

export class LstmCellView {
  private readonly windowSize: number;
  private readonly perNode = new Map<number, LstmCellSample[]>();
  private orderedIds: number[] = [];

  constructor(options: LstmCellViewOptions = {}) {
    this.windowSize = options.windowSize ?? DEFAULT_WINDOW;
  }

  ingest(frame: NeatActivationFrame): void {
    if (!frame.lstmGates) return;
    for (const [nodeId, gates] of frame.lstmGates) {
      let buf = this.perNode.get(nodeId);
      if (!buf) {
        buf = [];
        this.perNode.set(nodeId, buf);
        this.orderedIds.push(nodeId);
        this.orderedIds.sort((a, b) => a - b);
      }
      buf.push({ stepIndex: frame.stepIndex, gates: { ...gates } });
      while (buf.length > this.windowSize) buf.shift();
    }
  }

  reset(): void {
    this.perNode.clear();
    this.orderedIds.length = 0;
  }

  get nodeIds(): readonly number[] {
    return this.orderedIds;
  }

  windowFor(nodeId: number): readonly LstmCellSample[] {
    return this.perNode.get(nodeId) ?? [];
  }
}
