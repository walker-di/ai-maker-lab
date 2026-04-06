import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TodoService } from 'domain/application';
import { getDb, SurrealDbAdapter, SurrealTodoRepository } from 'domain/infrastructure';
import { json } from '@sveltejs/kit';

let todoServicePromise: Promise<TodoService> | undefined;

function getDefaultEmbeddedHost(): string {
	const dbPath = fileURLToPath(
		new URL('../../../../../data/surrealdb/desktop-web.db', import.meta.url)
	);
	mkdirSync(dirname(dbPath), { recursive: true });
	return `surrealkv://${dbPath}`;
}

export function getTodoService(): Promise<TodoService> {
	if (!todoServicePromise) {
		todoServicePromise = (async () => {
			const surreal = await getDb({
				host: process.env.SURREAL_HOST ?? getDefaultEmbeddedHost(),
				namespace: process.env.SURREAL_NS ?? 'app',
				database: process.env.SURREAL_DB ?? 'desktop',
				username: process.env.SURREAL_USER,
				password: process.env.SURREAL_PASS,
				token: process.env.SURREAL_TOKEN
			});

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
