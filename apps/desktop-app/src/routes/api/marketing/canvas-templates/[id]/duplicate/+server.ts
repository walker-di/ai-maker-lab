import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getMarketingServices, toMarketingErrorResponse } from '$lib/server/marketing-service';

export const prerender = false;

export const POST: RequestHandler = async ({ params, request }) => {
	try {
		const { canvasTemplateService } = await getMarketingServices();
		const body = await request.json().catch(() => ({})) as { name?: string };
		return json(await canvasTemplateService.duplicate(params.id, body.name), { status: 201 });
	} catch (error) {
		return toMarketingErrorResponse(error);
	}
};
