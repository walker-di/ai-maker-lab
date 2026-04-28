<script lang="ts">
	import { goto } from '$app/navigation';
	import {
		Button,
		MarketingEmptyState,
		MarketingShell,
		ProductCard,
		ProductForm,
	} from 'ui/source';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import PackageIcon from '@lucide/svelte/icons/package';
	import { createProductsPage } from './products-page.composition.js';

	const model = createProductsPage();

	function navigate(path: string) {
		void goto(`/marketing${path}`);
	}
</script>

<svelte:head>
	<title>Marketing Products</title>
</svelte:head>

<MarketingShell activePath="/products" onNavigate={navigate}>
	<div class="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
		<header class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
			<div class="space-y-2">
				<p class="text-muted-foreground text-sm font-medium">Marketing Manager</p>
				<h1 class="text-foreground text-3xl font-semibold tracking-tight">Products</h1>
				<p class="text-muted-foreground max-w-2xl text-sm leading-6">
					Manage marketing products before generating personas, campaigns, creatives, and stories.
				</p>
			</div>
			<Button type="button" class="gap-2" onclick={() => model.openCreateForm()}>
				<PlusIcon class="h-4 w-4" />
				New product
			</Button>
		</header>

		{#if model.errorMessage}
			<p class="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
				{model.errorMessage}
			</p>
		{/if}

		{#if model.isFormOpen}
			<section class="rounded-xl border bg-card p-5 shadow-sm" aria-label={model.selectedProduct ? 'Edit product' : 'Create product'}>
				<div class="mb-4 space-y-1">
					<h2 class="text-lg font-semibold">{model.selectedProduct ? 'Edit product' : 'Create product'}</h2>
					<p class="text-muted-foreground text-sm">Product data is saved through the marketing transport adapter.</p>
				</div>
				<ProductForm
					product={model.selectedProduct}
					isLoading={model.isLoading}
					onSubmit={(data) => void model.saveProduct(data)}
					onCancel={() => model.closeForm()}
				/>
			</section>
		{/if}

		{#if model.hasProducts}
			<section class="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="Products">
				{#each model.products as product (product.id)}
					<ProductCard
						{product}
						onEdit={() => model.openEditForm(product)}
						onDelete={() => void model.deleteProduct(product.id)}
						onViewPersonas={() => void goto(`/marketing/products/${product.id}`)}
					/>
				{/each}
			</section>
		{:else if !model.isLoading && model.hasLoaded}
			<MarketingEmptyState
				title="No products yet"
				description="Create a product to start building product-scoped personas and campaigns."
				actionLabel="Create product"
				onAction={() => model.openCreateForm()}
			>
				{#snippet icon()}
					<PackageIcon class="h-6 w-6" />
				{/snippet}
			</MarketingEmptyState>
		{:else}
			<p class="text-muted-foreground rounded-xl border border-dashed p-8 text-center text-sm">Loading products…</p>
		{/if}
	</div>
</MarketingShell>
