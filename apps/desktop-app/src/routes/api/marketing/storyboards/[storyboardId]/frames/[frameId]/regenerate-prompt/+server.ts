import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { Marketing } from 'domain/shared';
import { getMarketingServices, toMarketingErrorResponse } from '$lib/server/marketing-service';

export const prerender = false;

export const POST: RequestHandler = async ({ params, request }) => {
	try {
		const { storyboardService } = await getMarketingServices();
		const body = Marketing.RegenerateStoryboardPromptDtoSchema.omit({ frameId: true }).parse(await request.json());
		return json(await storyboardService.regeneratePrompt(params.storyboardId, params.frameId, body.promptType));
	} catch (error) {
		console.error('Failed to regenerate storyboard prompt', error);
		return toMarketingErrorResponse(error);
	}
};
