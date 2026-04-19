import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getMapCatalogService, toPlatformerErrorResponse } from '$lib/server/platformer-service';
import type { Platformer } from 'domain/shared';

export const prerender = false;

export const GET: RequestHandler = async ({ url }) => {
	try {
		const service = await getMapCatalogService();
		const sourceParam = url.searchParams.get('source');
		const source =
			sourceParam === 'builtin' || sourceParam === 'user' || sourceParam === 'all'
				? sourceParam
				: undefined;
		const playerId = url.searchParams.get('playerId') ?? undefined;
		return json(await service.listMaps({ source, playerId }));
	} catch (error) {
		return toPlatformerErrorResponse(error);
	}
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const service = await getMapCatalogService();
		const body = (await request.json()) as {
			id?: string;
			metadata: Platformer.MapMetadata;
			definition: Platformer.MapDefinition;
			builtInId?: string;
		};
		return json(await service.saveUserMap(body));
	} catch (error) {
		return toPlatformerErrorResponse(error);
	}
};
