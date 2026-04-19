import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getChatServices, toChatErrorResponse } from '$lib/server/chat-services';

export const prerender = false;

export const GET: RequestHandler = async () => {
	try {
		const { chatService } = await getChatServices();
		return json(await chatService.listThreads());
	} catch (error) {
		return toChatErrorResponse(error);
	}
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { chatService } = await getChatServices();
		const body = await request.json() as {
			title: string;
			participantIds: string[];
			defaultAgentId?: string;
		};
		return json(await chatService.createThread(body));
	} catch (error) {
		return toChatErrorResponse(error);
	}
};
