import { json } from '@sveltejs/kit';
import { Platformer } from 'domain/application';
import { getDb, SurrealDbAdapter } from 'domain/infrastructure';
import { createMapCatalogService } from './platformer-map-catalog-factory';
import { getAppDbConfig } from './db-config.js';

let mapCatalogServicePromise: Promise<Platformer.MapCatalogService> | undefined;

export function getMapCatalogService(): Promise<Platformer.MapCatalogService> {
	if (!mapCatalogServicePromise) {
		mapCatalogServicePromise = (async () => {
			try {
				const surreal = await getDb(getAppDbConfig());
				const adapter = new SurrealDbAdapter(surreal);
				return createMapCatalogService(adapter);
			} catch (error) {
				mapCatalogServicePromise = undefined;
				throw error;
			}
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
