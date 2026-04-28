import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getMarketingServices, toMarketingErrorResponse } from '$lib/server/marketing-service';
import { Marketing } from 'domain/shared';

export const prerender = false;

export const GET: RequestHandler = async ({ params }) => {
	try {
		const { productService } = await getMarketingServices();
		const product = await productService.get(params.productId);
		if (!product) return json({ error: 'Product not found' }, { status: 404 });
		return json(product);
	} catch (error) {
		return toMarketingErrorResponse(error);
	}
};

export const PUT: RequestHandler = async ({ params, request }) => {
	try {
		const { productService } = await getMarketingServices();
		const parsed = Marketing.UpdateProductDtoSchema.safeParse(await request.json());
		if (!parsed.success) {
			return json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
		}
		const product = await productService.get(params.productId);
		if (!product) return json({ error: 'Product not found' }, { status: 404 });
		return json(await productService.update(params.productId, parsed.data));
	} catch (error) {
		return toMarketingErrorResponse(error);
	}
};

export const DELETE: RequestHandler = async ({ params }) => {
	try {
		const { productService } = await getMarketingServices();
		const product = await productService.get(params.productId);
		if (!product) return json({ error: 'Product not found' }, { status: 404 });
		await productService.delete(params.productId);
		return json({ success: true });
	} catch (error) {
		return toMarketingErrorResponse(error);
	}
};
