import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getMarketingServices, toMarketingErrorResponse } from '$lib/server/marketing-service';

export const prerender = false;

export const GET: RequestHandler = async ({ url }) => {
	try {
		const { creativeService, creativeRepo } = await getMarketingServices();
		const productId = url.searchParams.get('productId');
		if (productId) return json(await creativeService.listByProduct(productId));
		return json(await creativeRepo.findAll());
	} catch (error) {
		return toMarketingErrorResponse(error);
	}
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { creativeService } = await getMarketingServices();
		const body = await request.json();
		return json(await creativeService.create(body), { status: 201 });
	} catch (error) {
		return toMarketingErrorResponse(error);
	}
};
