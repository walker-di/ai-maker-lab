import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { Marketing } from 'domain/shared';
import { getMarketingServices, toMarketingErrorResponse } from '$lib/server/marketing-service';

export const prerender = false;

export const PUT: RequestHandler = async ({ params, request }) => {
	try {
		const { storyboardService } = await getMarketingServices();
		const body = Marketing.UpdateStoryboardFrameTextDtoSchema.parse(await request.json());
		return json(await storyboardService.updateFrameText(params.storyboardId, params.frameId, body));
	} catch (error) {
		console.error('Failed to update storyboard frame', error);
		return toMarketingErrorResponse(error);
	}
};

export const DELETE: RequestHandler = async ({ params }) => {
	try {
		const { storyboardService } = await getMarketingServices();
		return json(await storyboardService.deleteFrame(params.storyboardId, params.frameId));
	} catch (error) {
		console.error('Failed to delete storyboard frame', error);
		return toMarketingErrorResponse(error);
	}
};
