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
		try {
			const response = await route.fetch();
			if (response.ok()) {
				const body = await response.body();
				return route.fulfill({
					status: response.status(),
					headers: response.headers(),
					body,
				});
			}
			return route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify([]),
			});
		} catch {
			// Teardown races: in-flight GETs can outlive the browser context.
			return route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify([]),
			});
		}
	});
}

export async function navigateToChat(page: Page, query?: Record<string, string>) {
	const params = query ? '?' + new URLSearchParams(query).toString() : '';
	const agentsResponse = page.waitForResponse((response) => {
		return response.url().includes('/api/chat/agents') && response.request().method() === 'GET';
	});
	await page.goto(CHAT_URL + params);
	await page.waitForSelector('text=Threads');
	await agentsResponse;
}

export async function waitForAgentsLoaded(page: Page) {
	await expect(page.getByRole('heading', { name: 'Threads' })).toBeVisible({ timeout: 15_000 });
}

export function threadSidebar(page: Page) {
	return page.locator('aside').first();
}

export function agentRoster(page: Page) {
	return page.getByTestId('agent-sheet');
}

export async function openAgentRoster(page: Page) {
	await mainPanel(page).getByRole('button', { name: 'Agents' }).click();
	await expect(agentRoster(page).getByRole('heading', { name: 'Agents' })).toBeVisible({
		timeout: 15_000,
	});
}

export function mainPanel(page: Page) {
	// Shell layout can wrap experiments in an outer `<main>`; chat nests a second
	// `<main>` for the thread panel. Prefer the innermost `main` for message UI.
	return page.locator('main').last();
}

/** Title of the active thread, rendered in the main chat chrome when a thread is selected. */
export function threadHeader(page: Page) {
	return mainPanel(page).getByTestId('chat-thread-title');
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
	await openAgentRoster(page);
	const roster = agentRoster(page);
	await roster.getByRole('button', { name: new RegExp(agentName) }).click();
}
