<script lang="ts">
	import type { Snippet } from 'svelte';
	import * as Resizable from '../components/ui/resizable/index.js';

	type Props = {
		leftLabel?: string;
		rightLabel?: string;
		defaultLeftSize?: number;
		minLeftSize?: number;
		minRightSize?: number;
		leftPane?: Snippet<[]>;
		rightPane?: Snippet<[]>;
		persistenceKey?: string;
		allowCollapse?: boolean;
	};
	let {
		leftLabel = 'chat',
		rightLabel = 'code',
		defaultLeftSize = 60,
		minLeftSize = 30,
		minRightSize = 20,
		leftPane,
		rightPane,
		persistenceKey,
		allowCollapse = true,
	}: Props = $props();

	let isMobile = $state(false);
	let active: 'left' | 'right' = $state('left');

	function checkMobile() {
		isMobile = window.innerWidth < 768;
	}
	$effect(() => {
		checkMobile();
		window.addEventListener('resize', checkMobile);
		return () => window.removeEventListener('resize', checkMobile);
	});
</script>

<div class="bg-background text-foreground h-full min-h-0">
	{#if isMobile}
		<div class="relative h-full min-h-0 overflow-hidden">
			<div class="flex h-full flex-col overflow-hidden pb-12">
				{#if active === 'left'}
					<section class="relative min-h-0 flex-1">
						<div class="h-full overflow-auto">{@render leftPane?.()}</div>
					</section>
				{:else}
					<section class="relative min-h-0 flex-1">
						<div class="h-full overflow-auto">{@render rightPane?.()}</div>
					</section>
				{/if}
			</div>

			<nav
				class="border-border bg-background/95 supports-[backdrop-filter]:bg-background/80 fixed inset-x-0 bottom-0 z-20 border-t backdrop-blur"
			>
				<div class="grid grid-cols-2">
					<button
						type="button"
						class="border-border border-r px-3 py-2 text-sm font-medium transition-colors {active ===
						'left'
							? 'bg-muted text-foreground'
							: 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'}"
						aria-pressed={active === 'left'}
						onclick={() => (active = 'left')}>{leftLabel}</button
					>
					<button
						type="button"
						class="px-3 py-2 text-sm font-medium transition-colors {active === 'right'
							? 'bg-muted text-foreground'
							: 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'}"
						aria-pressed={active === 'right'}
						onclick={() => (active = 'right')}>{rightLabel}</button
					>
				</div>
			</nav>
		</div>
	{:else}
		<Resizable.PaneGroup
			direction="horizontal"
			autoSaveId={persistenceKey}
			class="h-full min-h-0"
		>
			<Resizable.Pane
				defaultSize={defaultLeftSize}
				minSize={minLeftSize}
				collapsible={allowCollapse}
			>
				<div class="h-full min-h-0 overflow-hidden">{@render leftPane?.()}</div>
			</Resizable.Pane>
			<Resizable.Handle withHandle />
			<Resizable.Pane
				defaultSize={100 - defaultLeftSize}
				minSize={minRightSize}
				collapsible={allowCollapse}
			>
				<div class="h-full min-h-0 overflow-hidden">{@render rightPane?.()}</div>
			</Resizable.Pane>
		</Resizable.PaneGroup>
	{/if}
</div>
