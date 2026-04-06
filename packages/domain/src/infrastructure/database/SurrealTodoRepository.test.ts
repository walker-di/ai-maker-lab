import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import type { Surreal } from 'surrealdb';
import { createDbConnection } from './client.js';
import { SurrealDbAdapter } from './SurrealDbAdapter.js';
import { SurrealTodoRepository } from './SurrealTodoRepository.js';

describe('SurrealTodoRepository', () => {
	let db: Surreal;
	let repository: SurrealTodoRepository;

	beforeEach(async () => {
		db = await createDbConnection({
			host: 'mem://',
			namespace: `test_ns_${crypto.randomUUID()}`,
			database: `test_db_${crypto.randomUUID()}`,
		});

		repository = new SurrealTodoRepository(new SurrealDbAdapter(db));
	});

	afterEach(async () => {
		await db.close();
	});

	test('persists and lists todo records from a real in-memory database', async () => {
		const createdTodo = await repository.create({
			title: 'ship desktop app',
			completed: false,
		});

		const todos = await repository.list();

		expect(createdTodo.id).toBeString();
		expect(createdTodo.id.length).toBeGreaterThan(0);
		expect(createdTodo.title).toBe('ship desktop app');
		expect(createdTodo.completed).toBe(false);
		expect(todos).toEqual([createdTodo]);
	});

	test('finds, updates, and removes persisted todos', async () => {
		const createdTodo = await repository.create({
			title: 'write docs',
			completed: false,
		});

		expect(await repository.findById(createdTodo.id)).toEqual({
			id: createdTodo.id,
			title: 'write docs',
			completed: false,
		});

		await repository.update({
			id: createdTodo.id,
			title: 'write docs',
			completed: true,
		});

		expect(await repository.findById(createdTodo.id)).toEqual({
			id: createdTodo.id,
			title: 'write docs',
			completed: true,
		});

		await repository.remove(createdTodo.id);

		expect(await repository.findById(createdTodo.id)).toBeNull();
		expect(await repository.list()).toEqual([]);
	});

	test('accepts full surreal record ids for lookups and deletes', async () => {
		const createdTodo = await repository.create({
			title: 'normalize surreal ids',
			completed: false,
		});
		const prefixedId = `todo:${createdTodo.id}`;

		expect(await repository.findById(prefixedId)).toEqual({
			id: createdTodo.id,
			title: 'normalize surreal ids',
			completed: false,
		});

		await repository.update({
			id: prefixedId,
			title: 'normalize surreal ids',
			completed: true,
		});

		expect(await repository.findById(createdTodo.id)).toEqual({
			id: createdTodo.id,
			title: 'normalize surreal ids',
			completed: true,
		});

		await repository.remove(prefixedId);

		expect(await repository.findById(createdTodo.id)).toBeNull();
		expect(await repository.list()).toEqual([]);
	});
});
