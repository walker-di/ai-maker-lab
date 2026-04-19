import { describe, expect, it } from 'bun:test';

import { NeuronActivityView } from './neuron-activity-view.js';
import type {
  InspectorActivationFrame,
  MlpActivationFrame,
  NeatActivationFrame,
} from './types.js';

function mlpFrame(stepIndex: number, hidden: number[]): MlpActivationFrame {
  return {
    kind: 'mlp',
    stepIndex,
    inputs: new Float32Array([0.1, 0.2]),
    hidden: [new Float32Array(hidden)],
    outputsRaw: new Float32Array([0.5]),
    outputsDecoded: new Float32Array([0.5]),
  };
}

function neatFrame(stepIndex: number, activations: [number, number][]): NeatActivationFrame {
  return {
    kind: 'neat',
    stepIndex,
    inputs: new Float32Array([0.1]),
    nodeActivations: new Map(activations),
    outputsRaw: new Float32Array([0.3]),
    outputsDecoded: new Float32Array([0.3]),
  };
}

describe('NeuronActivityView', () => {
  it('flattens an MLP frame into rows + rowKinds', () => {
    const v = new NeuronActivityView();
    v.ingest(mlpFrame(0, [0.1, 0.2, 0.3]));
    expect(v.size).toBe(1);
    const entry = v.window[0]!;
    expect(Array.from(entry.rowKinds)).toEqual([
      'input', 'input', 'hidden', 'hidden', 'hidden', 'output',
    ]);
    expect(entry.rows).toHaveLength(6);
  });

  it('caps the window to windowSize', () => {
    const v = new NeuronActivityView({ windowSize: 3 });
    for (let i = 0; i < 5; i++) v.ingest(mlpFrame(i, [i]));
    expect(v.size).toBe(3);
    expect(v.window.map((e) => e.stepIndex)).toEqual([2, 3, 4]);
  });

  it('ingests a NEAT frame and labels lstm rows when lstmGates provided', () => {
    const v = new NeuronActivityView();
    const frame: NeatActivationFrame = neatFrame(0, [[0, 0.5], [1, 0.7], [2, -0.3]]);
    frame.lstmGates = new Map([
      [1, { input: 0, forget: 0, output: 0, candidate: 0, cellState: 0, hiddenState: 0 }],
    ]);
    v.ingest(frame);
    const entry = v.window[0]!;
    expect(Array.from(entry.rowKinds)).toEqual(['hidden', 'lstm', 'hidden']);
    const rows = Array.from(entry.rows);
    expect(rows[0]).toBeCloseTo(0.5);
    expect(rows[1]).toBeCloseTo(0.7);
    expect(rows[2]).toBeCloseTo(-0.3);
  });

  it('reset clears buffer and PCA cache', () => {
    const v = new NeuronActivityView({ windowSize: 32 });
    for (let i = 0; i < 8; i++) v.ingest(mlpFrame(i, [i, i + 1, i + 2]));
    v.reset();
    expect(v.size).toBe(0);
    expect(v.ensurePcaBasis(2)).toBeNull();
  });

  it('returns null PCA basis when below minSamples', () => {
    const v = new NeuronActivityView();
    v.ingest(mlpFrame(0, [1, 2, 3]));
    expect(v.ensurePcaBasis(16)).toBeNull();
  });

  it('produces a finite PCA projection once enough samples have been ingested', () => {
    const v = new NeuronActivityView({ windowSize: 64 });
    for (let i = 0; i < 32; i++) {
      const t = i / 32;
      v.ingest(mlpFrame(i, [Math.sin(t), Math.cos(t), Math.sin(t * 2)]));
    }
    const basis = v.ensurePcaBasis(8);
    expect(basis).not.toBeNull();
    const projection = v.projectLatest();
    expect(projection).not.toBeNull();
    expect(Number.isFinite(projection!.x)).toBe(true);
    expect(Number.isFinite(projection!.y)).toBe(true);
  });

  it('handles either MLP or NEAT discriminator via ingest()', () => {
    const v = new NeuronActivityView();
    const frames: InspectorActivationFrame[] = [
      mlpFrame(0, [0.1]),
      neatFrame(1, [[0, 0.4]]),
    ];
    for (const f of frames) v.ingest(f);
    expect(v.size).toBe(2);
  });
});
