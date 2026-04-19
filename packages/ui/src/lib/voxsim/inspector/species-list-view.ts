/**
 * Sparkline aggregator for the NEAT species panel. Accumulates per-species
 * best-score history from successive `speciesUpdated` events so the row
 * sparkline can render without re-querying the trainer.
 */

import type {
  NeatSpeciesSnapshotEntry,
  TrainingProgressEvent,
} from '../training/types.js';
import type { InspectorSpeciesEntry, InspectorSpeciesSnapshot } from './types.js';
import { speciesColor } from './species-palette.js';

export interface SpeciesSparkline {
  speciesId: number;
  points: { generation: number; bestScore: number }[];
}

export interface SpeciesListRow extends InspectorSpeciesEntry {
  sparkline: SpeciesSparkline;
  stagnant: boolean;
}

export interface SpeciesListViewOptions {
  /** Generations of stagnation that mark a species "stale". */
  stagnationCutoffGenerations?: number;
}

export class SpeciesListView {
  private readonly stagnationCutoff: number;
  private snapshot: InspectorSpeciesSnapshot | null = null;
  private readonly sparklines = new Map<number, SpeciesSparkline>();
  private selectedSpeciesId: number | null = null;

  constructor(options: SpeciesListViewOptions = {}) {
    this.stagnationCutoff = options.stagnationCutoffGenerations ?? 15;
  }

  ingest(event: TrainingProgressEvent): void {
    if (event.kind !== 'speciesUpdated') return;
    this.snapshot = {
      runId: event.runId,
      generation: event.generation,
      species: event.species.map((s: NeatSpeciesSnapshotEntry) =>
        toEntry(event.runId, s),
      ),
    };
    for (const s of event.species) {
      let line = this.sparklines.get(s.speciesId);
      if (!line) {
        line = { speciesId: s.speciesId, points: [] };
        this.sparklines.set(s.speciesId, line);
      }
      line.points.push({
        generation: event.generation,
        bestScore: s.bestFitness,
      });
    }
  }

  setSelectedSpeciesId(id: number | null): void {
    this.selectedSpeciesId = id;
  }

  get selectedId(): number | null {
    return this.selectedSpeciesId;
  }

  get currentSnapshot(): InspectorSpeciesSnapshot | null {
    return this.snapshot;
  }

  rows(): SpeciesListRow[] {
    if (!this.snapshot) return [];
    return this.snapshot.species.map((entry) => ({
      ...entry,
      sparkline:
        this.sparklines.get(entry.id) ?? { speciesId: entry.id, points: [] },
      stagnant: entry.stagnation >= this.stagnationCutoff - 1,
    }));
  }
}

function toEntry(
  runId: string,
  s: NeatSpeciesSnapshotEntry,
): InspectorSpeciesEntry {
  return {
    id: s.speciesId,
    size: s.size,
    bestScore: s.bestFitness,
    meanScore: s.meanFitness,
    stagnation: s.staleness,
    representativeGenomeId: s.representativeGenomeId,
    color: speciesColor(runId, s.speciesId),
  };
}
