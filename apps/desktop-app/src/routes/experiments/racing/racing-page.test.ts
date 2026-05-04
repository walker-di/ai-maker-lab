import { beforeEach, describe, expect, test, vi } from 'vitest';
import { createRacingPageModel } from './racing-page.svelte.ts';
import type { RacingTransport } from '$lib/adapters/racing/RacingTransport';
import type { Racing } from 'domain/shared';

function makeVehicle(id: string, label: string): Racing.VehiclePreset {
	return {
		id,
		label,
		driveLabel: 'RWD',
		layoutLabel: 'Front-mid',
		color: 0xff0000,
		wheelbase: 2.6,
		trackWidth: 1.6,
		frontMassPct: 0.52,
		finalDrive: 3.8,
		gears: [
			{ n: 'R', ratio: -3.1 },
			{ n: 'N', ratio: 0 },
			{ n: '1', ratio: 3.2 },
		],
		steerMaxDeg: 28,
		axleDrive: { front: 0, rear: 1 },
		diffType: 'clutchLSD',
	};
}

function makeTrack(id: string, label: string): Racing.TrackPreset {
	return {
		id,
		label,
		groundColor: 0x335533,
		halfWidth: 7,
		curbWidth: 0.8,
		rubberWidth: 2,
		marblesWidth: 1,
		samples: 64,
		ctrl: [
			[0, 0],
			[40, 0],
			[40, 40],
			[0, 40],
		],
	};
}

class MemoryStorage {
	private readonly data = new Map<string, string>();

	clear(): void {
		this.data.clear();
	}

	getItem(key: string): string | null {
		return this.data.get(key) ?? null;
	}

	key(index: number): string | null {
		return Array.from(this.data.keys())[index] ?? null;
	}

	removeItem(key: string): void {
		this.data.delete(key);
	}

	setItem(key: string, value: string): void {
		this.data.set(key, value);
	}

	get length(): number {
		return this.data.size;
	}
}

function createTransportStub(): RacingTransport {
	return {
		listVehicles: vi.fn(async () => [makeVehicle('rwd-front-mid', 'RWD / Front-mid')]),
		listTracks: vi.fn(async () => [makeTrack('classic-twist', 'Classic Twist')]),
		startSession: vi.fn(async () => ({
			id: 'session-1',
			trackId: 'classic-twist',
			vehicleId: 'rwd-front-mid',
			startedAt: '2026-05-04T00:00:00.000Z',
		})),
		recordLap: vi.fn(async () => ({
			id: 'lap-1',
			sessionId: 'session-1',
			trackId: 'classic-twist',
			vehicleId: 'rwd-front-mid',
			lapMs: 91234,
			sectors: [],
			finishedAt: '2026-05-04T00:01:31.234Z',
		})),
		getBestLap: vi.fn(async () => null),
		getSetup: vi.fn(async () => null),
		setSetup: vi.fn(async () => undefined),
	};
}

describe('racing page model', () => {
	beforeEach(() => {
		Object.defineProperty(globalThis, 'localStorage', {
			value: new MemoryStorage(),
			configurable: true,
		});
	});

	test('bootstrap normalizes invalid query ids and migrates legacy setup storage', async () => {
		const transport = createTransportStub();
		globalThis.localStorage.setItem(
			'aml_racing_setup',
			JSON.stringify({ frontToeDeg: 9, casterDeg: 5, motionRatioFront: 0.9 }),
		);

		const model = createRacingPageModel({
			transport,
			initialTrackId: 'bogus-track',
			initialVehicleId: 'bogus-car',
		});

		await model.bootstrap();

		expect(model.selectedTrackId).toBe('classic-twist');
		expect(model.selectedVehicleId).toBe('rwd-front-mid');
		expect(model.hud.state.trackId).toBe('classic-twist');
		expect(model.hud.state.vehicleId).toBe('rwd-front-mid');
		expect(model.setup.frontToeDeg).toBe(2);
		expect(model.setup.casterDeg).toBe(5);
		expect(model.setup.motionRatioFront).toBe(0.9);
		expect(JSON.parse(globalThis.localStorage.getItem('racing.setup') ?? '{}')).toMatchObject({
			frontToeDeg: 2,
			casterDeg: 5,
			motionRatioFront: 0.9,
		});
	});

	test('saveSetup clamps values before persisting locally and remotely', async () => {
		const transport = createTransportStub();
		const model = createRacingPageModel({ transport });

		await model.bootstrap();
		await model.saveSetup({
			...model.setup,
			frontToeDeg: 99,
			motionRatioRear: -10,
			bumpStopRateFrontNmm: 9999,
		});

		expect(model.setup.frontToeDeg).toBe(2);
		expect(model.setup.motionRatioRear).toBe(0.4);
		expect(model.setup.bumpStopRateFrontNmm).toBe(600);
		expect(transport.setSetup).toHaveBeenCalledWith(
			'local-user',
			expect.objectContaining({
				frontToeDeg: 2,
				motionRatioRear: 0.4,
				bumpStopRateFrontNmm: 600,
			}),
		);
		expect(JSON.parse(globalThis.localStorage.getItem('racing.setup') ?? '{}')).toMatchObject({
			frontToeDeg: 2,
			motionRatioRear: 0.4,
			bumpStopRateFrontNmm: 600,
		});
	});

	test('aid toggles update the exposed page state and HUD state', async () => {
		const transport = createTransportStub();
		const model = createRacingPageModel({ transport });

		await model.bootstrap();
		model.toggleAbs();
		model.toggleTc();
		model.toggleEsc();

		expect(model.absEnabled).toBe(false);
		expect(model.tcEnabled).toBe(false);
		expect(model.escEnabled).toBe(true);
		expect(model.hud.state.absEnabled).toBe(false);
		expect(model.hud.state.tcEnabled).toBe(false);
		expect(model.hud.state.escEnabled).toBe(true);
	});
});
