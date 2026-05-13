import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getMarketingServices, toMarketingErrorResponse } from '$lib/server/marketing-service';

export const prerender = false;

export const POST: RequestHandler = async ({ params, request }) => {
	try {
		const { creativeService } = await getMarketingServices();
		const creative = await creativeService.get(params.id);
		if (!creative) return json({ error: 'Creative not found' }, { status: 404 });
		const { prompt } = await request.json() as { prompt: string; style?: string };
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		return json(await creativeService.generateImage(creative as any, prompt));
	} catch (error) {
		return toMarketingErrorResponse(error);
	}
};
