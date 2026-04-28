import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getMarketingServices, toMarketingErrorResponse } from '$lib/server/marketing-service';
import { Marketing } from 'domain/shared';

export const prerender = false;

export const GET: RequestHandler = async ({ params }) => {
	try {
		const { productService, personaService } = await getMarketingServices();
		const product = await productService.get(params.productId);
		if (!product) return json({ error: 'Product not found' }, { status: 404 });
		return json(await personaService.listByProduct(params.productId));
	} catch (error) {
		return toMarketingErrorResponse(error);
	}
};

export const POST: RequestHandler = async ({ params, request }) => {
	try {
		const { productService, personaService } = await getMarketingServices();
		const product = await productService.get(params.productId);
		if (!product) return json({ error: 'Product not found' }, { status: 404 });
		const parsed = Marketing.CreatePersonaDtoSchema.safeParse({
			...(await request.json()),
			productId: params.productId,
		});
		if (!parsed.success) {
			return json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
		}
		return json(await personaService.create(parsed.data), { status: 201 });
	} catch (error) {
		return toMarketingErrorResponse(error);
	}
};
