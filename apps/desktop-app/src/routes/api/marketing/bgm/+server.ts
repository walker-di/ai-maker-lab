import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getMarketingServices, toMarketingErrorResponse } from '$lib/server/marketing-service';

export const prerender = false;

export const GET: RequestHandler = async () => {
	try {
		const { bgmService } = await getMarketingServices();
		return json(await bgmService.list());
	} catch (error) {
		return toMarketingErrorResponse(error);
	}
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { bgmService } = await getMarketingServices();
		const body = await request.json();
		return json(await bgmService.create(body), { status: 201 });
	} catch (error) {
		return toMarketingErrorResponse(error);
	}
};
