import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getMarketingServices, toMarketingErrorResponse } from '$lib/server/marketing-service';

export const prerender = false;

export const POST: RequestHandler = async ({ params }) => {
	try {
		const { sceneService, bgmService } = await getMarketingServices();
		const scene = await sceneService.get(params.id);
		if (!scene) return json({ error: 'Scene not found' }, { status: 404 });
		const bgm = await bgmService.autoSelectForScene(scene);
		return json({ bgm });
	} catch (error) {
		return toMarketingErrorResponse(error);
	}
};
