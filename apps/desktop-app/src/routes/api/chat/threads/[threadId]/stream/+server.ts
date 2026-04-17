import type { UIMessage } from 'ai';
import type { RequestHandler } from './$types';
import { getChatServices, toChatErrorResponse, normalizeMessageBody } from '$lib/server/chat-services';
import { extractPersistedAssistantCompletionFromUiMessageParts } from '$lib/server/persisted-assistant-completion';

const CHAT_DEBUG_PREFIX = '[chat-debug]';

function logChatDebug(label: string, payload: Record<string, unknown>) {
	console.info(`${CHAT_DEBUG_PREFIX} ${label}`, payload);
}

export const prerender = false;

export const POST: RequestHandler = async ({ params, request }) => {
	try {
		const { chatService, catalogService } = await getChatServices();
		const raw = (await request.json()) as Record<string, unknown>;
		const body = normalizeMessageBody(raw);
		const originalMessages = Array.isArray(raw.messages) ? raw.messages as UIMessage[] : [];
		const thread = await chatService.getThread(params.threadId);
		const defaultAgent = thread?.defaultAgentId
			? await catalogService.findAgent(thread.defaultAgentId)
			: null;

		logChatDebug('stream-route.request', {
			threadId: params.threadId,
			threadDefaultAgentId: thread?.defaultAgentId ?? null,
			threadParticipantIds: thread?.participantIds ?? [],
			defaultAgentModel: defaultAgent?.modelCard.registryId ?? null,
			parentMessageId: body.parentMessageId ?? null,
			toolOverrides: body.toolOverrides ?? {},
			attachmentCount: body.attachments?.length ?? 0,
			originalMessageCount: originalMessages.length,
			trigger: typeof raw.trigger === 'string' ? raw.trigger : null,
			messageId: typeof raw.messageId === 'string' ? raw.messageId : null,
			normalizedTextPreview: body.text.slice(0, 120),
		});

		const result = await chatService.sendMessage(
			params.threadId,
			body,
			{ persistAssistantOnModelFinish: false },
		);

		logChatDebug('stream-route.run-created', {
			threadId: params.threadId,
			runId: result.run.id,
			runAgentId: result.run.agentId,
			routerDecision: result.routerDecision,
		});

		return result.streamResult.toUIMessageStreamResponse({
			originalMessages,
			generateMessageId: () => crypto.randomUUID(),
			onFinish: async ({ responseMessage }) => {
				if (responseMessage.role !== 'assistant') {
					return;
				}

				try {
					const completion = extractPersistedAssistantCompletionFromUiMessageParts(
						responseMessage.parts,
					);
					logChatDebug('stream-route.on-finish', {
						threadId: params.threadId,
						runAgentId: result.run.agentId,
						responseRole: responseMessage.role,
						partTypes: responseMessage.parts.map((part) =>
							typeof part === 'object' && part !== null && 'type' in part
								? part.type
								: 'unknown'
						),
						toolInvocations: completion.toolInvocations,
					});

					await chatService.persistAssistantCompletion({
						threadId: params.threadId,
						agentId: result.run.agentId,
						content: completion.text,
						parentMessageId: body.parentMessageId,
						parts: completion.parts,
						toolInvocations: completion.toolInvocations,
					});
				} catch (persistError) {
					// The client has already received the stream; we can only log
					// here. Surface as a structured warning so it's not silent.
					console.warn(
						`${CHAT_DEBUG_PREFIX} stream-route.persist-failed`,
						{
							threadId: params.threadId,
							runAgentId: result.run.agentId,
							error:
								persistError instanceof Error
									? persistError.message
									: String(persistError),
						},
					);
				}
			},
		});
	} catch (error) {
		return toChatErrorResponse(error);
	}
};
