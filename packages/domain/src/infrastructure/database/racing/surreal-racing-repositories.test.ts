import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import type { Surreal } from 'surrealdb';
import { createDbConnection } from '../client.js';
import { SurrealDbAdapter } from '../SurrealDbAdapter.js';
import { SurrealRacingSessionRepository } from './SurrealRacingSessionRepository.js';
import { SurrealLapResultRepository } from './SurrealLapResultRepository.js';
import { SurrealRacingSetupRepository } from './SurrealRacingSetupRepository.js';
import { clampSetup, defaultSetup } from '../../../shared/racing/index.js';

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

  test('M7 SurrealRacingSetupRepository round-trips full V2 setup', async () => {
    const v2Setup = {
      ...defaultSetup(),
      springFrontNpm: 75000,
      springRearNpm: 70000,
      damperBumpFrontScale: 1.2,
      damperReboundFrontScale: 1.1,
      damperBumpRearScale: 1.3,
      damperReboundRearScale: 1.05,
      diffPowerRamp: 0.6,
      diffCoastRamp: 0.2,
      diffPreloadNm: 80,
      tirePressureFLKpa: 210,
      tirePressureFRKpa: 215,
      tirePressureRLKpa: 205,
      tirePressureRRKpa: 208,
      camberFrontDeg: -2.0,
      camberRearDeg: -1.8,
      brakeBiasFront: 0.58,
      rideHeightFrontMm: 5,
      rideHeightRearMm: -5,
      fuelLoad: 0.75,
      finalDriveScale: 1.1,
    };
    await setups.set('user-v2', v2Setup);
    const fetched = await setups.get('user-v2');
    expect(fetched).toEqual(v2Setup);
  });

  test('M7 SurrealRacingSetupRepository fills M7 defaults when reading old pre-M7 row', async () => {
    // Simulate writing a pre-M7 row by inserting only the pre-M7 fields directly.
    const legacyRow = {
      frontToeDeg: 0.3,
      rearToeDeg: -0.2,
      casterDeg: 4.0,
      ackermannPct: 0.3,
      motionRatioFront: 1.0,
      motionRatioRear: 1.0,
      bumpStopGapFrontMm: 200,
      bumpStopGapRearMm: 200,
      bumpStopRateFrontNmm: 50,
      bumpStopRateRearNmm: 50,
    };
    // We write a pre-M7 object; the repo should clamp and fill on read.
    await setups.set('user-legacy', legacyRow as Parameters<typeof setups.set>[1]);
    const fetched = await setups.get('user-legacy');
    expect(fetched).not.toBeNull();
    // Pre-M7 fields preserved
    expect(fetched!.frontToeDeg).toBeCloseTo(0.3);
    // M7 fields filled with defaults
    expect(fetched!.springFrontNpm).toBe(0);
    expect(fetched!.camberFrontDeg).toBeCloseTo(-1.5);
    expect(fetched!.brakeBiasFront).toBeCloseTo(0.565);
    expect(fetched!.fuelLoad).toBe(0);
    expect(fetched!.finalDriveScale).toBe(1.0);
    // Ensure it passes through clampSetup cleanly (idempotent)
    expect(fetched).toEqual(clampSetup(fetched));
  });
});
