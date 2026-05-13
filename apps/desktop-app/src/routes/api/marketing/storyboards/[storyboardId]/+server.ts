import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getMarketingServices, toMarketingErrorResponse } from '$lib/server/marketing-service';

export const prerender = false;

export const GET: RequestHandler = async ({ params }) => {
	try {
		const { storyboardService } = await getMarketingServices();
		const storyboard = await storyboardService.get(params.storyboardId);
		if (!storyboard) return json({ error: 'Storyboard not found' }, { status: 404 });
		return json(storyboard);
	} catch (error) {
		console.error('Failed to get storyboard', error);
		return toMarketingErrorResponse(error);
	}
};
