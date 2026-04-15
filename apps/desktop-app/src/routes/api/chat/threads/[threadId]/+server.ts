import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getChatServices, toChatErrorResponse } from '$lib/server/chat-services';

export const prerender = false;

export const GET: RequestHandler = async ({ params }) => {
	try {
		const { chatService } = await getChatServices();
		const thread = await chatService.getThread(params.threadId);
		if (!thread) {
			return json({ error: 'Thread not found' }, { status: 404 });
		}
		return json(thread);
	} catch (error) {
		return toChatErrorResponse(error);
	}
};

export const DELETE: RequestHandler = async ({ params }) => {
	try {
		const { chatService } = await getChatServices();
		await chatService.deleteThread(params.threadId);
		return json({ ok: true });
	} catch (error) {
		return toChatErrorResponse(error);
	}
};
