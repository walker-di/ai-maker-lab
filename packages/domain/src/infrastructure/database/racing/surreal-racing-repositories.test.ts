import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import type { Surreal } from 'surrealdb';
import { createDbConnection } from '../client.js';
import { SurrealDbAdapter } from '../SurrealDbAdapter.js';
import { SurrealRacingSessionRepository } from './SurrealRacingSessionRepository.js';
import { SurrealLapResultRepository } from './SurrealLapResultRepository.js';
import { SurrealRacingSetupRepository } from './SurrealRacingSetupRepository.js';
import { defaultSetup } from '../../../shared/racing/index.js';

describe('Racing Surreal repositories', () => {
  let db: Surreal;
  let sessions: SurrealRacingSessionRepository;
  let laps: SurrealLapResultRepository;
  let setups: SurrealRacingSetupRepository;

  beforeEach(async () => {
    db = await createDbConnection({
      host: 'mem://',
      namespace: `racing_ns_${crypto.randomUUID()}`,
      database: `racing_db_${crypto.randomUUID()}`,
    });
    const adapter = new SurrealDbAdapter(db);
    sessions = new SurrealRacingSessionRepository(adapter);
    laps = new SurrealLapResultRepository(adapter);
    setups = new SurrealRacingSetupRepository(adapter);
  });

  afterEach(async () => {
    await db.close();
  });

  test('SurrealRacingSessionRepository roundtrips a session', async () => {
    const created = await sessions.create({
      id: 'sess-1',
      trackId: 'classic-twist',
      vehicleId: 'rwd-front-mid',
      startedAt: '2026-05-01T00:00:00.000Z',
    });
    expect(created.id).toBe('sess-1');
    const found = await sessions.findById('sess-1');
    expect(found?.trackId).toBe('classic-twist');
  });

  test('SurrealRacingSessionRepository returns null for missing tables', async () => {
    expect(await sessions.findById('does-not-exist')).toBeNull();
  });

  test('SurrealLapResultRepository records and retrieves best lap', async () => {
    await laps.record({
      id: 'lap-1',
      sessionId: 'sess-1',
      trackId: 'classic-twist',
      vehicleId: 'rwd-front-mid',
      lapMs: 92500,
      sectors: [{ index: 0, ms: 31000 }],
      finishedAt: '2026-05-01T00:01:30.000Z',
    });
    await laps.record({
      id: 'lap-2',
      sessionId: 'sess-1',
      trackId: 'classic-twist',
      vehicleId: 'rwd-front-mid',
      lapMs: 90100,
      sectors: [],
      finishedAt: '2026-05-01T00:03:00.000Z',
    });
    const best = await laps.bestFor({ trackId: 'classic-twist', vehicleId: 'rwd-front-mid' });
    expect(best?.lapMs).toBe(90100);
  });

  test('SurrealLapResultRepository returns empty list for missing tables', async () => {
    expect(await laps.list()).toEqual([]);
    expect(await laps.bestFor({ trackId: 'never-raced', vehicleId: 'never-raced' })).toBeNull();
  });

  test('SurrealRacingSetupRepository persists clamped setup values', async () => {
    const setup = defaultSetup();
    await setups.set('user-1', setup);
    const fetched = await setups.get('user-1');
    expect(fetched).toEqual(setup);
  });

  test('SurrealRacingSetupRepository returns null for missing user', async () => {
    expect(await setups.get('unknown-user')).toBeNull();
  });
});
