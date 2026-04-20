import { test, expect } from '@playwright/test';

test.describe('Platformer editor', () => {
  test('home page exposes a link to the editor route', async ({ page }) => {
    await page.goto('/');
    const card = page.locator('a[href$="/experiments/platformer/editor"]').first();
    await expect(card).toBeVisible({ timeout: 15_000 });
    await expect(card).toContainText('Platformer Editor');
  });

  test('editor route loads, paints tiles, and saves a user map round-tripped from the API', async ({ page }) => {
    await page.goto('/experiments/platformer/editor');
    await expect(page.getByRole('heading', { name: 'Platformer Editor' })).toBeVisible();

    // Toolbar + canvas + palette are mounted.
    await expect(page.getByTestId('map-editor-toolbar')).toBeVisible();
    await expect(page.getByTestId('map-editor-canvas')).toBeVisible();
    await expect(page.getByTestId('map-editor-palette')).toBeVisible();

    // Pick the brush tool + a ground tile, then paint by clicking the canvas.
    await page.getByTestId('tool-brush').click();
    await page.getByTestId('palette-tile-ground').click();

    const canvas = page.getByTestId('map-editor-canvas');
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      await page.mouse.move(box.x + 60, box.y + 60);
      await page.mouse.down();
      await page.mouse.move(box.x + 120, box.y + 60);
      await page.mouse.up();
    }

    // After editing, the dirty badge appears.
    await expect(page.getByTestId('editor-dirty-badge')).toBeVisible({ timeout: 5_000 });

    // Save should round-trip through the REST API and surface a status message.
    await page.getByTestId('editor-save-btn').click();
    await expect(page.getByTestId('editor-status')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('editor-status')).toContainText(/Saved/i);

    // The catalog sidebar lists at least the freshly saved map.
    const catalog = page.getByTestId('editor-catalog');
    const entries = catalog.getByTestId('editor-catalog-entry');
    await expect(entries.first()).toBeVisible({ timeout: 10_000 });
  });
});
