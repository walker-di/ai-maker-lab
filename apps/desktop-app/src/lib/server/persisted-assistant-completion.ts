import type { ModelMessage } from 'ai';
import type { ChatMessagePart, ChatToolInvocation } from 'domain/shared';
import {
	extractToolInvocationsFromParts,
	extractToolInvocationsFromResponseMessages,
} from 'domain/application';
import {
	extractAssistantText,
	toPersistedAssistantMessageParts,
} from '../adapters/chat/ai-sdk-message-parts';

export interface PersistedAssistantCompletion {
	readonly text: string;
	readonly parts: ChatMessagePart[];
	readonly toolInvocations: ChatToolInvocation[];
}

export function extractPersistedAssistantCompletionFromUiMessageParts(
	rawParts: readonly unknown[] | undefined,
): PersistedAssistantCompletion {
	return {
		text: extractAssistantText(rawParts),
		parts: toPersistedAssistantMessageParts(rawParts),
		toolInvocations: extractToolInvocationsFromParts(rawParts),
	};
}

export function extractPersistedAssistantCompletionFromResponseMessages(
	responseMessages: readonly ModelMessage[] | undefined,
): PersistedAssistantCompletion {
	const assistantParts = (responseMessages ?? []).flatMap((message) =>
		message.role === 'assistant' && Array.isArray(message.content) ? message.content : [],
	);

	return {
		text: extractAssistantText(assistantParts),
		parts: toPersistedAssistantMessageParts(assistantParts),
		toolInvocations: extractToolInvocationsFromResponseMessages(responseMessages),
	};
}
