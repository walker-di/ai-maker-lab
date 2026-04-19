/**
 * `AgentInspectorModel` is the single source of truth for the inspector
 * routes. It owns the selected agent, the most recent activation frame, the
 * derived chart series, and the replay cursor. Svelte panels bind to this
 * model and never reach into the engine, the trainer, or the database
 * directly.
 *
 * This file is plain TS (no `.svelte.ts` runes) so it stays testable in Bun.
 * The Svelte component wrapper (added later) re-exposes the same state
 * through `$state` if needed.
 */

import type { BodyDna } from '../morphology/types.js';
import type { BrainDna, NeatGenome } from '../brain/types.js';
import { isNeatTopology } from '../brain/types.js';
import type {
  TrainingProgressEvent,
} from '../training/types.js';
import type {
  InspectorActivationFrame,
  InspectorBrainGraph,
  InspectorMutationDiff,
  InspectorReplayCursor,
} from './types.js';
import { TrainingChartsView } from './training-charts-view.js';
import { NeuronActivityView } from './neuron-activity-view.js';
import { LstmCellView } from './lstm-cell-view.js';
import { SpeciesListView } from './species-list-view.js';
import { ReplayPlayer } from './replay-player.js';
import { deriveBrainGraph } from './brain-topology-derive.js';
import { diffMlpWeights, diffNeatGenomes } from './mutation-diff.js';

export type InspectorMode = 'live' | 'replay' | 'idle';

export interface InspectorPanels {
  topology: boolean;
  charts: boolean;
  activity: boolean;
  cppnSubstrate: boolean;
  lstmCell: boolean;
  species: boolean;
  replay: boolean;
}

export interface AttachLiveInput {
  agentId: string;
  brainDna: BrainDna;
  bodyDna: BodyDna;
  weights?: Float32Array;
  genome?: NeatGenome;
}

export interface AttachReplayInput {
  agentId: string;
  brainDna: BrainDna;
  bodyDna: BodyDna;
  replayRefId: string;
  replay: Uint8Array;
  /** Optional MLP hidden layer widths so synthesized frames have the right shape. */
  mlpHiddenWidths?: number[];
  weights?: Float32Array;
  genome?: NeatGenome;
}

export interface AgentInspectorModelOptions {
  /** Pluggable activity view, useful for tests and for replacing PCA logic. */
  activityView?: NeuronActivityView;
  charts?: TrainingChartsView;
  speciesList?: SpeciesListView;
  lstmCell?: LstmCellView;
  /** Optional clock for replay advance. */
  now?: () => number;
}

const DEFAULT_PANELS: InspectorPanels = {
  topology: false,
  charts: false,
  activity: false,
  cppnSubstrate: false,
  lstmCell: false,
  species: false,
  replay: false,
};

export class AgentInspectorModel {
  selectedAgentId: string | null = null;
  mode: InspectorMode = 'idle';
  brainDna: BrainDna | null = null;
  bodyDna: BodyDna | null = null;
  weights: Float32Array | null = null;
  genome: NeatGenome | null = null;
  previousGenome: NeatGenome | null = null;
  previousWeights: Float32Array | null = null;
  activationFrame: InspectorActivationFrame | null = null;
  replayCursor: InspectorReplayCursor | null = null;
  mutationDiff: InspectorMutationDiff | null = null;
  diffOverlayEnabled = false;
  panels: InspectorPanels = { ...DEFAULT_PANELS };

  readonly charts: TrainingChartsView;
  readonly activityView: NeuronActivityView;
  readonly lstmCellView: LstmCellView;
  readonly speciesList: SpeciesListView;
  private replayPlayer: ReplayPlayer | null = null;
  private listeners = new Set<() => void>();

  constructor(options: AgentInspectorModelOptions = {}) {
    this.charts = options.charts ?? new TrainingChartsView();
    this.activityView = options.activityView ?? new NeuronActivityView();
    this.lstmCellView = options.lstmCell ?? new LstmCellView();
    this.speciesList = options.speciesList ?? new SpeciesListView();
  }

  attachLive(input: AttachLiveInput): void {
    this.detach();
    this.mode = 'live';
    this.selectedAgentId = input.agentId;
    this.brainDna = input.brainDna;
    this.bodyDna = input.bodyDna;
    this.weights = input.weights ?? null;
    this.genome = input.genome ?? null;
    this.panels = panelsFor(input.brainDna, this.replayCursor);
    this.notify();
  }

  attachReplay(input: AttachReplayInput): void {
    this.detach();
    this.mode = 'replay';
    this.selectedAgentId = input.agentId;
    this.brainDna = input.brainDna;
    this.bodyDna = input.bodyDna;
    this.weights = input.weights ?? null;
    this.genome = input.genome ?? null;
    this.replayPlayer = new ReplayPlayer({
      replayRefId: input.replayRefId,
      bytes: input.replay,
      mlpHiddenWidths: input.mlpHiddenWidths,
    });
    this.replayCursor = this.replayPlayer.currentCursor;
    this.panels = panelsFor(input.brainDna, this.replayCursor);
    this.notify();
  }

