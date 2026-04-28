import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getMarketingServices, toMarketingErrorResponse } from '$lib/server/marketing-service';

export const prerender = false;

export const POST: RequestHandler = async ({ params }) => {
	try {
		const { clipService } = await getMarketingServices();
		const clip = await clipService.get(params.clipId);
		if (!clip) return json({ error: 'Clip not found' }, { status: 404 });
		const voice = process.env.AZURE_SPEECH_VOICE ?? 'en-US-JennyNeural';
		return json(await clipService.aiFill(clip, voice));
	} catch (error) {
		return toMarketingErrorResponse(error);
	}
};
