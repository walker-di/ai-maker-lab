import type { RequestHandler } from './$types';
import { LocalFileAttachmentResolver } from 'domain/infrastructure';
import { DomainError, getChatServices, toChatErrorResponse } from '$lib/server/chat-services';

export const prerender = false;

function buildInlineDisposition(filename: string): string {
	return `inline; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

export const GET: RequestHandler = async ({ params }) => {
	try {
		const { chatService } = await getChatServices();
		const thread = await chatService.getThread(params.threadId);
		if (!thread) {
			throw new DomainError('Thread not found.', 'not_found');
		}

		const messages = await chatService.getMessages(params.threadId);
		const attachment = messages
			.flatMap((message) => message.attachments)
			.find((candidate) => candidate.id === params.attachmentId);

		if (!attachment) {
			throw new DomainError('Attachment not found.', 'not_found');
		}

		const resolver = new LocalFileAttachmentResolver();
		const resolved = await resolver.resolve(attachment);
		if (!resolved) {
			throw new DomainError('Attachment preview unavailable.', 'not_found');
		}

		if (resolved.type === 'text') {
			return new Response(resolved.text, {
				headers: {
					'content-type': `${attachment.mimeType || 'text/plain'}; charset=utf-8`,
					'content-disposition': buildInlineDisposition(attachment.name),
					'cache-control': 'no-store',
				},
			});
		}

		const mimeType = resolved.mimeType || attachment.mimeType || 'application/octet-stream';
		const bytes = Uint8Array.from(resolved.data);
		return new Response(bytes.buffer, {
			headers: {
				'content-type': mimeType,
				'content-length': String(resolved.data.byteLength),
				'content-disposition': buildInlineDisposition(attachment.name),
				'cache-control': 'no-store',
			},
		});
	} catch (error) {
		return toChatErrorResponse(error);
	}
};
