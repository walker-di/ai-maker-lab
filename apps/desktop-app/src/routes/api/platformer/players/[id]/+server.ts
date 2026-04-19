import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getMapCatalogService, toPlatformerErrorResponse } from '$lib/server/platformer-service';

export const prerender = false;

export const GET: RequestHandler = async ({ params }) => {
	try {
		const service = await getMapCatalogService();
		const profile = await service.loadPlayerProfile(params.id);
		if (!profile) return json({ error: 'not found' }, { status: 404 });
		return json(profile);
	} catch (error) {
		return toPlatformerErrorResponse(error);
	}
};
