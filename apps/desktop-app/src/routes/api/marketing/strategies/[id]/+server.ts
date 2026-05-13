import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getMarketingServices, toMarketingErrorResponse } from '$lib/server/marketing-service';

export const prerender = false;

export const GET: RequestHandler = async ({ params }) => {
	try {
		const { strategyService } = await getMarketingServices();
		const strategy = await strategyService.get(params.id);
		if (!strategy) return json({ error: 'Strategy not found' }, { status: 404 });
		return json(strategy);
	} catch (error) {
		return toMarketingErrorResponse(error);
	}
};

export const PUT: RequestHandler = async ({ params, request }) => {
	try {
		const { strategyService } = await getMarketingServices();
		const body = await request.json();
		return json(await strategyService.update(params.id, body));
	} catch (error) {
		return toMarketingErrorResponse(error);
	}
};

export const DELETE: RequestHandler = async ({ params }) => {
	try {
		const { strategyService } = await getMarketingServices();
		await strategyService.delete(params.id);
		return json({ success: true });
	} catch (error) {
		return toMarketingErrorResponse(error);
	}
};
