import { describe, expect, it } from 'bun:test';

import { TrainingClient } from './TrainingClient.js';
import type {
  EpisodeSummary,
  TrainerHandle,
  TrainingProgressEvent,
  TrainingProgressListener,
  TrainingRunHandle,
  Unsubscribe,
} from './types.js';

function makeEpisode(
  runId: string,
  generation: number,
  candidateIndex: number,
): EpisodeSummary {
  return {
    id: `${runId}-g${generation}-c${candidateIndex}`,
    runId,
    agentId: 'agent',
    bodyDnaId: 'body-1',
    brainDnaId: 'brain-1',
    arenaId: 'arena-1',
    generation,
    candidateIndex,
    seed: 42,
    outcome: { kind: 'survived' },
    totalReward: candidateIndex,
    meanReward: candidateIndex,
    steps: 100,
    metricBreakdown: {
      forwardVelocity: candidateIndex,
      uprightness: 0,
      energyPenalty: 0,
      goalProgress: 0,
      survivalTime: 0,
      foodEaten: 0,
      fallPenalty: 0,
    },
  };
}

class FakeTrainer implements TrainerHandle {
  private listener: TrainingProgressListener | null = null;
  paused = 0;
  resumed = 0;
  stopped = 0;

  emit(event: TrainingProgressEvent): void {
    this.listener?.(event);
  }

  subscribe(_handle: TrainingRunHandle, listener: TrainingProgressListener): Unsubscribe {
    this.listener = listener;
    return () => {
      this.listener = null;
    };
  }

  async pause(): Promise<void> {
    this.paused++;
  }

  async resume(): Promise<void> {
    this.resumed++;
  }

  async stop(): Promise<void> {
    this.stopped++;
  }
}

