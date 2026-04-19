import { describe, expect, it } from 'bun:test';

import { toInspectorMlp, toInspectorNeat } from './policy-tap-adapter.js';
import type {
  ActivationFrame,
  MlpActivationFrame as PolicyMlpFrame,
  NeatActivationFrame as PolicyNeatFrame,
  PolicyNetwork,
  PolicyTapHandle,
} from '../brain/policy.js';
import { adaptPolicyTap } from './policy-tap-adapter.js';
import type { InspectorActivationFrame } from './types.js';

class FakePolicy implements PolicyNetwork {
  callbacks = new Set<(frame: ActivationFrame) => void>();
  init(): Promise<void> { return Promise.resolve(); }
  setWeights(): void {}
  getWeights(): Float32Array { return new Float32Array(); }
  setGenome(): void {}
  getGenome(): never { throw new Error('not used'); }
  act(): void {}
  actBatch(): void {}
  resetEpisodeState(): void {}
  tap(cb: (frame: ActivationFrame) => void): PolicyTapHandle {
    this.callbacks.add(cb);
    return { dispose: () => this.callbacks.delete(cb) };
  }
  emit(frame: ActivationFrame): void {
    for (const c of this.callbacks) c(frame);
  }
  dispose(): void {}
}

describe('policy tap adapter', () => {
  it('toInspectorMlp peels off the last layer as outputs and exposes hidden activations', () => {
    const policyFrame: PolicyMlpFrame = {
      kind: 'mlp',
      layerActivations: [
        new Float32Array([0.1, 0.2, 0.3]),
        new Float32Array([0.4, 0.5]),
      ],
    };
    const snap = {
      inputs: new Float32Array([1, 2]),
      outputsRaw: new Float32Array([0.4, 0.5]),
      outputsDecoded: new Float32Array([0.4, 0.5]),
      stepIndex: 7,
    };
    const out = toInspectorMlp(policyFrame, snap);
    expect(out.kind).toBe('mlp');
    expect(out.hidden).toHaveLength(1);
    const hiddenValues = Array.from(out.hidden[0]!);
    expect(hiddenValues[0]).toBeCloseTo(0.1);
    expect(hiddenValues[1]).toBeCloseTo(0.2);
    expect(hiddenValues[2]).toBeCloseTo(0.3);
    expect(out.stepIndex).toBe(7);
    expect(out.inputs).toBe(snap.inputs);
  });

  it('toInspectorNeat clones nodeActivations and merges lstm gates with cell snapshots', () => {
    const frame: PolicyNeatFrame = {
      kind: 'neat',
      nodeActivations: new Map([[0, 0.5], [1, 0.7]]),
      lstmGateActivations: new Map([[3, { input: 0.1, forget: 0.2, output: 0.3, candidate: 0.4 }]]),
      lstmCellSnapshot: new Map([[3, { cell: 1.2, hidden: -0.4 }]]),
    };
    const snap = {
      inputs: new Float32Array([0]),
      outputsRaw: new Float32Array([0]),
      outputsDecoded: new Float32Array([0]),
      stepIndex: 1,
    };
    const out = toInspectorNeat(frame, snap, 'neatLstm');
    expect(out.kind).toBe('neatLstm');
    expect(out.nodeActivations).not.toBe(frame.nodeActivations);
    expect(out.nodeActivations.get(1)).toBeCloseTo(0.7);
    const gates = out.lstmGates!.get(3)!;
    expect(gates.input).toBeCloseTo(0.1);
    expect(gates.cellState).toBeCloseTo(1.2);
    expect(gates.hiddenState).toBeCloseTo(-0.4);
  });

  it('adaptPolicyTap forwards emitted frames through the conversion pipeline', () => {
    const policy = new FakePolicy();
    const snap = {
      inputs: new Float32Array(),
      outputsRaw: new Float32Array(),
      outputsDecoded: new Float32Array(),
      stepIndex: 0,
    };
    const captured: InspectorActivationFrame[] = [];
    const handle = adaptPolicyTap(policy, snap, (f) => captured.push(f));
    snap.stepIndex = 5;
    policy.emit({ kind: 'mlp', layerActivations: [new Float32Array([1])] });
    expect(captured).toHaveLength(1);
    expect(captured[0]!.stepIndex).toBe(5);
    handle.dispose();
    expect(policy.callbacks.size).toBe(0);
  });
});
