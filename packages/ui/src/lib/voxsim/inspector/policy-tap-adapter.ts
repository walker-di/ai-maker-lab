/**
 * Adapter between `PolicyNetwork.tap()` (which emits frames in the brain
 * package's own shape) and the inspector's `InspectorActivationFrame`
 * (which carries decoded inputs/outputs as well). The orchestrator wires
 * `tap()` through this adapter so panels stay decoupled from the policy
 * implementations.
 */
import type {
  ActivationFrame as PolicyActivationFrame,
  MlpActivationFrame as PolicyMlpFrame,
  NeatActivationFrame as PolicyNeatFrame,
  PolicyNetwork,
  PolicyTapHandle,
} from '../brain/policy.js';
import type {
  InspectorActivationFrame,
  MlpActivationFrame as InspectorMlpFrame,
  NeatActivationFrame as InspectorNeatFrame,
  NeatLstmGateSnapshot,
} from './types.js';

export interface AdaptTapOptions {
  /** Bind the tap to a specific policy variant; defaults to `mlp` for fixed-topology and `neat` for NEAT. */
  policyKind?: InspectorActivationFrame['kind'];
}

export interface TapSnapshot {
  /** Latest decoded inputs the policy was called with. Caller updates this. */
  inputs: Float32Array;
  /** Latest raw network outputs (pre-decode). Caller updates this. */
  outputsRaw: Float32Array;
  /** Latest decoded outputs (post-decode). Caller updates this. */
  outputsDecoded: Float32Array;
  /** Monotonic step index. Caller updates this. */
  stepIndex: number;
}

/**
 * Subscribe to a `PolicyNetwork`'s tap stream and emit `InspectorActivationFrame`s
 * that combine the network's per-layer activations with externally-tracked
 * inputs/outputs/step counters.
 *
 * The caller is expected to keep `snapshot.inputs/outputsRaw/outputsDecoded/stepIndex`
 * in sync with each `act()` call. This avoids re-implementing the decode pipeline
 * inside the inspector.
 */
export function adaptPolicyTap(
  policy: PolicyNetwork,
  snapshot: TapSnapshot,
  emit: (frame: InspectorActivationFrame) => void,
  options: AdaptTapOptions = {},
): PolicyTapHandle {
  const inferredKind: InspectorActivationFrame['kind'] = options.policyKind ?? 'mlp';
  return policy.tap((frame: PolicyActivationFrame) => {
    if (frame.kind === 'mlp') {
      emit(toInspectorMlp(frame, snapshot));
    } else {
      emit(toInspectorNeat(frame, snapshot, inferredKind === 'mlp' ? 'neat' : inferredKind));
    }
  });
}

export function toInspectorMlp(
  frame: PolicyMlpFrame,
  snapshot: TapSnapshot,
): InspectorMlpFrame {
  const layers = frame.layerActivations;
  const hidden = layers.length > 0 ? layers.slice(0, -1) : [];
  return {
    kind: 'mlp',
    stepIndex: snapshot.stepIndex,
    inputs: snapshot.inputs,
    hidden,
    outputsRaw: snapshot.outputsRaw,
    outputsDecoded: snapshot.outputsDecoded,
  };
}

export function toInspectorNeat(
  frame: PolicyNeatFrame,
  snapshot: TapSnapshot,
  kind: Exclude<InspectorActivationFrame['kind'], 'mlp'>,
): InspectorNeatFrame {
  const lstmGates = mergeLstmGates(frame);
  return {
    kind,
    stepIndex: snapshot.stepIndex,
    inputs: snapshot.inputs,
    nodeActivations: cloneNodeActivations(frame.nodeActivations),
    lstmGates,
    outputsRaw: snapshot.outputsRaw,
    outputsDecoded: snapshot.outputsDecoded,
  };
}

function cloneNodeActivations(map: Map<number, number>): Map<number, number> {
  const out = new Map<number, number>();
  for (const [k, v] of map) out.set(k, v);
  return out;
}

function mergeLstmGates(
  frame: PolicyNeatFrame,
): Map<number, NeatLstmGateSnapshot> | undefined {
  if (!frame.lstmGateActivations) return undefined;
  const cells = frame.lstmCellSnapshot ?? new Map();
  const out = new Map<number, NeatLstmGateSnapshot>();
  for (const [nodeId, gates] of frame.lstmGateActivations) {
    const cell = cells.get(nodeId);
    out.set(nodeId, {
      input: gates.input,
      forget: gates.forget,
      output: gates.output,
      candidate: gates.candidate,
      cellState: cell?.cell ?? 0,
      hiddenState: cell?.hidden ?? 0,
    });
  }
  return out;
}
