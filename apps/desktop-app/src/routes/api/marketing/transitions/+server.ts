import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getMarketingServices, toMarketingErrorResponse } from '$lib/server/marketing-service';

export const prerender = false;

export const GET: RequestHandler = async () => {
	try {
		const { transitionRepo } = await getMarketingServices();
		return json(await transitionRepo.findAll());
	} catch (error) {
		return toMarketingErrorResponse(error);
	}
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { transitionRepo } = await getMarketingServices();
		const body = await request.json();
		return json(await transitionRepo.create(body), { status: 201 });
	} catch (error) {
		return toMarketingErrorResponse(error);
	}
};
