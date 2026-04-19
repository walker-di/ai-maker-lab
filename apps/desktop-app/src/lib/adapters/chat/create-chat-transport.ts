import type { ChatTransport, ChatRuntimeMode } from './ChatTransport';
import { createWebChatTransport } from './web-chat-transport';

type ElectrobunWindow = Window & {
	__electrobun?: unknown;
	__electrobunWebviewId?: number;
	__electrobunRpcSocketPort?: number;
};

function hasElectrobunBridge(): boolean {
	if (typeof window === 'undefined') return false;
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

async function loadDesktopChatTransport(): Promise<ChatTransport> {
	const { getDesktopRuntime } = await import('../runtime/desktop-runtime');
	return getDesktopRuntime().chatTransport;
}

export function createChatTransport(
	mode: ChatRuntimeMode = resolveChatRuntimeMode(),
): ChatTransport {
	if (mode === 'web') return createWebChatTransport();

	let cached: ChatTransport | undefined;
	const get = async () => (cached ??= await loadDesktopChatTransport());

	return new Proxy({} as ChatTransport, {
		get(_target, prop) {
			if (prop === 'getAttachmentPreviewUrl') {
				return (_threadId: string, _attachmentId: string) => null;
			}
			return async (...args: unknown[]) => {
				const transport = await get();
				const fn = transport[prop as keyof ChatTransport] as (
					...a: unknown[]
				) => unknown;
				return fn.apply(transport, args);
			};
		},
	});
}
