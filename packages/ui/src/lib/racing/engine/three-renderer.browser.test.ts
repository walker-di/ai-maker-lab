import { beforeEach, describe, expect, test, vi } from 'vitest';
import * as actualThree from 'three';

const loadAsync = vi.fn<(url: string) => Promise<{ scene: object }>>();
class MockGLTFLoader {
	loadAsync(url: string) {
		return loadAsync(url) ?? Promise.resolve({ scene: new Group() });
	}
}

class MockWebGLRenderer {
	shadowMap = { enabled: false, type: 0 };
	setPixelRatio(): void {}
	setSize(): void {}
	render(): void {}
	dispose(): void {}
}

vi.mock('three/addons/loaders/GLTFLoader.js', () => ({
	GLTFLoader: MockGLTFLoader,
}));

vi.mock('three', () => ({
	...actualThree,
	WebGLRenderer: MockWebGLRenderer,
}));

import { Group, Mesh } from 'three';
import { RacingRenderer } from './three-renderer.js';
import type { TrackPreset, VehiclePreset } from '../types.js';

// Bun's test runner has no DOM; provide the minimal surface this file needs.
if (typeof document === 'undefined') {
	const canvas = {
		getContext: () => ({}),
		toDataURL: () => '',
		width: 0,
		height: 0,
		addEventListener: () => {},
		removeEventListener: () => {},
	};
	(globalThis as unknown as { document: { createElement(tag: string): unknown } }).document = {
		createElement: (tag: string) => (tag === 'canvas' ? canvas : {}),
	};
}

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
		flags: 1,
		fences: 1,
		grandStands: 1,
		pitBuildings: 1,
		pylons: 1,
		banners: 1,
		radars: 1,
		overheads: 1,
	},
};

const EXPECTED_ASSET_URLS = [
	'/racing/extracted/cone.glb',
	'/racing/extracted/barrierWhite.glb',
	'/racing/extracted/lightPostModern.glb',
	'/racing/extracted/billboard.glb',
	'/racing/extracted/flagCheckers.glb',
	'/racing/extracted/fenceStraight.glb',
	'/racing/extracted/grandStand.glb',
	'/racing/extracted/pitsOffice.glb',
	'/racing/extracted/pylon.glb',
	'/racing/extracted/bannerTowerGreen.glb',
	'/racing/extracted/radarEquipment.glb',
	'/racing/extracted/overhead.glb',
] as const;

const VEHICLE_ASSET_URL = '/racing/extracted/race-future.glb';
const ALL_EXPECTED_URLS = [...EXPECTED_ASSET_URLS, VEHICLE_ASSET_URL];

