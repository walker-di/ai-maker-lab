import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getMapCatalogService, toPlatformerErrorResponse } from '$lib/server/platformer-service';

export const prerender = false;

export const GET: RequestHandler = async () => {
	try {
		const service = await getMapCatalogService();
		return json(await service.listBuiltInWorlds());
	} catch (error) {
		return toPlatformerErrorResponse(error);
	}
};
