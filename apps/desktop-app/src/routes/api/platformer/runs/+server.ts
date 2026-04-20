import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getMapCatalogService, toPlatformerErrorResponse } from '$lib/server/platformer-service';
import type { Platformer } from 'domain/application';

export const prerender = false;

export const POST: RequestHandler = async ({ request }) => {
	try {
		const service = await getMapCatalogService();
		const body = (await request.json()) as Platformer.RecordRunResultInput;
		return json(await service.recordRunResult(body));
	} catch (error) {
		return toPlatformerErrorResponse(error);
	}
};
