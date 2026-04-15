import type { RequestHandler } from './$types';
import { getChatServices, toChatErrorResponse, normalizeMessageBody } from '$lib/server/chat-services';

export const prerender = false;

export const POST: RequestHandler = async ({ params, request }) => {
	try {
		const { chatService } = await getChatServices();
		const raw = (await request.json()) as Record<string, unknown>;
		const body = normalizeMessageBody(raw);

		const result = await chatService.sendMessage(params.threadId, body);

		return result.streamResult.toUIMessageStreamResponse();
	} catch (error) {
		return toChatErrorResponse(error);
	}
};
