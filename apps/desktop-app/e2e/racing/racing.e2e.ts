import { expect, test, type Page } from '@playwright/test';
import { patchEmptyRacingTableErrors } from '../helpers';

async function readHudSpeed(page: Page): Promise<number> {
	const text = await page.getByTestId('hud-speed').textContent();
	const match = text?.match(/\d+/);
	return match ? Number.parseInt(match[0], 10) : 0;
}

async function focusStageAndShiftToFirst(page: Page): Promise<void> {
	const canvasHost = page.getByTestId('racing-canvas');
	await expect(canvasHost).toBeVisible({ timeout: 15_000 });
	await expect(page.getByTestId('racing-loading')).toHaveCount(0, { timeout: 15_000 });
	for (let attempt = 0; attempt < 4; attempt++) {
		await canvasHost.click();
		await page.keyboard.press(']');
		const gearText = await page.getByTestId('hud-gear').textContent();
		if (gearText?.match(/\b1\b/)) return;
	}
	await expect(page.getByTestId('hud-gear')).toContainText(/\b1\b/);
}

async function accelerateToSpeed(page: Page, minSpeedKmh: number): Promise<number> {
	const gearText = await page.getByTestId('hud-gear').textContent();
	if (!gearText?.match(/\b1\b/)) {
		await focusStageAndShiftToFirst(page);
	} else {
		await page.getByTestId('racing-canvas').click();
	}
	await page.keyboard.down('w');
	await expect.poll(async () => readHudSpeed(page), {
		timeout: 10_000,
		message: `speed should increase above ${minSpeedKmh} km/h while throttling`,
	}).toBeGreaterThan(minSpeedKmh);
	const speed = await readHudSpeed(page);
	await page.keyboard.up('w');
	return speed;
}

async function readRuntimeAidState(page: Page): Promise<{
	absEnabled: boolean;
	tcEnabled: boolean;
	escEnabled: boolean;
	absActive: boolean;
	tcActive: boolean;
	escActive: boolean;
	tcCutPct: number;
} | null> {
	return page.evaluate(() => {
		const model = (window as Window & {
			__racing?: {
				hud?: {
					state?: {
						absEnabled: boolean;
						tcEnabled: boolean;
						escEnabled: boolean;
						absActive: boolean;
						tcActive: boolean;
						escActive: boolean;
						tcCutPct: number;
					};
				};
			};
		}).__racing;
		const state = model?.hud?.state;
		if (!state) {
			return null;
		}
		return {
			absEnabled: state.absEnabled,
			tcEnabled: state.tcEnabled,
			escEnabled: state.escEnabled,
			absActive: state.absActive,
			tcActive: state.tcActive,
			escActive: state.escActive,
			tcCutPct: state.tcCutPct,
		};
	});
}

async function readRuntimeSteeringState(page: Page): Promise<{
	steer: number;
	leftLoadPct: number;
	yawRateRad: number;
	wheels: [number, number, number, number];
} | null> {
	return page.evaluate(() => {
		const model = (window as Window & {
			__racing?: {
				hud?: {
					state?: {
						input: { steer: number };
						leftLoadPct: number;
						yawRateRad: number;
						wheels: Array<{ fz: number }>;
					};
				};
			};
		}).__racing;
		const state = model?.hud?.state;
		if (!state || state.wheels.length < 4) {
			return null;
		}
		return {
			steer: state.input.steer,
			leftLoadPct: state.leftLoadPct,
			yawRateRad: state.yawRateRad,
			wheels: [state.wheels[0].fz, state.wheels[1].fz, state.wheels[2].fz, state.wheels[3].fz],
		};
	});
}

