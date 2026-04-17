import type { ChatMessagePart } from 'domain/shared';
import type { ChatAssistantMessagePart } from 'ui/source';
import { extractAssistantAssetParts, getToolAssetExtractionOptions } from 'ui/source';

function getTextPartText(rawPart: unknown): string | undefined {
	if (
		typeof rawPart === 'object' &&
		rawPart !== null &&
		'type' in rawPart &&
		rawPart.type === 'text' &&
		'text' in rawPart &&
		typeof rawPart.text === 'string'
	) {
		return rawPart.text;
	}

	return undefined;
}

function mergeAdjacentTextParts(parts: ChatAssistantMessagePart[]): ChatAssistantMessagePart[] {
	const merged: ChatAssistantMessagePart[] = [];

	for (const part of parts) {
		const previous = merged.at(-1);
		if (part.type === 'text' && previous?.type === 'text') {
			merged[merged.length - 1] = {
				type: 'text',
				text: previous.text + part.text,
			};
			continue;
		}

		merged.push(part);
	}

	return merged.map((part) =>
		part.type === 'text' ? { type: 'text', text: part.text.trim() } : part,
	);
}

export function toAssistantMessageParts(rawParts: readonly unknown[] | undefined): ChatAssistantMessagePart[] {
	const normalized: ChatAssistantMessagePart[] = [];

	for (const rawPart of rawParts ?? []) {
		const text = getTextPartText(rawPart);
		if (text) {
			normalized.push({ type: 'text', text });
			continue;
		}

		const assetParts = extractAssistantAssetParts(rawPart);
		for (const assetPart of assetParts) {
			normalized.push(assetPart);
		}
	}

	return mergeAdjacentTextParts(normalized).filter(
		(part) => part.type !== 'text' || part.text.length > 0,
	);
}

export function toPersistedAssistantMessageParts(rawParts: readonly unknown[] | undefined): ChatMessagePart[] {
	return toAssistantMessageParts(rawParts);
}

export function extractAssistantText(rawParts: readonly unknown[] | undefined): string {
	return toAssistantMessageParts(rawParts)
		.filter((part): part is Extract<ChatAssistantMessagePart, { type: 'text' }> => part.type === 'text')
		.map((part) => part.text)
		.join('\n\n')
		.trim();
}

export function toToolPreviewParts(
	output: unknown,
	toolName?: string,
): ChatAssistantMessagePart[] {
	return extractAssistantAssetParts(output, getToolAssetExtractionOptions(toolName));
}
