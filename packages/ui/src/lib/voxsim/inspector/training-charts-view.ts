/**
 * Aggregates `TrainingProgressEvent`s into `InspectorChartSeries` arrays
 * keyed by metric. The `tfjs-vis` rendering layer (mounted by the panel
 * component) consumes these series; this view-model has no DOM dependency
 * so it tests cleanly.
 */

import type {
  TrainingProgressEvent,
} from '../training/types.js';
import type {
  InspectorChartSeries,
  InspectorChartPoint,
} from './types.js';

export type TrainingMetricId =
  | 'meanReward'
  | 'bestReward'
  | 'survivalSteps'
  | 'goalRate'
  | 'actorLoss'
  | 'criticLoss'
  | 'speciesCount'
  | 'meanGenomeSize'
  | 'addedConnectionsPerGen'
  | 'addedNodesPerGen';

const METRIC_LABELS: Record<TrainingMetricId, string> = {
  meanReward: 'Mean reward',
  bestReward: 'Best reward',
  survivalSteps: 'Survival steps',
  goalRate: 'Goal rate',
  actorLoss: 'Actor loss',
  criticLoss: 'Critic loss',
  speciesCount: 'Species count',
  meanGenomeSize: 'Mean genome size',
  addedConnectionsPerGen: 'Added connections / gen',
  addedNodesPerGen: 'Added nodes / gen',
};

export class TrainingChartsView {
  private readonly series: Map<TrainingMetricId, InspectorChartSeries>;

  constructor() {
    this.series = new Map();
    for (const id of Object.keys(METRIC_LABELS) as TrainingMetricId[]) {
      this.series.set(id, {
        id,
        label: METRIC_LABELS[id],
        points: [],
      });
    }
  }

  /** Snapshot current series for rendering. */
  snapshot(): InspectorChartSeries[] {
    return Array.from(this.series.values()).map((s) => ({
      ...s,
      points: s.points.slice(),
    }));
  }

  getSeries(id: TrainingMetricId): InspectorChartSeries {
    const s = this.series.get(id);
    if (!s) throw new Error(`unknown metric '${id}'`);
    return s;
  }

  /** Reset all series. Called when a new run starts. */
  reset(): void {
    for (const s of this.series.values()) s.points = [];
  }

  ingest(event: TrainingProgressEvent): void {
    switch (event.kind) {
      case 'runStarted':
        this.reset();
        break;
      case 'generationFinished': {
        const x = event.generation;
        this.appendPoint('meanReward', { x, y: event.aggregateScore });
        const bestRef = event.eliteCheckpointRefs[0];
        if (bestRef) {
          this.appendPoint('bestReward', { x, y: bestRef.score });
        }
        break;
      }
      case 'episodeFinished': {
        const x = event.episode.generation;
        this.appendPoint('survivalSteps', { x, y: event.episode.steps });
        if (event.episode.outcome.kind === 'goalReached') {
          this.appendPoint('goalRate', { x, y: 1 });
        }
        break;
      }
      case 'speciesUpdated': {
        const x = event.generation;
        this.appendPoint('speciesCount', {
          x,
          y: event.species.length,
        });
        break;
      }
      case 'innovationsAssigned': {
        const x = event.generation;
        this.appendPoint('addedConnectionsPerGen', {
          x,
          y: event.addedConnections.length,
        });
        this.appendPoint('addedNodesPerGen', {
          x,
          y: event.addedNodes.length,
        });
        break;
      }
      default:
        break;
    }
  }

  /** Compute a histogram of weights for the weight-distribution panel. */
  static histogram(
    values: ArrayLike<number>,
    binCount = 32,
  ): { bins: number[]; min: number; max: number } {
    const bins = new Array<number>(binCount).fill(0);
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    for (let i = 0; i < values.length; i++) {
      const v = values[i] ?? 0;
      if (v < min) min = v;
      if (v > max) max = v;
    }
    if (!Number.isFinite(min) || !Number.isFinite(max) || values.length === 0) {
      return { bins, min: 0, max: 0 };
    }
    if (min === max) {
      bins[Math.floor(binCount / 2)] = values.length;
      return { bins, min, max };
    }
    const span = max - min;
    for (let i = 0; i < values.length; i++) {
      const v = values[i] ?? 0;
      let idx = Math.floor(((v - min) / span) * binCount);
      if (idx >= binCount) idx = binCount - 1;
      if (idx < 0) idx = 0;
      bins[idx] = (bins[idx] ?? 0) + 1;
    }
    return { bins, min, max };
  }

  private appendPoint(id: TrainingMetricId, point: InspectorChartPoint): void {
    const s = this.series.get(id);
    if (!s) return;
    s.points.push(point);
  }
}