describe('TrainingClient', () => {
  it('relays bound trainer events into snapshot updates and raw event subscribers', () => {
    const client = new TrainingClient();
    const trainer = new FakeTrainer();
    const handle: TrainingRunHandle = { runId: 'run-1' };

    const events: TrainingProgressEvent[] = [];
    client.onEvent((e) => events.push(e));

    client.bind(trainer, handle);

    trainer.emit({
      kind: 'runStarted',
      runId: 'run-1',
      status: 'running',
      startedAt: '2026-01-01T00:00:00Z',
    });
    expect(client.snapshot.runId).toBe('run-1');
    expect(client.snapshot.status).toBe('running');
    expect(client.snapshot.startedAt).toBe('2026-01-01T00:00:00Z');

    trainer.emit({
      kind: 'generationStarted',
      runId: 'run-1',
      generation: 0,
      arenaId: 'arena-1',
    });
    expect(client.snapshot.generation).toBe(0);
    expect(client.snapshot.arenaId).toBe('arena-1');

    trainer.emit({
      kind: 'episodeFinished',
      runId: 'run-1',
      episode: makeEpisode('run-1', 0, 0),
    });
    trainer.emit({
      kind: 'episodeFinished',
      runId: 'run-1',
      episode: makeEpisode('run-1', 0, 1),
    });
    expect(client.snapshot.episodes).toHaveLength(2);

    trainer.emit({
      kind: 'generationFinished',
      runId: 'run-1',
      generation: 0,
      aggregateScore: 0.42,
      eliteCheckpointRefs: [
        {
          id: 'ckpt-1',
          brainDnaId: 'brain-1',
          generation: 0,
          score: 1,
          createdAt: '2026-01-01T00:00:01Z',
        },
      ],
    });
    expect(client.snapshot.aggregateScores).toEqual([
      { generation: 0, aggregateScore: 0.42 },
    ]);
    expect(client.snapshot.eliteCheckpointRefs).toHaveLength(1);

    trainer.emit({
      kind: 'speciesUpdated',
      runId: 'run-1',
      generation: 0,
      species: [
        {
          speciesId: 1,
          size: 5,
          representativeGenomeId: 'g-rep',
          bestFitness: 1,
          meanFitness: 0.5,
          staleness: 0,
        },
      ],
    });
    expect(client.snapshot.species).toHaveLength(1);

    trainer.emit({
      kind: 'innovationsAssigned',
      runId: 'run-1',
      generation: 0,
      addedConnections: [{ innovation: 1, sourceNodeId: 0, targetNodeId: 1 }],
      addedNodes: [{ nodeId: 99, splitConnectionInnovation: 1 }],
    });
    expect(client.snapshot.addedConnections).toHaveLength(1);
    expect(client.snapshot.addedNodes).toHaveLength(1);

    trainer.emit({
      kind: 'curriculumAdvanced',
      runId: 'run-1',
      fromStageIndex: 0,
      toStageIndex: 1,
    });
    expect(client.snapshot.curriculumStageIndex).toBe(1);

    trainer.emit({
      kind: 'runFinished',
      runId: 'run-1',
      status: 'completed',
      finishedAt: '2026-01-01T00:00:10Z',
      bestCheckpointRef: {
        id: 'ckpt-best',
        brainDnaId: 'brain-1',
        generation: 0,
        score: 2,
        createdAt: '2026-01-01T00:00:09Z',
      },
    });
    expect(client.snapshot.status).toBe('completed');
    expect(client.snapshot.bestCheckpointRef?.id).toBe('ckpt-best');

    expect(events.map((e) => e.kind)).toEqual([
      'runStarted',
      'generationStarted',
      'episodeFinished',
      'episodeFinished',
      'generationFinished',
      'speciesUpdated',
      'innovationsAssigned',
      'curriculumAdvanced',
      'runFinished',
    ]);
  });

  it('caps the episode window in the snapshot', () => {
    const client = new TrainingClient({ episodeWindow: 3 });
    const trainer = new FakeTrainer();
    client.bind(trainer, { runId: 'run-2' });
    trainer.emit({
      kind: 'runStarted',
      runId: 'run-2',
      status: 'running',
      startedAt: 'x',
    });
    for (let i = 0; i < 10; i++) {
      trainer.emit({
        kind: 'episodeFinished',
        runId: 'run-2',
        episode: makeEpisode('run-2', 0, i),
      });
    }
    expect(client.snapshot.episodes).toHaveLength(3);
    expect(client.snapshot.episodes[0]?.candidateIndex).toBe(7);
    expect(client.snapshot.episodes[2]?.candidateIndex).toBe(9);
  });

  it('forwards pause/resume/stop and unbinds cleanly', async () => {
    const client = new TrainingClient();
    const trainer = new FakeTrainer();
    const handle: TrainingRunHandle = { runId: 'run-3' };
    client.bind(trainer, handle);
    await client.pause();
    await client.resume();
    await client.stop();
    expect(trainer.paused).toBe(1);
    expect(trainer.resumed).toBe(1);
    expect(trainer.stopped).toBe(1);
    client.unbind();
    trainer.emit({
      kind: 'runStarted',
      runId: 'run-3',
      status: 'running',
      startedAt: 'x',
    });
    expect(client.snapshot.startedAt).toBeNull();
  });

  it('snapshot listener gets the current snapshot immediately and on each update', () => {
    const client = new TrainingClient();
    const trainer = new FakeTrainer();
    client.bind(trainer, { runId: 'run-4' });
    const seen: number[] = [];
    const unsub = client.onSnapshot((snap) => seen.push(snap.episodes.length));
    expect(seen).toEqual([0]);
    trainer.emit({
      kind: 'episodeFinished',
      runId: 'run-4',
      episode: makeEpisode('run-4', 0, 0),
    });
    expect(seen).toEqual([0, 1]);
    unsub();
    trainer.emit({
      kind: 'episodeFinished',
      runId: 'run-4',
      episode: makeEpisode('run-4', 0, 1),
    });
    expect(seen).toEqual([0, 1]);
  });
});
