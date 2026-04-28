import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getMarketingServices, toMarketingErrorResponse } from '$lib/server/marketing-service';

export const prerender = false;

export const GET: RequestHandler = async ({ url }) => {
	try {
		const { storyService, storyRepo } = await getMarketingServices();
		const creativeId = url.searchParams.get('creativeId');
		if (creativeId) return json(await storyService.listByCreative(creativeId));
		return json(await storyRepo.findAll());
	} catch (error) {
		return toMarketingErrorResponse(error);
	}
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { storyService } = await getMarketingServices();
		const body = await request.json();
		return json(await storyService.create(body), { status: 201 });
	} catch (error) {
		return toMarketingErrorResponse(error);
	}
};
