<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { Racing } from 'ui/source';
	import { createRacingPage } from './racing-page.composition.ts';

	type CameraMode = Racing.CameraMode;
	const { Runtime } = Racing;
	const { RacingHud } = Runtime;

	const initialCamera = readQueryCamera();
	const initialTrack = readQuery('track');
	const initialVehicle = readQuery('vehicle');

	const model = createRacingPage({
		initialCamera,
		initialTrackId: initialTrack ?? undefined,
		initialVehicleId: initialVehicle ?? undefined,
	});
	const selectedVehicle = $derived(model.vehicles.find((vehicle) => vehicle.id === model.selectedVehicleId));
	const selectedTrack = $derived(model.tracks.find((track) => track.id === model.selectedTrackId));

	type SetupField = {
		key: keyof typeof model.setup;
		label: string;
		min: number;
		max: number;
		step: number;
		unit: string;
	};
	type SetupSection = { label: string; fields: readonly SetupField[] };

	const setupSections = [
		{
			label: 'Alignment & steering',
			fields: [
				{ key: 'frontToeDeg', label: 'Front toe', min: -2, max: 2, step: 0.1, unit: 'deg' },
				{ key: 'rearToeDeg', label: 'Rear toe', min: -2, max: 2, step: 0.1, unit: 'deg' },
				{ key: 'casterDeg', label: 'Caster', min: 0, max: 12, step: 0.5, unit: 'deg' },
				{ key: 'ackermannPct', label: 'Ackermann', min: 0, max: 1, step: 0.05, unit: '' },
				{ key: 'camberFrontDeg', label: 'Front camber', min: -4.5, max: 0.5, step: 0.1, unit: 'deg' },
				{ key: 'camberRearDeg', label: 'Rear camber', min: -4.5, max: 0.5, step: 0.1, unit: 'deg' },
			],
		},
		{
			label: 'Suspension geometry',
			fields: [
				{ key: 'motionRatioFront', label: 'Front motion ratio', min: 0.4, max: 1.5, step: 0.05, unit: '' },
				{ key: 'motionRatioRear', label: 'Rear motion ratio', min: 0.4, max: 1.5, step: 0.05, unit: '' },
				{ key: 'rideHeightFrontMm', label: 'Front ride height', min: -30, max: 30, step: 1, unit: 'mm' },
				{ key: 'rideHeightRearMm', label: 'Rear ride height', min: -30, max: 30, step: 1, unit: 'mm' },
			],
		},
		{
			label: 'Bump stops',
			fields: [
				{ key: 'bumpStopGapFrontMm', label: 'Front bump gap', min: 50, max: 350, step: 5, unit: 'mm' },
				{ key: 'bumpStopGapRearMm', label: 'Rear bump gap', min: 50, max: 350, step: 5, unit: 'mm' },
				{ key: 'bumpStopRateFrontNmm', label: 'Front bump rate', min: 0, max: 600, step: 10, unit: 'N/mm' },
				{ key: 'bumpStopRateRearNmm', label: 'Rear bump rate', min: 0, max: 600, step: 10, unit: 'N/mm' },
			],
		},
		{
			label: 'Springs & dampers',
			fields: [
				{ key: 'springFrontNpm', label: 'Front spring', min: 0, max: 300000, step: 5000, unit: 'N/m' },
				{ key: 'springRearNpm', label: 'Rear spring', min: 0, max: 300000, step: 5000, unit: 'N/m' },
				{ key: 'damperBumpFrontScale', label: 'Front bump damping', min: 0.5, max: 2, step: 0.05, unit: '' },
				{ key: 'damperReboundFrontScale', label: 'Front rebound damping', min: 0.5, max: 2, step: 0.05, unit: '' },
				{ key: 'damperBumpRearScale', label: 'Rear bump damping', min: 0.5, max: 2, step: 0.05, unit: '' },
				{ key: 'damperReboundRearScale', label: 'Rear rebound damping', min: 0.5, max: 2, step: 0.05, unit: '' },
			],
		},
		{
			label: 'Differential & gearing',
			fields: [
				{ key: 'diffPowerRamp', label: 'Diff power ramp', min: 0, max: 1, step: 0.05, unit: '' },
				{ key: 'diffCoastRamp', label: 'Diff coast ramp', min: 0, max: 1, step: 0.05, unit: '' },
				{ key: 'diffPreloadNm', label: 'Diff preload', min: 0, max: 200, step: 5, unit: 'Nm' },
				{ key: 'finalDriveScale', label: 'Final drive scale', min: 0.7, max: 1.5, step: 0.01, unit: '' },
			],
		},
		{
			label: 'Tires, brakes & fuel',
			fields: [
				{ key: 'tirePressureFLKpa', label: 'FL tire pressure', min: 130, max: 280, step: 1, unit: 'kPa' },
				{ key: 'tirePressureFRKpa', label: 'FR tire pressure', min: 130, max: 280, step: 1, unit: 'kPa' },
				{ key: 'tirePressureRLKpa', label: 'RL tire pressure', min: 130, max: 280, step: 1, unit: 'kPa' },
				{ key: 'tirePressureRRKpa', label: 'RR tire pressure', min: 130, max: 280, step: 1, unit: 'kPa' },
				{ key: 'brakeBiasFront', label: 'Front brake bias', min: 0.3, max: 0.8, step: 0.01, unit: '' },
				{ key: 'fuelLoad', label: 'Fuel load', min: 0, max: 1, step: 0.05, unit: '' },
			],
		},
	] as const satisfies readonly SetupSection[];

	let canvas = $state<HTMLCanvasElement | undefined>(undefined);
	let canvasHost = $state<HTMLDivElement | undefined>(undefined);
	let showAdvancedSetup = $state(false);

	function readQuery(key: string): string | null {
		if (typeof window === 'undefined') return null;
		return new URLSearchParams(window.location.search).get(key);
	}

	function readQueryCamera(): CameraMode {
		const value = readQuery('cam');
		if (value === 'chase' || value === 'hood' || value === 'far' || value === 'map') {
			return value;
		}
		return 'chase';
	}

	function syncSize(): void {
		if (!canvas || !canvasHost) return;
		const rect = canvasHost.getBoundingClientRect();
		model.setMountTarget(
			canvas,
			canvasHost,
			Math.max(320, Math.round(rect.width)),
			Math.max(180, Math.round(rect.height)),
		);
	}

	function focusCanvasHost(): void {
		canvasHost?.focus();
	}

	function handleCanvasClick(event: MouseEvent): void {
		const target = event.target;
		if (target instanceof Element && target.closest('select, input, button, label, a')) {
			return;
		}
		focusCanvasHost();
	}

	function updateSetupField(
		key: SetupField['key'],
		event: Event,
	): void {
		const target = event.currentTarget;
		if (!(target instanceof HTMLInputElement)) return;
		model.updateSetupField(key, target.valueAsNumber);
	}

	function handleVehicleChange(event: Event): void {
		const target = event.currentTarget;
		if (!(target instanceof HTMLSelectElement)) return;
		model.selectVehicle(target.value);
	}

	function handleTrackChange(event: Event): void {
		const target = event.currentTarget;
		if (!(target instanceof HTMLSelectElement)) return;
		model.selectTrack(target.value);
	}

	onMount(() => {
		syncSize();
		const observer = new ResizeObserver(() => syncSize());
		if (canvasHost) observer.observe(canvasHost);
		(window as Window & { __racing?: unknown }).__racing = model;
		return () => {
			observer.disconnect();
			delete (window as Window & { __racing?: unknown }).__racing;
		};
	});

	onDestroy(() => model.dispose());

	$effect(() => {
		if (model.runActive) {
			queueMicrotask(() => focusCanvasHost());
		}
	});

	$effect(() => {
		if (typeof window === 'undefined') return;
		const params = new URLSearchParams(window.location.search);
		if (model.selectedTrackId) params.set('track', model.selectedTrackId);
		if (model.selectedVehicleId) params.set('vehicle', model.selectedVehicleId);
		params.set('cam', model.cameraMode);
		const next = `${window.location.pathname}?${params.toString()}`;
		window.history.replaceState(window.history.state, '', next);
	});

	function handleKeyDown(event: KeyboardEvent) {
		const target = event.target;
		if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement) {
			return;
		}
		const key = event.key.toLowerCase();
		if (key === 'r') {
			event.preventDefault();
			model.reset();
		} else if (key === 'm') {
			event.preventDefault();
			model.toggleMute();
		} else if (key === 'c' || key === 'tab') {
			event.preventDefault();
			model.cycleCamera();
		} else if (key === '[') {
			event.preventDefault();
			model.shiftDown();
		} else if (key === ']') {
			event.preventDefault();
			model.shiftUp();
		} else if (key === '1' || key === '2' || key === '3') {
			event.preventDefault();
			const vehicle = model.vehicles[Number.parseInt(key, 10) - 1];
			if (vehicle) model.selectVehicle(vehicle.id);
		} else if (key === ',') {
			event.preventDefault();
			const currentIndex = model.tracks.findIndex((track) => track.id === model.selectedTrackId);
			const nextIndex = currentIndex <= 0 ? model.tracks.length - 1 : currentIndex - 1;
			const track = model.tracks[nextIndex];
			if (track) model.selectTrack(track.id);
		} else if (key === '.') {
			event.preventDefault();
			const currentIndex = model.tracks.findIndex((track) => track.id === model.selectedTrackId);
			const nextIndex = currentIndex >= model.tracks.length - 1 ? 0 : currentIndex + 1;
			const track = model.tracks[nextIndex];
			if (track) model.selectTrack(track.id);
		} else if (key === '~' || key === '`' || key === 't' || key === 'l') {
			event.preventDefault();
			model.toggleDebug();
		} else if (key === 'p') {
			event.preventDefault();
			model.togglePause();
		}
	}
