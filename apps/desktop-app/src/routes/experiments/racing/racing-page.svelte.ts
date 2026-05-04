import { Racing as DomainRacing } from 'domain/shared';
import { Racing } from 'ui/source';
import type { RacingTransport } from '$lib/adapters/racing/RacingTransport';

const {
	Engine: { RacingEngine, RacingRenderer },
	Runtime: { createRacingHudModel },
} = Racing;

type CameraMode = Racing.CameraMode;
type VehiclePreset = DomainRacing.VehiclePreset;
type TrackPreset = DomainRacing.TrackPreset;
type SetupValues = DomainRacing.SetupValues;
const { clampSetup, defaultSetup } = DomainRacing;
type SetupField = keyof SetupValues;

const SETUP_KEY = 'racing.setup';
const LEGACY_SETUP_KEY = 'aml_racing_setup';
const LOCAL_USER_ID = 'local-user';

export interface RacingPageDeps {
	transport: RacingTransport;
	initialTrackId?: string;
	initialVehicleId?: string;
	initialCamera?: CameraMode;
}

interface PendingMount {
	canvas: HTMLCanvasElement;
	focusTarget: HTMLElement;
	width: number;
	height: number;
}

function normalizeSelection<T extends { id: string }>(
	requestedId: string | null,
	items: readonly T[],
): string | null {
	if (items.length === 0) return null;
	if (requestedId && items.some((item) => item.id === requestedId)) return requestedId;
	return items[0]?.id ?? null;
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
	let absEnabled = $state(true);
	let tcEnabled = $state(true);
	let escEnabled = $state(false);
	let cameraMode = $state<CameraMode>(deps.initialCamera ?? 'chase');
	let selectedTrackId = $state<string | null>(deps.initialTrackId ?? null);
	let selectedVehicleId = $state<string | null>(deps.initialVehicleId ?? null);
	let setup = $state<SetupValues>(defaultSetup());

	let engine: InstanceType<typeof RacingEngine> | null = null;
	let renderer: InstanceType<typeof RacingRenderer> | null = null;
	let pendingMount: PendingMount | null = null;
	let rafHandle = 0;
	let lastFrameTime = 0;
	let lastSimTime = 0;
	let unsubLap: (() => void) | null = null;
	let unsubTick: (() => void) | null = null;
	let activeSessionId: string | null = null;
	let activeTrackId: string | null = null;
	let activeVehicleId: string | null = null;
	let activeRunToken = 0;
	let autoStartRequested = true;

	function setError(message: string | null) {
		errorMessage = message;
	}

	function syncHudSelection(): void {
		const selectedTrack = selectedTrackId ? findTrack(selectedTrackId) : undefined;
		const selectedVehicle = selectedVehicleId ? findVehicle(selectedVehicleId) : undefined;
		hud.setTrack(selectedTrack?.id ?? '', selectedTrack?.label ?? '');
		hud.setVehicle(selectedVehicle?.id ?? '', selectedVehicle?.label ?? '');
		hud.setCameraMode(cameraMode);
		hud.setPaused(paused);
		hud.setMuted(muted);
		hud.setShowDebug(showDebug);
		hud.setHandlingMetrics({
			rearSlipRatio: hud.state.rearSlipRatio,
			frontSlipDeg: hud.state.frontSlipDeg,
			rearSlipDeg: hud.state.rearSlipDeg,
			ackermannDeltaDeg: hud.state.ackermannDeltaDeg,
			frontToeDeg: setup.frontToeDeg,
			rearToeDeg: setup.rearToeDeg,
			casterDeg: setup.casterDeg,
			accelLongG: hud.state.accelLongG,
			accelLatG: hud.state.accelLatG,
		});
		hud.setAidState({
			absEnabled,
			tcEnabled,
			escEnabled,
			absActive: false,
			tcActive: false,
			escActive: false,
			tcCutPct: 0,
		});
	}

	async function bootstrap(): Promise<void> {
		if (isLoading) return;
		isLoading = true;
		setError(null);
		try {
			const [vList, tList] = await Promise.all([
				deps.transport.listVehicles(),
				deps.transport.listTracks(),
			]);
			vehicles = vList;
			tracks = tList;
			setup = clampSetup(loadLocalSetup() ?? defaultSetup());
			persistLocalSetup(setup);
			selectedTrackId = normalizeSelection(selectedTrackId, tList);
			selectedVehicleId = normalizeSelection(selectedVehicleId, vList);
			syncHudSelection();
			tryStart();
			void loadSetup()
				.then((persisted) => {
					if (!persisted) return;
					setup = clampSetup(persisted);
					persistLocalSetup(setup);
					engine?.setSetup(setup);
					syncHudSelection();
				})
				.catch(() => {
					/* local-first bootstrap tolerates missing setup persistence */
				});
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

	function readSetupFromStorage(key: string): SetupValues | null {
		if (typeof localStorage === 'undefined') return null;
		try {
			const raw = localStorage.getItem(key);
			if (!raw) return null;
			return clampSetup(JSON.parse(raw) as Partial<SetupValues>);
		} catch {
			return null;
		}
	}

	function loadLocalSetup(): SetupValues | null {
		const current = readSetupFromStorage(SETUP_KEY);
		if (current) return current;
		const legacy = readSetupFromStorage(LEGACY_SETUP_KEY);
		if (legacy) {
			persistLocalSetup(legacy);
		}
		return legacy;
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

	function setMountTarget(
		canvas: HTMLCanvasElement,
		focusTarget: HTMLElement,
		width: number,
		height: number,
	): void {
		pendingMount = { canvas, focusTarget, width, height };
		if (renderer) {
			renderer.setSize(width, height);
		}
		tryStart();
	}

	function tryStart(options: { force?: boolean } = {}): void {
		if (!pendingMount) return;
		if (!selectedTrackId || !selectedVehicleId) return;
		if (!options.force && !autoStartRequested) return;
		const vehicle = findVehicle(selectedVehicleId);
		const track = findTrack(selectedTrackId);
		if (!vehicle || !track) return;
		autoStartRequested = false;
		startRun({
			canvas: pendingMount.canvas,
			focusTarget: pendingMount.focusTarget,
			width: pendingMount.width,
			height: pendingMount.height,
			vehicle,
			track,
		});
	}

	function startRun(args: {
		canvas: HTMLCanvasElement;
		focusTarget: HTMLElement;
		width: number;
		height: number;
		vehicle: VehiclePreset;
		track: TrackPreset;
	}): void {
		stopRun({ invalidate: false });
		const runToken = ++activeRunToken;
		activeSessionId = null;
		activeTrackId = args.track.id;
		activeVehicleId = args.vehicle.id;
		setError(null);
		try {
			engine = new RacingEngine({ vehicle: args.vehicle, track: args.track, setup });
			engine.resetCar();
			engine.setAbsEnabled(absEnabled);
			engine.setTcEnabled(tcEnabled);
			engine.setEscEnabled(escEnabled);
			renderer = new RacingRenderer({ canvas: args.canvas, width: args.width, height: args.height });
			renderer.setVehiclePreset(args.vehicle);
			renderer.buildTrack(args.track);
			engine.input.attach(args.focusTarget);
			engine.setCameraMode(cameraMode);
			hud.setVehicle(args.vehicle.id, args.vehicle.label);
			hud.setTrack(args.track.id, args.track.label);
			hud.setCameraMode(cameraMode);
			hud.setPaused(false);
			hud.setMuted(muted);
			hud.setShowDebug(showDebug);
			unsubLap = engine.events.on('lapFinished', (event) => {
				void persistLap(event.lapMs, runToken);
			});
			unsubTick = engine.events.on('tick', (event) => {
				lastSimTime = event.simTime;
			});
			runActive = true;
			paused = false;
			void recordSessionStart(runToken, args.vehicle.id, args.track.id);
			void seedBestLap(runToken, args.vehicle.id, args.track.id);
			scheduleFrame();
			args.focusTarget.focus();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
			stopRun();
		}
	}

	async function recordSessionStart(
		runToken: number,
		vehicleId: string,
		trackId: string,
	): Promise<void> {
		try {
			const session = await deps.transport.startSession({ trackId, vehicleId });
			if (runToken !== activeRunToken) return;
			activeSessionId = session.id;
		} catch (err) {
			if (runToken !== activeRunToken) return;
			setError(err instanceof Error ? err.message : String(err));
		}
	}

	async function seedBestLap(
		runToken: number,
		vehicleId: string,
		trackId: string,
	): Promise<void> {
		try {
			const best = await deps.transport.getBestLap({ trackId, vehicleId });
			if (runToken !== activeRunToken) return;
			hud.setLap({
				bestMs: best?.lapMs ?? null,
				lastMs: hud.state.lap.lastMs,
				currentMs: hud.state.lap.currentMs,
			});
		} catch {
			/* missing table on first run is fine */
		}
	}

	async function persistLap(lapMs: number, runToken: number): Promise<void> {
		if (runToken !== activeRunToken) return;
		if (!activeSessionId || !activeTrackId || !activeVehicleId) return;
		try {
			await deps.transport.recordLap({
				sessionId: activeSessionId,
				trackId: activeTrackId,
				vehicleId: activeVehicleId,
				lapMs,
			});
			const best = await deps.transport.getBestLap({
				trackId: activeTrackId,
				vehicleId: activeVehicleId,
			});
			if (runToken !== activeRunToken) return;
			hud.setLap({
				bestMs: best?.lapMs ?? null,
				lastMs: lapMs,
				currentMs: null,
			});
		} catch (err) {
			if (runToken !== activeRunToken) return;
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

		hud.setFps(dt > 0 ? 1 / dt : 0);
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
		hud.setOrientation(snap.rollDeg, snap.pitchDeg);
		hud.setBalance(snap.frontLoadPct, snap.leftLoadPct);
		hud.setHandlingMetrics({
			rearSlipRatio: snap.rearSlipRatio,
			frontSlipDeg: snap.frontSlipDeg,
			rearSlipDeg: snap.rearSlipDeg,
			ackermannDeltaDeg: snap.ackermannDeltaDeg,
			frontToeDeg: snap.frontToeDeg,
			rearToeDeg: snap.rearToeDeg,
			casterDeg: snap.casterDeg,
			accelLongG: snap.accelLongG,
			accelLatG: snap.accelLatG,
		});
		hud.setAidState({
			absEnabled: snap.aids.absEnabled,
			tcEnabled: snap.aids.tcEnabled,
			escEnabled: snap.aids.escEnabled,
			absActive: snap.aids.absActive,
			tcActive: snap.aids.tcActive,
			escActive: snap.aids.escActive,
			tcCutPct: snap.aids.tcCut * 100,
		});
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
				bumpStopPct: w.bumpStopPct,
				airborne: w.fz < 1,
			})),
		);
		hud.pushTelemetry(
			{
				fl: hud.state.telemetryMode === 'load' ? snap.wheels[0]?.fz ?? 0 : snap.wheels[0]?.slipRatio ?? 0,
				fr: hud.state.telemetryMode === 'load' ? snap.wheels[1]?.fz ?? 0 : snap.wheels[1]?.slipRatio ?? 0,
				rl: hud.state.telemetryMode === 'load' ? snap.wheels[2]?.fz ?? 0 : snap.wheels[2]?.slipRatio ?? 0,
				rr: hud.state.telemetryMode === 'load' ? snap.wheels[3]?.fz ?? 0 : snap.wheels[3]?.slipRatio ?? 0,
			},
			{ latG: snap.accelLatG, longG: snap.accelLongG },
		);
	}

	function stopRun(options: { invalidate?: boolean } = {}): void {
		if (options.invalidate ?? true) {
			activeRunToken += 1;
		}
		activeSessionId = null;
		activeTrackId = null;
		activeVehicleId = null;
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
		lastSimTime = 0;
		hud.setPaused(false);
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

	function toggleAbs(): void {
		absEnabled = !absEnabled;
		engine?.setAbsEnabled(absEnabled);
		hud.setAidState({
			absEnabled,
			tcEnabled,
			escEnabled,
			absActive: hud.state.absActive,
			tcActive: hud.state.tcActive,
			escActive: hud.state.escActive,
			tcCutPct: hud.state.tcCutPct,
		});
	}

	function toggleTc(): void {
		tcEnabled = !tcEnabled;
		engine?.setTcEnabled(tcEnabled);
		hud.setAidState({
			absEnabled,
			tcEnabled,
			escEnabled,
			absActive: hud.state.absActive,
			tcActive: hud.state.tcActive,
			escActive: hud.state.escActive,
			tcCutPct: hud.state.tcCutPct,
		});
	}

	function toggleEsc(): void {
		escEnabled = !escEnabled;
		engine?.setEscEnabled(escEnabled);
		hud.setAidState({
			absEnabled,
			tcEnabled,
			escEnabled,
			absActive: hud.state.absActive,
			tcActive: hud.state.tcActive,
			escActive: hud.state.escActive,
			tcCutPct: hud.state.tcCutPct,
		});
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
		selectedTrackId = normalizeSelection(id, tracks);
		syncHudSelection();
		if (runActive) {
			tryStart({ force: true });
		}
	}

	function selectVehicle(id: string): void {
		selectedVehicleId = normalizeSelection(id, vehicles);
		syncHudSelection();
		if (runActive) {
			tryStart({ force: true });
		}
	}

	function startMatch(): void {
		tryStart({ force: true });
	}

	async function saveSetup(values: SetupValues): Promise<void> {
		const normalized = clampSetup(values);
		setup = normalized;
		persistLocalSetup(normalized);
		engine?.setSetup(normalized);
		try {
			await deps.transport.setSetup(LOCAL_USER_ID, normalized);
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		}
	}

	function updateSetupField(field: SetupField, value: number): void {
		void saveSetup({
			...setup,
			[field]: value,
		});
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
		get absEnabled() { return absEnabled; },
		get tcEnabled() { return tcEnabled; },
		get escEnabled() { return escEnabled; },
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
		toggleAbs,
		toggleTc,
		toggleEsc,
		reset,
		shiftUp,
		shiftDown,
		selectTrack,
		selectVehicle,
		startMatch,
		saveSetup,
		updateSetupField,
	};
}

export type RacingPageModel = ReturnType<typeof createRacingPageModel>;
