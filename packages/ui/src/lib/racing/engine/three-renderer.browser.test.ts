import { beforeEach, describe, expect, test, vi } from 'vitest';

const loaderState = vi.hoisted(() => {
	const loadAsync = vi.fn<(url: string) => Promise<{ scene: object }>>();
	class MockGLTFLoader {
		loadAsync(url: string) {
			return loadAsync(url);
		}
	}
	return { loadAsync, MockGLTFLoader };
});

const rendererState = vi.hoisted(() => {
	class MockWebGLRenderer {
		setPixelRatio(): void {}
		setSize(): void {}
		render(): void {}
		dispose(): void {}
	}
	return { MockWebGLRenderer };
});

vi.mock('three/addons/loaders/GLTFLoader.js', () => ({
	GLTFLoader: loaderState.MockGLTFLoader,
}));

vi.mock('three', async (importOriginal) => {
	const actual = await importOriginal<typeof import('three')>();
	return {
		...actual,
		WebGLRenderer: rendererState.MockWebGLRenderer,
	};
});

import { Group, Mesh } from 'three';
import { RacingRenderer } from './three-renderer.js';
import type { TrackPreset, VehiclePreset } from '../types.js';

const TRACK_WITH_ALL_PROP_KINDS: TrackPreset = {
	id: 'renderer-test-track',
	label: 'Renderer Test Track',
	groundColor: 0x335533,
	halfWidth: 6,
	curbWidth: 0.6,
	rubberWidth: 2,
	marblesWidth: 1,
	samples: 48,
	ctrl: [
		[0, 0],
		[40, 0],
		[40, 40],
		[0, 40],
	],
	propCadence: {
		cones: 1,
		barriers: 1,
		lights: 1,
		billboards: 1,
	},
};

const EXPECTED_ASSET_URLS = [
	'/racing/extracted/cone.glb',
	'/racing/extracted/barrierWhite.glb',
	'/racing/extracted/lightPostModern.glb',
	'/racing/extracted/billboard.glb',
] as const;

const TEST_VEHICLE: VehiclePreset = {
	id: 'renderer-test-vehicle',
	label: 'Renderer Test Vehicle',
	driveLabel: 'RWD',
	layoutLabel: 'Front-mid',
	color: 0xff0000,
	wheelbase: 2.6,
	trackWidth: 1.6,
	frontMassPct: 0.52,
	finalDrive: 3.8,
	gears: [
		{ n: 'N', ratio: 0 },
		{ n: '1', ratio: 3.2 },
	],
	steerMaxDeg: 28,
	axleDrive: { front: 0, rear: 1 },
	diffType: 'clutchLSD',
};

function createDeferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (reason?: unknown) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}

async function flushAsyncWork(): Promise<void> {
	await Promise.resolve();
	await Promise.resolve();
}

describe('RacingRenderer asset loading', () => {
	beforeEach(() => {
		loaderState.loadAsync.mockReset();
	});

	test('applies wheel steer poses with positive-left visual convention', () => {
		const renderer = new RacingRenderer({
			canvas: document.createElement('canvas'),
			width: 800,
			height: 600,
		});
		renderer.setVehiclePreset(TEST_VEHICLE);

		renderer.setWheelPoses([
			{
				index: 0,
				position: { x: -0.8, y: 0, z: 1.2 },
				spinAngle: 0,
				steerAngle: 0.25,
			},
		]);

		const wheel = (renderer as unknown as { wheels: Mesh[] }).wheels[0];
		expect(wheel?.rotation.y).toBeCloseTo(-0.25, 8);

		renderer.dispose();
	});

	test('loads each prop asset once, then rebuilds scenery from the cache', async () => {
		const deferredLoads = new Map<string, ReturnType<typeof createDeferred<{ scene: Group }>>>();
		loaderState.loadAsync.mockImplementation((url: string) => {
			const deferred = createDeferred<{ scene: Group }>();
			deferredLoads.set(url, deferred);
			return deferred.promise;
		});

		const renderer = new RacingRenderer({
			canvas: document.createElement('canvas'),
			width: 800,
			height: 600,
		});

		renderer.buildTrack(TRACK_WITH_ALL_PROP_KINDS);

		expect(loaderState.loadAsync).toHaveBeenCalledTimes(EXPECTED_ASSET_URLS.length);
		expect(loaderState.loadAsync.mock.calls.map(([url]) => url).sort()).toEqual(
			[...EXPECTED_ASSET_URLS].sort(),
		);

		const initialPropsRoot = (renderer as unknown as { propsRoot: Group | null }).propsRoot;
		expect(initialPropsRoot).not.toBeNull();
		expect(initialPropsRoot?.children.length).toBeGreaterThan(0);
		expect(initialPropsRoot?.children.every((child) => child instanceof Mesh)).toBe(true);

		for (const url of EXPECTED_ASSET_URLS) {
			const scene = new Group();
			scene.name = url.split('/').pop()?.replace('.glb', '') ?? 'asset';
			deferredLoads.get(url)?.resolve({ scene });
		}
		await Promise.all([...deferredLoads.values()].map((deferred) => deferred.promise));
		await flushAsyncWork();

		const rebuiltPropsRoot = (renderer as unknown as { propsRoot: Group | null }).propsRoot;
		expect(rebuiltPropsRoot).not.toBe(initialPropsRoot);
		expect(rebuiltPropsRoot?.children.length).toBe(initialPropsRoot?.children.length ?? 0);
		expect(rebuiltPropsRoot?.children.every((child) => child instanceof Group)).toBe(true);

		renderer.buildTrack(TRACK_WITH_ALL_PROP_KINDS);
		expect(loaderState.loadAsync).toHaveBeenCalledTimes(EXPECTED_ASSET_URLS.length);

		renderer.dispose();
	});

	test('caches failed asset loads and keeps using primitive fallbacks without retrying', async () => {
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		loaderState.loadAsync.mockRejectedValue(new Error('asset missing'));

		const renderer = new RacingRenderer({
			canvas: document.createElement('canvas'),
			width: 800,
			height: 600,
		});

		renderer.buildTrack(TRACK_WITH_ALL_PROP_KINDS);
		await flushAsyncWork();

		expect(loaderState.loadAsync).toHaveBeenCalledTimes(EXPECTED_ASSET_URLS.length);
		expect(warnSpy).toHaveBeenCalledTimes(EXPECTED_ASSET_URLS.length);

		const firstPropsRoot = (renderer as unknown as { propsRoot: Group | null }).propsRoot;
		expect(firstPropsRoot).not.toBeNull();
		expect(firstPropsRoot?.children.every((child) => child instanceof Mesh)).toBe(true);

		renderer.buildTrack(TRACK_WITH_ALL_PROP_KINDS);
		await flushAsyncWork();

		expect(loaderState.loadAsync).toHaveBeenCalledTimes(EXPECTED_ASSET_URLS.length);
		const secondPropsRoot = (renderer as unknown as { propsRoot: Group | null }).propsRoot;
		expect(secondPropsRoot).not.toBeNull();
		expect(secondPropsRoot?.children.every((child) => child instanceof Mesh)).toBe(true);

		warnSpy.mockRestore();
		renderer.dispose();
	});
});
