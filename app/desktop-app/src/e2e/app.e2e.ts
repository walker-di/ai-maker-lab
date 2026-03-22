import { expect, test } from '@playwright/test';

test('renders the neutralino desktop shell', async ({ page }) => {
	await page.goto('/');

	await expect(page.getByRole('heading', { name: /desktop adapter boundary/i })).toBeVisible();
	await expect(page.getByText('Browser preview', { exact: true })).toBeVisible();
	await expect(page.getByText(/adapter pattern guardrails/i)).toBeVisible();
});
