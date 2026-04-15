import { createChatTransport } from '$lib/adapters/chat/create-chat-transport';
import { createChatPageModel } from './chat-page.svelte.ts';

export function createChatPage() {
	const model = createChatPageModel({
		transport: createChatTransport(),
	});

	void model.loadInitial();

	return model;
}
