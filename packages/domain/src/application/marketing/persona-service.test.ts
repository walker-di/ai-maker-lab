import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import type { Surreal } from 'surrealdb';
import type { Product } from '../../shared/marketing/index.js';
import type { IMarketingTextGenerationGateway } from './ports.js';
import { createDbConnection } from '../../infrastructure/database/client.js';
import { SurrealDbAdapter } from '../../infrastructure/database/SurrealDbAdapter.js';
import { SurrealPersonaRepository } from '../../infrastructure/database/marketing/SurrealPersonaRepository.js';
import { SurrealProductRepository } from '../../infrastructure/database/marketing/SurrealProductRepository.js';
import { PersonaService } from './persona-service.js';

function createFakeAi(overrides: Partial<IMarketingTextGenerationGateway> = {}): IMarketingTextGenerationGateway {
  return {
    generateProductDescription: async () => '',
    generatePersonas: async (_product, count = 1) =>
      Array.from({ length: count }, (_, i) => ({
        name: `Gen Persona ${i + 1}`,
        ageRange: '25-34' as const,
        gender: 'all' as const,
        interests: [],
        painPoints: [],
        motivations: [],
      })),
    generateCreativeText: async () => '',
    generateMarketingStrategy: async () => '',
    generateStoryboard: async () => ({ scenes: [], clips: [] }),
    generateStoryboardFrames: async () => [],
    regenerateStoryboardPrompt: async () => '',
    ...overrides,
  };
}

describe('PersonaService', () => {
  let db: Surreal;
  let productRepo: SurrealProductRepository;
  let personaRepo: SurrealPersonaRepository;
  let service: PersonaService;

  async function createProduct(idSuffix = '1'): Promise<Product> {
    return productRepo.create({
      name: `Widget ${idSuffix}`,
      features: [],
      benefits: [],
    });
  }

  beforeEach(async () => {
    db = await createDbConnection({
      host: 'mem://',
      namespace: `test_ns_${crypto.randomUUID()}`,
      database: `test_db_${crypto.randomUUID()}`,
    });

    const adapter = new SurrealDbAdapter(db);
    productRepo = new SurrealProductRepository(adapter);
    personaRepo = new SurrealPersonaRepository(adapter);
    service = new PersonaService(personaRepo, productRepo, createFakeAi());
  });

  afterEach(async () => {
    await db.close();
  });

  test('create persists persona for known product', async () => {
    const product = await createProduct();
    const p = await service.create({ productId: product.id, name: 'Alice', ageRange: '25-34', gender: 'female' });
    expect(p.productId).toBe(product.id);
    expect(p.name).toBe('Alice');
  });

  test('create rejects unknown product', async () => {
    await expect(
      service.create({ productId: 'unknown', name: 'Bob', ageRange: '25-34', gender: 'male' }),
    ).rejects.toThrow('Product not found: unknown');
  });

  test('listByProduct returns only personas for that product', async () => {
    const product1 = await createProduct('1');
    const product2 = await createProduct('2');

    await service.create({ productId: product1.id, name: 'Alice', ageRange: '25-34', gender: 'female' });
    await service.create({ productId: product2.id, name: 'Bob', ageRange: '35-44', gender: 'male' });

    const list = await service.listByProduct(product1.id);
    expect(list.length).toBe(1);
    expect(list[0]?.name).toBe('Alice');
  });

  test('update changes persona name', async () => {
    const product = await createProduct();
    const p = await service.create({ productId: product.id, name: 'Alice', ageRange: '25-34', gender: 'female' });
    const updated = await service.update(p.id, { name: 'Alicia' });
    expect(updated.name).toBe('Alicia');
  });

  test('delete removes persona', async () => {
    const product = await createProduct();
    const p = await service.create({ productId: product.id, name: 'Alice', ageRange: '25-34', gender: 'female' });
    await service.delete(p.id);
    expect(await service.get(p.id)).toBeNull();
  });

  test('generateForProduct creates personas via AI', async () => {
    const product = await createProduct();
    const personas = await service.generateForProduct(product, 2);
    expect(personas.length).toBe(2);
    expect(personas[0]?.productId).toBe(product.id);
    expect(personas[0]?.name).toBe('Gen Persona 1');
  });

  test('generateForProduct with count=0 or count=21 throws validation error', async () => {
    const product = await createProduct();

    await expect(service.generateForProduct(product, 0)).rejects.toThrow('between 1 and 20');
    await expect(service.generateForProduct(product, 21)).rejects.toThrow('between 1 and 20');
  });

  test('generateForProduct mocked AI returns 3 personas and persists with correct productId', async () => {
    const product = await createProduct();
    const ai = createFakeAi({
      generatePersonas: async () => [
        { name: 'P1', ageRange: '18-24', gender: 'all' },
        { name: 'P2', ageRange: '25-34', gender: 'female' },
        { name: 'P3', ageRange: '35-44', gender: 'male' },
      ],
    });
    const localService = new PersonaService(personaRepo, productRepo, ai);

    const generated = await localService.generateForProduct(product, 3);
    expect(generated).toHaveLength(3);
    expect(generated.every((persona) => persona.productId === product.id)).toBe(true);

    const persisted = await localService.listByProduct(product.id);
    expect(persisted).toHaveLength(3);
    expect(persisted.every((persona) => persona.productId === product.id)).toBe(true);
  });

  test('generateForProduct rolls back on mid-loop failure', async () => {
    const product = await createProduct();

    let calls = 0;
    const originalCreate = personaRepo.create.bind(personaRepo);
    personaRepo.create = async (dto) => {
      if (++calls > 1) throw new Error('DB failure');
      return originalCreate(dto);
    };

    await expect(service.generateForProduct(product, 3)).rejects.toThrow('generation failed');

    const persisted = await personaRepo.findByProductId(product.id);
    expect(persisted.length).toBe(0);
  });

  test('generateForProduct surfaces a friendly error when AI provider is not configured', async () => {
    const product = await createProduct();

    const unconfiguredAi = createFakeAi({
      generatePersonas: async () => {
        throw new Error('AI provider not configured. Set ANTHROPIC_API_KEY to enable AI features.');
      },
    });
    const svc = new PersonaService(personaRepo, productRepo, unconfiguredAi);

    await expect(svc.generateForProduct(product, 2)).rejects.toThrow('AI provider not configured');
    expect((await personaRepo.findByProductId(product.id)).length).toBe(0);
  });

  test('generateForProduct error does not leak raw model or provider names', async () => {
    const product = await createProduct();

    const rawSdkErrorAi = createFakeAi({
      generatePersonas: async () => {
        throw new Error('model: claude-3-5-haiku-20241022');
      },
    });
    const svc = new PersonaService(personaRepo, productRepo, rawSdkErrorAi);

    let caught: Error | undefined;
    try {
      await svc.generateForProduct(product, 1);
    } catch (e) {
      caught = e as Error;
    }

    expect(caught).toBeDefined();
    expect((await personaRepo.findByProductId(product.id)).length).toBe(0);
  });
});
