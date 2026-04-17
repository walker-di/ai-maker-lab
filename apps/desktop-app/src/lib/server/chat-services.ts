import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
	AgentCatalogService,
	ChatService,
	ModelHandler,
	type ISystemAgentDefinitionSource,
} from 'domain/application';
import {
	getDb,
	SurrealDbAdapter,
	buildProviderRegistry,
	loadSystemAgentDefinitions,
	findSystemAgentById,
	SurrealUserAgentRepository,
	SurrealChatThreadRepository,
	SurrealChatMessageRepository,
	SurrealChatRunRepository,
	SurrealAttachmentRepository,
	LocalFileAttachmentResolver,
} from 'domain/infrastructure';
import { json } from '@sveltejs/kit';

const CHAT_DEBUG_PREFIX = '[chat-debug]';
const CHAT_DEBUG_ENABLED = (() => {
	const flag = process.env.CHAT_DEBUG?.toLowerCase().trim();
	return flag === '1' || flag === 'true' || flag === 'yes';
})();

const ATTACHMENT_TYPES = new Set(['text', 'image', 'pdf', 'video', 'unsupported']);
const ATTACHMENT_STATUSES = new Set(['pending', 'ready', 'unavailable', 'rejected']);
const MAX_ATTACHMENTS_PER_MESSAGE = 16;
// Soft cap of 32 MiB per attachment to avoid persisting huge base64 blobs through HTTP.
const MAX_INLINE_BYTES = 32 * 1024 * 1024;
const MAX_INLINE_BASE64_LENGTH = Math.ceil(MAX_INLINE_BYTES / 3) * 4;

interface ChatServices {
	chatService: ChatService;
	catalogService: AgentCatalogService;
}

let chatServicesPromise: Promise<ChatServices> | undefined;

const systemSource: ISystemAgentDefinitionSource = {
	loadAll: loadSystemAgentDefinitions,
	findById: findSystemAgentById,
};

function getDefaultEmbeddedHost(): string {
	const dbPath = fileURLToPath(
		new URL('../../../../../data/surrealdb/desktop-web.db', import.meta.url),
	);
	mkdirSync(dirname(dbPath), { recursive: true });
	return `surrealkv://${dbPath}`;
}

export function getChatServices(): Promise<ChatServices> {
	if (!chatServicesPromise) {
		chatServicesPromise = (async () => {
			const surreal = await getDb({
				host: process.env.SURREAL_HOST ?? getDefaultEmbeddedHost(),
				namespace: process.env.SURREAL_NS ?? 'app',
				database: process.env.SURREAL_DB ?? 'desktop',
				username: process.env.SURREAL_USER,
				password: process.env.SURREAL_PASS,
				token: process.env.SURREAL_TOKEN,
			});

			const adapter = new SurrealDbAdapter(surreal);
			const userAgentRepo = new SurrealUserAgentRepository(adapter);
			const threadRepo = new SurrealChatThreadRepository(adapter);
			const messageRepo = new SurrealChatMessageRepository(adapter);
			const runRepo = new SurrealChatRunRepository(adapter);

			const catalogService = new AgentCatalogService(systemSource, userAgentRepo);

			const registry = buildProviderRegistry();
			const modelHandler = new ModelHandler(registry);

			const attachmentRepo = new SurrealAttachmentRepository(adapter);
			const attachmentResolver = new LocalFileAttachmentResolver();

			const chatService = new ChatService(
				threadRepo,
				messageRepo,
				runRepo,
				catalogService,
				modelHandler,
				attachmentRepo,
				attachmentResolver,
			);

			return { chatService, catalogService };
		})();
	}

	return chatServicesPromise;
}

export class DomainError extends Error {
	constructor(
		message: string,
		public readonly code: 'not_found' | 'bad_request' | 'internal',
	) {
		super(message);
		this.name = 'DomainError';
	}
}

const STATUS_MAP: Record<string, number> = {
	not_found: 404,
	bad_request: 400,
	internal: 500,
};

export function toChatErrorResponse(error: unknown) {
	if (error instanceof DomainError) {
		return json({ error: error.message }, { status: STATUS_MAP[error.code] ?? 500 });
	}
	const message = error instanceof Error ? error.message : 'Unknown error';
	const status = message.includes('not found')
		? 404
		: message.includes('must have')
			|| message.includes('limited to')
			|| message.includes('does not belong to thread')
			|| /attachment/i.test(message)
			? 400
			: 500;
	return json({ error: message }, { status });
}

export interface NormalizedMessageBody {
	text: string;
	parentMessageId?: string;
	toolOverrides?: Record<string, boolean>;
	attachments?: Array<{
		type: 'text' | 'image' | 'pdf' | 'video' | 'unsupported';
		name: string;
		mimeType: string;
		inlineDataBase64: string;
		size: number;
		lastModified: string;
		status: 'pending' | 'ready' | 'unavailable' | 'rejected';
		messageId: string;
	}>;
}

function normalizeBooleanRecord(value: unknown): Record<string, boolean> | undefined {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		return undefined;
	}

	const normalized = Object.fromEntries(
		Object.entries(value).filter((entry): entry is [string, boolean] => typeof entry[1] === 'boolean'),
	);

	return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function normalizeAttachments(value: unknown): NormalizedMessageBody['attachments'] {
	if (value === undefined || value === null) {
		return undefined;
	}

	if (!Array.isArray(value)) {
		throw new Error('attachments must be an array.');
	}

	if (value.length > MAX_ATTACHMENTS_PER_MESSAGE) {
		throw new Error(
			`attachments exceeds the per-message limit of ${MAX_ATTACHMENTS_PER_MESSAGE}.`,
		);
	}

	return value.map((entry, index) => normalizeAttachment(entry, index));
}

