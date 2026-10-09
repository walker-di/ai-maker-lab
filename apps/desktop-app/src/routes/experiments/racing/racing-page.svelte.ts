import { Racing as DomainRacing } from 'domain/shared';
import { Racing } from 'ui/source';
import type { RacingTransport } from '$lib/adapters/racing/RacingTransport';

const {
	Engine: { RacingEngine, RacingRenderer, ReplayRecorder, ReplayPlayer, CameraRig, sampleTrace, stepReplayCamera },
	Runtime: { createRacingHudModel },
} = Racing;

type CameraMode = Racing.CameraMode;
type ReplayFrame = Racing.Engine.ReplayFrame;
type ReplayTrace = Racing.Engine.ReplayTrace;
type ReplaySpeed = Racing.Engine.ReplaySpeed;
export type ReplaySource = 'last' | 'best' | 'recent';
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
	let firstRunReady = $state(false);
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
	let replayMode = $state<'live' | 'replay'>('live');
	let ghostEnabled = $state(true);
	const recorder = new ReplayRecorder();
	let player: InstanceType<typeof ReplayPlayer> | null = null;
	let replaySource: ReplaySource | null = null;
	let replayCamera: InstanceType<typeof CameraRig> | null = null;

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
		void startRun({
			canvas: pendingMount.canvas,
			focusTarget: pendingMount.focusTarget,
			width: pendingMount.width,
			height: pendingMount.height,
			vehicle,
			track,
		});
	}

	async function startRun(args: {
		canvas: HTMLCanvasElement;
		focusTarget: HTMLElement;
		width: number;
		height: number;
		vehicle: VehiclePreset;
		track: TrackPreset;
	}): Promise<void> {
		stopRun({ invalidate: false });
		const runToken = ++activeRunToken;
		activeSessionId = null;
		activeTrackId = args.track.id;
		activeVehicleId = args.vehicle.id;
		setError(null);
		try {
			// M9: preload Jolt when the vehicle preset carries compliance params.
			let physicsContext: Racing.Engine.PhysicsContext | undefined = undefined;
			if (args.vehicle.physics?.compliance) {
				try {
					physicsContext = await Racing.Engine.createPhysicsContext();
				} catch {
					/* Jolt not available — engine falls back to software compliance */
				}
			}
			engine = new RacingEngine({ vehicle: args.vehicle, track: args.track, setup, physicsContext });
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
			runActive = true;
			firstRunReady = true;
			unsubLap = engine.events.on('lapFinished', (event) => {
				void persistLap(event.lapMs, runToken);
			});
			unsubTick = engine.events.on('tick', (event) => {
				lastSimTime = event.simTime;
			});
			recorder.reset();
			recorder.attach(engine, { trackId: args.track.id, vehicleId: args.vehicle.id });
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
		hud.setFps(dt > 0 ? 1 / dt : 0);

		if (replayMode === 'replay' && player) {
			renderReplayFrame(player.advance(dt), dt);
			scheduleFrame();
			return;
		}

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
		renderer.setWheelPoses(engine.wheelPoses());
		updateGhost();
		const pose = engine.cameraPose();
		renderer.setCameraPose(pose.position, pose.target, pose.up);
		renderer.render();
		updateHud();
		syncReplayHud();
		scheduleFrame();
	}

	function updateGhost(): void {
		if (!renderer) return;
		const best = recorder.bestLap;
		const elapsed = recorder.lapElapsed();
		if (!ghostEnabled || !best || elapsed == null || elapsed > best.frames[best.frames.length - 1].t) {
			renderer.setGhostPose(null);
			return;
		}
		const frame = sampleTrace(best, elapsed);
		renderer.setGhostPose(frame ? { position: frame.pos, quaternion: frame.quat } : null, frame?.wheels);
	}

	function renderReplayFrame(frame: ReplayFrame | null, dt: number): void {
		if (!engine || !renderer || !frame || !player) return;
		renderer.setChassisPose({ position: frame.pos, quaternion: frame.quat });
		renderer.setWheelPoses(frame.wheels);
		renderer.setGhostPose(null);
		replayCamera ??= new CameraRig();
		stepReplayCamera(replayCamera, frame, dt, cameraMode);
		const cam = replayCamera.state;
		renderer.setCameraPose(cam.position, cam.target, cam.up);
		renderer.render();
		hud.setSpeed(frame.speedKmh);
		hud.setRpm(frame.rpm);
		hud.setGear(frame.gearLabel);
		hud.setInput({
			throttle: frame.throttle,
			brake: frame.brake,
			steer: frame.steer,
			handbrake: frame.handbrake,
		});
		hud.setReplay({ time: player.time, playing: player.playing, speed: player.speed });
	}

	function replayTrace(source: ReplaySource): ReplayTrace | null {
		if (source === 'last') return recorder.lastLap;
		if (source === 'best') return recorder.bestLap;
		return recorder.recentTrace();
	}

	let lastAvailability = '';
	function syncReplayHud(): void {
		const available = {
			last: recorder.lastLap != null,
			best: recorder.bestLap != null,
			recent: recorder.recentTrace() != null,
		};
		const key = `${available.last}${available.best}${available.recent}`;
		if (key === lastAvailability) return;
		lastAvailability = key;
		hud.setReplay({ available });
	}

	function enterReplay(source?: ReplaySource): boolean {
		if (!engine || !renderer) return false;
		const resolved: ReplaySource =
			source ?? (recorder.lastLap ? 'last' : 'recent');
		const trace = replayTrace(resolved);
		if (!trace) return false;
		player = new ReplayPlayer(trace);
		replaySource = resolved;
		replayMode = 'replay';
		replayCamera = new CameraRig();
		// Seed the replay camera from the live one so the cut isn't jarring.
		const live = engine.cameraPose();
		replayCamera.state.position.set(live.position.x, live.position.y, live.position.z);
		replayCamera.state.target.set(live.target.x, live.target.y, live.target.z);
		hud.setReplay({
			mode: 'replay',
			source: resolved,
			time: 0,
			duration: player.duration,
			playing: true,
			speed: player.speed,
			lapMs: trace.lapMs ?? null,
		});
		return true;
	}

	function exitReplay(): void {
		if (replayMode !== 'replay') return;
		replayMode = 'live';
		player = null;
		replaySource = null;
		replayCamera = null;
		// Skip the wall-clock gap so the live sim resumes exactly where it was.
		lastFrameTime = 0;
		hud.setReplay({ mode: 'live', source: null, time: 0, duration: 0, playing: false, lapMs: null });
	}

	function toggleReplay(): void {
		if (replayMode === 'replay') exitReplay();
		else enterReplay();
	}

	function toggleReplayPlay(): void {
		if (!player) return;
		player.togglePlay();
		hud.setReplay({ playing: player.playing, time: player.time });
	}

	function seekReplay(time: number): void {
		if (!player) return;
		player.seek(time);
		hud.setReplay({ time: player.time });
	}

	function stepReplay(deltaS: number): void {
		if (!player) return;
		seekReplay(player.time + deltaS);
	}

	function setReplaySpeed(speed: number): void {
		if (!player) return;
		if (speed !== 0.25 && speed !== 0.5 && speed !== 1 && speed !== 2) return;
		player.setSpeed(speed as ReplaySpeed);
		hud.setReplay({ speed });
	}

	function toggleGhost(): void {
		ghostEnabled = !ghostEnabled;
		hud.setReplay({ ghostEnabled });
		if (!ghostEnabled) renderer?.setGhostPose(null);
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
			// `lap.t0` is sim time in ms.
			currentMs: snap.lap.t0 != null ? Math.max(0, lastSimTime * 1000 - snap.lap.t0) : null,
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
				fx: w.fx,
				fy: w.fy,
				slipRatio: w.slipRatio,
				slipAngle: w.slipAngle,
				combinedSlip: w.combinedSlip,
				tireUtilization: w.tireUtilization,
				driveTorqueNm: w.driveTorqueNm,
				surface: w.surface,
				tempC: w.tempC,
				brakeTempC: w.brakeTempC,
				tireWear: w.tireWear,
				flatSpotSignal: w.flatSpotSignal,
				bumpStopPct: w.bumpStopPct,
				airborne: w.fz < 1,
				brakeTorqueApplied: w.brakeTorqueApplied,
				absScale: w.absScale,
				absActive: w.absActive,
				yawContribution: w.yawContribution,
				// M1 thermal/pressure/diagnostics
				tempInner: w.tempInner,
				tempMiddle: w.tempMiddle,
				tempOuter: w.tempOuter,
				pressureKpa: w.pressureKpa,
				kappaPeak: w.kappaPeak,
				alphaPeakRad: w.alphaPeakRad,
				tireDeflection: w.tireDeflection,
				relaxationLengthLongM: w.relaxationLengthLongM,
				relaxationLengthLatM: w.relaxationLengthLatM,
				slidingGripScale: w.slidingGripScale,
				slidingSpeedMps: w.slidingSpeedMps,
				pressureInner: w.pressureInner,
				pressureMiddle: w.pressureMiddle,
				pressureOuter: w.pressureOuter,
				pressureCentroidM: w.pressureCentroidM,
				overturningMomentNm: w.overturningMomentNm,
				// M3 suspension kinematics & damper diagnostics
				suspensionTravel: w.suspensionTravel,
				damperVelocity: w.damperVelocity,
				rollCenterHeightM: w.rollCenterHeightM,
				jackingForceN: w.jackingForceN,
				toeDeg: w.toeDeg,
				camberDeg: w.camberDeg,
			})),
		);
		hud.setDrivetrain({
			engineOmega: snap.drivetrain.engineOmega,
			transmissionOmega: snap.drivetrain.transmissionOmega,
			clutchTorqueNm: snap.drivetrain.clutchTorqueNm,
			clutchMode: snap.drivetrain.clutchMode,
			engineDriveTorqueNm: snap.drivetrain.engineDriveTorqueNm,
			engineDragTorqueNm: snap.drivetrain.engineDragTorqueNm,
			// M6 drivetrain depth fields
			boostBar: snap.drivetrain.boostBar,
			turboSpoolRatio: snap.drivetrain.turboSpoolRatio,
			boostTorqueMultiplier: snap.drivetrain.boostTorqueMultiplier,
			isOverboost: snap.drivetrain.isOverboost,
			shiftRefused: snap.drivetrain.shiftRefused,
			shiftRefusalReason: snap.drivetrain.shiftRefusalReason,
			shiftInProgress: snap.drivetrain.shiftInProgress,
			shiftRemainingS: snap.drivetrain.shiftRemainingS,
			drivelineComplianceTwistRad: snap.drivetrain.drivelineComplianceTwistRad,
			drivelineComplianceSpringNm: snap.drivetrain.drivelineComplianceSpringNm,
		});
		hud.setAero({
			frontDownforceN: snap.aero.frontDownforceN,
			rearDownforceN: snap.aero.rearDownforceN,
			dragN: snap.aero.dragN,
			// M5 aero map telemetry
			hasAeroMap: snap.aero.hasAeroMap,
			effectiveClAreaFront: snap.aero.effectiveClAreaFront,
			effectiveClAreaRear: snap.aero.effectiveClAreaRear,
			copFraction: snap.aero.copFraction,
			frontStalled: snap.aero.frontStalled,
			rearStalled: snap.aero.rearStalled,
			frontRideHeightM: snap.aero.frontRideHeightM,
			rearRideHeightM: snap.aero.rearRideHeightM,
			// M8 wake-field drag reduction
			wakeReduction: snap.aero.wakeReduction,
		});
		hud.setFfb(snap.ffb);
		hud.setTrackCondition(snap.trackCondition);
		// Telemetry trace lane: pick the value that matches the active mode
		// so the trace line's vertical scale stays meaningful when the user
		// toggles between load / slip / utilization.
		const traceMode = hud.state.telemetryMode;
		const pickTrace = (i: number): number => {
			const w = snap.wheels[i];
			if (!w) return 0;
			if (traceMode === 'load') return w.fz;
			if (traceMode === 'utilization') return w.tireUtilization;
			return w.slipRatio;
		};
		hud.pushTelemetry(
			{
				fl: pickTrace(0),
				fr: pickTrace(1),
				rl: pickTrace(2),
				rr: pickTrace(3),
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
		exitReplay();
		recorder.detach();
		recorder.reset();
		lastAvailability = '';
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
		if (replayMode === 'replay') {
			toggleReplayPlay();
			return;
		}
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
		exitReplay();
		engine?.resetCar();
		// resetCar clears the lap timer; the partial lap can't become a trace.
		recorder.discardCurrentLap();
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
		get firstRunReady() { return firstRunReady; },
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
		get replayMode() { return replayMode; },
		get replaySource() { return replaySource; },
		get replayTime() { return player?.time ?? 0; },
		get ghostEnabled() { return ghostEnabled; },
		/** Exposed for tests / e2e: the live recorder. */
		get recorder() { return recorder; },
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
		enterReplay,
		exitReplay,
		toggleReplay,
		toggleReplayPlay,
		seekReplay,
		stepReplay,
		setReplaySpeed,
		toggleGhost,
	};
}

export type RacingPageModel = ReturnType<typeof createRacingPageModel>;
