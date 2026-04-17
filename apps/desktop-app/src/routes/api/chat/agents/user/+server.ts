import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getChatServices, toChatErrorResponse } from '$lib/server/chat-services';

export const prerender = false;

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { catalogService } = await getChatServices();
		const body = (await request.json()) as {
			name: string;
			description: string;
			modelCardId: string;
			systemPrompt: string;
			toolOverrides?: Record<string, boolean>;
		};
		const result = await catalogService.createUserAgent(body);
		return json(result, { status: 201 });
	} catch (error) {
		return toChatErrorResponse(error);
	}
};
