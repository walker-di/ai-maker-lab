import { describe, expect, it } from 'bun:test';

import { LstmCellView } from './lstm-cell-view.js';
import type { NeatActivationFrame, NeatLstmGateSnapshot } from './types.js';

function gates(value: number): NeatLstmGateSnapshot {
  return {
    input: value,
    output: value,
    forget: value,
    candidate: value,
    cellState: value,
    hiddenState: value,
  };
}

function frame(stepIndex: number, entries: [number, number][]): NeatActivationFrame {
  return {
    kind: 'neatLstm',
    stepIndex,
    inputs: new Float32Array(),
    nodeActivations: new Map(),
    lstmGates: new Map(entries.map(([id, v]) => [id, gates(v)])),
    outputsRaw: new Float32Array(),
    outputsDecoded: new Float32Array(),
  };
}

describe('LstmCellView', () => {
  it('tracks per-node sliding windows of gate snapshots', () => {
    const v = new LstmCellView({ windowSize: 3 });
    v.ingest(frame(0, [[5, 0.1]]));
    v.ingest(frame(1, [[5, 0.2], [9, 0.7]]));
    v.ingest(frame(2, [[5, 0.3], [9, 0.8]]));
    v.ingest(frame(3, [[5, 0.4]]));
    expect(v.nodeIds).toEqual([5, 9]);
    expect(v.windowFor(5).map((s) => s.gates.input)).toEqual([0.2, 0.3, 0.4]);
    expect(v.windowFor(9).map((s) => s.gates.cellState)).toEqual([0.7, 0.8]);
  });

  it('skips frames without lstm gates', () => {
    const v = new LstmCellView();
    v.ingest({
      kind: 'neat',
      stepIndex: 0,
      inputs: new Float32Array(),
      nodeActivations: new Map(),
      outputsRaw: new Float32Array(),
      outputsDecoded: new Float32Array(),
    });
    expect(v.nodeIds).toEqual([]);
  });

  it('reset clears all per-node buffers', () => {
    const v = new LstmCellView();
    v.ingest(frame(0, [[1, 0.1]]));
    v.reset();
    expect(v.nodeIds).toEqual([]);
    expect(v.windowFor(1)).toEqual([]);
  });

  it('clones gate snapshots so external mutation is harmless', () => {
    const v = new LstmCellView();
    const f = frame(0, [[1, 0.1]]);
    v.ingest(f);
    f.lstmGates!.get(1)!.input = 99;
    expect(v.windowFor(1)[0]!.gates.input).toBe(0.1);
  });
});
