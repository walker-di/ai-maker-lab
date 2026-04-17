<script lang="ts">
	import { Badge } from '$ui/components/ui/badge/index.js';
	import * as Dialog from '$ui/components/ui/dialog/index.js';
	import { Separator } from '$ui/components/ui/separator/index.js';
	import { cn } from '$ui/utils.js';
	import ChatToolInvocationIcon from './ChatToolInvocationIcon.svelte';
	import {
		getToolCode,
		getToolFiles,
		getToolLocationSummary,
		getToolPreviewUrl,
		getToolQuery,
		getToolSources,
		getToolUrl,
	} from './tool-invocation-details.js';
	import {
		formatToolInvocationDisplayValue,
		formatToolInvocationForDisplay,
	} from './tool-invocation-display.js';
	import { getToolInvocationPresentation, summarizeToolInvocation } from './tool-invocation-presentation.js';
	import type { ToolInvocationAvailabilityInfo, ToolInvocationInfo } from './types.js';

	interface Props {
		open?: boolean;
		invocation: ToolInvocationInfo | null;
		availability?: ToolInvocationAvailabilityInfo | null;
	}

	let { open = $bindable(), invocation, availability = null }: Props = $props();
	let showRaw = $state(false);

	const accentClasses = {
		sky: 'border-sky-500/20 bg-sky-500/10',
		emerald: 'border-emerald-500/20 bg-emerald-500/10',
		violet: 'border-violet-500/20 bg-violet-500/10',
		amber: 'border-amber-500/20 bg-amber-500/10',
		rose: 'border-rose-500/20 bg-rose-500/10',
		teal: 'border-teal-500/20 bg-teal-500/10',
		indigo: 'border-indigo-500/20 bg-indigo-500/10',
		slate: 'border-border bg-muted/60',
	} as const;

	function getStatusBadgeVariant(state: ToolInvocationInfo['state']): 'outline' | 'secondary' | 'destructive' {
		if (state === 'error') return 'destructive';
		if (state === 'output-available' || state === 'approval-responded') return 'outline';
		return 'secondary';
	}

	function getStatusLabel(state: ToolInvocationInfo['state']): string {
		switch (state) {
			case 'input-streaming': return 'running';
			case 'input-available': return 'prepared';
			case 'output-available': return 'completed';
			case 'error': return 'error';
			case 'approval-requested': return 'needs approval';
			case 'approval-responded': return 'approved';
		}
	}
</script>

