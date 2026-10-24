import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { Racing as UiRacing } from 'ui/source';
import { createRacingPageModel } from './racing-page.svelte.ts';
import type { RacingTransport } from '$lib/adapters/racing/RacingTransport';
import type { Racing } from 'domain/shared';

type GhostCall = { pose: { position: { x: number; y: number; z: number } } | null };

/**
 * WebGL is unavailable under vitest's node environment, so the renderer is the
 * one boundary faked here: it records ghost updates so tests can assert the
 * page model's real ghost sync. The engine and recorder stay real.
 */
const rendererState = vi.hoisted(() => ({ ghostCalls: [] as GhostCall[] }));

vi.mock('ui/source', async (importOriginal) => {
	const actual = await importOriginal<typeof import('ui/source')>();
	class FakeRacingRenderer {
		buildTrack() {
			return { points: [] };
		}
		dispose() {}
		render() {}
		setCameraPose() {}
		setChassisPose() {}
		setSize() {}
		setVehiclePreset() {}
		setWheelPoses() {}
		setGhostPose(pose: GhostCall['pose']) {
			rendererState.ghostCalls.push({ pose });
		}
	}
	return {
		...actual,
		Racing: {
			...actual.Racing,
			Engine: { ...actual.Racing.Engine, RacingRenderer: FakeRacingRenderer },
		},
	};
});

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

type RafCallback = (now: number) => void;
let rafQueue: RafCallback[] = [];
let rafNow = 0;

/** Run the page model's next animation frame(s), `ms` apart. */
function runFrames(count: number, ms = 1000 / 60): void {
	for (let i = 0; i < count; i++) {
		const cb = rafQueue.shift();
		if (!cb) throw new Error('no animation frame scheduled');
		rafNow += ms;
		cb(rafNow);
	}
}

function fakeElement(): HTMLElement {
	return {
		addEventListener: () => undefined,
		removeEventListener: () => undefined,
		focus: () => undefined,
	} as unknown as HTMLElement;
}

async function mountRunningModel() {
	const model = createRacingPageModel({ transport: createTransportStub() });
	await model.bootstrap();
	model.setMountTarget(fakeElement() as unknown as HTMLCanvasElement, fakeElement(), 800, 600);
	await vi.waitFor(() => expect(model.runActive).toBe(true));
	return model;
}

type Engine = InstanceType<typeof UiRacing.Engine.RacingEngine>;

/** The recorder is attached to the live engine; reach it to drive the car. */
function liveEngine(model: Awaited<ReturnType<typeof mountRunningModel>>): Engine {
	const engine = (model.recorder as unknown as { engine: Engine | null }).engine;
	if (!engine) throw new Error('recorder not attached');
	return engine;
}

/** Teleport the car forward across the start line (centreline starts at x=0 heading +X). */
function crossStartLine(engine: Engine): void {
	const y = engine.worldPos.y;
	engine.worldPos.set(-0.5, y, 0);
	engine.velocityWS.set(0, 0, 0);
	engine.step(1 / 240);
	engine.worldPos.set(0.5, y, 0);
	engine.velocityWS.set(12, 0, 0);
	engine.step(1 / 240);
}

describe('racing page model', () => {
	beforeEach(() => {
		rendererState.ghostCalls = [];
		rafQueue = [];
		rafNow = 0;
		vi.stubGlobal('requestAnimationFrame', (cb: RafCallback) => {
			rafQueue.push(cb);
			return rafQueue.length;
		});
		vi.stubGlobal('cancelAnimationFrame', () => undefined);
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

	afterEach(() => {
		vi.unstubAllGlobals();
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

	test('ghost follows the best lap in sync, and the toggle really hides and restores it', async () => {
		const model = await mountRunningModel();
		const engine = liveEngine(model);
		expect(model.ghostEnabled).toBe(true);

		// No best lap yet: the ghost is hidden.
		runFrames(1);
		expect(rendererState.ghostCalls.at(-1)?.pose).toBeNull();

		// Start a lap, and give the recorder a 10 s best lap to chase.
		crossStartLine(engine);
		expect(model.recorder.lapElapsed()).not.toBeNull();
		const frames = Array.from({ length: 11 }, (_, i) => ({
			t: i,
			pos: { x: i * 10, y: 0, z: 0 },
			quat: { x: 0, y: 0, z: 0, w: 1 },
			wheels: [],
			speedKmh: 0,
			rpm: 0,
			gearLabel: '1',
			throttle: 0,
			brake: 0,
			steer: 0,
			handbrake: 0,
		}));
		model.recorder.bestLap = { kind: 'lap', trackId: 'classic-twist', vehicleId: 'rwd-front-mid', lapMs: 10_000, frames };

		runFrames(1);
		const shown = rendererState.ghostCalls.at(-1)?.pose;
		expect(shown).not.toBeNull();
		// The ghost sits where the best lap was at the same lap time.
		const elapsed = model.recorder.lapElapsed()!;
		expect(shown!.position.x).toBeCloseTo(elapsed * 10, 6);

		model.toggleGhost();
		expect(model.hud.state.replay.ghostEnabled).toBe(false);
		runFrames(1);
		expect(rendererState.ghostCalls.at(-1)?.pose).toBeNull();

		model.toggleGhost();
		expect(model.hud.state.replay.ghostEnabled).toBe(true);
		runFrames(1);
		expect(rendererState.ghostCalls.at(-1)?.pose).not.toBeNull();

		// Past the best lap's duration the ghost hides again.
		model.recorder.bestLap = { ...model.recorder.bestLap!, frames: frames.slice(0, 1), lapMs: 0 };
		runFrames(1);
		expect(rendererState.ghostCalls.at(-1)?.pose).toBeNull();
		model.dispose();
	});

	test('replay only starts once the running sim has recorded a trace', async () => {
		const model = await mountRunningModel();
		// Engine and renderer are live, but no frame has run: nothing recorded.
		expect(model.recorder.hasRecent).toBe(false);
		expect(model.enterReplay()).toBe(false);
		expect(model.replayMode).toBe('live');
		expect(model.hud.state.replay.available.recent).toBe(false);

		runFrames(10);
		expect(model.recorder.hasRecent).toBe(true);
		expect(model.hud.state.replay.available.recent).toBe(true);
		expect(model.enterReplay('last')).toBe(false);
		expect(model.enterReplay()).toBe(true);
		expect(model.replayMode).toBe('replay');
		expect(model.replaySource).toBe('recent');
		expect(model.hud.state.replay.mode).toBe('replay');

		model.exitReplay();
		expect(model.replayMode).toBe('live');
		expect(model.hud.state.replay.mode).toBe('live');
		model.dispose();
	});
});
