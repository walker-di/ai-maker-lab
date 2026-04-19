import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import type { Surreal } from 'surrealdb';
import { createDbConnection } from '../client.js';
import { SurrealDbAdapter } from '../SurrealDbAdapter.js';
import { SurrealPlayerProgressRepository } from './SurrealPlayerProgressRepository.js';

describe('SurrealPlayerProgressRepository', () => {
  let db: Surreal;
  let repo: SurrealPlayerProgressRepository;

  beforeEach(async () => {
    db = await createDbConnection({
      host: 'mem://',
      namespace: `test_ns_${crypto.randomUUID()}`,
      database: `test_db_${crypto.randomUUID()}`,
    });
    repo = new SurrealPlayerProgressRepository(new SurrealDbAdapter(db));
  });

  afterEach(async () => { await db.close(); });

  test('returns null when the player has no recorded progress', async () => {
    expect(await repo.load('p1')).toBeNull();
  });

  test('save persists the latest profile and history snapshot', async () => {
    await repo.save({
      playerId: 'p1',
      profile: { lives: 3, score: 200, coins: 5, power: 'small' },
      history: [{
        worldId: 'w', levelId: 'l1', outcome: 'completed',
        score: 200, coins: 5, timeMs: 1234, completedAt: '2025-01-01T00:00:00Z',
      }],
    });
    const stored = await repo.load('p1');
    expect(stored?.profile.score).toBe(200);
    expect(stored?.history).toHaveLength(1);
  });
});