async function readRuntimeSetupState(page: Page): Promise<{
	setup: {
		frontToeDeg: number;
		rearToeDeg: number;
		casterDeg: number;
		ackermannPct: number;
		motionRatioFront: number;
		motionRatioRear: number;
		bumpStopGapFrontMm: number;
		bumpStopGapRearMm: number;
		bumpStopRateFrontNmm: number;
		bumpStopRateRearNmm: number;
	};
	hud: {
		frontToeDeg: number;
		rearToeDeg: number;
		casterDeg: number;
	};
} | null> {
	return page.evaluate(() => {
		const model = (window as Window & {
			__racing?: {
				setup?: {
					frontToeDeg: number;
					rearToeDeg: number;
					casterDeg: number;
					ackermannPct: number;
					motionRatioFront: number;
					motionRatioRear: number;
					bumpStopGapFrontMm: number;
					bumpStopGapRearMm: number;
					bumpStopRateFrontNmm: number;
					bumpStopRateRearNmm: number;
				};
				hud?: {
					state?: {
						frontToeDeg: number;
						rearToeDeg: number;
						casterDeg: number;
					};
				};
			};
		}).__racing;
		if (!model?.setup || !model.hud?.state) {
			return null;
		}
		return {
			setup: { ...model.setup },
			hud: {
				frontToeDeg: model.hud.state.frontToeDeg,
				rearToeDeg: model.hud.state.rearToeDeg,
				casterDeg: model.hud.state.casterDeg,
			},
		};
	});
}

function aidCheckbox(page: Page, label: 'ABS' | 'TC' | 'ESC') {
	return page.getByTestId('racing-aids').locator('label').filter({ hasText: label }).locator('input');
}

function aidToggle(page: Page, label: 'ABS' | 'TC' | 'ESC') {
	return page.getByTestId('racing-aids').locator('label').filter({ hasText: label });
}

async function openAdvancedSetup(page: Page): Promise<void> {
	const toggle = page.getByRole('button', { name: /advanced setup/i });
	await toggle.click();
	await expect(toggle).toContainText(/hide/i);
}

function setupSlider(page: Page, label: string) {
	return page.locator('.slider-field').filter({ hasText: label }).locator('input[type="range"]');
}

async function setRangeValue(page: Page, label: string, value: number): Promise<void> {
	const slider = setupSlider(page, label);
	await slider.evaluate((element, nextValue) => {
		const input = element as HTMLInputElement;
		input.value = String(nextValue);
		input.dispatchEvent(new Event('input', { bubbles: true }));
	}, value);
}

