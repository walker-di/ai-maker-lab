import { expect, test } from '@playwright/test';
import { patchEmptyRacingTableErrors } from '../helpers';

const EXPECTED_PROP_FILES = [
	'cone.glb',
	'barrierWhite.glb',
	'lightPostModern.glb',
	'billboard.glb',
] as const;

test.describe('Racing asset loading', () => {
	test.beforeEach(async ({ page }) => {
		await patchEmptyRacingTableErrors(page);
	});

	test('requests Kenny GLB props from the public racing asset bundle', async ({ page }) => {
		const assetRequests: string[] = [];
		page.on('request', (request) => {
			if (/\/racing\/extracted\/.+\.glb(?:$|\?)/.test(request.url())) {
				assetRequests.push(request.url());
			}
		});

		await page.goto('/experiments/racing');
		await expect(page.getByTestId('racing-canvas')).toBeVisible({ timeout: 30_000 });
		await expect
			.poll(() => assetRequests.length, { timeout: 20_000 })
			.toBeGreaterThan(0);
	});

	test('falls back to primitive props when Kenny GLBs fail to load', async ({ page }) => {
		const assetRequestCounts = new Map<string, number>();

		await page.route('**/racing/extracted/*.glb', async (route) => {
			const file = route.request().url().split('/').pop()?.split('?')[0] ?? 'unknown.glb';
			assetRequestCounts.set(file, (assetRequestCounts.get(file) ?? 0) + 1);
			await route.fulfill({
				status: 503,
				contentType: 'text/plain',
				body: 'forced Kenny asset failure for fallback coverage',
			});
		});

		await page.goto('/experiments/racing');
		await expect(page.getByTestId('racing-canvas')).toBeVisible({ timeout: 30_000 });
		await expect(page.getByTestId('racing-hud')).toBeVisible();
		await expect(page.getByTestId('hud-speed')).toBeVisible();
		await expect(page.getByTestId('racing-error')).toHaveCount(0);

		const canvasHost = page.getByTestId('racing-canvas');
		await canvasHost.click();
		await page.keyboard.press('c');
		await expect(page.getByTestId('hud-bottom')).toContainText(/cam:\s*hood/i);

		await expect
			.poll(
				() => EXPECTED_PROP_FILES.every((file) => (assetRequestCounts.get(file) ?? 0) === 1),
				{ timeout: 20_000 },
			)
			.toBe(true);
		expect([...assetRequestCounts.keys()].sort()).toEqual([...EXPECTED_PROP_FILES].sort());

		await page.waitForTimeout(1000);
		for (const file of EXPECTED_PROP_FILES) {
			expect(assetRequestCounts.get(file)).toBe(1);
		}
	});
});
