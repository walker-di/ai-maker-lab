import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getMarketingServices, toMarketingErrorResponse } from '$lib/server/marketing-service';

export const prerender = false;

export const GET: RequestHandler = async ({ params }) => {
	try {
		const { clipService } = await getMarketingServices();
		const clip = await clipService.get(params.id);
		if (!clip) return json({ error: 'Clip not found' }, { status: 404 });
		return json(clip);
	} catch (error) {
		return toMarketingErrorResponse(error);
	}
};

export const PUT: RequestHandler = async ({ params, request }) => {
	try {
		const { clipService } = await getMarketingServices();
		const body = await request.json();
		return json(await clipService.update(params.id, body));
	} catch (error) {
		return toMarketingErrorResponse(error);
	}
};

export const DELETE: RequestHandler = async ({ params }) => {
	try {
		const { clipService } = await getMarketingServices();
		await clipService.delete(params.id);
		return json({ success: true });
	} catch (error) {
		return toMarketingErrorResponse(error);
	}
};
