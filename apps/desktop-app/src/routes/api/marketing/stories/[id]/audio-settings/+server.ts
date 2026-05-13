import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getMarketingServices, toMarketingErrorResponse } from '$lib/server/marketing-service';

export const prerender = false;

export const PUT: RequestHandler = async ({ params, request }) => {
	try {
		const { storyService } = await getMarketingServices();
		const settings = await request.json();
		return json(await storyService.updateAudioSettings(params.id, settings));
	} catch (error) {
		return toMarketingErrorResponse(error);
	}
};
