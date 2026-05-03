import { Racing } from 'ui/source';
import type { Racing as DomainRacing } from 'domain/shared';
import type { RacingTransport } from '$lib/adapters/racing/RacingTransport';

const {
	Engine: { RacingEngine, RacingRenderer },
	Runtime: { createRacingHudModel },
} = Racing;

type CameraMode = Racing.CameraMode;
type VehiclePreset = DomainRacing.VehiclePreset;
type TrackPreset = DomainRacing.TrackPreset;
type SetupValues = DomainRacing.SetupValues;

const SETUP_KEY = 'racing.setup';
const LOCAL_USER_ID = 'local-user';

const DEFAULT_SETUP: SetupValues = {
	frontToeDeg: 0,
	rearToeDeg: 0,
	casterDeg: 0,
	ackermannPct: 0,
	motionRatioFront: 1,
	motionRatioRear: 1,
	bumpStopGapFrontMm: 220,
	bumpStopGapRearMm: 220,
	bumpStopRateFrontNmm: 0,
	bumpStopRateRearNmm: 0,
};

export interface RacingPageDeps {
	transport: RacingTransport;
	initialTrackId?: string;
	initialVehicleId?: string;
	initialCamera?: CameraMode;
}

interface PendingMount {
	canvas: HTMLCanvasElement;
	width: number;
	height: number;
}

