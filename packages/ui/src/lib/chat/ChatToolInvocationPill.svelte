<script lang="ts">
	import { cn } from '$ui/utils.js';
	import ChatToolInvocationIcon from './ChatToolInvocationIcon.svelte';
	import { getToolInvocationPresentation, summarizeToolInvocation } from './tool-invocation-presentation.js';
	import type { ToolInvocationInfo } from './types.js';

	interface Props {
		invocation: ToolInvocationInfo;
		onclick?: () => void;
	}

	let { invocation, onclick }: Props = $props();

	const presentation = $derived(getToolInvocationPresentation(invocation.toolName));
	const summary = $derived(summarizeToolInvocation(invocation));

	const accentClasses = {
		sky: 'border-sky-500/25 bg-sky-500/10 text-sky-950 dark:text-sky-100',
		emerald: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-950 dark:text-emerald-100',
		violet: 'border-violet-500/25 bg-violet-500/10 text-violet-950 dark:text-violet-100',
		amber: 'border-amber-500/25 bg-amber-500/10 text-amber-950 dark:text-amber-100',
		rose: 'border-rose-500/25 bg-rose-500/10 text-rose-950 dark:text-rose-100',
		teal: 'border-teal-500/25 bg-teal-500/10 text-teal-950 dark:text-teal-100',
		indigo: 'border-indigo-500/25 bg-indigo-500/10 text-indigo-950 dark:text-indigo-100',
		slate: 'border-border bg-muted/60 text-foreground',
	} as const;

	const statusClasses = {
		'input-streaming': 'ring-1 ring-current/20',
		'input-available': '',
		'output-available': 'shadow-sm',
		error: 'border-red-500/35 bg-red-500/10 text-red-950 dark:text-red-100',
		'approval-requested': 'border-amber-500/35 bg-amber-500/12',
		'approval-responded': 'border-emerald-500/35 bg-emerald-500/12',
	} as const;
</script>

<button
	type="button"
	class={cn(
		'inline-flex max-w-full items-center gap-2 rounded-full border px-3 py-2 text-left text-sm transition-colors hover:opacity-90',
		accentClasses[presentation.accent],
		statusClasses[invocation.state],
	)}
	aria-label={`Inspect ${presentation.label}`}
	title={`Inspect ${presentation.label}`}
	{onclick}
>
	<span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-background/80">
		<ChatToolInvocationIcon icon={presentation.icon} class="h-3.5 w-3.5" />
	</span>

	<span class="min-w-0">
		<span class="block truncate text-[11px] font-medium uppercase tracking-[0.14em] opacity-70">
			{presentation.shortLabel}
		</span>
		<span class="block truncate font-medium">
			{summary ?? presentation.description}
		</span>
	</span>
</button>
