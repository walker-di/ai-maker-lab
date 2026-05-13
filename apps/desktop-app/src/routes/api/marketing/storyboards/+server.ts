import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { Marketing } from 'domain/shared';
import { getMarketingServices, toMarketingErrorResponse } from '$lib/server/marketing-service';

export const prerender = false;

export const GET: RequestHandler = async () => {
	try {
		const { storyboardService } = await getMarketingServices();
		return json(await storyboardService.list());
	} catch (error) {
		console.error('Failed to list storyboards', error);
		return toMarketingErrorResponse(error);
	}
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { storyboardService } = await getMarketingServices();
		const body = Marketing.CreateStoryboardDtoSchema.parse(await request.json());
		return json(await storyboardService.create(body), { status: 201 });
	} catch (error) {
		console.error('Failed to create storyboard', error);
		return toMarketingErrorResponse(error);
	}
};