const TEST_VEHICLE: VehiclePreset = {
	id: 'renderer-test-vehicle',
	label: 'Renderer Test Vehicle',
	driveLabel: 'RWD',
	layoutLabel: 'Front-mid',
	color: 0xff0000,
	wheelbase: 2.6,
	trackWidth: 1.6,
	frontMassPct: 0.52,
	dimensions: {
		overallLengthM: 4.7,
		overallWidthM: 2.0,
		overallHeightM: 1.25,
		frontTrackWidthM: 1.62,
		rearTrackWidthM: 1.58,
	},
	tires: {
		frontSectionWidthM: 0.30,
		rearSectionWidthM: 0.31,
		frontOverallDiameterM: 0.68,
		rearOverallDiameterM: 0.71,
	},
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
		loadAsync.mockReset();
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

	test('uses authored body and tyre dimensions for fallback geometry', () => {
		loadAsync.mockRejectedValue(new Error('asset missing'));
		const renderer = new RacingRenderer({
			canvas: document.createElement('canvas'),
			width: 800,
			height: 600,
		});
		renderer.setVehiclePreset(TEST_VEHICLE);

		const chassisChildren = (renderer as unknown as { chassis: Group }).chassis.children;
		const body = chassisChildren[0] as Mesh;
		const frontLeft = (renderer as unknown as { wheels: Mesh[] }).wheels[0];
		const rearLeft = (renderer as unknown as { wheels: Mesh[] }).wheels[2];

		expect(frontLeft.position.x).toBeCloseTo(-0.81, 8);
		expect(rearLeft.position.x).toBeCloseTo(-0.79, 8);
		expect((frontLeft.geometry as actualThree.CylinderGeometry).parameters.radiusTop).toBeCloseTo(0.34, 8);
		expect((rearLeft.geometry as actualThree.CylinderGeometry).parameters.radiusTop).toBeCloseTo(0.355, 8);
		expect((body.geometry as actualThree.BoxGeometry).parameters.width).toBeCloseTo(2.0, 8);
		expect((body.geometry as actualThree.BoxGeometry).parameters.depth).toBeCloseTo(4.7, 8);

		renderer.dispose();
	});

	test('loads each prop asset once, then rebuilds scenery from the cache', async () => {
		const deferredLoads = new Map<string, ReturnType<typeof createDeferred<{ scene: Group }>>>();
		loadAsync.mockImplementation((url: string) => {
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

		expect(loadAsync).toHaveBeenCalledTimes(ALL_EXPECTED_URLS.length);
		expect(loadAsync.mock.calls.map(([url]) => url).sort()).toEqual(
			[...ALL_EXPECTED_URLS].sort(),
		);

		const initialPropsRoot = (renderer as unknown as { propsRoot: Group | null }).propsRoot;
		expect(initialPropsRoot).not.toBeNull();
		expect(initialPropsRoot?.children.length).toBeGreaterThan(0);
		expect(initialPropsRoot?.children.every((child) => child instanceof Mesh)).toBe(true);

		for (const url of ALL_EXPECTED_URLS) {
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
		expect(loadAsync).toHaveBeenCalledTimes(ALL_EXPECTED_URLS.length);

		renderer.dispose();
	});

	test('reuses authored wheel meshes from the GLB instead of adding duplicate primitive tires', async () => {
		const deferred = createDeferred<{ scene: Group }>();
		loadAsync.mockImplementation((url: string) => {
			if (url === VEHICLE_ASSET_URL) return deferred.promise;
			return Promise.resolve({ scene: new Group() });
		});

		const renderer = new RacingRenderer({
			canvas: document.createElement('canvas'),
			width: 800,
			height: 600,
		});
		renderer.setVehiclePreset(TEST_VEHICLE);

		const assetScene = new Group();
		for (const name of ['body', 'wheel-front-left', 'wheel-front-right', 'wheel-back-left', 'wheel-back-right']) {
			const mesh = new Mesh(new actualThree.BoxGeometry(1, 1, 1), new actualThree.MeshBasicMaterial());
			mesh.name = name;
			assetScene.add(mesh);
		}
		deferred.resolve({ scene: assetScene });
		await deferred.promise;
		await flushAsyncWork();

		const wheels = (renderer as unknown as { wheels: Mesh[] }).wheels;
		expect(wheels).toHaveLength(4);
		expect(renderer.chassis.children).toHaveLength(5);
		expect(wheels.every((wheel) => wheel.geometry instanceof actualThree.BoxGeometry)).toBe(true);

		renderer.dispose();
	});

	test('caches failed asset loads and keeps using primitive fallbacks without retrying', async () => {
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		loadAsync.mockRejectedValue(new Error('asset missing'));

		const renderer = new RacingRenderer({
			canvas: document.createElement('canvas'),
			width: 800,
			height: 600,
		});

		renderer.buildTrack(TRACK_WITH_ALL_PROP_KINDS);
		await flushAsyncWork();

		expect(loadAsync).toHaveBeenCalledTimes(ALL_EXPECTED_URLS.length);
		expect(warnSpy).toHaveBeenCalledTimes(ALL_EXPECTED_URLS.length);

		const firstPropsRoot = (renderer as unknown as { propsRoot: Group | null }).propsRoot;
		expect(firstPropsRoot).not.toBeNull();
		expect(firstPropsRoot?.children.every((child) => child instanceof Mesh)).toBe(true);

		renderer.buildTrack(TRACK_WITH_ALL_PROP_KINDS);
		await flushAsyncWork();

		expect(loadAsync).toHaveBeenCalledTimes(ALL_EXPECTED_URLS.length);
		const secondPropsRoot = (renderer as unknown as { propsRoot: Group | null }).propsRoot;
		expect(secondPropsRoot).not.toBeNull();
		expect(secondPropsRoot?.children.every((child) => child instanceof Mesh)).toBe(true);

		warnSpy.mockRestore();
		renderer.dispose();
	});
});
