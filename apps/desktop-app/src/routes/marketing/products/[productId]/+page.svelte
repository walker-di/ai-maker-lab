<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import {
		Button,
		MarketingEmptyState,
		MarketingShell,
		PersonaCard,
		PersonaForm,
		ProductDetailView,
	} from 'ui/source';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import SparklesIcon from '@lucide/svelte/icons/sparkles';
	import UsersIcon from '@lucide/svelte/icons/users';
	import { createProductDetailPage } from './product-detail-page.composition.js';

	const model = createProductDetailPage(page.params.productId ?? '');

	function navigate(path: string) {
		void goto(`/marketing${path}`);
	}
</script>

<svelte:head>
	<title>{model.product ? `${model.product.name} · Marketing` : 'Marketing Product'}</title>
</svelte:head>

<MarketingShell activePath="/products" onNavigate={navigate}>
	<div class="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
		<div>
			<Button type="button" variant="ghost" onclick={() => void goto('/marketing/products')}>← Products</Button>
		</div>

		{#if model.errorMessage}
			<p class="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
				{model.errorMessage}
			</p>
		{/if}

		{#if model.product}
			<ProductDetailView
				product={model.product}
				personaCount={model.personas.length}
				onEdit={() => void goto('/marketing/products')}
				onGeneratePersonas={() => void model.generatePersonas()}
				onViewPersonas={() => model.openCreatePersonaForm()}
			/>

			<section class="flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-sm">
				<div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
					<div class="space-y-1">
						<h2 class="text-xl font-semibold">Personas</h2>
						<p class="text-muted-foreground text-sm">Personas are scoped to this product.</p>
					</div>
					<div class="flex flex-wrap gap-2">
						<Button type="button" variant="outline" class="gap-2" onclick={() => void model.generatePersonas()} disabled={model.isLoading}>
							<SparklesIcon class="h-4 w-4" />
							Generate
						</Button>
						<Button type="button" class="gap-2" onclick={() => model.openCreatePersonaForm()}>
							<PlusIcon class="h-4 w-4" />
							New persona
						</Button>
					</div>
				</div>

				{#if model.isPersonaFormOpen}
					<div class="rounded-lg border bg-background p-4">
						<PersonaForm
							persona={model.selectedPersona}
							products={model.productsForForm}
							isLoading={model.isLoading}
							onSubmit={(data) => void model.savePersona(data)}
							onCancel={() => model.closePersonaForm()}
						/>
					</div>
				{/if}

				{#if model.hasPersonas}
					<div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
						{#each model.personas as persona (persona.id)}
							<PersonaCard
								{persona}
								onEdit={() => model.openEditPersonaForm(persona)}
								onDelete={() => void model.deletePersona(persona.id)}
							/>
						{/each}
					</div>
				{:else if !model.isLoading && model.hasLoaded}
					<MarketingEmptyState
						title="No personas yet"
						description="Create or generate personas for this product."
						actionLabel="Create persona"
						onAction={() => model.openCreatePersonaForm()}
					>
						{#snippet icon()}
							<UsersIcon class="h-6 w-6" />
						{/snippet}
					</MarketingEmptyState>
				{:else}
					<p class="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">Loading personas…</p>
				{/if}
			</section>
		{:else if model.isLoading}
			<p class="text-muted-foreground rounded-xl border border-dashed p-8 text-center text-sm">Loading product…</p>
		{/if}
	</div>
</MarketingShell>