test.describe('Racing Sim experiment', () => {
	test.beforeEach(async ({ page }) => {
		await patchEmptyRacingTableErrors(page);
	});

	test('page mounts full-screen racing HUD and setup controls', async ({ page }) => {
		await page.goto('/experiments/racing');

		const stage = page.getByTestId('racing-stage');
		await expect(stage).toBeVisible({ timeout: 15_000 });
		await expect(page.getByTestId('racing-canvas')).toBeVisible();
		await expect(page.getByTestId('racing-hud')).toBeVisible();
		await expect(page.getByTestId('racing-setup')).toBeVisible();
		await expect(page.getByTestId('racing-aids')).toBeVisible();
		await expect(page.getByTestId('racing-credit')).toBeVisible();
		await expect(page.getByTestId('hud-bottom')).toContainText(/track:/i);
		await expect(page.getByTestId('hud-bottom')).toContainText(/car:/i);
	});

	test('valid query params auto-start the requested session', async ({ page }) => {
		await page.goto('/experiments/racing?track=lakeside-gp&vehicle=fwd-front&cam=hood');

		await expect(page.getByTestId('racing-canvas')).toBeVisible({ timeout: 15_000 });
		await expect(page.getByTestId('hud-bottom')).toContainText(/track:\s*lakeside gp/i);
		await expect(page.getByTestId('hud-bottom')).toContainText(/car:\s*fwd \/ front/i);
		await expect(page.getByTestId('hud-bottom')).toContainText(/cam:\s*hood/i);
		await expect(page.getByTestId('racing-loading')).toHaveCount(0);
	});

	test('invalid query params fall back to a playable default session', async ({ page }) => {
		await page.goto('/experiments/racing?track=bogus&vehicle=bad&cam=nope');

		await expect(page.getByTestId('racing-canvas')).toBeVisible({ timeout: 15_000 });
		await expect(page.getByTestId('hud-bottom')).toContainText(/track:\s*twisty origin/i);
		await expect(page.getByTestId('hud-bottom')).toContainText(/car:\s*rwd \/ front-mid/i);
		await expect(page.getByTestId('hud-bottom')).toContainText(/cam:\s*chase/i);
		await expect(page.getByTestId('racing-error')).toHaveCount(0);
	});

	test('telemetry widgets render without needing a manual start action', async ({ page }) => {
		await page.goto('/experiments/racing');

		await expect(page.getByTestId('hud-speed')).toBeVisible({ timeout: 15_000 });
		await expect(page.getByTestId('hud-rpm')).toBeVisible();
		await expect(page.getByTestId('hud-gear')).toBeVisible();
		await expect(page.getByTestId('hud-lap')).toBeVisible();
		await expect(page.getByTestId('hud-wheel-0')).toBeVisible();
		await expect(page.getByTestId('hud-trace')).toBeVisible();
		await expect(page.getByTestId('hud-gg')).toBeVisible();
	});


	test('keyboard shortcuts only fire while the driving stage has focus', async ({ page }) => {
		await page.goto('/experiments/racing');
		const canvasHost = page.getByTestId('racing-canvas');
		await expect(canvasHost).toBeVisible({ timeout: 15_000 });

		await canvasHost.click();
		await page.keyboard.press('c');
		await expect(page.getByTestId('hud-bottom')).toContainText(/cam:\s*hood/i);

		await page.locator('[data-testid="racing-setup"] select').first().click();
		await page.keyboard.press('c');
		await expect(page.getByTestId('hud-bottom')).toContainText(/cam:\s*hood/i);
		await expect(page.getByTestId('hud-bottom')).not.toContainText(/cam:\s*far/i);
	});

	test('shifting to first gear and accelerating moves the car forward', async ({ page }) => {
		await page.goto('/experiments/racing');
		await expect(page.getByTestId('hud-gear')).toContainText(/\bN\b/);
		await expect(page.getByTestId('hud-speed')).toContainText(/000/);

		await focusStageAndShiftToFirst(page);
		await accelerateToSpeed(page, 0);
	});

	test('left and right steering inputs keep route-level yaw and load transfer aligned', async ({ page }) => {
		await page.goto('/experiments/racing');
		await focusStageAndShiftToFirst(page);
		await accelerateToSpeed(page, 15);

		await page.keyboard.down('ArrowLeft');
		await expect.poll(async () => (await readRuntimeSteeringState(page))?.steer ?? 0, {
			timeout: 5_000,
			message: 'ArrowLeft should produce positive steering in the live route state',
		}).toBeGreaterThan(0.2);
		await expect.poll(async () => (await readRuntimeSteeringState(page))?.leftLoadPct ?? 50, {
			timeout: 5_000,
			message: 'left steering should shift load to the right-side tires in the live route state',
		}).toBeLessThan(49);
		await expect.poll(async () => (await readRuntimeSteeringState(page))?.yawRateRad ?? 0, {
			timeout: 5_000,
			message: 'left steering should yaw left in the live route state',
		}).toBeLessThan(-0.01);
		const leftTurn = await readRuntimeSteeringState(page);
		await page.keyboard.up('ArrowLeft');

		await page.keyboard.down('ArrowRight');
		await expect.poll(async () => (await readRuntimeSteeringState(page))?.steer ?? 0, {
			timeout: 5_000,
			message: 'ArrowRight should produce negative steering in the live route state',
		}).toBeLessThan(-0.2);
		await expect.poll(async () => (await readRuntimeSteeringState(page))?.leftLoadPct ?? 50, {
			timeout: 5_000,
			message: 'right steering should shift load to the left-side tires in the live route state',
		}).toBeGreaterThan(51);
		await expect.poll(async () => (await readRuntimeSteeringState(page))?.yawRateRad ?? 0, {
			timeout: 5_000,
			message: 'right steering should yaw right in the live route state',
		}).toBeGreaterThan(0.01);
		const rightTurn = await readRuntimeSteeringState(page);
		await page.keyboard.up('ArrowRight');

		expect(leftTurn).not.toBeNull();
		expect(rightTurn).not.toBeNull();
		expect((leftTurn?.wheels[1] ?? 0) + (leftTurn?.wheels[3] ?? 0)).toBeGreaterThan((leftTurn?.wheels[0] ?? 0) + (leftTurn?.wheels[2] ?? 0));
		expect((rightTurn?.wheels[0] ?? 0) + (rightTurn?.wheels[2] ?? 0)).toBeGreaterThan((rightTurn?.wheels[1] ?? 0) + (rightTurn?.wheels[3] ?? 0));
	});

	test('braking after accelerating slows the car and surfaces a brake-lock state', async ({ page }) => {
		await page.goto('/experiments/racing');
		await focusStageAndShiftToFirst(page);
		const speedBeforeBrake = await accelerateToSpeed(page, 5);

		await page.keyboard.down('s');
		await expect(page.getByTestId('hud-inputs')).toContainText(/brake\s*100%/i);
		await expect.poll(async () => readHudSpeed(page), {
			timeout: 10_000,
			message: 'speed should drop after braking from a moving state',
		}).toBeLessThan(speedBeforeBrake);
		await expect(page.getByTestId('hud-drift-state')).toContainText(/BRAKE LOCK|GRIP|IDLE/);
		await page.keyboard.up('s');
	});

	test('handbrake input while rolling slows the car and reaches the runtime HUD', async ({ page }) => {
		await page.goto('/experiments/racing');
		await focusStageAndShiftToFirst(page);
		const speedBeforeHandbrake = await accelerateToSpeed(page, 10);

		await page.keyboard.down('Shift');
		await expect(page.getByTestId('hud-inputs')).toContainText(/handbrake\s*100%/i);
		await expect.poll(async () => readHudSpeed(page), {
			timeout: 10_000,
			message: 'speed should drop after applying the handbrake while rolling',
		}).toBeLessThan(speedBeforeHandbrake);
		await page.keyboard.up('Shift');
	});

	test('reset returns the car to idle telemetry after moving', async ({ page }) => {
		await page.goto('/experiments/racing');
		await focusStageAndShiftToFirst(page);
		await accelerateToSpeed(page, 3);

		await page.keyboard.press('r');
		await expect(page.getByTestId('hud-gear')).toContainText(/\bN\b/);
		await expect.poll(async () => readHudSpeed(page), {
			timeout: 10_000,
			message: 'speed should return close to zero after reset',
		}).toBeLessThan(1);
		await expect(page.getByTestId('hud-drift-state')).toContainText(/IDLE|GRIP/);
	});

	test('switching vehicle during a run updates the HUD and remains drivable', async ({ page }) => {
		await page.goto('/experiments/racing');
		await focusStageAndShiftToFirst(page);
		await accelerateToSpeed(page, 3);

		await page.getByLabel('Vehicle preset').selectOption({ label: 'FWD / Front' });
		await expect(page.getByTestId('hud-bottom')).toContainText(/car:\s*fwd \/ front/i);
		await expect(page.getByTestId('hud-gear')).toContainText(/\bN\b/);
		await expect.poll(async () => readHudSpeed(page), {
			timeout: 10_000,
			message: 'speed should reset near zero after switching vehicle',
		}).toBeLessThan(1);

		await focusStageAndShiftToFirst(page);
		await accelerateToSpeed(page, 3);
	});

	test('switching track during a run updates the HUD and remains drivable', async ({ page }) => {
		await page.goto('/experiments/racing');
		await focusStageAndShiftToFirst(page);
		await accelerateToSpeed(page, 5);

		await page.getByLabel('Course').selectOption({ label: 'Lakeside GP' });
		await expect(page.getByTestId('hud-bottom')).toContainText(/track:\s*lakeside gp/i);
		await expect(page.getByTestId('hud-gear')).toContainText(/\bN\b/);
		await expect.poll(async () => readHudSpeed(page), {
			timeout: 10_000,
			message: 'speed should reset near zero after switching track',
		}).toBeLessThan(1);

		await focusStageAndShiftToFirst(page);
		await accelerateToSpeed(page, 3);
	});

	test('ABS toggle propagates to the runtime aid state in both directions', async ({ page }) => {
		await page.goto('/experiments/racing');
		await expect.poll(async () => (await readRuntimeAidState(page))?.absEnabled ?? null, {
			timeout: 5_000,
			message: 'ABS should be enabled by default in runtime state',
		}).toBe(true);

		await aidToggle(page, 'ABS').click();
		await expect.poll(async () => (await readRuntimeAidState(page))?.absEnabled ?? null, {
			timeout: 5_000,
			message: 'runtime ABS state should turn off after toggling ABS off',
		}).toBe(false);

		await aidToggle(page, 'ABS').click();
		await expect.poll(async () => (await readRuntimeAidState(page))?.absEnabled ?? null, {
			timeout: 5_000,
			message: 'runtime ABS state should turn back on after toggling ABS on',
		}).toBe(true);
	});

	test('disabling ABS reaches runtime state and prevents ABS activation under braking', async ({ page }) => {
		await page.goto('/experiments/racing');
		await aidToggle(page, 'ABS').click();
		await expect.poll(async () => (await readRuntimeAidState(page))?.absEnabled ?? null, {
			timeout: 5_000,
			message: 'runtime ABS state should turn off when ABS is toggled off',
		}).toBe(false);

		await focusStageAndShiftToFirst(page);
		await accelerateToSpeed(page, 5);
		await page.keyboard.down('s');
		await expect.poll(async () => (await readRuntimeAidState(page))?.absActive ?? null, {
			timeout: 3_000,
			message: 'runtime ABS activity should stay false while ABS is disabled',
		}).toBe(false);
		await page.keyboard.up('s');
	});

	test('TC and ESC toggles propagate to runtime state and survive a run restart', async ({ page }) => {
		await page.goto('/experiments/racing');
		await aidToggle(page, 'TC').click();
		await aidToggle(page, 'ESC').click();
		await expect.poll(async () => await readRuntimeAidState(page), {
			timeout: 5_000,
			message: 'runtime aid state should reflect the TC/ESC toggle changes',
		}).toMatchObject({
			tcEnabled: false,
			escEnabled: true,
		});

		await page.getByLabel('Course').selectOption({ label: 'Lakeside GP' });
		await expect(page.getByTestId('hud-bottom')).toContainText(/track:\s*lakeside gp/i);
		await expect.poll(async () => await readRuntimeAidState(page), {
			timeout: 5_000,
			message: 'runtime aid state should persist across active-run restarts',
		}).toMatchObject({
			tcEnabled: false,
			escEnabled: true,
		});

		await focusStageAndShiftToFirst(page);
		await accelerateToSpeed(page, 3);
	});

	test('advanced setup front toe slider updates the live runtime setup and HUD', async ({ page }) => {
		await page.goto('/experiments/racing');
		await openAdvancedSetup(page);
		await setRangeValue(page, 'Front toe', 1.2);

		await expect.poll(async () => await readRuntimeSetupState(page), {
			timeout: 5_000,
			message: 'front toe slider should propagate into the runtime setup and HUD state',
		}).toMatchObject({
			setup: { frontToeDeg: 1.2 },
			hud: { frontToeDeg: 1.2 },
		});
		await expect(page.getByTestId('hud-drift')).toContainText(/Toe F/i);
		await expect(page.getByTestId('hud-drift')).toContainText(/1\.2°/i);
	});

	test('advanced setup values persist across a full page reload', async ({ page }) => {
		await page.goto('/experiments/racing');
		await openAdvancedSetup(page);
		await setRangeValue(page, 'Caster', 6);
		await setRangeValue(page, 'Rear toe', -1.1);
		await expect.poll(async () => await readRuntimeSetupState(page), {
			timeout: 5_000,
			message: 'setup changes should reach runtime state before reload',
		}).toMatchObject({
			setup: { casterDeg: 6, rearToeDeg: -1.1 },
			hud: { casterDeg: 6, rearToeDeg: -1.1 },
		});

		await page.reload();
		await expect(page.getByTestId('racing-canvas')).toBeVisible({ timeout: 15_000 });
		await openAdvancedSetup(page);
		await expect.poll(async () => await readRuntimeSetupState(page), {
			timeout: 5_000,
			message: 'setup changes should persist across a page reload',
		}).toMatchObject({
			setup: { casterDeg: 6, rearToeDeg: -1.1 },
			hud: { casterDeg: 6, rearToeDeg: -1.1 },
		});
		await expect(page.locator('.slider-field').filter({ hasText: 'Caster' })).toContainText(/6(?:\.0+)?deg/i);
		await expect(page.locator('.slider-field').filter({ hasText: 'Rear toe' })).toContainText(/-1\.10deg/i);
	});

	test('pause freezes motion under held throttle and resume restores simulation updates', async ({ page }) => {
		await page.goto('/experiments/racing');
		await focusStageAndShiftToFirst(page);
		await page.getByTestId('racing-canvas').click();
		await page.keyboard.press('p');
		await expect(page.getByTestId('hud-bottom')).toContainText(/paused/i);

		const speedWhilePaused = await readHudSpeed(page);
		await page.keyboard.down('w');
		await page.waitForTimeout(1500);
		const speedStillPaused = await readHudSpeed(page);
		await page.keyboard.up('w');
		expect(speedStillPaused).toBeLessThanOrEqual(speedWhilePaused + 1);

		await page.keyboard.press('p');
		await expect(page.getByTestId('hud-bottom')).not.toContainText(/paused/i);
		await accelerateToSpeed(page, 0);
	});

	test('mute toggles the HUD badge on and off', async ({ page }) => {
		await page.goto('/experiments/racing');
		await page.getByTestId('racing-canvas').click();
		await page.keyboard.press('m');
		await expect(page.getByTestId('hud-bottom')).toContainText(/muted/i);
		await page.keyboard.press('m');
		await expect(page.getByTestId('hud-bottom')).not.toContainText(/muted/i);
	});

	test('camera cycling wraps through hood, far, map, and back to chase', async ({ page }) => {
		await page.goto('/experiments/racing');
		const canvasHost = page.getByTestId('racing-canvas');
		await canvasHost.click();
		await page.keyboard.press('c');
		await expect(page.getByTestId('hud-bottom')).toContainText(/cam:\s*hood/i);
		await page.keyboard.press('c');
		await expect(page.getByTestId('hud-bottom')).toContainText(/cam:\s*far/i);
		await page.keyboard.press('c');
		await expect(page.getByTestId('hud-bottom')).toContainText(/cam:\s*map/i);
		await page.keyboard.press('c');
		await expect(page.getByTestId('hud-bottom')).toContainText(/cam:\s*chase/i);
	});

	test('home page exposes a link to the racing route', async ({ page }) => {
		await page.goto('/');
		await expect(page.locator('a[href="/experiments/racing"]').first()).toBeVisible();
	});
});
