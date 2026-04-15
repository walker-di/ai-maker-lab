import { type Page, expect } from '@playwright/test';

const CHAT_URL = '/experiments/chat';

/**
 * Intercept chat API endpoints that may 500 on a fresh SurrealDB mem://
 * instance (tables don't exist yet) and return safe empty responses.
 */
export async function patchEmptyTableErrors(page: Page) {
	await page.route('**/api/chat/**', async (route, request) => {
		if (request.method() !== 'GET') {
			return route.fallback();
		}
		const response = await route.fetch();
		if (response.ok()) {
			return route.fulfill({ response });
		}
		return route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify([]),
		});
	});
}

export async function navigateToChat(page: Page) {
	await page.goto(CHAT_URL);
	await page.waitForSelector('text=Threads');
}

export async function waitForAgentsLoaded(page: Page) {
	const roster = page.locator('aside').last();
	await expect(roster.getByRole('button', { name: /General Assistant/ })).toBeVisible({
		timeout: 15_000,
	});
}

export function threadSidebar(page: Page) {
	return page.locator('aside').first();
}

export function agentRoster(page: Page) {
	return page.locator('aside').last();
}

export function mainPanel(page: Page) {
	return page.locator('main');
}

/**
 * The thread header h2 shows the title inside <main> only when activeThread is set.
 * We look for a font-semibold h2 that is NOT the "Select or create a thread" heading.
 */
export function threadHeader(page: Page) {
	return mainPanel(page).locator('.text-sm.font-semibold').first();
}

export async function createThread(page: Page, title: string) {
	const input = page.getByPlaceholder('New thread...');
	await input.fill(title);

	const addButton = page.getByRole('button', { name: '+' });
	await addButton.click();

	await expect(threadHeader(page)).toHaveText(title, { timeout: 15_000 });
}

export async function selectThread(page: Page, title: string) {
	const sidebar = threadSidebar(page);
	await sidebar.getByText(title, { exact: false }).first().click();
	await expect(threadHeader(page)).toHaveText(title, { timeout: 10_000 });
}

export async function selectAgentInRoster(page: Page, agentName: string) {
	const roster = agentRoster(page);
	await roster.getByRole('button', { name: new RegExp(agentName) }).click();
}
