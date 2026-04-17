import { beforeEach, describe, expect, test, vi } from 'vitest';
import { HOSTED_TOOL_FIXTURES } from '../../../../../../../../../packages/domain/src/application/chat/__test-helpers__/test-fixtures';
import { toPersistedAssistantMessageParts } from '$lib/adapters/chat/ai-sdk-message-parts';

const getChatServicesMock = vi.hoisted(() => vi.fn());

vi.mock('$lib/server/chat-services', async () => {
	const actual =
		await vi.importActual<typeof import('$lib/server/chat-services')>('$lib/server/chat-services');

	return {
		...actual,
		getChatServices: getChatServicesMock,
	};
});

describe('chat stream route', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	test('persists normalized assistant content and tool invocations for all hosted streamed tool fixtures', async () => {
		const { POST } = await import('./+server');

		for (const fixture of HOSTED_TOOL_FIXTURES) {
			const persistAssistantCompletion = vi.fn().mockResolvedValue(null);
			const sendMessage = vi.fn().mockResolvedValue({
				run: {
					id: `run-${fixture.toolName}`,
					agentId: 'system-general',
				},
				routerDecision: {
					agentId: 'system-general',
					reason: 'fallback',
				},
				streamResult: {
					toUIMessageStreamResponse: vi.fn(async ({ onFinish }) => {
						await onFinish?.({
							responseMessage: {
								role: 'assistant',
								parts: fixture.streamedParts,
							},
						});

						return new Response(`ok-${fixture.toolName}`, {
							status: 200,
							headers: { 'Content-Type': 'text/event-stream' },
						});
					}),
				},
			});

			getChatServicesMock.mockResolvedValueOnce({
				chatService: {
					getThread: vi.fn().mockResolvedValue({
						id: 'thread-1',
						participantIds: ['system-general'],
					}),
					sendMessage,
					persistAssistantCompletion,
				},
				catalogService: {
					findAgent: vi.fn(),
				},
			});

			const response = await POST({
				params: { threadId: 'thread-1' },
				request: new Request('http://localhost/api/chat/threads/thread-1/stream', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						messages: [
							{
								id: 'msg-user-1',
								role: 'user',
								parts: [{ type: 'text', text: `Run ${fixture.toolName}` }],
							},
						],
						parentMessageId: 'parent-1',
					}),
				}),
			} as never);

			expect(response.status).toBe(200);
			expect(sendMessage).toHaveBeenCalledWith(
				'thread-1',
				{
					text: `Run ${fixture.toolName}`,
					parentMessageId: 'parent-1',
					toolOverrides: undefined,
					attachments: undefined,
				},
				{ persistAssistantOnModelFinish: false },
			);
			expect(persistAssistantCompletion).toHaveBeenCalledWith({
				threadId: 'thread-1',
				agentId: 'system-general',
				content: fixture.assistantText,
				parentMessageId: 'parent-1',
				parts: toPersistedAssistantMessageParts(fixture.streamedParts),
				toolInvocations: [
					{
						toolCallId: fixture.toolCallId,
						toolName: fixture.toolName,
						state: 'output-available',
						input: fixture.input,
						output: fixture.output,
						errorText: undefined,
						providerExecuted: fixture.toolName === 'file_search' ? undefined : true,
					},
				],
			});
		}
	});

	test('persists tool-only error invocations even when there is no assistant prose', async () => {
		const { POST } = await import('./+server');
		const persistAssistantCompletion = vi.fn().mockResolvedValue(null);

		getChatServicesMock.mockResolvedValueOnce({
			chatService: {
				getThread: vi.fn().mockResolvedValue({
					id: 'thread-1',
					participantIds: ['system-general'],
				}),
				sendMessage: vi.fn().mockResolvedValue({
					run: {
						id: 'run-error',
						agentId: 'system-general',
					},
					routerDecision: {
						agentId: 'system-general',
						reason: 'fallback',
					},
					streamResult: {
						toUIMessageStreamResponse: vi.fn(async ({ onFinish }) => {
							await onFinish?.({
								responseMessage: {
									role: 'assistant',
									parts: [
										{
											type: 'tool-code_execution',
											toolCallId: 'tool-error-1',
											state: 'output-error',
											input: { code: '1 / 0' },
											errorText: 'division by zero',
										},
									],
								},
							});

							return new Response('ok', {
								status: 200,
								headers: { 'Content-Type': 'text/event-stream' },
							});
						}),
					},
				}),
				persistAssistantCompletion,
			},
			catalogService: {
				findAgent: vi.fn(),
			},
		});

		await POST({
			params: { threadId: 'thread-1' },
			request: new Request('http://localhost/api/chat/threads/thread-1/stream', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					messages: [
						{
							id: 'msg-user-1',
							role: 'user',
							parts: [{ type: 'text', text: 'Run code' }],
						},
					],
				}),
			}),
		} as never);

		expect(persistAssistantCompletion).toHaveBeenCalledWith({
			threadId: 'thread-1',
			agentId: 'system-general',
			content: '',
			parentMessageId: undefined,
			parts: [],
			toolInvocations: [
				{
					toolCallId: 'tool-error-1',
					toolName: 'code_execution',
					state: 'error',
					input: { code: '1 / 0' },
					output: undefined,
					errorText: 'division by zero',
					providerExecuted: undefined,
				},
			],
		});
	});
});
