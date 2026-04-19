<script lang="ts">
	import { page } from '$app/state';
	import { locales, localizeHref } from '$lib/paraglide/runtime';
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { Separator, Sidebar } from 'ui/source';
	import AppSidebar from '$lib/components/AppSidebar.svelte';
	import { pageHeader } from '$lib/state/page-header.svelte';
	import { m } from '$lib/paraglide/messages.js';

	let { children } = $props();

	type RouteEntry = {
		match: (pathname: string) => boolean;
		title: () => string;
	};

	const routeEntries: RouteEntry[] = [
		{ match: (p) => p.startsWith('/experiments/chat'), title: () => m.lab_experiment_chat_label() },
		{ match: (p) => p.startsWith('/agents'), title: () => m.lab_experiment_agent_registry_label() },
		{ match: (p) => p.startsWith('/settings'), title: () => m.lab_settings_label() },
		{ match: (p) => p === '/', title: () => 'Home' },
	];

	const pageTitle = $derived.by(() => {
		const pathname = page.url.pathname;
		const entry = routeEntries.find((e) => e.match(pathname));
		return entry ? entry.title() : '';
	});
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<Sidebar.Provider style="--sidebar-width: 16rem; --header-height: 3rem;">
	<AppSidebar variant="inset" />
	<Sidebar.Inset class="flex min-h-svh flex-col">
		<header
			class="bg-background sticky top-0 z-10 flex h-12 shrink-0 items-center gap-2 border-b px-3"
		>
			<Sidebar.Trigger class="-ms-1" />
			<Separator orientation="vertical" class="mx-2 h-4" />
			<div class="flex min-w-0 items-center gap-2 text-sm">
				{#if pageTitle}
					<span class="text-foreground font-medium truncate">{pageTitle}</span>
				{/if}
				{#if pageHeader.subtitle}
					<span class="text-muted-foreground" aria-hidden="true">/</span>
					<span class="text-muted-foreground truncate">{pageHeader.subtitle}</span>
				{/if}
			</div>
		</header>
		<div class="flex min-h-0 flex-1 flex-col">
			{@render children()}
		</div>
	</Sidebar.Inset>
</Sidebar.Provider>

<div style="display:none">
	{#each locales as locale}
		<a href={localizeHref(page.url.pathname, { locale })}>{locale}</a>
	{/each}
</div>
