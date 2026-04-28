import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { Marketing } from 'domain/shared';
import { getMarketingServices, toMarketingErrorResponse } from '$lib/server/marketing-service';

export const prerender = false;

export const POST: RequestHandler = async ({ params, request }) => {
	try {
		const { storyboardService } = await getMarketingServices();
		const body = Marketing.GenerateStoryboardFramesDtoSchema.parse(await request.json());
		return json(await storyboardService.generateFrames(params.storyboardId, body), { status: 201 });
	} catch (error) {
		console.error('Failed to generate storyboard frames', error);
		return toMarketingErrorResponse(error);
	}
};
