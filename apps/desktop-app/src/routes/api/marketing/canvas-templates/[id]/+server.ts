import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getMarketingServices, toMarketingErrorResponse } from '$lib/server/marketing-service';

export const prerender = false;

export const GET: RequestHandler = async ({ params }) => {
	try {
		const { canvasTemplateService } = await getMarketingServices();
		const template = await canvasTemplateService.get(params.id);
		if (!template) return json({ error: 'Canvas template not found' }, { status: 404 });
		return json(template);
	} catch (error) {
		return toMarketingErrorResponse(error);
	}
};

export const PUT: RequestHandler = async ({ params, request }) => {
	try {
		const { canvasTemplateService } = await getMarketingServices();
		const body = await request.json();
		return json(await canvasTemplateService.update(params.id, body));
	} catch (error) {
		return toMarketingErrorResponse(error);
	}
};

export const DELETE: RequestHandler = async ({ params }) => {
	try {
		const { canvasTemplateService } = await getMarketingServices();
		await canvasTemplateService.delete(params.id);
		return json({ success: true });
	} catch (error) {
		return toMarketingErrorResponse(error);
	}
};
