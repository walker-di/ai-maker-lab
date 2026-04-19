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

export const PATCH: RequestHandler = async ({ params, request }) => {
	try {
		const { chatService } = await getChatServices();
		const body = (await request.json()) as {
			title?: string;
			defaultAgentId?: string;
			addParticipantId?: string;
			removeParticipantId?: string;
		};
		let applied = false;
		let updated: Awaited<ReturnType<typeof chatService.getThread>> | undefined;

		if (typeof body.title === 'string') {
			updated = await chatService.updateThreadTitle(params.threadId, body.title);
			applied = true;
		}
		if (body.addParticipantId) {
			updated = await chatService.addThreadParticipant(params.threadId, body.addParticipantId);
			applied = true;
		}
		if (body.removeParticipantId) {
			updated = await chatService.removeThreadParticipant(params.threadId, body.removeParticipantId);
			applied = true;
		}
		if (body.defaultAgentId) {
			updated = await chatService.setThreadAgent(params.threadId, body.defaultAgentId);
			applied = true;
		}

		if (!applied) {
			return json({ error: 'No supported fields to update' }, { status: 400 });
		}
		return json(updated);
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
