import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getMarketingServices, toMarketingErrorResponse } from '$lib/server/marketing-service';

export const prerender = false;

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { strategyService, productService, campaignService } = await getMarketingServices();
		const { productId, campaignId } = await request.json() as {
			productId: string;
			campaignId?: string;
		};
		if (!productId) return json({ error: 'productId is required' }, { status: 400 });
		const product = await productService.get(productId);
		if (!product) return json({ error: 'Product not found' }, { status: 404 });
		const campaign = campaignId ? await campaignService.get(campaignId) : undefined;
		return json(
			await strategyService.generate(product, campaign ?? undefined),
			{ status: 201 },
		);
	} catch (error) {
		return toMarketingErrorResponse(error);
	}
};