  detach(): void {
    this.mode = 'idle';
    this.selectedAgentId = null;
    this.brainDna = null;
    this.bodyDna = null;
    this.weights = null;
    this.genome = null;
    this.previousGenome = null;
    this.previousWeights = null;
    this.activationFrame = null;
    this.replayCursor = null;
    this.mutationDiff = null;
    this.diffOverlayEnabled = false;
    this.panels = { ...DEFAULT_PANELS };
    this.replayPlayer = null;
    this.activityView.reset();
    this.lstmCellView.reset();
    this.notify();
  }

  setSelectedAgent(agentId: string): void {
    this.selectedAgentId = agentId;
    this.notify();
  }

  ingestActivationFrame(frame: InspectorActivationFrame): void {
    this.activationFrame = frame;
    this.activityView.ingest(frame);
    if (frame.kind === 'neatLstm') this.lstmCellView.ingest(frame);
    this.notify();
  }

  pushChartProgress(event: TrainingProgressEvent): void {
    this.charts.ingest(event);
    this.speciesList.ingest(event);
    this.notify();
  }

  setComparePrevious(payload:
    | { kind: 'mlp'; previousWeights: Float32Array; edgeIds: string[] }
    | { kind: 'neat'; previous: NeatGenome },
  ): void {
    if (payload.kind === 'mlp') {
      this.previousWeights = payload.previousWeights;
      if (this.weights) {
        this.mutationDiff = diffMlpWeights(
          payload.previousWeights,
          this.weights,
          payload.edgeIds,
        );
      }
    } else {
      this.previousGenome = payload.previous;
      if (this.genome) {
        this.mutationDiff = diffNeatGenomes(payload.previous, this.genome);
      }
    }
    this.notify();
  }

  setDiffOverlayEnabled(enabled: boolean): void {
    this.diffOverlayEnabled = enabled;
    this.notify();
  }

  /** Compute the topology graph for the currently bound brain. */
  computeBrainGraph(options?: {
    speciesId?: number;
    speciesPalette?: Record<number, string>;
    nodeActivations?: Map<number, number>;
    mlpActivations?: { hidden: Float32Array[]; outputs: Float32Array };
  }): InspectorBrainGraph | null {
    if (!this.brainDna) return null;
    const diff = this.diffOverlayEnabled ? this.mutationDiff ?? undefined : undefined;
    if (this.weights) {
      return deriveBrainGraph(this.brainDna, { kind: 'flat', weights: this.weights }, {
        diff,
        ...options,
      });
    }
    if (this.genome) {
      return deriveBrainGraph(this.brainDna, { kind: 'neatGenome', genome: this.genome }, {
        diff,
        ...options,
      });
    }
    return null;
  }

  // -- replay control passthrough ----------------------------------------

  seek(frameIndex: number): void {
    if (!this.replayPlayer) return;
    const snap = this.replayPlayer.seek(frameIndex);
    this.activationFrame = snap.activationFrame;
    this.replayCursor = this.replayPlayer.currentCursor;
    this.activityView.ingest(snap.activationFrame);
    this.notify();
  }

  play(): void {
    if (!this.replayPlayer) return;
    this.replayPlayer.play();
    this.replayCursor = this.replayPlayer.currentCursor;
    this.notify();
  }

  pause(): void {
    if (!this.replayPlayer) return;
    this.replayPlayer.pause();
    this.replayCursor = this.replayPlayer.currentCursor;
    this.notify();
  }

  setPlaybackRate(r: number): void {
    if (!this.replayPlayer) return;
    this.replayPlayer.setPlaybackRate(r);
    this.replayCursor = this.replayPlayer.currentCursor;
    this.notify();
  }

  setSelectedSpeciesId(id: number | null): void {
    this.speciesList.setSelectedSpeciesId(id);
    this.notify();
  }

  // -- subscription ------------------------------------------------------

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    for (const l of this.listeners) {
      try {
        l();
      } catch {
        // isolate listener errors
      }
    }
  }
}

function panelsFor(
  brainDna: BrainDna,
  cursor: InspectorReplayCursor | null,
): InspectorPanels {
  const policyKind = cursor?.policyKind ?? brainDna.topology;
  const isNeat = isNeatTopology(policyKind);
  return {
    topology: true,
    charts: true,
    activity: true,
    cppnSubstrate: policyKind === 'hyperNeat',
    lstmCell: policyKind === 'neatLstm',
    species: isNeat,
    replay: cursor !== null,
  };
}
