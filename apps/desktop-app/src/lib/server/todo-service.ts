import { TodoService } from 'domain/application';
import { getDb, SurrealDbAdapter, SurrealTodoRepository } from 'domain/infrastructure';
import { json } from '@sveltejs/kit';
import { getAppDbConfig } from './db-config.js';

let todoServicePromise: Promise<TodoService> | undefined;

export function getTodoService(): Promise<TodoService> {
	if (!todoServicePromise) {
		todoServicePromise = (async () => {
			const surreal = await getDb(getAppDbConfig());

			return new TodoService(new SurrealTodoRepository(new SurrealDbAdapter(surreal)));
		})();
	}

	return todoServicePromise;
}

export function toTodoErrorResponse(error: unknown) {
	const message = error instanceof Error ? error.message : 'Unknown error';
	const status = message.includes('not found') ? 404 : message.includes('cannot be empty') ? 400 : 500;
	return json({ error: message }, { status });
}
