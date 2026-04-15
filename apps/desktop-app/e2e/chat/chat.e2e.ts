import { test, expect } from '@playwright/test';
import {
	patchEmptyTableErrors,
	navigateToChat,
	waitForAgentsLoaded,
	createThread,
	selectThread,
	selectAgentInRoster,
	threadSidebar,
	agentRoster,
	mainPanel,
} from '../helpers';

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
		await selectAgentInRoster(page, 'Creative Writer');
		await createThread(page, 'Agent test thread');

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

	test('agent card shows details for selected agent', async ({ page }) => {
		const roster = agentRoster(page);
		await selectAgentInRoster(page, 'General Assistant');

		await expect(roster.getByRole('button', { name: 'Use' })).toBeVisible();
		await expect(roster.getByRole('button', { name: 'Duplicate' })).toBeVisible();
	});
});
