import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getMarketingServices, toMarketingErrorResponse } from '$lib/server/marketing-service';

export const prerender = false;

export const GET: RequestHandler = async () => {
	try {
		const { assetStorage } = await getMarketingServices();
		const audio = await assetStorage.listAudio();
		return json(audio.map((a) => ({ url: a.url })));
	} catch (error) {
		return toMarketingErrorResponse(error);
	}
};
