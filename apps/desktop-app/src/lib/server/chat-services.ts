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

export function getChatServices(): Promise<ChatServices> {
	if (!chatServicesPromise) {
		chatServicesPromise = (async () => {
			const surreal = await getDb();

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
