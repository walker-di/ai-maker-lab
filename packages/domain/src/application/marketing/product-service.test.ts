import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import type { Surreal } from 'surrealdb';
import type { IMarketingTextGenerationGateway } from './ports.js';
import { createDbConnection } from '../../infrastructure/database/client.js';
import { SurrealDbAdapter } from '../../infrastructure/database/SurrealDbAdapter.js';
import { SurrealPersonaRepository } from '../../infrastructure/database/marketing/SurrealPersonaRepository.js';
import { SurrealProductRepository } from '../../infrastructure/database/marketing/SurrealProductRepository.js';
import { ProductService } from './product-service.js';

const fakeAi: IMarketingTextGenerationGateway = {
  generateProductDescription: async () => 'AI description',
  generatePersonas: async () => [],
  generateCreativeText: async () => '',
  generateMarketingStrategy: async () => '',
  generateStoryboard: async () => ({ scenes: [], clips: [] }),
  generateStoryboardFrames: async () => [],
  regenerateStoryboardPrompt: async () => '',
};

describe('ProductService', () => {
  let db: Surreal;
  let productRepo: SurrealProductRepository;
  let personaRepo: SurrealPersonaRepository;
  let service: ProductService;

  beforeEach(async () => {
    db = await createDbConnection({
      host: 'mem://',
      namespace: `test_ns_${crypto.randomUUID()}`,
      database: `test_db_${crypto.randomUUID()}`,
    });

    const adapter = new SurrealDbAdapter(db);
    productRepo = new SurrealProductRepository(adapter);
    personaRepo = new SurrealPersonaRepository(adapter);
    service = new ProductService(productRepo, personaRepo, fakeAi);
  });

  afterEach(async () => {
    await db.close();
  });

  test('create returns a persisted product', async () => {
    const p = await service.create({ name: 'Widget', features: [], benefits: [] });
    expect(p.id).toBeString();
    expect(p.name).toBe('Widget');
  });

  test('list returns all products', async () => {
    await service.create({ name: 'A', features: [], benefits: [] });
    await service.create({ name: 'B', features: [], benefits: [] });
    expect((await service.list()).length).toBe(2);
  });

  test('get returns null for unknown id', async () => {
    expect(await service.get('missing')).toBeNull();
  });

  test('update changes product fields', async () => {
    const p = await service.create({ name: 'Old', features: [], benefits: [] });
    const updated = await service.update(p.id, { name: 'New' });
    expect(updated.name).toBe('New');
  });

  test('delete succeeds when no personas exist', async () => {
    const p = await service.create({ name: 'X', features: [], benefits: [] });
    await expect(service.delete(p.id)).resolves.toBeUndefined();
    expect(await service.list()).toHaveLength(0);
  });

  test('delete rejects when personas exist', async () => {
    const p = await service.create({ name: 'X', features: [], benefits: [] });
    await personaRepo.create({
      productId: p.id,
      name: 'Alice',
      ageRange: '25-34',
      gender: 'female',
    });

    await expect(service.delete(p.id)).rejects.toThrow(/persona/i);
  });

  test('generateFromName uses AI to set description', async () => {
    const p = await service.generateFromName('Gadget');
    expect(p.name).toBe('Gadget');
    expect(p.description).toBe('AI description');
  });
});
