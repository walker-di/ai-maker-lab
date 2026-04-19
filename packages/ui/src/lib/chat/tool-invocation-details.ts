import type { ToolInvocationInfo } from './types.js';
import {
	extractAssistantAssetParts,
	getAssistantPreviewImageUrl,
	getToolAssetExtractionOptions,
} from './tool-asset-parts.js';

type JsonRecord = Record<string, unknown>;

export interface ToolSourceItem {
	readonly title: string;
	readonly url?: string;
	readonly snippet?: string;
}

export interface ToolFileItem {
	readonly name: string;
	readonly url?: string;
}

function isRecord(value: unknown): value is JsonRecord {
	return typeof value === 'object' && value !== null;
}

function getString(value: unknown): string | undefined {
	return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function getStringFromKeys(record: JsonRecord, keys: readonly string[]): string | undefined {
	for (const key of keys) {
		const value = getString(record[key]);
		if (value) {
			return value;
		}
	}
	return undefined;
}

function getRecord(value: unknown): JsonRecord | null {
	return isRecord(value) ? value : null;
}

function getRecordArray(value: unknown): JsonRecord[] {
	if (!Array.isArray(value)) {
		return [];
	}
	return value.filter(isRecord);
}

function flattenCandidateArrays(record: JsonRecord | null, keys: readonly string[]): JsonRecord[] {
	if (!record) {
		return [];
	}
	for (const key of keys) {
		const items = getRecordArray(record[key]);
		if (items.length > 0) {
			return items;
		}
	}
	return [];
}

export function getToolQuery(invocation: ToolInvocationInfo): string | undefined {
	const input = getRecord(invocation.input);
	const output = getRecord(invocation.output);
	return (
		input && getStringFromKeys(input, ['query', 'prompt', 'url', 'location', 'city', 'address'])
	) ?? (
		output && getStringFromKeys(output, ['query', 'prompt', 'url', 'location', 'city', 'address'])
	) ?? undefined;
}

export function getToolUrl(invocation: ToolInvocationInfo): string | undefined {
	const input = getRecord(invocation.input);
	const output = getRecord(invocation.output);
	return (
		input && getStringFromKeys(input, ['url', 'href', 'sourceUrl'])
	) ?? (
		output && getStringFromKeys(output, ['url', 'href', 'sourceUrl'])
	) ?? undefined;
}

export function getToolCode(invocation: ToolInvocationInfo): string | undefined {
	const input = getRecord(invocation.input);
	const output = getRecord(invocation.output);
	return (
		input && getStringFromKeys(input, ['code', 'script', 'source'])
	) ?? (
		output && getStringFromKeys(output, ['code', 'script', 'stdout', 'stderr'])
	) ?? undefined;
}

export function getToolPreviewUrl(invocation: ToolInvocationInfo): string | undefined {
	return getAssistantPreviewImageUrl(
		invocation.output,
		getToolAssetExtractionOptions(invocation.toolName),
	);
}

export function getToolSources(invocation: ToolInvocationInfo): ToolSourceItem[] {
	const output = getRecord(invocation.output);
	const items = flattenCandidateArrays(output, ['sources', 'results', 'places']);
	return items
		.map((item) => ({
			title: getStringFromKeys(item, ['title', 'name']) ?? 'Untitled result',
			url: getStringFromKeys(item, ['url', 'href', 'link']),
			snippet: getStringFromKeys(item, ['snippet', 'description', 'summary', 'formattedAddress']),
		}))
		.filter((item) => item.title || item.url || item.snippet);
}

export function getToolFiles(invocation: ToolInvocationInfo): ToolFileItem[] {
	const assetFiles = extractAssistantAssetParts(invocation.output).flatMap((part) =>
		part.type === 'file'
			? [{
				name: part.name,
				url: part.url,
			}]
			: [],
	);
	if (assetFiles.length > 0) {
		return assetFiles;
	}

	const output = getRecord(invocation.output);
	const items = flattenCandidateArrays(output, ['files', 'matches', 'artifacts']);
	return items
		.map((item) => ({
			name: getStringFromKeys(item, ['name', 'filename', 'title']) ?? 'Generated file',
			url: getStringFromKeys(item, ['url', 'href', 'downloadUrl']),
		}))
		.filter((item) => item.name);
}

export function getToolLocationSummary(invocation: ToolInvocationInfo): string | undefined {
	const input = getRecord(invocation.input);
	const output = getRecord(invocation.output);
	return (
		input && getStringFromKeys(input, ['location', 'address', 'city'])
	) ?? (
		output && getStringFromKeys(output, ['formattedAddress', 'address', 'location', 'city'])
	) ?? undefined;
}
