import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import type { Surreal } from 'surrealdb';
import { createDbConnection } from '../client.js';
import { SurrealDbAdapter } from '../SurrealDbAdapter.js';
import { SurrealProductRepository } from './SurrealProductRepository.js';
import { SurrealPersonaRepository } from './SurrealPersonaRepository.js';

describe('SurrealProductRepository', () => {
  let db: Surreal;
  let productRepo: SurrealProductRepository;

  beforeEach(async () => {
    db = await createDbConnection({
      host: 'mem://',
      namespace: `test_ns_${crypto.randomUUID()}`,
      database: `test_db_${crypto.randomUUID()}`,
    });
    const adapter = new SurrealDbAdapter(db);
    productRepo = new SurrealProductRepository(adapter);
  });

  afterEach(async () => {
    await db.close();
  });

  test('create and findAll', async () => {
    await productRepo.create({ name: 'Widget', features: [], benefits: [] });
    const all = await productRepo.findAll();
    expect(all.length).toBe(1);
    expect(all[0]?.name).toBe('Widget');
  });

  test('findById returns product', async () => {
    const created = await productRepo.create({ name: 'Gadget', features: [], benefits: [] });
    const found = await productRepo.findById(created.id);
    expect(found?.id).toBe(created.id);
    expect(found?.name).toBe('Gadget');
  });

  test('findById returns null for unknown id', async () => {
    expect(await productRepo.findById('marketing_product:nonexistent')).toBeNull();
  });

  test('id is a plain string (no RecordId wrapper)', async () => {
    const created = await productRepo.create({ name: 'X', features: [], benefits: [] });
    expect(typeof created.id).toBe('string');
    expect(created.id).not.toContain('{');
  });

  test('update changes fields', async () => {
    const created = await productRepo.create({ name: 'Old', features: [], benefits: [] });
    const updated = await productRepo.update(created.id, { name: 'New' });
    expect(updated.name).toBe('New');
  });

  test('delete removes product', async () => {
    const created = await productRepo.create({ name: 'Delete me', features: [], benefits: [] });
    await productRepo.delete(created.id);
    expect(await productRepo.findById(created.id)).toBeNull();
  });

  test('findAll returns empty array on fresh db', async () => {
    expect(await productRepo.findAll()).toEqual([]);
  });
});

describe('SurrealPersonaRepository', () => {
  let db: Surreal;
  let productRepo: SurrealProductRepository;
  let personaRepo: SurrealPersonaRepository;

  beforeEach(async () => {
    db = await createDbConnection({
      host: 'mem://',
      namespace: `test_ns_${crypto.randomUUID()}`,
      database: `test_db_${crypto.randomUUID()}`,
    });
    const adapter = new SurrealDbAdapter(db);
    productRepo = new SurrealProductRepository(adapter);
    personaRepo = new SurrealPersonaRepository(adapter);
  });

  afterEach(async () => {
    await db.close();
  });

  test('create and findByProductId', async () => {
    const product = await productRepo.create({ name: 'Widget', features: [], benefits: [] });
    await personaRepo.create({ productId: product.id, name: 'Alice', ageRange: '25-34', gender: 'female' });
    const list = await personaRepo.findByProductId(product.id);
    expect(list.length).toBe(1);
    expect(list[0]?.name).toBe('Alice');
    expect(list[0]?.productId).toBe(product.id);
  });

  test('findByProductId is scoped per product (cross-product exclusion)', async () => {
    const p1 = await productRepo.create({ name: 'P1', features: [], benefits: [] });
    const p2 = await productRepo.create({ name: 'P2', features: [], benefits: [] });
    await personaRepo.create({ productId: p1.id, name: 'Alice', ageRange: '25-34', gender: 'female' });
    await personaRepo.create({ productId: p2.id, name: 'Bob', ageRange: '35-44', gender: 'male' });
    const forP1 = await personaRepo.findByProductId(p1.id);
    expect(forP1.length).toBe(1);
    expect(forP1[0]?.name).toBe('Alice');
    const forP2 = await personaRepo.findByProductId(p2.id);
    expect(forP2.length).toBe(1);
    expect(forP2[0]?.name).toBe('Bob');
  });

  test('id is a plain string (no RecordId wrapper)', async () => {
    const product = await productRepo.create({ name: 'Widget', features: [], benefits: [] });
    const persona = await personaRepo.create({ productId: product.id, name: 'Alice', ageRange: '25-34', gender: 'female' });
    expect(typeof persona.id).toBe('string');
    expect(persona.id).not.toContain('{');
  });

  test('findByProductId returns empty for unknown product', async () => {
    expect(await personaRepo.findByProductId('marketing_product:unknown')).toEqual([]);
  });

  test('delete removes persona', async () => {
    const product = await productRepo.create({ name: 'Widget', features: [], benefits: [] });
    const persona = await personaRepo.create({ productId: product.id, name: 'Alice', ageRange: '25-34', gender: 'female' });
    await personaRepo.delete(persona.id);
    expect(await personaRepo.findById(persona.id)).toBeNull();
  });

  test('update changes persona fields', async () => {
    const product = await productRepo.create({ name: 'Widget', features: [], benefits: [] });
    const persona = await personaRepo.create({ productId: product.id, name: 'Alice', ageRange: '25-34', gender: 'female' });
    const updated = await personaRepo.update(persona.id, { name: 'Alicia' });
    expect(updated.name).toBe('Alicia');
  });
});
