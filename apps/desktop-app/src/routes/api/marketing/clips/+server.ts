import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getMarketingServices, toMarketingErrorResponse } from '$lib/server/marketing-service';

export const prerender = false;

export const GET: RequestHandler = async ({ url }) => {
	try {
		const { clipService, clipRepo } = await getMarketingServices();
		const sceneId = url.searchParams.get('sceneId');
		if (sceneId) return json(await clipService.listByScene(sceneId));
		return json(await clipRepo.findAll());
	} catch (error) {
		return toMarketingErrorResponse(error);
	}
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { clipService } = await getMarketingServices();
		const body = await request.json();
		return json(await clipService.create(body), { status: 201 });
	} catch (error) {
		return toMarketingErrorResponse(error);
	}
};
