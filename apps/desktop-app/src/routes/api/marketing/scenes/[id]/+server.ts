import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getMarketingServices, toMarketingErrorResponse } from '$lib/server/marketing-service';

export const prerender = false;

export const GET: RequestHandler = async ({ params }) => {
	try {
		const { sceneService } = await getMarketingServices();
		const scene = await sceneService.get(params.id);
		if (!scene) return json({ error: 'Scene not found' }, { status: 404 });
		return json(scene);
	} catch (error) {
		return toMarketingErrorResponse(error);
	}
};

export const PUT: RequestHandler = async ({ params, request }) => {
	try {
		const { sceneService } = await getMarketingServices();
		const body = await request.json();
		return json(await sceneService.update(params.id, body));
	} catch (error) {
		return toMarketingErrorResponse(error);
	}
};

export const DELETE: RequestHandler = async ({ params }) => {
	try {
		const { sceneService } = await getMarketingServices();
		await sceneService.delete(params.id);
		return json({ success: true });
	} catch (error) {
		return toMarketingErrorResponse(error);
	}
};
