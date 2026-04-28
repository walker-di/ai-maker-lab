<script lang="ts">
	import { goto } from '$app/navigation';
	import { Button, MarketingShell } from 'ui/source';
	import PackageIcon from '@lucide/svelte/icons/package';
	import UsersIcon from '@lucide/svelte/icons/users';
	import MegaphoneIcon from '@lucide/svelte/icons/megaphone';
	import PaletteIcon from '@lucide/svelte/icons/palette';

	function navigate(path: string) {
		void goto(`/marketing${path}`);
	}

	const cards = [
		{ label: 'Products', description: 'Create products and manage product-scoped personas.', path: '/products', icon: PackageIcon },
		{ label: 'Personas', description: 'Browse generated and manually-created personas.', path: '/personas', icon: UsersIcon },
		{ label: 'Campaigns', description: 'Plan campaigns for marketing products.', path: '/campaigns', icon: MegaphoneIcon },
		{ label: 'Creatives', description: 'Compose creative assets and storyboards.', path: '/creatives', icon: PaletteIcon },
	];
</script>

<svelte:head>
	<title>Marketing Manager</title>
</svelte:head>

<MarketingShell activePath="/dashboard" onNavigate={navigate}>
	<div class="mx-auto flex w-full max-w-6xl flex-col gap-8 p-6">
		<header class="space-y-3">
			<p class="text-muted-foreground text-sm font-medium">AI Maker Lab</p>
			<h1 class="text-foreground text-3xl font-semibold tracking-tight">Marketing Manager</h1>
			<p class="text-muted-foreground max-w-3xl text-sm leading-6">
				Migrate and operate the marketing workflow: products, personas, campaigns, creatives, stories, assets, and exports.
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
					<h2 class="text-base font-semibold">{card.label}</h2>
					<p class="text-muted-foreground mt-2 text-sm leading-6">{card.description}</p>
				</button>
			{/each}
		</section>

		<div>
			<Button type="button" onclick={() => navigate('/products')}>Open products</Button>
		</div>
	</div>
</MarketingShell>
