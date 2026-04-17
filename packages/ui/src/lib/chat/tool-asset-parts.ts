import type { AssistantFilePart, AssistantImagePart, AssistantMessagePart } from './types.js';

type JsonRecord = Record<string, unknown>;
type AssetTypeHint = 'image' | 'file';
type AssetContext = {
	mimeType?: string;
	name?: string;
	typeHint?: AssetTypeHint;
};
export interface AssistantAssetExtractionOptions {
	defaultMimeType?: string;
	defaultName?: string;
	defaultTypeHint?: 'image' | 'file';
}

const DIRECT_URL_KEYS = ['url', 'src', 'href', 'downloadUrl', 'dataUrl', 'imageUrl', 'image_url', 'uri'] as const;
const DIRECT_DATA_KEYS = ['data', 'base64', 'b64Json', 'b64_json'] as const;
const DIRECT_NAME_KEYS = ['filename', 'name', 'title'] as const;
const DIRECT_ALT_KEYS = ['alt', 'description'] as const;
const DIRECT_MIME_KEYS = ['mimeType', 'mime_type', 'mediaType', 'contentType'] as const;
const TYPE_HINT_KEYS = ['type', 'kind', 'role'] as const;
const URL_PROTOCOL_PATTERN = /^(data:|blob:|https?:|file:|\/)/i;
const IMAGE_EXTENSION_PATTERN = /\.(avif|bmp|gif|jpe?g|png|svg|webp)(?:$|[?#])/i;
const FILE_EXTENSION_PATTERN =
	/\.(avif|bmp|csv|docx?|gif|jpe?g|json|md|mov|mp3|mp4|pdf|png|pptx?|svg|txt|wav|webm|webp|xlsx?|zip)(?:$|[?#])/i;
const BASE64_PATTERN = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

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

function normalizeAssetUrl(value: string, mimeType?: string): string | undefined {
	const normalized = value.trim();
	if (!normalized) {
		return undefined;
	}

	if (URL_PROTOCOL_PATTERN.test(normalized)) {
		return normalized;
	}

	if (mimeType && BASE64_PATTERN.test(normalized) && normalized.length >= 32) {
		return `data:${mimeType};base64,${normalized}`;
	}

	return undefined;
}

function parseJsonLikeString(value: string): unknown | undefined {
	const normalized = value.trim();
	if (!normalized.startsWith('{') && !normalized.startsWith('[')) {
		return undefined;
	}

	try {
		return JSON.parse(normalized);
	} catch {
		return undefined;
	}
}

function inferMimeTypeFromUrl(url: string): string | undefined {
	if (IMAGE_EXTENSION_PATTERN.test(url)) {
		const match = url.match(IMAGE_EXTENSION_PATTERN)?.[0]?.toLowerCase() ?? '';
		if (match.includes('png')) return 'image/png';
		if (match.includes('webp')) return 'image/webp';
		if (match.includes('svg')) return 'image/svg+xml';
		if (match.includes('gif')) return 'image/gif';
		if (match.includes('bmp')) return 'image/bmp';
		return 'image/jpeg';
	}

	return undefined;
}

export function getToolAssetExtractionOptions(toolName?: string): AssistantAssetExtractionOptions {
	if (toolName === 'image_generation') {
		return {
			defaultMimeType: 'image/png',
			defaultTypeHint: 'image',
		};
	}

	return {};
}

function isImageMimeType(mimeType?: string): boolean {
	return Boolean(mimeType?.startsWith('image/'));
}

function inferTypeHintFromValue(value: unknown, fallback?: AssetTypeHint): AssetTypeHint | undefined {
	const normalized = getString(value)?.toLowerCase();
	if (!normalized) {
		return fallback;
	}
	if (normalized.includes('image')) {
		return 'image';
	}
	if (normalized.includes('file') || normalized.includes('artifact')) {
		return 'file';
	}
	return fallback;
}

function inferTypeHintFromKey(key: string, fallback?: AssetTypeHint): AssetTypeHint | undefined {
	const normalized = key.toLowerCase();
	if (normalized.includes('image') || normalized.includes('b64_json')) {
		return 'image';
	}
	if (
		normalized.includes('file') ||
		normalized.includes('artifact') ||
		normalized.includes('attachment')
	) {
		return 'file';
	}
	return fallback;
}

function classifyAsset(
	url: string,
	mimeType: string | undefined,
	typeHint: AssetTypeHint | undefined,
): AssetTypeHint | null {
	if (typeHint === 'image' || isImageMimeType(mimeType) || url.startsWith('data:image/')) {
		return 'image';
	}

	const inferredMimeType = mimeType ?? inferMimeTypeFromUrl(url);
	if (isImageMimeType(inferredMimeType)) {
		return 'image';
	}

	if (typeHint === 'file' || inferredMimeType || FILE_EXTENSION_PATTERN.test(url)) {
		return 'file';
	}

	return null;
}

function buildAssetPart(
	url: string,
	mimeType: string | undefined,
	name: string | undefined,
	alt: string | undefined,
	typeHint: AssetTypeHint | undefined,
): AssistantMessagePart | null {
	const classification = classifyAsset(url, mimeType, typeHint);
	if (classification === 'image') {
		const imagePart: AssistantImagePart = {
			type: 'image',
			url,
			mimeType: mimeType ?? inferMimeTypeFromUrl(url),
			name,
			alt: alt ?? name ?? 'Generated image',
		};
		return imagePart;
	}

	if (classification === 'file') {
		const filePart: AssistantFilePart = {
			type: 'file',
			url,
			mimeType,
			name: name ?? 'Generated file',
		};
		return filePart;
	}

	return null;
}

function hasAssetUrl(
	part: AssistantMessagePart,
): part is AssistantImagePart | AssistantFilePart {
	return part.type === 'image' || part.type === 'file';
}

function pushUniquePart(target: AssistantMessagePart[], part: AssistantMessagePart) {
	if (
		hasAssetUrl(part) &&
		target.some(
			(existing) =>
				hasAssetUrl(existing) &&
				existing.type === part.type &&
				existing.url === part.url,
		)
	) {
		return;
	}
	target.push(part);
}

function collectAssistantAssetParts(
	value: unknown,
	seen: WeakSet<object>,
	depth: number,
	context: AssetContext,
	results: AssistantMessagePart[],
) {
	if (depth > 6) {
		return;
	}

	if (typeof value === 'string') {
		const parsed = parseJsonLikeString(value);
		if (parsed !== undefined) {
			collectAssistantAssetParts(parsed, seen, depth + 1, context, results);
			return;
		}

		const fallbackMimeType =
			context.mimeType ?? (context.typeHint === 'image' ? 'image/png' : undefined);
		const url = normalizeAssetUrl(value, fallbackMimeType);
		if (!url) {
			return;
		}

		const part = buildAssetPart(url, fallbackMimeType, context.name, undefined, context.typeHint);
		if (part) {
			pushUniquePart(results, part);
		}
		return;
	}

	if (Array.isArray(value)) {
		for (const item of value) {
			collectAssistantAssetParts(item, seen, depth + 1, context, results);
		}
		return;
	}

	if (!isRecord(value)) {
		return;
	}

	if (seen.has(value)) {
		return;
	}
	seen.add(value);

	const mimeType = getStringFromKeys(value, DIRECT_MIME_KEYS) ?? context.mimeType;
	const name = getStringFromKeys(value, DIRECT_NAME_KEYS) ?? context.name;
	const alt = getStringFromKeys(value, DIRECT_ALT_KEYS);
	let typeHint =
		TYPE_HINT_KEYS.reduce<AssetTypeHint | undefined>(
			(current, key) => inferTypeHintFromValue(value[key], current),
			context.typeHint,
		);

	for (const key of ['imageUrl', 'image_url', 'b64Json', 'b64_json'] as const) {
		if (getString(value[key])) {
			typeHint = inferTypeHintFromKey(key, typeHint);
		}
	}

	for (const key of DIRECT_URL_KEYS) {
		const rawUrl = getString(value[key]);
		const url = rawUrl ? normalizeAssetUrl(rawUrl, mimeType) : undefined;
		if (!url) {
			continue;
		}

		const part = buildAssetPart(url, mimeType, name, alt, inferTypeHintFromKey(key, typeHint));
		if (part) {
			pushUniquePart(results, part);
		}
	}

	for (const key of DIRECT_DATA_KEYS) {
		const rawData = getString(value[key]);
		const url = rawData ? normalizeAssetUrl(rawData, mimeType) : undefined;
		if (!url) {
			continue;
		}

		const part = buildAssetPart(url, mimeType, name, alt, inferTypeHintFromKey(key, typeHint));
		if (part) {
			pushUniquePart(results, part);
		}
	}

	for (const [key, child] of Object.entries(value)) {
		collectAssistantAssetParts(
			child,
			seen,
			depth + 1,
			{
				mimeType,
				name,
				typeHint: inferTypeHintFromKey(key, typeHint),
			},
			results,
		);
	}
}

export function extractAssistantAssetParts(
	value: unknown,
	options: AssistantAssetExtractionOptions = {},
): AssistantMessagePart[] {
	const results: AssistantMessagePart[] = [];
	collectAssistantAssetParts(
		value,
		new WeakSet<object>(),
		0,
		{
			mimeType: options.defaultMimeType,
			name: options.defaultName,
			typeHint: options.defaultTypeHint,
		},
		results,
	);
	return results;
}

export function getAssistantPreviewImageUrl(
	value: unknown,
	options: AssistantAssetExtractionOptions = {},
): string | undefined {
	return extractAssistantAssetParts(value, options).find((part) => part.type === 'image')?.url;
}