<Dialog.Root bind:open>
	{#if invocation}
		{@const presentation = getToolInvocationPresentation(invocation.toolName)}
		{@const summary = summarizeToolInvocation(invocation)}
		{@const query = getToolQuery(invocation)}
		{@const targetUrl = getToolUrl(invocation)}
		{@const previewUrl = getToolPreviewUrl(invocation)}
		{@const codeBlock = getToolCode(invocation)}
		{@const sourceItems = getToolSources(invocation)}
		{@const fileItems = getToolFiles(invocation)}
		{@const locationSummary = getToolLocationSummary(invocation)}
		{@const inputDisplay = formatToolInvocationDisplayValue(invocation.input, { toolName: invocation.toolName })}
		{@const outputDisplay = formatToolInvocationDisplayValue(invocation.output, { toolName: invocation.toolName })}
		{@const rawDisplay = formatToolInvocationForDisplay(invocation)}

		<Dialog.Content class="max-h-[90vh] overflow-hidden p-0 sm:max-w-3xl">
			<div class={cn('border-b px-5 py-4', accentClasses[presentation.accent])}>
				<Dialog.Header class="pr-10">
					<div class="flex items-start gap-3">
						<div class="bg-background/80 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border">
							<ChatToolInvocationIcon icon={presentation.icon} class="h-5 w-5" />
						</div>
						<div class="min-w-0 flex-1">
							<Dialog.Title class="flex flex-wrap items-center gap-2">
								<span>{presentation.label}</span>
								<Badge variant={getStatusBadgeVariant(invocation.state)}>
									{getStatusLabel(invocation.state)}
								</Badge>
							</Dialog.Title>
							<Dialog.Description class="mt-1 space-y-1">
								<span class="block">{summary ?? presentation.description}</span>
								<span class="block font-mono text-[11px]">Tool call: {invocation.toolCallId}</span>
							</Dialog.Description>
						</div>
					</div>
				</Dialog.Header>
			</div>

			<div class="max-h-[72vh] space-y-4 overflow-y-auto px-5 py-4">
				<div class="grid gap-3 md:grid-cols-3">
					<div class="rounded-xl border p-3">
						<p class="text-muted-foreground text-[11px] font-medium uppercase tracking-wide">Family</p>
						<p class="mt-1 text-sm font-medium">{availability?.family ?? presentation.family}</p>
					</div>
					<div class="rounded-xl border p-3">
						<p class="text-muted-foreground text-[11px] font-medium uppercase tracking-wide">Model support</p>
						<p class="mt-1 text-sm font-medium">{availability?.supported === false ? 'Not supported' : 'Supported'}</p>
					</div>
					<div class="rounded-xl border p-3">
						<p class="text-muted-foreground text-[11px] font-medium uppercase tracking-wide">Enabled now</p>
						<p class="mt-1 text-sm font-medium">{availability?.enabled === false ? 'Disabled' : 'Enabled'}</p>
					</div>
				</div>

				<p class="text-muted-foreground text-sm">{presentation.availabilityDescription}</p>

				{#if invocation.errorText}
					<div class="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-900 dark:text-red-100">
						<p class="font-medium">Tool error</p>
						<p class="mt-1 whitespace-pre-wrap">{invocation.errorText}</p>
					</div>
				{/if}

				{#each presentation.detailSections as section (section)}
					{#if section === 'summary'}
						<div class="rounded-xl border p-4">
							<p class="text-muted-foreground text-[11px] font-medium uppercase tracking-wide">Overview</p>
							<p class="mt-2 text-sm">{summary ?? presentation.description}</p>
						</div>
					{:else if section === 'query' && query}
						<div class="rounded-xl border p-4">
							<p class="text-muted-foreground text-[11px] font-medium uppercase tracking-wide">Query</p>
							<p class="mt-2 text-sm whitespace-pre-wrap">{query}</p>
						</div>
					{:else if section === 'url' && targetUrl}
						<div class="rounded-xl border p-4">
							<p class="text-muted-foreground text-[11px] font-medium uppercase tracking-wide">Target URL</p>
							<a href={targetUrl} target="_blank" rel="noreferrer noopener" class="mt-2 block break-all text-sm underline underline-offset-4">
								{targetUrl}
							</a>
						</div>
					{:else if section === 'preview' && previewUrl}
						<div class="rounded-xl border p-4">
							<p class="text-muted-foreground text-[11px] font-medium uppercase tracking-wide">Preview</p>
							<img
								src={previewUrl}
								alt={`${presentation.label} preview`}
								class="mt-3 max-h-[28rem] w-full rounded-2xl border object-contain"
							/>
						</div>
					{:else if section === 'code' && codeBlock}
						<div class="rounded-xl border p-4">
							<p class="text-muted-foreground text-[11px] font-medium uppercase tracking-wide">Code Or Output</p>
							<pre class="bg-muted mt-3 overflow-auto rounded-xl p-3 text-xs whitespace-pre-wrap">{codeBlock}</pre>
						</div>
					{:else if section === 'files' && fileItems.length > 0}
						<div class="rounded-xl border p-4">
							<p class="text-muted-foreground text-[11px] font-medium uppercase tracking-wide">Files</p>
							<div class="mt-3 space-y-2">
								{#each fileItems as file (`${file.name}:${file.url ?? ''}`)}
									<div class="flex items-center justify-between gap-3 rounded-xl border px-3 py-2">
										<span class="min-w-0 flex-1 truncate text-sm">{file.name}</span>
										{#if file.url}
											<a href={file.url} target="_blank" rel="noreferrer noopener" class="text-xs underline underline-offset-4">
												Open
											</a>
										{/if}
									</div>
								{/each}
							</div>
						</div>
					{:else if section === 'location' && locationSummary}
						<div class="rounded-xl border p-4">
							<p class="text-muted-foreground text-[11px] font-medium uppercase tracking-wide">Location</p>
							<p class="mt-2 text-sm whitespace-pre-wrap">{locationSummary}</p>
						</div>
					{:else if section === 'sources' && sourceItems.length > 0}
						<div class="rounded-xl border p-4">
							<p class="text-muted-foreground text-[11px] font-medium uppercase tracking-wide">Sources</p>
							<div class="mt-3 space-y-3">
								{#each sourceItems as source (`${source.title}:${source.url ?? ''}`)}
									<div class="rounded-xl border px-3 py-3">
										<p class="text-sm font-medium">{source.title}</p>
										{#if source.url}
											<a href={source.url} target="_blank" rel="noreferrer noopener" class="text-muted-foreground mt-1 block break-all text-xs underline underline-offset-4">
												{source.url}
											</a>
										{/if}
										{#if source.snippet}
											<p class="text-muted-foreground mt-2 text-sm whitespace-pre-wrap">{source.snippet}</p>
										{/if}
									</div>
								{/each}
							</div>
						</div>
					{:else if section === 'input'}
						<div class="rounded-xl border p-4">
							<p class="text-muted-foreground text-[11px] font-medium uppercase tracking-wide">Input</p>
							{#if invocation.input != null}
								<pre
									class="bg-muted mt-3 overflow-auto rounded-xl p-3 text-xs whitespace-pre-wrap"
									data-testid="tool-dialog-input"
								>{inputDisplay}</pre>
							{:else}
								<p class="text-muted-foreground mt-2 text-sm">{presentation.emptyInputText}</p>
							{/if}
						</div>
					{:else if section === 'output'}
						<div class="rounded-xl border p-4">
							<p class="text-muted-foreground text-[11px] font-medium uppercase tracking-wide">Output</p>
							{#if invocation.output != null}
								<pre
									class="bg-muted mt-3 overflow-auto rounded-xl p-3 text-xs whitespace-pre-wrap"
									data-testid="tool-dialog-output"
								>{outputDisplay}</pre>
							{:else}
								<p class="text-muted-foreground mt-2 text-sm">{presentation.emptyOutputText}</p>
							{/if}
						</div>
					{:else if section === 'raw'}
						<Separator />
						<div class="rounded-xl border p-4">
							<div class="flex items-center justify-between gap-3">
								<p class="text-muted-foreground text-[11px] font-medium uppercase tracking-wide">Raw Invocation</p>
								<button
									type="button"
									class="text-xs underline underline-offset-4"
									data-testid="tool-dialog-raw-toggle"
									onclick={() => (showRaw = !showRaw)}
								>
									{showRaw ? 'Hide' : 'Show'}
								</button>
							</div>
							{#if showRaw}
								<pre
									class="bg-muted mt-3 overflow-auto rounded-xl p-3 text-xs whitespace-pre-wrap"
									data-testid="tool-dialog-raw"
								>{rawDisplay}</pre>
							{/if}
						</div>
					{/if}
				{/each}
			</div>
		</Dialog.Content>
	{/if}
</Dialog.Root>
