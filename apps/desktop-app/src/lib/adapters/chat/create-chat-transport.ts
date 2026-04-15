import type { ChatTransport, ChatRuntimeMode } from './ChatTransport';
import { createWebChatTransport } from './web-chat-transport';

type ElectrobunWindow = Window & {
	__electrobun?: unknown;
	__electrobunWebviewId?: number;
	__electrobunRpcSocketPort?: number;
};

function hasElectrobunBridge(): boolean {
	if (typeof window === 'undefined') {
		return false;
	}

	const electrobunWindow = window as ElectrobunWindow;
	return (
		typeof electrobunWindow.__electrobun !== 'undefined' ||
		typeof electrobunWindow.__electrobunWebviewId === 'number' ||
		typeof electrobunWindow.__electrobunRpcSocketPort === 'number'
	);
}

export function resolveChatRuntimeMode(): ChatRuntimeMode {
	return hasElectrobunBridge() ? 'desktop' : 'web';
}

export function createChatTransport(
	mode: ChatRuntimeMode = resolveChatRuntimeMode(),
): ChatTransport {
	if (mode === 'web') {
		return createWebChatTransport();
	}

	return {
		async listAgents() {
			const { createDesktopChatTransport } = await import('./desktop-chat-transport');
			return createDesktopChatTransport().listAgents();
		},
		async listThreads() {
			const { createDesktopChatTransport } = await import('./desktop-chat-transport');
			return createDesktopChatTransport().listThreads();
		},
		async createThread(input) {
			const { createDesktopChatTransport } = await import('./desktop-chat-transport');
			return createDesktopChatTransport().createThread(input);
		},
		async getThread(threadId) {
			const { createDesktopChatTransport } = await import('./desktop-chat-transport');
			return createDesktopChatTransport().getThread(threadId);
		},
		async deleteThread(threadId) {
			const { createDesktopChatTransport } = await import('./desktop-chat-transport');
			return createDesktopChatTransport().deleteThread(threadId);
		},
		async getMessages(threadId) {
			const { createDesktopChatTransport } = await import('./desktop-chat-transport');
			return createDesktopChatTransport().getMessages(threadId);
		},
		async duplicateSystemAgent(systemAgentId) {
			const { createDesktopChatTransport } = await import('./desktop-chat-transport');
			return createDesktopChatTransport().duplicateSystemAgent(systemAgentId);
		},
	};
}
