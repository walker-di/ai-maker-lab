import { json } from '@sveltejs/kit';
import { Rts } from 'domain/application';
import {
	BuiltInRtsMapSource,
	getDb,
	SurrealDbAdapter,
	SurrealRtsMatchResultRepository,
	SurrealRtsUserMapRepository
} from 'domain/infrastructure';
import { getAppDbConfig } from './db-config.js';

interface RtsServiceBundle {
	catalog: Rts.MapCatalogService;
	userMaps: SurrealRtsUserMapRepository;
	matchResults: SurrealRtsMatchResultRepository;
	generator: Rts.MapGenerator;
}

let bundlePromise: Promise<RtsServiceBundle> | undefined;

export function getRtsServices(): Promise<RtsServiceBundle> {
	if (!bundlePromise) {
		bundlePromise = (async () => {
			try {
				const surreal = await getDb(getAppDbConfig());
				const adapter = new SurrealDbAdapter(surreal);
				const userMaps = new SurrealRtsUserMapRepository(adapter);
				const matchResults = new SurrealRtsMatchResultRepository(adapter);
				const catalog = new Rts.MapCatalogService(new BuiltInRtsMapSource(), userMaps);
				const generator = new Rts.MapGenerator();
				return { catalog, userMaps, matchResults, generator };
			} catch (error) {
				bundlePromise = undefined;
				throw error;
			}
		})();
	}
	return bundlePromise;
}

export function toRtsErrorResponse(error: unknown) {
	const message = error instanceof Error ? error.message : 'Unknown error';
	const status = message.toLowerCase().includes('not found')
		? 404
		: message.toLowerCase().includes('invalid') || message.toLowerCase().includes('cannot')
			? 400
			: 500;
	return json({ error: message }, { status });
}
