import { BrowserView } from 'electrobun/bun';
import type { UIMessage } from 'ai';
import type {
	TodoService,
	AgentCatalogService,
	ChatService,
} from 'domain/application';
import type { TodoRpcSchema } from '../lib/adapters/todo/electrobun-todo-rpc';
import type { ChatRpcSchema } from '../lib/adapters/chat/electrobun-chat-rpc';
import type { DesktopRpcSchema } from '../lib/adapters/runtime/desktop-rpc-schema';
import type { DesktopServices } from './bootstrap-services';
import { extractPersistedAssistantCompletionFromUiMessageParts } from '../lib/server/persisted-assistant-completion';
import { buildSettingsRequestHandlers } from './desktop-settings-rpc';
import { buildPlatformerRequestHandlers } from './desktop-platformer-rpc';

export type DesktopBunRpc = ReturnType<typeof BrowserView.defineRPC<DesktopRpcSchema>>;

type RequestSchemaShape = Record<string, { params?: unknown; response: unknown }>;

type RequestHandlers<RS extends RequestSchemaShape> = {
	[K in keyof RS]: (
		...args: 'params' extends keyof RS[K]
			? undefined extends RS[K]['params']
				? [params?: RS[K]['params']]
				: [params: RS[K]['params']]
			: []
	) => Promise<Awaited<RS[K]['response']>>;
};

type TodoRequestHandlers = RequestHandlers<TodoRpcSchema['bun']['requests']>;
type ChatRequestHandlers = RequestHandlers<ChatRpcSchema['bun']['requests']>;

type DesktopBunSender = DesktopBunRpc['send'];

function toPlain<T>(data: T): T {
	return JSON.parse(JSON.stringify(data));
}

export function buildTodoRequestHandlers(todoService: TodoService): TodoRequestHandlers {
	return {
		async listTodos() {
			return toPlain(await todoService.listTodos());
		},
		async createTodo({ title }) {
			return toPlain(await todoService.createTodo(title));
		},
		async toggleTodo({ id }) {
			return toPlain(await todoService.toggleTodo(id));
		},
		async removeTodo({ id }) {
			return toPlain(await todoService.removeTodo(id));
		},
	};
}

export function buildChatRequestHandlers(deps: {
	catalogService: AgentCatalogService;
	chatService: ChatService;
	getSender: () => DesktopBunSender;
}): ChatRequestHandlers {
	const { catalogService, chatService, getSender } = deps;

	return {
		async listAgents() {
			return toPlain(await catalogService.listAgents());
		},
		async listThreads() {
			return toPlain(await chatService.listThreads());
		},
		async createThread(params) {
			return toPlain(await chatService.createThread(params));
		},
		async getThread({ threadId }) {
			return toPlain(await chatService.getThread(threadId));
		},
		async updateThreadTitle({ threadId, title }) {
			return toPlain(await chatService.updateThreadTitle(threadId, title));
		},
		async getMessages({ threadId }) {
			return toPlain(await chatService.getMessages(threadId));
		},
		async getSubthread({ threadId, parentMessageId }) {
			return toPlain(await chatService.getSubthread(threadId, parentMessageId));
		},
		async setThreadAgent({ threadId, agentId }) {
			return toPlain(await chatService.setThreadAgent(threadId, agentId));
		},
		async addThreadParticipant({ threadId, agentId }) {
			return toPlain(await chatService.addThreadParticipant(threadId, agentId));
		},
		async removeThreadParticipant({ threadId, agentId }) {
			return toPlain(await chatService.removeThreadParticipant(threadId, agentId));
		},
		async deleteThread({ threadId }) {
			await chatService.deleteThread(threadId);
		},
		async duplicateSystemAgent({ systemAgentId }) {
			return toPlain(await catalogService.duplicateSystemAgent(systemAgentId));
		},
		async inheritSystemAgent({ systemAgentId }) {
			return toPlain(await catalogService.inheritSystemAgent(systemAgentId));
		},
		async saveUserAgent(input) {
			return toPlain(await catalogService.createUserAgent(input));
		},
		async updateUserAgent({ id, input }) {
			return toPlain(await catalogService.updateUserAgent(id, input));
		},
		async sendMessage({
			threadId,
			streamId,
			text,
			parentMessageId,
			attachments,
			toolOverrides,
			messages,
		}) {
			const send = getSender();
			try {
				const result = await chatService.sendMessage(
					threadId,
					{ text, parentMessageId, attachments, toolOverrides },
					{ persistAssistantOnModelFinish: false },
				);

				const sseResponse = result.streamResult.toUIMessageStreamResponse({
					originalMessages: Array.isArray(messages) ? (messages as UIMessage[]) : [],
					generateMessageId: () => crypto.randomUUID(),
					onFinish: async ({ responseMessage }) => {
						if (responseMessage.role !== 'assistant') return;
						try {
							const completion = extractPersistedAssistantCompletionFromUiMessageParts(
								responseMessage.parts,
							);
							await chatService.persistAssistantCompletion({
								threadId,
								agentId: result.run.agentId,
								content: completion.text,
								parentMessageId,
								parts: completion.parts,
								toolInvocations: completion.toolInvocations,
							});
						} catch (persistError) {
							console.warn('[desktop-rpc] persist failed', {
								threadId,
								runId: result.run.id,
								error:
									persistError instanceof Error
										? persistError.message
										: String(persistError),
							});
						}
					},
				});

				if (!sseResponse.body) {
					send.chatStreamEnd({ streamId });
					return { ok: true };
				}

				const decoder = new TextDecoder();
				const reader = sseResponse.body.getReader();
				try {
					while (true) {
						const { value, done } = await reader.read();
						if (done) break;
						send.chatStreamChunk({
							streamId,
							chunk: decoder.decode(value, { stream: true }),
						});
					}
					const trailing = decoder.decode();
					if (trailing.length > 0) {
						send.chatStreamChunk({ streamId, chunk: trailing });
					}
				} finally {
					reader.releaseLock();
				}

				send.chatStreamEnd({ streamId });
				return { ok: true };
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				send.chatStreamError({ streamId, error: message });
				throw error;
			}
		},
	};
}

export function createDesktopBunRpc(services: DesktopServices): DesktopBunRpc {
	let pendingRpc: DesktopBunRpc | undefined;

	const handlers = {
		requests: {
			...buildTodoRequestHandlers(services.todoService),
			...buildChatRequestHandlers({
				catalogService: services.catalogService,
				chatService: services.chatService,
				getSender: () => {
					if (!pendingRpc) {
						throw new Error('Desktop RPC not initialised yet.');
					}
					return pendingRpc.send;
				},
			}),
			...buildSettingsRequestHandlers({
				secretsStore: services.secretsStore,
				providerRegistryRef: services.providerRegistryRef,
			}),
			...buildPlatformerRequestHandlers(services.mapCatalogService),
		},
	};

	pendingRpc = BrowserView.defineRPC<DesktopRpcSchema>({ handlers });
	return pendingRpc;
}
