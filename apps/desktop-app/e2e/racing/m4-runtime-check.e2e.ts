import { expect, test } from '@playwright/test';
import { patchEmptyRacingTableErrors } from '../helpers';

test.describe('M4 runtime verification', () => {
  test.beforeEach(async ({ page }) => {
    await patchEmptyRacingTableErrors(page);
  });

  test('M4 trackCondition fields are finite in the live HUD state', async ({ page }) => {
    await page.goto('/experiments/racing');
    await expect(page.getByTestId('racing-canvas')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('racing-loading')).toHaveCount(0, { timeout: 15_000 });

    // Wait for at least one simulation step to have run
    await page.waitForTimeout(500);

    const trackCondition = await page.evaluate(() => {
      const racing = (window as any).__racing;
      return racing?.hud?.state?.trackCondition ?? null;
    });

    expect(trackCondition).not.toBeNull();
    expect(Number.isFinite(trackCondition.trackTempC)).toBe(true);
    expect(Number.isFinite(trackCondition.rubberLineGrip)).toBe(true);
    expect(Number.isFinite(trackCondition.bumpAmplitudeM)).toBe(true);
    expect(typeof trackCondition.terrainActive).toBe('boolean');
    // Default flat track: terrainActive should be false
    expect(trackCondition.terrainActive).toBe(false);
    // Default track temp: 28°C
    expect(trackCondition.trackTempC).toBe(28);
  });

  test('M4 all 4 wheel Fz are finite and positive at rest on default flat track', async ({ page }) => {
    await page.goto('/experiments/racing');
    await expect(page.getByTestId('racing-canvas')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('racing-loading')).toHaveCount(0, { timeout: 15_000 });
    await page.waitForTimeout(800);

    const wheels = await page.evaluate(() => {
      const racing = (window as any).__racing;
      return (racing?.hud?.state?.wheels ?? []).slice(0, 4).map((w: any) => ({
        fz: w.fz,
        tempC: w.tempC,
        pressureKpa: w.pressureKpa,
        surface: w.surface,
      }));
    });

    expect(wheels.length).toBe(4);
    for (const w of wheels) {
      expect(Number.isFinite(w.fz)).toBe(true);
      expect(w.fz).toBeGreaterThan(0);
      expect(Number.isFinite(w.tempC)).toBe(true);
      expect(Number.isFinite(w.pressureKpa)).toBe(true);
    }
  });

  test('M4 snapshot stays finite after 3 reset-and-drive cycles', async ({ page }) => {
    await page.goto('/experiments/racing');
    const canvasHost = page.getByTestId('racing-canvas');
    await expect(canvasHost).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('racing-loading')).toHaveCount(0, { timeout: 15_000 });
    await canvasHost.click();

    for (let cycle = 0; cycle < 3; cycle++) {
      await page.keyboard.press('r');
      await page.waitForTimeout(200);
      // Shift to 1 and apply throttle briefly
      await page.keyboard.press(']');
      await page.keyboard.down('w');
      await page.waitForTimeout(400);
      await page.keyboard.up('w');
    }

    const snap = await page.evaluate(() => {
      const racing = (window as any).__racing;
      const s = racing?.hud?.state;
      if (!s) return null;
      return {
        speedKmh: s.speedKmh,
        rpm: s.rpm,
        yawRateRad: s.yawRateRad,
        wheels: (s.wheels ?? []).slice(0, 4).map((w: any) => w.fz),
      };
    });

    expect(snap).not.toBeNull();
    expect(Number.isFinite(snap!.speedKmh)).toBe(true);
    expect(Number.isFinite(snap!.rpm)).toBe(true);
    expect(Number.isFinite(snap!.yawRateRad)).toBe(true);
    for (const fz of snap!.wheels) {
      expect(Number.isFinite(fz)).toBe(true);
    }
  });
});
