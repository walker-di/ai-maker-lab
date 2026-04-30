import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getNarrationOptions, toMarketingErrorResponse } from '$lib/server/marketing-service';

export const prerender = false;

export const GET: RequestHandler = async ({ url }) => {
	try {
		const provider = url.searchParams.get('provider')?.trim() || 'azure';
		const model = url.searchParams.get('model')?.trim();
		return json(await getNarrationOptions({ provider, model }));
	} catch (error) {
		console.error('Failed to list narration options', error);
		return toMarketingErrorResponse(error);
	}
};
