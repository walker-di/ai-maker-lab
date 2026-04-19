import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getChatServices, toChatErrorResponse } from '$lib/server/chat-services';

export const prerender = false;

export const GET: RequestHandler = async () => {
	try {
		const { catalogService } = await getChatServices();
		return json(await catalogService.listAgents());
	} catch (error) {
		return toChatErrorResponse(error);
	}
};
