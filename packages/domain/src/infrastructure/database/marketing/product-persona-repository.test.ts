import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import type { Surreal } from 'surrealdb';
import { createDbConnection } from '../client.js';
import { SurrealDbAdapter } from '../SurrealDbAdapter.js';
import { assertNoRecordIdLeaks } from '../test-helpers/assertNoRecordIdLeaks.js';
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
    const created = await productRepo.create({ name: 'Widget', features: [], benefits: [] });
    assertNoRecordIdLeaks(created);

    const all = await productRepo.findAll();
    assertNoRecordIdLeaks(all);
    expect(all.length).toBe(1);
    expect(all[0]?.name).toBe('Widget');
  });

  test('findById returns product', async () => {
    const created = await productRepo.create({ name: 'Gadget', features: [], benefits: [] });
    assertNoRecordIdLeaks(created);

    const found = await productRepo.findById(created.id);
    assertNoRecordIdLeaks(found);
    expect(found?.id).toBe(created.id);
    expect(found?.name).toBe('Gadget');
  });

  test('findById returns null for unknown id', async () => {
    const found = await productRepo.findById('marketing_product:nonexistent');
    assertNoRecordIdLeaks(found);
    expect(found).toBeNull();
  });

  test('id is a plain string (no RecordId wrapper)', async () => {
    const created = await productRepo.create({ name: 'X', features: [], benefits: [] });
    assertNoRecordIdLeaks(created);
    expect(typeof created.id).toBe('string');
    expect(created.id).not.toContain('{');
  });

  test('update changes fields', async () => {
    const created = await productRepo.create({ name: 'Old', features: [], benefits: [] });
    assertNoRecordIdLeaks(created);

    const updated = await productRepo.update(created.id, { name: 'New' });
    assertNoRecordIdLeaks(updated);
    expect(updated.name).toBe('New');
  });

  test('update preserves createdAt and untouched fields', async () => {
    const created = await productRepo.create({
      name: 'Original',
      description: 'Keep this',
      features: ['f1'],
      benefits: ['b1'],
    });
    assertNoRecordIdLeaks(created);

    await Bun.sleep(2);

    const updated = await productRepo.update(created.id, { name: 'Renamed' });
    assertNoRecordIdLeaks(updated);
    expect(updated.name).toBe('Renamed');
    expect(updated.createdAt).toBe(created.createdAt);
    expect(updated.description).toBe('Keep this');
    expect(updated.features).toEqual(['f1']);
    expect(updated.benefits).toEqual(['b1']);
    expect(typeof updated.updatedAt).toBe('string');

    const refetched = await productRepo.findById(created.id);
    assertNoRecordIdLeaks(refetched);
    expect(refetched?.createdAt).toBe(created.createdAt);
  });

  test('update throws for unknown id', async () => {
    await expect(productRepo.update('marketing_product:unknown', { name: 'Nope' })).rejects.toThrow(
      'Product not found',
    );
  });

  test('delete removes product', async () => {
    const created = await productRepo.create({ name: 'Delete me', features: [], benefits: [] });
    assertNoRecordIdLeaks(created);

    await productRepo.delete(created.id);

    const found = await productRepo.findById(created.id);
    assertNoRecordIdLeaks(found);
    expect(found).toBeNull();
  });

  test('delete unknown id throws a graceful missing-table error on fresh db', async () => {
    await expect(productRepo.delete('marketing_product:unknown')).rejects.toThrow(/does not exist/i);
  });

  test('findAll returns empty array on fresh db', async () => {
    const all = await productRepo.findAll();
    assertNoRecordIdLeaks(all);
    expect(all).toEqual([]);
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
    assertNoRecordIdLeaks(product);

    const created = await personaRepo.create({
      productId: product.id,
      name: 'Alice',
      ageRange: '25-34',
      gender: 'female',
    });
    assertNoRecordIdLeaks(created);

    const list = await personaRepo.findByProductId(product.id);
    assertNoRecordIdLeaks(list);
    expect(list.length).toBe(1);
    expect(list[0]?.name).toBe('Alice');
    expect(list[0]?.productId).toBe(product.id);
  });

  test('findByProductId is scoped per product (cross-product exclusion)', async () => {
    const p1 = await productRepo.create({ name: 'P1', features: [], benefits: [] });
    const p2 = await productRepo.create({ name: 'P2', features: [], benefits: [] });
    assertNoRecordIdLeaks(p1);
    assertNoRecordIdLeaks(p2);

    const p1Persona = await personaRepo.create({
      productId: p1.id,
      name: 'Alice',
      ageRange: '25-34',
      gender: 'female',
    });
    const p2Persona = await personaRepo.create({
      productId: p2.id,
      name: 'Bob',
      ageRange: '35-44',
      gender: 'male',
    });
    assertNoRecordIdLeaks(p1Persona);
    assertNoRecordIdLeaks(p2Persona);

    const forP1 = await personaRepo.findByProductId(p1.id);
    assertNoRecordIdLeaks(forP1);
    expect(forP1.length).toBe(1);
    expect(forP1[0]?.name).toBe('Alice');
    expect(forP1.some((persona) => persona.id === p2Persona.id)).toBe(false);

    const forP2 = await personaRepo.findByProductId(p2.id);
    assertNoRecordIdLeaks(forP2);
    expect(forP2.length).toBe(1);
    expect(forP2[0]?.name).toBe('Bob');
  });

  test('id is a plain string (no RecordId wrapper)', async () => {
    const product = await productRepo.create({ name: 'Widget', features: [], benefits: [] });
    assertNoRecordIdLeaks(product);

    const persona = await personaRepo.create({
      productId: product.id,
      name: 'Alice',
      ageRange: '25-34',
      gender: 'female',
    });
    assertNoRecordIdLeaks(persona);
    expect(typeof persona.id).toBe('string');
    expect(persona.id).not.toContain('{');
  });

  test('findById returns null for unknown id', async () => {
    const found = await personaRepo.findById('marketing_persona:unknown');
    assertNoRecordIdLeaks(found);
    expect(found).toBeNull();
  });

  test('findByProductId returns empty for unknown product', async () => {
    const list = await personaRepo.findByProductId('marketing_product:unknown');
    assertNoRecordIdLeaks(list);
    expect(list).toEqual([]);
  });

  test('delete removes persona', async () => {
    const product = await productRepo.create({ name: 'Widget', features: [], benefits: [] });
    assertNoRecordIdLeaks(product);

    const persona = await personaRepo.create({
      productId: product.id,
      name: 'Alice',
      ageRange: '25-34',
      gender: 'female',
    });
    assertNoRecordIdLeaks(persona);

    await personaRepo.delete(persona.id);

    const found = await personaRepo.findById(persona.id);
    assertNoRecordIdLeaks(found);
    expect(found).toBeNull();
  });

  test('delete unknown id throws a graceful missing-table error on fresh db', async () => {
    await expect(personaRepo.delete('marketing_persona:unknown')).rejects.toThrow(/does not exist/i);
  });

  test('update changes persona fields', async () => {
    const product = await productRepo.create({ name: 'Widget', features: [], benefits: [] });
    assertNoRecordIdLeaks(product);

    const persona = await personaRepo.create({
      productId: product.id,
      name: 'Alice',
      ageRange: '25-34',
      gender: 'female',
    });
    assertNoRecordIdLeaks(persona);

    const updated = await personaRepo.update(persona.id, { name: 'Alicia' });
    assertNoRecordIdLeaks(updated);
    expect(updated.name).toBe('Alicia');
  });

  test('update throws for unknown id', async () => {
    await expect(personaRepo.update('marketing_persona:unknown', { name: 'Ghost' })).rejects.toThrow(
      'Persona not found',
    );
  });
});
