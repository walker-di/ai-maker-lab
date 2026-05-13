import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getMarketingServices, toMarketingErrorResponse } from '$lib/server/marketing-service';
import { Marketing } from 'domain/shared';

export const prerender = false;

export const GET: RequestHandler = async () => {
	try {
		const { productService } = await getMarketingServices();
		return json(await productService.list());
	} catch (error) {
		return toMarketingErrorResponse(error);
	}
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { productService } = await getMarketingServices();
		const parsed = Marketing.CreateProductDtoSchema.safeParse(await request.json());
		if (!parsed.success) {
			return json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
		}
		return json(await productService.create(parsed.data), { status: 201 });
	} catch (error) {
		return toMarketingErrorResponse(error);
	}
};
