import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { Marketing } from 'domain/shared';
import { getMarketingServices, toMarketingErrorResponse } from '$lib/server/marketing-service';

export const prerender = false;

export const POST: RequestHandler = async ({ params, request }) => {
	let body: unknown;
	try {
		const { storyboardService } = await getMarketingServices();
		body = await request.json();
		const dto = Marketing.GenerateStoryboardFramesDtoSchema.parse(body);
		return json(await storyboardService.generateFrames(params.storyboardId, dto), { status: 201 });
	} catch (error) {
		console.error('Failed to generate storyboard frames', {
			storyboardId: params.storyboardId,
			body,
			error,
		});
		return toMarketingErrorResponse(error);
	}
};
