import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getMarketingServices, toMarketingErrorResponse } from '$lib/server/marketing-service';

export const prerender = false;

export const POST: RequestHandler = async ({ params, request }) => {
	try {
		const { productService, personaService } = await getMarketingServices();
		const product = await productService.get(params.productId);
		if (!product) return json({ error: 'Product not found' }, { status: 404 });
		const body = await request.json().catch(() => ({})) as { count?: number };
		return json(await personaService.generateForProduct(product, body.count ?? 3), { status: 201 });
	} catch (error) {
		return toMarketingErrorResponse(error);
	}
};
