import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { Marketing } from 'domain/shared';
import { getMarketingServices, toMarketingErrorResponse } from '$lib/server/marketing-service';

export const prerender = false;

export const POST: RequestHandler = async ({ params, request }) => {
	try {
		const { storyboardService } = await getMarketingServices();
		const body = Marketing.InsertBlankStoryboardFrameDtoSchema.parse(await request.json().catch(() => ({})));
		return json(await storyboardService.insertBlankFrame(params.storyboardId, body), { status: 201 });
	} catch (error) {
		console.error('Failed to insert storyboard frame', error);
		return toMarketingErrorResponse(error);
	}
};
