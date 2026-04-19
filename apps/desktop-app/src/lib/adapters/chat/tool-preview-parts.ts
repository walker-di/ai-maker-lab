import type { ChatAssistantMessagePart, ChatToolInvocationInfo } from 'ui/source/chat/headless';
import { toToolPreviewParts } from './ai-sdk-message-parts';

function containsStructuredAssistantPart(
	assistantParts: readonly ChatAssistantMessagePart[],
): boolean {
	return assistantParts.some((part) => part.type !== 'text');
}

export function getToolPreviewParts(
	toolParts: readonly Pick<ChatToolInvocationInfo, 'output' | 'toolName'>[],
	assistantParts: readonly ChatAssistantMessagePart[],
): ChatAssistantMessagePart[] {
	if (containsStructuredAssistantPart(assistantParts)) {
		return [];
	}

	for (const toolPart of toolParts) {
		const previewParts = toToolPreviewParts(toolPart.output, toolPart.toolName);
		if (previewParts.length > 0) {
			return previewParts;
		}
	}

	return [];
}

export function getRenderedAssistantParts(
	assistantParts: readonly ChatAssistantMessagePart[],
	toolParts: readonly Pick<ChatToolInvocationInfo, 'output' | 'toolName'>[],
): ChatAssistantMessagePart[] {
	const previewParts = getToolPreviewParts(toolParts, assistantParts);
	if (previewParts.length === 0) {
		return [...assistantParts];
	}

	if (assistantParts.length === 0) {
		return previewParts;
	}

	return [...assistantParts, ...previewParts];
}
