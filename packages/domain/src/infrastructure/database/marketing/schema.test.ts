import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import type { Surreal } from 'surrealdb';
import { createDbConnection } from '../client.js';
import { SurrealDbAdapter } from '../SurrealDbAdapter.js';
import { ensureMarketingSchema } from './schema.js';

function expectSerializedToContain(value: unknown, expected: string): void {
  expect(JSON.stringify(value)).toContain(expected);
}

describe('marketing SurrealDB schema', () => {
  let db: Surreal;
  let adapter: SurrealDbAdapter;

  beforeEach(async () => {
    db = await createDbConnection({
      host: 'mem://',
      namespace: `test_ns_${crypto.randomUUID()}`,
      database: `test_db_${crypto.randomUUID()}`,
    });
    adapter = new SurrealDbAdapter(db);
    await ensureMarketingSchema(adapter);
  });

  afterEach(async () => {
    await db.close();
  });

  test('defines SCHEMAFULL Product table and rejects unknown fields', async () => {
    await expect(
      adapter.query(`CREATE marketing_product CONTENT $data;`, {
        data: {
          name: 'Widget',
          features: [],
          benefits: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          unexpected: 'schema drift',
        },
      }),
    ).rejects.toThrow(/unexpected|schemafull|field/i);
  });

  test('enforces scalar Product field types', async () => {
    await expect(
      adapter.query(`CREATE marketing_product CONTENT $data;`, {
        data: {
          name: 'Widget',
          features: 'not-an-array',
          benefits: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      }),
    ).rejects.toThrow(/features|array|string|expected/i);
  });

  test('enforces Persona reference field type without graph edges', async () => {
    await expect(
      adapter.query(`CREATE marketing_persona CONTENT $data;`, {
        data: {
          productId: 123,
          name: 'Alice',
          ageRange: '25-34',
          gender: 'female',
          interests: [],
          painPoints: [],
          motivations: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      }),
    ).rejects.toThrow(/productId|string|expected/i);
  });

  test('enforces Customer Journey Map reference field types', async () => {
    await expect(
      adapter.query(`CREATE marketing_customer_journey_map CONTENT $data;`, {
        data: {
          productId: 'product-1',
          personaId: 42,
          name: 'Activation journey',
          goals: [],
          status: 'draft',
          tags: [],
          stages: [],
          lanes: [],
          cells: [],
          touchpoints: [],
          emotionPoints: [],
          opportunities: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      }),
    ).rejects.toThrow(/personaId|string|expected/i);
  });

  test('upgrades an auto-created schemaless marketing table to SCHEMAFULL', async () => {
    const legacyDb = await createDbConnection({
      host: 'mem://',
      namespace: `test_ns_${crypto.randomUUID()}`,
      database: `test_db_${crypto.randomUUID()}`,
    });
    const legacyAdapter = new SurrealDbAdapter(legacyDb);
    try {
      await legacyAdapter.query(`CREATE marketing_product CONTENT { name: 'Legacy', extra: 'old' };`);
      await ensureMarketingSchema(legacyAdapter);

      await expect(
        legacyAdapter.query(`CREATE marketing_product CONTENT $data;`, {
          data: {
            name: 'Widget',
            features: [],
            benefits: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            extra: 'new schema drift',
          },
        }),
      ).rejects.toThrow(/extra|schemafull|field/i);
    } finally {
      await legacyDb.close();
    }
  });

  test('defines indexes for product-scoped sorted query paths', async () => {
    const productInfo = await adapter.query(`INFO FOR TABLE marketing_product;`);
    const personaInfo = await adapter.query(`INFO FOR TABLE marketing_persona;`);
    const journeyInfo = await adapter.query(`INFO FOR TABLE marketing_customer_journey_map;`);

    expectSerializedToContain(productInfo, 'idx_marketing_product_created');
    expectSerializedToContain(personaInfo, 'idx_marketing_persona_product_created');
    expectSerializedToContain(journeyInfo, 'idx_marketing_customer_journey_map_product_created');
    expectSerializedToContain(journeyInfo, 'idx_marketing_customer_journey_map_persona');
    expectSerializedToContain(journeyInfo, 'idx_marketing_customer_journey_map_campaign');
    expectSerializedToContain(journeyInfo, 'idx_marketing_customer_journey_map_creative');
  });
});
