import { test, expect } from '@playwright/test';

test.describe('RTS Skirmish experiment', () => {
  test('home page exposes a link to the RTS route', async ({ page }) => {
    await page.goto('/');
    const card = page.locator('a[href="/experiments/rts"]').first();
    await expect(card).toBeVisible();
  });

  test('lobby loads catalog and exposes setup form', async ({ page }) => {
    await page.goto('/experiments/rts');
    await expect(page.getByRole('heading', { name: 'RTS Skirmish' })).toBeVisible();

    const lobby = page.getByTestId('rts-lobby');
    await expect(lobby).toBeVisible({ timeout: 10_000 });

    const setup = page.getByTestId('match-setup');
    await expect(setup).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('match-setup-map')).toBeVisible();
    await expect(page.getByTestId('match-setup-difficulty')).toBeVisible();
    await expect(page.getByTestId('match-setup-start')).toBeEnabled();
  });

  test('map generation panel produces a previewable map', async ({ page }) => {
    await page.goto('/experiments/rts');
    await expect(page.getByTestId('match-setup')).toBeVisible({ timeout: 10_000 });
    await page.getByTestId('match-setup-generate').click();
    const panel = page.getByTestId('mapgen-panel');
    await expect(panel).toBeVisible();
    await page.getByTestId('mapgen-generate').click();
    await expect(page.getByTestId('rts-map-preview')).toBeVisible({ timeout: 10_000 });
  });
});
