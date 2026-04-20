import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { json } from '@sveltejs/kit';
import { Platformer } from 'domain/application';
import { getDb, SurrealDbAdapter } from 'domain/infrastructure';
import { createMapCatalogService } from './platformer-map-catalog-factory';

let mapCatalogServicePromise: Promise<Platformer.MapCatalogService> | undefined;

function getDefaultEmbeddedHost(): string {
	const dbPath = fileURLToPath(
		new URL('../../../../../data/surrealdb/desktop-web.db', import.meta.url)
	);
	mkdirSync(dirname(dbPath), { recursive: true });
	return `surrealkv://${dbPath}`;
}

export function getMapCatalogService(): Promise<Platformer.MapCatalogService> {
	if (!mapCatalogServicePromise) {
		mapCatalogServicePromise = (async () => {
			const surreal = await getDb({
				host: process.env.SURREAL_HOST ?? getDefaultEmbeddedHost(),
				namespace: process.env.SURREAL_NS ?? 'app',
				database: process.env.SURREAL_DB ?? 'desktop',
				username: process.env.SURREAL_USER,
				password: process.env.SURREAL_PASS,
				token: process.env.SURREAL_TOKEN
			});
			const adapter = new SurrealDbAdapter(surreal);
			return createMapCatalogService(adapter);
		})();
	}
	return mapCatalogServicePromise;
}

export function toPlatformerErrorResponse(error: unknown) {
	const message = error instanceof Error ? error.message : 'Unknown error';
	const status = message.toLowerCase().includes('not found')
		? 404
		: message.toLowerCase().includes('invalid') || message.toLowerCase().includes('cannot')
			? 400
			: 500;
	return json({ error: message }, { status });
}
