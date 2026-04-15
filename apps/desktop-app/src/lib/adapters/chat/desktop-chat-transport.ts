import type { ChatTransport } from './ChatTransport';

export function createDesktopChatTransport(): ChatTransport {
	throw new Error(
		'Desktop chat transport is not yet implemented. Use web mode for now.',
	);
}
