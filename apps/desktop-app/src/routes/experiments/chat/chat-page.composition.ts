import { createChatTransport } from '$lib/adapters/chat/create-chat-transport';
import { createChatStreamFactory } from '$lib/adapters/chat/create-chat-stream-transport';
import { createChatPageModel } from './chat-page.svelte.ts';

type CreateChatPageOptions = {
	initialAgentId?: string | null;
	initialThreadId?: string | null;
	onThreadChange?: (threadId: string | null) => void;
};

export function createChatPage(options: CreateChatPageOptions = {}) {
	const model = createChatPageModel({
		transport: createChatTransport(),
		streamFactory: createChatStreamFactory(),
		initialAgentId: options.initialAgentId,
		initialThreadId: options.initialThreadId,
		onThreadChange: options.onThreadChange,
	});

	void model.loadInitial();

	return model;
}
