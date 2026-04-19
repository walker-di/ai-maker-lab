import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { json } from '@sveltejs/kit';
import { Rts } from 'domain/application';
import {
	BuiltInRtsMapSource,
	getDb,
	SurrealDbAdapter,
	SurrealRtsMatchResultRepository,
	SurrealRtsUserMapRepository
} from 'domain/infrastructure';

interface RtsServiceBundle {
	catalog: Rts.MapCatalogService;
	userMaps: SurrealRtsUserMapRepository;
	matchResults: SurrealRtsMatchResultRepository;
	generator: Rts.MapGenerator;
}

let bundlePromise: Promise<RtsServiceBundle> | undefined;

function getDefaultEmbeddedHost(): string {
	const dbPath = fileURLToPath(
		new URL('../../../../../data/surrealdb/desktop-web.db', import.meta.url)
	);
	mkdirSync(dirname(dbPath), { recursive: true });
	return `surrealkv://${dbPath}`;
}

export function getRtsServices(): Promise<RtsServiceBundle> {
	if (!bundlePromise) {
		bundlePromise = (async () => {
			const surreal = await getDb({
				host: process.env.SURREAL_HOST ?? getDefaultEmbeddedHost(),
				namespace: process.env.SURREAL_NS ?? 'app',
				database: process.env.SURREAL_DB ?? 'desktop',
				username: process.env.SURREAL_USER,
				password: process.env.SURREAL_PASS,
				token: process.env.SURREAL_TOKEN
			});
			const adapter = new SurrealDbAdapter(surreal);
			const userMaps = new SurrealRtsUserMapRepository(adapter);
			const matchResults = new SurrealRtsMatchResultRepository(adapter);
			const catalog = new Rts.MapCatalogService(new BuiltInRtsMapSource(), userMaps);
			const generator = new Rts.MapGenerator();
			return { catalog, userMaps, matchResults, generator };
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
