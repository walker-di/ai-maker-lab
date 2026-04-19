import type { ToolInvocationInfo } from './types.js';

type JsonRecord = Record<string, unknown>;
type DisplayOptions = {
	toolName?: string;
};

const BASE64_PATTERN = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const DATA_URL_PATTERN = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i;

function isRecord(value: unknown): value is JsonRecord {
	return typeof value === 'object' && value !== null;
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

function summarizeImagePayload(value: string, options: DisplayOptions): string | undefined {
	if (options.toolName !== 'image_generation') {
		return undefined;
	}

	const normalized = value.trim();
	const dataUrlMatch = normalized.match(DATA_URL_PATTERN);
	if (dataUrlMatch) {
		const [, mimeType, base64Payload] = dataUrlMatch;
		return `[${mimeType} base64 payload omitted (${base64Payload.length} chars)]`;
	}

	if (normalized.length >= 32 && BASE64_PATTERN.test(normalized)) {
		return `[image/png base64 payload omitted (${normalized.length} chars)]`;
	}

	return undefined;
}

export function normalizeToolInvocationDisplayValue(
	value: unknown,
	seen: WeakSet<object> = new WeakSet<object>(),
	depth = 0,
	options: DisplayOptions = {},
): unknown {
	if (depth > 8) {
		return '[MaxDepth]';
	}

	if (typeof value === 'string') {
		const summarizedBinary = summarizeImagePayload(value, options);
		if (summarizedBinary) {
			return summarizedBinary;
		}

		const parsed = parseJsonLikeString(value);
		return parsed === undefined
			? value
			: normalizeToolInvocationDisplayValue(parsed, seen, depth + 1, options);
	}

	if (typeof value === 'bigint') {
		return value.toString();
	}

	if (Array.isArray(value)) {
		return value.map((item) => normalizeToolInvocationDisplayValue(item, seen, depth + 1, options));
	}

	if (!isRecord(value)) {
		return value;
	}

	if (seen.has(value)) {
		return '[Circular]';
	}
	seen.add(value);

	return Object.fromEntries(
		Object.entries(value).map(([key, entry]) => [
			key,
			normalizeToolInvocationDisplayValue(entry, seen, depth + 1, options),
		]),
	);
}

export function formatToolInvocationDisplayValue(value: unknown, options: DisplayOptions = {}): string {
	const normalized = normalizeToolInvocationDisplayValue(value, new WeakSet<object>(), 0, options);

	try {
		const serialized = JSON.stringify(normalized, null, 2);
		return serialized ?? String(normalized);
	} catch (error) {
		return `[Unserializable value: ${error instanceof Error ? error.message : 'unknown error'}]`;
	}
}

export function formatToolInvocationForDisplay(invocation: ToolInvocationInfo): string {
	return formatToolInvocationDisplayValue({
		...invocation,
		input: normalizeToolInvocationDisplayValue(
			invocation.input,
			new WeakSet<object>(),
			0,
			{ toolName: invocation.toolName },
		),
		output: normalizeToolInvocationDisplayValue(
			invocation.output,
			new WeakSet<object>(),
			0,
			{ toolName: invocation.toolName },
		),
	}, { toolName: invocation.toolName });
}
