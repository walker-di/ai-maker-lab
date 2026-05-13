import { test, expect, type Page } from '@playwright/test';
import { patchEmptyRtsTableErrors } from '../helpers';

async function startMatch(page: Page, aiDifficulty: 'normal' | 'hard' = 'normal') {
  await page.goto('/experiments/rts');
  await expect(page.getByTestId('match-setup')).toBeVisible({ timeout: 10_000 });
  if (aiDifficulty !== 'normal') {
    await page.getByTestId('match-setup-difficulty').selectOption(aiDifficulty);
  }
  await page.getByTestId('match-setup-start').click();
  const stage = page.getByTestId('rts-stage');
  await expect(stage).toBeVisible({ timeout: 10_000 });
  return stage;
}

test.describe('RTS Skirmish experiment', () => {
  test.beforeEach(async ({ page }) => {
    await patchEmptyRtsTableErrors(page);
  });

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

  test('match stage renders the redesigned shell with a playfield and support rail', async ({ page }) => {
    const stage = await startMatch(page);

    await expect(stage.getByTestId('rts-renderer-mode')).toBeVisible();
    await expect(stage.getByTestId('rts-select-army-button')).toBeVisible();
    await expect(stage.getByTestId('rts-mute-toggle')).toBeVisible();
    await expect(stage.getByTestId('rts-hud')).toBeVisible();
    await expect(stage.getByTestId('rts-canvas')).toBeVisible();
    await expect(stage.getByTestId('rts-mission-strip')).toBeVisible();
    await expect(stage.getByTestId('rts-mission-objective')).toContainText('Destroy the enemy camp');
    await expect(stage.getByTestId('rts-mission-objective')).toContainText('Keep your HQ alive');
    await expect(stage.getByTestId('rts-mission-objective')).toContainText('Active');
    await expect(stage.getByTestId('rts-mission-objective')).toContainText('Expand early, blunt each wave');
    await expect(stage.getByTestId('rts-wave-status')).toContainText('Enemy buildup');
    await expect(stage.getByTestId('rts-wave-status')).toContainText('No enemy wave detected');
    await expect(stage.getByTestId('rts-wave-status')).toContainText('No full strike wave yet');
    await expect(stage.getByTestId('rts-wave-status')).toContainText('massing forces beyond the ridge');

    const supportRail = stage.getByRole('complementary');
    await expect(supportRail).toBeVisible();
    await expect(supportRail.getByTestId('rts-minimap-panel')).toBeVisible();
    await expect(supportRail.getByTestId('rts-minimap')).toBeVisible();
    await expect(supportRail.getByTestId('rts-selection-panel')).toContainText('No selection');
    await expect(supportRail.getByTestId('rts-control-groups')).toBeVisible();
    await expect(supportRail.getByTestId('rts-production-groups')).toBeVisible();
    await expect(supportRail.getByTestId('rts-production-group-hq')).toBeVisible();
    await expect(supportRail.getByTestId('rts-queue-panel')).toContainText('No active production');
    await expect(supportRail.getByTestId('rts-combat-summary')).toBeVisible();
    await expect(supportRail.getByTestId('rts-event-feed')).toContainText('Match started');
  });

  test.fixme('mission strip reflects a live enemy wave launch', async () => {
    // Follow-up: expose a deterministic squad-launch hook, or wire the page model
    // to engine mission updates directly, before asserting post-launch strip copy.
  });

  test('toolbar and command-card controls remain accessible in the new shell', async ({ page }) => {
    const stage = await startMatch(page);

    const hud = stage.getByTestId('rts-hud');
    await expect(hud.getByTestId('hud-gas')).toBeVisible();
    await expect(hud.getByTestId('train-scout')).toBeVisible();
    await expect(hud.getByTestId('train-rocket')).toBeVisible();
    await expect(hud.getByTestId('build-refinery')).toBeVisible();
    await expect(hud.getByTestId('order-attack-move')).toBeVisible();
    await expect(hud.getByTestId('order-patrol')).toBeVisible();
    await expect(hud.getByTestId('order-repair')).toBeVisible();
    await expect(hud.getByTestId('order-rally')).toBeVisible();
    await expect(hud.getByTestId('order-stop')).toBeVisible();
    await expect(hud.getByTestId('select-army')).toBeVisible();

    await stage.getByTestId('rts-mute-toggle').click();
    await expect(hud.getByTestId('hud-audio')).toContainText('Muted');

    await stage.getByTestId('rts-select-army-button').click();
    await expect(page.getByTestId('rts-selection-panel')).not.toContainText('No selection');

    await hud.getByTestId('order-attack-move').click();
    await expect(page.getByTestId('rts-intent-card')).toBeVisible();
    await expect(page.getByTestId('rts-toast-stack')).toContainText('Attack Move armed');
    await stage.getByTestId('rts-canvas').hover();
    await expect(page.getByTestId('rts-order-preview')).toBeVisible();
    await expect(page.getByTestId('rts-order-preview-label')).toBeVisible();
  });

  test('training and intent controls update the queue and can be canceled', async ({ page }) => {
    await startMatch(page);

    await page.getByTestId('train-scout').click();
    await expect.poll(async () => await page.getByTestId('rts-queue-panel').textContent(), {
      timeout: 10_000,
      message: 'scout production should appear in the queue panel',
    }).toContain('scout');
    await expect(page.getByTestId('rts-toast-stack')).toContainText('Scout queued');

    await page.locator('[data-testid^="rts-cancel-producer-"]').first().click();
    await expect(page.getByTestId('rts-toast-stack')).toContainText('Scout canceled');
    await expect(page.getByTestId('rts-queue-panel')).toContainText('No active production');

    await page.getByTestId('build-depot').click();
    await expect(page.getByTestId('rts-intent-card')).toContainText('Place depot');
    await page.getByTestId('rts-canvas').click();
    await page.locator('body').press('Escape');
    await expect(page.getByTestId('rts-intent-card')).toHaveCount(0);
  });

  test('leave match returns the user to the RTS lobby', async ({ page }) => {
    await startMatch(page);

    await page.getByRole('button', { name: 'Leave match' }).click();
    await expect(page.getByTestId('rts-lobby')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('match-setup')).toBeVisible();
  });
});
