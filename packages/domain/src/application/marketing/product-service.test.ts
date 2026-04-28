import { describe, expect, test, beforeEach } from 'bun:test';
import type { Product, Persona, CreateProductDto, UpdateProductDto, CreatePersonaDto } from '../../shared/marketing/index.js';
import type { IProductRepository, IPersonaRepository, IMarketingTextGenerationGateway } from './ports.js';
import { ProductService } from './product-service.js';

class FakeProductRepo implements IProductRepository {
  private items: Product[] = [];
  private seq = 0;

  async findAll() { return [...this.items]; }
  async findById(id: string) { return this.items.find((p) => p.id === id) ?? null; }
  async create(dto: CreateProductDto): Promise<Product> {
    const now = new Date().toISOString();
    const p: Product = { id: `prod-${++this.seq}`, ...dto, features: dto.features ?? [], benefits: dto.benefits ?? [], createdAt: now, updatedAt: now };
    this.items.push(p);
    return p;
  }
  async update(id: string, dto: UpdateProductDto): Promise<Product> {
    const idx = this.items.findIndex((p) => p.id === id);
    if (idx === -1) throw new Error(`Product not found: ${id}`);
    this.items[idx] = { ...this.items[idx]!, ...dto, updatedAt: new Date().toISOString() };
    return this.items[idx]!;
  }
  async delete(id: string) {
    this.items = this.items.filter((p) => p.id !== id);
  }
}

class FakePersonaRepo implements IPersonaRepository {
  constructor(private items: Persona[] = []) {}
  async findAll() { return [...this.items]; }
  async findById(id: string) { return this.items.find((p) => p.id === id) ?? null; }
  async findByProductId(productId: string) { return this.items.filter((p) => p.productId === productId); }
  async create(dto: CreatePersonaDto): Promise<Persona> {
    const now = new Date().toISOString();
    const p: Persona = { id: `per-${this.items.length + 1}`, ...dto, interests: [], painPoints: [], motivations: [], createdAt: now, updatedAt: now };
    this.items.push(p);
    return p;
  }
  async update(id: string, dto: any): Promise<Persona> { throw new Error('not needed'); }
  async delete(id: string) { this.items = this.items.filter((p) => p.id !== id); }
}

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
  let productRepo: FakeProductRepo;
  let personaRepo: FakePersonaRepo;
  let service: ProductService;

  beforeEach(() => {
    productRepo = new FakeProductRepo();
    personaRepo = new FakePersonaRepo();
    service = new ProductService(productRepo, personaRepo, fakeAi);
  });

  test('create returns a persisted product', async () => {
    const p = await service.create({ name: 'Widget', features: [], benefits: [] });
    expect(p.id).toBe('prod-1');
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
    const now = new Date().toISOString();
    (personaRepo as any).items.push({ id: 'per-1', productId: p.id, name: 'Alice', ageRange: '25-34', gender: 'female', interests: [], painPoints: [], motivations: [], createdAt: now, updatedAt: now });
    await expect(service.delete(p.id)).rejects.toThrow('Cannot delete Product');
  });

  test('generateFromName uses AI to set description', async () => {
    const p = await service.generateFromName('Gadget');
    expect(p.name).toBe('Gadget');
    expect(p.description).toBe('AI description');
  });
});
