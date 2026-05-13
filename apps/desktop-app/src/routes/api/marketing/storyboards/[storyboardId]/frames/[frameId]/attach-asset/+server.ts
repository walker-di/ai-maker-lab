import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { Marketing } from 'domain/shared';
import { getMarketingServices, toMarketingErrorResponse } from '$lib/server/marketing-service';

export const prerender = false;

export const POST: RequestHandler = async ({ params, request }) => {
	try {
		const { storyboardService } = await getMarketingServices();
		const body = Marketing.AttachStoryboardFrameAssetDtoSchema.parse(await request.json());
		return json(await storyboardService.attachFrameAsset(params.storyboardId, params.frameId, body));
	} catch (error) {
		console.error('Failed to attach storyboard frame asset', error);
		return toMarketingErrorResponse(error);
	}
};
