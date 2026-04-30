import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { downloadNarrationModel, toMarketingErrorResponse } from '$lib/server/marketing-service';

export const prerender = false;

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json() as { provider?: string; model?: string };
		const provider = body.provider?.trim() || 'azure';
		const model = body.model?.trim() ?? '';
		if (!model) {
			return json({ error: 'model is required' }, { status: 400 });
		}
		return json(await downloadNarrationModel({ provider, model }));
	} catch (error) {
		console.error('Failed to download narration model', error);
		return toMarketingErrorResponse(error);
	}
};
