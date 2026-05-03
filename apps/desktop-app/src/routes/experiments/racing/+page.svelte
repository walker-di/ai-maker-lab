<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { Button, Racing } from 'ui/source';
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

	let canvas = $state<HTMLCanvasElement | undefined>(undefined);
	let canvasHost = $state<HTMLDivElement | undefined>(undefined);

	function readQuery(key: string): string | null {
		if (typeof window === 'undefined') return null;
		const params = new URLSearchParams(window.location.search);
		return params.get(key);
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
		const w = Math.max(320, Math.round(rect.width));
		const h = Math.max(180, Math.round(rect.height));
		model.setMountTarget(canvas, w, h);
	}

	onMount(() => {
		syncSize();
		const observer = new ResizeObserver(() => syncSize());
		if (canvasHost) observer.observe(canvasHost);
		return () => observer.disconnect();
	});

	onDestroy(() => model.dispose());

	function handleKeyDown(event: KeyboardEvent) {
		const target = event.target;
		if (
			target instanceof HTMLInputElement ||
			target instanceof HTMLTextAreaElement ||
			target instanceof HTMLSelectElement
		) {
			return;
		}
		const key = event.key.toLowerCase();
		if (key === 'r') {
			event.preventDefault();
			model.reset();
		} else if (key === 'm') {
			event.preventDefault();
			model.toggleMute();
		} else if (key === 'c') {
			event.preventDefault();
			model.cycleCamera();
		} else if (key === '[') {
			event.preventDefault();
			model.shiftDown();
		} else if (key === ']') {
			event.preventDefault();
			model.shiftUp();
		} else if (key === '~' || key === '`') {
			event.preventDefault();
			model.toggleDebug();
		} else if (key === 'p') {
			event.preventDefault();
			model.togglePause();
		}
	}
</script>

<svelte:window onkeydown={handleKeyDown} />

<svelte:head>
	<title>Racing Sim</title>
</svelte:head>

<div class="mx-auto flex min-h-screen max-w-7xl flex-col gap-4 px-6 py-6">
	<header class="flex items-baseline justify-between gap-4">
		<div class="flex flex-col">
			<h1 class="text-foreground text-3xl font-semibold tracking-tight">Racing Sim</h1>
			<p class="text-muted-foreground text-sm">
				Press <kbd>R</kbd> to reset · <kbd>C</kbd> to cycle cameras ·
				<kbd>[</kbd> / <kbd>]</kbd> shift down/up · <kbd>M</kbd> mute · <kbd>~</kbd> debug
			</p>
		</div>
		<div class="flex items-center gap-2">
			<Button
				variant="outline"
				size="sm"
				onclick={() => model.cycleCamera()}
				disabled={!model.runActive}
			>
				Camera: {model.cameraMode}
			</Button>
			<Button
				variant="outline"
				size="sm"
				onclick={() => model.togglePause()}
				disabled={!model.runActive}
			>
				{model.paused ? 'Resume' : 'Pause'}
			</Button>
			<Button
				variant="outline"
				size="sm"
				onclick={() => model.reset()}
				disabled={!model.runActive}
			>
				Reset
			</Button>
		</div>
	</header>

	{#if model.errorMessage}
		<p
			class="rounded-2xl border border-red-300/60 bg-red-50 px-5 py-3 text-sm text-red-700"
			data-testid="racing-error"
		>
			{model.errorMessage}
		</p>
	{/if}

	<section class="grid gap-4 lg:grid-cols-[18rem_1fr]" data-testid="racing-stage">
		<aside class="flex flex-col gap-4">
			<div class="border-border bg-background flex flex-col gap-3 rounded-xl border p-4">
				<h2 class="text-foreground text-sm font-semibold uppercase tracking-wide">
					Vehicle
				</h2>
				{#if model.isLoading && model.vehicles.length === 0}
					<p class="text-muted-foreground text-xs">Loading vehicles…</p>
				{:else}
					<div class="flex flex-col gap-2">
						{#each model.vehicles as vehicle (vehicle.id)}
							<button
								type="button"
								class="border-border hover:bg-accent flex flex-col rounded-lg border px-3 py-2 text-left text-sm transition"
								class:bg-accent={model.selectedVehicleId === vehicle.id}
								onclick={() => model.selectVehicle(vehicle.id)}
							>
								<span class="text-foreground font-medium">{vehicle.label}</span>
								<span class="text-muted-foreground text-xs">
									{vehicle.driveLabel} · {vehicle.layoutLabel}
								</span>
							</button>
						{/each}
					</div>
				{/if}
			</div>

			<div class="border-border bg-background flex flex-col gap-3 rounded-xl border p-4">
				<h2 class="text-foreground text-sm font-semibold uppercase tracking-wide">
					Track
				</h2>
				{#if model.isLoading && model.tracks.length === 0}
					<p class="text-muted-foreground text-xs">Loading tracks…</p>
				{:else}
					<div class="flex flex-col gap-2">
						{#each model.tracks as track (track.id)}
							<button
								type="button"
								class="border-border hover:bg-accent flex flex-col rounded-lg border px-3 py-2 text-left text-sm transition"
								class:bg-accent={model.selectedTrackId === track.id}
								onclick={() => model.selectTrack(track.id)}
							>
								<span class="text-foreground font-medium">{track.label}</span>
								<span class="text-muted-foreground text-xs">
									{track.ctrl.length} pts · half {track.halfWidth}m
								</span>
							</button>
						{/each}
					</div>
				{/if}
			</div>

			{#if !model.runActive}
				<Button
					variant="default"
					onclick={() => model.startMatch()}
					disabled={!model.selectedTrackId || !model.selectedVehicleId}
				>
					Start drive
				</Button>
			{/if}
		</aside>

		<div class="flex flex-col gap-3">
			<div
				bind:this={canvasHost}
				class="racing-canvas-host border-border bg-background relative aspect-[16/9] w-full overflow-hidden rounded-2xl border"
				data-testid="racing-canvas"
			>
				<canvas bind:this={canvas} class="absolute inset-0 h-full w-full"></canvas>
				{#if !model.runActive}
					<div
						class="text-muted-foreground absolute inset-0 flex items-center justify-center text-sm"
					>
						Pick a vehicle + track and press <kbd class="mx-1">Start drive</kbd>.
					</div>
				{/if}
			</div>

			<RacingHud model={model.hud} />
		</div>
	</section>
</div>

<style>
	:global(.racing-canvas-host canvas) {
		display: block;
	}
</style>
