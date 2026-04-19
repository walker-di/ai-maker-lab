import { describe, expect, it } from 'bun:test';

import { TrainingChartsView } from './training-charts-view.js';
import type { TrainingProgressEvent } from '../training/types.js';

function gen(generation: number, aggregateScore: number, bestScore: number): TrainingProgressEvent {
  return {
    kind: 'generationFinished',
    runId: 'run-1',
    generation,
    aggregateScore,
    eliteCheckpointRefs: [
      {
        id: `ck-${generation}`,
        brainDnaId: 'b1',
        generation,
        score: bestScore,
        createdAt: '2026-01-01',
      },
    ],
  };
}

describe('TrainingChartsView', () => {
  it('appends mean and best reward points per generationFinished', () => {
    const v = new TrainingChartsView();
    v.ingest(gen(0, 0.5, 0.6));
    v.ingest(gen(1, 0.7, 0.9));
    expect(v.getSeries('meanReward').points).toEqual([
      { x: 0, y: 0.5 },
      { x: 1, y: 0.7 },
    ]);
    expect(v.getSeries('bestReward').points).toEqual([
      { x: 0, y: 0.6 },
      { x: 1, y: 0.9 },
    ]);
  });

  it('records survivalSteps and goalRate from episodeFinished', () => {
    const v = new TrainingChartsView();
    v.ingest({
      kind: 'episodeFinished',
      runId: 'run-1',
      episode: {
        id: 'e1',
        runId: 'run-1',
        agentId: 'a1',
        bodyDnaId: 'b1',
        brainDnaId: 'br1',
        arenaId: 'arena',
        generation: 2,
        candidateIndex: 0,
        seed: 1,
        outcome: { kind: 'goalReached' },
        totalReward: 0.5,
        meanReward: 0.5,
        steps: 120,
        metricBreakdown: {
          forwardVelocity: 0,
          uprightness: 0,
          energyPenalty: 0,
          goalProgress: 0,
          survivalTime: 0,
          foodEaten: 0,
          fallPenalty: 0,
        },
      },
    });
    expect(v.getSeries('survivalSteps').points).toEqual([{ x: 2, y: 120 }]);
    expect(v.getSeries('goalRate').points).toEqual([{ x: 2, y: 1 }]);
  });

  it('records species count and innovations per generation', () => {
    const v = new TrainingChartsView();
    v.ingest({
      kind: 'speciesUpdated',
      runId: 'r',
      generation: 5,
      species: [
        { speciesId: 1, size: 3, representativeGenomeId: 'g', bestFitness: 0, meanFitness: 0, staleness: 0 },
        { speciesId: 2, size: 2, representativeGenomeId: 'g', bestFitness: 0, meanFitness: 0, staleness: 0 },
      ],
    });
    v.ingest({
      kind: 'innovationsAssigned',
      runId: 'r',
      generation: 5,
      addedConnections: [
        { innovation: 10, sourceNodeId: 0, targetNodeId: 1 },
      ],
      addedNodes: [
        { nodeId: 99, splitConnectionInnovation: 10 },
        { nodeId: 100, splitConnectionInnovation: 11 },
      ],
    });
    expect(v.getSeries('speciesCount').points).toEqual([{ x: 5, y: 2 }]);
    expect(v.getSeries('addedConnectionsPerGen').points).toEqual([{ x: 5, y: 1 }]);
    expect(v.getSeries('addedNodesPerGen').points).toEqual([{ x: 5, y: 2 }]);
  });

  it('resets all series when a new run starts', () => {
    const v = new TrainingChartsView();
    v.ingest(gen(0, 0.5, 0.6));
    v.ingest({ kind: 'runStarted', runId: 'run-2', status: 'running', startedAt: 'now' });
    expect(v.getSeries('meanReward').points).toEqual([]);
  });

  it('histogram bins values into the requested resolution', () => {
    const histo = TrainingChartsView.histogram([-1, 0, 1, 1, 0.5], 4);
    expect(histo.min).toBe(-1);
    expect(histo.max).toBe(1);
    const total = histo.bins.reduce((s, n) => s + n, 0);
    expect(total).toBe(5);
  });

  it('histogram returns zero range when all values match', () => {
    const histo = TrainingChartsView.histogram([0.3, 0.3, 0.3], 8);
    expect(histo.min).toBe(0.3);
    expect(histo.max).toBe(0.3);
    expect(histo.bins[Math.floor(8 / 2)]).toBe(3);
  });

  it('snapshot returns a deep copy of points', () => {
    const v = new TrainingChartsView();
    v.ingest(gen(0, 0.1, 0.1));
    const snap = v.snapshot();
    snap[0]!.points.push({ x: 99, y: 99 });
    expect(v.getSeries('meanReward').points).toHaveLength(1);
  });
});
