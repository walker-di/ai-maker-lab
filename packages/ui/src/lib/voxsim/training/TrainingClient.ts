/**
 * Browser-side helper that wraps a `TrainerHandle` (typically returned by the
 * application layer's `TrainerOrchestrator` proxy) and exposes a small,
 * UI-friendly observable interface over `TrainingProgressEvent`s.
 *
 * The application layer remains the source of truth for training execution;
 * this client only relays events into a snapshot and a fan-out subscriber
 * list that Svelte (or any plain JS) consumers can subscribe to.
 */

import type {
  CheckpointRef,
  EpisodeSummary,
  NeatInnovationConnectionEntry,
  NeatInnovationNodeEntry,
  NeatSpeciesSnapshotEntry,
  TrainerHandle,
  TrainingProgressEvent,
  TrainingProgressListener,
  TrainingRunHandle,
  TrainingRunStatus,
  Unsubscribe,
} from './types.js';

export interface TrainingClientSnapshot {
  runId: string | null;
  status: TrainingRunStatus;
  startedAt: string | null;
  finishedAt: string | null;
  failureReason: string | null;
  generation: number;
  arenaId: string | null;
  episodes: EpisodeSummary[];
  bestCheckpointRef: CheckpointRef | null;
  eliteCheckpointRefs: CheckpointRef[];
  species: NeatSpeciesSnapshotEntry[];
  addedConnections: NeatInnovationConnectionEntry[];
  addedNodes: NeatInnovationNodeEntry[];
  curriculumStageIndex: number;
  aggregateScores: { generation: number; aggregateScore: number }[];
}

export interface TrainingClientOptions {
  /**
   * Maximum number of recent episodes to keep in the snapshot. The full
   * episode stream is still delivered to subscribers via
   * `subscribe`/`onEvent`; this only bounds what the snapshot retains for
   * display purposes. Defaults to 256.
   */
  episodeWindow?: number;
}

const DEFAULT_EPISODE_WINDOW = 256;

function emptySnapshot(): TrainingClientSnapshot {
  return {
    runId: null,
    status: 'idle',
    startedAt: null,
    finishedAt: null,
    failureReason: null,
    generation: 0,
    arenaId: null,
    episodes: [],
    bestCheckpointRef: null,
    eliteCheckpointRefs: [],
    species: [],
    addedConnections: [],
    addedNodes: [],
    curriculumStageIndex: 0,
    aggregateScores: [],
  };
}

export class TrainingClient {
  private snapshotState: TrainingClientSnapshot = emptySnapshot();
  private readonly listeners = new Set<TrainingProgressListener>();
  private readonly snapshotListeners = new Set<
    (snapshot: TrainingClientSnapshot) => void
  >();
  private readonly episodeWindow: number;
  private trainerUnsub: Unsubscribe | null = null;
  private boundHandle: TrainingRunHandle | null = null;
  private boundTrainer: TrainerHandle | null = null;

  constructor(options: TrainingClientOptions = {}) {
    this.episodeWindow = options.episodeWindow ?? DEFAULT_EPISODE_WINDOW;
  }

  get snapshot(): TrainingClientSnapshot {
    return this.snapshotState;
  }

  /** Bind to a running training run and start relaying events. */
  bind(trainer: TrainerHandle, handle: TrainingRunHandle): void {
    this.unbind();
    this.snapshotState = emptySnapshot();
    this.snapshotState.runId = handle.runId;
    this.boundTrainer = trainer;
    this.boundHandle = handle;
    this.trainerUnsub = trainer.subscribe(handle, (event) => {
      this.handleEvent(event);
    });
    this.notifySnapshot();
  }

  /** Stop receiving events from the underlying trainer. */
  unbind(): void {
    if (this.trainerUnsub) {
      this.trainerUnsub();
      this.trainerUnsub = null;
    }
    this.boundHandle = null;
    this.boundTrainer = null;
  }

  async pause(): Promise<void> {
    if (!this.boundTrainer || !this.boundHandle) return;
    await this.boundTrainer.pause(this.boundHandle);
  }

  async resume(): Promise<void> {
    if (!this.boundTrainer || !this.boundHandle) return;
    await this.boundTrainer.resume(this.boundHandle);
  }

  async stop(): Promise<void> {
    if (!this.boundTrainer || !this.boundHandle) return;
    await this.boundTrainer.stop(this.boundHandle);
  }

  /** Subscribe to raw progress events. */
  onEvent(listener: TrainingProgressListener): Unsubscribe {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Subscribe to coarse snapshot updates. */
  onSnapshot(
    listener: (snapshot: TrainingClientSnapshot) => void,
  ): Unsubscribe {
    this.snapshotListeners.add(listener);
    listener(this.snapshotState);
    return () => {
      this.snapshotListeners.delete(listener);
    };
  }

  /**
   * Synthesize and dispatch a `TrainingProgressEvent` from outside the
   * trainer (used by tests or by app-layer code that already buffered the
   * event). Most consumers should prefer `bind` and let events flow through
   * the trainer subscription.
   */
  ingest(event: TrainingProgressEvent): void {
    this.handleEvent(event);
  }

  private handleEvent(event: TrainingProgressEvent): void {
    this.applyToSnapshot(event);
    for (const l of this.listeners) {
      try {
        l(event);
      } catch {
        // listener errors are isolated; intentional
      }
    }
    this.notifySnapshot();
  }

  private applyToSnapshot(event: TrainingProgressEvent): void {
    const next: TrainingClientSnapshot = { ...this.snapshotState };
    switch (event.kind) {
      case 'runStarted':
        next.runId = event.runId;
        next.status = event.status;
        next.startedAt = event.startedAt;
        next.finishedAt = null;
        next.failureReason = null;
        next.episodes = [];
        next.aggregateScores = [];
        next.species = [];
        next.addedConnections = [];
        next.addedNodes = [];
        next.curriculumStageIndex = 0;
        break;
      case 'generationStarted':
        next.generation = event.generation;
        next.arenaId = event.arenaId;
        next.status = 'running';
        break;
      case 'episodeFinished': {
        const merged = next.episodes.concat(event.episode);
        next.episodes =
          merged.length > this.episodeWindow
            ? merged.slice(merged.length - this.episodeWindow)
            : merged;
        break;
      }
      case 'generationFinished':
        next.eliteCheckpointRefs = event.eliteCheckpointRefs;
        next.aggregateScores = next.aggregateScores.concat({
          generation: event.generation,
          aggregateScore: event.aggregateScore,
        });
        break;
      case 'curriculumAdvanced':
        next.curriculumStageIndex = event.toStageIndex;
        break;
      case 'runFinished':
        next.status = event.status;
        next.finishedAt = event.finishedAt;
        next.bestCheckpointRef = event.bestCheckpointRef;
        break;
      case 'runFailed':
        next.status = event.status;
        next.failureReason = event.reason;
        break;
      case 'speciesUpdated':
        next.species = event.species;
        break;
      case 'innovationsAssigned':
        next.addedConnections = event.addedConnections;
        next.addedNodes = event.addedNodes;
        break;
      default: {
        const _exhaustive: never = event;
        void _exhaustive;
      }
    }
    this.snapshotState = next;
  }

  private notifySnapshot(): void {
    for (const l of this.snapshotListeners) {
      try {
        l(this.snapshotState);
      } catch {
        // isolate listener errors
      }
    }
  }
}