function normalizeAttachment(
	raw: unknown,
	index: number,
): NonNullable<NormalizedMessageBody['attachments']>[number] {
	if (!raw || typeof raw !== 'object') {
		throw new Error(`attachment at index ${index} must be an object.`);
	}

	const entry = raw as Record<string, unknown>;

	const type = entry.type;
	if (typeof type !== 'string' || !ATTACHMENT_TYPES.has(type)) {
		throw new Error(
			`attachment at index ${index} has an invalid "type" (expected one of ${[
				...ATTACHMENT_TYPES,
			].join(', ')}).`,
		);
	}

	const name = typeof entry.name === 'string' ? entry.name.trim() : '';
	if (!name) {
		throw new Error(`attachment at index ${index} is missing a "name".`);
	}

	const mimeType = typeof entry.mimeType === 'string' ? entry.mimeType.trim() : '';
	if (!mimeType) {
		throw new Error(`attachment at index ${index} is missing a "mimeType".`);
	}

	if (entry.path !== undefined && entry.path !== null && entry.path !== '') {
		// Filesystem paths from HTTP payloads would let any caller dereference
		// arbitrary files on the server. Inline data is the only supported mode
		// over the HTTP transport; desktop runtimes carry paths through their
		// own trusted RPC bridge.
		throw new Error(
			`attachment at index ${index} includes a "path" field; HTTP attachments must use inlineDataBase64.`,
		);
	}

	const inlineDataBase64 =
		typeof entry.inlineDataBase64 === 'string' ? entry.inlineDataBase64 : '';
	if (!inlineDataBase64.trim()) {
		throw new Error(
			`attachment at index ${index} must include a non-empty "inlineDataBase64" field.`,
		);
	}

	if (inlineDataBase64.length > MAX_INLINE_BASE64_LENGTH) {
		throw new Error(
			`attachment at index ${index} exceeds the per-attachment size limit of ${MAX_INLINE_BYTES} bytes.`,
		);
	}

	const size = typeof entry.size === 'number' && Number.isFinite(entry.size) ? entry.size : 0;
	const lastModified =
		typeof entry.lastModified === 'string' ? entry.lastModified : new Date(0).toISOString();
	const status = typeof entry.status === 'string' && ATTACHMENT_STATUSES.has(entry.status)
		? (entry.status as NonNullable<NormalizedMessageBody['attachments']>[number]['status'])
		: 'pending';
	const messageId = typeof entry.messageId === 'string' ? entry.messageId : '';

	return {
		type: type as NonNullable<NormalizedMessageBody['attachments']>[number]['type'],
		name,
		mimeType,
		inlineDataBase64,
		size,
		lastModified,
		status,
		messageId,
	};
}

function logChatDebug(label: string, payload: Record<string, unknown>) {
	if (!CHAT_DEBUG_ENABLED) return;
	console.info(`${CHAT_DEBUG_PREFIX} ${label}`, payload);
}

/**
 * Accepts both AI SDK `{ messages }` payloads and legacy `{ text }` payloads
 * and normalizes them into the shape that `ChatService.sendMessage` expects.
 *
 * AI SDK `DefaultChatTransport` sends:
 *   `{ id, messages: UIMessage[], trigger, messageId, ...body }`
 * where user messages carry `parts: [{ type: 'text', text }]`.
 *
 * Legacy/test callers may send `{ text, parentMessageId?, attachments? }`.
 */
export function normalizeMessageBody(raw: Record<string, unknown>): NormalizedMessageBody {
	const attachments = normalizeAttachments(raw.attachments);

	if (typeof raw.text === 'string' && raw.text.length > 0) {
		const normalized: NormalizedMessageBody = {
			text: raw.text,
			parentMessageId: typeof raw.parentMessageId === 'string' ? raw.parentMessageId : undefined,
			toolOverrides: normalizeBooleanRecord(raw.toolOverrides),
			attachments,
		};
		logChatDebug('normalize-message-body.legacy', {
			parentMessageId: normalized.parentMessageId ?? null,
			toolOverrides: normalized.toolOverrides ?? {},
			attachmentCount: normalized.attachments?.length ?? 0,
			textPreview: normalized.text.slice(0, 120),
		});
		return normalized;
	}

	if (Array.isArray(raw.messages) && raw.messages.length > 0) {
		const lastUserMessage = [...raw.messages].reverse().find(
			(m: Record<string, unknown>) => m.role === 'user',
		);
		if (!lastUserMessage) {
			throw new Error('No user message found in messages array.');
		}

		const parts: Array<Record<string, unknown>> = Array.isArray(lastUserMessage.parts)
			? lastUserMessage.parts
			: [];
		const textParts = parts
			.filter((p) => p.type === 'text' && typeof p.text === 'string')
			.map((p) => p.text as string);

		if (textParts.length === 0) {
			throw new Error('User message has no text parts.');
		}

		const normalized: NormalizedMessageBody = {
			text: textParts.join('\n'),
			parentMessageId: typeof raw.parentMessageId === 'string' ? raw.parentMessageId : undefined,
			toolOverrides: normalizeBooleanRecord(raw.toolOverrides),
			attachments,
		};
		logChatDebug('normalize-message-body.ai-sdk', {
			parentMessageId: normalized.parentMessageId ?? null,
			toolOverrides: normalized.toolOverrides ?? {},
			attachmentCount: normalized.attachments?.length ?? 0,
			messageCount: raw.messages.length,
			textPreview: normalized.text.slice(0, 120),
		});
		return normalized;
	}

	throw new Error('Request must include either a "text" field or a "messages" array.');
}
