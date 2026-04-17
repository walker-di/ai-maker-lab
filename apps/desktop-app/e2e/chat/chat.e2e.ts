import { test, expect } from '@playwright/test';
import {
	patchEmptyTableErrors,
	navigateToChat,
	waitForAgentsLoaded,
	createThread,
	selectThread,
	selectAgentInRoster,
	openAgentRoster,
	threadSidebar,
	agentRoster,
	mainPanel,
	threadHeader,
} from '../helpers';
import { ONE_PIXEL_PNG_BASE64 } from '../../../../packages/domain/src/application/chat/__test-helpers__/test-fixtures';

function buildMockStream(text: string): string {
	const msgId = `msg_${Date.now()}`;
	const txtId = `txt_${Date.now()}`;
	const lines = [
		`data: ${JSON.stringify({ type: 'start', messageId: msgId })}`,
		'',
		`data: ${JSON.stringify({ type: 'text-start', id: txtId })}`,
		'',
		`data: ${JSON.stringify({ type: 'text-delta', id: txtId, delta: text })}`,
		'',
		`data: ${JSON.stringify({ type: 'text-end', id: txtId })}`,
		'',
		`data: ${JSON.stringify({ type: 'finish', messageId: msgId, finishReason: 'stop' })}`,
		'',
	];
	return lines.join('\n');
}

function buildToolStream(
	text: string,
	toolPart: Record<string, unknown>,
): string {
	const msgId = `msg_${Date.now()}`;
	const txtId = `txt_${Date.now()}`;
	const lines = [
		`data: ${JSON.stringify({ type: 'start', messageId: msgId })}`,
		'',
		`data: ${JSON.stringify({ type: 'text-start', id: txtId })}`,
		'',
		`data: ${JSON.stringify({ type: 'text-delta', id: txtId, delta: text })}`,
		'',
		`data: ${JSON.stringify({ type: 'text-end', id: txtId })}`,
		'',
		`data: ${JSON.stringify(toolPart)}`,
		'',
		`data: ${JSON.stringify({ type: 'finish', messageId: msgId, finishReason: 'stop' })}`,
		'',
	];
	return lines.join('\n');
}

function extractUserText(raw: unknown): string {
	if (typeof raw !== 'object' || raw === null) {
		return '';
	}

	const payload = raw as {
		messages?: Array<{ role?: string; parts?: Array<{ type?: string; text?: string }> }>;
	};
	const lastUserMessage = [...(payload.messages ?? [])]
		.reverse()
		.find((message) => message.role === 'user');
	const textParts = (lastUserMessage?.parts ?? [])
		.filter((part) => part.type === 'text' && typeof part.text === 'string')
		.map((part) => part.text ?? '');
	return textParts.join('\n').trim();
}

function mockStreamHeaders() {
	return {
		'Content-Type': 'text/event-stream',
		'Cache-Control': 'no-cache',
		Connection: 'keep-alive',
		'x-vercel-ai-ui-message-stream': 'v1',
	};
}

