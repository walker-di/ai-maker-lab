import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getMarketingServices, toMarketingErrorResponse } from '$lib/server/marketing-service';

export const prerender = false;

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { bgmService } = await getMarketingServices();
		const { prompt, duration, name } = await request.json() as {
			prompt: string;
			duration?: number;
			name?: string;
		};
		if (!prompt) return json({ error: 'prompt is required' }, { status: 400 });
		return json(
			await bgmService.generate(prompt, duration ?? 30, name ?? 'Generated BGM'),
			{ status: 201 },
		);
	} catch (error) {
		return toMarketingErrorResponse(error);
	}
};
