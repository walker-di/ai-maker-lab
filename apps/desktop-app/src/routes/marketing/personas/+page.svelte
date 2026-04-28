<script lang="ts">
	import { goto } from '$app/navigation';
	import {
		Button,
		MarketingEmptyState,
		MarketingShell,
		PersonaCard,
		PersonaForm,
	} from 'ui/source';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import UsersIcon from '@lucide/svelte/icons/users';
	import { createPersonasPage } from './personas-page.composition.js';

	const model = createPersonasPage();

	function navigate(path: string) {
		void goto(`/marketing${path}`);
	}
</script>

<svelte:head>
	<title>Marketing Personas</title>
</svelte:head>

<MarketingShell activePath="/personas" onNavigate={navigate}>
	<div class="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
		<header class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
			<div class="space-y-2">
				<p class="text-muted-foreground text-sm font-medium">Marketing Manager</p>
				<h1 class="text-foreground text-3xl font-semibold tracking-tight">Personas</h1>
				<p class="text-muted-foreground max-w-2xl text-sm leading-6">
					Browse and manage buyer personas across marketing products.
				</p>
			</div>
			<Button type="button" class="gap-2" onclick={() => model.openCreateForm()} disabled={model.products.length === 0}>
				<PlusIcon class="h-4 w-4" />
				New persona
			</Button>
		</header>

		{#if model.errorMessage}
			<p class="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
				{model.errorMessage}
			</p>
		{/if}

		{#if model.products.length === 0 && model.hasLoaded}
			<p class="text-muted-foreground rounded-md border border-dashed px-4 py-3 text-sm">
				Create a product before creating personas.
			</p>
		{/if}

		{#if model.isFormOpen}
			<section class="rounded-xl border bg-card p-5 shadow-sm">
				<div class="mb-4 space-y-1">
					<h2 class="text-lg font-semibold">{model.selectedPersona ? 'Edit persona' : 'Create persona'}</h2>
					<p class="text-muted-foreground text-sm">Personas should be linked to a marketing product.</p>
				</div>
				<PersonaForm
					persona={model.selectedPersona}
					products={model.products}
					isLoading={model.isLoading}
					onSubmit={(data) => void model.savePersona(data)}
					onCancel={() => model.closeForm()}
				/>
			</section>
		{/if}

		{#if model.hasPersonas}
			<section class="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="Personas">
				{#each model.personas as persona (persona.id)}
					<PersonaCard
						{persona}
						onEdit={() => model.openEditForm(persona)}
						onDelete={() => void model.deletePersona(persona.id)}
					/>
				{/each}
			</section>
		{:else if !model.isLoading && model.hasLoaded}
			<MarketingEmptyState
				title="No personas yet"
				description="Create a persona manually or generate product-scoped personas from a product page."
				actionLabel="Create persona"
				onAction={() => model.openCreateForm()}
			>
				{#snippet icon()}
					<UsersIcon class="h-6 w-6" />
				{/snippet}
			</MarketingEmptyState>
		{:else}
			<p class="text-muted-foreground rounded-xl border border-dashed p-8 text-center text-sm">Loading personas…</p>
		{/if}
	</div>
</MarketingShell>
