import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getMarketingServices, toMarketingErrorResponse } from '$lib/server/marketing-service';

export const prerender = false;

export const GET: RequestHandler = async ({ params }) => {
	try {
		const { transitionRepo } = await getMarketingServices();
		const transition = await transitionRepo.findById(params.id);
		if (!transition) return json({ error: 'Transition not found' }, { status: 404 });
		return json(transition);
	} catch (error) {
		return toMarketingErrorResponse(error);
	}
};

export const PUT: RequestHandler = async ({ params, request }) => {
	try {
		const { transitionRepo } = await getMarketingServices();
		const body = await request.json();
		return json(await transitionRepo.update(params.id, body));
	} catch (error) {
		return toMarketingErrorResponse(error);
	}
};

export const DELETE: RequestHandler = async ({ params }) => {
	try {
		const { transitionRepo } = await getMarketingServices();
		await transitionRepo.delete(params.id);
		return json({ success: true });
	} catch (error) {
		return toMarketingErrorResponse(error);
	}
};