test.describe('Chat page – CRUD', () => {
	test.beforeEach(async ({ page }) => {
		await patchEmptyTableErrors(page);
		await navigateToChat(page);
		await waitForAgentsLoaded(page);
	});

	test('shows empty state on first load', async ({ page }) => {
		await expect(mainPanel(page).getByText('Select or create a thread')).toBeVisible();
	});

	test('lists system agents in the roster', async ({ page }) => {
		await createThread(page, 'Roster thread');
		await openAgentRoster(page);

		const roster = agentRoster(page);
		await expect(roster.getByRole('button', { name: /General Assistant/ })).toBeVisible();
		await expect(roster.getByRole('button', { name: /Creative Writer/ })).toBeVisible();
		await expect(roster.getByRole('button', { name: /Research Analyst/ })).toBeVisible();
	});

	test('creates a thread and shows it active', async ({ page }) => {
		await createThread(page, 'My first thread');

		await expect(threadSidebar(page).getByText('My first thread')).toBeVisible();
		await expect(mainPanel(page).locator('h2', { hasText: 'My first thread' })).toBeVisible();
		await expect(
			mainPanel(page).getByText('No messages yet. Start the conversation!'),
		).toBeVisible();
	});

	test('auto-titles blank threads from their first messages', async ({ page }) => {
		await page.route('**/api/chat/threads/*/stream', async (route) => {
			await route.fulfill({
				status: 200,
				headers: mockStreamHeaders(),
				body: buildMockStream('Mocked reply'),
			});
		});

		const addButton = page.getByRole('button', { name: '+' });
		const composer = mainPanel(page).getByPlaceholder('Send a message...');

		await addButton.click();
		await expect(threadHeader(page)).toHaveText('New conversation');

		await composer.fill('Budget planning for Q3 launch');
		await page.getByRole('button', { name: 'Send' }).click();
		await expect(threadHeader(page)).toHaveText('Budget planning for Q3 launch');
		await expect(
			threadSidebar(page).getByText('Budget planning for Q3 launch', { exact: true }),
		).toBeVisible();

		await addButton.click();
		await expect(threadHeader(page)).toHaveText('New conversation');

		await composer.fill('Docker compose fix for dev env');
		await page.getByRole('button', { name: 'Send' }).click();
		await expect(threadHeader(page)).toHaveText('Docker compose fix for dev env');

		await expect(
			threadSidebar(page).getByText('Budget planning for Q3 launch', { exact: true }),
		).toBeVisible();
		await expect(
			threadSidebar(page).getByText('Docker compose fix for dev env', { exact: true }),
		).toBeVisible();
	});

	test('renames a thread from the sidebar title dialog', async ({ page }) => {
		await createThread(page, 'Rename me');

		await threadSidebar(page).getByText('Rename me', { exact: true }).dblclick();
		await expect(page.getByRole('heading', { name: 'Rename thread' })).toBeVisible();

		const titleInput = page.getByPlaceholder('Thread title');
		await expect(titleInput).toHaveValue('Rename me');
		await titleInput.fill('Renamed thread');
		await page.getByRole('button', { name: 'Save' }).click();

		await expect(threadSidebar(page).getByText('Renamed thread', { exact: true })).toBeVisible();
		await expect(threadHeader(page)).toHaveText('Renamed thread');
	});

	test('switches between threads', async ({ page }) => {
		await createThread(page, 'Thread Alpha');
		await createThread(page, 'Thread Beta');

		await expect(
			mainPanel(page).locator('h2', { hasText: 'Thread Beta' }),
		).toBeVisible();

		await selectThread(page, 'Thread Alpha');
		await expect(
			mainPanel(page).locator('h2', { hasText: 'Thread Alpha' }),
		).toBeVisible();
	});

	test('deletes a thread', async ({ page }) => {
		await createThread(page, 'Disposable thread');

		const sidebar = threadSidebar(page);
		const threadItem = sidebar.locator('[role="button"]').filter({
			hasText: 'Disposable thread',
		});
		await threadItem.hover();
		await threadItem.getByLabel('Delete thread').click();

		await expect(sidebar.getByText('Disposable thread')).not.toBeVisible();
	});

	test('selecting an agent updates the header info', async ({ page }) => {
		await createThread(page, 'Agent test thread');
		await selectAgentInRoster(page, 'Creative Writer');

		const header = mainPanel(page).locator('.border-b').first();
		await expect(
			header.getByText('Creative Writer', { exact: false }),
		).toBeVisible();
	});

	test('shows empty message list for a new thread', async ({ page }) => {
		await createThread(page, 'Empty messages thread');

		await expect(
			mainPanel(page).getByText('No messages yet. Start the conversation!'),
		).toBeVisible();
	});

	test('composer textarea is visible when thread is active', async ({ page }) => {
		await createThread(page, 'Composer thread');
		await expect(mainPanel(page).getByPlaceholder('Send a message...')).toBeVisible();
	});

	test('opens a subthread, shows reply summaries, and sends a threaded reply', async ({ page }) => {
		let activeThreadId = 'thread-placeholder';
		let messages = [
			{
				id: 'msg-user-root',
				threadId: activeThreadId,
				role: 'user',
				content: 'pls use your search to check current dollar real rate',
				attachments: [],
				toolInvocations: [],
				createdAt: '2026-04-15T22:31:53.000Z',
			},
			{
				id: 'msg-root',
				threadId: activeThreadId,
				role: 'assistant',
				content: 'I currently do not have access to live web search or real-time data.',
				agentId: 'system-general',
				attachments: [],
				toolInvocations: [],
				createdAt: '2026-04-15T22:31:54.000Z',
			},
			{
				id: 'msg-reply-1',
				threadId: activeThreadId,
				role: 'user',
				content: 'Start by separating build and deploy into distinct steps.',
				parentMessageId: 'msg-root',
				attachments: [],
				toolInvocations: [],
				createdAt: '2026-04-15T22:31:55.000Z',
			},
		];

		function extractUserText(raw: unknown): string {
			if (typeof raw !== 'object' || raw === null) {
				return '';
			}
			const payload = raw as { messages?: Array<{ role?: string; parts?: Array<{ type?: string; text?: string }> }> };
			const lastUserMessage = [...(payload.messages ?? [])].reverse().find((message) => message.role === 'user');
			const textParts = (lastUserMessage?.parts ?? [])
				.filter((part) => part.type === 'text' && typeof part.text === 'string')
				.map((part) => part.text ?? '');
			return textParts.join('\n').trim();
		}

		await page.route('**/api/chat/threads/*/messages', async (route, request) => {
			if (request.method() !== 'GET') {
				return route.fallback();
			}

			const threadId = request.url().split('/threads/')[1]?.split('/messages')[0] ?? activeThreadId;
			activeThreadId = threadId;
			messages = messages.map((message) => ({ ...message, threadId }));

			return route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify(messages),
			});
		});

		await page.route('**/api/chat/threads/*/subthreads/*', async (route, request) => {
			if (request.method() !== 'GET') {
				return route.fallback();
			}

			const parentMessageId = request.url().split('/subthreads/')[1] ?? 'msg-root';
			const parentMessage = messages.find((message) => message.id === parentMessageId);
			const replies = messages.filter((message) => message.parentMessageId === parentMessageId);

			return route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					parentMessage,
					replies,
				}),
			});
		});

		await page.route('**/api/chat/threads/*/stream', async (route, request) => {
			const raw = request.postDataJSON();
			const userText = extractUserText(raw);
			const parentMessageId = typeof raw?.parentMessageId === 'string' ? raw.parentMessageId : undefined;
			if (parentMessageId) {
				messages = [
					...messages,
					{
						id: `msg-user-${messages.length + 1}`,
						threadId: activeThreadId,
						role: 'user',
						content: userText,
						parentMessageId,
						attachments: [],
						toolInvocations: [],
						createdAt: '2026-04-15T22:32:10.000Z',
					},
					{
						id: `msg-assistant-${messages.length + 2}`,
						threadId: activeThreadId,
						role: 'assistant',
						content: 'Threaded assistant reply',
						parentMessageId,
						agentId: 'system-general',
						attachments: [],
						toolInvocations: [],
						createdAt: '2026-04-15T22:32:11.000Z',
					},
				];
			}

			await route.fulfill({
				status: 200,
				headers: mockStreamHeaders(),
				body: buildMockStream('Threaded assistant reply'),
			});
		});

		await createThread(page, 'Subthread flow');

		await expect(mainPanel(page).getByText('1 reply')).toBeVisible();
		await expect(mainPanel(page).getByText(/separating build and deploy/i)).toBeVisible();
		await expect(mainPanel(page).getByRole('button', { name: 'Reply in thread' })).toHaveCount(1);

		await mainPanel(page).getByRole('button', { name: 'Reply in thread' }).click();

		const subthreadPanel = page.locator('aside').last();
		await expect(subthreadPanel.getByText('Original message')).toBeVisible();
		await expect(
			subthreadPanel.getByText('Start by separating build and deploy into distinct steps.'),
		).toBeVisible();

		const threadComposer = page.getByPlaceholder('Reply in thread...');
		await threadComposer.fill("Let's keep discussing in the side thread.");
		await threadComposer.press('Enter');

		await expect(subthreadPanel.getByText('Threaded assistant reply')).toBeVisible();
		await expect(mainPanel(page).getByText('3 replies')).toBeVisible();
		await page.unrouteAll({ behavior: 'ignoreErrors' });
	});

	test('clicking an attachment opens the preview modal', async ({ page }) => {
		await page.route('**/api/chat/threads/*/messages', async (route, request) => {
			if (request.method() !== 'GET') {
				return route.fallback();
			}

			return route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify([
					{
						id: 'msg-preview',
						threadId: 'thread-preview',
						role: 'user',
						content: 'Please describe this screenshot.',
						attachments: [
							{
								id: 'att-preview',
								messageId: 'msg-preview',
								type: 'image',
								name: 'screenshot.png',
								mimeType: 'image/png',
								inlineDataBase64:
									'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aU9sAAAAASUVORK5CYII=',
								size: 68,
								lastModified: '2026-04-15T22:31:54.000Z',
								status: 'ready',
							},
						],
						createdAt: '2026-04-15T22:31:54.000Z',
					},
				]),
			});
		});

		await createThread(page, 'Preview thread');

		const previewButton = mainPanel(page).getByRole('button', {
			name: 'Preview screenshot.png',
		});
		await expect(previewButton).toBeVisible();
		await previewButton.click();

		await expect(page.getByRole('heading', { name: 'screenshot.png' })).toBeVisible();
		await expect(page.getByRole('img', { name: 'screenshot.png' })).toBeVisible();
	});

	test('renders persisted tool pills from message history', async ({ page }) => {
		await page.route('**/api/chat/threads/*/messages', async (route, request) => {
			if (request.method() !== 'GET') {
				return route.fallback();
			}

			return route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify([
					{
						id: 'msg-user-tool',
						threadId: 'thread-tool',
						role: 'user',
						content: 'What is the USD to BRL rate?',
						attachments: [],
						toolInvocations: [],
						createdAt: '2026-04-15T22:31:54.000Z',
					},
					{
						id: 'msg-assistant-tool',
						threadId: 'thread-tool',
						role: 'assistant',
						content: 'I checked the latest exchange rate.',
						agentId: 'system-general',
						attachments: [],
						toolInvocations: [
							{
								toolCallId: 'call-search',
								toolName: 'web_search',
								state: 'output-available',
								input: { query: 'usd brl exchange rate' },
								output: {
									results: [{ title: 'Wise', url: 'https://wise.com' }],
								},
							},
						],
						createdAt: '2026-04-15T22:31:55.000Z',
					},
				]),
			});
		});

		await createThread(page, 'History tool thread');

		const pill = mainPanel(page).getByRole('button', { name: /Inspect Web Search/i });
		await expect(pill).toBeVisible();
		await pill.click();

		await expect(page.getByRole('heading', { name: 'Web Search' })).toBeVisible();
		await expect(page.getByText('usd brl exchange rate', { exact: true })).toBeVisible();
	});

	test('renders streamed and persisted image generation previews', async ({ page }) => {
		let activeThreadId = 'thread-image-placeholder';
		let messageCount = 0;
		const messages: Array<Record<string, unknown>> = [];

		await page.route('**/api/chat/threads/*/messages', async (route, request) => {
			if (request.method() !== 'GET') {
				return route.fallback();
			}

			activeThreadId = request.url().split('/threads/')[1]?.split('/messages')[0] ?? activeThreadId;
			return route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify(messages.filter((message) => message.threadId === activeThreadId)),
			});
		});

		await page.route('**/api/chat/threads/*/stream', async (route, request) => {
			const userText = extractUserText(request.postDataJSON());
			const assistantText = 'Here is your panda image.';

			messages.push(
				{
					id: `msg-user-${++messageCount}`,
					threadId: activeThreadId,
					role: 'user',
					content: userText,
					attachments: [],
					toolInvocations: [],
					createdAt: '2026-04-16T12:00:00.000Z',
				},
				{
					id: `msg-assistant-${++messageCount}`,
					threadId: activeThreadId,
					role: 'assistant',
					content: assistantText,
					agentId: 'system-general',
					attachments: [],
					toolInvocations: [
						{
							toolCallId: 'tool-image-1',
							toolName: 'image_generation',
							state: 'output-available',
							input: { prompt: userText },
							output: {
								result: ONE_PIXEL_PNG_BASE64,
							},
							providerExecuted: true,
						},
					],
					createdAt: '2026-04-16T12:00:01.000Z',
				},
			);

			await route.fulfill({
				status: 200,
				headers: mockStreamHeaders(),
				body: buildToolStream(assistantText, {
					type: 'tool-image_generation',
					toolCallId: 'tool-image-1',
					state: 'output-available',
					input: { prompt: userText },
					output: {
						result: ONE_PIXEL_PNG_BASE64,
					},
					providerExecuted: true,
				}),
			});
		});

		await createThread(page, 'Image tool thread');

		const composer = mainPanel(page).getByPlaceholder('Send a message...');
		await composer.fill('pls create a panda image');
		await page.getByRole('button', { name: 'Send' }).click();

		await expect(page.getByText('Here is your panda image.')).toBeVisible({ timeout: 10_000 });
		const generatedImage = mainPanel(page)
			.getByRole('img', { name: 'Generated image' })
			.first();
		await expect(generatedImage).toBeVisible({ timeout: 10_000 });
		await expect(generatedImage).toHaveAttribute('src', /^data:image\/png;base64,/);

		const pill = mainPanel(page).getByRole('button', { name: /Inspect Image Generation/i });
		await expect(pill).toBeVisible();
		await pill.click();
		const dialog = page.getByRole('dialog');
		await expect(dialog.getByRole('heading', { name: 'Image Generation' })).toBeVisible();
		await expect(
			dialog.getByRole('img', { name: 'Image Generation preview' }),
		).toBeVisible();
		await expect(
			dialog
				.getByText(/\[image\/png base64 payload omitted \(\d+ chars\)\]/)
				.first(),
		).toBeVisible();
		await expect(dialog.getByText(ONE_PIXEL_PNG_BASE64)).toHaveCount(0);

		await page.reload();
		await waitForAgentsLoaded(page);
		await expect(threadHeader(page)).toHaveText('Image tool thread');
		const reloadedImage = mainPanel(page)
			.getByRole('img', { name: 'Generated image' })
			.first();
		await expect(reloadedImage).toBeVisible({ timeout: 10_000 });
		await expect(reloadedImage).toHaveAttribute('src', /^data:image\/png;base64,/);

		await mainPanel(page)
			.getByRole('button', { name: /Inspect Image Generation/i })
			.click();
		const reloadedDialog = page.getByRole('dialog');
		await expect(
			reloadedDialog
				.getByText(/\[image\/png base64 payload omitted \(\d+ chars\)\]/)
				.first(),
		).toBeVisible();
		await expect(reloadedDialog.getByText(ONE_PIXEL_PNG_BASE64)).toHaveCount(0);
	});

	test('renders streamed and persisted retrieval tool dialogs without inline previews', async ({ page }) => {
		let activeThreadId = 'thread-file-placeholder';
		let messageCount = 0;
		const messages: Array<Record<string, unknown>> = [];

		await page.route('**/api/chat/threads/*/messages', async (route, request) => {
			if (request.method() !== 'GET') {
				return route.fallback();
			}

			activeThreadId = request.url().split('/threads/')[1]?.split('/messages')[0] ?? activeThreadId;
			return route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify(messages.filter((message) => message.threadId === activeThreadId)),
			});
		});

		await page.route('**/api/chat/threads/*/stream', async (route, request) => {
			const userText = extractUserText(request.postDataJSON());
			const assistantText = 'I found matching files in the knowledge base.';

			messages.push(
				{
					id: `msg-user-${++messageCount}`,
					threadId: activeThreadId,
					role: 'user',
					content: userText,
					attachments: [],
					toolInvocations: [],
					createdAt: '2026-04-16T12:05:00.000Z',
				},
				{
					id: `msg-assistant-${++messageCount}`,
					threadId: activeThreadId,
					role: 'assistant',
					content: assistantText,
					agentId: 'system-general',
					attachments: [],
					toolInvocations: [
						{
							toolCallId: 'tool-file-1',
							toolName: 'file_search',
							state: 'output-available',
							input: { query: userText },
							output: {
								matches: [
									{
										filename: 'revenue-summary-q1.pdf',
										snippet: 'Revenue increased 14% year over year.',
									},
								],
							},
						},
					],
					createdAt: '2026-04-16T12:05:01.000Z',
				},
			);

			await route.fulfill({
				status: 200,
				headers: mockStreamHeaders(),
				body: buildToolStream(assistantText, {
					type: 'tool-file_search',
					toolCallId: 'tool-file-1',
					state: 'output-available',
					input: { query: userText },
					output: {
						matches: [
							{
								filename: 'revenue-summary-q1.pdf',
								snippet: 'Revenue increased 14% year over year.',
							},
						],
					},
				}),
			});
		});

		await createThread(page, 'Retrieval tool thread');

		const composer = mainPanel(page).getByPlaceholder('Send a message...');
		await composer.fill('quarterly revenue summary');
		await page.getByRole('button', { name: 'Send' }).click();

		await expect(mainPanel(page).getByText('I found matching files in the knowledge base.').first()).toBeVisible({
			timeout: 10_000,
		});
		await expect(page.getByRole('img', { name: 'panda.png' })).toHaveCount(0);

		const pill = mainPanel(page).getByRole('button', { name: /Inspect File Search/i });
		await expect(pill).toBeVisible();
		await pill.click();
		const dialog = page.getByRole('dialog');
		await expect(page.getByRole('heading', { name: 'File Search' })).toBeVisible();
		await expect(dialog.getByText('revenue-summary-q1.pdf', { exact: true }).first()).toBeVisible();

		await page.reload();
		await waitForAgentsLoaded(page);
		await expect(threadHeader(page)).toHaveText('Retrieval tool thread');
		await expect(mainPanel(page).getByRole('button', { name: /Inspect File Search/i })).toBeVisible();
	});

	test('renders streamed and persisted execution tool dialogs', async ({ page }) => {
		let activeThreadId = 'thread-code-placeholder';
		let messageCount = 0;
		const messages: Array<Record<string, unknown>> = [];

		await page.route('**/api/chat/threads/*/messages', async (route, request) => {
			if (request.method() !== 'GET') {
				return route.fallback();
			}

			activeThreadId = request.url().split('/threads/')[1]?.split('/messages')[0] ?? activeThreadId;
			return route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify(messages.filter((message) => message.threadId === activeThreadId)),
			});
		});

		await page.route('**/api/chat/threads/*/stream', async (route, request) => {
			const userText = extractUserText(request.postDataJSON());
			const assistantText = 'I ran the calculation.';

			messages.push(
				{
					id: `msg-user-${++messageCount}`,
					threadId: activeThreadId,
					role: 'user',
					content: userText,
					attachments: [],
					toolInvocations: [],
					createdAt: '2026-04-16T12:10:00.000Z',
				},
				{
					id: `msg-assistant-${++messageCount}`,
					threadId: activeThreadId,
					role: 'assistant',
					content: assistantText,
					agentId: 'system-general',
					attachments: [],
					toolInvocations: [
						{
							toolCallId: 'tool-code-1',
							toolName: 'code_execution',
							state: 'output-available',
							input: { code: 'print(6 * 7)' },
							output: {
								stdout: '42',
								message: 'Execution finished successfully.',
							},
							providerExecuted: true,
						},
					],
					createdAt: '2026-04-16T12:10:01.000Z',
				},
			);

			await route.fulfill({
				status: 200,
				headers: mockStreamHeaders(),
				body: buildToolStream(assistantText, {
					type: 'tool-code_execution',
					toolCallId: 'tool-code-1',
					state: 'output-available',
					input: { code: 'print(6 * 7)' },
					output: {
						stdout: '42',
						message: 'Execution finished successfully.',
					},
					providerExecuted: true,
				}),
			});
		});

		await createThread(page, 'Execution tool thread');

		const composer = mainPanel(page).getByPlaceholder('Send a message...');
		await composer.fill('run 6 times 7');
		await page.getByRole('button', { name: 'Send' }).click();

		await expect(mainPanel(page).getByText('I ran the calculation.').first()).toBeVisible({
			timeout: 10_000,
		});

		const pill = mainPanel(page).getByRole('button', { name: /Inspect Code Execution/i });
		await expect(pill).toBeVisible();
		await pill.click();
		const dialog = page.getByRole('dialog');
		await expect(page.getByRole('heading', { name: 'Code Execution' })).toBeVisible();
		await expect(dialog.getByText('print(6 * 7)', { exact: true }).first()).toBeVisible();
		await expect(dialog.getByText('42', { exact: true }).first()).toBeVisible();

		await page.reload();
		await waitForAgentsLoaded(page);
		await expect(threadHeader(page)).toHaveText('Execution tool thread');
		await expect(mainPanel(page).getByRole('button', { name: /Inspect Code Execution/i })).toBeVisible();
	});

	test('agent card shows details for selected agent', async ({ page }) => {
		await createThread(page, 'Agent card thread');
		await selectAgentInRoster(page, 'General Assistant');
		await openAgentRoster(page);

		const roster = agentRoster(page);
		await expect(roster.getByRole('button', { name: 'Use' })).toBeVisible();
		await expect(roster.getByRole('button', { name: 'Duplicate' })).toBeVisible();
	});
});

