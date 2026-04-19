import { describe, expect, it } from 'bun:test';

import { SpeciesListView } from './species-list-view.js';
import type {
  NeatSpeciesSnapshotEntry,
  TrainingProgressEvent,
} from '../training/types.js';

function speciesEntry(speciesId: number, bestFitness: number, staleness = 0): NeatSpeciesSnapshotEntry {
  return {
    speciesId,
    size: 5,
    representativeGenomeId: `g-${speciesId}`,
    bestFitness,
    meanFitness: bestFitness * 0.5,
    staleness,
  };
}

function speciesUpdated(
  generation: number,
  species: NeatSpeciesSnapshotEntry[],
): TrainingProgressEvent {
  return {
    kind: 'speciesUpdated',
    runId: 'run-1',
    generation,
    species,
  };
}

describe('SpeciesListView', () => {
  it('builds rows with deterministic colors and sparkline data', () => {
    const v = new SpeciesListView();
    v.ingest(speciesUpdated(0, [speciesEntry(1, 0.5)]));
    v.ingest(speciesUpdated(1, [speciesEntry(1, 0.7), speciesEntry(2, 0.2)]));
    const rows = v.rows();
    expect(rows.map((r) => r.id)).toEqual([1, 2]);
    expect(rows[0]!.sparkline.points).toEqual([
      { generation: 0, bestScore: 0.5 },
      { generation: 1, bestScore: 0.7 },
    ]);
    expect(rows[0]!.color.startsWith('hsl(')).toBe(true);
    expect(rows[1]!.sparkline.points).toEqual([{ generation: 1, bestScore: 0.2 }]);
  });

  it('marks species stagnant once staleness reaches cutoff - 1', () => {
    const v = new SpeciesListView({ stagnationCutoffGenerations: 5 });
    v.ingest(speciesUpdated(0, [speciesEntry(1, 0.4, 4)]));
    expect(v.rows()[0]!.stagnant).toBe(true);
    const v2 = new SpeciesListView({ stagnationCutoffGenerations: 5 });
    v2.ingest(speciesUpdated(0, [speciesEntry(1, 0.4, 3)]));
    expect(v2.rows()[0]!.stagnant).toBe(false);
  });

  it('ignores non-species events', () => {
    const v = new SpeciesListView();
    v.ingest({ kind: 'runStarted', runId: 'r', status: 'running', startedAt: 'now' });
    expect(v.rows()).toEqual([]);
  });

  it('persists selected species id between renders', () => {
    const v = new SpeciesListView();
    v.setSelectedSpeciesId(7);
    expect(v.selectedId).toBe(7);
    v.setSelectedSpeciesId(null);
    expect(v.selectedId).toBeNull();
  });
});
