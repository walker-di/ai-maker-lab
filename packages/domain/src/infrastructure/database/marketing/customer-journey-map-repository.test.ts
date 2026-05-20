import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import type { Surreal } from 'surrealdb';
import { createDbConnection } from '../client.js';
import { SurrealDbAdapter } from '../SurrealDbAdapter.js';
import { assertNoRecordIdLeaks } from '../test-helpers/assertNoRecordIdLeaks.js';
import { SurrealCustomerJourneyMapRepository } from './SurrealCustomerJourneyMapRepository.js';
import { SurrealProductRepository } from './SurrealProductRepository.js';

function makeJourneyMap(productId: string, name = 'Activation journey') {
  return {
    productId,
    name,
    scenario: 'A growth lead evaluates an AI research workspace.',
    goals: ['Reduce setup friction'],
    status: 'draft' as const,
    tags: [],
    stages: [{ id: 'awareness', title: 'Awareness', order: 0 }],
    lanes: [{ id: 'actions', title: 'Actions', kind: 'actions' as const, order: 0 }],
    cells: [
      {
        id: 'cell-1',
        stageId: 'awareness',
        laneId: 'actions',
        content: 'Finds peer examples',
      },
    ],
    touchpoints: [{ id: 'touch-1', stageId: 'awareness', label: 'LinkedIn', order: 0 }],
    emotionPoints: [{ id: 'emotion-1', stageId: 'awareness', label: 'Curious', score: 58, order: 0 }],
    opportunities: [{ id: 'opp-1', stageId: 'awareness', title: 'Show before/after examples' }],
  };
}

describe('SurrealCustomerJourneyMapRepository', () => {
  let db: Surreal;
  let productRepo: SurrealProductRepository;
  let journeyMapRepo: SurrealCustomerJourneyMapRepository;

  beforeEach(async () => {
    db = await createDbConnection({
      host: 'mem://',
      namespace: `test_ns_${crypto.randomUUID()}`,
      database: `test_db_${crypto.randomUUID()}`,
    });
    const adapter = new SurrealDbAdapter(db);
    productRepo = new SurrealProductRepository(adapter);
    journeyMapRepo = new SurrealCustomerJourneyMapRepository(adapter);
  });

  afterEach(async () => {
    await db.close();
  });

  test('create and findByProductId', async () => {
    const product = await productRepo.create({ name: 'Widget', features: [], benefits: [] });
    const created = await journeyMapRepo.create(makeJourneyMap(product.id));
    assertNoRecordIdLeaks(created);

    expect(created.id).toBeString();
    expect(created.productId).toBe(product.id);
    expect(created.status).toBe('draft');
    expect(created.stages).toHaveLength(1);

    const list = await journeyMapRepo.findByProductId(product.id);
    assertNoRecordIdLeaks(list);
    expect(list).toHaveLength(1);
    expect(list[0]?.name).toBe('Activation journey');
  });

  test('findByProductId excludes other products', async () => {
    const p1 = await productRepo.create({ name: 'P1', features: [], benefits: [] });
    const p2 = await productRepo.create({ name: 'P2', features: [], benefits: [] });

    const p1Map = await journeyMapRepo.create(makeJourneyMap(p1.id, 'P1 journey'));
    await journeyMapRepo.create(makeJourneyMap(p2.id, 'P2 journey'));

    const forP1 = await journeyMapRepo.findByProductId(p1.id);
    assertNoRecordIdLeaks(forP1);
    expect(forP1).toHaveLength(1);
    expect(forP1[0]?.id).toBe(p1Map.id);
  });

  test('findById returns null on fresh database', async () => {
    const found = await journeyMapRepo.findById('marketing_customer_journey_map:unknown');
    assertNoRecordIdLeaks(found);
    expect(found).toBeNull();
  });

  test('findAll returns empty array on fresh database', async () => {
    const all = await journeyMapRepo.findAll();
    assertNoRecordIdLeaks(all);
    expect(all).toEqual([]);
  });

  test('update preserves untouched fields', async () => {
    const product = await productRepo.create({ name: 'Widget', features: [], benefits: [] });
    const created = await journeyMapRepo.create(makeJourneyMap(product.id));

    const updated = await journeyMapRepo.update(created.id, { name: 'Updated journey' });
    assertNoRecordIdLeaks(updated);
    expect(updated.name).toBe('Updated journey');
    expect(updated.productId).toBe(product.id);
    expect(updated.stages).toEqual(created.stages);
    expect(updated.createdAt).toBe(created.createdAt);
  });

  test('delete removes journey map', async () => {
    const product = await productRepo.create({ name: 'Widget', features: [], benefits: [] });
    const created = await journeyMapRepo.create(makeJourneyMap(product.id));

    await journeyMapRepo.delete(created.id);

    expect(await journeyMapRepo.findById(created.id)).toBeNull();
  });
});
