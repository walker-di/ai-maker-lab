import { test, expect } from '@playwright/test';

test.describe('Home route AI section', () => {
	test('shows the Agent Registry card and links to the registry route', async ({ page }) => {
		await page.goto('/');

		const registryCard = page.getByRole('link', { name: /Agent Registry Browse system/i });
		await expect(registryCard).toBeVisible();

		const href = await registryCard.getAttribute('href');
		expect(href).toMatch(/\/agents$/);
	});

	test('shows a separate Multi-Agent Chat card alongside Agent Registry', async ({ page }) => {
		await page.goto('/');

		const chatCard = page.getByRole('link', { name: /Multi-Agent Chat Chat with AI/i });
		await expect(chatCard).toBeVisible();

		const href = await chatCard.getAttribute('href');
		expect(href).toMatch(/\/experiments\/chat$/);
	});

	test('Agent Registry card navigates to the registry page', async ({ page }) => {
		await page.goto('/');

		await page.getByRole('link', { name: /Agent Registry Browse system/i }).click();
		await expect(page).toHaveURL(/\/agents(\/)?(\?.*)?$/);
		await expect(page.getByRole('heading', { name: /Agent Registry/i })).toBeVisible();
	});
});
