import type { Platformer } from 'domain/application';
import type { PlatformerRpcSchema } from '../lib/adapters/platformer/electrobun-platformer-rpc';

type RequestSchemaShape = Record<string, { params?: unknown; response: unknown }>;

type RequestHandlers<RS extends RequestSchemaShape> = {
	[K in keyof RS]: (
		...args: 'params' extends keyof RS[K]
			? undefined extends RS[K]['params']
				? [params?: RS[K]['params']]
				: [params: RS[K]['params']]
			: []
	) => Promise<Awaited<RS[K]['response']>>;
};

export type PlatformerRequestHandlers = RequestHandlers<PlatformerRpcSchema['bun']['requests']>;

function toPlain<T>(data: T): T {
	return JSON.parse(JSON.stringify(data));
}

export function buildPlatformerRequestHandlers(
	mapCatalogService: Platformer.MapCatalogService,
): PlatformerRequestHandlers {
	return {
		async listPlatformerMaps(params) {
			return toPlain(await mapCatalogService.listMaps(params));
		},
		async getPlatformerMap({ id }) {
			const map = await mapCatalogService.getMap(id);
			return map ? toPlain(map) : null;
		},
		async savePlatformerUserMap(input) {
			return toPlain(await mapCatalogService.saveUserMap(input));
		},
		async deletePlatformerUserMap({ id }) {
			await mapCatalogService.deleteUserMap(id);
		},
		async duplicatePlatformerBuiltIn({ builtInId, metadata }) {
			return toPlain(await mapCatalogService.duplicateBuiltIn(builtInId, metadata ?? {}));
		},
		async recordPlatformerRunResult(input) {
			return toPlain(await mapCatalogService.recordRunResult(input));
		},
		async loadPlatformerPlayerProfile({ playerId }) {
			const profile = await mapCatalogService.loadPlayerProfile(playerId);
			return profile ? toPlain(profile) : null;
		},
	};
}
