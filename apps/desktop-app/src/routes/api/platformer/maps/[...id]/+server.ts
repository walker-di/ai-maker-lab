import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getMapCatalogService, toPlatformerErrorResponse } from '$lib/server/platformer-service';

export const prerender = false;

export const GET: RequestHandler = async ({ params }) => {
	try {
		const service = await getMapCatalogService();
		const map = await service.getMap(params.id);
		if (!map) return json({ error: 'not found' }, { status: 404 });
		return json(map);
	} catch (error) {
		return toPlatformerErrorResponse(error);
	}
};

export const DELETE: RequestHandler = async ({ params }) => {
	try {
		const service = await getMapCatalogService();
		await service.deleteUserMap(params.id);
		return json({ ok: true });
	} catch (error) {
		return toPlatformerErrorResponse(error);
	}
};
