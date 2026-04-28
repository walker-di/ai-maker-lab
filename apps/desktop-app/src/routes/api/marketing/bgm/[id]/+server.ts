import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getMarketingServices, toMarketingErrorResponse } from '$lib/server/marketing-service';

export const prerender = false;

export const GET: RequestHandler = async ({ params }) => {
	try {
		const { bgmService } = await getMarketingServices();
		const bgm = await bgmService.get(params.id);
		if (!bgm) return json({ error: 'BGM not found' }, { status: 404 });
		return json(bgm);
	} catch (error) {
		return toMarketingErrorResponse(error);
	}
};

export const PUT: RequestHandler = async ({ params, request }) => {
	try {
		const { bgmService } = await getMarketingServices();
		const body = await request.json();
		return json(await bgmService.update(params.id, body));
	} catch (error) {
		return toMarketingErrorResponse(error);
	}
};

export const DELETE: RequestHandler = async ({ params }) => {
	try {
		const { bgmService } = await getMarketingServices();
		await bgmService.delete(params.id);
		return json({ success: true });
	} catch (error) {
		return toMarketingErrorResponse(error);
	}
};
