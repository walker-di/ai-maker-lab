import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getMarketingServices, toMarketingErrorResponse } from '$lib/server/marketing-service';

export const prerender = false;

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { productService } = await getMarketingServices();
		const { name } = await request.json() as { name: string };
		if (!name) return json({ error: 'name is required' }, { status: 400 });
		return json(await productService.generateFromName(name), { status: 201 });
	} catch (error) {
		return toMarketingErrorResponse(error);
	}
};
