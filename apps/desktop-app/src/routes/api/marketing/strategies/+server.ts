import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getMarketingServices, toMarketingErrorResponse } from '$lib/server/marketing-service';

export const prerender = false;

export const GET: RequestHandler = async ({ url }) => {
	try {
		const { strategyService } = await getMarketingServices();
		const productId = url.searchParams.get('productId');
		if (productId) return json(await strategyService.listByProduct(productId));
		return json(await strategyService.list());
	} catch (error) {
		return toMarketingErrorResponse(error);
	}
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { strategyService } = await getMarketingServices();
		const body = await request.json();
		return json(await strategyService.create(body), { status: 201 });
	} catch (error) {
		return toMarketingErrorResponse(error);
	}
};
