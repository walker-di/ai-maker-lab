<script lang="ts">
	import { goto } from '$app/navigation';
	import { Button, MarketingShell } from 'ui/source';
	import PackageIcon from '@lucide/svelte/icons/package';
	import UsersIcon from '@lucide/svelte/icons/users';
	import MegaphoneIcon from '@lucide/svelte/icons/megaphone';
	import PaletteIcon from '@lucide/svelte/icons/palette';
	import { m } from '$lib/paraglide/messages.js';

	function navigate(path: string) {
		void goto(`/marketing${path}`);
	}

	const cards = [
		{ label: () => m.marketing_nav_products(), description: () => m.marketing_card_products_description(), path: '/products', icon: PackageIcon },
		{ label: () => m.marketing_nav_personas(), description: () => m.marketing_card_personas_description(), path: '/personas', icon: UsersIcon },
		{ label: () => m.marketing_nav_campaigns(), description: () => m.marketing_card_campaigns_description(), path: '/campaigns', icon: MegaphoneIcon },
		{ label: () => m.marketing_nav_creatives(), description: () => m.marketing_card_creatives_description(), path: '/creatives', icon: PaletteIcon },
	];
</script>

<svelte:head>
	<title>{m.marketing_dashboard_title()}</title>
</svelte:head>

<MarketingShell activePath="/dashboard" onNavigate={navigate}>
	<div class="mx-auto flex w-full max-w-6xl flex-col gap-8 p-6">
		<header class="space-y-3">
			<p class="text-muted-foreground text-sm font-medium">{m.marketing_dashboard_app_title()}</p>
			<h1 class="text-foreground text-3xl font-semibold tracking-tight">{m.marketing_dashboard_title()}</h1>
			<p class="text-muted-foreground max-w-3xl text-sm leading-6">
				{m.marketing_dashboard_intro()}
			</p>
		</header>

		<section class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
			{#each cards as card}
				<button
					type="button"
					class="group rounded-xl border bg-card p-5 text-left shadow-sm transition hover:border-primary/40 hover:shadow-md"
					onclick={() => navigate(card.path)}
				>
					<card.icon class="mb-4 h-6 w-6 text-muted-foreground transition group-hover:text-primary" />
					<h2 class="text-base font-semibold">{card.label()}</h2>
					<p class="text-muted-foreground mt-2 text-sm leading-6">{card.description()}</p>
				</button>
			{/each}
		</section>

		<div>
			<Button type="button" onclick={() => navigate('/products')}>{m.marketing_home_open_products()}</Button>
		</div>
	</div>
</MarketingShell>
