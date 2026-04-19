import { MODEL_CARD_CATALOG } from 'domain/shared';
import { createChatTransport } from '$lib/adapters/chat/create-chat-transport';
import { createAgentRegistryPageModel } from './agent-registry-page.svelte.ts';

export function createAgentRegistryPage() {
	const model = createAgentRegistryPageModel({
		transport: createChatTransport(),
		modelCatalog: MODEL_CARD_CATALOG,
	});

	void model.loadInitial();

	return model;
}
