import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import type { Surreal } from 'surrealdb';
import { createDbConnection } from '../../infrastructure/database/client.js';
import { SurrealDbAdapter } from '../../infrastructure/database/SurrealDbAdapter.js';
import { SurrealCustomerJourneyMapRepository } from '../../infrastructure/database/marketing/SurrealCustomerJourneyMapRepository.js';
import { SurrealProductRepository } from '../../infrastructure/database/marketing/SurrealProductRepository.js';
import { CustomerJourneyMapService } from './customer-journey-map-service.js';

function makeJourneyMap(productId: string, name = 'Activation journey') {
  return {
    productId,
    name,
    goals: ['Reduce setup friction'],
    status: 'draft' as const,
    tags: [],
    stages: [{ id: 'awareness', title: 'Awareness', order: 0 }],
    lanes: [{ id: 'actions', title: 'Actions', kind: 'actions' as const, order: 0 }],
    cells: [{ id: 'cell-1', stageId: 'awareness', laneId: 'actions', content: 'Finds examples' }],
    touchpoints: [],
    emotionPoints: [],
    opportunities: [],
  };
}

describe('CustomerJourneyMapService', () => {
  let db: Surreal;
  let productRepo: SurrealProductRepository;
  let journeyMapRepo: SurrealCustomerJourneyMapRepository;
  let service: CustomerJourneyMapService;

  beforeEach(async () => {
    db = await createDbConnection({
      host: 'mem://',
      namespace: `test_ns_${crypto.randomUUID()}`,
      database: `test_db_${crypto.randomUUID()}`,
    });
    const adapter = new SurrealDbAdapter(db);
    productRepo = new SurrealProductRepository(adapter);
    journeyMapRepo = new SurrealCustomerJourneyMapRepository(adapter);
    service = new CustomerJourneyMapService(journeyMapRepo, productRepo);
  });

  afterEach(async () => {
    await db.close();
  });

  test('creates a journey map for an existing product', async () => {
    const product = await productRepo.create({ name: 'Widget', features: [], benefits: [] });

    const created = await service.create(makeJourneyMap(product.id));

    expect(created.name).toBe('Activation journey');
    expect(created.productId).toBe(product.id);
  });

  test('rejects create for a missing product', async () => {
    await expect(service.create(makeJourneyMap('missing-product'))).rejects.toThrow(/Product not found/);
  });

  test('lists journey maps by product', async () => {
    const p1 = await productRepo.create({ name: 'P1', features: [], benefits: [] });
    const p2 = await productRepo.create({ name: 'P2', features: [], benefits: [] });
    await service.create(makeJourneyMap(p1.id, 'P1 journey'));
    await service.create(makeJourneyMap(p2.id, 'P2 journey'));

    const forP1 = await service.listByProduct(p1.id);

    expect(forP1).toHaveLength(1);
    expect(forP1[0]?.name).toBe('P1 journey');
  });
});
