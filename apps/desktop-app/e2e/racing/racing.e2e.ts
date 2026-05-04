import { expect, test, type Page } from '@playwright/test';
import { patchEmptyRacingTableErrors } from '../helpers';

async function readHudSpeed(page: Page): Promise<number> {
	const text = await page.getByTestId('hud-speed').textContent();
	const match = text?.match(/\d+/);
	return match ? Number.parseInt(match[0], 10) : 0;
}

async function focusStageAndShiftToFirst(page: Page): Promise<void> {
	const canvasHost = page.getByTestId('racing-canvas');
	const gearHud = page.getByTestId('hud-gear');
	await expect(canvasHost).toBeVisible({ timeout: 15_000 });
	await expect(page.getByTestId('racing-loading')).toHaveCount(0, { timeout: 15_000 });
	await canvasHost.click();

	for (let attempt = 0; attempt < 8; attempt++) {
		const gearText = await gearHud.textContent();
		if (gearText?.match(/\b1\b/)) return;
		if (gearText?.match(/\bN\b/)) {
			await page.keyboard.press(']');
			continue;
		}
		if (gearText?.match(/\bR\b/)) {
			await page.keyboard.press(']');
			continue;
		}

		const gearNumber = Number.parseInt(gearText?.match(/\d+/)?.[0] ?? '', 10);
		await page.keyboard.press(Number.isFinite(gearNumber) && gearNumber > 1 ? '[' : ']');
	}

	await expect(gearHud).toContainText(/\b1\b/);
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

interface RuntimePhysicsState {
	speedKmh: number;
	input: { throttle: number; brake: number; steer: number; handbrake: number };
	leftLoadPct: number;
	frontLoadPct: number;
	rollDeg: number;
	pitchDeg: number;
	yawRateRad: number;
	sideslipDeg: number;
	accelLatG: number;
	accelLongG: number;
	tcCutPct: number;
	absActive: boolean;
	tcActive: boolean;
	escActive: boolean;
	driftState: string;
	wheels: Array<{ fz: number; slipRatio: number; slipAngle: number; surface: string | null }>;
}

async function readRuntimePhysicsState(page: Page): Promise<RuntimePhysicsState | null> {
	return page.evaluate(() => {
		const model = (window as Window & {
			__racing?: {
				hud?: {
					state?: {
						speedKmh: number;
						input: { throttle: number; brake: number; steer: number; handbrake: number };
						leftLoadPct: number;
						frontLoadPct: number;
						rollDeg: number;
						pitchDeg: number;
						yawRateRad: number;
						sideslipDeg: number;
						accelLatG: number;
						accelLongG: number;
						tcCutPct: number;
						absActive: boolean;
						tcActive: boolean;
						escActive: boolean;
						driftState: string;
						wheels: Array<{
							fz: number;
							slipRatio: number;
							slipAngle: number;
							surface: string | null;
						}>;
					};
				};
			};
		}).__racing;
		const state = model?.hud?.state;
		if (!state || state.wheels.length < 4) {
			return null;
		}
		return {
			speedKmh: state.speedKmh,
			input: { ...state.input },
			leftLoadPct: state.leftLoadPct,
			frontLoadPct: state.frontLoadPct,
			rollDeg: state.rollDeg,
			pitchDeg: state.pitchDeg,
			yawRateRad: state.yawRateRad,
			sideslipDeg: state.sideslipDeg,
			accelLatG: state.accelLatG,
			accelLongG: state.accelLongG,
			tcCutPct: state.tcCutPct,
			absActive: state.absActive,
			tcActive: state.tcActive,
			escActive: state.escActive,
			driftState: state.driftState,
			wheels: state.wheels.slice(0, 4).map((w) => ({
				fz: w.fz,
				slipRatio: w.slipRatio,
				slipAngle: w.slipAngle,
				surface: w.surface,
			})),
		};
	});
}

async function readRuntimeSteeringState(page: Page): Promise<{
	steer: number;
	leftLoadPct: number;
	yawRateRad: number;
	wheels: [number, number, number, number];
} | null> {
	const state = await readRuntimePhysicsState(page);
	if (!state) return null;
	return {
		steer: state.input.steer,
		leftLoadPct: state.leftLoadPct,
		yawRateRad: state.yawRateRad,
		wheels: [
			state.wheels[0].fz,
			state.wheels[1].fz,
			state.wheels[2].fz,
			state.wheels[3].fz,
		],
	};
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
			message: 'left steering should yaw left (negative yaw rate, SAE convention) in the live route state',
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
			message: 'right steering should yaw right (positive yaw rate, SAE convention) in the live route state',
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

test.describe('Racing Sim browser physics regressions', () => {
	test.beforeEach(async ({ page }) => {
		await patchEmptyRacingTableErrors(page);
	});

	test('left turn loads outside (right) tires, rolls toward the outside, and lat-G points outward', async ({ page }) => {
		await page.goto('/experiments/racing');
		await focusStageAndShiftToFirst(page);
		await accelerateToSpeed(page, 15);

		await page.keyboard.down('w');
		await page.keyboard.down('ArrowLeft');

		await expect.poll(async () => (await readRuntimePhysicsState(page))?.leftLoadPct ?? 50, {
			timeout: 6_000,
			message: 'left turn should transfer vertical load to the right (outside) tires',
		}).toBeLessThan(49);
		await expect.poll(async () => (await readRuntimePhysicsState(page))?.rollDeg ?? 0, {
			timeout: 6_000,
			message: 'left turn should roll the chassis toward the outside (positive roll = right side dips)',
		}).toBeGreaterThan(0.1);

		const turnState = await readRuntimePhysicsState(page);
		await page.keyboard.up('ArrowLeft');
		await page.keyboard.up('w');

		expect(turnState).not.toBeNull();
		if (!turnState) return;

		const rightAxleFz = turnState.wheels[1].fz + turnState.wheels[3].fz;
		const leftAxleFz = turnState.wheels[0].fz + turnState.wheels[2].fz;
		expect(rightAxleFz).toBeGreaterThan(leftAxleFz);
		expect(turnState.yawRateRad).toBeLessThan(-0.01);
		expect(turnState.accelLatG).toBeLessThan(0);
	});

	test('right turn mirrors lateral load, roll, yaw, and lat-G to the opposite side', async ({ page }) => {
		await page.goto('/experiments/racing');
		await focusStageAndShiftToFirst(page);
		await accelerateToSpeed(page, 15);

		await page.keyboard.down('w');
		await page.keyboard.down('ArrowRight');

		await expect.poll(async () => (await readRuntimePhysicsState(page))?.leftLoadPct ?? 50, {
			timeout: 6_000,
			message: 'right turn should transfer vertical load to the left (outside) tires',
		}).toBeGreaterThan(51);
		await expect.poll(async () => (await readRuntimePhysicsState(page))?.rollDeg ?? 0, {
			timeout: 6_000,
			message: 'right turn should roll the chassis toward the outside (negative roll = left side dips)',
		}).toBeLessThan(-0.1);

		const turnState = await readRuntimePhysicsState(page);
		await page.keyboard.up('ArrowRight');
		await page.keyboard.up('w');

		expect(turnState).not.toBeNull();
		if (!turnState) return;

		const leftAxleFz = turnState.wheels[0].fz + turnState.wheels[2].fz;
		const rightAxleFz = turnState.wheels[1].fz + turnState.wheels[3].fz;
		expect(leftAxleFz).toBeGreaterThan(rightAxleFz);
		expect(turnState.yawRateRad).toBeGreaterThan(0.01);
		expect(turnState.accelLatG).toBeGreaterThan(0);
	});

	test('hard braking from speed transfers vertical load to the front axle', async ({ page }) => {
		await page.goto('/experiments/racing');
		await focusStageAndShiftToFirst(page);
		await accelerateToSpeed(page, 25);

		const baseline = await readRuntimePhysicsState(page);
		expect(baseline).not.toBeNull();
		if (!baseline) return;
		const baselineFront = baseline.frontLoadPct;
		const baselineFrontMinusRear = (baseline.wheels[0].fz + baseline.wheels[1].fz)
			- (baseline.wheels[2].fz + baseline.wheels[3].fz);

		await page.keyboard.down('s');
		await expect.poll(async () => (await readRuntimePhysicsState(page))?.frontLoadPct ?? 50, {
			timeout: 6_000,
			message: 'hard braking should transfer vertical load forward (frontLoadPct rises above the rolling baseline)',
		}).toBeGreaterThan(baselineFront + 1);
		// Compare the front-minus-rear delta against the rolling baseline so
		// the assertion survives transient suspension bounce that drops total
		// chassis weight on the tires for a frame.
		await expect.poll(async () => {
			const live = await readRuntimePhysicsState(page);
			if (!live) return -Infinity;
			return (live.wheels[0].fz + live.wheels[1].fz)
				- (live.wheels[2].fz + live.wheels[3].fz);
		}, {
			timeout: 6_000,
			message: 'front-minus-rear axle force should grow under braking versus the rolling baseline',
		}).toBeGreaterThan(baselineFrontMinusRear + 50);

		const brakingState = await readRuntimePhysicsState(page);
		await page.keyboard.up('s');

		expect(brakingState).not.toBeNull();
		if (!brakingState) return;

		expect(brakingState.accelLongG).toBeLessThan(0);
	});

	test('first-gear throttle on a RWD car puts more drive slip on the rear axle than the front', async ({ page }) => {
		await page.goto('/experiments/racing?vehicle=rwd-front-mid');
		await focusStageAndShiftToFirst(page);

		await page.keyboard.down('w');
		await expect.poll(async () => readHudSpeed(page), {
			timeout: 10_000,
			message: 'throttle should accelerate the car off the line in first gear',
		}).toBeGreaterThan(2);

		await expect.poll(async () => {
			const state = await readRuntimePhysicsState(page);
			if (!state) return 0;
			return (state.wheels[2].slipRatio + state.wheels[3].slipRatio) * 0.5;
		}, {
			timeout: 6_000,
			message: 'driven rear tires should accumulate positive drive slip under throttle',
		}).toBeGreaterThan(0);

		const liveState = await readRuntimePhysicsState(page);
		await page.keyboard.up('w');

		expect(liveState).not.toBeNull();
		if (!liveState) return;
		const rearSlip = (liveState.wheels[2].slipRatio + liveState.wheels[3].slipRatio) * 0.5;
		const frontSlip = (liveState.wheels[0].slipRatio + liveState.wheels[1].slipRatio) * 0.5;
		expect(rearSlip).toBeGreaterThan(frontSlip);
	});

	test('ABS activates under heavy braking from speed when the aid is enabled', async ({ page }) => {
		await page.goto('/experiments/racing');
		await expect.poll(async () => (await readRuntimePhysicsState(page))?.absActive ?? null, {
			timeout: 5_000,
			message: 'ABS should not be active before braking starts',
		}).toBe(false);

		await focusStageAndShiftToFirst(page);
		await accelerateToSpeed(page, 25);

		await page.keyboard.down('s');
		await expect.poll(async () => (await readRuntimePhysicsState(page))?.absActive ?? false, {
			timeout: 6_000,
			message: 'ABS should activate while braking hard from speed with the aid enabled',
		}).toBe(true);
		await page.keyboard.up('s');
	});

	test('a developing rear slide can be caught with countersteer + lift (controllability invariant)', async ({ page }) => {
		// Use the RWD front-mid vehicle (rear-biased mass) and disable TC for
		// the duration of the test so the rear slip can actually grow — TC is
		// otherwise correctly suppressing throttle-on slides at low speed.
		// The runtime aid toggle is the only state we change; the underlying
		// physics + input model is what we are exercising.
		await page.goto('/experiments/racing?vehicle=rwd-front-mid');
		await aidToggle(page, 'TC').click();
		await expect.poll(async () => (await readRuntimeAidState(page))?.tcEnabled ?? null, {
			timeout: 5_000,
			message: 'TC should be disabled before provoking the slide',
		}).toBe(false);

		await focusStageAndShiftToFirst(page);
		await accelerateToSpeed(page, 20);

		// Provoke a slide: throttle + hard left + handbrake stab. Sample
		// sideslipDeg over the next ~3 seconds and capture the peak. Pre-fix
		// tire model (aggressive Gyk + cliff falloff) produced a snap to a
		// huge sideslip with no recovery slope; post-fix the slide is mild
		// but real and the driver is supposed to be able to bring it back.
		await page.keyboard.down('w');
		await page.keyboard.down('ArrowLeft');
		await page.keyboard.down('Shift');

		let peakSideslip = 0;
		const slideEnd = Date.now() + 3_000;
		while (Date.now() < slideEnd) {
			const state = await readRuntimePhysicsState(page);
			if (state) peakSideslip = Math.max(peakSideslip, Math.abs(state.sideslipDeg));
			await page.waitForTimeout(80);
		}
		expect(peakSideslip).toBeGreaterThan(2);

		// Lift handbrake + throttle + initial steer, then countersteer. The
		// new opposing-direction counter steer rate makes the input keep up
		// with the developing yaw, and the tire model retains enough rear
		// lateral grip while the rear is sliding for the chassis to recover.
		await page.keyboard.up('Shift');
		await page.keyboard.up('ArrowLeft');
		await page.keyboard.up('w');
		await page.keyboard.down('ArrowRight');

		// Recovery invariant: applying lift + countersteer should pull the
		// sideslip back below half of its peak (and below 1.5° absolute) —
		// i.e. the slide is being caught, not running away.
		const recoveryTarget = Math.min(peakSideslip * 0.5, 1.5);
		await expect.poll(async () => {
			const state = await readRuntimePhysicsState(page);
			return Math.abs(state?.sideslipDeg ?? 999);
		}, {
			timeout: 6_000,
			message: `countersteer + lift should pull sideslip back below ${recoveryTarget.toFixed(2)}° (peak was ${peakSideslip.toFixed(2)}°)`,
		}).toBeLessThan(recoveryTarget);

		const recoveredState = await readRuntimePhysicsState(page);
		await page.keyboard.up('ArrowRight');

		expect(recoveredState).not.toBeNull();
		if (!recoveredState) return;
		// Spin-out guard: a car that flat-spun would scrub off most of its
		// forward speed and end up nearly stationary. Recovery should leave
		// the chassis still rolling forward.
		expect(recoveredState.speedKmh).toBeGreaterThan(3);
	});

	// ----------------------------------------------------------------
	// Phase 7 — debug telemetry rendering and tuning HUD invariants.
	// These exercise the new drivetrain / aero / tire-utilization
	// debug panels that the engine now feeds via `setDrivetrain`,
	// `setAero`, and the per-wheel `tireUtilization` field.
	// ----------------------------------------------------------------

	test('debug toggle reveals drivetrain, aero, and tire-utilization telemetry panels', async ({ page }) => {
		await page.goto('/experiments/racing');
		const canvasHost = page.getByTestId('racing-canvas');
		await expect(canvasHost).toBeVisible({ timeout: 15_000 });

		await expect(page.getByTestId('hud-drivetrain')).toHaveCount(0);
		await expect(page.getByTestId('hud-aero')).toHaveCount(0);
		await expect(page.getByTestId('hud-tire-utilization')).toHaveCount(0);

		await canvasHost.click();
		await page.keyboard.press('t');

		await expect(page.getByTestId('hud-debug')).toBeVisible({ timeout: 5_000 });
		await expect(page.getByTestId('hud-drivetrain')).toBeVisible();
		await expect(page.getByTestId('hud-aero')).toBeVisible();
		await expect(page.getByTestId('hud-tire-utilization')).toBeVisible();
		await expect(page.getByTestId('hud-drivetrain')).toContainText(/clutch/i);
		await expect(page.getByTestId('hud-aero')).toContainText(/df front|df rear|drag/i);
	});

	test('drivetrain telemetry tracks engine RPM and clutch coupling under throttle', async ({ page }) => {
		await page.goto('/experiments/racing');
		await focusStageAndShiftToFirst(page);
		await accelerateToSpeed(page, 5);

		const drivetrain = await page.evaluate(() => {
			const racing = (window as Window & {
				__racing?: { hud?: { state?: {
					drivetrain?: {
						engineOmega: number;
						transmissionOmega: number;
						clutchTorqueNm: number;
						clutchMode: string;
						engineDriveTorqueNm: number;
						engineDragTorqueNm: number;
					};
				} } };
			}).__racing;
			return racing?.hud?.state?.drivetrain ?? null;
		});

		expect(drivetrain).not.toBeNull();
		if (!drivetrain) return;
		expect(Number.isFinite(drivetrain.engineOmega)).toBe(true);
		expect(Number.isFinite(drivetrain.transmissionOmega)).toBe(true);
		expect(drivetrain.engineOmega).toBeGreaterThan(0);
		expect(['locked', 'slipping']).toContain(drivetrain.clutchMode);
	});

	test('per-wheel tire-utilization stays finite while cornering', async ({ page }) => {
		await page.goto('/experiments/racing');
		await focusStageAndShiftToFirst(page);
		await accelerateToSpeed(page, 18);

		await page.keyboard.down('ArrowLeft');
		await page.waitForTimeout(800);

		const utilization = await page.evaluate(() => {
			const racing = (window as Window & {
				__racing?: { hud?: { state?: {
					wheels?: Array<{ tireUtilization: number; combinedSlip: number }>;
				} } };
			}).__racing;
			const wheels = racing?.hud?.state?.wheels ?? [];
			return wheels.map((w) => ({ u: w.tireUtilization, c: w.combinedSlip }));
		});
		await page.keyboard.up('ArrowLeft');

		expect(utilization.length).toBe(4);
		for (const sample of utilization) {
			expect(Number.isFinite(sample.u)).toBe(true);
			expect(sample.u).toBeGreaterThanOrEqual(0);
			// Combined-slip MF can briefly poke above the simple friction
			// circle (mu·Fz) ceiling because pDx1/pDy1 can be slightly above
			// 1, but it must stay well below the over-saturation cliff.
			expect(sample.u).toBeLessThan(2);
			expect(Number.isFinite(sample.c)).toBe(true);
		}
	});

	test('aero downforce telemetry stays non-negative through normal driving', async ({ page }) => {
		await page.goto('/experiments/racing');
		await focusStageAndShiftToFirst(page);
		await accelerateToSpeed(page, 15);

		const aero = await page.evaluate(() => {
			const racing = (window as Window & {
				__racing?: { hud?: { state?: { aero?: {
					frontDownforceN: number;
					rearDownforceN: number;
					dragN: number;
				} } } };
			}).__racing;
			return racing?.hud?.state?.aero ?? null;
		});

		expect(aero).not.toBeNull();
		if (!aero) return;
		expect(aero.frontDownforceN).toBeGreaterThanOrEqual(0);
		expect(aero.rearDownforceN).toBeGreaterThanOrEqual(0);
		// Drag must oppose motion; the magnitude scales with v² and so it
		// is positive whenever the chassis is moving.
		expect(aero.dragN).toBeGreaterThanOrEqual(0);
	});

	test('launch from standstill keeps speed monotonic without HUD jitter', async ({ page }) => {
		await page.goto('/experiments/racing');
		await focusStageAndShiftToFirst(page);

		await page.keyboard.down('w');
		const samples: number[] = [];
		const sampleEnd = Date.now() + 2_000;
		while (Date.now() < sampleEnd) {
			samples.push(await readHudSpeed(page));
			await page.waitForTimeout(120);
		}
		await page.keyboard.up('w');

		expect(samples.length).toBeGreaterThan(5);
		// Final speed should be measurably higher than the initial sample.
		expect(samples[samples.length - 1]).toBeGreaterThan(samples[0]);
		// HUD speed is integer km/h, so a true "speed jitter" (engine
		// solver oscillating around standstill) would show up as
		// repeated drops > 1 km/h. Allow a single small dip for clutch
		// pickup but reject a noisy launch.
		let drops = 0;
		for (let i = 1; i < samples.length; i++) {
			if (samples[i] + 1 < samples[i - 1]) drops += 1;
		}
		expect(drops).toBeLessThan(2);
	});
});
