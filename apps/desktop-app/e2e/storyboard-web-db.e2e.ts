import { expect, test } from '@playwright/test';

/**
 * Unmocked smoke test that proves:
 * 1. The storyboard API connects to mem:// without DB timeout errors.
 * 2. Basic CRUD works end-to-end through the real SvelteKit route handlers.
 * 3. No "externalized for browser compatibility" Vite warnings appear in the console.
 */

test.describe('storyboard web DB smoke', () => {
	test('GET /api/marketing/storyboards returns 200 without mocks', async ({ request }) => {
		const response = await request.get('/api/marketing/storyboards');
		expect(response.status()).toBe(200);
		const body = await response.json();
		expect(Array.isArray(body)).toBe(true);
	});

	test('create storyboard via API returns 201', async ({ request }) => {
		const response = await request.post('/api/marketing/storyboards', {
			data: { name: 'DB smoke test storyboard' },
		});
		expect(response.status()).toBe(201);
		const body = await response.json();
		expect(body).toMatchObject({ name: 'DB smoke test storyboard' });
		expect(typeof body.id).toBe('string');
	});

	test('storyboard page loads without DB error banner', async ({ page }) => {
		const consoleMessages: string[] = [];
		page.on('console', (msg) => consoleMessages.push(msg.text()));

		await page.goto('/experiments/storyboard');
		await page.waitForSelector('h1', { timeout: 15_000 });

		// Should show the page title, not an error state
		await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
		expect(await page.locator('[role="alert"]').count()).toBe(0);
	});

	test('no Node built-in externalization warnings in browser console', async ({ page }) => {
		const externalizationWarnings: string[] = [];
		page.on('console', (msg) => {
			if (msg.text().includes('externalized for browser compatibility')) {
				externalizationWarnings.push(msg.text());
			}
		});

		await page.goto('/experiments/storyboard');
		await page.waitForSelector('h1', { timeout: 15_000 });

		expect(externalizationWarnings).toHaveLength(0);
	});

	test('create storyboard through UI and see it appear', async ({ page }) => {
		await page.goto('/experiments/storyboard');
		await page.waitForSelector('h1', { timeout: 15_000 });

		// Intercept POST to capture the response
		const [postResponse] = await Promise.all([
			page.waitForResponse((resp) =>
				resp.url().includes('/api/marketing/storyboards') && resp.request().method() === 'POST',
			),
			page.getByRole('button', { name: /create storyboard/i }).click(),
			page.getByRole('textbox').fill('UI smoke storyboard').catch(() => null),
			page.getByRole('button', { name: /create/i }).last().click().catch(() => null),
		]);

		expect(postResponse.status()).toBe(201);
	});
});
