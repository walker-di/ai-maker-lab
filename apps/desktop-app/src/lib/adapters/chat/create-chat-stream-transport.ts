import { DefaultChatTransport } from 'ai';
import type { UIMessage } from 'ai';
import type { ChatRuntimeMode } from './ChatTransport';
import { resolveChatRuntimeMode } from './create-chat-transport';

export type ChatStreamFactory = (threadId: string) => DefaultChatTransport<UIMessage>;

const DESKTOP_STREAM_API = 'electrobun://chat/stream';

function createDesktopFetch(threadId: string): typeof fetch {
	const desktopFetch = (async (_input: URL | RequestInfo, init?: RequestInit) =>
		fetchDesktopStream(threadId, init)) as typeof fetch;

	desktopFetch.preconnect = fetch.preconnect?.bind(fetch);

	return desktopFetch;
}

/**
 * Build a `DefaultChatTransport` instance.
 *
 * - In web mode the transport hits the SvelteKit streaming endpoint.
 * - In desktop mode the transport invokes a custom `fetch` that opens a real
 *   incremental stream against bun via the `DesktopChatStreamBridge`. The bun
 *   side runs `streamResult.toUIMessageStreamResponse(...)` and pushes the SSE
 *   body chunk-by-chunk over the `chatStreamChunk` Electrobun message channel,
 *   so the AI SDK Chat client behaves identically across runtimes.
 */
export function createChatStreamFactory(
	mode: ChatRuntimeMode = resolveChatRuntimeMode(),
): ChatStreamFactory {
	if (mode === 'web') {
		return (threadId) =>
			new DefaultChatTransport({
				api: `/api/chat/threads/${threadId}/stream`,
			});
	}

	return (threadId) =>
		new DefaultChatTransport<UIMessage>({
			api: DESKTOP_STREAM_API,
			fetch: createDesktopFetch(threadId),
		});
}

async function fetchDesktopStream(
	threadId: string,
	init?: RequestInit,
): Promise<Response> {
	let body: Record<string, unknown> = {};
	if (init?.body && typeof init.body === 'string') {
		try {
			body = JSON.parse(init.body) as Record<string, unknown>;
		} catch {
			body = {};
		}
	}

	const messages = Array.isArray(body.messages) ? (body.messages as unknown[]) : [];
	const text = extractLastUserText(messages);
	const parentMessageId =
		typeof body.parentMessageId === 'string' ? body.parentMessageId : undefined;
	const attachments = Array.isArray(body.attachments)
		? (body.attachments as Array<Record<string, unknown>>)
		: undefined;
	const toolOverrides =
		body.toolOverrides && typeof body.toolOverrides === 'object'
			? (body.toolOverrides as Record<string, boolean>)
			: undefined;

	const { getDesktopRuntime } = await import('../runtime/desktop-runtime');
	const handle = getDesktopRuntime().streamBridge.openStream({
		threadId,
		text,
		parentMessageId,
		attachments,
		toolOverrides,
		messages,
	});

	return new Response(handle.readable, {
		status: 200,
		headers: {
			'content-type': 'text/event-stream',
			'cache-control': 'no-store',
			'x-vercel-ai-ui-message-stream': 'v1',
		},
	});
}

function extractLastUserText(messages: unknown[]): string {
	const lastUser = [...messages]
		.reverse()
		.find((m): m is { parts?: unknown } & { role: string } => {
			return typeof m === 'object' && m !== null && (m as { role?: string }).role === 'user';
		});

	if (!lastUser) {
		return '';
	}

	const parts = (lastUser as { parts?: unknown }).parts;
	if (!Array.isArray(parts)) {
		return '';
	}

	return parts
		.filter((p) => p && typeof p === 'object' && (p as { type?: unknown }).type === 'text')
		.map((p) => ((p as { text?: unknown }).text as string | undefined) ?? '')
		.join('\n');
}
