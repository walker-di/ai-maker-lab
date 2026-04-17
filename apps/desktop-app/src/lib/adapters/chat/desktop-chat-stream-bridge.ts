import type { SendMessageAttachmentInput } from './electrobun-chat-rpc';
import type { DesktopWebviewRpc } from '../runtime/desktop-runtime';

export interface DesktopChatStreamRequest {
	threadId: string;
	text: string;
	parentMessageId?: string;
	attachments?: Array<Record<string, unknown>>;
	toolOverrides?: Record<string, boolean>;
	messages?: unknown[];
}

export interface DesktopChatStreamHandle {
	streamId: string;
	readable: ReadableStream<Uint8Array>;
	completed: Promise<void>;
}

export interface DesktopChatStreamBridge {
	openStream(input: DesktopChatStreamRequest): DesktopChatStreamHandle;
}

interface ActiveStreamController {
	enqueue(chunk: Uint8Array): void;
	close(): void;
	error(reason: Error): void;
}

/**
 * Bridge that maps an AI SDK streaming send to the bun RPC `sendMessage`
 * handler. The bun side iterates `streamResult.toUIMessageStreamResponse(...)`
 * and pushes each SSE body chunk through the `chatStreamChunk` Electrobun
 * message channel; this bridge demultiplexes those chunks per `streamId` and
 * writes them into a `ReadableStream<Uint8Array>` that the AI SDK Chat client
 * consumes as a real chunked response.
 */
export function createDesktopChatStreamBridge(rpc: DesktopWebviewRpc): DesktopChatStreamBridge {
	const controllers = new Map<string, ActiveStreamController>();
	const encoder = new TextEncoder();

	rpc.addMessageListener('chatStreamChunk', ({ streamId, chunk }) => {
		controllers.get(streamId)?.enqueue(encoder.encode(chunk));
	});
	rpc.addMessageListener('chatStreamEnd', ({ streamId }) => {
		const controller = controllers.get(streamId);
		if (!controller) return;
		controllers.delete(streamId);
		controller.close();
	});
	rpc.addMessageListener('chatStreamError', ({ streamId, error }) => {
		const controller = controllers.get(streamId);
		if (!controller) return;
		controllers.delete(streamId);
		controller.error(new Error(error));
	});

	return {
		openStream(input) {
			const streamId = crypto.randomUUID();

			const readable = new ReadableStream<Uint8Array>({
				start(controller) {
					controllers.set(streamId, {
						enqueue: (chunk) => controller.enqueue(chunk),
						close: () => controller.close(),
						error: (reason) => controller.error(reason),
					});
				},
				cancel() {
					controllers.delete(streamId);
				},
			});

			const completed = rpc.request
				.sendMessage({
					threadId: input.threadId,
					streamId,
					text: input.text,
					parentMessageId: input.parentMessageId,
					attachments: normalizeAttachmentInputs(input.attachments),
					toolOverrides: input.toolOverrides,
					messages: input.messages,
				})
				.then(() => undefined);

			completed.catch((err) => {
				const controller = controllers.get(streamId);
				if (!controller) return;
				controllers.delete(streamId);
				controller.error(err instanceof Error ? err : new Error(String(err)));
			});

			return { streamId, readable, completed };
		},
	};
}

function normalizeAttachmentInputs(
	rawAttachments?: Array<Record<string, unknown>>,
): SendMessageAttachmentInput[] | undefined {
	if (!rawAttachments || rawAttachments.length === 0) {
		return undefined;
	}

	return rawAttachments.map((entry, index) => {
		const type = typeof entry.type === 'string'
			? (entry.type as SendMessageAttachmentInput['type'])
			: 'unsupported';
		const name = typeof entry.name === 'string' ? entry.name : `attachment-${index}`;
		const mimeType = typeof entry.mimeType === 'string' ? entry.mimeType : 'application/octet-stream';
		const inlineDataBase64 =
			typeof entry.inlineDataBase64 === 'string' ? entry.inlineDataBase64 : undefined;
		const path = typeof entry.path === 'string' ? entry.path : undefined;
		const size = typeof entry.size === 'number' ? entry.size : 0;
		const lastModified = typeof entry.lastModified === 'string'
			? entry.lastModified
			: new Date(0).toISOString();
		const status = typeof entry.status === 'string'
			? (entry.status as SendMessageAttachmentInput['status'])
			: 'pending';

		return {
			type,
			name,
			mimeType,
			inlineDataBase64,
			path,
			size,
			lastModified,
			status,
			messageId: typeof entry.messageId === 'string' ? entry.messageId : '',
		};
	});
}
