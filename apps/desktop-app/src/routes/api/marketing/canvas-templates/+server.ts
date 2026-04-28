import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getMarketingServices, toMarketingErrorResponse } from '$lib/server/marketing-service';

export const prerender = false;

export const GET: RequestHandler = async () => {
	try {
		const { canvasTemplateService } = await getMarketingServices();
		return json(await canvasTemplateService.list());
	} catch (error) {
		return toMarketingErrorResponse(error);
	}
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { canvasTemplateService } = await getMarketingServices();
		const body = await request.json();
		return json(await canvasTemplateService.create(body), { status: 201 });
	} catch (error) {
		return toMarketingErrorResponse(error);
	}
};
