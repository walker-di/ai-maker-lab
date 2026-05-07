import { expect, test } from '@playwright/test';
import { patchEmptyRacingTableErrors } from '../helpers';

test.describe('Racing chassis compliance preset', () => {
	test.beforeEach(async ({ page }) => {
		await patchEmptyRacingTableErrors(page);
	});

	test('HUD mounts without errors when loading the compliance-enabled GT3 preset', async ({ page }) => {
		await page.goto('/experiments/racing?vehicle=gt3-rigid-tub');
		await expect(page.getByTestId('racing-canvas')).toBeVisible({ timeout: 15_000 });
		await expect(page.getByTestId('racing-loading')).toHaveCount(0, { timeout: 15_000 });
		await expect(page.getByTestId('racing-hud')).toBeVisible();
		await expect(page.getByTestId('hud-speed')).toBeVisible();
		await expect(page.getByTestId('hud-gear')).toBeVisible();
		await expect(page.getByTestId('hud-wheel-0')).toBeVisible();
		await expect(page.getByTestId('racing-error')).toHaveCount(0);
		await expect(page.getByTestId('hud-bottom')).toContainText(/car:\s*gt3 \/ rigid-tub/i);
	});

	test('telemetry widgets render for the compliance preset', async ({ page }) => {
		await page.goto('/experiments/racing?vehicle=gt3-rigid-tub');
		await expect(page.getByTestId('racing-canvas')).toBeVisible({ timeout: 15_000 });
		await expect(page.getByTestId('hud-speed')).toBeVisible();
		await expect(page.getByTestId('hud-rpm')).toBeVisible();
		await expect(page.getByTestId('hud-gear')).toBeVisible();
		await expect(page.getByTestId('hud-lap')).toBeVisible();
		await expect(page.getByTestId('hud-wheel-0')).toBeVisible();
		await expect(page.getByTestId('hud-trace')).toBeVisible();
		await expect(page.getByTestId('hud-gg')).toBeVisible();
	});

	test('R reset works with the compliance preset and returns to idle', async ({ page }) => {
		await page.goto('/experiments/racing?vehicle=gt3-rigid-tub');
		const canvasHost = page.getByTestId('racing-canvas');
		await expect(canvasHost).toBeVisible({ timeout: 15_000 });
		await canvasHost.click();

		// Shift to first gear and apply throttle briefly.
		for (let attempt = 0; attempt < 8; attempt++) {
			const gearText = await page.getByTestId('hud-gear').textContent();
			if (gearText?.match(/\b1\b/)) break;
			await page.keyboard.press(']');
		}
		await page.keyboard.down('w');
		await page.waitForTimeout(600);
		await page.keyboard.up('w');

		const speedBefore = await readHudSpeed(page);
		expect(speedBefore).toBeGreaterThan(0);

		// Reset.
		await page.keyboard.press('r');
		await expect(page.getByTestId('hud-gear')).toContainText(/\bN\b/);
		await expect.poll(async () => readHudSpeed(page), {
			timeout: 10_000,
			message: 'speed should return close to zero after reset',
		}).toBeLessThan(1);
	});

	test('switching to compliance preset from default works without errors', async ({ page }) => {
		await page.goto('/experiments/racing');
		await expect(page.getByTestId('racing-canvas')).toBeVisible({ timeout: 15_000 });

		await page.getByLabel('Vehicle preset').selectOption({ label: 'GT3 / Rigid-tub' });
		await expect(page.getByTestId('hud-bottom')).toContainText(/car:\s*gt3 \/ rigid-tub/i);
		await expect(page.getByTestId('racing-error')).toHaveCount(0);
		await expect(page.getByTestId('hud-gear')).toContainText(/\bN\b/);
	});
});

async function readHudSpeed(page: import('@playwright/test').Page): Promise<number> {
	const text = await page.getByTestId('hud-speed').textContent();
	const match = text?.match(/\d+/);
	return match ? Number.parseInt(match[0], 10) : 0;
}
