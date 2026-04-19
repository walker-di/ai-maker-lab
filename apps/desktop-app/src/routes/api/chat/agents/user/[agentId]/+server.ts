import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getChatServices, toChatErrorResponse } from '$lib/server/chat-services';

export const prerender = false;

export const PATCH: RequestHandler = async ({ params, request }) => {
	try {
		const { catalogService } = await getChatServices();
		const body = (await request.json()) as {
			modelCardId?: string;
			systemPrompt?: string;
			toolOverrides?: Record<string, boolean>;
			userOverrides?: Record<string, unknown>;
		};
		const result = await catalogService.updateUserAgent(params.agentId, body);
		return json(result);
	} catch (error) {
		return toChatErrorResponse(error);
	}
};
