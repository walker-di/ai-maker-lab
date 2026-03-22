<script lang="ts">
	import { Button, Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@ai-maker-lab/ui';
	import { onMount } from 'svelte';
	import { createWorkspaceHomeModel } from './workspace-home.svelte.ts';

	const model = createWorkspaceHomeModel();

	onMount(() => {
		void model.load();
	});
</script>

<article class="min-h-screen bg-gradient-to-b from-background via-background to-muted/30 px-6 py-10 sm:px-10 lg:px-16">
	<div class="mx-auto flex max-w-6xl flex-col gap-6">
		<section class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
			<div class="space-y-3">
				<div class="text-xs font-medium uppercase tracking-[0.32em] text-muted-foreground">
					Neutralino desktop shell
				</div>
				<h1 class="max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
					`app/desktop-app` is now the desktop adapter boundary.
				</h1>
				<p class="max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg">
					The app shell owns runtime wiring, native platform adapters, and locale bootstrapping while shared UI
					and domain packages stay reusable.
				</p>
			</div>

			<div class="flex flex-wrap gap-2">
				{#each model.state.locales as locale}
					<Button
						variant={locale === model.state.locale ? 'default' : 'outline'}
						onclick={() => model.changeLocale(locale)}
					>
						{locale.toUpperCase()}
					</Button>
				{/each}
			</div>
		</section>

		<section class="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
			<Card class="border-border/70 bg-card/95">
				<CardHeader class="gap-3">
					<div class="text-xs font-medium uppercase tracking-[0.28em] text-muted-foreground">
						Runtime status
					</div>
					<CardTitle class="text-2xl">Neutralino-backed shell, browser-safe preview.</CardTitle>
					<CardDescription class="text-base leading-7">
						{#if model.state.welcomeMessage}
							{model.state.welcomeMessage}
						{:else}
							The shell loads its runtime metadata through an app-local desktop adapter.
						{/if}
					</CardDescription>
				</CardHeader>

				<CardContent class="space-y-4">
					{#if model.state.status === 'loading' || model.state.status === 'idle'}
						<div class="rounded-2xl border border-dashed border-border/70 bg-muted/40 p-5 text-sm text-muted-foreground">
							Loading shell status...
						</div>
					{:else if model.state.status === 'error'}
						<div class="rounded-2xl border border-destructive/40 bg-destructive/10 p-5 text-sm text-destructive">
							{model.state.errorMessage}
						</div>
					{:else if model.state.runtime}
						<div class="grid gap-3 sm:grid-cols-2">
							{#each model.runtimeSummary as item}
								<div class="rounded-2xl border border-border/70 bg-background/80 p-4">
									<div class="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
										{item.label}
									</div>
									<div class="mt-3 text-sm font-medium text-foreground sm:text-base">{item.value}</div>
								</div>
							{/each}
						</div>
					{/if}
				</CardContent>

				<CardFooter class="flex flex-wrap gap-3 border-t border-border/60 pt-6">
					<Button variant="outline" onclick={() => void model.load()}>Refresh runtime snapshot</Button>
					<Button
						variant="outline"
						disabled={!model.state.runtime?.windowControlsEnabled}
						onclick={() => void model.minimizeWindow()}
					>
						Minimize window
					</Button>
					<Button disabled={!model.state.runtime?.nativeApiEnabled} onclick={() => void model.exitApp()}>
						Exit app
					</Button>
				</CardFooter>
			</Card>

			<Card class="border-border/70 bg-card/95">
				<CardHeader>
					<CardTitle>Adapter pattern guardrails</CardTitle>
					<CardDescription>
						Keep Neutralino integration at the shell boundary instead of spreading it through the view layer.
					</CardDescription>
				</CardHeader>
				<CardContent class="space-y-4 text-sm leading-6 text-muted-foreground">
					<div class="rounded-2xl border border-border/70 bg-muted/50 p-4">
						<div class="font-medium text-foreground">`app/desktop-app`</div>
						<p>Desktop runtime wiring, platform ports, locale bootstrapping, and app-specific composition.</p>
					</div>
					<div class="rounded-2xl border border-border/70 bg-muted/50 p-4">
						<div class="font-medium text-foreground">`@ai-maker-lab/ui`</div>
						<p>Reusable Shadcn-based primitives and presentation building blocks with no shell knowledge.</p>
					</div>
					<div class="rounded-2xl border border-border/70 bg-muted/50 p-4">
						<div class="font-medium text-foreground">`@ai-maker-lab/domain`</div>
						<p>Framework-free types and workflow helpers that stay portable across future applications.</p>
					</div>
				</CardContent>
			</Card>
		</section>

		<section class="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
			<Card class="border-border/70 bg-card/95">
				<CardHeader>
					<CardTitle>Migration checklist</CardTitle>
					<CardDescription>
						The shell still consumes the shared domain package for product-facing guidance.
					</CardDescription>
				</CardHeader>
				<CardContent class="grid gap-4 sm:grid-cols-3">
					{#each model.state.checklist as item}
						<div class="rounded-2xl border border-border/70 bg-background/80 p-4">
							<div class="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
								Ready
							</div>
							<h2 class="mt-3 text-base font-semibold text-foreground">{item.title}</h2>
							<p class="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p>
						</div>
					{/each}
				</CardContent>
			</Card>

			<Card class="border-border/70 bg-card/95">
				<CardHeader>
					<CardTitle>What changed</CardTitle>
					<CardDescription>
						The shell no longer relies on SvelteKit routes or server hooks for startup.
					</CardDescription>
				</CardHeader>
				<CardContent class="space-y-3 text-sm leading-6 text-muted-foreground">
					<p>Vite mounts a single Svelte entry and Neutralino hosts the built assets inside a native window.</p>
					<p>Paraglide now boots from the client runtime, so locale state is resolved without a server hook.</p>
					<p>Native calls flow through a dedicated desktop adapter with a browser fallback for preview and tests.</p>
				</CardContent>
			</Card>
		</section>
	</div>
</article>
