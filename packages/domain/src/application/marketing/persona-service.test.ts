import { describe, expect, test, beforeEach } from 'bun:test';
import type { Product, Persona, CreateProductDto, CreatePersonaDto, UpdatePersonaDto } from '../../shared/marketing/index.js';
import type { IProductRepository, IPersonaRepository, IMarketingTextGenerationGateway } from './ports.js';
import { PersonaService } from './persona-service.js';

class FakeProductRepo implements IProductRepository {
  constructor(private items: Product[] = []) {}
  async findAll() { return [...this.items]; }
  async findById(id: string) { return this.items.find((p) => p.id === id) ?? null; }
  async create(dto: CreateProductDto): Promise<Product> { throw new Error('not needed'); }
  async update(): Promise<Product> { throw new Error('not needed'); }
  async delete() {}
}

class FakePersonaRepo implements IPersonaRepository {
  items: Persona[] = [];
  private seq = 0;
  async findAll() { return [...this.items]; }
  async findById(id: string) { return this.items.find((p) => p.id === id) ?? null; }
  async findByProductId(productId: string) { return this.items.filter((p) => p.productId === productId); }
  async create(dto: CreatePersonaDto): Promise<Persona> {
    const now = new Date().toISOString();
    const p: Persona = { id: `per-${++this.seq}`, ...dto, interests: dto.interests ?? [], painPoints: dto.painPoints ?? [], motivations: dto.motivations ?? [], createdAt: now, updatedAt: now };
    this.items.push(p);
    return p;
  }
  async update(id: string, dto: UpdatePersonaDto): Promise<Persona> {
    const idx = this.items.findIndex((p) => p.id === id);
    if (idx === -1) throw new Error(`Persona not found: ${id}`);
    this.items[idx] = { ...this.items[idx]!, ...dto, updatedAt: new Date().toISOString() };
    return this.items[idx]!;
  }
  async delete(id: string) { this.items = this.items.filter((p) => p.id !== id); }
}

function makeProduct(id = 'prod-1'): Product {
  const now = new Date().toISOString();
  return { id, name: 'Widget', features: [], benefits: [], createdAt: now, updatedAt: now };
}

const fakeAi: IMarketingTextGenerationGateway = {
  generateProductDescription: async () => '',
  generatePersonas: async (product, count = 1) =>
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
};

describe('PersonaService', () => {
  let productRepo: FakeProductRepo;
  let personaRepo: FakePersonaRepo;
  let service: PersonaService;
  const product = makeProduct();

  beforeEach(() => {
    productRepo = new FakeProductRepo([product]);
    personaRepo = new FakePersonaRepo();
    service = new PersonaService(personaRepo, productRepo, fakeAi);
  });

  test('create persists persona for known product', async () => {
    const p = await service.create({ productId: 'prod-1', name: 'Alice', ageRange: '25-34', gender: 'female' });
    expect(p.productId).toBe('prod-1');
    expect(p.name).toBe('Alice');
  });

  test('create rejects unknown product', async () => {
    await expect(
      service.create({ productId: 'unknown', name: 'Bob', ageRange: '25-34', gender: 'male' })
    ).rejects.toThrow('Product not found');
  });

  test('listByProduct returns only personas for that product', async () => {
    const product2 = makeProduct('prod-2');
    const productRepo2 = new FakeProductRepo([product, product2]);
    const svc2 = new PersonaService(personaRepo, productRepo2, fakeAi);
    await svc2.create({ productId: 'prod-1', name: 'Alice', ageRange: '25-34', gender: 'female' });
    await svc2.create({ productId: 'prod-2', name: 'Bob', ageRange: '35-44', gender: 'male' });
    const list = await svc2.listByProduct('prod-1');
    expect(list.length).toBe(1);
    expect(list[0]?.name).toBe('Alice');
  });

  test('update changes persona name', async () => {
    const p = await service.create({ productId: 'prod-1', name: 'Alice', ageRange: '25-34', gender: 'female' });
    const updated = await service.update(p.id, { name: 'Alicia' });
    expect(updated.name).toBe('Alicia');
  });

  test('delete removes persona', async () => {
    const p = await service.create({ productId: 'prod-1', name: 'Alice', ageRange: '25-34', gender: 'female' });
    await service.delete(p.id);
    expect(await service.get(p.id)).toBeNull();
  });

  test('generateForProduct creates personas via AI', async () => {
    const personas = await service.generateForProduct(product, 2);
    expect(personas.length).toBe(2);
    expect(personas[0]?.productId).toBe('prod-1');
    expect(personas[0]?.name).toBe('Gen Persona 1');
  });

  test('generateForProduct rolls back on mid-loop failure', async () => {
    let calls = 0;
    const failingRepo: FakePersonaRepo = new FakePersonaRepo();
    const origCreate = failingRepo.create.bind(failingRepo);
    failingRepo.create = async (dto) => {
      if (++calls > 1) throw new Error('DB failure');
      return origCreate(dto);
    };
    const svc = new PersonaService(failingRepo, productRepo, fakeAi);
    await expect(svc.generateForProduct(product, 3)).rejects.toThrow('generation failed');
    expect(failingRepo.items.length).toBe(0);
  });
});