test.describe('Chat page – URL state sync', () => {
	test.beforeEach(async ({ page }) => {
		await patchEmptyTableErrors(page);
	});

	test('selecting a thread updates the URL with ?thread=', async ({ page }) => {
		await navigateToChat(page);
		await waitForAgentsLoaded(page);

		await createThread(page, 'URL sync thread');
		await expect(threadHeader(page)).toHaveText('URL sync thread');

		const url = new URL(page.url());
		expect(url.searchParams.has('thread')).toBe(true);
		expect(url.searchParams.get('thread')).toBeTruthy();
	});

	test('creating a second thread updates ?thread= to the new thread', async ({ page }) => {
		await navigateToChat(page);
		await waitForAgentsLoaded(page);

		await createThread(page, 'First URL thread');
		const firstUrl = new URL(page.url());
		const firstThreadId = firstUrl.searchParams.get('thread');

		await createThread(page, 'Second URL thread');
		const secondUrl = new URL(page.url());
		const secondThreadId = secondUrl.searchParams.get('thread');

		expect(secondThreadId).toBeTruthy();
		expect(secondThreadId).not.toBe(firstThreadId);
	});

	test('switching threads updates ?thread= in the URL', async ({ page }) => {
		await navigateToChat(page);
		await waitForAgentsLoaded(page);

		await createThread(page, 'Thread One');
		const urlAfterFirst = new URL(page.url());
		const threadOneId = urlAfterFirst.searchParams.get('thread');

		await createThread(page, 'Thread Two');
		const urlAfterSecond = new URL(page.url());
		const threadTwoId = urlAfterSecond.searchParams.get('thread');

		await selectThread(page, 'Thread One');
		const urlAfterSwitch = new URL(page.url());
		expect(urlAfterSwitch.searchParams.get('thread')).toBe(threadOneId);
		expect(urlAfterSwitch.searchParams.get('thread')).not.toBe(threadTwoId);
	});

	test('deleting active thread removes ?thread= from URL', async ({ page }) => {
		await navigateToChat(page);
		await waitForAgentsLoaded(page);

		await createThread(page, 'Delete me');
		const urlBefore = new URL(page.url());
		expect(urlBefore.searchParams.has('thread')).toBe(true);

		const sidebar = threadSidebar(page);
		const threadItem = sidebar.locator('[role="button"]').filter({ hasText: 'Delete me' });
		await threadItem.hover();
		await threadItem.getByLabel('Delete thread').click();
		await expect(sidebar.getByText('Delete me')).not.toBeVisible();

		const urlAfter = new URL(page.url());
		expect(urlAfter.searchParams.has('thread')).toBe(false);
	});

	test('opening ?thread=<id> restores the selected thread', async ({ page }) => {
		await navigateToChat(page);
		await waitForAgentsLoaded(page);

		await createThread(page, 'Restorable thread');
		const threadId = new URL(page.url()).searchParams.get('thread')!;
		expect(threadId).toBeTruthy();

		await navigateToChat(page, { thread: threadId });
		await waitForAgentsLoaded(page);

		await expect(threadHeader(page)).toHaveText('Restorable thread', { timeout: 15_000 });
	});

	test('?agent= deep link seeds the default agent for new thread', async ({ page }) => {
		await navigateToChat(page, { agent: 'system-creative' });
		await waitForAgentsLoaded(page);

		await createThread(page, 'Creative agent thread');
		const header = mainPanel(page).locator('.border-b').first();
		await expect(
			header.getByText('Creative Writer', { exact: false }),
		).toBeVisible({ timeout: 10_000 });
	});
});
