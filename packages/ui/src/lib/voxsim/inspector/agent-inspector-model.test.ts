import { describe, expect, it } from 'bun:test';

import { AgentInspectorModel } from './agent-inspector-model.js';
import type { BodyDna } from '../morphology/types.js';
import {
  makeMlpBrainDna,
  makeNeatBrainDna,
  makeNeatGenome,
} from './__test-helpers__/fixtures.js';
import { buildReplayBuffer } from './__test-helpers__/replay-buffer.js';
import type { MlpActivationFrame, NeatActivationFrame } from './types.js';

const fakeBody: BodyDna = {
  id: 'body-1',
  version: 1,
  kind: 'robot',
  rootSegmentId: 'torso',
  segments: [],
  joints: [],
  sensors: [],
  actuators: { actuators: [] },
  metadata: {
    name: 'test-body',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    author: 'test',
  },
};

function mlpFrame(stepIndex: number): MlpActivationFrame {
  return {
    kind: 'mlp',
    stepIndex,
    inputs: new Float32Array([0.1, 0.2, 0.3]),
    hidden: [new Float32Array([0.4, 0.5, 0.6, 0.7])],
    outputsRaw: new Float32Array([0.5, 0.5]),
    outputsDecoded: new Float32Array([0.5, 0.5]),
  };
}

function neatLstmFrame(stepIndex: number): NeatActivationFrame {
  return {
    kind: 'neatLstm',
    stepIndex,
    inputs: new Float32Array([0.1]),
    nodeActivations: new Map([[0, 0.5]]),
    lstmGates: new Map([
      [
        0,
        {
          input: 0.1,
          forget: 0.2,
          output: 0.3,
          candidate: 0.4,
          cellState: 0.5,
          hiddenState: 0.6,
        },
      ],
    ]),
    outputsRaw: new Float32Array([0.5]),
    outputsDecoded: new Float32Array([0.5]),
  };
}

describe('AgentInspectorModel', () => {
  it('starts in idle mode with no agent attached', () => {
    const model = new AgentInspectorModel();
    expect(model.mode).toBe('idle');
    expect(model.selectedAgentId).toBeNull();
    expect(model.computeBrainGraph()).toBeNull();
  });

  it('attachLive enables panels appropriate to the policy kind', () => {
    const model = new AgentInspectorModel();
    const dna = makeMlpBrainDna();
    const weights = new Float32Array(3 * 4 + 4 + 4 * 2).fill(0.1);
    model.attachLive({ agentId: 'a1', brainDna: dna, bodyDna: fakeBody, weights });
    expect(model.mode).toBe('live');
    expect(model.panels.topology).toBe(true);
    expect(model.panels.charts).toBe(true);
    expect(model.panels.species).toBe(false);
    expect(model.panels.replay).toBe(false);
    expect(model.computeBrainGraph()?.topology).toBe('mlp');
  });

  it('attachLive for NEAT enables species panel', () => {
    const model = new AgentInspectorModel();
    model.attachLive({
      agentId: 'a1',
      brainDna: makeNeatBrainDna(),
      bodyDna: fakeBody,
      genome: makeNeatGenome(),
    });
    expect(model.panels.species).toBe(true);
  });

  it('attachReplay enables the replay panel and seeds the cursor', () => {
    const model = new AgentInspectorModel();
    const bytes = buildReplayBuffer({ frameCount: 4, policyKind: 'mlp' });
    model.attachReplay({
      agentId: 'a1',
      brainDna: makeMlpBrainDna(),
      bodyDna: fakeBody,
      replay: bytes,
      replayRefId: 'r1',
      mlpHiddenWidths: [4],
    });
    expect(model.mode).toBe('replay');
    expect(model.panels.replay).toBe(true);
    expect(model.replayCursor?.frameCount).toBe(4);
    model.seek(3);
    expect(model.replayCursor?.frameIndex).toBe(3);
    expect(model.activationFrame?.kind).toBe('mlp');
  });

  it('ingestActivationFrame routes lstm frames to the lstm view', () => {
    const model = new AgentInspectorModel();
    model.attachLive({
      agentId: 'a1',
      brainDna: makeNeatBrainDna({ topology: 'neatLstm' }),
      bodyDna: fakeBody,
      genome: makeNeatGenome(),
    });
    model.ingestActivationFrame(neatLstmFrame(0));
    model.ingestActivationFrame(neatLstmFrame(1));
    expect(model.activityView.size).toBe(2);
    expect(model.lstmCellView.nodeIds).toEqual([0]);
  });

  it('setComparePrevious populates an MLP mutation diff for the current weights', () => {
    const model = new AgentInspectorModel();
    const dna = makeMlpBrainDna();
    const weightCount = 3 * 4 + 4 + 4 * 2;
    const prev = new Float32Array(weightCount);
    const curr = new Float32Array(weightCount);
    curr[0] = 0.5;
    model.attachLive({ agentId: 'a1', brainDna: dna, bodyDna: fakeBody, weights: curr });
    model.setComparePrevious({
      kind: 'mlp',
      previousWeights: prev,
      edgeIds: ['edge_0', 'edge_1'],
    });
    expect(model.mutationDiff?.kind).toBe('mlp');
    if (model.mutationDiff?.kind === 'mlp') {
      expect(model.mutationDiff.edgeWeightDeltas[0]).toEqual({ edgeId: 'edge_0', delta: 0.5 });
    }
  });

  it('setComparePrevious populates a NEAT mutation diff', () => {
    const model = new AgentInspectorModel();
    const prev = makeNeatGenome();
    const curr = makeNeatGenome();
    curr.connections[0]!.weight = 0.99;
    model.attachLive({
      agentId: 'a1',
      brainDna: makeNeatBrainDna(),
      bodyDna: fakeBody,
      genome: curr,
    });
    model.setComparePrevious({ kind: 'neat', previous: prev });
    expect(model.mutationDiff?.kind).toBe('neat');
  });

  it('detach resets all derived state', () => {
    const model = new AgentInspectorModel();
    model.attachLive({
      agentId: 'a1',
      brainDna: makeMlpBrainDna(),
      bodyDna: fakeBody,
      weights: new Float32Array(3 * 4 + 4 + 4 * 2),
    });
    model.ingestActivationFrame(mlpFrame(0));
    model.detach();
    expect(model.mode).toBe('idle');
    expect(model.selectedAgentId).toBeNull();
    expect(model.activationFrame).toBeNull();
    expect(model.activityView.size).toBe(0);
  });

  it('subscribe is invoked on state-changing operations', () => {
    const model = new AgentInspectorModel();
    let calls = 0;
    const unsub = model.subscribe(() => calls++);
    model.attachLive({
      agentId: 'a1',
      brainDna: makeMlpBrainDna(),
      bodyDna: fakeBody,
      weights: new Float32Array(3 * 4 + 4 + 4 * 2),
    });
    model.ingestActivationFrame(mlpFrame(0));
    unsub();
    model.detach();
    expect(calls).toBeGreaterThanOrEqual(2);
  });
});
