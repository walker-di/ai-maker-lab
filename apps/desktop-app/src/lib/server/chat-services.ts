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
} from 'domain/infrastructure';
import { json } from '@sveltejs/kit';

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

			const chatService = new ChatService(
				threadRepo,
				messageRepo,
				runRepo,
				catalogService,
				modelHandler,
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
		: message.includes('must have') || message.includes('limited to')
			? 400
			: 500;
	return json({ error: message }, { status });
}

export interface NormalizedMessageBody {
	text: string;
	parentMessageId?: string;
	attachments?: Array<{
		type: 'image' | 'file' | 'pdf' | 'video' | 'text';
		name: string;
		mimeType: string;
		url?: string;
		content?: string;
	}>;
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
	if (typeof raw.text === 'string' && raw.text.length > 0) {
		return {
			text: raw.text,
			parentMessageId: typeof raw.parentMessageId === 'string' ? raw.parentMessageId : undefined,
			attachments: Array.isArray(raw.attachments) ? raw.attachments : undefined,
		};
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

		return {
			text: textParts.join('\n'),
			parentMessageId: typeof raw.parentMessageId === 'string' ? raw.parentMessageId : undefined,
			attachments: Array.isArray(raw.attachments) ? raw.attachments : undefined,
		};
	}

	throw new Error('Request must include either a "text" field or a "messages" array.');
}
