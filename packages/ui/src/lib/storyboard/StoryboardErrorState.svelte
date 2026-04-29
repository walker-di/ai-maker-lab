<script lang="ts">
	type Props = {
		title: string;
		description: string;
		technicalDetails?: string;
		retryLabel: string;
		onRetry: () => void;
		isRetrying?: boolean;
	};

	let { title, description, technicalDetails, retryLabel, onRetry, isRetrying = false }: Props = $props();
</script>

<div role="alert" class="flex flex-col items-center gap-4 py-12 text-center">
	<div class="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
		<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
			<circle cx="12" cy="12" r="10" />
			<line x1="12" y1="8" x2="12" y2="12" />
			<line x1="12" y1="16" x2="12.01" y2="16" />
		</svg>
	</div>

	<div class="flex flex-col gap-1">
		<h2 class="text-lg font-semibold">{title}</h2>
		<p class="text-muted-foreground max-w-md text-sm">{description}</p>
	</div>

	{#if technicalDetails}
		<details class="max-w-md text-left">
			<summary class="text-muted-foreground cursor-pointer text-xs">Technical details</summary>
			<pre class="bg-muted mt-1 rounded p-2 text-xs whitespace-pre-wrap break-words">{technicalDetails}</pre>
		</details>
	{/if}

	<button
		type="button"
		onclick={onRetry}
		disabled={isRetrying}
		class="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
	>
		{#if isRetrying}
			<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="animate-spin" aria-hidden="true">
				<path d="M21 12a9 9 0 1 1-6.219-8.56" />
			</svg>
		{/if}
		{retryLabel}
	</button>
</div>
