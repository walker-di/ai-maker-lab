import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { Utils } from 'electrobun/bun';
import {
	TodoService,
	AgentCatalogService,
	ChatService,
	ModelHandler,
} from 'domain/application';
import {
	getDb,
	SurrealDbAdapter,
	SurrealTodoRepository,
	buildProviderRegistry,
	loadSystemAgentDefinitions,
	findSystemAgentById,
	SurrealUserAgentRepository,
	SurrealChatThreadRepository,
	SurrealChatMessageRepository,
	SurrealChatRunRepository,
	type ProviderRegistry,
} from 'domain/infrastructure';
import type { SecretsStore } from './secrets-store';

/**
 * Mutable holder around the provider registry so the Settings RPC can swap in
 * a freshly-built registry after the user updates API keys, without rebuilding
 * `ChatService`/`ModelHandler`. `ModelHandler` reads `current` per request.
 */
export interface ProviderRegistryRef {
	current: ProviderRegistry;
}

export interface DesktopServices {
	todoService: TodoService;
	catalogService: AgentCatalogService;
	chatService: ChatService;
	secretsStore: SecretsStore;
	providerRegistryRef: ProviderRegistryRef;
}

export interface BootstrapDesktopServicesOptions {
	secretsStore: SecretsStore;
}

export async function bootstrapDesktopServices(
	options: BootstrapDesktopServicesOptions,
): Promise<DesktopServices> {
	const desktopDbPath = join(Utils.paths.userData, 'surrealdb', 'desktop.db');
	mkdirSync(dirname(desktopDbPath), { recursive: true });

	const surreal = await getDb({
		host: `surrealkv://${desktopDbPath}`,
		namespace: 'app',
		database: 'desktop',
	});

	const dbAdapter = new SurrealDbAdapter(surreal);
	const systemSource = {
		loadAll: loadSystemAgentDefinitions,
		findById: findSystemAgentById,
	};
	const catalogService = new AgentCatalogService(
		systemSource,
		new SurrealUserAgentRepository(dbAdapter),
	);
	const providerRegistryRef: ProviderRegistryRef = { current: buildProviderRegistry() };
	const modelHandler = new ModelHandler(() => providerRegistryRef.current);
	const chatService = new ChatService(
		new SurrealChatThreadRepository(dbAdapter),
		new SurrealChatMessageRepository(dbAdapter),
		new SurrealChatRunRepository(dbAdapter),
		catalogService,
		modelHandler,
	);
	const todoService = new TodoService(new SurrealTodoRepository(dbAdapter));

	return {
		todoService,
		catalogService,
		chatService,
		secretsStore: options.secretsStore,
		providerRegistryRef,
	};
}
