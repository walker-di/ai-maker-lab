import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getMapCatalogService, toPlatformerErrorResponse } from '$lib/server/platformer-service';
import type { Platformer } from 'domain/shared';

export const prerender = false;

export const POST: RequestHandler = async ({ request }) => {
	try {
		const service = await getMapCatalogService();
		const body = (await request.json()) as {
			builtInId: string;
			metadata?: Partial<Platformer.MapMetadata>;
		};
		return json(await service.duplicateBuiltIn(body.builtInId, body.metadata ?? {}));
	} catch (error) {
		return toPlatformerErrorResponse(error);
	}
};
