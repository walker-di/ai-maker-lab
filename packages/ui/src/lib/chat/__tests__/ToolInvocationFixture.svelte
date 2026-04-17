<script lang="ts">
	import ChatMessageBubble from '../ChatMessageBubble.svelte';
	import ChatToolInvocationDialog from '../ChatToolInvocationDialog.svelte';
	import type {
		ToolInvocationAvailabilityInfo,
		ToolInvocationInfo,
	} from '../types.js';

	type Variant =
		| 'web-search'
		| 'image-generation'
		| 'error'
		| 'approval-requested';

	interface Props {
		openDialog?: boolean;
		variant?: Variant;
	}

	let { openDialog = false, variant = 'web-search' }: Props = $props();
	const onePixelPngBase64 =
		'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9sZrxh8AAAAASUVORK5CYII=';

	const invocation = $derived<ToolInvocationInfo>((() => {
		if (variant === 'image-generation') {
			return {
				toolCallId: 'tool-image-1',
				toolName: 'image_generation',
				state: 'output-available',
				input: { prompt: 'pls create a panda image' },
				output: {
					result: onePixelPngBase64,
				},
			};
		}
		if (variant === 'error') {
			return {
				toolCallId: 'tool-image-error-1',
				toolName: 'image_generation',
				state: 'error',
				input: { prompt: 'draw infeasible shape' },
				output: undefined,
				errorText: 'Image generation failed: policy violation.',
			};
		}
		if (variant === 'approval-requested') {
			return {
				toolCallId: 'tool-web-fetch-pending',
				toolName: 'web_fetch',
				state: 'approval-requested',
				input: { url: 'https://internal.example.com/reports/q1' },
				output: undefined,
			};
		}
		return {
			toolCallId: 'tool-1',
			toolName: 'web_search',
			state: 'output-available',
			input: { query: 'current dollar real rate' },
			output: {
				results: [
					{
						title: 'Wise exchange rate',
						url: 'https://wise.com',
						snippet: 'USD to BRL market rate overview.',
					},
				],
			},
		};
	})());

	const availability = $derived<ToolInvocationAvailabilityInfo>((() => {
		if (variant === 'image-generation') {
			return {
				toolName: 'image_generation',
				label: 'Image Generation',
				family: 'imageGeneration',
				supported: true,
				enabled: true,
			};
		}
		if (variant === 'error') {
			return {
				toolName: 'image_generation',
				label: 'Image Generation',
				family: 'imageGeneration',
				supported: true,
				enabled: true,
			};
		}
		if (variant === 'approval-requested') {
			return {
				toolName: 'web_fetch',
				label: 'Web Fetch',
				family: 'webFetch',
				supported: true,
				enabled: true,
			};
		}
		return {
			toolName: 'web_search',
			label: 'Web Search',
			family: 'search',
			supported: true,
			enabled: true,
		};
	})());

	const bubbleContent = $derived(
		variant === 'image-generation'
			? 'Here is your panda image.'
			: variant === 'error'
				? "I couldn't produce that image."
				: variant === 'approval-requested'
					? 'I need approval to fetch that URL.'
					: 'I checked the latest sources.',
	);
</script>

<div
	class="dark bg-background text-foreground space-y-4 p-6"
	data-testid="tool-invocation-fixture"
	style="width: 720px; font-family: system-ui, sans-serif;"
>
	<ChatMessageBubble
		role="assistant"
		content={bubbleContent}
		agentName="Researcher"
		agentSource="system"
		toolInvocations={[invocation]}
		onToolInvocationOpen={() => undefined}
	/>

	<ChatToolInvocationDialog
		open={openDialog}
		{invocation}
		{availability}
	/>
</div>
