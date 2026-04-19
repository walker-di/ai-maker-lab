import { test, expect } from '@playwright/test';
import {
	patchEmptyTableErrors,
	navigateToChat,
	waitForAgentsLoaded,
	createThread,
	mainPanel,
} from '../helpers';

/**
 * Builds a mock AI SDK UI message stream response (SSE format).
 * See: https://ai-sdk.dev/docs/ai-sdk-ui/stream-protocol
 */
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

function mockStreamHeaders() {
	return {
		'Content-Type': 'text/event-stream',
		'Cache-Control': 'no-cache',
		Connection: 'keep-alive',
		'x-vercel-ai-ui-message-stream': 'v1',
	};
}

test.describe('Chat page – streaming (mocked)', () => {
	test.beforeEach(async ({ page }) => {
		await patchEmptyTableErrors(page);
		await navigateToChat(page);
		await waitForAgentsLoaded(page);
	});

	test('sends a message and sees mocked assistant response', async ({ page }) => {
		await page.route('**/api/chat/threads/*/stream', async (route) => {
			await route.fulfill({
				status: 200,
				headers: mockStreamHeaders(),
				body: buildMockStream('Hello from the mocked assistant!'),
			});
		});

		await createThread(page, 'Streaming test thread');

		const composer = mainPanel(page).getByPlaceholder('Send a message...');
		await composer.fill('What is 2 + 2?');
		await page.getByRole('button', { name: 'Send' }).click();

		await expect(page.getByText('What is 2 + 2?')).toBeVisible({ timeout: 5_000 });
		await expect(
			page.getByText('Hello from the mocked assistant!'),
		).toBeVisible({ timeout: 10_000 });
	});

	test('multiple messages in a conversation', async ({ page }) => {
		let callCount = 0;
		await page.route('**/api/chat/threads/*/stream', async (route) => {
			callCount++;
			const text =
				callCount === 1 ? 'First mocked reply.' : 'Second mocked reply.';
			await route.fulfill({
				status: 200,
				headers: mockStreamHeaders(),
				body: buildMockStream(text),
			});
		});

		await createThread(page, 'Multi-turn stream thread');

		const composer = mainPanel(page).getByPlaceholder('Send a message...');

		await composer.fill('Message one');
		await page.getByRole('button', { name: 'Send' }).click();
		await expect(page.getByText('First mocked reply.')).toBeVisible({
			timeout: 10_000,
		});

		await composer.fill('Message two');
		await page.getByRole('button', { name: 'Send' }).click();
		await expect(page.getByText('Second mocked reply.')).toBeVisible({
			timeout: 10_000,
		});
	});

	test('user message appears immediately even before stream completes', async ({
		page,
	}) => {
		await page.route('**/api/chat/threads/*/stream', async (route) => {
			await new Promise((r) => setTimeout(r, 2000));
			await route.fulfill({
				status: 200,
				headers: mockStreamHeaders(),
				body: buildMockStream('Delayed response'),
			});
		});

		await createThread(page, 'Immediate echo thread');

		const composer = mainPanel(page).getByPlaceholder('Send a message...');
		await composer.fill('Show me right away');
		await page.getByRole('button', { name: 'Send' }).click();

		await expect(page.getByText('Show me right away')).toBeVisible({
			timeout: 3_000,
		});

		await expect(page.getByText('Delayed response')).toBeVisible({
			timeout: 10_000,
		});
	});

	test('stream request body contains messages array with user text', async ({ page }) => {
		let capturedBody: Record<string, unknown> | null = null;

		await page.route('**/api/chat/threads/*/stream', async (route, request) => {
			capturedBody = request.postDataJSON();
			await route.fulfill({
				status: 200,
				headers: mockStreamHeaders(),
				body: buildMockStream('Contract check reply'),
			});
		});

		await createThread(page, 'Contract check thread');

		const composer = mainPanel(page).getByPlaceholder('Send a message...');
		await composer.fill('Contract test message');
		await page.getByRole('button', { name: 'Send' }).click();

		await expect(page.getByText('Contract check reply')).toBeVisible({ timeout: 10_000 });

		expect(capturedBody).not.toBeNull();
		expect(Array.isArray(capturedBody!.messages)).toBe(true);

		const messages = capturedBody!.messages as Array<Record<string, unknown>>;
		const lastUser = [...messages].reverse().find((m) => m.role === 'user');
		expect(lastUser).toBeDefined();

		const parts = lastUser!.parts as Array<Record<string, unknown>>;
		const textPart = parts.find((p) => p.type === 'text');
		expect(textPart).toBeDefined();
		expect(textPart!.text).toBe('Contract test message');
	});

	test('stream error response shows error state, not silent failure', async ({ page }) => {
		await page.route('**/api/chat/threads/*/stream', async (route) => {
			await route.fulfill({
				status: 500,
				contentType: 'application/json',
				body: JSON.stringify({ error: 'Model unavailable' }),
			});
		});

		await createThread(page, 'Error test thread');

		const composer = mainPanel(page).getByPlaceholder('Send a message...');
		await composer.fill('This should fail');
		await page.getByRole('button', { name: 'Send' }).click();

		await expect(page.getByText('This should fail')).toBeVisible({ timeout: 5_000 });

		const main = mainPanel(page);
		await expect(
			main.getByText(/failed|error|unavailable/i).first(),
		).toBeVisible({ timeout: 10_000 });
	});
});

test.describe('Chat page – streaming (live)', () => {
	test.skip(
		!process.env.OPENAI_API_KEY,
		'Skipped: OPENAI_API_KEY not set',
	);

	test.beforeEach(async ({ page }) => {
		await patchEmptyTableErrors(page);
		await navigateToChat(page);
		await waitForAgentsLoaded(page);
	});

	test('sends a message and receives a real streamed response', async ({
		page,
	}) => {
		await createThread(page, 'Live stream thread');

		const composer = mainPanel(page).getByPlaceholder('Send a message...');
		await composer.fill('Reply with exactly: "E2E_OK"');
		await page.getByRole('button', { name: 'Send' }).click();

		await expect(
			page.getByText('Reply with exactly: "E2E_OK"'),
		).toBeVisible({ timeout: 5_000 });

		await expect(page.locator('main').getByText('E2E_OK')).toBeVisible({
			timeout: 30_000,
		});
	});
});
