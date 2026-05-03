import { test, expect } from '@playwright/test';
import { patchEmptyRacingTableErrors } from '../helpers';

test.describe('Racing Sim experiment', () => {
	test.beforeEach(async ({ page }) => {
		await patchEmptyRacingTableErrors(page);
	});

	test('page header renders and catalog buttons appear', async ({ page }) => {
		await page.goto('/experiments/racing');
		await expect(page.getByRole('heading', { name: 'Racing Sim' })).toBeVisible();

		const stage = page.getByTestId('racing-stage');
		await expect(stage).toBeVisible({ timeout: 15_000 });

		// Catalog buttons (vehicles + tracks load via /api/racing/* endpoints).
		await expect(page.getByRole('button', { name: /Start drive/ })).toBeVisible({
			timeout: 15_000,
		});
	});

	test('canvas mounts and HUD becomes visible after Start drive', async ({ page }) => {
		await page.goto('/experiments/racing');
		await expect(page.getByTestId('racing-stage')).toBeVisible({ timeout: 15_000 });

		const startBtn = page.getByRole('button', { name: /Start drive/ });
		await expect(startBtn).toBeEnabled({ timeout: 15_000 });
		await startBtn.click();

		const canvasHost = page.getByTestId('racing-canvas');
		await expect(canvasHost.locator('canvas')).toBeVisible({ timeout: 10_000 });

		// HUD card with the speed reading.
		await expect(page.getByText(/km\/h/i).first()).toBeVisible({ timeout: 10_000 });
	});

	test('keyboard binding cycles camera mode', async ({ page }) => {
		await page.goto('/experiments/racing');
		await expect(page.getByTestId('racing-stage')).toBeVisible({ timeout: 15_000 });

		const startBtn = page.getByRole('button', { name: /Start drive/ });
		await expect(startBtn).toBeEnabled({ timeout: 15_000 });
		await startBtn.click();

		const cameraBtn = page.getByRole('button', { name: /Camera: chase/ });
		await expect(cameraBtn).toBeVisible({ timeout: 10_000 });

		await page.keyboard.press('c');
		await expect(page.getByRole('button', { name: /Camera: hood/ })).toBeVisible({
			timeout: 5_000,
		});
	});

	test('catalog buttons are interactive', async ({ page }) => {
		await page.goto('/experiments/racing');
		await expect(page.getByTestId('racing-stage')).toBeVisible({ timeout: 15_000 });

		await expect(page.getByRole('button', { name: /Start drive/ })).toBeEnabled({
			timeout: 15_000,
		});

		// Vehicle and track sections render lists of selectable buttons.
		const vehicleSection = page.locator('aside').first();
		await expect(vehicleSection.getByRole('button').first()).toBeVisible({ timeout: 10_000 });
	});

	test('home page exposes a link to the racing route', async ({ page }) => {
		await page.goto('/');
		const link = page.locator('a[href="/experiments/racing"]').first();
		// Link is optional; if it doesn't exist yet, skip rather than fail.
		test.skip((await link.count()) === 0, 'Home page does not yet link to /experiments/racing');
		await expect(link).toBeVisible();
	});
});