export function createRacingPageModel(deps: RacingPageDeps) {
	const hud = createRacingHudModel();

	let vehicles = $state<VehiclePreset[]>([]);
	let tracks = $state<TrackPreset[]>([]);
	let isLoading = $state(false);
	let errorMessage = $state<string | null>(null);
	let runActive = $state(false);
	let paused = $state(false);
	let muted = $state(false);
	let showDebug = $state(false);
	let cameraMode = $state<CameraMode>(deps.initialCamera ?? 'chase');
	let selectedTrackId = $state<string | null>(deps.initialTrackId ?? null);
	let selectedVehicleId = $state<string | null>(deps.initialVehicleId ?? null);
	let setup = $state<SetupValues>({ ...DEFAULT_SETUP });

	let engine: InstanceType<typeof RacingEngine> | null = null;
	let renderer: InstanceType<typeof RacingRenderer> | null = null;
	let pendingMount: PendingMount | null = null;
	let rafHandle = 0;
	let lastFrameTime = 0;
	let lastSimTime = 0;
	let unsubLap: (() => void) | null = null;
	let unsubTick: (() => void) | null = null;

	function setError(message: string | null) {
		errorMessage = message;
	}

	async function bootstrap(): Promise<void> {
		if (isLoading) return;
		isLoading = true;
		setError(null);
		try {
			const [vList, tList, persisted] = await Promise.all([
				deps.transport.listVehicles(),
				deps.transport.listTracks(),
				loadSetup(),
			]);
			vehicles = vList;
			tracks = tList;
			setup = persisted ?? loadLocalSetup() ?? { ...DEFAULT_SETUP };
			if (!selectedTrackId && tList[0]) selectedTrackId = tList[0].id;
			if (!selectedVehicleId && vList[0]) selectedVehicleId = vList[0].id;
			hud.setCameraMode(cameraMode);
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			isLoading = false;
		}
	}

	async function loadSetup(): Promise<SetupValues | null> {
		try {
			return await deps.transport.getSetup(LOCAL_USER_ID);
		} catch {
			return null;
		}
	}

	function loadLocalSetup(): SetupValues | null {
		if (typeof localStorage === 'undefined') return null;
		try {
			const raw = localStorage.getItem(SETUP_KEY);
			if (!raw) return null;
			return JSON.parse(raw) as SetupValues;
		} catch {
			return null;
		}
	}

	function persistLocalSetup(values: SetupValues): void {
		if (typeof localStorage === 'undefined') return;
		try {
			localStorage.setItem(SETUP_KEY, JSON.stringify(values));
		} catch {
			/* swallow quota errors */
		}
	}

	function findVehicle(id: string): VehiclePreset | undefined {
		return vehicles.find((v) => v.id === id);
	}

	function findTrack(id: string): TrackPreset | undefined {
		return tracks.find((t) => t.id === id);
	}

	function setMountTarget(canvas: HTMLCanvasElement, width: number, height: number): void {
		pendingMount = { canvas, width, height };
		tryStart();
	}

	function tryStart(): void {
		if (!pendingMount) return;
		if (!selectedTrackId || !selectedVehicleId) return;
		const vehicle = findVehicle(selectedVehicleId);
		const track = findTrack(selectedTrackId);
		if (!vehicle || !track) return;
		startRun({ canvas: pendingMount.canvas, width: pendingMount.width, height: pendingMount.height, vehicle, track });
	}

	function startRun(args: {
		canvas: HTMLCanvasElement;
		width: number;
		height: number;
		vehicle: VehiclePreset;
		track: TrackPreset;
	}): void {
		stopRun();
		try {
			engine = new RacingEngine({ vehicle: args.vehicle, track: args.track, setup });
			renderer = new RacingRenderer({ canvas: args.canvas, width: args.width, height: args.height });
			renderer.setVehiclePreset(args.vehicle);
			renderer.buildTrack(args.track);
			engine.input.attach(globalThis as unknown as EventTarget);
			engine.setCameraMode(cameraMode);
			hud.setVehicle(args.vehicle.id, args.vehicle.label);
			hud.setTrack(args.track.id, args.track.label);
			hud.setCameraMode(cameraMode);
			unsubLap = engine.events.on('lapFinished', (event) => {
				void persistLap(event.lapMs, args.vehicle.id, args.track.id);
			});
			unsubTick = engine.events.on('tick', (event) => {
				lastSimTime = event.simTime;
			});
			runActive = true;
			paused = false;
			void recordSessionStart(args.vehicle.id, args.track.id);
			void seedBestLap(args.vehicle.id, args.track.id);
			scheduleFrame();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
			stopRun();
		}
	}

	let activeSessionId: string | null = null;

	async function recordSessionStart(vehicleId: string, trackId: string): Promise<void> {
		try {
			const session = await deps.transport.startSession({ trackId, vehicleId });
			activeSessionId = session.id;
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		}
	}

	async function seedBestLap(vehicleId: string, trackId: string): Promise<void> {
		try {
			const best = await deps.transport.getBestLap({ trackId, vehicleId });
			hud.setLap({
				bestMs: best?.lapMs ?? null,
				lastMs: hud.state.lap.lastMs,
				currentMs: hud.state.lap.currentMs,
			});
		} catch {
			/* missing table on first run is fine */
		}
	}

	async function persistLap(lapMs: number, vehicleId: string, trackId: string): Promise<void> {
		if (!activeSessionId) return;
		try {
			await deps.transport.recordLap({
				sessionId: activeSessionId,
				trackId,
				vehicleId,
				lapMs,
			});
			const best = await deps.transport.getBestLap({ trackId, vehicleId });
			hud.setLap({
				bestMs: best?.lapMs ?? null,
				lastMs: lapMs,
				currentMs: null,
			});
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		}
	}

	function scheduleFrame(): void {
		if (!runActive) return;
		rafHandle = requestAnimationFrame(onFrame);
	}

	function onFrame(now: number): void {
		if (!engine || !renderer) return;
		if (lastFrameTime === 0) lastFrameTime = now;
		const dt = Math.min(0.05, (now - lastFrameTime) / 1000);
		lastFrameTime = now;

		if (!paused) {
			engine.tick(dt);
		}

		engine.updateCamera(dt);
		renderer.setChassisPose({
			position: { x: engine.worldPos.x, y: engine.worldPos.y, z: engine.worldPos.z },
			quaternion: {
				x: engine.worldQuat.x,
				y: engine.worldQuat.y,
				z: engine.worldQuat.z,
				w: engine.worldQuat.w,
			},
		});
		const pose = engine.cameraPose();
		renderer.setCameraPose(pose.position, pose.target, pose.up);
		renderer.render();
		updateHud();
		scheduleFrame();
	}

	function updateHud(): void {
		if (!engine) return;
		const snap = engine.snapshot();
		hud.setSpeed(snap.speedKmh);
		hud.setRpm(snap.rpm);
		hud.setGear(snap.gearLabel);
		hud.setDriftState(snap.driftState);
		hud.setSideslip(snap.sideslipDeg);
		hud.setYawRate(snap.yawRateRad);
		hud.setRearLock(snap.rearLockPct);
		hud.setBalance(snap.frontLoadPct, snap.leftLoadPct);
		hud.setLap({
			bestMs: snap.lap.bestMs,
			lastMs: snap.lap.lastMs,
			currentMs: snap.lap.t0 != null ? Math.max(0, (lastSimTime - snap.lap.t0) * 1000) : null,
		});
		hud.setInput({
			throttle: engine.input.state.throttle,
			brake: engine.input.state.brake,
			steer: engine.input.state.steerSmoothed,
			handbrake: engine.input.state.handbrake,
		});
		hud.setWheels(
			snap.wheels.map((w) => ({
				index: w.index,
				fz: w.fz,
				slipRatio: w.slipRatio,
				slipAngle: w.slipAngle,
				surface: w.surface,
				tempC: w.tempC,
				brakeTempC: w.brakeTempC,
				airborne: w.fz < 1,
			})),
		);
	}

	function stopRun(): void {
		if (rafHandle) {
			cancelAnimationFrame(rafHandle);
			rafHandle = 0;
		}
		if (unsubLap) {
			unsubLap();
			unsubLap = null;
		}
		if (unsubTick) {
			unsubTick();
			unsubTick = null;
		}
		if (engine) {
			engine.dispose();
			engine = null;
		}
		if (renderer) {
			renderer.dispose();
			renderer = null;
		}
		runActive = false;
		paused = false;
		lastFrameTime = 0;
	}

	function dispose(): void {
		stopRun();
	}

	function cycleCamera(): void {
		const order: CameraMode[] = ['chase', 'hood', 'far', 'map'];
		const idx = order.indexOf(cameraMode);
		cameraMode = order[(idx + 1) % order.length];
		if (engine) engine.setCameraMode(cameraMode);
		hud.setCameraMode(cameraMode);
	}

	function setCameraMode(mode: CameraMode): void {
		cameraMode = mode;
		if (engine) engine.setCameraMode(mode);
		hud.setCameraMode(mode);
	}

	function togglePause(): void {
		paused = !paused;
		hud.setPaused(paused);
	}

	function toggleMute(): void {
		muted = !muted;
		hud.setMuted(muted);
	}

	function toggleDebug(): void {
		showDebug = !showDebug;
		hud.setShowDebug(showDebug);
	}

	function reset(): void {
		engine?.resetCar();
	}

	function shiftUp(): void {
		engine?.shiftUp();
	}

	function shiftDown(): void {
		engine?.shiftDown();
	}

	function selectTrack(id: string): void {
		selectedTrackId = id;
		if (runActive) {
			const track = findTrack(id);
			if (track && engine && renderer) {
				engine.setTrack(track);
				renderer.buildTrack(track);
				hud.setTrack(track.id, track.label);
			}
		}
	}

	function selectVehicle(id: string): void {
		selectedVehicleId = id;
		if (runActive) {
			const vehicle = findVehicle(id);
			if (vehicle && engine && renderer) {
				engine.setVehiclePreset(vehicle);
				renderer.setVehiclePreset(vehicle);
				hud.setVehicle(vehicle.id, vehicle.label);
			}
		}
	}

	function startMatch(): void {
		tryStart();
	}

	async function saveSetup(values: SetupValues): Promise<void> {
		setup = values;
		persistLocalSetup(values);
		engine?.setSetup(values);
		try {
			await deps.transport.setSetup(LOCAL_USER_ID, values);
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		}
	}

	return {
		hud,
		get vehicles() { return vehicles; },
		get tracks() { return tracks; },
		get isLoading() { return isLoading; },
		get errorMessage() { return errorMessage; },
		get runActive() { return runActive; },
		get paused() { return paused; },
		get muted() { return muted; },
		get showDebug() { return showDebug; },
		get cameraMode() { return cameraMode; },
		get selectedTrackId() { return selectedTrackId; },
		get selectedVehicleId() { return selectedVehicleId; },
		get setup() { return setup; },
		bootstrap,
		setMountTarget,
		dispose,
		cycleCamera,
		setCameraMode,
		togglePause,
		toggleMute,
		toggleDebug,
		reset,
		shiftUp,
		shiftDown,
		selectTrack,
		selectVehicle,
		startMatch,
		saveSetup,
	};
}

export type RacingPageModel = ReturnType<typeof createRacingPageModel>;
