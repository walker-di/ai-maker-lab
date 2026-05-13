import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getNarrationModelStatus, toMarketingErrorResponse } from '$lib/server/marketing-service';

export const prerender = false;

export const GET: RequestHandler = async ({ url }) => {
	try {
		const provider = url.searchParams.get('provider')?.trim() || 'azure';
		const model = url.searchParams.get('model')?.trim() ?? '';
		if (!model) {
			return json({ error: 'model query parameter is required' }, { status: 400 });
		}
		return json(await getNarrationModelStatus({ provider, model }));
	} catch (error) {
		console.error('Failed to get narration model status', error);
		return toMarketingErrorResponse(error);
	}
};
