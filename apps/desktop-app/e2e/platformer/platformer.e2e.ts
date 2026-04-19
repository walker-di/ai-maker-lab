import { test, expect } from '@playwright/test';

test.describe('Platformer experiment', () => {
  test('home page exposes a link to the platformer route', async ({ page }) => {
    await page.goto('/');
    const card = page.locator('a[href="/experiments/platformer"]').first();
    await expect(card).toBeVisible();
    await expect(card).toContainText('Platformer');
  });

  test('runtime route loads the catalog and lets the player select a level', async ({ page }) => {
    await page.goto('/experiments/platformer');
    await expect(page.getByRole('heading', { name: 'Platformer' })).toBeVisible();

    // Catalog renders at least the demo built-in level.
    const catalog = page.getByTestId('platformer-catalog');
    await expect(catalog).toBeVisible({ timeout: 10_000 });
    const entries = catalog.getByTestId('platformer-catalog-entry');
    await expect(entries.first()).toBeVisible({ timeout: 10_000 });

    const firstEntry = entries.first();
    const mapId = await firstEntry.getAttribute('data-map-id');
    expect(mapId).toBeTruthy();

    await firstEntry.click();
    await expect(firstEntry).toHaveAttribute('data-selected', 'true');

    // HUD renders once the engine is mounted.
    await expect(page.getByTestId('platformer-hud')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('hud-score')).toContainText('000000');

    // Drive a few frames of input. We only assert that the engine accepts input
    // without throwing; fully completing the level is covered by engine unit tests.
    await page.keyboard.down('ArrowRight');
    await page.waitForTimeout(250);
    await page.keyboard.press('Space');
    await page.waitForTimeout(250);
    await page.keyboard.up('ArrowRight');

    // Pause toggle works once a run is active.
    const pauseButton = page.getByRole('button', { name: 'Pause' });
    await expect(pauseButton).toBeEnabled();
    await pauseButton.click();
    await expect(page.getByRole('button', { name: 'Resume' })).toBeVisible();
  });
});
