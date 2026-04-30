import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { Marketing } from 'domain/shared';
import { getMarketingServices, toMarketingErrorResponse } from '$lib/server/marketing-service';

export const prerender = false;

export const POST: RequestHandler = async ({ params, request }) => {
	try {
		const { storyboardService } = await getMarketingServices();
		const body = Marketing.DuplicateFrameDtoSchema.parse(await request.json());
		return json(await storyboardService.duplicateFrame(params.storyboardId, params.frameId, body), { status: 201 });
	} catch (error) {
		console.error('Failed to duplicate storyboard frame', {
			storyboardId: params.storyboardId,
			frameId: params.frameId,
			error,
		});
		return toMarketingErrorResponse(error);
	}
};
