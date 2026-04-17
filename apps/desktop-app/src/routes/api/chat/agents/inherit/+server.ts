import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getChatServices, toChatErrorResponse } from '$lib/server/chat-services';

export const prerender = false;

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { catalogService } = await getChatServices();
		const { systemAgentId } = (await request.json()) as { systemAgentId: string };
		const result = await catalogService.inheritSystemAgent(systemAgentId);
		return json(result);
	} catch (error) {
		return toChatErrorResponse(error);
	}
};
