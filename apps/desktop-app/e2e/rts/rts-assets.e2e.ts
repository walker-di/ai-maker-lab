import { expect, test } from '@playwright/test';
import { patchEmptyRtsTableErrors } from '../helpers';

const EXPECTED_ATLAS_FILES = [
  'landscape_sheet.png',
  'towers_grey_sheet.png',
  'towers_red_sheet.png',
  'towers_brown_sheet.png',
] as const;

test.describe('RTS asset loading', () => {
  test.beforeEach(async ({ page }) => {
    await patchEmptyRtsTableErrors(page);
  });

  test('requests every RTS atlas sheet without sprite 404s', async ({ page }) => {
    const requestedAtlasFiles = new Set<string>();
    const failedResponses: string[] = [];

    page.on('request', (request) => {
      const url = request.url();
      if (!url.includes('/rts/towerDefense/Spritesheet/')) return;
      const file = url.split('/').pop()?.split('?')[0];
      if (file) requestedAtlasFiles.add(file);
    });

    page.on('response', (response) => {
      const url = response.url();
      if (url.includes('/rts/towerDefense/Spritesheet/') && response.status() >= 400) {
        failedResponses.push(url);
      }
    });

    await page.goto('/experiments/rts');
    await expect(page.getByTestId('match-setup-start')).toBeEnabled({ timeout: 10_000 });
    await page.getByTestId('match-setup-start').click();
    await expect(page.getByTestId('rts-stage')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('rts-renderer-mode')).toContainText(/vector/i);

    await expect
      .poll(() => EXPECTED_ATLAS_FILES.every((file) => requestedAtlasFiles.has(file)), {
        timeout: 20_000,
        message: 'all RTS atlas sheets should be requested after the match stage mounts',
      })
      .toBe(true);

    await expect(page.getByTestId('rts-renderer-mode')).toContainText(/(vector|sprite)/i);

    expect([...requestedAtlasFiles].sort()).toEqual([...EXPECTED_ATLAS_FILES].sort());
    expect(failedResponses).toEqual([]);
  });
});
