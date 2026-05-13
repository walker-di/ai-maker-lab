import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getMarketingServices, toMarketingErrorResponse } from '$lib/server/marketing-service';
import { Marketing } from 'domain/shared';

export const prerender = false;

export const GET: RequestHandler = async ({ url }) => {
	try {
		const { personaService, personaRepo } = await getMarketingServices();
		const productId = url.searchParams.get('productId');
		if (productId) return json(await personaService.listByProduct(productId));
		return json(await personaRepo.findAll());
	} catch (error) {
		return toMarketingErrorResponse(error);
	}
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { productService, personaService } = await getMarketingServices();
		const body = await request.json();
		const parsed = Marketing.CreatePersonaDtoSchema.safeParse(body);
		if (!parsed.success) {
			return json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
		}
		if (!parsed.data.productId) {
			return json({ error: 'productId is required' }, { status: 400 });
		}
		const product = await productService.get(parsed.data.productId);
		if (!product) return json({ error: 'Product not found' }, { status: 404 });
		return json(await personaService.create(parsed.data), { status: 201 });
	} catch (error) {
		return toMarketingErrorResponse(error);
	}
};