</script>

<svelte:head>
	<title>AML Racing</title>
</svelte:head>

<div class="racing-route" data-testid="racing-stage">
	<div
		bind:this={canvasHost}
		class={model.runActive
			? 'racing-canvas-host is-running'
			: 'racing-canvas-host'}
		data-testid="racing-canvas"
		role="application"
		tabindex="0"
		aria-label="Racing driving stage"
		onkeydown={handleKeyDown}
		onclick={handleCanvasClick}
	>
		<canvas bind:this={canvas} class="racing-canvas"></canvas>
		<RacingHud model={model.hud} />

		{#if model.isLoading || (!model.firstRunReady && !model.errorMessage)}
			<div class="loading-overlay" data-testid="racing-loading">
				<div class="loading-box panel-surface">
					<div class="eyebrow">AML Racing</div>
					<div class="title">Loading sim…</div>
					<div class="step">Initializing track, car, and telemetry</div>
					{#if model.errorMessage}
						<div class="error-copy">{model.errorMessage}</div>
					{/if}
				</div>
			</div>
		{/if}

		{#if model.errorMessage && !model.isLoading}
			<div class="error-banner" data-testid="racing-error">{model.errorMessage}</div>
		{/if}

		<div class="panel-surface setup-card" data-testid="racing-setup">
			<div class="setup-head">
				<span class="label">Tier 3 Setup</span>
				<span class="setup-chip">{selectedTrack?.dampZones?.length || selectedTrack?.gravelZones?.length ? 'mixed surface' : 'dry surface'}</span>
			</div>

			<label class="setup-field">
				<span>Vehicle preset</span>
				<select value={model.selectedVehicleId ?? ''} onchange={handleVehicleChange}>
					{#each model.vehicles as vehicle (vehicle.id)}
						<option value={vehicle.id}>{vehicle.label}</option>
					{/each}
				</select>
			</label>

			<label class="setup-field">
				<span>Course</span>
				<select value={model.selectedTrackId ?? ''} onchange={handleTrackChange}>
					{#each model.tracks as track (track.id)}
						<option value={track.id}>{track.label}</option>
					{/each}
				</select>
			</label>

			<div class="setup-grid" data-testid="racing-aids">
				<label class="setup-toggle">
					<input type="checkbox" checked={model.absEnabled} onchange={() => model.toggleAbs()} />
					<span>ABS</span>
					<b>{model.absEnabled ? 'armed' : 'off'}</b>
				</label>
				<label class="setup-toggle">
					<input type="checkbox" checked={model.tcEnabled} onchange={() => model.toggleTc()} />
					<span>TC</span>
					<b>{model.tcEnabled ? 'armed' : 'off'}</b>
				</label>
				<label class="setup-toggle">
					<input type="checkbox" checked={model.escEnabled} onchange={() => model.toggleEsc()} />
					<span>ESC</span>
					<b>{model.escEnabled ? 'stable' : 'off'}</b>
				</label>
			</div>

			<div class="setup-stats">
				<div class="setup-stat"><span>Drive</span><span class="v">{selectedVehicle?.driveLabel ?? '—'}</span></div>
				<div class="setup-stat"><span>Layout</span><span class="v">{selectedVehicle?.layoutLabel ?? '—'}</span></div>
				<div class="setup-stat"><span>Balance</span><span class="v">{selectedVehicle ? `${Math.round(selectedVehicle.frontMassPct * 100)} / ${Math.round((1 - selectedVehicle.frontMassPct) * 100)}` : '—'}</span></div>
				<div class="setup-stat"><span>Gearing</span><span class="v small">{selectedVehicle ? selectedVehicle.gears.filter((gear) => /^\d+$/.test(gear.n)).map((gear) => gear.ratio.toFixed(2)).join(' · ') : '—'}</span></div>
			</div>

			<button
				type="button"
				class="advanced-toggle"
				onclick={() => {
					showAdvancedSetup = !showAdvancedSetup;
				}}
			>
				<span>Advanced setup</span>
				<b>{showAdvancedSetup ? 'hide' : 'show'}</b>
			</button>

			{#if showAdvancedSetup}
				<div class="setup-sliders">
					{#each setupSections as section (section.label)}
						<section class="setup-slider-section" aria-label={section.label}>
							<div class="setup-section-title">{section.label}</div>
							{#each section.fields as field (field.key)}
								<label class="slider-field">
									<div class="slider-head">
										<span>{field.label}</span>
										<span class="v">{model.setup[field.key].toFixed(field.step < 1 ? 2 : 0)}{field.unit}</span>
									</div>
									<input
										type="range"
										min={field.min}
										max={field.max}
										step={field.step}
										value={model.setup[field.key]}
										oninput={(event) => updateSetupField(field.key, event)}
									/>
								</label>
							{/each}
						</section>
					{/each}
				</div>
			{/if}
		</div>

		<div class="panel-surface controls-hint">
			<span><kbd>W</kbd>/<kbd>↑</kbd> throttle</span>
			<span><kbd>S</kbd>/<kbd>↓</kbd> brake</span>
			<span><kbd>A</kbd><kbd>D</kbd> steer</span>
			<span><kbd>Space</kbd> handbrake</span>
			<span><kbd>[</kbd><kbd>]</kbd> shift</span>
			<span><kbd>1</kbd><kbd>2</kbd><kbd>3</kbd> presets</span>
			<span><kbd>,</kbd><kbd>.</kbd> course</span>
			<span><kbd>Tab</kbd>/<kbd>C</kbd> camera</span>
			<span><kbd>R</kbd> reset</span>
			<span><kbd>M</kbd> mute</span>
			<span><kbd>T</kbd>/<kbd>L</kbd> debug</span>
			<span><kbd>P</kbd> pause</span>
		</div>

		<footer class="route-credit" data-testid="racing-credit">
			Racing assets by Kenney. Attribution ships in <code>/racing/License.txt</code>.
		</footer>
	</div>
</div>

<style>
	:global(body) {
		background: #06090d;
	}

	.racing-route {
		min-height: 100vh;
		background: #06090d;
	}

	.racing-canvas-host {
		position: relative;
		width: 100vw;
		height: 100vh;
		overflow: hidden;
		outline: none;
		background:
			radial-gradient(circle at 50% 10%, rgba(119, 207, 255, 0.08), transparent 30%),
			#06090d;
	}

	.racing-canvas-host.is-running {
		box-shadow: inset 0 0 0 2px rgba(102, 240, 159, 0.35);
	}

	.racing-canvas {
		position: absolute;
		inset: 0;
		display: block;
		width: 100%;
		height: 100%;
		background: #06090d;
	}

	.panel-surface {
		border: 1px solid rgba(221, 238, 255, 0.1);
		background: rgba(10, 14, 21, 0.78);
		backdrop-filter: blur(16px);
		box-shadow: 0 18px 44px rgba(0, 0, 0, 0.45);
		border-radius: 16px;
		color: #f5f8fc;
	}

	.loading-overlay {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		background: radial-gradient(circle at 50% 50%, rgba(118, 203, 255, 0.08), #06090d 70%);
		z-index: 30;
	}

	.loading-box {
		display: grid;
		gap: 10px;
		text-align: center;
		padding: 28px 36px;
		min-width: 320px;
	}

	.eyebrow {
		font-size: 11px;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: #96a8bb;
	}

	.title {
		font-size: 26px;
		letter-spacing: -0.03em;
		font-weight: 600;
	}

	.step {
		font-size: 12px;
		color: #96a8bb;
	}

	.error-copy,
	.error-banner {
		color: #ff7070;
		font-size: 12px;
		line-height: 1.5;
	}

	.error-banner {
		position: absolute;
		top: 72px;
		left: 50%;
		transform: translateX(-50%);
		z-index: 24;
		padding: 10px 14px;
		border-radius: 12px;
		background: rgba(64, 11, 18, 0.85);
		border: 1px solid rgba(255, 112, 112, 0.45);
	}

	.setup-card {
		position: absolute;
		top: 330px;
		right: 14px;
		width: 320px;
		padding: 12px;
		display: grid;
		gap: 10px;
		pointer-events: auto;
		z-index: 12;
	}

	.setup-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 8px;
	}

	.label {
		font-size: 10px;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: #96a8bb;
	}

	.setup-chip {
		padding: 3px 8px;
		border-radius: 999px;
		border: 1px solid rgba(118, 203, 255, 0.28);
		background: rgba(118, 203, 255, 0.1);
		color: #77cfff;
		font-size: 10px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.setup-field {
		display: grid;
		gap: 6px;
		font-size: 11px;
		color: #96a8bb;
	}

	.setup-field span,
	.setup-section-title,
	.slider-head span:first-child {
		letter-spacing: 0.08em;
		text-transform: uppercase;
		font-size: 10px;
	}

	.setup-field select {
		width: 100%;
		border: 1px solid rgba(221, 238, 255, 0.1);
		border-radius: 10px;
		background: rgba(6, 10, 15, 0.92);
		color: #f5f8fc;
		padding: 8px 10px;
		font: inherit;
		outline: none;
	}

	.setup-grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: 8px;
	}

	.setup-toggle {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: 8px;
		padding: 7px 9px;
		border-radius: 10px;
		border: 1px solid rgba(221, 238, 255, 0.08);
		background: rgba(255, 255, 255, 0.03);
		font-size: 11px;
	}

	.setup-toggle input {
		margin: 0;
		accent-color: #77cfff;
	}

	.setup-toggle span {
		color: #f5f8fc;
		font-size: 11px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.setup-toggle b {
		color: #96a8bb;
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	.setup-stats,
	.setup-sliders {
		display: grid;
		gap: 6px;
		border-top: 1px solid rgba(221, 238, 255, 0.08);
		padding-top: 8px;
	}

	.advanced-toggle {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
		padding: 8px 10px;
		border-radius: 10px;
		border: 1px solid rgba(221, 238, 255, 0.08);
		background: rgba(255, 255, 255, 0.03);
		color: #f5f8fc;
		font: inherit;
		font-size: 11px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		cursor: pointer;
	}

	.advanced-toggle b {
		color: #96a8bb;
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.06em;
	}

	.setup-stat {
		display: flex;
		justify-content: space-between;
		gap: 12px;
		font-size: 11px;
		color: #96a8bb;
	}

	.setup-stat .v,
	.slider-head .v {
		color: #f5f8fc;
		text-align: right;
		font-variant-numeric: tabular-nums;
	}

	.setup-stat .v.small {
		font-size: 10px;
		line-height: 1.35;
	}

	.setup-slider-section {
		display: grid;
		gap: 6px;
	}

	.setup-section-title {
		color: #77cfff;
		padding-top: 4px;
	}

	.slider-field {
		display: grid;
		gap: 4px;
	}

	.slider-head {
		display: flex;
		justify-content: space-between;
		gap: 10px;
		color: #96a8bb;
	}

	.slider-field input[type='range'] {
		width: 100%;
	}

	.controls-hint {
		position: absolute;
		bottom: 14px;
		left: 50%;
		transform: translateX(-50%);
		padding: 8px 14px;
		display: flex;
		gap: 14px;
		flex-wrap: wrap;
		justify-content: center;
		font-size: 11px;
		color: #96a8bb;
		max-width: 880px;
		pointer-events: none;
		z-index: 10;
	}

	.controls-hint kbd,
	.route-credit code {
		font-family: inherit;
		background: rgba(255, 255, 255, 0.06);
		border: 1px solid rgba(221, 238, 255, 0.1);
		border-radius: 4px;
		padding: 1px 6px;
		color: #f5f8fc;
		font-size: 10px;
		margin: 0 2px;
	}

	.route-credit {
		position: absolute;
		bottom: 84px;
		left: 50%;
		transform: translateX(-50%);
		z-index: 9;
		font-size: 11px;
		color: #96a8bb;
		text-align: center;
	}

	@media (max-width: 1100px) {
		.setup-card {
			width: 280px;
		}
	}
</style>
