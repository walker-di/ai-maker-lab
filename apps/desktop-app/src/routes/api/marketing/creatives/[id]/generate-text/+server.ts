import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getMarketingServices, toMarketingErrorResponse } from '$lib/server/marketing-service';

export const prerender = false;

export const POST: RequestHandler = async ({ params, request }) => {
	try {
		const { creativeService, productService, personaService } = await getMarketingServices();
		const { productId, personaId, type } = await request.json() as {
			productId: string;
			personaId: string;
			type: string;
		};
		const product = await productService.get(productId);
		if (!product) return json({ error: 'Product not found' }, { status: 404 });
		const persona = await personaService.get(personaId);
		if (!persona) return json({ error: 'Persona not found' }, { status: 404 });
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		return json(await creativeService.generateText(product, persona, type as any));
	} catch (error) {
		return toMarketingErrorResponse(error);
	}
};
