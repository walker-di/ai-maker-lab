import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getChatServices, toChatErrorResponse } from '$lib/server/chat-services';

export const prerender = false;

export const GET: RequestHandler = async ({ params }) => {
	try {
		const { chatService } = await getChatServices();
		return json(await chatService.getMessages(params.threadId));
	} catch (error) {
		return toChatErrorResponse(error);
	}
};

export const POST: RequestHandler = async ({ params, request }) => {
	try {
		const { chatService } = await getChatServices();
		const body = await request.json() as {
			text: string;
			parentMessageId?: string;
			attachments?: Array<{
				type: 'image' | 'file' | 'pdf' | 'video' | 'text';
				name: string;
				mimeType: string;
				url?: string;
				content?: string;
			}>;
		};

		const result = await chatService.sendMessage(params.threadId, body);

		const fullText = await result.streamResult.text;
		const usage = await result.streamResult.usage;
		const finishReason = await result.streamResult.finishReason;

		return json({
			userMessage: result.userMessage,
			run: result.run,
			routerDecision: result.routerDecision,
			response: {
				text: fullText,
				usage,
				finishReason,
			},
		});
	} catch (error) {
		return toChatErrorResponse(error);
	}
};
