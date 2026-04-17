import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getChatServices, toChatErrorResponse } from '$lib/server/chat-services';

export const prerender = false;

export const GET: RequestHandler = async ({ params }) => {
	try {
		const { chatService } = await getChatServices();
		return json(await chatService.getSubthread(params.threadId, params.parentMessageId));
	} catch (error) {
		return toChatErrorResponse(error);
	}
};
